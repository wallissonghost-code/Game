from pathlib import Path
import re,json
p=Path('src/game.js')
s=p.read_text()
s=s.replace("const VERSION='0.17.1'","const VERSION='0.17.2'",1)

old="function enemyTier(){const r=Math.random();if(level>=30&&r<.10)return 2;if(level>=15&&r<(level>=30?.32:.18))return 1;return 0}function makeEnemy(type,near=false){if(enemies.length>=MAX_ENEMIES)return;const c=types[type];if(!c)return;const a=Math.random()*Math.PI*2,dist=near?180+Math.random()*220:Math.max(W,H)*.7+Math.random()*260,tier=c.boss?3:enemyTier(),mult=tier===2?1.8:tier===1?1.35:1;enemies.push({x:player.x+Math.cos(a)*dist,y:player.y+Math.sin(a)*dist,type,tier,r:c.r*(tier===2?1.12:tier===1?1.06:1),speed:(c.s+Math.random()*8)*(tier===2?1.12:tier===1?1.06:1),hp:Math.ceil(c.h*mult),max:Math.ceil(c.h*mult),damage:Math.ceil(c.d*(tier===2?1.4:tier===1?1.18:1)),xp:Math.ceil(c.x*mult),dead:false,t:Math.random()*8,seed:Math.random()*99,attackAt:0,attackFlash:0,facing:'down',skinVariant:Math.floor(Math.random()*3),aiPhase:Math.floor(Math.random()*4),mvx:0,mvy:0})}"
new="function enemyTier(){const r=Math.random();if(level>=30&&r<.10)return 2;if(level>=15&&r<(level>=30?.32:.18))return 1;return 0}function makeEnemy(type,near=false){if(enemies.length>=MAX_ENEMIES)return;const c=types[type];if(!c)return;const a=Math.random()*Math.PI*2,dist=near?180+Math.random()*220:Math.max(W,H)*.7+Math.random()*260,tier=c.boss?3:enemyTier(),hpMult=tier===2?3.5:tier===1?2.2:1,dmgMult=tier===2?1.9:tier===1?1.45:1,xpMult=tier===2?4:tier===1?2.5:1;enemies.push({x:player.x+Math.cos(a)*dist,y:player.y+Math.sin(a)*dist,type,tier,r:c.r,speed:(c.s+Math.random()*8)*(tier===2?1.10:tier===1?1.05:1),hp:Math.ceil(c.h*hpMult),max:Math.ceil(c.h*hpMult),damage:Math.ceil(c.d*dmgMult),xp:Math.ceil(c.x*xpMult),dead:false,t:Math.random()*8,seed:Math.random()*99,attackAt:0,attackFlash:0,facing:'down',skinVariant:Math.floor(Math.random()*3),aiPhase:Math.floor(Math.random()*4),mvx:0,mvy:0})}"
if old not in s: raise SystemExit('makeEnemy block not found')
s=s.replace(old,new,1)

old="function nearestVisible(){let t=null,b=1e18;for(const e of enemies){if(e.dead||!targetVisible(e))continue;const dx=e.x-player.x,dy=e.y-player.y,q=dx*dx+dy*dy;if(q<b){b=q;t=e}}return t}function focusedTarget(){const now=performance.now();if(autoTarget&&(!autoTarget.dead)&&enemies.includes(autoTarget)&&targetVisible(autoTarget)){if(now<autoTargetUntil)return autoTarget}autoTarget=nearestVisible();autoTargetUntil=now+2200;return autoTarget}"
new="const FIRE_RANGE=460;function nearestVisible(){let t=null,b=FIRE_RANGE*FIRE_RANGE;for(const e of enemies){if(e.dead||!targetVisible(e))continue;const dx=e.x-player.x,dy=e.y-player.y,q=dx*dx+dy*dy;if(q<b){b=q;t=e}}return t}function focusedTarget(){const now=performance.now(),near=nearestVisible();if(!near){autoTarget=null;autoTargetUntil=0;return null}if(autoTarget&&(!autoTarget.dead)&&enemies.includes(autoTarget)&&targetVisible(autoTarget)){const ad=Math.hypot(autoTarget.x-player.x,autoTarget.y-player.y),nd=Math.hypot(near.x-player.x,near.y-player.y);if(ad<=FIRE_RANGE&&now<autoTargetUntil&&nd>ad*.72)return autoTarget}autoTarget=near;autoTargetUntil=now+550;return autoTarget}"
if old not in s: raise SystemExit('target block not found')
s=s.replace(old,new,1)

