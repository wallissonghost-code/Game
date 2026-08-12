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
  for(const dir of ['assets/player','assets/mobs/Ogro','assets/weapons']){
    const f=`${dir}/frame_${n}.png`; if(!fs.existsSync(f)) fail('asset ausente '+f);
  }
  const armed=`assets/player-armed/Posearma${i}.png`; if(!fs.existsSync(armed)) fail('asset ausente '+armed);
}
for(const f of ['assets/bosses/Ogroboss1.zip','assets/bosses/Ogro2.0Boss.zip']) fs.existsSync(f)?ok(f):fail('asset ausente '+f);

const required=['room','connect','status','net','cloudConnect','tiktokConnect','liveEnabled','health','level','xp','fpsState','mobs','kills','elapsed','wave','score','eliteCount','corruptedCount','bossCount','gameState','autoState','perfState','autoModeToggle','hordeModeToggle','autoFireModeToggle','fpsModeToggle','skillTestSelect','skillTestLevel','skillApply','skillAll','skillReset','skillMax','bossTier','mobTier','mobType','mobAmount','spawn','spawnElite','spawnCorrupted','log','panelVersion','versionSync','likeTotal','likeProgress','mobPresetLow','mobPresetMedium','mobPresetHigh','mobPresetMax','mobAdvancedSave'];
for(const id of required) if(!panelHtml.includes(`id="${id}"`)) fail('ID do painel ausente: '+id);

if(!panel.includes("d.type==='like'")) fail('painel nao trata curtidas TikTok'); else ok('curtidas TikTok tratadas');
if(!panel.includes("command:'boss',mob:r.mob,amount:v")) fail('quantidade de boss ignorada'); else ok('quantidade de boss enviada');
if(!game.includes("const qty=Math.max(1,Math.min(20,+d.amount||1))")) fail('jogo nao aceita quantidade de boss'); else ok('quantidade de boss aplicada');
if(!game.includes("if(running&&player.life<=0&&!deathState)")) fail('dano fatal admin sem morte'); else ok('dano fatal admin tratado');
if(!panel.includes("norm(comment)==='mob'")) fail('anti-lag MOB ausente'); else ok('anti-lag MOB ativo');

const cloud=read('cloud/connector-server.mjs');
if(!cloud.includes('function patchGameHtml(html){return patchSharedVersion(html)}')) fail('Cloud pode mutar gameplay'); else ok('Cloud nao muta gameplay');
if(!cloud.includes('function patchAdminHtml(html){return patchSharedVersion(html)}')) fail('Cloud ainda muta painel'); else ok('Painel nativo sem injecao legada');



if(process.exitCode) process.exit(process.exitCode);

if(!fs.existsSync('assets/mobs/Ogro Elite/.gitkeep')) fail('pasta Ogro Elite ausente'); else ok('pasta Ogro Elite pronta');
for(let i=1;i<=32;i++){const n=String(i).padStart(3,'0');if(fs.existsSync(`assets/mobs/frame_${n}.png`)) fail('frame legado ainda na raiz mobs: '+n)}

// v0.17.14 · gameplay + weapon
if(!game.includes("gameplayMode='classic'")) fail('jogabilidade nao inicia em Classico'); else ok('Classico por padrao');
if(!game.includes("gameplayMode==='sweep'")) fail('modo Varredura ausente'); else ok('Varredura presente');
if(!game.includes("gameplayMode==='hardcore'")) fail('modo Hardcore ausente'); else ok('Hardcore presente');
if(!game.includes('const SWEEP_HALF_ANGLE=Math.PI/3')) fail('cone de Varredura divergente'); else ok('cone Varredura 120 graus');
if(!game.includes("target=sweepTarget();if(!target)return")) fail('Varredura pode atirar sem alvo'); else ok('Varredura nao atira sem alvo');
if(!game.includes("if(c==='gameplaymode')")) fail('comando gameplaymode ausente'); else ok('comando gameplaymode');
if(!game.includes("gameplayMode,manualAim:gameplayMode==='hardcore'")) fail('telemetria gameplay ausente'); else ok('telemetria gameplay');
for(const id of ['gameplayClassic','gameplaySweep','gameplayHardcore','gameplayModeState','gameplayModeHint','gameplayState']) if(!panelHtml.includes(`id="${id}"`)) fail('controle gameplay ausente: '+id);
if(!panel.includes("command:'gameplaymode'")) fail('painel nao envia gameplaymode'); else ok('painel envia gameplaymode');
if(!panel.includes("d.gameplayMode||(d.manualAim?'hardcore':'classic')")) fail('painel nao sincroniza gameplay'); else ok('painel sincroniza gameplay');
if(!game.includes("folder.includes('/mobs')||folder.includes('/weapons')")) fail('arma nao normaliza alpha'); else ok('arma normaliza margens transparentes');
if(game.includes('01711')) fail('cache legado 01711 ainda presente no game'); else ok('sem cache legado 01711');
if(!game.includes("ASSET_TAG=VERSION.replace(/\\./g,'')")) fail('ASSET_TAG dinamico ausente'); else ok('cache de assets deriva da versao');

