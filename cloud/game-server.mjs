import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const TICK_RATE = 30;
const SNAPSHOT_RATE = 20;
const WORLD = { width: 2200, height: 1400 };
const PLAYER_SPEED = 300;
const INPUT_TIMEOUT_MS = 500;
const MAX_MESSAGE_BYTES = 8192;
const MAX_ENEMIES = 40;
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NET_HTML = path.join(ROOT_DIR, 'duo-server.html');
const NET_JS = path.join(ROOT_DIR, 'src', 'duo-server.js');
const GAME_HTML = path.join(ROOT_DIR, 'duo-server-game.html');
const GAME_JS = path.join(ROOT_DIR, 'src', 'duo-server-game.js');

const rooms = new Map();
const clientState = new WeakMap();
let serverTick = 0;

const enemyTypes = [
  { key: 'wraith', speed: 96, hp: 4, damage: 5, xp: 7, r: 16 },
  { key: 'infected', speed: 76, hp: 6, damage: 7, xp: 10, r: 18 },
  { key: 'crawler', speed: 124, hp: 5, damage: 5, xp: 9, r: 16 },
  { key: 'reaper', speed: 67, hp: 9, damage: 9, xp: 18, r: 21 },
  { key: 'eye', speed: 86, hp: 7, damage: 6, xp: 11, r: 17 },
  { key: 'brute', speed: 54, hp: 15, damage: 12, xp: 24, r: 25 },
];

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

async function serveFile(res, filePath, contentType, cache = 'no-store') {
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': contentType,
      'cache-control': cache,
      'x-content-type-options': 'nosniff',
    });
    res.end(body);
  } catch (error) {
    console.error(`[http] failed to serve ${filePath}:`, error?.message || error);
    json(res, 404, { ok: false, error: 'asset_unavailable' });
  }
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
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
    let players = 0, enemies = 0;
    for (const room of rooms.values()) {
      players += room.players.size;
      enemies += room.enemies.length;
    }
    return json(res, 200, {
      ok: true,
      service: 'caos-live-game-server',
      version: '0.2.0-gameplay-lab',
      rooms: rooms.size,
      players,
      enemies,
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
      gameplay: '/gameplay',
      networkLab: '/duo-server.html',
      mode: 'authoritative-gameplay-lab',
    });
  }

  if (url.pathname === '/' || url.pathname === '/gameplay' || url.pathname === '/duo-server-game.html') {
    if (!url.searchParams.get('server')) {
      const protocol = hostHeader.includes('localhost') || hostHeader.startsWith('127.0.0.1') ? 'http' : 'https';
      const publicOrigin = `${protocol}://${hostHeader}`;
      res.writeHead(302, {
        location: `/gameplay?server=${encodeURIComponent(publicOrigin)}`,
        'cache-control': 'no-store',
      });
      return res.end();
    }
    return serveFile(res, GAME_HTML, 'text/html; charset=utf-8');
  }

  if (url.pathname === '/duo-server.html' || url.pathname === '/network-lab') {
    if (!url.searchParams.get('server')) {
      const protocol = hostHeader.includes('localhost') || hostHeader.startsWith('127.0.0.1') ? 'http' : 'https';
      const publicOrigin = `${protocol}://${hostHeader}`;
      res.writeHead(302, {
        location: `/duo-server.html?server=${encodeURIComponent(publicOrigin)}`,
        'cache-control': 'no-store',
      });
      return res.end();
    }
    return serveFile(res, NET_HTML, 'text/html; charset=utf-8');
  }

  if (url.pathname === '/src/duo-server-game.js') return serveFile(res, GAME_JS, 'text/javascript; charset=utf-8');
  if (url.pathname === '/src/duo-server.js') return serveFile(res, NET_JS, 'text/javascript; charset=utf-8');

  if (url.pathname.startsWith('/assets/')) {
    let decoded;
    try { decoded = decodeURIComponent(url.pathname); } catch { return json(res, 400, { ok: false, error: 'bad_path' }); }
    const filePath = path.resolve(ROOT_DIR, `.${decoded}`);
    const assetRoot = path.resolve(ROOT_DIR, 'assets');
    if (filePath !== assetRoot && !filePath.startsWith(assetRoot + path.sep)) {
      return json(res, 403, { ok: false, error: 'forbidden' });
    }
    return serveFile(res, filePath, mimeFor(filePath), 'public, max-age=86400');
  }

  return json(res, 404, { ok: false, error: 'not_found' });
});

