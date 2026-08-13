import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const TICK_RATE = 30;
const SNAPSHOT_RATE = 20;
const WORLD = { width: 3072, height: 3072 };
const PLAYER_RADIUS = 18;
const INPUT_TIMEOUT_MS = 450;
const RECONNECT_GRACE_MS = 20000;
const MAX_MESSAGE_BYTES = 12288;
const MAX_ENEMIES = 140;
const MAX_BULLETS = 220;
const CHUNK_SIZE = 512;
const MAP_N = 6;
const MAP_SEED = 'ICE-BMFSXT';
const SERVER_VERSION = '0.3.0-render-multiplayer';
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FILES = {
  multiplayerHtml: path.join(ROOT_DIR, 'multiplayer.html'),
  multiplayerJs: path.join(ROOT_DIR, 'src', 'multiplayer.js'),
  networkHtml: path.join(ROOT_DIR, 'duo-server.html'),
  networkJs: path.join(ROOT_DIR, 'src', 'duo-server.js'),
  gameplayLabHtml: path.join(ROOT_DIR, 'duo-server-game.html'),
  gameplayLabJs: path.join(ROOT_DIR, 'src', 'duo-server-game.js'),
  version: path.join(ROOT_DIR, 'version.json'),
  firebaseRanking: path.join(ROOT_DIR, 'src', 'firebase-ranking.js'),
  manifest: path.join(ROOT_DIR, 'assets', 'Map', 'snow-frost', 'manifest.json'),
};

const manifest = JSON.parse(await readFile(FILES.manifest, 'utf8'));

const enemyTypes = [
  { key:'wraith', name:'Ogro Espectro', speed:96, hp:3, damage:2, xp:7, r:15 },
  { key:'reaper', name:'Ogro Ceifador', speed:67, hp:8, damage:4, xp:18, r:21 },
  { key:'infected', name:'Ogro Infectado', speed:76, hp:5, damage:3, xp:10, r:17 },
  { key:'crawler', name:'Ogro das Sombras', speed:124, hp:4, damage:2, xp:9, r:16 },
  { key:'eye', name:'Ogro Observador', speed:86, hp:5, damage:2, xp:11, r:16 },
  { key:'brute', name:'Ogro Brutamonte', speed:54, hp:14, damage:5, xp:24, r:24 },
  { key:'colossus', name:'Ogro Colosso', speed:42, hp:100, damage:8, xp:150, r:42, boss:true },
  { key:'voidlord', name:'Ogro do Vazio', speed:55, hp:100, damage:7, xp:170, r:39, boss:true },
];

const rarityWeight = { common:70, rare:25, epic:9, legendary:3, secret:.35 };
const skillDefs = {
  speed:{id:'speed',name:'Passos de Guerra',icon:'🥾',rarity:'common',cap:5},
  medic:{id:'medic',name:'Kit Médico',icon:'🩹',rarity:'common',cap:5},
  rapid:{id:'rapid',name:'Rajada Rápida',icon:'⚡',rarity:'common',cap:5},
  regen:{id:'regen',name:'Regeneração',icon:'💚',rarity:'rare',cap:5},
  armor:{id:'armor',name:'Armadura',icon:'🛡️',rarity:'rare',cap:4},
  xp:{id:'xp',name:'Instinto de Caça',icon:'✨',rarity:'rare',cap:5},
  blood:{id:'blood',name:'Sanguinário',icon:'🩸',rarity:'epic',cap:5},
  arc:{id:'arc',name:'Arco Voltaico',icon:'⚡',rarity:'epic',cap:5},
  pierce:{id:'pierce',name:'Munição Perfurante',icon:'🎯',rarity:'epic',cap:5},
  flash:{id:'flash',name:'Flash de Luz',icon:'☀️',rarity:'legendary',cap:5},
  phoenix:{id:'phoenix',name:'Fênix',icon:'🔥',rarity:'secret',cap:1},
};

const rooms = new Map();
const clientState = new WeakMap();
let serverTick = 0;

