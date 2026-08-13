from pathlib import Path
import re

CLIENT = Path('src/multiplayer-v2.js')
SERVER = Path('cloud/game-server-v3.mjs')
HTML = Path('multiplayer-v2.html')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: anchor not found')
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label):
    out, n = re.subn(pattern, lambda m: replacement, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    return out

# ---------------- server ----------------
s = SERVER.read_text()
s = s.replace("0.17.37-online-v2.0.3", "0.17.37-online-v2.0.4")

# Creature-hit i-frames and regen state.
needle = 'lastDamageAt:0,aim:0'
count = s.count(needle)
if count < 1:
    raise SystemExit('player damage state anchor missing')
s = s.replace(needle, 'lastDamageAt:0,mobInvUntil:0,regenStage:0,aim:0')

s = replace_once(
    s,
    "allDownAt:0,matchId:`mp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`",
    "allDownAt:0,fx:[],nextFxId:1,matchId:`mp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`",
    'room fx state'
)

s = replace_once(
    s,
    "function spawnFor(role){",
    "function addFx(r,fx){if(!r)return;const at=Date.now();r.fx.push({id:r.nextFxId++,at,...fx});if(r.fx.length>72)r.fx.splice(0,r.fx.length-72)}\nfunction spawnFor(role){",
    'addFx insert'
)

# Send enough state for remote skill visuals without sending the whole skill object.
serialize_block = """function serializePlayer(p){return{id:p.id,role:p.role,name:p.name,connected:p.connected,ready:!!p.ready,x:q(p.x),y:q(p.y),vx:q(p.vx),vy:q(p.vy),hp:q(p.hp),maxHp:q(p.maxHp),down:p.down,revive:q(p.revive),aim:q(p.aim),walk:q(p.walk),shotFlash:p.shotFlash>0,kills:p.kills,xp:Math.floor(p.xp),level:p.level,xpNeed:p.xpNeed,skills:p.skills,choices:p.choices,ack:p.lastSeq,phoenix:p.phoenixReady,armorLv:p.skills.armor||0,regenStage:p.regenStage||0,choosing:!!p.choices,shieldMs:Math.max(0,(p.invUntil||0)-Date.now()),hitMs:Math.max(0,(p.mobInvUntil||0)-Date.now())}}
function serializeRemotePlayer(p){return{id:p.id,role:p.role,name:p.name,connected:p.connected,x:q(p.x),y:q(p.y),vx:q(p.vx),vy:q(p.vy),hp:q(p.hp),maxHp:q(p.maxHp),down:p.down,revive:q(p.revive),aim:q(p.aim),walk:q(p.walk),shotFlash:p.shotFlash>0,level:p.level,ack:p.lastSeq,armorLv:p.skills.armor||0,regenStage:p.regenStage||0,choosing:!!p.choices,shieldMs:Math.max(0,(p.invUntil||0)-Date.now()),hitMs:Math.max(0,(p.mobInvUntil||0)-Date.now())}}
function resetPlayer"""
s = regex_once(
    s,
    r"function serializePlayer\(p\)\{.*?\}\nfunction serializeRemotePlayer\(p\)\{.*?\}\nfunction resetPlayer",
    serialize_block,
    'serialize skill visual state'
)

# Skill selection feedback event.
s = replace_once(
    s,
    "applySkill(p,id);while(!p.choices&&p.xp>=p.xpNeed)",
    "applySkill(p,id);addFx(r,{kind:'skill',playerId:p.id,x:q(p.x),y:q(p.y),skill:id,level:p.skills[id]||1,ttl:700});while(!p.choices&&p.xp>=p.xpNeed)",
    'skill fx event'
)

# Blood proc keeps Solo mechanics and adds visible feedback.
onkill = """function onKill(r,p,e){r.totalKills++;r.points=(r.points||0)+(e.boss?500:e.tier===2?35:e.tier===1?20:10);p.kills++;gainXp(r,p,e.xp);if(p.skills.blood&&p.kills%10===0){if(Math.random()<p.bloodChance){p.maxHp+=1;p.hp=Math.min(p.maxHp,p.hp+1);addFx(r,{kind:'blood',playerId:p.id,x:q(p.x),y:q(p.y),text:'+1 HP MAX',ttl:900})}else{const before=p.hp;p.hp=Math.min(p.maxHp,p.hp+p.bloodHeal);const healed=Math.max(0,p.hp-before);addFx(r,{kind:'blood',playerId:p.id,x:q(p.x),y:q(p.y),text:'+'+q(healed)+' HP',ttl:900})}}}
function fire"""
s = regex_once(s, r"function onKill\(r,p,e\)\{.*?\}\nfunction fire", onkill, 'blood feedback')

# Flash is a true piercing beam like Solo; piercing bullets keep their own identity.
fire_block = """function castFlash(r,p,a){const ux=Math.cos(a),uy=Math.sin(a),hits=[];for(const e of [...r.enemies]){const dx=e.x-p.x,dy=e.y-p.y,along=dx*ux+dy*uy,side=Math.abs(dx*uy-dy*ux);if(along>0&&along<520&&side<26+e.r){e.hp-=p.flashDamage;hits.push({x:q(e.x),y:q(e.y),d:q(p.flashDamage)});if(e.hp<=0){const i=r.enemies.indexOf(e);if(i>=0)r.enemies.splice(i,1);onKill(r,p,e)}}}addFx(r,{kind:'flash',playerId:p.id,x:q(p.x),y:q(p.y),angle:q(a),hits,ttl:180})}
function fire(r,p,t){const a=Math.atan2(t.y-p.y,t.x-p.x);p.aim=a;p.shotFlash=.09;p.shotCounter++;const pl=p.pierceLv||0,every=[0,12,11,10,9,8][pl]||999,pass=[0,2,3,4,5,7][pl]||0,isPiercing=!!(pl&&p.shotCounter%every===0),isFlash=!!p.skills.flash&&p.shotCounter%5===0;r.bullets.push({id:r.nextBulletId++,ownerId:p.id,ownerRole:p.role,x:p.x+Math.cos(a)*24,y:p.y+Math.sin(a)*24,vx:Math.cos(a)*650,vy:Math.sin(a)*650,ttl:1.25,damage:p.damage,pierceLeft:isPiercing?pass:0,hits:new Set(),flash:false,piercing:isPiercing});if(isFlash)castFlash(r,p,a)}
function damage"""
s = regex_once(s, r"function fire\(r,p,t\)\{.*?\}\nfunction damage", fire_block, 'flash and piercing parity')

# 280 ms creature-hit window + Phoenix push/visual.
damage_block = """function damage(r,p,n,now){if(p.down||p.choices||now<p.invUntil||now<(p.mobInvUntil||0))return;const actual=Math.max(1,n*(1-(p.armorReduction||0)));p.hp=Math.max(0,p.hp-actual);p.lastDamageAt=now;p.mobInvUntil=now+280;addFx(r,{kind:'hit',playerId:p.id,x:q(p.x),y:q(p.y),amount:q(actual),ttl:300});if(p.hp>0)return;if(p.phoenixReady&&!p.phoenixConsumed){p.phoenixReady=false;p.phoenixConsumed=true;p.skills.phoenix=0;p.hp=Math.max(1,p.maxHp*.8);p.invUntil=now+5000;for(const e of r.enemies){const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy)||1;if(d<190){const push=(190-d)*.8;e.x+=dx/d*push;e.y+=dy/d*push;resolveWorld(e,e.r)}}addFx(r,{kind:'phoenix',playerId:p.id,x:q(p.x),y:q(p.y),ttl:5000});return}p.down=true;p.revive=0;p.inputX=p.inputY=p.vx=p.vy=0}
function castArc"""
s = regex_once(s, r"function damage\(p,n,now\)\{.*?\}\nfunction castArc", damage_block, 'mob iframes and phoenix')

# Arc chain now emits a replicated visual event.
arc_block = """function castArc(r,p,now){const lv=p.arcLv||0,first=nearestEnemy(r,p,460);if(!lv||!first)return;const cds=[0,8,7.5,7,6.5,6],targets=[0,2,2,3,3,4],dmg=[0,2,3,4,5,6];p.arcAt=now+cds[lv]*1000;const hit=[first];while(hit.length<targets[lv]){const last=hit.at(-1);let next=null,bd=190;for(const e of r.enemies){if(hit.includes(e))continue;const d=Math.hypot(e.x-last.x,e.y-last.y);if(d<bd){bd=d;next=e}}if(!next)break;hit.push(next)}const pts=[{x:q(p.x),y:q(p.y)},...hit.map(e=>({x:q(e.x),y:q(e.y)}))];addFx(r,{kind:'arc',playerId:p.id,points:pts,damage:dmg[lv],ttl:320});for(const e of hit){e.hp-=dmg[lv];if(e.hp<=0){const i=r.enemies.indexOf(e);if(i>=0)r.enemies.splice(i,1);onKill(r,p,e)}}}
function updatePlayers"""
s = regex_once(s, r"function castArc\(r,p,now\)\{.*?\}\nfunction updatePlayers", arc_block, 'arc visual event')

# Progressive regeneration matches Solo stages at 3s/6s/10s.
old_regen = "if(p.regen>0&&p.hp<p.maxHp&&now-p.lastDamageAt>1000)p.hp=Math.min(p.maxHp,p.hp+p.regen*dt);"
new_regen = "if(p.regen>0&&p.hp<p.maxHp){const safe=(now-p.lastDamageAt)/1000;if(safe>=1){const lv=p.skills.regen||0;let rate=p.regen;if(safe>=10)rate=[0,1,1.5,2,2.5,3.5][lv];else if(safe>=6)rate=[0,.8,1.2,1.6,2,2.5][lv];else if(safe>=3)rate=[0,.6,.9,1.2,1.5,1.8][lv];p.regenStage=safe>=10?3:safe>=6?2:safe>=3?1:0;p.hp=Math.min(p.maxHp,p.hp+rate*dt)}else p.regenStage=0}else p.regenStage=0;"
s = replace_once(s, old_regen, new_regen, 'progressive regen')

s = replace_once(s, "damage(p,e.damage,now)", "damage(r,p,e.damage,now)", 'damage caller')

s = replace_once(
    s,
    "r.allDownAt=0;r.startedAt=Date.now();",
    "r.allDownAt=0;r.fx.length=0;r.nextFxId=1;r.startedAt=Date.now();",
    'reset fx on match start'
)

# Replicate recent effects and piercing flag. Old effects are pruned in the tick.
s = replace_once(
    s,
    "},players:[...r.players.values()].map(x=>x.id===p.id?serializePlayer(x):serializeRemotePlayer(x)),enemies:",
    "},effects:r.fx.filter(f=>now-f.at<1300),players:[...r.players.values()].map(x=>x.id===p.id?serializePlayer(x):serializeRemotePlayer(x)),enemies:",
    'snapshot effects'
)
s = replace_once(s, "b.ownerRole,b.flash?1:0])", "b.ownerRole,b.flash?1:0,b.piercing?1:0])", 'piercing snapshot')
s = replace_once(
    s,
    "updateRevive(r,dt,now);updateMed(r,now)}},Math.round(1000/TICK_RATE))",
    "updateRevive(r,dt,now);updateMed(r,now);if(r.fx.length)r.fx=r.fx.filter(f=>now-f.at<1600)}},Math.round(1000/TICK_RATE))",
    'fx cleanup'
)

SERVER.write_text(s)

# ---------------- client ----------------
c = CLIENT.read_text()
c = c.replace("0.17.37-online-v2.0.3", "0.17.37-online-v2.0.4")
c = c.replace("TAG='01737v203'", "TAG='01737v204'", 1)
c = replace_once(
    c,
    "localWalk=0,pendingInputs=[],lastAck=0,rankSavedMatch='';",
    "localWalk=0,pendingInputs=[],lastAck=0,rankSavedMatch='',skillFx=[],seenFx=new Set();",
    'client fx state'
)

# Parse piercing bullets.
c = replace_once(
    c,
    "const[id,x,y,vx,vy,ownerRole,flash]=a;",
    "const[id,x,y,vx,vy,ownerRole,flash,piercing]=a;",
    'bullet tuple parse'
)
c = replace_once(
    c,
    "Object.assign(b,{vx,vy,ownerRole,flash:!!flash});",
    "Object.assign(b,{vx,vy,ownerRole,flash:!!flash,piercing:!!piercing});",
    'bullet piercing state'
)

# Consume replicated FX once per event id.
c = replace_once(
    c,
    "for(const id of [...bullets.keys()])if(!liveB.has(id))bullets.delete(id);refreshUi();refreshSkill();",
    "for(const id of [...bullets.keys()])if(!liveB.has(id))bullets.delete(id);for(const fx of m.effects||[]){if(seenFx.has(fx.id))continue;seenFx.add(fx.id);skillFx.push({...fx,born:now,until:now+Math.max(120,Number(fx.ttl||500))});if(seenFx.size>2048)seenFx=new Set([...seenFx].slice(-1024))}refreshUi();refreshSkill();",
    'consume skill effects'
)

# Player skill auras: armor, regen, level-up shield, phoenix shield and hit feedback.
aura_fn = """function drawPlayerAuras(p){const now=performance.now(),armor=Number(p.armorLv||p.skills?.armor||0),regen=Number(p.regenStage||0),choosing=!!p.choosing||!!p.choices?.length,phoenix=Number(p.shieldMs||0)>0,hit=Number(p.hitMs||0)>0;if(armor){const colors=['','#b87333','#c0c0c0','#d4af37','#67e8f9'],pulse=.5+.5*Math.sin(now/180);ctx.save();ctx.strokeStyle=colors[Math.min(4,armor)]||'#cbd5e1';ctx.globalAlpha=.45+.2*pulse;ctx.lineWidth=2;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=8;ctx.beginPath();ctx.ellipse(0,23,26+armor,9+armor*.5,0,0,Math.PI*2);ctx.stroke();ctx.restore()}if(regen){ctx.save();ctx.strokeStyle='#4ade80';ctx.globalAlpha=.48+.12*Math.sin(now/150);ctx.lineWidth=1.5+regen*.4;ctx.shadowColor='#22c55e';ctx.shadowBlur=9+regen*3;ctx.setLineDash([5,8]);ctx.lineDashOffset=-now/40;ctx.beginPath();ctx.arc(0,0,29+regen*2,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore()}if(choosing&&!p.down){ctx.save();ctx.strokeStyle='#67e8f9';ctx.lineWidth=2;ctx.shadowColor='#22d3ee';ctx.shadowBlur=14;ctx.setLineDash([8,5]);ctx.lineDashOffset=-now/28;ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*2);ctx.stroke();ctx.restore()}if(phoenix&&!p.down){const pulse=.5+.5*Math.sin(now/90);ctx.save();ctx.globalCompositeOperation='screen';ctx.strokeStyle='#fde68a';ctx.shadowColor='#f59e0b';ctx.shadowBlur=18+8*pulse;ctx.lineWidth=3;ctx.setLineDash([13,7]);ctx.lineDashOffset=-now/28;ctx.beginPath();ctx.arc(0,0,42+pulse*2,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#fb923c';ctx.lineWidth=2;ctx.setLineDash([5,10]);ctx.lineDashOffset=now/22;ctx.beginPath();ctx.arc(0,0,34-pulse,0,Math.PI*2);ctx.stroke();ctx.restore()}if(hit){ctx.save();ctx.globalAlpha=.28;ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(0,0,30,0,Math.PI*2);ctx.fill();ctx.restore()}}
function drawPlayer(p,cx,cy){"""
c = replace_once(c, "function drawPlayer(p,cx,cy){", aura_fn, 'player auras')
c = replace_once(
    c,
    "if(p.choices?.length&&!p.down){ctx.strokeStyle='#67e8f9';ctx.lineWidth=2;ctx.shadowColor='#22d3ee';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0}",
    "drawPlayerAuras(p);",
    'replace old choice shield'
)

# Special skill VFX renderer.
fx_renderer = """function drawSkillEffects(cx,cy){const now=performance.now();skillFx=skillFx.filter(f=>f.until>now);for(const f of skillFx){const life=Math.max(0,Math.min(1,(f.until-now)/Math.max(1,f.until-f.born)));if(f.kind==='flash'){const a=Number(f.angle||0),p=worldToScreen(f.x,f.y,cx,cy),x2=p.x+Math.cos(a)*520,y2=p.y+Math.sin(a)*520;ctx.save();ctx.globalAlpha=life;ctx.strokeStyle='#fffde7';ctx.shadowColor='#fef08a';ctx.shadowBlur=24;ctx.lineWidth=15;ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*28,p.y+Math.sin(a)*28);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();for(const h of f.hits||[]){const q=worldToScreen(h.x,h.y,cx,cy);ctx.save();ctx.globalAlpha=life;ctx.font='900 11px sans-serif';ctx.textAlign='center';ctx.strokeStyle='#111827';ctx.lineWidth=3;ctx.fillStyle='#fde047';ctx.strokeText('-'+h.d,q.x,q.y-28);ctx.fillText('-'+h.d,q.x,q.y-28);ctx.restore()}}else if(f.kind==='arc'){const pts=f.points||[];if(pts.length>1){ctx.save();ctx.globalAlpha=life;ctx.strokeStyle='#a5f3fc';ctx.shadowColor='#22d3ee';ctx.shadowBlur=16;ctx.lineWidth=3;ctx.beginPath();pts.forEach((pt,i)=>{const q=worldToScreen(pt.x,pt.y,cx,cy);if(!i)ctx.moveTo(q.x,q.y);else{const prev=worldToScreen(pts[i-1].x,pts[i-1].y,cx,cy),mx=(prev.x+q.x)/2+Math.sin((f.id+i)*7)*8,my=(prev.y+q.y)/2+Math.cos((f.id+i)*5)*8;ctx.lineTo(mx,my);ctx.lineTo(q.x,q.y)}});ctx.stroke();ctx.restore();for(let i=1;i<pts.length;i++){const q=worldToScreen(pts[i].x,pts[i].y,cx,cy);ctx.save();ctx.globalAlpha=life;ctx.font='900 10px sans-serif';ctx.textAlign='center';ctx.fillStyle='#67e8f9';ctx.fillText('-'+f.damage,q.x,q.y-25);ctx.restore()}}}else if(f.kind==='blood'||f.kind==='skill'||f.kind==='hit'){const p=worldToScreen(f.x,f.y,cx,cy),age=1-life,skillText=f.kind==='skill'?(f.skill==='medic'?'+25 HP':f.skill==='armor'?'ARMADURA LV '+f.level:f.skill==='regen'?'REGEN LV '+f.level:''):f.kind==='blood'?f.text:'-'+f.amount;if(!skillText)continue;ctx.save();ctx.globalAlpha=life;ctx.font='900 10px sans-serif';ctx.textAlign='center';ctx.strokeStyle='#07101d';ctx.lineWidth=3;ctx.fillStyle=f.kind==='hit'?'#fca5a5':f.kind==='blood'?'#fb7185':'#86efac';ctx.strokeText(skillText,p.x,p.y-38-age*18);ctx.fillText(skillText,p.x,p.y-38-age*18);ctx.restore()}else if(f.kind==='phoenix'){const p=worldToScreen(f.x,f.y,cx,cy),pulse=.5+.5*Math.sin(now/80);ctx.save();ctx.globalAlpha=Math.min(1,life*2);ctx.strokeStyle='#fde047';ctx.shadowColor='#f97316';ctx.shadowBlur=25;ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,38+(1-life)*45+pulse*4,0,Math.PI*2);ctx.stroke();ctx.restore()}}}
function enemyPack(e){"""
c = replace_once(c, "function enemyPack(e){", fx_renderer, 'skill effects renderer')

# Piercing bullet has a distinct purple visual.
draw_bullet = """function drawBullet(b,cx,cy){const q=worldToScreen(b.x,b.y,cx,cy);ctx.save();ctx.fillStyle=b.piercing?'#f0abfc':b.flash?'#fff7ae':'#f8fafc';ctx.shadowColor=b.piercing?'#c026d3':b.flash?'#f59e0b':'#67e8f9';ctx.shadowBlur=b.piercing?12:b.flash?13:6;ctx.beginPath();ctx.arc(q.x,q.y,b.piercing?3.5:b.flash?4:2.5,0,Math.PI*2);ctx.fill();ctx.restore()}
function drawMed"""
c = regex_once(c, r"function drawBullet\(b,cx,cy\)\{.*?\}\nfunction drawMed", draw_bullet, 'piercing bullet vfx')

# Draw replicated skill effects after enemies and before players.
c = replace_once(
    c,
    "for(const e of enemies.values())drawEnemy(e,cx,cy);for(const p of players.values())drawPlayer(p,cx,cy);",
    "for(const e of enemies.values())drawEnemy(e,cx,cy);drawSkillEffects(cx,cy);for(const p of players.values())drawPlayer(p,cx,cy);",
    'frame skill effects'
)

CLIENT.write_text(c)

# ---------------- html/cache ----------------
h = HTML.read_text()
h = h.replace('0.17.37-online-v2.0.3', '0.17.37-online-v2.0.4')
h = h.replace('/src/multiplayer-v2.js?v=01737v203', '/src/multiplayer-v2.js?v=01737v204')
HTML.write_text(h)

print('V2.0.4 skill parity patch applied')
