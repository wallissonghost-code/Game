import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const PORT = Number(process.env.PORT || 8787);
const ACCESS_KEY = String(process.env.CAOS_CONNECTOR_KEY || '').trim();
const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function currentVersion() {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

function patchVersion(html) {
  const v = currentVersion();
  return html
    .replace(/Caos Live v\d+\.\d+\.\d+/g, `Caos Live v${v}`)
    .replace(/Caos Admin v\d+\.\d+\.\d+/g, `Caos Admin v${v}`)
    .replace(/PAINEL v\d+\.\d+\.\d+/g, `PAINEL v${v}`)
    .replace(/(<div class="version">)v\d+\.\d+\.\d+/g, `$1v${v}`);
}

function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      return res.end('Not found');
    }
    const ext = path.extname(file).toLowerCase();
    const body = ext === '.html' ? Buffer.from(patchVersion(data.toString('utf8')), 'utf8') : data;
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  });
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({
      ok: true,
      service: 'caos-tiktok-minimal',
      mode: 'manual-single-session',
      version: currentVersion(),
      clients: wss.clients.size
    }));
  }
  if (pathname === '/' || pathname === '/admin' || pathname === '/admin-latest' || pathname === '/painel.html') {
    return serveFile(res, path.join(ROOT, 'painel.html'));
  }
  if (pathname === '/jogo') return serveFile(res, path.join(ROOT, 'index.html'));
  const file = path.resolve(ROOT, pathname.replace(/^\/+/, ''));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  serveFile(res, file);
});

const wss = new WebSocketServer({ server });

function safeSend(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function errorText(error) {
  if (typeof error === 'string') return error;
  if (error?.message) return String(error.message);
  try { return JSON.stringify(error); } catch { return String(error); }
}

function deepValue(obj, keys, depth = 0, seen = new Set()) {
  if (!obj || typeof obj !== 'object' || depth > 5 || seen.has(obj)) return '';
  seen.add(obj);
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = deepValue(value, keys, depth + 1, seen);
      if (found) return found;
    }
  }
  return '';
}

function userOf(data = {}) {
  return deepValue(data, ['uniqueId', 'unique_id', 'uniqueID', 'userName', 'username', 'displayId', 'nickname']) || 'viewer';
}

function commentOf(data = {}) {
  return deepValue(data, ['comment', 'content', 'text', 'message', 'msg']) || '';
}

function onMany(live, names, handler) {
  const unique = [...new Set(names.filter(Boolean))];
  for (const name of unique) live.on(name, handler);
}

function attachEvents(ws, session, live, generation) {
  const active = () => session.live === live && session.generation === generation;

  onMany(live, [WebcastEvent.CHAT, 'chat', 'comment'], data => {
    if (!active()) return;
    safeSend(ws, { type: 'chat', user: userOf(data), comment: commentOf(data), liveUser: session.username });
  });

  onMany(live, [WebcastEvent.LIKE, 'like'], data => {
    if (!active()) return;
    const count = Math.max(1, Number(data?.likeCount ?? data?.like_count ?? data?.count ?? 1) || 1);
    safeSend(ws, { type: 'like', user: userOf(data), count, liveUser: session.username });
  });

  onMany(live, [WebcastEvent.FOLLOW, 'follow'], data => {
    if (!active()) return;
    safeSend(ws, { type: 'follow', user: userOf(data), liveUser: session.username });
  });

  onMany(live, [WebcastEvent.SHARE, 'share'], data => {
    if (!active()) return;
    safeSend(ws, { type: 'share', user: userOf(data), liveUser: session.username });
  });

  onMany(live, [WebcastEvent.GIFT, 'gift'], data => {
    if (!active()) return;
    safeSend(ws, {
      type: 'gift',
      user: userOf(data),
      gift: data?.giftName || data?.extendedGiftInfo?.name || data?.gift?.name || `gift-${data?.giftId || 'unknown'}`,
      giftId: data?.giftId ?? data?.gift_id ?? null,
      count: Number(data?.repeatCount ?? data?.repeat_count ?? data?.count ?? 1) || 1,
      diamondCount: Number(data?.diamondCount ?? data?.diamond_count ?? data?.extendedGiftInfo?.diamondCount ?? 0) || 0,
      repeatEnd: data?.repeatEnd ?? data?.repeat_end ?? true,
      giftType: Number(data?.giftType ?? data?.gift_type ?? 0) || 0,
      liveUser: session.username
    });
  });

  live.on('disconnected', () => {
    if (!active()) return;
    session.live = null;
    session.connecting = false;
    session.connected = false;
    safeSend(ws, { type: 'status', status: 'disconnected', reason: 'tiktok', username: session.username });
  });

  live.on('error', error => {
    if (!active()) return;
    safeSend(ws, { type: 'debug', event: 'ERRO TIKTOK', detail: errorText(error).slice(0, 800), mode: 'minimal', at: Date.now() });
  });
}

