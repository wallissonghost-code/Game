import fs from 'node:fs';
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
