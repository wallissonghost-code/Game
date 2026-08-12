from pathlib import Path
import json, re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label} not found')
    return text.replace(old, new, 1)

# ---------------- P2 client ----------------
p = Path('src/duo.js')
s = p.read_text()

# Add camera/prediction/network cache state.
s = replace_once(
    s,
    "const VERSION='0.17.27',$=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d',{alpha:false});let W=0,H=0,dpr=1,peer=null,conn=null,retry=null,room='',snapshotAt=0;const keys={},input={dx:0,dy:0},me={x:84,y:0,r:18,life:100,maxLife:100,aim:0,down:false,moving:false,walk:0,shotFlash:0},host={x:0,y:0,life:100,maxLife:100,aim:0,down:false,moving:false,walk:0,shotFlash:0},enemies=[],bullets=[];let level=1,pointer=null;",
    "const VERSION='0.17.27',$=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d',{alpha:false});let W=0,H=0,dpr=1,peer=null,conn=null,retry=null,room='',snapshotAt=0,lastDraw=performance.now();const keys={},input={dx:0,dy:0},me={x:84,y:0,r:18,life:100,maxLife:100,aim:0,down:false,moving:false,walk:0,shotFlash:0},camera={x:84,y:0},host={x:0,y:0,tx:0,ty:0,life:100,maxLife:100,aim:0,down:false,moving:false,walk:0,shotFlash:0},enemies=[],bullets=[],enemyCache=new Map();let level=1,pointer=null;",
    'duo state header'
)

# No expensive pixel-readback on every regular sprite in P2. PNGs are already transparent.
s = s.replace("loadFrames('assets/weapons',32,i=>'frame_'+String(i).padStart(3,'0')+'.png',true)", "loadFrames('assets/weapons',32,i=>'frame_'+String(i).padStart(3,'0')+'.png')")
s = s.replace("loadFrames('assets/mobs/Ogro',32,i=>'frame_'+String(i).padStart(3,'0')+'.png',true)", "loadFrames('assets/mobs/Ogro',32,i=>'frame_'+String(i).padStart(3,'0')+'.png')")
s = s.replace("loadFrames('assets/mobs/Ogro Elite',32,i=>'frame_'+String(i).padStart(3,'0')+'.png',true)", "loadFrames('assets/mobs/Ogro Elite',32,i=>'frame_'+String(i).padStart(3,'0')+'.png')")

# Replace eager 5-pack + bosses startup with 3 essential packs and lazy Elite/Boss loading.
start = s.find("(async()=>{try{const [base,armed,weapons,mobs,elite]=await Promise.all([")
end_marker = "bossColossusReady=c;bossVoidReady=v})();"
end = s.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('eager asset loader block not found')
end += len(end_marker)
loader = r"""let eliteLoading=false,colossusLoading=false,voidLoading=false;
async function ensureElite(){if(eliteReady||eliteLoading)return;eliteLoading=true;try{const elite=await loadFrames('assets/mobs/Ogro Elite',32,i=>'frame_'+String(i).padStart(3,'0')+'.png');eliteReady=mapMob32(elite,eliteOgreFrames)}catch(e){console.warn('DUO ELITE LAZY',e)}finally{eliteLoading=false}}
async function ensureBoss(type){if(type==='colossus'){if(bossColossusReady||colossusLoading)return;colossusLoading=true;bossColossusReady=await loadBoss('assets/bosses/Ogroboss1.zip',bossColossusFrames,'colossus');colossusLoading=false}else{if(bossVoidReady||voidLoading)return;voidLoading=true;bossVoidReady=await loadBoss('assets/bosses/Ogro2.0Boss.zip',bossVoidFrames,'void');voidLoading=false}}
(async()=>{try{const [armed,weapons,mobs]=await Promise.all([
 loadFrames('assets/player-armed',32,i=>'Posearma'+i+'.png'),
 loadFrames('assets/weapons',32,i=>'frame_'+String(i).padStart(3,'0')+'.png'),
 loadFrames('assets/mobs/Ogro',32,i=>'frame_'+String(i).padStart(3,'0')+'.png')
 ]);armedReady=mapPlayer32(armed,playerArmedFrames);playerReady=armedReady;weaponReady=mapPlayer32(weapons,playerWeaponFrames);ogreReady=mapMob32(mobs,ogreFrames);console.log('DUO LITE ASSETS READY',{armedReady,weaponReady,ogreReady})}catch(e){console.error('DUO ASSET LOAD ERROR',e)}})();"""