if(!game.includes('iw=wi.naturalWidth||wi.width||1')) fail('weapon canvas ratio ausente'); else ok('weapon canvas ratio preservado');

// v0.17.15 · elite skin
for(let i=1;i<=32;i++){const n=String(i).padStart(3,'0');const f=`assets/mobs/Ogro Elite/frame_${n}.png`;if(!fs.existsSync(f)) fail('asset Elite ausente '+f)}
if(!game.includes('eliteOgreFrames={up:[],down:[],right:[],left:[]}')) fail('pack Ogro Elite ausente'); else ok('pack Ogro Elite configurado');
if(!game.includes("loadDirectPngSequence('./assets/mobs/Ogro Elite',32,ASSET_TAG)")) fail('loader Ogro Elite ausente'); else ok('32 frames Elite carregados');
if(!game.includes("e.tier===1&&eliteOgreReady?eliteOgreFrames:ogreFrames")) fail('Elite nao usa skin exclusiva'); else ok('tier Elite usa skin Ogro Elite');

// v0.17.16 · Elite visual scale
if(game.includes("e.tier===1?67:62")) fail('escala visual legada 67px ainda ativa'); else ok('escala visual legada removida');

// v0.17.17 · escala visual dos mobs
if(!game.includes("MOB_VISUAL_HEIGHT={normal:62,elite:86,bossScale:3.55}")) fail('regua visual dos mobs ausente'); else ok('regua visual normal 62 / elite 86 / boss x3.55');
if(!game.includes("e.tier===1?MOB_VISUAL_HEIGHT.elite:MOB_VISUAL_HEIGHT.normal")) fail('Elite nao usa regua visual'); else ok('Elite usa escala visual dedicada');

// v0.17.18 · variantes raras de Boss
if(!game.includes("BOSS_VARIANTS={normal:{hp:1,dmg:1,speed:1,xp:1},elite:{hp:1.75,dmg:1.25,speed:1.05,xp:1.75},corrupted:{hp:2.5,dmg:1.5,speed:1.10,xp:2.5}}")) fail('multiplicadores de Boss divergentes'); else ok('Boss Elite/Corrompido balanceados');
if(!game.includes("return r<.01?2:r<.07?1:3")) fail('chance rara de Boss divergente'); else ok('Boss natural 93/6/1');
if(!game.includes("boss(d.mob||null,d.tier??null)")) fail('Admin nao envia tier ao Boss'); else ok('Boss aceita tier forcado');
if(!game.includes("bossVariantAura")) fail('aura de Boss raro ausente'); else ok('aura de Boss raro');
if(!game.includes("· CORROMPIDO")||!game.includes("· ELITE")) fail('rotulo visual de Boss raro ausente'); else ok('rotulo Elite/Corrompido no Boss');
if(!panelHtml.includes('id="bossTier"')) fail('seletor de tier do Boss ausente'); else ok('Admin controla tier do Boss');
if(!panel.includes("b.dataset.cmd==='boss'?($('bossTier')?.value||null):undefined")) fail('painel nao envia tier de Boss'); else ok('painel envia tier de Boss');

