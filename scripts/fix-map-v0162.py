from pathlib import Path
import re

p=Path('src/game.js')
s=p.read_text(encoding='utf-8')
s=s.replace("const VERSION='0.16.1'","const VERSION='0.16.2'",1)

old="function mapDirect32(arr,target){if(arr.length>=32){target.up=arr.slice(0,8);target.down=arr.slice(8,16);target.right=arr.slice(16,24);target.left=arr.slice(24,32)}else if(arr.length>=16){target.up=arr.slice(0,4);target.down=arr.slice(4,8);target.right=arr.slice(8,12);target.left=arr.slice(12,16)}return target.up.length>0&&target.down.length>0&&target.right.length>0&&target.left.length>0}"
new="function mapDirect32(arr,target){if(arr.length>=32){target.down=arr.slice(0,8);target.up=arr.slice(8,16);target.left=arr.slice(16,24);target.right=arr.slice(24,32)}else if(arr.length>=16){target.down=arr.slice(0,4);target.up=arr.slice(4,8);target.left=arr.slice(8,12);target.right=arr.slice(12,16)}return target.up.length>0&&target.down.length>0&&target.right.length>0&&target.left.length>0}"
if old not in s: raise SystemExit('mapDirect32 marker not found')
s=s.replace(old,new,1)

oldp="function mapPlayer16(arr,target){if(arr.length>=16){target.up=arr.slice(0,4);target.down=arr.slice(4,8);target.right=arr.slice(8,12);target.left=arr.slice(12,16)}else if(arr.length>=4){target.up=[arr[0]];target.down=[arr[1]||arr[0]];target.right=[arr[2]||arr[0]];target.left=[arr[3]||arr[0]]}}"
newp="function mapPlayer16(arr,target){if(arr.length>=16){target.down=arr.slice(0,4);target.up=arr.slice(4,8);target.left=arr.slice(8,12);target.right=arr.slice(12,16)}else if(arr.length>=4){target.down=[arr[0]];target.up=[arr[1]||arr[0]];target.left=[arr[2]||arr[0]];target.right=[arr[3]||arr[0]]}}"
if oldp not in s: raise SystemExit('mapPlayer16 marker not found')
s=s.replace(oldp,newp,1)
p.write_text(s,encoding='utf-8')

Path('version.json').write_text('{\n  "version": "0.16.2",\n  "build": "frame-direction-fix"\n}\n',encoding='utf-8')

idx=Path('index.html')
h=idx.read_text(encoding='utf-8').replace('v0.16.1','v0.16.2')
h=re.sub(r'src/game\.js\?v=\d+', 'src/game.js?v=0162', h, count=1)
idx.write_text(h,encoding='utf-8')

check=Path('scripts/check-game.mjs')
check.write_text("""import fs from 'node:fs';
const fail=m=>{console.error('FAIL:',m);process.exitCode=1};
const ok=m=>console.log('OK:',m);
const read=p=>fs.readFileSync(p,'utf8');
const gameHtml=read('index.html'),game=read('src/game.js');
const version=JSON.parse(read('version.json')).version;
if(!game.includes(`const VERSION='${version}'`)) fail('VERSION do jogo divergente'); else ok('versao sincronizada '+version);
if(!gameHtml.includes(`v${version}`)) fail('HTML sem versao atual'); else ok('HTML versionado');
if(!gameHtml.includes('src/game.js?v=')) fail('game.js sem cache tag'); else ok('game.js modularizado');
if(!game.includes("startButton.onclick=()=>reset()")) fail('handler do PLAY ausente'); else ok('handler do PLAY');
for(let i=1;i<=32;i++){const n=String(i).padStart(3,'0');for(const dir of ['assets/player','assets/mobs']){const f=`${dir}/frame_${n}.png`;if(!fs.existsSync(f))fail('asset ausente '+f)}}
for(const f of ['assets/bosses/Ogroboss1.zip','assets/bosses/Ogro2.0Boss.zip','assets/weapons/Arma3.zip','assets/weapons/Municao.zip']) fs.existsSync(f)?ok(f):fail('asset ausente '+f);
const cloud=read('cloud/connector-server.mjs');
if(!cloud.includes('function patchGameHtml(html){return patchSharedVersion(html)}')) fail('Cloud pode mutar gameplay'); else ok('Cloud somente sincroniza versao');
if(process.exitCode) process.exit(process.exitCode);
""",encoding='utf-8')
