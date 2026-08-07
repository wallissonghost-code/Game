import http from 'node:http';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const PORT = Number(process.env.PORT || 8787);
const ACCESS_KEY = String(process.env.CAOS_CONNECTOR_KEY || '').trim();
const MAX_CLIENTS = Math.max(1, Number(process.env.CAOS_MAX_CLIENTS || 25));

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ ok: true, service: 'caos-cloud-connector', clients: wss.clients.size }));
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end('CAOS CLOUD CONNECTOR ONLINE');
});

const wss = new WebSocketServer({ server });

function safeSend(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function normalizeGift(data = {}) {
  const user = data.user?.uniqueId || data.user?.unique_id || data.uniqueId || data.nickname || 'viewer';
  const gift = data.giftName || data.extendedGiftInfo?.name || data.gift?.name || `gift-${data.giftId || 'unknown'}`;
  const count = Number(data.repeatCount || data.repeat_count || data.count || 1) || 1;
  const repeatEnd = data.repeatEnd ?? data.repeat_end ?? true;
  const giftType = Number(data.giftType ?? data.gift_type ?? data.extendedGiftInfo?.type ?? 0) || 0;
  return { type: 'gift', user, gift, count, giftId: data.giftId || data.gift_id || null, repeatEnd, giftType };
}

async function closeLive(state) {
  if (!state.live) return;
  try { state.live.removeAllListeners?.(); } catch {}
  try { state.live.disconnect?.(); } catch {}
  state.live = null;
  state.username = '';
  state.connecting = false;
}

async function connectLive(ws, state, username) {
  username = String(username || '').trim().replace(/^@/, '');
  if (!username) return safeSend(ws, { type: 'error', message: 'Informe o @usuario da LIVE.' });
  if (state.connecting) return safeSend(ws, { type: 'error', message: 'Conexão já em andamento.' });
  if (state.live && state.username === username) return safeSend(ws, { type: 'status', status: 'connected', username });

  await closeLive(state);
  state.connecting = true;
  state.username = username;
  safeSend(ws, { type: 'status', status: 'connecting', username });

  const live = new TikTokLiveConnection(username, { enableExtendedGiftInfo: true });
  state.live = live;

  live.on(WebcastEvent.GIFT, (data) => {
    const gift = normalizeGift(data);
    if (gift.giftType === 1 && gift.repeatEnd === false) return;
    safeSend(ws, gift);
  });

  live.on(WebcastEvent.CHAT, (data) => {
    safeSend(ws, {
      type: 'chat',
      user: data.user?.uniqueId || data.uniqueId || 'viewer',
      comment: data.comment || ''
    });
  });

  live.on('disconnected', () => {
    safeSend(ws, { type: 'status', status: 'disconnected', username });
  });

  live.on('error', (err) => {
    safeSend(ws, { type: 'error', message: err?.message || String(err) });
  });

  try {
    const info = await live.connect();
    state.connecting = false;
    safeSend(ws, { type: 'status', status: 'connected', username, roomId: info?.roomId || null });
  } catch (err) {
    state.connecting = false;
    await closeLive(state);
    safeSend(ws, { type: 'error', message: err?.message || String(err) });
  }
}

wss.on('connection', (ws) => {
  if (wss.clients.size > MAX_CLIENTS) {
    safeSend(ws, { type: 'error', message: 'Servidor temporariamente lotado.' });
    return ws.close(1013, 'busy');
  }

  const state = { authenticated: !ACCESS_KEY, live: null, username: '', connecting: false };
  safeSend(ws, { type: 'bridge', status: 'ready', authRequired: Boolean(ACCESS_KEY) });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'auth') {
      state.authenticated = !ACCESS_KEY || String(msg.key || '') === ACCESS_KEY;
      return safeSend(ws, { type: 'auth', ok: state.authenticated });
    }

    if (!state.authenticated) return safeSend(ws, { type: 'error', message: 'Chave do Caos Connector inválida.' });

    if (msg.type === 'connect') await connectLive(ws, state, msg.username);
    if (msg.type === 'disconnect') {
      await closeLive(state);
      safeSend(ws, { type: 'status', status: 'disconnected' });
    }
    if (msg.type === 'ping') safeSend(ws, { type: 'pong', at: Date.now() });
  });

  ws.on('close', () => closeLive(state));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CAOS CLOUD CONNECTOR online :${PORT}`);
  console.log(`Health: /health`);
});
