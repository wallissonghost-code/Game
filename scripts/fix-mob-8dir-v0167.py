from pathlib import Path
import re

p=Path('src/game.js')
s=p.read_text(encoding='utf-8')
s=s.replace("const VERSION='0.16.6'","const VERSION='0.16.7'",1)

old="function mapDirect32(arr,target){const rows=Math.floor(arr.length/4);if(rows>=1){const up=[],down=[],right=[],left=[];for(let row=0;row<rows;row++){const i=row*4;if(arr[i])up.push(arr[i]);if(arr[i+1])down.push(arr[i+1]);if(arr[i+2])right.push(arr[i+2]);if(arr[i+3])left.push(arr[i+3])}target.up=up;target.down=down;target.right=right;target.left=left}return target.up.length>0&&target.down.length>0&&target.right.length>0&&target.left.length>0}"
new="function mapDirect32(arr,target){if(arr.length<32)return false;target.down=[arr[0],arr[8],arr[16],arr[24]];target.dr=[arr[1],arr[9],arr[17],arr[25]];target.right=[arr[2],arr[10],arr[18],arr[26]];target.ur=[arr[3],arr[11],arr[19],arr[27]];target.up=[arr[4],arr[12],arr[20],arr[28]];target.ul=[arr[5],arr[13],arr[21],arr[29]];target.left=[arr[6],arr[14],arr[22],arr[30]];target.dl=[arr[7],arr[15],arr[23],arr[31]];return true}"
if old not in s: raise SystemExit('mapDirect32 current marker not found')
s=s.replace(old,new,1)

anchor="function stableEnemyFacing(e,vx,vy){"
pos=s.find(anchor)
if pos<0: raise SystemExit('stableEnemyFacing missing')
# inject helper immediately before existing 4-way helper
helper="function stableEnemyFacing8(e,vx,vy){const mag=Math.hypot(vx,vy);if(mag<.001)return e.facing||'down';const a=Math.atan2(vy,vx),oct=Math.round(a/(Math.PI/4)),dirs=['right','dr','down','dl','left','ul','up','ur'];const candidate=dirs[(oct+8)%8],now=performance.now();if(!e.facing){e.facing=candidate;e.faceCandidate='';e.faceCandidateAt=0;return e.facing}if(candidate===e.facing){e.faceCandidate='';e.faceCandidateAt=0;return e.facing}if(e.faceCandidate!==candidate){e.faceCandidate=candidate;e.faceCandidateAt=now;return e.facing}if(now-(e.faceCandidateAt||0)<120)return e.facing;e.facing=candidate;e.faceCandidate='';e.faceCandidateAt=0;return e.facing}\n"
if 'function stableEnemyFacing8(' not in s:
    s=s[:pos]+helper+s[pos:]

s=s.replace("const fx=dxp,fy=dyp;stableEnemyFacing(e,fx,fy)","const fx=dxp,fy=dyp;(types[e.type]?.boss?stableEnemyFacing:stableEnemyFacing8)(e,fx,fy)",1)
s=s.replace("stableEnemyFacing(e,e.mvx,e.mvy)","(types[e.type]?.boss?stableEnemyFacing:stableEnemyFacing8)(e,e.mvx,e.mvy)",1)

# The common mob now has genuine left frames; never mirror it.
s=s.replace("if(!isBoss&&dir==='left'){ctx.scale(-1,1);ctx.drawImage(img,-w/2,-h*.72,w,h)}else ctx.drawImage(img,-w/2,-h*.72,w,h);","ctx.drawImage(img,-w/2,-h*.72,w,h);",1)
s=s.replace("cacheTag='0166'","cacheTag='0167'",1)

p.write_text(s,encoding='utf-8')
Path('version.json').write_text('{\n  "version": "0.16.7",\n  "build": "mob-8-direction-real-frames"\n}\n',encoding='utf-8')
idx=Path('index.html')
h=idx.read_text(encoding='utf-8').replace('v0.16.6','v0.16.7')
h=re.sub(r'src/game\.js\?v=\d+', 'src/game.js?v=0167', h, count=1)
idx.write_text(h,encoding='utf-8')
