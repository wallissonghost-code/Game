from pathlib import Path
import re, json

p=Path('src/game.js')
s=p.read_text()

s=s.replace("const VERSION='0.17.0'","const VERSION='0.17.1'",1)

old_layout=re.compile(r"const weaponLayout=\{\s*down:\{x:0,y:-1,maxW:32,maxH:46\},dr:\{x:9,y:-5,maxW:54,maxH:34\},right:\{x:11,y:-4,maxW:58,maxH:31\},ur:\{x:8,y:-8,maxW:51,maxH:34\},\s*up:\{x:0,y:-13,maxW:29,maxH:48\},ul:\{x:-8,y:-8,maxW:51,maxH:34\},left:\{x:-11,y:-4,maxW:58,maxH:31\},dl:\{x:-9,y:-5,maxW:54,maxH:34\}\s*\};")
new_layout="""const weaponLayout={
      down:{x:0,y:-2,maxW:44,maxH:60,flip:false},dr:{x:15,y:-6,maxW:72,maxH:44,flip:false},right:{x:16,y:-5,maxW:78,maxH:40,flip:true},ur:{x:14,y:-11,maxW:68,maxH:44,flip:false},
      up:{x:0,y:-20,maxW:40,maxH:62,flip:false},ul:{x:-14,y:-11,maxW:68,maxH:44,flip:false},left:{x:-16,y:-5,maxW:78,maxH:40,flip:false},dl:{x:-15,y:-6,maxW:72,maxH:44,flip:false}
    };"""
s,n=old_layout.subn(new_layout,s,count=1)
if n!=1: raise SystemExit(f'weaponLayout replace failed {n}')

old_draw="ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(wi,q.x-ww/2,q.y-wh/2+bob,ww,wh);ctx.restore()"
new_draw="ctx.save();ctx.imageSmoothingEnabled=true;ctx.translate(q.x,q.y+bob);if(q.flip)ctx.scale(-1,1);ctx.drawImage(wi,-ww/2,-wh/2,ww,wh);ctx.restore()"
if old_draw not in s: raise SystemExit('drawWeapon exact string not found')
s=s.replace(old_draw,new_draw,1)

old_muzzle="function muzzleLocal(dir){const m={right:{x:44,y:-3},dr:{x:35,y:22},down:{x:7,y:32},dl:{x:-35,y:22},left:{x:-44,y:-3},ul:{x:-34,y:-26},up:{x:0,y:-44},ur:{x:34,y:-26}};return m[dir]||m.down}"
new_muzzle="function muzzleLocal(dir){const m={right:{x:50,y:-4},dr:{x:42,y:27},down:{x:7,y:38},dl:{x:-42,y:27},left:{x:-50,y:-4},ul:{x:-42,y:-31},up:{x:0,y:-52},ur:{x:42,y:-31}};return m[dir]||m.down}"
if old_muzzle not in s: raise SystemExit('muzzle function not found')
s=s.replace(old_muzzle,new_muzzle,1)

p.write_text(s)

idx=Path('index.html')
i=idx.read_text()
i=i.replace('Caos Live v0.17.0','Caos Live v0.17.1').replace('v0.17.0 · PNG DIRETO 8 DIREÇÕES','v0.17.1 · ARMA AJUSTADA 8 DIREÇÕES').replace('v0.17.0</span>','v0.17.1</span>').replace('src/game.js?v=0170','src/game.js?v=0171')
idx.write_text(i)

vp=Path('version.json')
try: v=json.loads(vp.read_text())
except: v={}
v['version']='0.17.1';v['build']='weapon-fit-8dir'
vp.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
print('patched weapon fit v0.17.1')
