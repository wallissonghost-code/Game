import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const TICK_RATE = 30;
const SNAPSHOT_RATE = 20;
const WORLD = { width: 1600, height: 900 };
const PLAYER_SPEED = 300;
const INPUT_TIMEOUT_MS = 500;
const MAX_MESSAGE_BYTES = 4096;
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAB_HTML = path.join(ROOT_DIR, 'duo-server.html');
const LAB_JS = path.join(ROOT_DIR, 'src', 'duo-server.js');

const rooms = new Map();
const clientState = new WeakMap();
let serverTick = 0;

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

async function serveFile(res, filePath, contentType) {
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': contentType,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(body);
  } catch (error) {
    console.error(`[http] failed to serve ${filePath}:`, error?.message || error);
    json(res, 500, { ok: false, error: 'lab_asset_unavailable' });
  }
}

const server = http.createServer(async (req, res) => {
  const hostHeader = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${hostHeader}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    return res.end();
  }

  if (url.pathname === '/health') {
    let players = 0;
    for (const room of rooms.values()) players += room.players.size;
    return json(res, 200, {
      ok: true,
      service: 'caos-live-game-server',
      version: '0.1.1-lab',
      rooms: rooms.size,
      players,
      tickRate: TICK_RATE,
      snapshotRate: SNAPSHOT_RATE,
      uptimeSeconds: Math.round(process.uptime()),
      now: Date.now(),
    });
  }

  if (url.pathname === '/api') {
    return json(res, 200, {
      ok: true,
      name: 'Caos Live Multiplayer Server',
      websocket: '/game',
      health: '/health',
      lab: '/duo-server.html',
      mode: 'duo-server-lab',
    });
  }

  if (url.pathname === '/' || url.pathname === '/duo-server.html') {
    if (!url.searchParams.get('server')) {
      const protocol = hostHeader.includes('localhost') || hostHeader.startsWith('127.0.0.1') ? 'http' : 'https';
      const publicOrigin = `${protocol}://${hostHeader}`;
      res.writeHead(302, {
        location: `/duo-server.html?server=${encodeURIComponent(publicOrigin)}`,
        'cache-control': 'no-store',
      });
      return res.end();
    }
    return serveFile(res, LAB_HTML, 'text/html; charset=utf-8');
  }

  if (url.pathname === '/src/duo-server.js') {
    return serveFile(res, LAB_JS, 'text/javascript; charset=utf-8');
  }

  return json(res, 404, { ok: false, error: 'not_found' });
});

const wss = new WebSocketServer({
  server,
  path: '/game',
  perMessageDeflate: false,
  maxPayload: MAX_MESSAGE_BYTES,
});

function cleanRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function cleanName(value) {
  const name = String(value || 'PLAYER').replace(/[<>\n\r]/g, '').trim().slice(0, 18);
  return name || 'PLAYER';
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function send(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // Connection cleanup is handled by close/error.
  }
}

function broadcast(room, payload) {
  const message = JSON.stringify(payload);
  for (const player of room.players.values()) {
    if (player.ws.readyState !== WebSocket.OPEN) continue;
    try {
      player.ws.send(message);
    } catch {
      // Ignore one broken socket; heartbeat/close removes it.
    }
  }
}

function getOrCreateRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = {
      code,
      players: new Map(),
      createdAt: Date.now(),
      tick: 0,
    };
    rooms.set(code, room);
  }
  return room;
}

function roleForRoom(room) {
  const roles = new Set([...room.players.values()].map((player) => player.role));
  if (!roles.has('p1')) return 'p1';
  if (!roles.has('p2')) return 'p2';
  return null;
}

function spawnForRole(role) {
  return role === 'p1'
    ? { x: WORLD.width * 0.45, y: WORLD.height * 0.5 }
    : { x: WORLD.width * 0.55, y: WORLD.height * 0.5 };
}

function roomPresence(room) {
  return [...room.players.values()].map((player) => ({
    id: player.id,
    role: player.role,
    name: player.name,
  }));
}

function removeClient(ws) {
  const state = clientState.get(ws);
  if (!state?.roomCode || !state.playerId) return;

  const room = rooms.get(state.roomCode);
  if (!room) return;

  const player = room.players.get(state.playerId);
  room.players.delete(state.playerId);
  clientState.delete(ws);

  broadcast(room, {
    type: 'presence',
    room: room.code,
    players: roomPresence(room),
    left: player ? { id: player.id, role: player.role, name: player.name } : null,
    serverTime: Date.now(),
  });

  if (room.players.size === 0) rooms.delete(room.code);
}