s = s[:start] + loader + s[end:]

# Lower mobile pixel workload.
old_resize = "function resize(){const r=canvas.getBoundingClientRect();W=Math.max(320,r.width|0);H=Math.max(320,r.height|0);dpr=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr)}addEventListener('resize',resize,{passive:true});resize();"
new_resize = "function resize(){const r=canvas.getBoundingClientRect();W=Math.max(320,r.width|0);H=Math.max(320,r.height|0);const mobile=W<=760;dpr=Math.min(devicePixelRatio||1,mobile?1.08:1.30);canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr)}addEventListener('resize',resize,{passive:true});resize();"
s = replace_once(s, old_resize, new_resize, 'duo resize')

# Predictive camera: authoritative position stays in me; rendering follows a locally-predicted camera.
s = replace_once(
    s,
    "function world(x,y){return{x:x-me.x+W/2,y:y-me.y+H/2}}",
    "function world(x,y){return{x:x-camera.x+W/2,y:y-camera.y+H/2}}",
    'duo world camera'
)
s = replace_once(
    s,
    "if(window.CaosMap)window.CaosMap.init({version:VERSION,ctx,viewport:()=>({W,H}),player:()=>me,enemies:()=>enemies,hash,world});",
    "if(window.CaosMap)window.CaosMap.init({version:VERSION,ctx,viewport:()=>({W,H}),player:()=>camera,enemies:()=>enemies,hash,world,lite:true});",
    'duo map lite init'
)

# Reuse enemy objects instead of allocating the full world every snapshot. Keep authoritative targets for interpolation.
old_data = "function onData(d){if(!d||d.type!=='duo-snapshot')return;snapshotAt=performance.now();if(d.p2)Object.assign(me,d.p2);if(d.p1)Object.assign(host,d.p1);enemies.length=0;for(const e of d.enemies||[])enemies.push(e);bullets.length=0;for(const b of d.bullets||[])bullets.push(b);level=d.level||1;$('life').textContent=Math.max(0,Math.round(me.life))+'/'+Math.round(me.maxLife||100);$('level').textContent='LV '+level;$('down').classList.toggle('show',!!me.down)}"
new_data = "function onData(d){if(!d||d.type!=='duo-snapshot')return;const first=!snapshotAt;snapshotAt=performance.now();if(d.p2)Object.assign(me,d.p2);if(d.p1){if(first){host.x=d.p1.x;host.y=d.p1.y}host.tx=d.p1.x;host.ty=d.p1.y;const hx=host.x,hy=host.y;Object.assign(host,d.p1);host.x=hx;host.y=hy}if(first){camera.x=me.x;camera.y=me.y}const next=[],seen=new Set();for(const raw of d.enemies||[]){const id=raw.id??(raw.type+':'+Math.round(raw.x/8)+':'+Math.round(raw.y/8)),e=enemyCache.get(id)||{...raw,x:raw.x,y:raw.y,tx:raw.x,ty:raw.y};const ox=e.x,oy=e.y;Object.assign(e,raw);e.id=id;e.tx=raw.x;e.ty=raw.y;e.x=ox;e.y=oy;enemyCache.set(id,e);seen.add(id);next.push(e)}for(const id of enemyCache.keys())if(!seen.has(id))enemyCache.delete(id);enemies.splice(0,enemies.length,...next);bullets.splice(0,bullets.length,...(d.bullets||[]));level=d.level||1;$('life').textContent=Math.max(0,Math.round(me.life))+'/'+Math.round(me.maxLife||100);$('level').textContent='LV '+level;$('down').classList.toggle('show',!!me.down)}"
s = replace_once(s, old_data, new_data, 'duo snapshot handler')

# 20 Hz input is enough and halves signaling chatter.
s = replace_once(s, "},33);\nfunction playerFacing", "},50);\nfunction playerFacing", 'duo input interval')

