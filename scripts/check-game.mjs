import fs from 'node:fs';

const fail=m=>{console.error('FAIL:',m);process.exitCode=1};
const ok=m=>console.log('OK:',m);
const read=p=>fs.readFileSync(p,'utf8');
const exists=p=>fs.existsSync(p);

const version=JSON.parse(read('version.json')).version;
const cacheTag=String(version).replace(/\./g,'');
const gameHtml=read('index.html');
const panelHtml=read('painel.html');
const duoHtml=read('duo.html');
const game=read('src/game.js');
const panel=read('src/panel.js');
const mapRuntime=read('src/map-runtime.js');
const duo=read('src/duo.js');
const contracts=read('src/core/contracts.mjs');
const runtimeState=read('src/core/runtime-state.js');
const matchState=read('src/core/match-state.mjs');

// Release/version integrity
if(!game.includes(`const VERSION='${version}'`)) fail('VERSION do jogo divergente'); else ok('versao sincronizada '+version);
if(!gameHtml.includes(`v${version}`)) fail('HTML do jogo sem versao atual'); else ok('HTML do jogo versionado');
if(!panelHtml.includes(`v${version}`)) fail('Painel sem versao atual'); else ok('painel versionado');
if(!duoHtml.includes(`v${version}`)) fail('Duo sem versao atual'); else ok('duo versionado');
if(!panelHtml.includes(`src/panel.js?v=${cacheTag}`)) fail('cache panel.js divergente'); else ok('cache panel.js '+cacheTag);
if(!panelHtml.includes(`src/styles/panel.css?v=${cacheTag}`)) fail('cache panel.css divergente'); else ok('cache panel.css '+cacheTag);
if(!gameHtml.includes('src/map-runtime.js?v='+cacheTag)) fail('cache map-runtime divergente'); else ok('cache map-runtime '+cacheTag);
if(!duoHtml.includes(`src/duo.js?v=${cacheTag}`)) fail('cache duo.js divergente'); else ok('cache duo.js '+cacheTag);
if(!duoHtml.includes(`src/map-runtime.js?v=${cacheTag}`)) fail('cache map-runtime do Duo divergente'); else ok('cache map-runtime Duo '+cacheTag);

// Runtime essencial
if(!game.includes("startButton.onclick=()=>reset()")) fail('handler PLAY ausente'); else ok('handler PLAY');
if(!game.includes("ASSET_TAG=VERSION.replace(/\\./g,'')")) fail('ASSET_TAG dinamico ausente'); else ok('cache de assets dinamico');
if(!panel.includes("norm(comment)==='mob'")) fail('anti-lag MOB ausente'); else ok('anti-lag MOB ativo');
if(!game.includes('function tierAura(')) fail('render tier aura ausente'); else ok('render tier aura ativo');
if(!game.includes("map:'snow-frost-puzzle'")) fail('mapa ativo divergente'); else ok('mapa Snow Frost ativo');
if(!mapRuntime.includes("name:'Snow Frost Puzzle'")) fail('runtime Snow Frost ausente'); else ok('runtime Snow Frost ativo');
if(!mapRuntime.includes('assets/Map/snow-frost/manifest.json')) fail('manifest Snow Frost nao carregado'); else ok('manifest Snow Frost carregado');

// Assets essenciais
for(let i=1;i<=32;i++){
  const n=String(i).padStart(3,'0');
  for(const dir of ['assets/player','assets/mobs/Ogro','assets/weapons','assets/mobs/Ogro Elite']){
    const f=`${dir}/frame_${n}.png`;
    if(!exists(f)) fail('asset ausente '+f);
  }
}
for(const f of ['assets/bosses/Ogroboss1.zip','assets/bosses/Ogro2.0Boss.zip','assets/Map/snow-frost/manifest.json']) exists(f)?ok(f):fail('asset ausente '+f);

// Multiplayer/ranking essenciais
if(!(game.includes('runtimeState.createDuoPlayer()')&&runtimeState.includes('createDuoPlayer'))) fail('estado P2 ausente'); else ok('estado P2 ativo');
if(!game.includes("d?.type==='duo-input'")) fail('input P2 ausente'); else ok('input P2 ativo');
if(!game.includes('sendDuoSnapshot')) fail('snapshot P2 ausente'); else ok('snapshot P2 ativo');
if(!duo.includes("peer.connect('chaos-live-'+room.toLowerCase()")) fail('Duo fora da sala do Host'); else ok('Duo usa mesma sala');
if(!(game.includes('matchRuntime.xpNeedFor')&&matchState.includes('export function xpNeedFor(lv)'))) fail('curva XP ausente'); else ok('curva XP ativa');
if(!contracts.includes('hp: 4.2, dmg: 2.05, speed: 1.10, xp: 4.2, hitbox: 1.08')) fail('stats Elite II divergentes'); else ok('stats Elite II');
if(!contracts.includes('hp: 7, dmg: 2.75, speed: 1.16, xp: 6.5, hitbox: 1.20')) fail('stats Corrompido II divergentes'); else ok('stats Corrompido II');

if(process.exitCode) process.exit(process.exitCode);
ok('release principal validado sem ferramentas legadas');