async function stopSession(ws, session, notify = true) {
  session.generation += 1;
  const live = session.live;
  session.live = null;
  session.connecting = false;
  session.connected = false;
  session.username = '';
  if (live) {
    try { live.removeAllListeners?.(); } catch {}
    try { await live.disconnect?.(); } catch {}
  }
  if (notify) safeSend(ws, { type: 'status', status: 'disconnected', manual: true });
}

async function connectOnce(ws, session, rawUsername) {
  const username = String(rawUsername || '').trim().replace(/^@/, '');
  if (!username) return safeSend(ws, { type: 'error', message: 'Informe o @usuario da LIVE.' });
  if (session.connecting) return safeSend(ws, { type: 'error', message: 'Já existe uma tentativa de conexão em andamento. Pare antes de tentar novamente.' });
  if (session.connected && session.live) return safeSend(ws, { type: 'status', status: 'connected', username: session.username, mode: 'minimal' });

  await stopSession(ws, session, false);
  const generation = session.generation;
  session.username = username;
  session.connecting = true;
  safeSend(ws, { type: 'status', status: 'checking', username, mode: 'minimal' });
  safeSend(ws, { type: 'debug', event: 'CONEXÃO MANUAL INICIADA', username, mode: 'minimal', at: Date.now() });

  const live = new TikTokLiveConnection(username, {
    enableExtendedGiftInfo: false,
    processInitialData: false,
    fetchRoomInfoOnConnect: true
  });
  session.live = live;
  attachEvents(ws, session, live, generation);

  try {
    const info = await live.connect();
    if (session.generation !== generation || session.live !== live) {
      try { live.removeAllListeners?.(); await live.disconnect?.(); } catch {}
      return;
    }
    session.connecting = false;
    session.connected = true;
    safeSend(ws, { type: 'status', status: 'connected', username, roomId: info?.roomId || null, mode: 'minimal' });
    safeSend(ws, { type: 'debug', event: 'TIKTOK CONECTADA', username, roomId: info?.roomId || null, mode: 'minimal', at: Date.now() });
  } catch (error) {
    if (session.generation !== generation || session.live !== live) return;
    const detail = errorText(error).slice(0, 1000);
    try { live.removeAllListeners?.(); await live.disconnect?.(); } catch {}
    session.live = null;
    session.connecting = false;
    session.connected = false;
    safeSend(ws, { type: 'error', message: detail });
    safeSend(ws, { type: 'status', status: 'error', username, reason: detail, mode: 'minimal' });
    safeSend(ws, { type: 'debug', event: 'CONEXÃO MANUAL FALHOU', username, detail, mode: 'minimal', at: Date.now() });
  }
}

wss.on('connection', ws => {
  const session = {
    authenticated: !ACCESS_KEY,
    live: null,
    username: '',
    connecting: false,
    connected: false,
    generation: 0
  };

  safeSend(ws, { type: 'bridge', status: 'ready', authRequired: Boolean(ACCESS_KEY), mode: 'minimal' });

  ws.on('message', async raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }

    if (message.type === 'auth') {
      session.authenticated = !ACCESS_KEY || String(message.key || '') === ACCESS_KEY;
      return safeSend(ws, { type: 'auth', ok: session.authenticated });
    }
    if (!session.authenticated) return safeSend(ws, { type: 'error', message: 'Chave do Caos Connector inválida.' });

    if (message.type === 'connect') return connectOnce(ws, session, message.username);
    if (message.type === 'disconnect') return stopSession(ws, session, true);
    if (message.type === 'ping') {
      return safeSend(ws, {
        type: 'pong',
        at: Date.now(),
        mode: 'minimal',
        username: session.username,
        reconnecting: false,
        attempt: 0,
        tiktokConnected: Boolean(session.connected),
        sessionEpoch: session.generation
      });
    }
    if (message.type === 'observe') return safeSend(ws, { type: 'observe', ok: false, message: 'Observador desativado no teste mínimo.' });
    if (message.type === 'giftcatalog') return safeSend(ws, { type: 'gift_catalog_error', message: 'Catálogo desativado no teste mínimo.' });
  });

  ws.on('close', () => { stopSession(ws, session, false); });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CAOS TIKTOK MINIMAL v${currentVersion()} online :${PORT}`);
});
