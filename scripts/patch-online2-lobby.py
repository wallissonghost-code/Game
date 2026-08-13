from pathlib import Path
import re
p=Path('cloud/game-server-v2.mjs')
s=p.read_text(encoding='utf-8')

def rep(old,new,label):
    global s
    if old not in s: raise SystemExit(f'missing {label}')
    s=s.replace(old,new,1)

def sub(pattern,repl,label):
    global s
    s2,n=re.subn(pattern,repl,s,count=1,flags=re.S)
    if n!=1: raise SystemExit(f'missing {label}: {n}')
    s=s2

rep("ONLINE_VERSION='0.17.37-online.1'","ONLINE_VERSION='0.17.37-online.2'",'version')
rep("const FILES={html:path.join(ROOT,'multiplayer.html'),js:path.join(ROOT,'src','multiplayer.js'),version:path.join(ROOT,'version.json'),manifest:path.join(ROOT,'assets','Map','snow-frost','manifest.json')};","const FILES={html:path.join(ROOT,'multiplayer.html'),js:path.join(ROOT,'src','multiplayer.js'),css:path.join(ROOT,'src','styles','game.css'),version:path.join(ROOT,'version.json'),manifest:path.join(ROOT,'assets','Map','snow-frost','manifest.json')};",'files css')
rep("connected:true,disconnectedAt:0","connected:true,ready:false,disconnectedAt:0",'player ready')
rep("function makeRoom(code){return{code,players:new Map()","function makeRoom(code){return{code,status:'waiting',players:new Map()",'room status')
rep("createdAt:Date.now(),startedAt:Date.now()","createdAt:Date.now(),startedAt:0",'room startedAt')
rep("function presence(r){return[...r.players.values()].map(p=>({id:p.id,role:p.role,name:p.name,connected:p.connected}))}","function presence(r){return[...r.players.values()].map(p=>({id:p.id,role:p.role,name:p.name,connected:p.connected,ready:!!p.ready}))}\nfunction canStart(r){const a=connected(r);return r.status==='waiting'&&a.length===2&&a.every(p=>p.ready)}\nfunction lobbyPayload(r){return{type:'lobby',room:r.code,status:r.status,players:presence(r),canStart:canStart(r),serverTime:Date.now()}}",'presence/lobby')
rep("function broadcast(r,o){const m=JSON.stringify(o);for(const p of r.players.values())if(p.connected&&p.ws?.readyState===WebSocket.OPEN)try{p.ws.send(m)}catch{}}","function broadcast(r,o){const m=JSON.stringify(o);for(const p of r.players.values())if(p.connected&&p.ws?.readyState===WebSocket.OPEN)try{p.ws.send(m)}catch{}}\nfunction broadcastLobby(r){broadcast(r,lobbyPayload(r))}",'broadcast lobby')
rep("connected:p.connected,x:q(p.x)","connected:p.connected,ready:!!p.ready,x:q(p.x)",'serialize ready')
sub(r"function resetRoom\(r\)\{.*?\}\nfunction detach\(ws\)","function beginMatch(r){r.status='running';r.enemies.length=0;r.bullets.length=0;r.medDrop=null;r.spawnAccumulator=0;r.totalKills=0;r.totalXp=0;r.wave=1;r.bossStage=0;r.gameOver=false;r.gameOverAt=0;r.allDownAt=0;r.startedAt=Date.now();r.matchId=`mp-${r.startedAt}-${Math.random().toString(36).slice(2,8)}`;r.nextMedAt=r.startedAt+180000;for(const p of r.players.values())resetPlayer(p);broadcast(r,{type:'match-start',room:r.code,startedAt:r.startedAt,matchId:r.matchId,serverTime:Date.now()})}\nfunction detach(ws)",'beginMatch')
rep("broadcast(r,{type:'presence',room:r.code,players:presence(r),serverTime:Date.now()})","broadcastLobby(r)",'detach lobby')
rep("room:r.code,id:p.id,role:p.role","room:r.code,roomState:r.status,lobby:lobbyPayload(r),id:p.id,role:p.role",'welcome lobby')
new_join="""function join(ws,m){const code=cleanRoom(m.room),session=cleanSession(m.session)||randomUUID().replaceAll('-','');if(code.length<4)return send(ws,{type:'error',code:'invalid_room',message:'Sala precisa ter de 4 a 8 caracteres.'});if(clientState.has(ws))return;let r=rooms.get(code);if(!r){if(!m.create)return send(ws,{type:'error',code:'room_not_found',message:'Sala não encontrada. Confira o código.'});r=makeRoom(code);rooms.set(code,r)}else if(m.create&&!([...r.players.values()].some(x=>x.session===session))&&r.players.size){return send(ws,{type:'error',code:'room_exists',message:'Esse código já está em uso.'})}let p=[...r.players.values()].find(x=>x.session===session);if(p){if(p.ws&&p.ws!==ws&&p.ws.readyState===WebSocket.OPEN)try{p.ws.close(4001,'session_replaced')}catch{};p.ws=ws;p.connected=true;p.disconnectedAt=0;p.lastInputAt=Date.now();p.name=cleanName(m.name||p.name);clientState.set(ws,{roomCode:code,playerId:p.id});welcome(r,p,true);broadcastLobby(r);return}const role=roleFor(r);if(!role)return send(ws,{type:'error',code:'room_full',message:'Sala já tem 2 jogadores.'});p=makePlayer(role,cleanName(m.name),session,ws);r.players.set(p.id,p);clientState.set(ws,{roomCode:code,playerId:p.id});welcome(r,p,false);broadcastLobby(r)}"""
sub(r"function join\(ws,m\)\{.*?\}\nfunction stateFor",new_join+"\nfunction stateFor",'join')
rep("function inputMsg(ws,m){const{p}=stateFor(ws);if(!p)return;","function inputMsg(ws,m){const{r,p}=stateFor(ws);if(!r||r.status!=='running'||r.gameOver||!p)return;",'input guard')
rep("function skillMsg(ws,m){const{p}=stateFor(ws);if(!p?.choices)return;","function skillMsg(ws,m){const{r,p}=stateFor(ws);if(!r||r.status!=='running'||!p?.choices)return;",'skill guard')
anchor="function spawnEnemy(r,{boss=false,typeIndex=null,tier=null}={})"
if anchor not in s: raise SystemExit('missing spawn anchor')
handlers="""function readyMsg(ws,m){const{r,p}=stateFor(ws);if(!r||!p)return;p.ready=m.ready===true;broadcastLobby(r)}
function startMsg(ws){const{r,p}=stateFor(ws);if(!r||!p||p.role!=='p1')return;if(r.status!=='waiting')return send(ws,{type:'error',code:'already_started',message:'A partida já começou.'});if(!canStart(r))return send(ws,{type:'error',code:'not_ready',message:'Os dois jogadores precisam estar conectados e prontos.'});beginMatch(r)}
function restartMsg(ws){const{r,p}=stateFor(ws);if(!r?.gameOver||p?.role!=='p1')return;if(connected(r).length!==2||!connected(r).every(x=>x.ready))return send(ws,{type:'error',code:'players_missing',message:'Os dois jogadores precisam estar conectados.'});beginMatch(r)}

"""
s=s.replace(anchor,handlers+anchor,1)
rep("if(u.pathname==='/src/multiplayer.js')return serve(res,FILES.js,'text/javascript; charset=utf-8');if(u.pathname==='/version.json')","if(u.pathname==='/src/multiplayer.js')return serve(res,FILES.js,'text/javascript; charset=utf-8','no-store');if(u.pathname==='/src/styles/game.css')return serve(res,FILES.css,'text/css; charset=utf-8','public, max-age=86400');if(u.pathname==='/version.json')",'css route')
rep("return serve(res,f,mime(f),'public, max-age=86400')","return serve(res,f,mime(f),'public, max-age=604800, immutable')",'asset cache')
rep("if(m.type==='join')join(ws,m);else if(m.type==='input')inputMsg(ws,m);else if(m.type==='skill-choice')skillMsg(ws,m);else if(m.type==='restart'){const{r}=stateFor(ws);if(r?.gameOver)resetRoom(r)}else if(m.type==='ping')","if(m.type==='join')join(ws,m);else if(m.type==='ready')readyMsg(ws,m);else if(m.type==='start-match')startMsg(ws);else if(m.type==='input')inputMsg(ws,m);else if(m.type==='skill-choice')skillMsg(ws,m);else if(m.type==='restart')restartMsg(ws);else if(m.type==='ping')",'ws dispatch')
rep("if(!rooms.has(r.code))continue;r.tick++;if(r.gameOver)continue;","if(!rooms.has(r.code)||r.status!=='running'||r.gameOver)continue;r.tick++;",'tick waiting')
rep("for(const r of rooms.values())broadcast(r,{type:'snapshot'","for(const r of rooms.values())if(r.status==='running')broadcast(r,{type:'snapshot'",'snap running')
rep("durationMs:now-r.startedAt","durationMs:r.startedAt?now-r.startedAt:0",'duration safe')
p.write_text(s,encoding='utf-8')
print('patched online.2 lobby')
