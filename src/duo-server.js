(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const ui = {
    join: $('join'), status: $('status'), room: $('room'), roomLabel: $('roomLabel'), server: $('serverUrl'),
    name: $('name'), create: $('create'), connect: $('connect'), role: $('role'), ping: $('ping'), jitter: $('jitter'),
    fps: $('fps'), snap: $('snap'), joy: $('joy'), knob: $('knob'), invite: $('invite'), inviteBox: $('inviteBox'),
    inviteLink: $('inviteLink'), copy: $('copy'), leave: $('leave')
  };

  const DEFAULT_SERVER = 'wss://caos-live-game-server.onrender.com/game';
  const SPEED = 300;
  const params = new URLSearchParams(location.search);
  const players = new Map();
  const keys = new Set();
  const rtts = [];
  const snapIntervals = [];
  const input = { dx: 0, dy: 0 };
  const joy = { active: false, pointerId: null, dx: 0, dy: 0 };
  let ws = null;
  let room = '';
  let myId = null;
  let myRole = null;
  let joined = false;
  let manualClose = false;
  let seq = 0;
  let world = { width: 1600, height: 900 };
  let lastFrame = performance.now();
  let fpsFrames = 0;
  let fpsAt = performance.now();
  let lastSnapAt = 0;
  let reconnectTimer = 0;

  ui.server.value = params.get('server') || localStorage.getItem('caosDuoServerUrl') || DEFAULT_SERVER;
  ui.name.value = params.get('name') || localStorage.getItem('caosPlayerName') || '';
  ui.room.value = cleanRoom(params.get('room') || '');

  function status(text, ok = false) {
    ui.status.textContent = text;
    ui.status.classList.toggle('ok', ok);
  }

  function cleanRoom(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }

  function randomRoom() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const data = new Uint32Array(8);
    crypto.getRandomValues(data);
    return [...data].map((n) => chars[n % chars.length]).join('');
  }

  function normalizeServer(value) {
    let url = String(value || '').trim() || DEFAULT_SERVER;
    if (url.startsWith('https://')) url = `wss://${url.slice(8)}`;
    if (url.startsWith('http://')) url = `ws://${url.slice(7)}`;
    if (!/^wss?:\/\//i.test(url)) url = `wss://${url}`;
    const parsed = new URL(url);
    if (parsed.pathname === '/' || !parsed.pathname) parsed.pathname = '/game';
    if (location.protocol === 'https:' && parsed.protocol === 'ws:') parsed.protocol = 'wss:';
    return parsed.toString();
  }

  function send(payload) {
    if (ws?.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }

  function openConnection(createRoom = false, reconnecting = false) {
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;
    room = cleanRoom(createRoom ? randomRoom() : ui.room.value);
    if (room.length < 4) return status('DIGITE UMA SALA VÁLIDA');
    ui.room.value = room;

    let serverUrl;
    try { serverUrl = normalizeServer(ui.server.value); }
    catch { return status('URL DO SERVIDOR INVÁLIDA'); }

    const name = (ui.name.value || 'PLAYER').trim().slice(0, 18) || 'PLAYER';
    ui.server.value = serverUrl;
    localStorage.setItem('caosDuoServerUrl', serverUrl);
    localStorage.setItem('caosPlayerName', name);
    manualClose = false;
    status(reconnecting ? 'RECONECTANDO...' : 'CONECTANDO AO RENDER...');

    ws = new WebSocket(serverUrl);
    ws.addEventListener('open', () => {
      status('SERVIDOR ONLINE · ENTRANDO...');
      send({ type: 'join', room, name });
    });
    ws.addEventListener('message', ({ data }) => {
      try { handle(JSON.parse(data)); } catch {}
    });
    ws.addEventListener('error', () => { if (!joined) status('SEM RESPOSTA DO SERVIDOR'); });
    ws.addEventListener('close', () => {
      const wasJoined = joined;
      joined = false;
      ui.role.textContent = 'DESCONECTADO';
      ws = null;
      if (!manualClose && wasJoined) {
        status('CONEXÃO CAIU · RECONECTANDO...');
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => openConnection(false, true), 2000);
      } else if (!manualClose) status('SERVIDOR OFFLINE OU ACORDANDO');
    });
  }

  function handle(message) {
    if (message.type === 'hello') return status('SERVIDOR RESPONDEU...');

    if (message.type === 'welcome') {
      joined = true;
      myId = message.id;
      myRole = message.role;
      room = message.room;
      world = message.world || world;
      const p = message.player;
      players.set(myId, { ...p, targetX: p.x, targetY: p.y, local: true });
      ui.roomLabel.textContent = `SALA ${room}`;
      ui.role.textContent = myRole === 'p1' ? 'PLAYER 1' : 'PLAYER 2';
      ui.join.classList.add('hide');
      status('CONECTADO AO SERVIDOR', true);
      updateInvite();
      return;
    }

    if (message.type === 'presence') {
      const names = (message.players || []).map((p) => `${p.role.toUpperCase()}:${p.name}`).join(' · ');
      if (joined) status(names || 'SALA VAZIA', true);
      return;
    }

    if (message.type === 'snapshot') {
      const now = performance.now();
      if (lastSnapAt) {
        snapIntervals.push(now - lastSnapAt);
        if (snapIntervals.length > 30) snapIntervals.shift();
        const avg = snapIntervals.reduce((a, b) => a + b, 0) / snapIntervals.length;
        ui.snap.textContent = `SNAP ${(1000 / avg).toFixed(1)}Hz`;
      }
      lastSnapAt = now;
      const live = new Set();

      for (const s of message.players || []) {
        live.add(s.id);
        let p = players.get(s.id);
        if (!p) {
          p = { ...s, targetX: s.x, targetY: s.y, local: s.id === myId };
          players.set(s.id, p);
        }
        p.name = s.name;
        p.role = s.role;
        if (s.id === myId) {
          const ex = s.x - p.x;
          const ey = s.y - p.y;
          if (Math.hypot(ex, ey) > 140) { p.x = s.x; p.y = s.y; }
          else { p.x += ex * .18; p.y += ey * .18; }
          p.targetX = s.x; p.targetY = s.y;
        } else {
          p.targetX = s.x; p.targetY = s.y;
        }
      }
      for (const id of players.keys()) if (id !== myId && !live.has(id)) players.delete(id);
      return;
    }

    if (message.type === 'pong') {
      const rtt = Math.max(0, performance.now() - Number(message.clientTime || 0));
      if (!Number.isFinite(rtt) || rtt > 5000) return;
      rtts.push(rtt);
      if (rtts.length > 20) rtts.shift();
      const avg = rtts.reduce((a, b) => a + b, 0) / rtts.length;
      let j = 0;
      for (let i = 1; i < rtts.length; i++) j += Math.abs(rtts[i] - rtts[i - 1]);
      if (rtts.length > 1) j /= rtts.length - 1;
      ui.ping.textContent = `${Math.round(avg)}ms`;
      ui.jitter.textContent = `${Math.round(j)}ms`;
      return;
    }

    if (message.type === 'error') {
      status(message.message || message.code || 'ERRO');
      if (!joined) { manualClose = true; ws?.close(); }
    }
  }

  function updateInvite() {
    if (!room) return;
    const url = new URL(location.href);
    url.searchParams.set('room', room);
    url.searchParams.set('server', ui.server.value);
    url.searchParams.delete('name');
    ui.inviteLink.value = url.toString();
  }

  function computeInput() {
    let dx = 0, dy = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx--;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx++;
    if (keys.has('ArrowUp') || keys.has('KeyW')) dy--;
    if (keys.has('ArrowDown') || keys.has('KeyS')) dy++;
    if (joy.active) { dx = joy.dx; dy = joy.dy; }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    input.dx = dx; input.dy = dy;
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawBackground(cameraX, cameraY) {
    const w = innerWidth, h = innerHeight, grid = 80;
    ctx.fillStyle = '#07130f'; ctx.fillRect(0, 0, w, h);
    const ox = ((-cameraX + w / 2) % grid + grid) % grid;
    const oy = ((-cameraY + h / 2) % grid + grid) % grid;
    ctx.strokeStyle = 'rgba(116,164,135,.10)';
    ctx.beginPath();
    for (let x = ox; x < w; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = oy; y < h; y += grid) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    for (let i = 0; i < 11; i++) {
      const wx = 120 + ((i * 337) % (world.width - 240));
      const wy = 90 + ((i * 191) % (world.height - 180));
      const x = wx - cameraX + w / 2, y = wy - cameraY + h / 2;
      ctx.fillStyle = 'rgba(48,110,78,.12)';
      ctx.beginPath(); ctx.ellipse(x, y, 55 + i % 3 * 12, 25 + i % 2 * 8, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPlayer(p, cameraX, cameraY) {
    const x = p.x - cameraX + innerWidth / 2;
    const y = p.y - cameraY + innerHeight / 2;
    const me = p.id === myId;
    ctx.save(); ctx.translate(x, y);
    ctx.shadowColor = me ? 'rgba(163,230,53,.5)' : 'rgba(34,211,238,.4)'; ctx.shadowBlur = 18;
    ctx.fillStyle = me ? '#84cc16' : '#06b6d4';
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#203326';
    ctx.beginPath(); ctx.moveTo(-17,-12); ctx.lineTo(-28,-28); ctx.lineTo(-8,-20); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(17,-12); ctx.lineTo(28,-28); ctx.lineTo(8,-20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#07130f'; ctx.beginPath(); ctx.arc(-7,-4,3,0,Math.PI*2); ctx.arc(7,-4,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#effff5'; ctx.textAlign = 'center'; ctx.font = '900 10px sans-serif';
    ctx.fillText(`${p.role?.toUpperCase() || ''} · ${p.name || 'PLAYER'}`, 0, -34);
    if (me) { ctx.fillStyle = '#bef264'; ctx.font = '800 8px sans-serif'; ctx.fillText('VOCÊ', 0, 39); }
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(.033, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    computeInput();
    const me = myId ? players.get(myId) : null;
    if (joined && me) {
      me.x = Math.max(28, Math.min(world.width - 28, me.x + input.dx * SPEED * dt));
      me.y = Math.max(28, Math.min(world.height - 28, me.y + input.dy * SPEED * dt));
    }
    for (const p of players.values()) {
      if (p.id === myId) continue;
      const f = 1 - Math.pow(.0008, dt);
      p.x += (p.targetX - p.x) * f; p.y += (p.targetY - p.y) * f;
    }
    const cx = me?.x ?? world.width / 2, cy = me?.y ?? world.height / 2;
    drawBackground(cx, cy);
    for (const p of players.values()) drawPlayer(p, cx, cy);
    fpsFrames++;
    if (now - fpsAt >= 500) {
      ui.fps.textContent = String(Math.round(fpsFrames * 1000 / (now - fpsAt)));
      fpsFrames = 0; fpsAt = now;
    }
    requestAnimationFrame(frame);
  }

  setInterval(() => {
    if (!joined) return;
    send({ type: 'input', seq: ++seq, dx: input.dx, dy: input.dy, clientTime: performance.now() });
  }, 33);
  setInterval(() => { if (joined) send({ type: 'ping', clientTime: performance.now() }); }, 2000);

  addEventListener('resize', resize, { passive: true });
  addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) {
      e.preventDefault(); keys.add(e.code);
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));

  function moveJoy(e) {
    const r = ui.joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = 40, len = Math.hypot(dx, dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    joy.dx = dx / max; joy.dy = dy / max;
    ui.knob.style.transform = `translate(${dx}px,${dy}px)`;
  }
  ui.joy.addEventListener('pointerdown', (e) => { joy.active = true; joy.pointerId = e.pointerId; ui.joy.setPointerCapture?.(e.pointerId); moveJoy(e); });
  ui.joy.addEventListener('pointermove', (e) => { if (joy.active && e.pointerId === joy.pointerId) moveJoy(e); });
  const releaseJoy = (e) => {
    if (joy.pointerId !== null && e.pointerId !== joy.pointerId) return;
    joy.active = false; joy.pointerId = null; joy.dx = 0; joy.dy = 0; ui.knob.style.transform = 'translate(0,0)';
  };
  ui.joy.addEventListener('pointerup', releaseJoy); ui.joy.addEventListener('pointercancel', releaseJoy);

  ui.create.onclick = () => openConnection(true);
  ui.connect.onclick = () => openConnection(false);
  ui.room.oninput = () => { ui.room.value = cleanRoom(ui.room.value); };
  ui.invite.onclick = () => { updateInvite(); ui.inviteBox.classList.toggle('show'); };
  ui.copy.onclick = async () => {
    updateInvite();
    try { await navigator.clipboard.writeText(ui.inviteLink.value); ui.copy.textContent = 'COPIADO ✓'; setTimeout(() => ui.copy.textContent = 'COPIAR LINK', 1200); }
    catch { ui.inviteLink.select(); }
  };
  ui.leave.onclick = () => {
    manualClose = true; joined = false; clearTimeout(reconnectTimer); ws?.close(1000, 'player_left'); ws = null;
    players.clear(); myId = null; myRole = null; ui.join.classList.remove('hide'); ui.inviteBox.classList.remove('show');
    ui.role.textContent = 'AGUARDANDO'; ui.roomLabel.textContent = 'SEM SALA'; status('DESCONECTADO');
  };

  resize(); requestAnimationFrame(frame);
  if (params.get('room')) setTimeout(() => openConnection(false), 250);
})();