// v0.17.20 · Dense Forest cohesive map
const mapRuntime=read('src/map-runtime.js');
if(!gameHtml.includes('src/map-runtime.js?v='+cacheTag)) fail('map-runtime sem cache sincronizado'); else ok('map-runtime cache '+cacheTag);
if(!game.includes("map:'dense-forest'")) fail('telemetria do mapa divergente'); else ok('mapa ativo dense-forest');
if(!mapRuntime.includes("name:'Floresta Densa'")) fail('runtime Floresta Densa ausente'); else ok('runtime Floresta Densa');
if(!mapRuntime.includes('BASE_TILE_INDEXES=[0,1,2,3,7,8]')) fail('selecao segura de tiles ausente'); else ok('tiles de base coesos');
for(const f of ['assets/Map/dense-forest/tiles/tile_001.png','assets/Map/dense-forest/tiles/tile_010.png','assets/Map/dense-forest/decals/decal_015.png','assets/Map/dense-forest/obstacles/obstacle_021.png']) fs.existsSync(f)?ok('map asset '+f):fail('map asset ausente '+f);
for(const d of ['field','wasteland','extras-uploaded']) if(fs.existsSync('assets/Map/'+d)) fail('mapa antigo ainda existe: '+d); else ok('mapa antigo removido: '+d);
if(fs.existsSync('assets/CAOS_LIVE_WORLDS_FINAL_CORRIGIDO.zip')) fail('ZIP de upload ainda na pasta assets'); else ok('ZIP extraido e removido');
const expectedWorlds=['cave-mines','dense-forest','desert-canyon','ruined-city','shadow-corruption','snow-frost'];
const actualWorlds=fs.readdirSync('assets/Map',{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort();
if(JSON.stringify(actualWorlds)!==JSON.stringify(expectedWorlds)) fail('pastas de mundos divergentes: '+actualWorlds.join(',')); else ok('6 mundos novos organizados');


// v0.17.21 · Map Lab
for(const f of ['map-lab.html','src/map-lab.js']) fs.existsSync(f)?ok('map lab '+f):fail('map lab ausente '+f);
const labHtml=read('map-lab.html'),labJs=read('src/map-lab.js');
if(!labHtml.includes('src/map-lab.js?v='+cacheTag)) fail('map lab cache dessincronizado'); else ok('map lab cache '+cacheTag);
if(!labJs.includes('function maskFor')) fail('map lab sem autotile mask'); else ok('map lab autotile mask');
if(!labJs.includes('TYPE.bridge')) fail('map lab sem ponte contextual'); else ok('map lab ponte contextual');
if(!labJs.includes('assets/Map/snow-frost/manifest.json')) fail('map lab nao usa manifest Snow Frost Puzzle'); else ok('map lab usa Snow Frost Puzzle real');


// v0.17.23 · Snow Frost prebuilt chunk puzzle
const snowPuzzle=JSON.parse(read('assets/Map/snow-frost/manifest.json'));
if(!labHtml.includes('Snow Frost · chunks 512×512')) fail('Map Lab sem modo chunks Snow Frost'); else ok('Map Lab em chunks Snow Frost');
if(!labJs.includes('chooseVariant')) fail('Map Lab sem variacao de chunks'); else ok('variacoes de chunks ativas');
if(!labJs.includes('validatePuzzle')) fail('Map Lab sem validacao de encaixes'); else ok('validacao N/E/S/W ativa');
if(snowPuzzle.formatVersion!==3) fail('manifest Snow Frost Puzzle fora do formato 3'); else ok('manifest Snow Frost formato 3');
if(!Array.isArray(snowPuzzle.chunks)||snowPuzzle.chunks.length!==32) fail('Snow Frost Puzzle precisa ter 32 chunks'); else ok('32 chunks Snow Frost');
for(let mask=0;mask<16;mask++){const rows=snowPuzzle.chunks.filter(x=>x.mask===mask);if(rows.length!==2) fail('mask '+mask+' sem 2 variacoes')}
for(const f of ['assets/Map/snow-frost/chunks/mask_00_closed_v01.png','assets/Map/snow-frost/chunks/mask_05_straight_ns_v02.png','assets/Map/snow-frost/chunks/mask_10_straight_ew_v02.png','assets/Map/snow-frost/chunks/mask_15_cross_v02.png']) fs.existsSync(f)?ok('snow puzzle '+f):fail('snow puzzle ausente '+f);
if(fs.existsSync('CAOS_LIVE_SNOW_FROST_PUZZLE_FINAL.zip')) fail('ZIP Snow Frost ainda na raiz'); else ok('ZIP Snow Frost extraido e removido');
