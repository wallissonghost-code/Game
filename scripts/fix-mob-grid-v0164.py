from pathlib import Path
import re

p=Path('src/game.js')
s=p.read_text(encoding='utf-8')
s=s.replace("const VERSION='0.16.3'","const VERSION='0.16.4'",1)

old="function mapDirect32(arr,target){if(arr.length>=32){target.down=arr.slice(0,8);target.up=arr.slice(8,16);target.left=arr.slice(16,24);target.right=arr.slice(24,32)}else if(arr.length>=16){target.down=arr.slice(0,4);target.up=arr.slice(4,8);target.left=arr.slice(8,12);target.right=arr.slice(12,16)}return target.up.length>0&&target.down.length>0&&target.right.length>0&&target.left.length>0}"
new="function mapDirect32(arr,target){const rows=Math.floor(arr.length/4);if(rows>=1){const up=[],down=[],side=[];for(let row=0;row<rows;row++){const i=row*4;if(arr[i])up.push(arr[i]);if(arr[i+1])down.push(arr[i+1]);if(arr[i+2])side.push(arr[i+2]);if(arr[i+3])side.push(arr[i+3])}target.up=up;target.down=down;target.right=side;target.left=side}return target.up.length>0&&target.down.length>0&&target.right.length>0&&target.left.length>0}"
if old not in s:
    raise SystemExit('mapDirect32 atual nao encontrado')
s=s.replace(old,new,1)

# Cache tag dos PNGs para forcar iOS/Safari a recarregar a nova leitura
s=s.replace("cacheTag='0161'","cacheTag='0164'",1)
p.write_text(s,encoding='utf-8')

Path('version.json').write_text('{\n  "version": "0.16.4",\n  "build": "mob-grid-movement-restored"\n}\n',encoding='utf-8')

idx=Path('index.html')
h=idx.read_text(encoding='utf-8')
h=h.replace('v0.16.3','v0.16.4')
h=re.sub(r'src/game\.js\?v=\d+', 'src/game.js?v=0164', h, count=1)
idx.write_text(h,encoding='utf-8')