# Trigger visual packs only if actually needed.
s = replace_once(
    s,
    "function bossFrame(e){const pack=e.type==='colossus'?bossColossusFrames:bossVoidFrames,ready=e.type==='colossus'?bossColossusReady:bossVoidReady,dir=e.facing||'down',arr=pack[dir]?.length?pack[dir]:pack.down;if(!ready||!arr?.length)return null;return arr[(e.speedMul===0?0:Math.floor((e.t||0)/.15))%arr.length]}",
    "function bossFrame(e){const pack=e.type==='colossus'?bossColossusFrames:bossVoidFrames,ready=e.type==='colossus'?bossColossusReady:bossVoidReady,dir=e.facing||'down',arr=pack[dir]?.length?pack[dir]:pack.down;if(!ready){ensureBoss(e.type);return null}if(!arr?.length)return null;return arr[(e.speedMul===0?0:Math.floor((e.t||0)/.15))%arr.length]}",
    'duo boss lazy trigger'
)
s = replace_once(
    s,
    "let img=null,h=58;if(boss){img=bossFrame(e);h=145}else{const pack=e.tier===1&&eliteReady?eliteOgreFrames:ogreFrames,dir=e.facing||'down'",
    "let img=null,h=58;if(boss){img=bossFrame(e);h=145}else{if(e.tier===1&&!eliteReady)ensureElite();const pack=e.tier===1&&eliteReady?eliteOgreFrames:ogreFrames,dir=e.facing||'down'",
    'duo elite lazy trigger'
)

# Smooth camera + P1 + mobs between 10 Hz snapshots. Local camera predicts P2 input and softly reconciles.
old_draw = "function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);if(!(window.CaosMap&&window.CaosMap.drawGround&&window.CaosMap.drawGround())){ctx.fillStyle='#d8e8ef';ctx.fillRect(0,0,W,H)}for(const b of bullets){const q=world(b.x,b.y);ctx.fillStyle=b.owner==='p2'?'#67e8f9':'#fef08a';ctx.beginPath();ctx.arc(q.x,q.y,3,0,7);ctx.fill()}for(const e of enemies)drawEnemy(e);drawSoldier(host,'P1');drawSoldier(me,'P2',true);if(performance.now()-snapshotAt>1500&&conn?.open)setStatus('SINAL DO HOST LENTO');requestAnimationFrame(draw)}requestAnimationFrame(draw);"
new_draw = "function draw(t=performance.now()){const dt=Math.min(.05,Math.max(.001,(t-lastDraw)/1000));lastDraw=t;readInput();if(snapshotAt&&!me.down){camera.x+=input.dx*255*dt;camera.y+=input.dy*255*dt;const ex=me.x-camera.x,ey=me.y-camera.y,err=Math.hypot(ex,ey);if(err>260){camera.x=me.x;camera.y=me.y}else{const k=1-Math.exp(-9*dt);camera.x+=ex*k;camera.y+=ey*k}}else if(snapshotAt){camera.x+=(me.x-camera.x)*Math.min(1,dt*12);camera.y+=(me.y-camera.y)*Math.min(1,dt*12)}const hk=1-Math.exp(-11*dt);host.x+=(host.tx-host.x)*hk;host.y+=(host.ty-host.y)*hk;const ek=1-Math.exp(-13*dt);for(const e of enemies){e.x+=(e.tx-e.x)*ek;e.y+=(e.ty-e.y)*ek}ctx.setTransform(dpr,0,0,dpr,0,0);if(!(window.CaosMap&&window.CaosMap.drawGround&&window.CaosMap.drawGround())){ctx.fillStyle='#d8e8ef';ctx.fillRect(0,0,W,H)}for(const b of bullets){const q=world(b.x,b.y);if(q.x<-20||q.y<-20||q.x>W+20||q.y>H+20)continue;ctx.fillStyle=b.owner==='p2'?'#67e8f9':'#fef08a';ctx.beginPath();ctx.arc(q.x,q.y,3,0,7);ctx.fill()}for(const e of enemies)drawEnemy(e);drawSoldier(host,'P1');drawSoldier(me,'P2',true);if(performance.now()-snapshotAt>1500&&conn?.open)setStatus('SINAL DO HOST LENTO');requestAnimationFrame(draw)}requestAnimationFrame(draw);"
s = replace_once(s, old_draw, new_draw, 'duo smooth draw loop')

