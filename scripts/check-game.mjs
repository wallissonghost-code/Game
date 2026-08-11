import fs from 'node:fs';
const fail=m=>{console.error('FAIL:',m);process.exitCode=1};
const ok=m=>console.log('OK:',m);
const read=p=>fs.readFileSync(p,'utf8');
const gameHtml=read('index.html'),panelHtml=read('painel.html'),game=read('src/game.js'),panel=read('src/panel.js');
const version=JSON.parse(read('version.json')).version;
if(!game.includes(`const VERSION='${version}'`)) fail('VERSION do jogo divergente'); else ok('versao sincronizada '+version);
if(!gameHtml.includes(`v${version}`)) fail('HTML do jogo sem versao atual'); else ok('HTML do jogo versionado');
if(!panelHtml.includes(`v${version}`)) fail('Painel sem versao atual'); else ok('painel versionado');
if(!gameHtml.includes('src/game.js?v=01710')) fail('cache tag do game.js divergente'); else ok('cache tag game.js');
if(!panelHtml.includes('src/panel.js?v=01710')) fail('cache tag do panel.js divergente'); else ok('cache tag panel.js');
if(!game.includes("startButton.onclick=()=>reset()")) fail('handler do PLAY ausente'); else ok('handler do PLAY');
if(!game.includes("target.up=ordered.slice(0,4);target.down=ordered.slice(4,8);target.left=ordered.slice(8,12);target.right=ordered.slice(12,16)")) fail('mapa 16-frame do Colosso divergente'); else ok('Colosso 01-04 UP, 05-08 DOWN, 09-12 LEFT, 13-16 RIGHT');
if(game.includes("if(e.type==='colossus'){if(dir==='up')dir='down';else if(dir==='down')dir='up'}")) fail('inversao dupla UP/DOWN voltou'); else ok('sem inversao dupla no render');
if(!game.includes('damage:2,armorReduction:0')) fail('reset da Armadura ausente'); else ok('reset de Armadura');
for(let i=1;i<=32;i++){
  const n=String(i).padStart(3,'0');
  for(const dir of ['assets/player','assets/mobs','assets/weapons']){
    const f=`${dir}/frame_${n}.png`; if(!fs.existsSync(f)) fail('asset ausente '+f);
  }
  const armed=`assets/player-armed/Posearma${i}.png`; if(!fs.existsSync(armed)) fail('asset ausente '+armed);
}
for(const f of ['assets/bosses/Ogroboss1.zip','assets/bosses/Ogro2.0Boss.zip']) fs.existsSync(f)?ok(f):fail('asset ausente '+f);
const required=['room','connect','status','net','cloudConnect','tiktokConnect','liveEnabled','health','level','xp','fpsState','mobs','kills','elapsed','wave','score','eliteCount','corruptedCount','bossCount','gameState','autoState','perfState','autoModeToggle','hordeModeToggle','autoFireModeToggle','fpsModeToggle','skillTestSelect','skillTestLevel','skillApply','skillAll','skillReset','skillMax','mobTier','mobType','mobAmount','spawn','spawnElite','spawnCorrupted','log'];
for(const id of required) if(!panelHtml.includes(`id="${id}"`)) fail('ID do painel ausente: '+id);
const cloud=read('cloud/connector-server.mjs');
if(!cloud.includes('function patchGameHtml(html){return patchSharedVersion(html)}')) fail('Cloud pode mutar gameplay'); else ok('Cloud nao muta gameplay');
if(!cloud.includes('function patchAdminHtml(html){return patchSharedVersion(html)}')) fail('Cloud ainda muta painel'); else ok('Painel nativo sem injecao legada');
if(process.exitCode) process.exit(process.exitCode);