const wss = new WebSocketServer({ server, path: '/game', perMessageDeflate: false, maxPayload: MAX_MESSAGE_BYTES });

function cleanRoomCode(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }
function cleanName(value) { const name = String(value || 'PLAYER').replace(/[<>\n\r]/g, '').trim().slice(0, 18); return name || 'PLAYER'; }
function safeNumber(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function q(value) { return Math.round(value); }
function send(ws, payload) { if (ws.readyState !== WebSocket.OPEN) return; try { ws.send(JSON.stringify(payload)); } catch {} }
function broadcast(room, payload) { const message = JSON.stringify(payload); for (const player of room.players.values()) { if (player.ws.readyState !== WebSocket.OPEN) continue; try { player.ws.send(message); } catch {} } }

function makeRoom(code) { return { code, players:new Map(), enemies:[], bullets:[], nextEnemyId:1, nextBulletId:1, createdAt:Date.now(), tick:0, spawnAccumulator:0, level:1, xp:0, xpNeed:60, kills:0, wave:1, resetAt:0 }; }
function getOrCreateRoom(code) { let room=rooms.get(code); if(!room){room=makeRoom(code);rooms.set(code,room)} return room; }
function roleForRoom(room) { const roles=new Set([...room.players.values()].map(player=>player.role)); if(!roles.has('p1'))return'p1'; if(!roles.has('p2'))return'p2'; return null; }
function spawnForRole(role) { return role==='p1'?{x:WORLD.width*.46,y:WORLD.height*.5}:{x:WORLD.width*.54,y:WORLD.height*.5}; }
function roomPresence(room) { return [...room.players.values()].map(player=>({id:player.id,role:player.role,name:player.name})); }

function resetRoom(room) {
  room.enemies.length=0;room.bullets.length=0;room.level=1;room.xp=0;room.xpNeed=60;room.kills=0;room.wave=1;room.spawnAccumulator=0;room.resetAt=0;
  for(const p of room.players.values()){const spawn=spawnForRole(p.role);Object.assign(p,{x:spawn.x,y:spawn.y,vx:0,vy:0,hp:100,maxHp:100,down:false,revive:0,aim:0,walk:0,shotFlash:0,fireCooldown:.1,kills:0,xp:0})}
}

function removeClient(ws) {
  const state=clientState.get(ws);if(!state?.roomCode||!state.playerId)return;const room=rooms.get(state.roomCode);if(!room)return;const player=room.players.get(state.playerId);room.players.delete(state.playerId);clientState.delete(ws);
  broadcast(room,{type:'presence',room:room.code,players:roomPresence(room),left:player?{id:player.id,role:player.role,name:player.name}:null,serverTime:Date.now()});if(room.players.size===0)rooms.delete(room.code);
}

function joinRoom(ws,message) {
  const roomCode=cleanRoomCode(message.room);if(roomCode.length<4)return send(ws,{type:'error',code:'invalid_room',message:'Sala precisa ter de 4 a 8 caracteres.'});
  const previous=clientState.get(ws);if(previous?.roomCode)return send(ws,{type:'error',code:'already_joined',message:'Conexão já entrou em uma sala.'});
  const room=getOrCreateRoom(roomCode),role=roleForRoom(room);if(!role)return send(ws,{type:'error',code:'room_full',message:'Sala já tem 2 jogadores.'});
  const spawn=spawnForRole(role),id=`${role}-${Math.random().toString(36).slice(2,9)}`;
  const player={id,role,name:cleanName(message.name),ws,x:spawn.x,y:spawn.y,vx:0,vy:0,inputX:0,inputY:0,lastSeq:0,lastInputAt:Date.now(),joinedAt:Date.now(),hp:100,maxHp:100,r:18,down:false,revive:0,aim:0,walk:0,shotFlash:0,fireCooldown:.08,kills:0,xp:0};
  room.players.set(id,player);clientState.set(ws,{roomCode,playerId:id});
  send(ws,{type:'welcome',room:roomCode,id,role,player:{id,role,name:player.name,x:player.x,y:player.y,hp:player.hp,maxHp:player.maxHp},world:WORLD,tickRate:TICK_RATE,snapshotRate:SNAPSHOT_RATE,serverTime:Date.now(),gameplay:true});
  broadcast(room,{type:'presence',room:roomCode,players:roomPresence(room),serverTime:Date.now()});
}

function handleInput(ws,message) {
  const state=clientState.get(ws);if(!state)return;const room=rooms.get(state.roomCode),player=room?.players.get(state.playerId);if(!player)return;
  let dx=clamp(safeNumber(message.dx),-1,1),dy=clamp(safeNumber(message.dy),-1,1);const length=Math.hypot(dx,dy);if(length>1){dx/=length;dy/=length}
  const seq=Math.max(player.lastSeq,Math.floor(safeNumber(message.seq,player.lastSeq)));player.inputX=dx;player.inputY=dy;player.lastSeq=seq;player.lastInputAt=Date.now();
  if(message.stop&&Math.hypot(dx,dy)<.01){const px=safeNumber(message.px,player.x),py=safeNumber(message.py,player.y),drift=Math.hypot(px-player.x,py-player.y);if(drift<=110){player.x=clamp(px,28,WORLD.width-28);player.y=clamp(py,28,WORLD.height-28);player.vx=0;player.vy=0}}
}

function randomEnemyType(level){const max=Math.min(enemyTypes.length,2+Math.floor(level/4));return Math.floor(Math.random()*Math.max(1,max))}
function spawnEnemy(room){if(room.enemies.length>=MAX_ENEMIES||room.players.size===0)return;const live=[...room.players.values()].filter(p=>!p.down),anchor=live[Math.floor(Math.random()*live.length)]||[...room.players.values()][0],angle=Math.random()*Math.PI*2,dist=380+Math.random()*260,typeIndex=randomEnemyType(room.level),t=enemyTypes[typeIndex],hpScale=1+Math.max(0,room.level-1)*.045;room.enemies.push({id:room.nextEnemyId++,typeIndex,x:clamp(anchor.x+Math.cos(angle)*dist,35,WORLD.width-35),y:clamp(anchor.y+Math.sin(angle)*dist,35,WORLD.height-35),vx:0,vy:0,r:t.r,hp:Math.ceil(t.hp*hpScale),maxHp:Math.ceil(t.hp*hpScale),speed:t.speed*(1+Math.min(.35,room.level*.008)),damage:Math.ceil(t.damage*(1+room.level*.018)),xp:t.xp,attackAt:0,walk:Math.random()*8})}
function nearestEnemy(room,player,maxRange=560){let best=null,bestD2=maxRange*maxRange;for(const e of room.enemies){const dx=e.x-player.x,dy=e.y-player.y,d2=dx*dx+dy*dy;if(d2<bestD2){bestD2=d2;best=e}}return best}
function nearestLivePlayer(room,enemy){let best=null,bestD2=Infinity;for(const p of room.players.values()){if(p.down)continue;const dx=p.x-enemy.x,dy=p.y-enemy.y,d2=dx*dx+dy*dy;if(d2<bestD2){bestD2=d2;best=p}}return best}
function firePlayer(room,player,enemy){const angle=Math.atan2(enemy.y-player.y,enemy.x-player.x);player.aim=angle;player.shotFlash=.09;const speed=650;room.bullets.push({id:room.nextBulletId++,ownerId:player.id,ownerRole:player.role,x:player.x+Math.cos(angle)*24,y:player.y+Math.sin(angle)*24,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,ttl:1.1,damage:2})}
function awardKill(room,ownerId,enemy){room.kills++;room.xp+=enemy.xp;const p=room.players.get(ownerId);if(p){p.kills++;p.xp+=enemy.xp}while(room.xp>=room.xpNeed){room.xp-=room.xpNeed;room.level++;room.wave++;room.xpNeed=Math.floor(60*Math.pow(room.level,1.34));for(const pl of room.players.values()){pl.maxHp+=2;pl.hp=Math.min(pl.maxHp,pl.hp+12)}}}

function updatePlayers(room,dt,now){for(const player of room.players.values()){if(now-player.lastInputAt>INPUT_TIMEOUT_MS){player.inputX=0;player.inputY=0}player.shotFlash=Math.max(0,player.shotFlash-dt);if(player.down){player.vx=0;player.vy=0;continue}player.vx=player.inputX*PLAYER_SPEED;player.vy=player.inputY*PLAYER_SPEED;player.x=clamp(player.x+player.vx*dt,28,WORLD.width-28);player.y=clamp(player.y+player.vy*dt,28,WORLD.height-28);if(Math.hypot(player.vx,player.vy)>1)player.walk+=dt*9;const target=nearestEnemy(room,player);if(target)player.aim=Math.atan2(target.y-player.y,target.x-player.x);player.fireCooldown-=dt;if(target&&player.fireCooldown<=0){firePlayer(room,player,target);player.fireCooldown=.28}}}
function updateEnemies(room,dt,now){for(const e of room.enemies){const target=nearestLivePlayer(room,e);if(!target){e.vx=e.vy=0;continue}const dx=target.x-e.x,dy=target.y-e.y,dist=Math.max(.001,Math.hypot(dx,dy));if(dist>e.r+target.r+3){e.vx=dx/dist*e.speed;e.vy=dy/dist*e.speed;e.x=clamp(e.x+e.vx*dt,24,WORLD.width-24);e.y=clamp(e.y+e.vy*dt,24,WORLD.height-24);e.walk+=dt*8}else{e.vx=e.vy=0;if(now>=e.attackAt){e.attackAt=now+700;target.hp=Math.max(0,target.hp-e.damage);if(target.hp<=0){target.down=true;target.revive=0;target.inputX=target.inputY=0;target.vx=target.vy=0}}}}}
function updateBullets(room,dt){for(let i=room.bullets.length-1;i>=0;i--){const b=room.bullets[i];b.ttl-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.ttl<=0||b.x<0||b.y<0||b.x>WORLD.width||b.y>WORLD.height){room.bullets.splice(i,1);continue}let hitIndex=-1;for(let j=0;j<room.enemies.length;j++){const e=room.enemies[j],rr=e.r+5,dx=e.x-b.x,dy=e.y-b.y;if(dx*dx+dy*dy<=rr*rr){hitIndex=j;break}}if(hitIndex>=0){const e=room.enemies[hitIndex];e.hp-=b.damage;room.bullets.splice(i,1);if(e.hp<=0){room.enemies.splice(hitIndex,1);awardKill(room,b.ownerId,e)}}}if(room.bullets.length>80)room.bullets.splice(0,room.bullets.length-80)}
function updateRevive(room,dt,now){const ps=[...room.players.values()];if(!ps.length)return;const live=ps.filter(p=>!p.down),down=ps.filter(p=>p.down);if(down.length===ps.length&&ps.length>0){if(!room.resetAt)room.resetAt=now+2500;if(now>=room.resetAt)resetRoom(room);return}room.resetAt=0;for(const p of down){let helper=null;for(const q of live){if(Math.hypot(p.x-q.x,p.y-q.y)<=78){helper=q;break}}p.revive=helper?Math.min(1,p.revive+dt/3):0;if(p.revive>=1){p.down=false;p.hp=Math.max(1,p.maxHp*.55);p.revive=0}}}