p.write_text(s)

# ---------------- Host network payload ----------------
p = Path('src/game.js')
g = p.read_text()

# Stable network IDs and lower payload.
g = replace_once(g, "let duoConn=null,duoShotTimer=.05;", "let duoConn=null,duoShotTimer=.05,duoEntitySeq=1;", 'host duo sequence')
old_snap = "function duoSnapshot(){const near=enemies.filter(e=>!e.dead&&Math.hypot(e.x-duoPlayer.x,e.y-duoPlayer.y)<1100).slice(0,120).map(e=>({x:e.x,y:e.y,r:e.r,type:e.type,tier:e.tier,hp:e.hp,max:e.max,facing:e.facing,t:e.t,speedMul:e.speedMul||1})),bs=bullets.filter(b=>!b.flash&&!b.dead&&Math.hypot(b.x-duoPlayer.x,b.y-duoPlayer.y)<1200).slice(0,100).map(b=>({x:b.x,y:b.y,owner:b.owner||'p1'}));return{type:'duo-snapshot'"
new_snap = "function duoSnapshot(){const near=enemies.filter(e=>!e.dead&&Math.hypot(e.x-duoPlayer.x,e.y-duoPlayer.y)<900).slice(0,72).map(e=>({id:e.duoNetId||(e.duoNetId=duoEntitySeq++),x:e.x,y:e.y,r:e.r,type:e.type,tier:e.tier,hp:e.hp,max:e.max,facing:e.facing,t:e.t,speedMul:e.speedMul||1})),bs=bullets.filter(b=>!b.flash&&!b.dead&&Math.hypot(b.x-duoPlayer.x,b.y-duoPlayer.y)<900).slice(0,48).map(b=>({x:b.x,y:b.y,owner:b.owner||'p1'}));return{type:'duo-snapshot'"
g = replace_once(g, old_snap, new_snap, 'host compact snapshot')

# Don't queue stale snapshots if P2 cannot consume them quickly enough.
g = replace_once(
    g,
    "function sendDuoSnapshot(){if(duoConn?.open)try{duoConn.send(duoSnapshot())}catch{}}",
    "function sendDuoSnapshot(){if(!duoConn?.open)return;try{const dc=duoConn.dataChannel;if(dc&&dc.bufferedAmount>32768)return;duoConn.send(duoSnapshot())}catch{}}",
    'host backpressure'
)
g = replace_once(g, "setInterval(sendDuoSnapshot,80);", "setInterval(sendDuoSnapshot,100);", 'host snapshot rate')
p.write_text(g)

# ---------------- Map runtime lite image set ----------------
p = Path('src/map-runtime.js')
m = p.read_text()
old_load = "const defs=(manifest.chunks||[]).slice();const ok=await Promise.all(defs.map(loadImage));buildGrid();API.ready=defs.length===32&&ok.filter(Boolean).length===32&&grid.every(c=>c?.def);"
new_load = "buildGrid();const allDefs=(manifest.chunks||[]).slice(),defs=cfg?.lite?[...new Map([...grid.map(c=>c?.def),...(byMask[0]||[])].filter(Boolean).map(d=>[d.id,d])).values()]:allDefs,ok=await Promise.all(defs.map(loadImage));API.ready=allDefs.length===32&&ok.filter(Boolean).length===defs.length&&grid.every(c=>c?.def);"
m = replace_once(m, old_load, new_load, 'map lite loader')
p.write_text(m)

# ---------------- Version sync ----------------
for name in ['index.html','painel.html','map-lab.html','duo.html','src/game.js','src/panel.js','src/map-lab.js','src/duo.js']:
    fp = Path(name)
    if fp.exists():
        t = fp.read_text().replace('0.17.27','0.17.28').replace('01727','01728')
        fp.write_text(t)
Path('version.json').write_text(json.dumps({'version':'0.17.28','build':'duo-performance-prediction-backpressure'},indent=2,ensure_ascii=False)+'\n')

print('v0.17.28 duo performance patch applied')
