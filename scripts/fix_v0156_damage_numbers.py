from pathlib import Path
import re

p=Path('src/game.js')
s=p.read_text()

# Version
if "const VERSION='0.15.5'" not in s:
    raise SystemExit('version marker missing')
s=s.replace("const VERSION='0.15.5'","const VERSION='0.15.6'",1)

# Damage FX state
needle="aimTarget=0;const skillLv="
repl="aimTarget=0,damageFx=[];const skillLv="
if needle not in s:
    raise SystemExit('state marker missing')
s=s.replace(needle,repl,1)

# Helper before onKill
needle="function onKill(e){"
helper="function addDamageFx(e,amount,kind='normal'){if(!e||!Number.isFinite(amount)||amount<=0)return;const now=performance.now(),last=damageFx.length?damageFx[damageFx.length-1]:null;if(last&&last.e===e&&now-last.at<115&&last.kind===kind){last.amount+=amount;last.at=now;return}damageFx.push({e,amount,kind,at:now,x:e.x,y:e.y});if(damageFx.length>48)damageFx.splice(0,damageFx.length-48)}function drawDamageFx(){const now=performance.now();damageFx=damageFx.filter(f=>now-f.at<720);for(const f of damageFx){const age=(now-f.at)/720,p=world(f.e&&!f.e.dead?f.e.x:f.x,f.e&&!f.e.dead?f.e.y:f.y),rise=10+age*24,alpha=Math.max(0,1-age);ctx.save();ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=(f.kind==='flash'||f.kind==='arc'?'900 12px':'900 11px')+' -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';ctx.lineWidth=3;ctx.strokeStyle='rgba(3,7,18,.92)';ctx.fillStyle=f.kind==='flash'?'#fde047':f.kind==='arc'?'#67e8f9':'#ffffff';const txt='-'+(Math.round(f.amount*10)/10);ctx.strokeText(txt,p.x,p.y-rise);ctx.fillText(txt,p.x,p.y-rise);ctx.restore()}}"
if needle not in s:
    raise SystemExit('onKill marker missing')
s=s.replace(needle,helper+needle,1)

# Reset FX
needle="enemies=[];bullets=[];enemySpeed=1;"
if needle not in s:
    raise SystemExit('reset marker missing')
s=s.replace(needle,"enemies=[];bullets=[];damageFx=[];enemySpeed=1;",1)

# Flash damage
old="if(along>0&&along<520&&side<26+e.r)e.hp-=player.flashDamage"
new="if(along>0&&along<520&&side<26+e.r){e.hp-=player.flashDamage;addDamageFx(e,player.flashDamage,'flash')}"
if old not in s:
    raise SystemExit('flash damage marker missing')
s=s.replace(old,new,1)

# Arc damage
old="for(const e of hit){e.hp-=damage[lv];if(e.hp<=0&&!e.dead){e.dead=true;onKill(e)}}"
new="for(const e of hit){e.hp-=damage[lv];addDamageFx(e,damage[lv],'arc');if(e.hp<=0&&!e.dead){e.dead=true;onKill(e)}}"
if old not in s:
    raise SystemExit('arc damage marker missing')
s=s.replace(old,new,1)

# Bullet damage
old="if(e){b.dead=true;e.hp-=player.damage;if(e.hp<=0){e.dead=true;onKill(e)}}"
new="if(e){b.dead=true;e.hp-=player.damage;addDamageFx(e,player.damage,'normal');if(e.hp<=0){e.dead=true;onKill(e)}}"
if old not in s:
    raise SystemExit('bullet damage marker missing')
s=s.replace(old,new,1)

# Draw damage numbers after enemy labels and before player
needle="drawPlayer();drawPhoenixShield();"
if needle not in s:
    raise SystemExit('draw marker missing')
s=s.replace(needle,"drawDamageFx();drawPlayer();drawPhoenixShield();",1)

p.write_text(s)

idx=Path('index.html')
h=idx.read_text()
h=h.replace('Caos Live v0.15.5','Caos Live v0.15.6')
h=h.replace('v0.15.5 · TOUCH FIX','v0.15.6 · DANO VISÍVEL')
h=h.replace('v0.15.5</span>','v0.15.6</span>')
h=re.sub(r'src/game\.js\?v=\d+','src/game.js?v=0156',h,count=1)
idx.write_text(h)
Path('version.json').write_text('{\n  "version": "0.15.6",\n  "build": "damage-numbers"\n}\n')
