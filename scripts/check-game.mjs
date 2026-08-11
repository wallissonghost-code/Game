import fs from 'node:fs';
const fail=m=>{console.error('FAIL:',m);process.exitCode=1};
const ok=m=>console.log('OK:',m);
const read=p=>fs.readFileSync(p,'utf8');
const gameHtml=read('index.html'),panelHtml=read('painel.html'),game=read('src/game.js'),panel=read('src/panel.js'),panelCss=read('src/styles/panel.css');
const version=JSON.parse(read('version.json')).version;
const cacheTag=String(version).replace(/\./g,'');

if(!game.includes(`const VERSION='${version}'`)) fail('VERSION do jogo divergente'); else ok('versao sincronizada '+version);
if(!gameHtml.includes(`v${version}`)) fail('HTML do jogo sem versao atual'); else ok('HTML do jogo versionado');
if(!panelHtml.includes(`v${version}`)) fail('Painel sem versao atual'); else ok('painel versionado');
if(!gameHtml.includes(`src/game.js?v=${cacheTag}`)) fail('cache tag do game.js divergente'); else ok('cache tag game.js '+cacheTag);
if(!panelHtml.includes(`src/panel.js?v=${cacheTag}`)) fail('cache tag do panel.js divergente'); else ok('cache tag panel.js '+cacheTag);
if(!panelHtml.includes(`src/styles/panel.css?v=${cacheTag}`)) fail('cache tag do panel.css divergente'); else ok('cache tag panel.css '+cacheTag);
if(panelCss.includes('.topVersion{display:none}')) fail('versao do painel escondida no mobile'); else ok('versao visivel no mobile');
if(!panel.includes("fetch('./version.json?ts='")) fail('painel nao consulta fonte unica de versao'); else ok('painel consulta version.json');
if(!panel.includes('syncVersion(d.version)')) fail('painel nao compara versao recebida do jogo'); else ok('painel compara jogo x painel');

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

const required=['room','connect','status','net','cloudConnect','tiktokConnect','liveEnabled','health','level','xp','fpsState','mobs','kills','elapsed','wave','score','eliteCount','corruptedCount','bossCount','gameState','autoState','perfState','autoModeToggle','hordeModeToggle','autoFireModeToggle','fpsModeToggle','skillTestSelect','skillTestLevel','skillApply','skillAll','skillReset','skillMax','mobTier','mobType','mobAmount','spawn','spawnElite','spawnCorrupted','log','panelVersion','versionSync','likeTotal','likeProgress','mobPresetLow','mobPresetMedium','mobPresetHigh','mobPresetMax','mobAdvancedSave'];
for(const id of required) if(!panelHtml.includes(`id="${id}"`)) fail('ID do painel ausente: '+id);

if(!panel.includes("d.type==='like'")) fail('painel nao trata curtidas TikTok'); else ok('curtidas TikTok tratadas');
if(!panel.includes("command:'boss',mob:r.mob,amount:v")) fail('quantidade de boss ignorada'); else ok('quantidade de boss enviada');
if(!game.includes("const qty=Math.max(1,Math.min(20,+d.amount||1))")) fail('jogo nao aceita quantidade de boss'); else ok('quantidade de boss aplicada');
if(!game.includes("if(running&&player.life<=0&&!deathState)")) fail('dano fatal admin sem morte'); else ok('dano fatal admin tratado');
if(!panel.includes("norm(comment)==='mob'")) fail('anti-lag MOB ausente'); else ok('anti-lag MOB ativo');

const cloud=read('cloud/connector-server.mjs');
if(!cloud.includes('function patchGameHtml(html){return patchSharedVersion(html)}')) fail('Cloud pode mutar gameplay'); else ok('Cloud nao muta gameplay');
if(!cloud.includes('function patchAdminHtml(html){return patchSharedVersion(html)}')) fail('Cloud ainda muta painel'); else ok('Painel nativo sem injecao legada');


if(!game.includes('manualAimByMovement=false')) fail('estado opcional Mira pelo Movimento ausente'); else ok('Mira pelo Movimento OFF por padrao');
if(!game.includes("if(c==='manualaim')")) fail('comando manualaim ausente'); else ok('comando manualaim');
if(!game.includes('manualAim:manualAimByMovement')) fail('telemetria manualAim ausente'); else ok('telemetria manualAim');
if(!game.includes('if(manualAimByMovement&&!autoMode){if(player.moving)player.aim=Math.atan2(player.moveY,player.moveX)}')) fail('movimento nao controla mira no modo extra'); else ok('movimento controla mira no modo extra');
if(!game.includes('const manual=manualAimByMovement&&!autoMode')) fail('tiro ainda pode retargetar no modo extra'); else ok('tiro respeita mira manual');
if(!panelHtml.includes('id="manualAimModeToggle"')) fail('toggle Mira pelo Movimento ausente no Admin'); else ok('toggle Mira pelo Movimento no Admin');
if(!panel.includes("command:'manualaim'")) fail('painel nao envia manualaim'); else ok('painel envia manualaim');
if(!panel.includes("typeof d.manualAim==='boolean'")) fail('painel nao sincroniza manualAim'); else ok('painel sincroniza manualAim');

if(process.exitCode) process.exit(process.exitCode);
