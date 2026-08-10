from pathlib import Path
import re

p=Path('src/game.js')
s=p.read_text()

# Add start button preload state immediately after player V2 state declaration.
needle="let ammoFrames=[],playerV2Ready=false,weaponV2Ready=false,backV2Ready=false,ammoReady=false;"
repl=needle+"\nlet playerLoadFinished=false;function syncStartButton(){const b=$('startBtn');if(!b)return;if(playerV2Ready){b.disabled=false;b.textContent='ENTRAR NA ARENA';b.style.opacity='1'}else{b.disabled=true;b.textContent=playerLoadFinished?'SKIN DO PLAYER INDISPONÍVEL':'CARREGANDO PERSONAGEM...';b.style.opacity='.58'}}"
if needle not in s: raise SystemExit('player state marker missing')
s=s.replace(needle,repl,1)

# Mark player loader complete and synchronize start button in finally.
old="try{const [base,armed]=await Promise.all([zipImgs('./assets/Oficial1.zip'),zipImgs('./assets/Oficial2.zip')]);mapPlayer16(base,playerBaseFrames);mapPlayer16(armed,playerArmedFrames);playerV2Ready=playerBaseFrames.down.length>0&&playerArmedFrames.down.length>0;console.log('PLAYER BODY READY',playerV2Ready)}catch(e){console.error('PLAYER BODY ERROR',e)}"
new="try{const [base,armed]=await Promise.all([zipImgs('./assets/Oficial1.zip'),zipImgs('./assets/Oficial2.zip')]);mapPlayer16(base,playerBaseFrames);mapPlayer16(armed,playerArmedFrames);playerV2Ready=playerBaseFrames.down.length>0&&playerArmedFrames.down.length>0;console.log('PLAYER BODY READY',playerV2Ready)}catch(e){console.error('PLAYER BODY ERROR',e)}finally{playerLoadFinished=true;syncStartButton()}"
if old not in s: raise SystemExit('player loader block missing')
s=s.replace(old,new,1)

# Never render placeholder player. If V2 is not ready, only keep shadow hidden too.
old_fallback="  ctx.fillStyle='#374151';ctx.beginPath();ctx.roundRect(-13,-19,26,38,8);ctx.fill();\n  ctx.fillStyle='#556b2f';ctx.beginPath();ctx.roundRect(-10,-15,20,26,6);ctx.fill();\n  ctx.restore();\n}function drawPhoenixShield"
new_fallback="  ctx.restore();return;\n}function drawPhoenixShield"
if old_fallback not in s: raise SystemExit('placeholder fallback block missing')
s=s.replace(old_fallback,new_fallback,1)

# Prevent reset if the real player skin is not ready.
old_reset="function reset(){cancelAnimationFrame(raf);"
new_reset="function reset(){if(!playerV2Ready){syncStartButton();return}cancelAnimationFrame(raf);"
if old_reset not in s: raise SystemExit('reset marker missing')
s=s.replace(old_reset,new_reset,1)

# Initialize button state as soon as handlers are attached.
old_handlers="$ ('startBtn')"
# exact code has no space; handle directly
hmarker="$('startBtn').onclick=reset;"
if hmarker not in s: raise SystemExit('start handler missing')
s=s.replace(hmarker,"syncStartButton();$('startBtn').onclick=reset;",1)

s=s.replace("const VERSION='0.15.2'","const VERSION='0.15.3'",1)
p.write_text(s)

idx=Path('index.html')
h=idx.read_text()
h=h.replace('Caos Live v0.15.2','Caos Live v0.15.3')
h=h.replace('v0.15.2 · SKINS + IA ESTÁVEL','v0.15.3 · PRELOAD DE SKIN')
h=h.replace('v0.15.2</span>','v0.15.3</span>')
h=re.sub(r'src/game\.js\?v=\d+','src/game.js?v=0153',h,count=1)
idx.write_text(h)
Path('version.json').write_text('{\n  "version": "0.15.3",\n  "build": "player-preload"\n}\n')