function json(res,status,payload){const body=JSON.stringify(payload);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'});res.end(body)}
function clamp(v,min,max){return Math.min(max,Math.max(min,v))}
function safeNumber(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function q(v){return Math.round(v*10)/10}
function cleanRoomCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)}
function cleanName(v){const s=String(v||'PLAYER').replace(/[<>\n\r]/g,'').trim().slice(0,18);return s||'PLAYER'}
function cleanSession(v){return String(v||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)}
function hashSeed(str){let h=2166136261;for(const c of String(str)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function send(ws,payload){if(ws?.readyState!==WebSocket.OPEN)return;try{ws.send(JSON.stringify(payload))}catch{}}
function broadcast(room,payload){const msg=JSON.stringify(payload);for(const p of room.players.values()){if(!p.connected||p.ws?.readyState!==WebSocket.OPEN)continue;try{p.ws.send(msg)}catch{}}}
function mimeFor(filePath){const ext=path.extname(filePath).toLowerCase();return({'.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.json':'application/json; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.zip':'application/zip'})[ext]||'application/octet-stream'}
async function serveFile(res,filePath,type=mimeFor(filePath),cache='no-store'){try{const body=await readFile(filePath);res.writeHead(200,{'content-type':type,'cache-control':cache,'x-content-type-options':'nosniff'});res.end(body)}catch(e){console.error('[http] serve failed',filePath,e?.message||e);json(res,404,{ok:false,error:'asset_unavailable'})}}

function buildMap(){
  const rand=mulberry32(hashSeed(MAP_SEED));
  const byMask=new Map();
  for(const chunk of manifest.chunks||[]){if(!byMask.has(chunk.mask))byMask.set(chunk.mask,[]);byMask.get(chunk.mask).push(chunk)}
  const cells=[];const grid=[];const collisions=[];
  for(let y=0;y<MAP_N;y++){grid[y]=[];for(let x=0;x<MAP_N;x++){
    const north=y>0&&grid[y-1][x].south?1:0;
    const west=x>0&&grid[y][x-1].east?8:0;
    const east=x<MAP_N-1&&rand()>.30?2:0;
    const south=y<MAP_N-1&&rand()>.30?4:0;
    const mask=north|west|east|south;
    const choices=byMask.get(mask)||byMask.get(15)||[];
    const chunk=choices[Math.floor(rand()*Math.max(1,choices.length))]||manifest.chunks[0];
    const cell={x,y,mask,file:`/assets/Map/snow-frost/${chunk.file}`,id:chunk.id,variant:chunk.variant||1,east:!!east,south:!!south};
    cells.push(cell);grid[y][x]=cell;
    for(const c of chunk.collision||[]){if(c.type==='circle')collisions.push({x:x*CHUNK_SIZE+c.x*CHUNK_SIZE,y:y*CHUNK_SIZE+c.y*CHUNK_SIZE,r:c.r*CHUNK_SIZE});}
  }}
  return{seed:MAP_SEED,chunkSize:CHUNK_SIZE,gridSize:MAP_N,cells,collisions};
}
const MAP = buildMap();

function resolveWorldCircle(entity,radius){
  entity.x=clamp(entity.x,radius,WORLD.width-radius);entity.y=clamp(entity.y,radius,WORLD.height-radius);
  for(let pass=0;pass<2;pass++)for(const c of MAP.collisions){const dx=entity.x-c.x,dy=entity.y-c.y,d=Math.hypot(dx,dy),min=radius+c.r;if(d>0&&d<min){const k=(min-d)/d;entity.x+=dx*k;entity.y+=dy*k}else if(d===0){entity.x+=min}}
  entity.x=clamp(entity.x,radius,WORLD.width-radius);entity.y=clamp(entity.y,radius,WORLD.height-radius);
}

function skillDescription(id,lv){
  if(id==='speed')return`Velocidade +${lv*10}%`;
  if(id==='medic')return`+10 vida máxima e cura 25 HP`;
  if(id==='rapid')return`Cadência +${[0,10,20,30,45,60][lv]}%`;
  if(id==='regen')return`Regenera ${[0,.4,.6,.8,1,1.2][lv]} HP/s`;
  if(id==='armor')return`Reduz ${[0,5,9,13,18][lv]}% do dano`;
  if(id==='xp')return`XP +${lv*20}%`;
  if(id==='blood')return`Sanguinário nível ${lv}`;
  if(id==='arc')return`Raio em cadeia nível ${lv}`;
  if(id==='pierce')return`Tiro perfurante nível ${lv}`;
  if(id==='flash')return`Flash a cada 5 tiros · nível ${lv}`;
  if(id==='phoenix')return`Revive 1x com 80% HP + 5s proteção`;
  return'';
}
function weightedPick(arr){let total=0;for(const s of arr)total+=rarityWeight[s.rarity]||1;let r=Math.random()*total;for(const s of arr){r-=rarityWeight[s.rarity]||1;if(r<=0)return s}return arr[arr.length-1]}
function makeChoices(player){const available=Object.values(skillDefs).filter(s=>(player.skills[s.id]||0)<s.cap&&!(s.id==='phoenix'&&(player.phoenixReady||player.phoenixConsumed)));const pool=[...available],pick=[];while(pool.length&&pick.length<3){const s=weightedPick(pool);pool.splice(pool.indexOf(s),1);const lv=Math.min(s.cap,(player.skills[s.id]||0)+1);pick.push({id:s.id,name:s.name,icon:s.icon,rarity:s.rarity,level:lv,desc:skillDescription(s.id,lv)})}return pick}
function applySkill(player,id){const def=skillDefs[id];if(!def)return false;const lv=Math.min(def.cap,(player.skills[id]||0)+1);player.skills[id]=lv;
  if(id==='speed')player.speed=255*(1+lv*.10);
  if(id==='medic'){player.maxHp+=10;player.hp=Math.min(player.maxHp,player.hp+25)}
  if(id==='rapid')player.fireRate=.28*(1-[0,.10,.20,.30,.45,.60][lv]);
  if(id==='regen')player.regen=[0,.4,.6,.8,1,1.2][lv];
  if(id==='armor')player.armorReduction=[0,.05,.09,.13,.18][lv];
  if(id==='xp')player.xpMult=1+lv*.20;
  if(id==='blood'){player.bloodChance=[0,.10,.12,.15,.18,.20][lv];player.bloodHeal=[0,.5,.75,1,1.5,2][lv]}
  if(id==='flash')player.flashDamage=[0,8,10,12,15,18][lv];
  if(id==='arc'){player.arcLv=lv;player.arcAt=Date.now()+500}
  if(id==='pierce')player.pierceLv=lv;
  if(id==='phoenix'){player.phoenixReady=true;player.phoenixConsumed=false}
  player.choices=null;return true;
}

function makePlayer(role,name,session,ws){const spawn=role==='p1'?{x:WORLD.width*.46,y:WORLD.height*.5}:{x:WORLD.width*.54,y:WORLD.height*.5};return{id:`${role}-${randomUUID().slice(0,8)}`,role,name,session,ws,connected:true,disconnectedAt:0,x:spawn.x,y:spawn.y,vx:0,vy:0,inputX:0,inputY:0,lastSeq:0,lastInputAt:Date.now(),r:PLAYER_RADIUS,hp:100,maxHp:100,down:false,revive:0,invUntil:0,lastDamageAt:0,aim:0,walk:0,shotFlash:0,shotCounter:0,fireCooldown:.05,fireRate:.28,damage:2,speed:255,xp:0,level:1,xpNeed:60,xpMult:1,kills:0,skills:{speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,phoenix:0,armor:0,pierce:0},choices:null,regen:0,armorReduction:0,bloodChance:0,bloodHeal:0,flashDamage:0,arcLv:0,arcAt:0,pierceLv:0,phoenixReady:false,phoenixConsumed:false};}
function makeRoom(code){return{code,players:new Map(),enemies:[],bullets:[],medDrop:null,nextEnemyId:1,nextBulletId:1,createdAt:Date.now(),startedAt:Date.now(),tick:0,spawnAccumulator:0,totalKills:0,totalXp:0,wave:1,bossStage:0,gameOver:false,gameOverAt:0,allDownAt:0,matchId:`mp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,nextMedAt:Date.now()+180000};}
function getOrCreateRoom(code){let room=rooms.get(code);if(!room){room=makeRoom(code);rooms.set(code,room)}return room}
function roleForRoom(room){const roles=new Set([...room.players.values()].map(p=>p.role));if(!roles.has('p1'))return'p1';if(!roles.has('p2'))return'p2';return null}
function roomPresence(room){return[...room.players.values()].map(p=>({id:p.id,role:p.role,name:p.name,connected:p.connected}))}
function connectedPlayers(room){return[...room.players.values()].filter(p=>p.connected)}

function resetPlayer(p){const spawn=p.role==='p1'?{x:WORLD.width*.46,y:WORLD.height*.5}:{x:WORLD.width*.54,y:WORLD.height*.5};Object.assign(p,{x:spawn.x,y:spawn.y,vx:0,vy:0,inputX:0,inputY:0,hp:100,maxHp:100,down:false,revive:0,invUntil:0,lastDamageAt:0,aim:0,walk:0,shotFlash:0,shotCounter:0,fireCooldown:.05,fireRate:.28,damage:2,speed:255,xp:0,level:1,xpNeed:60,xpMult:1,kills:0,choices:null,regen:0,armorReduction:0,bloodChance:0,bloodHeal:0,flashDamage:0,arcLv:0,arcAt:0,pierceLv:0,phoenixReady:false,phoenixConsumed:false});for(const k in p.skills)p.skills[k]=0}
function resetRoom(room){room.enemies.length=0;room.bullets.length=0;room.medDrop=null;room.spawnAccumulator=0;room.totalKills=0;room.totalXp=0;room.wave=1;room.bossStage=0;room.gameOver=false;room.gameOverAt=0;room.allDownAt=0;room.startedAt=Date.now();room.matchId=`mp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;room.nextMedAt=Date.now()+180000;for(const p of room.players.values())resetPlayer(p)}

function detachClient(ws){const state=clientState.get(ws);if(!state)return;clientState.delete(ws);const room=rooms.get(state.roomCode),p=room?.players.get(state.playerId);if(!p||p.ws!==ws)return;p.connected=false;p.ws=null;p.disconnectedAt=Date.now();p.inputX=p.inputY=p.vx=p.vy=0;broadcast(room,{type:'presence',room:room.code,players:roomPresence(room),serverTime:Date.now()})}
function joinRoom(ws,msg){const code=cleanRoomCode(msg.room),session=cleanSession(msg.session)||randomUUID().replaceAll('-','');if(code.length<4)return send(ws,{type:'error',code:'invalid_room',message:'Sala precisa ter de 4 a 8 caracteres.'});if(clientState.has(ws))return send(ws,{type:'error',code:'already_joined',message:'Conexão já entrou em uma sala.'});const room=getOrCreateRoom(code);
  let player=[...room.players.values()].find(p=>p.session===session);
  if(player){if(player.ws&&player.ws!==ws&&player.ws.readyState===WebSocket.OPEN)try{player.ws.close(4001,'session_replaced')}catch{};player.ws=ws;player.connected=true;player.disconnectedAt=0;player.lastInputAt=Date.now();player.name=cleanName(msg.name||player.name);clientState.set(ws,{roomCode:code,playerId:player.id});sendWelcome(room,player,true);broadcast(room,{type:'presence',room:code,players:roomPresence(room),serverTime:Date.now()});return;}
  const role=roleForRoom(room);if(!role)return send(ws,{type:'error',code:'room_full',message:'Sala já tem 2 jogadores.',retryAfterMs:1000,recoverable:true});player=makePlayer(role,cleanName(msg.name),session,ws);room.players.set(player.id,player);clientState.set(ws,{roomCode:code,playerId:player.id});sendWelcome(room,player,false);broadcast(room,{type:'presence',room:code,players:roomPresence(room),serverTime:Date.now()});}
function sendWelcome(room,p,reconnected){send(p.ws,{type:'welcome',version:SERVER_VERSION,room:room.code,id:p.id,role:p.role,session:p.session,reconnected,player:serializePlayer(p),world:WORLD,map:{seed:MAP.seed,chunkSize:MAP.chunkSize,gridSize:MAP.gridSize,cells:MAP.cells.map(({x,y,mask,file,id,variant})=>({x,y,mask,file,id,variant}))},tickRate:TICK_RATE,snapshotRate:SNAPSHOT_RATE,serverTime:Date.now(),gameplay:true})}
function playerForWs(ws){const s=clientState.get(ws),room=s&&rooms.get(s.roomCode);return{state:s,room,player:s&&room?.players.get(s.playerId)}}
function handleInput(ws,msg){const{player}=playerForWs(ws);if(!player)return;let dx=clamp(safeNumber(msg.dx),-1,1),dy=clamp(safeNumber(msg.dy),-1,1);const n=Math.hypot(dx,dy);if(n>1){dx/=n;dy/=n}player.inputX=dx;player.inputY=dy;player.lastSeq=Math.max(player.lastSeq,Math.floor(safeNumber(msg.seq,player.lastSeq)));player.lastInputAt=Date.now();if(msg.stop&&Math.hypot(dx,dy)<.01){const px=safeNumber(msg.px,player.x),py=safeNumber(msg.py,player.y),drift=Math.hypot(px-player.x,py-player.y);if(drift<=105){player.x=px;player.y=py;resolveWorldCircle(player,player.r);player.vx=player.vy=0}}}
function handleSkillChoice(ws,msg){const{player}=playerForWs(ws);if(!player?.choices)return;const id=String(msg.skill||'');if(!player.choices.some(c=>c.id===id))return;applySkill(player,id);while(!player.choices&&player.xp>=player.xpNeed){player.xp-=player.xpNeed;player.level++;player.xpNeed=Math.floor(60*Math.pow(player.level,1.42));player.choices=makeChoices(player)}}
function handleRestart(ws){const{room}=playerForWs(ws);if(room?.gameOver)resetRoom(room)}

function enemyTier(level,boss=false){const r=Math.random();if(boss)return r<.01?2:r<.07?1:0;const corrupt=level>=30?.12:level>=20?.08:level>=10?.035:0,elite=level>=30?.24:level>=15?.18:level>=5?.10:0;if(r<corrupt)return 2;if(r<corrupt+elite)return 1;return 0}
function maxPlayerLevel(room){let m=1;for(const p of room.players.values())m=Math.max(m,p.level);return m}
function spawnEnemy(room,{boss=false,typeIndex=null,tier=null}={}){if(room.enemies.length>=MAX_ENEMIES||!connectedPlayers(room).length)return;const live=connectedPlayers(room).filter(p=>!p.down),anchor=live[Math.floor(Math.random()*live.length)]||connectedPlayers(room)[0];if(!anchor)return;const level=maxPlayerLevel(room);if(typeIndex==null)typeIndex=boss?(6+(room.bossStage%2)):Math.floor(Math.random()*Math.min(6,2+Math.floor(level/4)));const t=enemyTypes[typeIndex]||enemyTypes[0];if(tier==null)tier=enemyTier(level,!!t.boss);const mult=t.boss?(tier===2?2.5:tier===1?1.75:1):(tier===2?5:tier===1?3:1);const dmgMult=t.boss?(tier===2?1.5:tier===1?1.25:1):(tier===2?2.2:tier===1?1.7:1);const xpMult=t.boss?(tier===2?2.5:tier===1?1.75:1):(tier===2?6:tier===1?3.5:1);const a=Math.random()*Math.PI*2,d=t.boss?600:420+Math.random()*260,e={id:room.nextEnemyId++,typeIndex,tier,boss:!!t.boss,x:anchor.x+Math.cos(a)*d,y:anchor.y+Math.sin(a)*d,vx:0,vy:0,r:t.r,hp:Math.ceil(t.hp*mult*(1+Math.max(0,level-1)*.025)),maxHp:0,speed:t.speed*(t.boss?(tier===2?1.10:tier===1?1.05:1):1)*(1+Math.min(.30,level*.006)),damage:Math.ceil(t.damage*dmgMult*(1+level*.012)),xp:Math.ceil(t.xp*xpMult),attackAt:0,walk:Math.random()*8};e.maxHp=e.hp;resolveWorldCircle(e,e.r);room.enemies.push(e)}
function nearestEnemy(room,p,maxRange=560){let best=null,bestD2=maxRange*maxRange;for(const e of room.enemies){const dx=e.x-p.x,dy=e.y-p.y,d2=dx*dx+dy*dy;if(d2<bestD2){best=e;bestD2=d2}}return best}
function nearestLivePlayer(room,e){let best=null,bestD2=Infinity;for(const p of room.players.values()){if(!p.connected||p.down)continue;const dx=p.x-e.x,dy=p.y-e.y,d2=dx*dx+dy*dy;if(d2<bestD2){best=p;bestD2=d2}}return best}
function gainXp(room,p,amount){const earned=Math.max(0,amount)*(p.xpMult||1);p.xp+=earned;room.totalXp+=earned;if(!p.choices&&p.xp>=p.xpNeed){p.xp-=p.xpNeed;p.level++;p.xpNeed=Math.floor(60*Math.pow(p.level,1.42));p.choices=makeChoices(p);room.wave=Math.max(room.wave,p.level)}}
function onKill(room,p,e){room.totalKills++;p.kills++;gainXp(room,p,e.xp);if(p.skills.blood&&p.kills%10===0){if(Math.random()<p.bloodChance){p.maxHp+=1;p.hp=Math.min(p.maxHp,p.hp+1)}else p.hp=Math.min(p.maxHp,p.hp+p.bloodHeal)}}
function firePlayer(room,p,target){const angle=Math.atan2(target.y-p.y,target.x-p.x);p.aim=angle;p.shotFlash=.09;p.shotCounter++;const pl=p.pierceLv||0,every=[0,12,11,10,9,8][pl]||999,pass=[0,2,3,4,5,7][pl]||0,flash=!!p.skills.flash&&p.shotCounter%5===0;room.bullets.push({id:room.nextBulletId++,ownerId:p.id,ownerRole:p.role,x:p.x+Math.cos(angle)*24,y:p.y+Math.sin(angle)*24,vx:Math.cos(angle)*650,vy:Math.sin(angle)*650,ttl:1.25,damage:p.damage+(flash?(p.flashDamage||0):0),pierceLeft:pl&&p.shotCounter%every===0?pass:0,hits:new Set(),flash})}
function applyDamage(p,damage,now){if(p.down||p.choices||now<p.invUntil)return;const actual=Math.max(.1,damage*(1-(p.armorReduction||0)));p.hp=Math.max(0,p.hp-actual);p.lastDamageAt=now;if(p.hp>0)return;if(p.phoenixReady&&!p.phoenixConsumed){p.phoenixReady=false;p.phoenixConsumed=true;p.skills.phoenix=0;p.hp=Math.max(1,p.maxHp*.8);p.invUntil=now+5000;return}p.down=true;p.revive=0;p.inputX=p.inputY=p.vx=p.vy=0}
function updatePlayers(room,dt,now){for(const p of room.players.values()){if(!p.connected){p.vx=p.vy=0;continue}if(now-p.lastInputAt>INPUT_TIMEOUT_MS){p.inputX=p.inputY=0}p.shotFlash=Math.max(0,p.shotFlash-dt);if(p.down||p.choices){p.vx=p.vy=0;continue}p.vx=p.inputX*p.speed;p.vy=p.inputY*p.speed;p.x+=p.vx*dt;p.y+=p.vy*dt;resolveWorldCircle(p,p.r);if(Math.hypot(p.vx,p.vy)>1)p.walk+=dt*9;if(p.regen>0&&p.hp<p.maxHp&&now-p.lastDamageAt>1000)p.hp=Math.min(p.maxHp,p.hp+p.regen*dt);const target=nearestEnemy(room,p);if(target)p.aim=Math.atan2(target.y-p.y,target.x-p.x);p.fireCooldown-=dt;if(target&&p.fireCooldown<=0){firePlayer(room,p,target);p.fireCooldown=p.fireRate||.28}if(p.arcLv&&now>=p.arcAt){castArc(room,p,now)}}}
function castArc(room,p,now){const lv=p.arcLv||0,first=nearestEnemy(room,p,460);if(!lv||!first)return;const cds=[0,8,7.5,7,6.5,6],targets=[0,2,2,3,3,4],dmg=[0,2,3,4,5,6];p.arcAt=now+cds[lv]*1000;const hit=[first];while(hit.length<targets[lv]){const last=hit.at(-1);let next=null,bd=190;for(const e of room.enemies){if(hit.includes(e))continue;const d=Math.hypot(e.x-last.x,e.y-last.y);if(d<bd){bd=d;next=e}}if(!next)break;hit.push(next)}for(const e of hit){e.hp-=dmg[lv];if(e.hp<=0){const idx=room.enemies.indexOf(e);if(idx>=0)room.enemies.splice(idx,1);onKill(room,p,e)}}}
function updateEnemies(room,dt,now){for(const e of room.enemies){const target=nearestLivePlayer(room,e);if(!target){e.vx=e.vy=0;continue}const dx=target.x-e.x,dy=target.y-e.y,dist=Math.max(.001,Math.hypot(dx,dy));if(dist>e.r+target.r+4){e.vx=dx/dist*e.speed;e.vy=dy/dist*e.speed;e.x+=e.vx*dt;e.y+=e.vy*dt;resolveWorldCircle(e,e.r);e.walk+=dt*8}else{e.vx=e.vy=0;if(now>=e.attackAt){e.attackAt=now+(e.boss?550:700);applyDamage(target,e.damage,now)}}}}
function updateBullets(room,dt){for(let i=room.bullets.length-1;i>=0;i--){const b=room.bullets[i];b.ttl-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.ttl<=0||b.x<0||b.y<0||b.x>WORLD.width||b.y>WORLD.height){room.bullets.splice(i,1);continue}for(let j=room.enemies.length-1;j>=0;j--){const e=room.enemies[j];if(b.hits.has(e.id))continue;const rr=e.r+5,dx=e.x-b.x,dy=e.y-b.y;if(dx*dx+dy*dy>rr*rr)continue;b.hits.add(e.id);e.hp-=b.damage;const p=room.players.get(b.ownerId);if(e.hp<=0){room.enemies.splice(j,1);if(p)onKill(room,p,e)}if(b.pierceLeft>0){b.pierceLeft--;break}else{room.bullets.splice(i,1);break}}}if(room.bullets.length>MAX_BULLETS)room.bullets.splice(0,room.bullets.length-MAX_BULLETS)}
function updateRevive(room,dt,now){const active=connectedPlayers(room);if(!active.length)return;const live=active.filter(p=>!p.down),down=active.filter(p=>p.down);if(down.length===active.length){if(!room.allDownAt)room.allDownAt=now;else if(now-room.allDownAt>=1800){room.gameOver=true;room.gameOverAt=now}return}room.allDownAt=0;for(const p of down){let helper=null;for(const q of live){if(Math.hypot(p.x-q.x,p.y-q.y)<=78){helper=q;break}}p.revive=helper?Math.min(1,p.revive+dt/3):0;if(p.revive>=1){p.down=false;p.hp=Math.max(1,p.maxHp*.55);p.revive=0;p.invUntil=now+1200}}}
function updateMed(room,now){if(!room.medDrop&&now>=room.nextMedAt){room.medDrop={x:400+Math.random()*(WORLD.width-800),y:400+Math.random()*(WORLD.height-800)};resolveWorldCircle(room.medDrop,14);room.nextMedAt=now+180000}if(!room.medDrop)return;for(const p of connectedPlayers(room)){if(p.down)continue;if(Math.hypot(p.x-room.medDrop.x,p.y-room.medDrop.y)<=38){p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.10);room.medDrop=null;break}}}
function updateBoss(room){const stage=Math.floor(maxPlayerLevel(room)/10);if(stage<=room.bossStage||stage<=0||room.enemies.some(e=>e.boss))return;room.bossStage=stage;spawnEnemy(room,{boss:true,typeIndex:stage%2?6:7})}
function cleanupDisconnected(room,now){for(const[pId,p]of room.players){if(!p.connected&&p.disconnectedAt&&now-p.disconnectedAt>RECONNECT_GRACE_MS)room.players.delete(pId)}if(room.players.size===0)rooms.delete(room.code)}
function serializePlayer(p){return{id:p.id,role:p.role,name:p.name,connected:p.connected,x:q(p.x),y:q(p.y),vx:q(p.vx),vy:q(p.vy),hp:q(p.hp),maxHp:q(p.maxHp),down:p.down,revive:q(p.revive),aim:q(p.aim),walk:q(p.walk),shotFlash:p.shotFlash>0,kills:p.kills,xp:Math.floor(p.xp),level:p.level,xpNeed:p.xpNeed,skills:p.skills,choices:p.choices,ack:p.lastSeq,phoenix:p.phoenixReady}}

const server=http.createServer(async(req,res)=>{const hostHeader=req.headers.host||'localhost',url=new URL(req.url||'/',`http://${hostHeader}`);if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
  if(url.pathname==='/health'){let players=0,enemies=0;for(const room of rooms.values()){players+=connectedPlayers(room).length;enemies+=room.enemies.length}return json(res,200,{ok:true,service:'caos-live-game-server',version:SERVER_VERSION,rooms:rooms.size,players,enemies,tickRate:TICK_RATE,snapshotRate:SNAPSHOT_RATE,uptimeSeconds:Math.round(process.uptime()),now:Date.now()})}
  if(url.pathname==='/api')return json(res,200,{ok:true,name:'Caos Live Multiplayer',websocket:'/game',multiplayer:'/multiplayer',lab:'/lab',mode:'authoritative'});
  if(url.pathname==='/'||url.pathname==='/multiplayer'){if(!url.searchParams.get('server')){const protocol=hostHeader.includes('localhost')||hostHeader.startsWith('127.')?'http':'https';return res.writeHead(302,{location:`/multiplayer?server=${encodeURIComponent(`${protocol}://${hostHeader}`)}`,'cache-control':'no-store'}).end()}return serveFile(res,FILES.multiplayerHtml,'text/html; charset=utf-8')}
  if(url.pathname==='/lab'||url.pathname==='/duo-server-game.html')return serveFile(res,FILES.gameplayLabHtml,'text/html; charset=utf-8');
  if(url.pathname==='/network-lab'||url.pathname==='/duo-server.html')return serveFile(res,FILES.networkHtml,'text/html; charset=utf-8');
  if(url.pathname==='/src/multiplayer.js')return serveFile(res,FILES.multiplayerJs,'text/javascript; charset=utf-8');
  if(url.pathname==='/src/firebase-ranking.js')return serveFile(res,FILES.firebaseRanking,'text/javascript; charset=utf-8');
  if(url.pathname==='/src/duo-server-game.js')return serveFile(res,FILES.gameplayLabJs,'text/javascript; charset=utf-8');
  if(url.pathname==='/src/duo-server.js')return serveFile(res,FILES.networkJs,'text/javascript; charset=utf-8');
  if(url.pathname==='/version.json')return serveFile(res,FILES.version,'application/json; charset=utf-8','no-store');
  if(url.pathname.startsWith('/assets/')){let decoded;try{decoded=decodeURIComponent(url.pathname)}catch{return json(res,400,{ok:false,error:'bad_path'})}const filePath=path.resolve(ROOT_DIR,`.${decoded}`),assetRoot=path.resolve(ROOT_DIR,'assets');if(filePath!==assetRoot&&!filePath.startsWith(assetRoot+path.sep))return json(res,403,{ok:false,error:'forbidden'});return serveFile(res,filePath,mimeFor(filePath),'public, max-age=86400')}
  return json(res,404,{ok:false,error:'not_found'});
});

const wss=new WebSocketServer({server,path:'/game',perMessageDeflate:false,maxPayload:MAX_MESSAGE_BYTES});
wss.on('connection',(ws,req)=>{ws.isAlive=true;ws.msgWindowAt=Date.now();ws.msgCount=0;send(ws,{type:'hello',service:'caos-live-game-server',version:SERVER_VERSION,serverTime:Date.now()});ws.on('pong',()=>ws.isAlive=true);ws.on('message',raw=>{const now=Date.now();if(now-ws.msgWindowAt>=1000){ws.msgWindowAt=now;ws.msgCount=0}if(++ws.msgCount>140)return ws.close(1008,'rate_limit');if(raw.length>MAX_MESSAGE_BYTES)return ws.close(1009,'message_too_large');let m;try{m=JSON.parse(raw.toString())}catch{return send(ws,{type:'error',code:'invalid_json',message:'Mensagem inválida.'})}if(!m||typeof m.type!=='string')return;if(m.type==='join')joinRoom(ws,m);else if(m.type==='input')handleInput(ws,m);else if(m.type==='skill-choice')handleSkillChoice(ws,m);else if(m.type==='restart')handleRestart(ws);else if(m.type==='ping')send(ws,{type:'pong',clientTime:safeNumber(m.clientTime),serverTime:Date.now()})});ws.on('close',()=>detachClient(ws));ws.on('error',()=>detachClient(ws));console.log(`[ws] connected origin=${req.headers.origin||'unknown'}`)});

const tickTimer=setInterval(()=>{const now=Date.now(),dt=1/TICK_RATE;serverTick++;for(const room of [...rooms.values()]){cleanupDisconnected(room,now);if(!rooms.has(room.code))continue;room.tick++;if(room.gameOver)continue;room.spawnAccumulator+=dt;const target=Math.min(MAX_ENEMIES,14+maxPlayerLevel(room)*3),spawnEvery=Math.max(.18,.68-maxPlayerLevel(room)*.012);while(room.spawnAccumulator>=spawnEvery&&room.enemies.length<target){room.spawnAccumulator-=spawnEvery;spawnEnemy(room)}updateBoss(room);updatePlayers(room,dt,now);updateEnemies(room,dt,now);updateBullets(room,dt);updateRevive(room,dt,now);updateMed(room,now)}},Math.round(1000/TICK_RATE));tickTimer.unref?.();
const snapshotTimer=setInterval(()=>{const now=Date.now();for(const room of rooms.values()){broadcast(room,{type:'snapshot',version:SERVER_VERSION,room:room.code,tick:serverTick,serverTime:now,meta:{totalKills:room.totalKills,totalXp:Math.floor(room.totalXp),wave:room.wave,mobs:room.enemies.length,boss:room.enemies.some(e=>e.boss),gameOver:room.gameOver,durationMs:now-room.startedAt,matchId:room.matchId,medDrop:room.medDrop?{x:q(room.medDrop.x),y:q(room.medDrop.y)}:null},players:[...room.players.values()].map(serializePlayer),enemies:room.enemies.map(e=>[e.id,q(e.x),q(e.y),q(e.hp),q(e.maxHp),q(e.vx),q(e.vy),e.typeIndex,q(e.walk),e.tier,e.boss?1:0]),bullets:room.bullets.map(b=>[b.id,q(b.x),q(b.y),q(b.vx),q(b.vy),b.ownerRole,b.flash?1:0])})}},Math.round(1000/SNAPSHOT_RATE));snapshotTimer.unref?.();
const heartbeatTimer=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue}ws.isAlive=false;ws.ping()}},10000);heartbeatTimer.unref?.();
function shutdown(signal){console.log(`[server] ${signal}`);clearInterval(tickTimer);clearInterval(snapshotTimer);clearInterval(heartbeatTimer);for(const ws of wss.clients)try{ws.close(1012,'server_restart')}catch{}server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref()}
process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));
server.listen(PORT,HOST,()=>console.log(`[server] Caos Live multiplayer ${SERVER_VERSION} on ${HOST}:${PORT}`));
