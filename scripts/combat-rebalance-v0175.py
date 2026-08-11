from pathlib import Path
import re, json
p=Path('src/game.js')
s=p.read_text()
s=s.replace("const VERSION='0.17.4'","const VERSION='0.17.5'",1)

# state + skill registry
s=s.replace("aimTarget=0,damageFx=[];const skillLv={speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,phoenix:0,armor:0};",
"aimTarget=0,damageFx=[],pierceShotCounter=0,nextWaveAt=0;const skillLv={speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,phoenix:0,armor:0,pierce:0};",1)

# add piercing skill before phoenix
needle="{id:'phoenix',n:'Fênix',i:'🔥',r:'secret',desc:l=>'Skill única: revive 1x com 80% da vida máxima e 5s de proteção dourada.',apply:l=>{phoenixReady=true;phoenixConsumed=false}}"
pierce="{id:'pierce',n:'Munição Perfurante',i:'🎯',r:'epic',desc:l=>{const every=[0,12,11,10,9,8][l],pass=[0,2,3,4,5,7][l];return `A cada ${every} tiros, 1 projétil atravessa até ${pass} inimigos.`},apply:l=>{}},"+needle
if needle not in s: raise SystemExit('phoenix skill anchor missing')
s=s.replace(needle,pierce,1)

# reset counter
s=s.replace("damageFx=[];enemySpeed=1;","damageFx=[];pierceShotCounter=0;nextWaveAt=performance.now()+900;enemySpeed=1;",1)

# gameplay wave rebalance
old="function spawnWave(){waveCount++;const n=Math.min(11,3+Math.floor(level/2));for(let i=0;i<n;i++)spawn()}"
new="function spawnWave(){waveCount++;const softCap=Math.min(210,90+level*4),room=Math.max(0,softCap-enemies.length);if(room<=0)return;const n=Math.min(room,Math.min(18,4+Math.floor(level*.65)));for(let i=0;i<n;i++)spawn()}"
if old not in s: raise SystemExit('spawnWave anchor missing')
s=s.replace(old,new,1)

# change continuous horde timer to actual cadence + pressure gating
old="if(hordeEnabled&&ogreReady){spawnTimer-=dt;if(spawnTimer<=0){spawnWave();spawnTimer=Math.max(.11,.52-level*.012)}}else{spawnTimer=.1}"
new="if(hordeEnabled&&ogreReady){const now=performance.now(),softCap=Math.min(210,90+level*4);if(now>=nextWaveAt&&enemies.length<softCap){spawnWave();const pressure=enemies.length/Math.max(1,softCap),base=Math.max(1500,3600-level*55);nextWaveAt=now+base*(.9+pressure*.65)}}else{nextWaveAt=performance.now()+900}"
if old not in s: raise SystemExit('horde timer anchor missing')
s=s.replace(old,new,1)

# piercing bullet creation
old="function shoot(){const t=autoMode?focusedTarget():nearestVisible();if(!t)return;player.aim=Math.atan2(t.y-player.y,t.x-player.x);player.shotFlash=.1;const dir=playerFacing(player.aim),m=muzzleLocal(dir);bullets.push({x:player.x+m.x,y:player.y+m.y,vx:Math.cos(player.aim)*610,vy:Math.sin(player.aim)*610,r:4,dead:false,ammo:1,born:performance.now()});if(player.flashDamage&&++flashCounter%5===0)flash()}"
new="function shoot(){const t=autoMode?focusedTarget():nearestVisible();if(!t)return;player.aim=Math.atan2(t.y-player.y,t.x-player.x);player.shotFlash=.1;const dir=playerFacing(player.aim),m=muzzleLocal(dir),pl=skillLv.pierce||0;let pierceLeft=0;if(pl){pierceShotCounter++;const every=[0,12,11,10,9,8][pl];if(pierceShotCounter>=every){pierceShotCounter=0;pierceLeft=[0,2,3,4,5,7][pl]}}bullets.push({x:player.x+m.x,y:player.y+m.y,vx:Math.cos(player.aim)*610,vy:Math.sin(player.aim)*610,r:4,dead:false,ammo:1,born:performance.now(),pierceLeft,hits:[]});if(player.flashDamage&&++flashCounter%5===0)flash()}"
if old not in s: raise SystemExit('shoot anchor missing')
s=s.replace(old,new,1)

# bullet grid ignores already hit refs
old="function bulletHitsFromGrid(b,g){const cx=Math.floor(b.x/SPATIAL),cy=Math.floor(b.y/SPATIAL);for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const a=g.get((cx+ox)+','+(cy+oy));if(!a)continue;for(const e of a){if(e.dead)continue;const dx=b.x-e.x,dy=b.y-e.y,rr=b.r+e.r;if(dx*dx+dy*dy<rr*rr)return e}}return null}"
new="function bulletHitsFromGrid(b,g){const cx=Math.floor(b.x/SPATIAL),cy=Math.floor(b.y/SPATIAL);for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const a=g.get((cx+ox)+','+(cy+oy));if(!a)continue;for(const e of a){if(e.dead||(b.hits&&b.hits.includes(e)))continue;const dx=b.x-e.x,dy=b.y-e.y,rr=b.r+e.r;if(dx*dx+dy*dy<rr*rr)return e}}return null}"
if old not in s: raise SystemExit('bullet grid anchor missing')
s=s.replace(old,new,1)