function joinRoom(ws, message) {
  const roomCode = cleanRoomCode(message.room);
  if (roomCode.length < 4) {
    return send(ws, { type: 'error', code: 'invalid_room', message: 'Sala precisa ter de 4 a 8 caracteres.' });
  }

  const previous = clientState.get(ws);
  if (previous?.roomCode) {
    return send(ws, { type: 'error', code: 'already_joined', message: 'Conexão já entrou em uma sala.' });
  }

  const room = getOrCreateRoom(roomCode);
  const role = roleForRoom(room);
  if (!role) {
    return send(ws, { type: 'error', code: 'room_full', message: 'Sala já tem 2 jogadores.' });
  }

  const spawn = spawnForRole(role);
  const id = `${role}-${Math.random().toString(36).slice(2, 9)}`;
  const player = {
    id,
    role,
    name: cleanName(message.name),
    ws,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    inputX: 0,
    inputY: 0,
    lastSeq: 0,
    lastInputAt: Date.now(),
    joinedAt: Date.now(),
  };

  room.players.set(id, player);
  clientState.set(ws, { roomCode, playerId: id });

  send(ws, {
    type: 'welcome',
    room: roomCode,
    id,
    role,
    player: { id, role, name: player.name, x: player.x, y: player.y },
    world: WORLD,
    tickRate: TICK_RATE,
    snapshotRate: SNAPSHOT_RATE,
    serverTime: Date.now(),
  });

  broadcast(room, {
    type: 'presence',
    room: roomCode,
    players: roomPresence(room),
    serverTime: Date.now(),
  });
}

function handleInput(ws, message) {
  const state = clientState.get(ws);
  if (!state) return;
  const room = rooms.get(state.roomCode);
  const player = room?.players.get(state.playerId);
  if (!player) return;

  let dx = clamp(safeNumber(message.dx), -1, 1);
  let dy = clamp(safeNumber(message.dy), -1, 1);
  const length = Math.hypot(dx, dy);
  if (length > 1) {
    dx /= length;
    dy /= length;
  }

  const seq = Math.max(player.lastSeq, Math.floor(safeNumber(message.seq, player.lastSeq)));
  player.inputX = dx;
  player.inputY = dy;
  player.lastSeq = seq;
  player.lastInputAt = Date.now();
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.connectedAt = Date.now();

  send(ws, {
    type: 'hello',
    service: 'caos-live-game-server',
    version: '0.1.1-lab',
    serverTime: Date.now(),
  });

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    if (raw.length > MAX_MESSAGE_BYTES) {
      ws.close(1009, 'message_too_large');
      return;
    }

    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'error', code: 'invalid_json', message: 'Mensagem inválida.' });
      return;
    }

    if (!message || typeof message.type !== 'string') return;

    switch (message.type) {
      case 'join':
        joinRoom(ws, message);
        break;
      case 'input':
        handleInput(ws, message);
        break;
      case 'ping':
        send(ws, {
          type: 'pong',
          clientTime: safeNumber(message.clientTime),
          serverTime: Date.now(),
        });
        break;
      default:
        break;
    }
  });

  ws.on('close', () => removeClient(ws));
  ws.on('error', () => removeClient(ws));

  const origin = req.headers.origin || 'unknown';
  console.log(`[ws] connected origin=${origin}`);
});

const tickTimer = setInterval(() => {
  const now = Date.now();
  const dt = 1 / TICK_RATE;
  serverTick += 1;

  for (const room of rooms.values()) {
    room.tick += 1;
    for (const player of room.players.values()) {
      if (now - player.lastInputAt > INPUT_TIMEOUT_MS) {
        player.inputX = 0;
        player.inputY = 0;
      }

      player.vx = player.inputX * PLAYER_SPEED;
      player.vy = player.inputY * PLAYER_SPEED;
      player.x = clamp(player.x + player.vx * dt, 28, WORLD.width - 28);
      player.y = clamp(player.y + player.vy * dt, 28, WORLD.height - 28);
    }
  }
}, Math.round(1000 / TICK_RATE));

tickTimer.unref?.();

const snapshotTimer = setInterval(() => {
  const serverTime = Date.now();
  for (const room of rooms.values()) {
    broadcast(room, {
      type: 'snapshot',
      room: room.code,
      tick: serverTick,
      serverTime,
      players: [...room.players.values()].map((player) => ({
        id: player.id,
        role: player.role,
        name: player.name,
        x: Math.round(player.x * 100) / 100,
        y: Math.round(player.y * 100) / 100,
        vx: player.vx,
        vy: player.vy,
        ack: player.lastSeq,
      })),
    });
  }
}, Math.round(1000 / SNAPSHOT_RATE));

snapshotTimer.unref?.();

const heartbeatTimer = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

heartbeatTimer.unref?.();

function shutdown(signal) {
  console.log(`[server] ${signal} received; shutting down`);
  clearInterval(tickTimer);
  clearInterval(snapshotTimer);
  clearInterval(heartbeatTimer);

  for (const ws of wss.clients) {
    try {
      ws.close(1012, 'server_restart');
    } catch {}
  }

  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, HOST, () => {
  console.log(`[server] Caos Live multiplayer lab listening on http://${HOST}:${PORT}`);
  console.log(`[server] lab: /duo-server.html | ws: /game | tick=${TICK_RATE}Hz snapshots=${SNAPSHOT_RATE}Hz`);
});
