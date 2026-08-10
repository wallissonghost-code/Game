from pathlib import Path
import re

p=Path('src/game.js')
s=p.read_text(encoding='utf-8')
s=s.replace("const VERSION='0.16.5'","const VERSION='0.16.6'",1)

old="function mapDirect32(arr,target){const rows=Math.floor(arr.length/4);if(rows>=1){const up=[],down=[],side=[];for(let row=0;row<rows;row++){const i=row*4;if(arr[i])up.push(arr[i]);if(arr[i+1])down.push(arr[i+1]);if(arr[i+2])side.push(arr[i+2]);if(arr[i+3])side.push(arr[i+3])}target.up=up;target.down=down;target.right=side;target.left=side}return target.up.length>0&&target.down.length>0&&target.right.length>0&&target.left.length>0}"
new="function mapDirect32(arr,target){const rows=Math.floor(arr.length/4);if(rows>=1){const up=[],down=[],right=[],left=[];for(let row=0;row<rows;row++){const i=row*4;if(arr[i])up.push(arr[i]);if(arr[i+1])down.push(arr[i+1]);if(arr[i+2])right.push(arr[i+2]);if(arr[i+3])left.push(arr[i+3])}target.up=up;target.down=down;target.right=right;target.left=left}return target.up.length>0&&target.down.length>0&&target.right.length>0&&target.left.length>0}"
if old not in s: raise SystemExit('mapDirect32 marker missing')
s=s.replace(old,new,1)

# Common mobs now have a real left sequence, so do not mirror it.
old_draw="if(!isBoss&&dir==='left'){ctx.scale(-1,1);ctx.drawImage(img,-w/2,-h*.72,w,h)}else ctx.drawImage(img,-w/2,-h*.72,w,h);"
new_draw="ctx.drawImage(img,-w/2,-h*.72,w,h);"
if old_draw not in s: raise SystemExit('left mirror marker missing')
s=s.replace(old_draw,new_draw,1)

s=s.replace("cacheTag='0164'","cacheTag='0166'",1)
p.write_text(s,encoding='utf-8')

Path('version.json').write_text('{\n  "version": "0.16.6",\n  "build": "mob-four-column-exact-mapping"\n}\n',encoding='utf-8')
idx=Path('index.html')
h=idx.read_text(encoding='utf-8').replace('v0.16.5','v0.16.6')
h=re.sub(r'src/game\.js\?v=\d+', 'src/game.js?v=0166', h, count=1)
idx.write_text(h,encoding='utf-8')