old="if(e){b.dead=true;e.hp-=player.damage;addDamageFx(e,player.damage,'normal');if(e.hp<=0){e.dead=true;onKill(e)}}"
new="if(e){if(b.pierceLeft>0){b.hits.push(e);b.pierceLeft--;if(b.pierceLeft<=0)b.dead=true}else b.dead=true;e.hp-=player.damage;addDamageFx(e,player.damage,b.hits&&b.hits.length?'pierce':'normal');if(e.hp<=0){e.dead=true;onKill(e)}}"
if old not in s: raise SystemExit('bullet hit resolution missing')
s=s.replace(old,new,1)

# damage fx color for piercing
s=s.replace("f.kind==='flash'?'#fde047':f.kind==='arc'?'#67e8f9':'#ffffff'","f.kind==='flash'?'#fde047':f.kind==='arc'?'#67e8f9':f.kind==='pierce'?'#f0abfc':'#ffffff'",1)

# remove skin tint entirely
s=re.sub(r"const mobSkinCache=new WeakMap\(\);function mobSkinFrame\(img,v\)\{.*?\}function drawOgreSkin", "function mobSkinFrame(img,v){return img}function drawOgreSkin", s, count=1, flags=re.S)

# replace aura system with contour-like dual glow passes, no rings/text
old="function tierAura(e){}"
new="function tierAura(e,img,w,h,isBoss){if(!img||isBoss||e.tier<1)return;const pulse=.82+Math.sin(e.t*3.2)*.18,sets=e.tier===1?[['#050816',18],['#3b82f6',12],['#a855f7',7]]:[['#000000',22],['#7f1d1d',14],['#ef4444',8]];ctx.save();ctx.globalCompositeOperation='destination-over';for(const [color,blur] of sets){ctx.save();ctx.globalAlpha=.48*pulse;ctx.shadowColor=color;ctx.shadowBlur=perfMode>=2?Math.max(4,blur*.45):perfMode===1?blur*.7:blur;ctx.drawImage(img,-w/2,-h*.72,w,h);ctx.restore()}ctx.restore()}"
if old not in s: raise SystemExit('tierAura placeholder missing')
s=s.replace(old,new,1)

# drawOgreSkin call aura using actual img dimensions and no tint
old="if(!isBoss)img=mobSkinFrame(img,e.skinVariant||0);const h=isBoss?e.r*3.55:62,ratio=(img.naturalWidth&&img.naturalHeight)?img.naturalWidth/img.naturalHeight:1,w=h*ratio;ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(img,-w/2,-h*.72,w,h);ctx.restore();return true}"
new="if(!isBoss)img=mobSkinFrame(img,e.skinVariant||0);const h=isBoss?e.r*3.55:62,ratio=(img.naturalWidth&&img.naturalHeight)?img.naturalWidth/img.naturalHeight:1,w=h*ratio;if(!isBoss)tierAura(e,img,w,h,false);ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(img,-w/2,-h*.72,w,h);ctx.restore();return true}"
if old not in s: raise SystemExit('drawOgreSkin tail missing')
s=s.replace(old,new,1)

# suppress old sprite-wide tier shadow; bosses keep red aura, normals neutral
old="ctx.shadowColor=isBoss?'#ef4444':e.tier===2?'#ef4444':e.tier===1?'#a855f7':c.c;ctx.shadowBlur=perfMode>=2?(isBoss?8:e.tier>0?5:0):perfMode===1?(isBoss?14:e.tier===2?10:e.tier===1?8:2):(isBoss?24:e.tier===2?22:e.tier===1?18:7);drawOgreSkin(e,isBoss);ctx.shadowBlur=0;"
new="ctx.shadowColor=isBoss?'#ef4444':c.c;ctx.shadowBlur=isBoss?(perfMode>=2?8:perfMode===1?14:24):0;drawOgreSkin(e,isBoss);ctx.shadowBlur=0;"
if old in s:s=s.replace(old,new,1)

p.write_text(s)
idx=Path('index.html');i=idx.read_text();i=i.replace('Caos Live v0.17.4','Caos Live v0.17.5').replace('v0.17.4</span>','v0.17.5</span>').replace('src/game.js?v=0174','src/game.js?v=0175').replace('v0.17.3 · COLISÃO FÍSICA','v0.17.5 · ONDAS + AURAS');idx.write_text(i)
vp=Path('version.json');v=json.loads(vp.read_text());v['version']='0.17.5';v['build']='waves-dual-aura-piercing';vp.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
print('patched v0.17.5')