wss.on('connection',(ws,req)=>{ws.isAlive=true;ws.connectedAt=Date.now();send(ws,{type:'hello',service:'caos-live-game-server',version:'0.2.0-gameplay-lab',serverTime:Date.now()});ws.on('pong',()=>{ws.isAlive=true});ws.on('message',raw=>{if(raw.length>MAX_MESSAGE_BYTES)return ws.close(1009,'message_too_large');let message;try{message=JSON.parse(raw.toString())}catch{send(ws,{type:'error',code:'invalid_json',message:'Mensagem inválida.'});return}if(!message||typeof message.type!=='string')return;switch(message.type){case'join':joinRoom(ws,message);break;case'input':handleInput(ws,message);break;case'ping':send(ws,{type:'pong',clientTime:safeNumber(message.clientTime),serverTime:Date.now()});break;default:break}});ws.on('close',()=>removeClient(ws));ws.on('error',()=>removeClient(ws));console.log(`[ws] connected origin=${req.headers.origin||'unknown'}`)});

const tickTimer=setInterval(()=>{const now=Date.now(),dt=1/TICK_RATE;serverTick++;for(const room of rooms.values()){room.tick++;room.spawnAccumulator+=dt;const targetCount=Math.min(MAX_ENEMIES,12+room.level*2),spawnEvery=Math.max(.24,.72-room.level*.015);while(room.spawnAccumulator>=spawnEvery&&room.enemies.length<targetCount){room.spawnAccumulator-=spawnEvery;spawnEnemy(room)}updatePlayers(room,dt,now);updateEnemies(room,dt,now);updateBullets(room,dt);updateRevive(room,dt,now)}},Math.round(1000/TICK_RATE));tickTimer.unref?.();
const snapshotTimer=setInterval(()=>{const serverTime=Date.now();for(const room of rooms.values()){broadcast(room,{type:'snapshot',room:room.code,tick:serverTick,serverTime,meta:{level:room.level,xp:room.xp,xpNeed:room.xpNeed,kills:room.kills,wave:room.wave,mobs:room.enemies.length,resetAt:room.resetAt},players:[...room.players.values()].map(p=>({id:p.id,role:p.role,name:p.name,x:q(p.x),y:q(p.y),vx:q(p.vx),vy:q(p.vy),hp:Math.round(p.hp*10)/10,maxHp:p.maxHp,down:p.down,revive:Math.round(p.revive*100)/100,aim:Math.round(p.aim*1000)/1000,walk:Math.round(p.walk*100)/100,shotFlash:p.shotFlash>0,kills:p.kills,xp:p.xp,ack:p.lastSeq})),enemies:room.enemies.map(e=>[e.id,q(e.x),q(e.y),e.hp,e.maxHp,q(e.vx),q(e.vy),e.typeIndex,Math.round(e.walk*10)/10]),bullets:room.bullets.map(b=>[b.id,q(b.x),q(b.y),q(b.vx),q(b.vy),b.ownerRole])})}},Math.round(1000/SNAPSHOT_RATE));snapshotTimer.unref?.();
const heartbeatTimer=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue}ws.isAlive=false;ws.ping()}},15000);heartbeatTimer.unref?.();
function shutdown(signal){console.log(`[server] ${signal} received; shutting down`);clearInterval(tickTimer);clearInterval(snapshotTimer);clearInterval(heartbeatTimer);for(const ws of wss.clients){try{ws.close(1012,'server_restart')}catch{}}server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref()}
process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));
server.listen(PORT,HOST,()=>{console.log(`[server] Caos Live authoritative gameplay lab on http://${HOST}:${PORT}`);console.log(`[server] gameplay: /gameplay | network lab: /duo-server.html | ws: /game | tick=${TICK_RATE}Hz snapshots=${SNAPSHOT_RATE}Hz`)})
