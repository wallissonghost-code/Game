from pathlib import Path
import re

p=Path('src/game.js')
s=p.read_text()

if "const VERSION='0.15.6'" not in s:
    raise SystemExit('version marker missing')
s=s.replace("const VERSION='0.15.6'","const VERSION='0.15.7'",1)

old="if((perfMode<2||isBoss||e.tier>0)&&(e.hp<e.max||isBoss||e.tier>0)){ctx.fillStyle='#17070d';ctx.fillRect(-barW/2,barY,barW,6);ctx.fillStyle=isBoss?'#f59e0b':e.tier===2?'#ef4444':e.tier===1?'#a855f7':'#fb7185';ctx.fillRect(-barW/2,barY,barW*(e.hp/e.max),6)}"
new="if(e.hp<e.max||isBoss||e.tier>0){ctx.fillStyle='#17070d';ctx.fillRect(-barW/2,barY,barW,6);ctx.fillStyle=isBoss?'#f59e0b':e.tier===2?'#ef4444':e.tier===1?'#a855f7':'#fb7185';ctx.fillRect(-barW/2,barY,barW*Math.max(0,e.hp/e.max),6)}"
if old not in s:
    raise SystemExit('health bar marker missing')
s=s.replace(old,new,1)

p.write_text(s)

idx=Path('index.html')
h=idx.read_text()
h=h.replace('Caos Live v0.15.6','Caos Live v0.15.7')
h=h.replace('v0.15.6 · DANO VISÍVEL','v0.15.7 · BARRA DE VIDA')
h=h.replace('v0.15.6</span>','v0.15.7</span>')
h=re.sub(r'src/game\.js\?v=\d+','src/game.js?v=0157',h,count=1)
idx.write_text(h)
Path('version.json').write_text('{\n  "version": "0.15.7",\n  "build": "enemy-health-bars"\n}\n')