anchor="const SPATIAL=96;function buildEnemyGrid(){const g=new Map();for(const e of enemies){if(e.dead)continue;const cx=Math.floor(e.x/SPATIAL),cy=Math.floor(e.y/SPATIAL),k=cx+','+cy;let a=g.get(k);if(!a)g.set(k,a=[]);a.push(e)}return g}"
insert=anchor+"function separateEnemies(){const g=buildEnemyGrid();for(const e of enemies){if(e.dead)continue;const cx=Math.floor(e.x/SPATIAL),cy=Math.floor(e.y/SPATIAL);for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const a=g.get((cx+ox)+','+(cy+oy));if(!a)continue;for(const o of a){if(o===e||o.dead)continue;const dx=e.x-o.x,dy=e.y-o.y,d=Math.hypot(dx,dy)||.001,min=(types[e.type]?.boss||types[o.type]?.boss)?Math.max(34,(e.r+o.r)*.72):Math.max(22,(e.r+o.r)*.62);if(d<min){const push=Math.min(2.8,(min-d)*.14),ux=dx/d,uy=dy/d;e.x+=ux*push;e.y+=uy*push}}}}}"
if anchor not in s: raise SystemExit('grid anchor not found')
s=s.replace(anchor,insert,1)

old="}}}const enemyGrid=buildEnemyGrid();for(const b of bullets){"
new="}}}separateEnemies();const enemyGrid=buildEnemyGrid();for(const b of bullets){"
if old not in s: raise SystemExit('separation insertion point not found')
s=s.replace(old,new,1)

# Replace aura with no geometric ring; glow is handled on sprite shadow.
s=re.sub(r"function tierAura\(e\)\{.*?\}\nconst mobSkinCache", "function tierAura(e){}\nconst mobSkinCache", s, count=1, flags=re.S)

old="ctx.shadowColor=isBoss?'#ef4444':c.c;ctx.shadowBlur=perfMode>=2?(isBoss?8:0):perfMode===1?(isBoss?14:e.tier===2?7:e.tier===1?5:2):(isBoss?24:e.tier===2?18:e.tier===1?12:7);drawOgreSkin(e,isBoss);ctx.shadowBlur=0;if(!isBoss&&(perfMode<2||e.tier>0))tierAura(e);"
new="ctx.shadowColor=isBoss?'#ef4444':e.tier===2?'#ef4444':e.tier===1?'#a855f7':c.c;ctx.shadowBlur=perfMode>=2?(isBoss?8:e.tier>0?5:0):perfMode===1?(isBoss?14:e.tier===2?10:e.tier===1?8:2):(isBoss?24:e.tier===2?22:e.tier===1?18:7);drawOgreSkin(e,isBoss);ctx.shadowBlur=0;"
if old not in s: raise SystemExit('shadow block not found')
s=s.replace(old,new,1)

# Remove ELITE/CORROMPIDO labels, keep boss name.
s=re.sub(r"if\(isBoss\)\{ctx\.fillStyle='#fde68a';ctx\.font='bold 8px sans-serif';ctx\.textAlign='center';ctx\.fillText\(c\.name,0,barY-7\)\}else if\(e\.tier===1\|\|e\.tier===2\)\{.*?\}", "if(isBoss){ctx.fillStyle='#fde68a';ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.fillText(c.name,0,barY-7)}", s, count=1, flags=re.S)

p.write_text(s)
idx=Path('index.html');i=idx.read_text();i=i.replace('Caos Live v0.17.1','Caos Live v0.17.2').replace('v0.17.1 · ARMA AJUSTADA 8 DIREÇÕES','v0.17.2 · GAMEPLAY POLIDO').replace('v0.17.1</span>','v0.17.2</span>').replace('src/game.js?v=0171','src/game.js?v=0172');idx.write_text(i)
vp=Path('version.json');v=json.loads(vp.read_text());v['version']='0.17.2';v['build']='target-separation-elite-polish';vp.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
print('patched gameplay v0.17.2')
