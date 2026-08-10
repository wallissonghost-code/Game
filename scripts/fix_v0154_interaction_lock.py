from pathlib import Path
import re

css=Path('src/styles/game.css')
s=css.read_text()
lock="\n/* iOS/iPad arena interaction lock v0.15.4 */\nhtml,body,.game,#stage,canvas{\n  -webkit-user-select:none!important;user-select:none!important;\n  -webkit-touch-callout:none!important;-webkit-user-drag:none!important;\n  touch-action:none!important;overscroll-behavior:none;\n  outline:none!important;caret-color:transparent!important;\n}\ncanvas{display:block;-webkit-tap-highlight-color:transparent!important;}\ncanvas:focus,canvas:focus-visible,#stage:focus,#stage:focus-visible{outline:none!important;box-shadow:none!important;}\n"
if 'arena interaction lock v0.15.4' not in s:
    s += lock
css.write_text(s)

p=Path('src/game.js')
g=p.read_text()
marker="canvas.onpointerup=canvas.onpointercancel=()=>pointer=null;"
extra="canvas.onpointerup=canvas.onpointercancel=()=>pointer=null;canvas.setAttribute('draggable','false');canvas.tabIndex=-1;for(const ev of['touchstart','touchmove','gesturestart','gesturechange','gestureend']){stage.addEventListener(ev,e=>e.preventDefault(),{passive:false})}"
if marker not in g:
    raise SystemExit('pointer marker missing')
g=g.replace(marker,extra,1)
g=g.replace("const VERSION='0.15.3'","const VERSION='0.15.4'",1)
p.write_text(g)

idx=Path('index.html')
h=idx.read_text()
h=h.replace('Caos Live v0.15.3','Caos Live v0.15.4')
h=h.replace('v0.15.3 · PRELOAD DE SKIN','v0.15.4 · TOUCH LOCK')
h=h.replace('v0.15.3</span>','v0.15.4</span>')
h=re.sub(r'src/styles/game\.css\?v=\d+','src/styles/game.css?v=0154',h,count=1)
h=re.sub(r'src/game\.js\?v=\d+','src/game.js?v=0154',h,count=1)
idx.write_text(h)
Path('version.json').write_text('{\n  "version": "0.15.4",\n  "build": "ios-interaction-lock"\n}\n')
