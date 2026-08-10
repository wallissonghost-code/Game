from pathlib import Path
import re
p=Path('src/game.js')
s=p.read_text(encoding='utf-8')
s=s.replace("const VERSION='0.16.7'","const VERSION='0.16.8'",1)
# Expand player frame packs to 8 directions.
s=s.replace("const playerBaseFrames={up:[],down:[],right:[],left:[]},playerArmedFrames={up:[],down:[],right:[],left:[]}","const playerBaseFrames={up:[],ur:[],right:[],dr:[],down:[],dl:[],left:[],ul:[]},playerArmedFrames={up:[],ur:[],right:[],dr:[],down:[],dl:[],left:[],ul:[]}",1)
old="function mapPlayer16(arr,target){if(arr.length>=16){target.down=arr.slice(0,4);target.up=arr.slice(4,8);target.left=arr.slice(8,12);target.right=arr.slice(12,16)}else if(arr.length>=4){target.down=[arr[0]];target.up=[arr[1]||arr[0]];target.left=[arr[2]||arr[0]];target.right=[arr[3]||arr[0]]}}"
new="function mapPlayer32(arr,target){if(arr.length<32)return false;target.down=arr.slice(0,4);target.dr=arr.slice(4,8);target.right=arr.slice(8,12);target.ur=arr.slice(12,16);target.up=arr.slice(16,20);target.ul=arr.slice(20,24);target.left=arr.slice(24,28);target.dl=arr.slice(28,32);return true}"
if old not in s: raise SystemExit('mapPlayer16 marker missing')
s=s.replace(old,new,1)
oldload="try{const all=await loadDirectPngSequence('./assets/player',32);const base=all.slice(0,16),armed=all.slice(16,32);mapPlayer16(base,playerBaseFrames);mapPlayer16(armed,playerArmedFrames);playerV2Ready=playerBaseFrames.down.length>0&&playerArmedFrames.down.length>0;console.log('PLAYER PNG READY',playerV2Ready,{base:base.length,armed:armed.length})}"
newload="try{const all=await loadDirectPngSequence('./assets/player',32);mapPlayer32(all,playerBaseFrames);mapPlayer32(all,playerArmedFrames);playerV2Ready=playerBaseFrames.down.length>0&&playerBaseFrames.up.length>0&&playerBaseFrames.left.length>0&&playerBaseFrames.right.length>0;console.log('PLAYER PNG READY 8DIR',playerV2Ready,{frames:all.length})}"
if oldload not in s: raise SystemExit('player loader marker missing')
s=s.replace(oldload,newload,1)
oldface="function playerFacing(a){const x=Math.cos(a),y=Math.sin(a);return Math.abs(x)>Math.abs(y)?(x>0?'right':'left'):(y>0?'down':'up')}"
newface="function playerFacing(a){const oct=Math.round((((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2))/(Math.PI/4))%8;return ['right','dr','down','dl','left','ul','up','ur'][oct]}"
if oldface not in s: raise SystemExit('playerFacing marker missing')
s=s.replace(oldface,newface,1)
# Weapon still has 4 dirs: diagonals use nearest cardinal until weapon art is replaced.
oldwd="const wd=dir==='left'?'right':dir==='right'?'left':dir,wa=playerWeaponFrames[wd]?.length?playerWeaponFrames[wd]:playerWeaponFrames.down"
newwd="const cardinal=({dr:'down',dl:'down',ur:'up',ul:'up'})[dir]||dir,wd=cardinal==='left'?'right':cardinal==='right'?'left':cardinal,wa=playerWeaponFrames[wd]?.length?playerWeaponFrames[wd]:playerWeaponFrames.down"
if oldwd in s: s=s.replace(oldwd,newwd,1)
# Regular mobs use a fixed visual height; gameplay radius/hitbox remains untouched.
oldh="const tierScale=e.tier===2?1.10:e.tier===1?1.05:1,h=e.r*(isBoss?3.55:3.35)*tierScale"
newh="const tierScale=e.tier===2?1.10:e.tier===1?1.05:1,h=(isBoss?e.r*3.55:62)*tierScale"
if oldh not in s: raise SystemExit('mob visual scale marker missing')
s=s.replace(oldh,newh,1)
s=s.replace("cacheTag='0167'","cacheTag='0168'",1)
p.write_text(s,encoding='utf-8')
Path('version.json').write_text('{\n  "version": "0.16.8",\n  "build": "player-8dir-fixed-mob-visual-size"\n}\n',encoding='utf-8')
idx=Path('index.html');h=idx.read_text(encoding='utf-8').replace('v0.16.7','v0.16.8');h=re.sub(r'src/game\\.js\\?v=\\d+','src/game.js?v=0168',h,count=1);idx.write_text(h,encoding='utf-8')
