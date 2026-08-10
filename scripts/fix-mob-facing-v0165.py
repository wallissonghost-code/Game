from pathlib import Path
import re

p=Path('src/game.js')
s=p.read_text(encoding='utf-8')
s=s.replace("const VERSION='0.16.4'","const VERSION='0.16.5'",1)

anchor="function playerFacing(a){const x=Math.cos(a),y=Math.sin(a);return Math.abs(x)>Math.abs(y)?(x>0?'right':'left'):(y>0?'down':'up')}"
helper="function stableEnemyFacing(e,vx,vy){const ax=Math.abs(vx),ay=Math.abs(vy);if(ax<.001&&ay<.001)return e.facing||'down';const candidate=ax>ay?(vx>0?'right':'left'):(vy>0?'down':'up'),now=performance.now();if(!e.facing){e.facing=candidate;e.faceCandidate='';e.faceCandidateAt=0;return e.facing}if(candidate===e.facing){e.faceCandidate='';e.faceCandidateAt=0;return e.facing}const major=Math.max(ax,ay),minor=Math.min(ax,ay),dominance=major/Math.max(.001,minor);if(dominance<1.32)return e.facing;if(e.faceCandidate!==candidate){e.faceCandidate=candidate;e.faceCandidateAt=now;return e.facing}if(now-(e.faceCandidateAt||0)<170)return e.facing;e.facing=candidate;e.faceCandidate='';e.faceCandidateAt=0;return e.facing}"
if anchor not in s: raise SystemExit('playerFacing anchor missing')
if 'function stableEnemyFacing(' not in s:s=s.replace(anchor,anchor+'\n'+helper,1)

old1="const fx=dxp,fy=dyp;e.facing=Math.abs(fx)>Math.abs(fy)?(fx>0?'right':'left'):(fy>0?'down':'up')"
new1="const fx=dxp,fy=dyp;stableEnemyFacing(e,fx,fy)"
if old1 not in s: raise SystemExit('near facing marker missing')
s=s.replace(old1,new1,1)
old2="e.facing=Math.abs(e.mvx)>Math.abs(e.mvy)?(e.mvx>0?'right':'left'):(e.mvy>0?'down':'up')"
new2="stableEnemyFacing(e,e.mvx,e.mvy)"
if old2 not in s: raise SystemExit('move facing marker missing')
s=s.replace(old2,new2,1)

# stop animation switching wildly while enemy is standing in attack range
s=s.replace("let img=arr[Math.floor(e.t/(isBoss?.15:.135))%arr.length]||pack.down[0]","let img=arr[(e.speedMul===0?0:Math.floor(e.t/(isBoss?.15:.135)))%arr.length]||pack.down[0]",1)

p.write_text(s,encoding='utf-8')
Path('version.json').write_text('{\n  "version": "0.16.5",\n  "build": "stable-mob-facing"\n}\n',encoding='utf-8')
idx=Path('index.html')
h=idx.read_text(encoding='utf-8').replace('v0.16.4','v0.16.5')
h=re.sub(r'src/game\\.js\\?v=\\d+', 'src/game.js?v=0165', h, count=1)
idx.write_text(h,encoding='utf-8')
