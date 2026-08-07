import { WebSocketServer } from 'ws';
import { TikTokLive } from 'tiktok-live-events';

const PORT = Number(process.env.CAOS_TIKTOK_PORT || 2121);
const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
let live = null;
let currentUser = '';
let connecting = false;

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(data);
  }
}

function normalizeGift(e = {}) {
  const user = e.user?.uniqueId || e.user?.unique_id || e.uniqueId || e.username || e.nickname || 'viewer';
  const gift = e.giftName || e.gift?.name || e.gift?.giftName || e.name || 'Presente';
  const count = Number(e.repeatCount || e.repeat_count || e.count || e.amount || 1) || 1;
  const giftId = e.giftId || e.gift?.id || e.gift_id || null;
  const repeatEnd = e.repeatEnd ?? e.repeat_end ?? true;
  return { type: 'gift', user, gift, count, giftId, repeatEnd, raw: undefined };
}

async function disconnectLive() {
  if (!live) return;
  try {
    await live.disconnect?.();
  } catch {}
  live = null;
  currentUser = '';
  connecting = false;
}

async function connectLive(username) {
  username = String(username || '').trim().replace(/^@/, '');
  if (!username) throw new Error('Informe o @usuario da LIVE.');
  if (connecting) throw new Error('Já existe uma conexão em andamento.');
  if (live && currentUser === username) return;

  await disconnectLive();
  connecting = true;
  currentUser = username;
  broadcast({ type: 'status', status: 'connecting', username });

  const client = new TikTokLive(username);
  live = client;

  client.on('gift', (e) => {
    const gift = normalizeGift(e);
    if (gift.repeatEnd === false) return;
    broadcast(gift);
    console.log(`[gift] @${gift.user} -> ${gift.gift} x${gift.count}`);
  });

  client.on?.('chat', (e) => {
    const user = e?.user?.uniqueId || e?.user?.unique_id || 'viewer';
    const comment = e?.comment || '';
    broadcast({ type: 'chat', user, comment });
  });

  client.on?.('disconnected', () => {
    broadcast({ type: 'status', status: 'disconnected', username });
  });

  client.on?.('error', (err) => {
    broadcast({ type: 'error', message: err?.message || String(err) });
  });

  try {
    const info = await client.connect();
    connecting = false;
    broadcast({ type: 'status', status: 'connected', username, roomId: info?.roomId || info?.room_id || null });
    console.log(`[ready] conectado à LIVE de @${username}`);
  } catch (err) {
    connecting = false;
    live = null;
    currentUser = '';
    broadcast({ type: 'error', message: err?.message || String(err) });
    throw err;
  }
}

wss.on('connection', (ws) => {
  send(ws, { type: 'bridge', status: 'ready', port: PORT, username: currentUser || null });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'connect') {
      try { await connectLive(msg.username); }
      catch (err) { send(ws, { type: 'error', message: err?.message || String(err) }); }
    }
    if (msg.type === 'disconnect') {
      await disconnectLive();
      broadcast({ type: 'status', status: 'disconnected' });
    }
    if (msg.type === 'ping') send(ws, { type: 'pong', at: Date.now() });
  });
});

console.log(`\nCAOS LIVE · TikTok Bridge`);
console.log(`Bridge local: ws://127.0.0.1:${PORT}`);
console.log(`Deixe esta janela aberta durante a LIVE.\n`);

process.on('SIGINT', async () => {
  await disconnectLive();
  wss.close(() => process.exit(0));
});
