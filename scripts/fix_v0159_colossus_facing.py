from pathlib import Path
import re

p=Path('src/game.js')
s=p.read_text()

if "const VERSION='0.15.8'" not in s:
    raise SystemExit('version marker missing')
s=s.replace("const VERSION='0.15.8'","const VERSION='0.15.9'",1)

old="function drawOgreSkin(e,isBoss){const pack=isBoss?(e.type==='colossus'?bossColossusFrames:e.type==='voidlord'?bossVoidFrames:bossOgreFrames):ogreFrames,ready=isBoss?(e.type==='colossus'?bossColossusReady:e.type==='voidlord'?bossVoidReady:bossOgreReady):ogreReady,dir=e.facing||'down',arr=pack[dir]||pack.down||[];"
new="function drawOgreSkin(e,isBoss){const pack=isBoss?(e.type==='colossus'?bossColossusFrames:e.type==='voidlord'?bossVoidFrames:bossOgreFrames):ogreFrames,ready=isBoss?(e.type==='colossus'?bossColossusReady:e.type==='voidlord'?bossVoidReady:bossOgreReady):ogreReady;let dir=e.facing||'down';if(isBoss&&e.type==='colossus'){dir=dir==='up'?'down':dir==='down'?'up':dir==='left'?'right':dir==='right'?'left':dir}const arr=pack[dir]||pack.down||[];"
if old not in s:
    raise SystemExit('colossus renderer marker missing')
s=s.replace(old,new,1)

p.write_text(s)

idx=Path('index.html')
h=idx.read_text()
h=h.replace('Caos Live v0.15.8','Caos Live v0.15.9')
h=h.replace('v0.15.8 · 2 BOSS SKINS','v0.15.9 · BOSS FACING FIX')
h=h.replace('v0.15.8</span>','v0.15.9</span>')
h=re.sub(r'src/game\\.js\\?v=\\d+','src/game.js?v=0159',h,count=1)
idx.write_text(h)
Path('version.json').write_text('{\n  "version": "0.15.9",\n  "build": "colossus-facing-fix"\n}\n')
