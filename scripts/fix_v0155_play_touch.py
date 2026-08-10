from pathlib import Path
import re

p=Path('src/game.js')
s=p.read_text()
old="for(const ev of['touchstart','touchmove','gesturestart','gesturechange','gestureend']){stage.addEventListener(ev,e=>e.preventDefault(),{passive:false})}"
new="for(const ev of['touchstart','touchmove','gesturestart','gesturechange','gestureend']){canvas.addEventListener(ev,e=>e.preventDefault(),{passive:false})}"
if old not in s:
    raise SystemExit('stage touch lock marker missing')
s=s.replace(old,new,1)
s=s.replace("const VERSION='0.15.4'","const VERSION='0.15.5'",1)
p.write_text(s)

css=Path('src/styles/game.css')
c=css.read_text()
release="\n/* UI touch release v0.15.5 */\nbutton,.btn,.startBtnPremium,.overlay,.card,.startCard{touch-action:manipulation!important;}\nbutton,.btn,.startBtnPremium{pointer-events:auto!important;-webkit-user-select:none!important;user-select:none!important;}\n"
if 'UI touch release v0.15.5' not in c:
    c += release
css.write_text(c)

idx=Path('index.html')
h=idx.read_text()
h=h.replace('Caos Live v0.15.4','Caos Live v0.15.5')
h=h.replace('v0.15.4 · TOUCH LOCK','v0.15.5 · TOUCH FIX')
h=h.replace('v0.15.4</span>','v0.15.5</span>')
h=re.sub(r'src/styles/game\.css\?v=\d+','src/styles/game.css?v=0155',h,count=1)
h=re.sub(r'src/game\.js\?v=\d+','src/game.js?v=0155',h,count=1)
idx.write_text(h)
Path('version.json').write_text('{\n  "version": "0.15.5",\n  "build": "play-touch-fix"\n}\n')
