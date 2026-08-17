import fs from 'node:fs';
const fail=m=>{console.error('FAIL:',m);process.exitCode=1};
const ok=m=>console.log('OK:',m);
const read=p=>fs.readFileSync(p,'utf8');
const gameHtml=read('index.html'),panelHtml=read('painel.html'),game=read('src/game.js')+'\n'+read('src/core/skills.mjs')+'\n'+read('src/core/mobs.mjs')+'\n'+read('src/core/combat.mjs'),panel=read('src/panel.js'),panelCss=read('src/styles/panel.css');
const version=JSON.parse(read('version.json')).version;
const cacheTag=String(version).replace(/\./g,'');

if(!game.includes(`const VERSION='${version}'`)) fail('VERSION do jogo divergente'); else ok('versao sincronizada '+version);
if(!gameHtml.includes(`v${version}`)) fail('HTML do jogo sem versao atual'); else ok('HTML do jogo versionado');
if(!panelHtml.includes(`v${version}`)) fail('Painel sem versao atual'); else ok('painel versionado');
if(!gameHtml.includes(`src/game.js?v=${cacheTag}`)) fail('cache tag do runtime classico divergente'); else ok('cache tag runtime classico '+cacheTag);
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
if(!game.includes("knockDownPlayer('p1'")||!game.includes("knockDownPlayer('p2'")) fail('dano fatal admin sem down cooperativo'); else ok('dano fatal admin tratado em P1/P2');
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
if(!game.includes("eliteOgreReady?eliteOgreFrames:ogreFrames")) fail('Elite nao usa skin exclusiva'); else ok('tier Elite usa skin Ogro Elite');

// v0.17.16 · Elite visual scale
if(game.includes("e.tier===1?67:62")) fail('escala visual legada 67px ainda ativa'); else ok('escala visual legada removida');

// v0.17.17 · escala visual dos mobs
if(!game.includes("MOB_VISUAL_HEIGHT={normal:62,elite:86,elite2:94,corrupted:108,corrupted2:118,bossScale:3.55}")) fail('regua visual dos mobs ausente'); else ok('regua visual normal 62 / elite 86 / boss x3.55');
if(!game.includes("e.tier===2?(stage===2?MOB_VISUAL_HEIGHT.corrupted2:MOB_VISUAL_HEIGHT.corrupted):e.tier===1?(stage===2?MOB_VISUAL_HEIGHT.elite2:MOB_VISUAL_HEIGHT.elite):MOB_VISUAL_HEIGHT.normal")) fail('Elite nao usa regua visual'); else ok('Elite usa escala visual dedicada');

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
if(!game.includes("map:'snow-frost-puzzle'")) fail('telemetria do mapa divergente'); else ok('mapa ativo snow-frost-puzzle');
if(!mapRuntime.includes("name:'Snow Frost Puzzle'")) fail('runtime Snow Frost Puzzle ausente'); else ok('runtime Snow Frost Puzzle');
if(!mapRuntime.includes("seed:'ICE-BMFSXT'")) fail('seed Snow Frost de teste divergente'); else ok('seed Snow Frost ICE-BMFSXT');
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

// v0.17.24 · Snow Frost puzzle no jogo
if(!mapRuntime.includes('const N=1,E=2,S=4,W=8,CHUNK=512,MAP_N=6,DENSITY=.85,VARIANT=.32')) fail('runtime puzzle 6x6 divergente'); else ok('runtime puzzle 6x6 85/32');
if(!mapRuntime.includes('assets/Map/snow-frost/manifest.json')) fail('runtime nao carrega manifest Snow Frost'); else ok('runtime carrega manifest Snow Frost');
if(!mapRuntime.includes('def.collision')) fail('colisoes dos chunks nao integradas'); else ok('colisoes Snow Frost integradas');

// v0.17.25 · multiplayer duo MVP
for(const f of ['duo.html','src/duo.js']) fs.existsSync(f)?ok('duo '+f):fail('duo ausente '+f);
const duoHtml=read('duo.html'),duoJs=read('src/duo.js');
if(!duoHtml.includes(`v${version}`)) fail('duo HTML sem versao atual'); else ok('duo HTML versionado');
if(!duoHtml.includes(`src/duo.js?v=${cacheTag}`)) fail('cache duo.js divergente'); else ok('cache duo.js '+cacheTag);
if(!duoHtml.includes(`src/map-runtime.js?v=${cacheTag}`)) fail('cache map runtime no duo divergente'); else ok('duo usa map runtime sincronizado');
if(!game.includes('const duoPlayer=')) fail('estado P2 ausente no host'); else ok('estado P2 no host');
if(!game.includes("d?.type==='duo-hello'")) fail('handshake P2 ausente'); else ok('handshake P2');
if(!game.includes("d?.type==='duo-input'")) fail('input P2 ausente'); else ok('input P2');
if(!game.includes('sendDuoSnapshot')) fail('snapshot P2 ausente'); else ok('snapshot P2');
if(!game.includes("owner:'p2',damage")) fail('tiro P2 ausente'); else ok('tiro P2 autoritativo com dano por skill');
if(!gameHtml.includes('id="duoInviteBtn"')) fail('atalho P2 ausente no jogo'); else ok('atalho P2 no jogo');
if(!mapRuntime.includes('cfg.extraPlayers?.()')) fail('colisao de players extras ausente'); else ok('P2 usa colisoes do mapa');
if(!duoJs.includes("peer.connect('chaos-live-'+room.toLowerCase()")) fail('P2 nao usa mesma sala PeerJS'); else ok('P2 usa mesmo codigo da sala');
if(process.exitCode) process.exit(process.exitCode);

// v0.17.26 · duo aggro
if(!game.includes('function duoEnemyTarget(e)')) fail('aggro nearest-player ausente'); else ok('aggro escolhe player mais proximo');
if(!game.includes("knockDownPlayer('p2'")) fail('queda cooperativa P2 ausente'); else ok('P2 entra em DOWNED cooperativo');
if(!game.includes('chaseP=duoEnemyTarget(e)')) fail('mobs nao perseguem P2'); else ok('mobs perseguem P1/P2');
if(process.exitCode) process.exit(process.exitCode);

// v0.17.27+ · visual parity with optimized lazy P2 loading
const duoHtmlV27=read('duo.html'),duoJsV27=read('src/duo.js');
if(!duoHtmlV27.includes('jszip@3.10.1')) fail('Duo sem JSZip para bosses'); else ok('Duo carrega JSZip');
for(const token of ["loadFrames('assets/player-armed',32","loadFrames('assets/weapons',32","loadFrames('assets/mobs/Ogro',32","loadFrames('assets/mobs/Ogro Elite',32"]) if(!duoJsV27.includes(token)) fail('Duo sem pack necessario: '+token); else ok('Duo pack necessario '+token);
if(!game.includes('playerArmedReady=false')) fail('Host nao controla readiness armado'); else ok('Host espera player armado');
if(!game.includes('skinReady=playerArmedReady||playerV2Ready||soldierReady')||!game.includes('gunReady=weaponV2Ready||weaponReady')) fail('Host libera arena sem skin/arma valida'); else ok('Host exige skin e arma com fallback resiliente');
if(!game.includes('moving:player.moving,walk:player.walk,shotFlash:player.shotFlash')) fail('snapshot P1 sem animacao'); else ok('snapshot P1 com animacao');
if(!game.includes('moving:duoPlayer.moving,walk:duoPlayer.walk,shotFlash:duoPlayer.shotFlash')) fail('snapshot P2 sem animacao'); else ok('snapshot P2 com animacao');
if(!game.includes('t:e.t,speedMul:e.speedMul||1')) fail('snapshot mobs sem frame temporal'); else ok('snapshot mobs animado');
if(!mapRuntime.includes('cfg.extraPlayers?.()')) fail('P2 sem colisao do mapa'); else ok('P2 usa colisao do mapa');


// v0.17.29 · true cooperative duo
const duo29=read('src/duo.js'),duoHtml29=read('duo.html');
if(!game.includes('REVIVE_RADIUS=68,REVIVE_MS=3000')) fail('revive cooperativo 3s ausente'); else ok('revive cooperativo 3s');
if(!game.includes("knockDownPlayer('p1'")) fail('P1 ainda morre direto'); else ok('P1 usa estado DOWNED');
if(game.includes('duoPlayer.downUntil')) fail('auto-revive antigo do P2 ainda ativo'); else ok('auto-revive antigo removido');
if(!game.includes("onKill(e,b.owner==='p2'?'p2':'p1')")) fail('XP nao atribuido ao dono do tiro'); else ok('XP por dono do tiro');
if(!game.includes('duoLevel=1,duoXp=0,duoXpNeed=60')) fail('progressao P2 independente ausente'); else ok('level/xp P2 independentes');
if(!game.includes("d?.type==='duo-skill-choice'")) fail('P2 nao envia escolha de skill'); else ok('skills P2 autoritativas');
if(!game.includes('duoPendingSkill')) fail('fila de skill P2 ausente'); else ok('skill choices P2 independentes');
if(!game.includes('reviveP1Ms')||!game.includes('reviveP2Ms')) fail('progresso de resgate ausente'); else ok('progresso de resgate bilateral');
if(!duoHtml29.includes('-webkit-user-select:none')) fail('P2 ainda permite selecao de tela'); else ok('selecao de tela P2 bloqueada');
for(const id of ['fpsHud','level','xp','life','xpFill','skillPick','skillChoices','downNotice']) if(!duoHtml29.includes(`id="${id}"`)) fail('HUD Duo ausente: '+id);
if(!game.includes('slice(0,56)')||!game.includes('slice(0,28)')) fail('snapshot Duo nao reduzido'); else ok('snapshot Duo reduzido');
if(!game.includes('bufferedAmount>24576')) fail('backpressure Duo v29 ausente'); else ok('backpressure Duo v29');
if(!game.includes('setInterval(sendDuoSnapshot,125)')) fail('cadencia Duo v29 incorreta'); else ok('snapshot Duo 8Hz');
if(!duo29.includes('mobile?.92:1.18')) fail('DPR Duo mobile nao otimizado'); else ok('DPR Duo otimizado');
if(!duo29.includes('lite:true')) fail('Duo nao usa mapa lite'); else ok('mapa lite no P2');
if(!mapRuntime.includes("if(!cfg?.lite)")) fail('runtime nao remove efeitos no lite'); else ok('efeitos pesados removidos no P2');
if(process.exitCode) process.exit(process.exitCode);

// v0.17.30 · resilient player asset loader
if(!game.includes('async function loadPngSequenceSafe(')) fail('loader resiliente do player ausente'); else ok('loader resiliente do player ativo');
if(!game.includes('skinReady=playerArmedReady||playerV2Ready||soldierReady')) fail('fallback de skin do P1 ausente'); else ok('fallback de skin P1 ativo');
if(!game.includes('gunReady=weaponV2Ready||weaponReady')) fail('fallback de arma do P1 ausente'); else ok('fallback de arma P1 ativo');
if(!game.includes("loadPngSequenceSafe('./assets/player',32")) fail('player base ainda usa carregamento fragil'); else ok('player base tolera falha individual');
if(!game.includes("loadPngSequenceSafe('./assets/player-armed',32")) fail('player armado ainda usa carregamento fragil'); else ok('player armado tolera falha individual');
if(!game.includes("loadPngSequenceSafe('./assets/weapons',32")) fail('weapon pack ainda usa carregamento fragil'); else ok('weapon pack tolera falha individual');

// v0.17.33 · Firebase global ranking
const firebaseRank=read('src/firebase-ranking.js'),duo33=read('src/duo.js');
if(!gameHtml.includes('firebase-ranking.js?v='+cacheTag)) fail('Firebase ranking nao carregado no P1'); else ok('Firebase ranking carregado no P1');
if(!read('duo.html').includes('firebase-ranking.js?v='+cacheTag)) fail('Firebase ranking nao carregado no P2'); else ok('Firebase ranking carregado no P2');
if(!firebaseRank.includes("projectId:'caos-live'")) fail('Firebase project divergente'); else ok('Firebase caos-live configurado');
if(!firebaseRank.includes('signInAnonymously')) fail('Auth anonimo ausente'); else ok('Auth anonimo ativo');
if(!firebaseRank.includes("collection('ranking_solo')")||!firebaseRank.includes("collection('ranking_duo')")) fail('colecoes globais ausentes'); else ok('colecoes global solo/duo');
if(!firebaseRank.includes('FieldValue.serverTimestamp()')) fail('ranking sem timestamp do servidor'); else ok('serverTimestamp no ranking');
if(!game.includes('window.CaosRank.load(mode,40)')) fail('UI ainda nao consulta ranking global'); else ok('UI consulta Firestore');
if(!game.includes('cloud.saveSolo')||!game.includes('cloud.saveDuo')) fail('fim da partida nao salva no Firestore'); else ok('partidas solo/duo gravadas globalmente');
if(!duo33.includes('version:VERSION,name:nm,uid')) fail('P2 nao envia UID anonimo ao Host'); else ok('UID anonimo P2 sincronizado');

// v0.17.34 · migrate legacy local ranking to Firebase
const firebaseRank34=read('src/firebase-ranking.js');
if(!firebaseRank34.includes("LOCAL_RANK_KEY='caos-rank-v1'")) fail('migracao nao le historico local antigo'); else ok('historico local antigo detectado');
if(!firebaseRank34.includes('async function migrateLocalHistory()')) fail('migracao de ranking ausente'); else ok('migracao automatica presente');
if(!firebaseRank34.includes("where('uid','==',u.uid)")) fail('deduplicacao solo ausente'); else ok('deduplicacao solo por UID');
if(!firebaseRank34.includes("where('hostUid','==',u.uid)")) fail('deduplicacao duo ausente'); else ok('deduplicacao duo por Host UID');
if(!firebaseRank34.includes("version:'legacy-0.17.32'")) fail('historico legado sem identificacao'); else ok('historico legado identificado');
if(!firebaseRank34.includes('init().then(()=>migrateLocalHistory())')) fail('migracao nao inicia automaticamente'); else ok('migracao inicia ao abrir o jogo');

// v0.17.35 · ranked integrity guard against manual admin assistance
const duo35=read('src/duo.js'),firebase35=read('src/firebase-ranking.js');
if(!gameHtml.includes('id="rankIntegrity"')) fail('HUD sem selo de integridade do rank'); else ok('HUD mostra RANQUEADA/RANK OFF');
if(!read('duo.html').includes('id="rankIntegrityDuo"')) fail('Duo sem selo de rank'); else ok('Duo mostra integridade do rank');
if(!panelHtml.includes('id="rankGuard"')) fail('Painel sem estado do rank'); else ok('Painel mostra integridade do rank');
if(!game.includes("RANK_SAFE_ADMIN_COMMANDS=new Set(['ping','fps'])")) fail('allowlist segura ADM ausente'); else ok('ping/FPS nao invalidam rank');
if(!game.includes('adminCommandIsLive(d)')) fail('eventos legitimos da live nao separados'); else ok('TikTok separado de ADM manual');
if(!game.includes('invalidateRankByAdmin(c)')) fail('comando ADM nao invalida rank'); else ok('ADM manual invalida rank');
if(!game.includes("rankEligible=!adminSessionDirty")) fail('restart pode limpar fraude ADM'); else ok('rank continua OFF ate reload');
if(!game.includes("if(!rankEligible){toast('🛠️ PARTIDA ASSISTIDA PELO ADM · NÃO RANQUEADA');return}")) fail('partida assistida ainda pode ir ao Firebase'); else ok('partida assistida bloqueada no rank global');
if(!game.includes('ranked:rankEligible,rankInvalidReason')) fail('historico local nao marca run assistida'); else ok('historico local marca integridade');
if(!game.includes('rank:{eligible:rankEligible,reason:rankInvalidReason}')) fail('P2 nao recebe estado do rank'); else ok('P2 recebe estado do rank');
if(!game.includes('ranked:rankEligible,rankInvalidReason,adminSessionDirty')) fail('painel nao recebe estado do rank'); else ok('painel recebe estado do rank');
if(!firebase35.includes('if(r.ranked===false){skipped++;continue}')) fail('migracao pode subir run ADM antiga'); else ok('migracao ignora runs explicitamente nao ranqueadas');

// v0.17.36 · dedicated corrupted ogre skin
const corruptGame=read('src/game.js'),corruptDuo=read('src/duo.js');
if(!corruptGame.includes("./assets/mobs/Ogro Corrompido")) fail('skin Corrompido ausente no Host'); else ok('Host carrega skin Ogro Corrompido');
if(!corruptGame.includes('corruptedOgreReady?corruptedOgreFrames')) fail('tier 2 nao usa skin Corrompido no Host'); else ok('tier 2 usa skin Corrompido no Host');
if(!corruptDuo.includes("assets/mobs/Ogro Corrompido")) fail('skin Corrompido ausente no P2'); else ok('P2 carrega skin Ogro Corrompido');
if(!corruptDuo.includes('corruptedReady?corruptedOgreFrames')) fail('tier 2 nao usa skin Corrompido no P2'); else ok('tier 2 usa skin Corrompido no P2');


// v0.17.37 · endgame rage progression
for(const d of ['assets/mobs/Ogro Elite II','assets/mobs/Ogro Corrompido II']) if(!fs.existsSync(d+'/.gitkeep')) fail('pasta futura ausente '+d); else ok('pasta futura pronta '+d);
if(!game.includes('function enemyEvolution(tier)')) fail('subtier II ausente'); else ok('Elite II / Corrompido II ativos');
if(!game.includes('level>=40')||!game.includes('level>=60')) fail('unlocks de endgame ausentes'); else ok('unlocks LV40/LV60 ativos');
if(!game.includes("elite2:{hp:4.2,dmg:2.05,speed:1.10,xp:4.2,hitbox:1.08}")) fail('stats Elite II divergentes'); else ok('stats Elite II');
if(!game.includes("corrupted2:{hp:7,dmg:2.75,speed:1.16,xp:6.5,hitbox:1.20}")) fail('stats Corrompido II divergentes'); else ok('stats Corrompido II');
if(!game.includes('function xpNeedFor(lv)')) fail('curva XP endgame ausente'); else ok('curva XP endgame ativa');
if(!game.includes("./assets/mobs/Ogro Elite II")||!game.includes("./assets/mobs/Ogro Corrompido II")) fail('fallback skins II host ausente'); else ok('fallback skins II host');
if(!game.includes('evolution:e.evolution||1')) fail('snapshot sem subtier'); else ok('subtier sincronizado ao P2');
const duo37=read('src/duo.js');
if(!duo37.includes("assets/mobs/Ogro Elite II")||!duo37.includes("assets/mobs/Ogro Corrompido II")) fail('fallback skins II P2 ausente'); else ok('fallback skins II P2');
if(!game.includes('corrupted:108,corrupted2:118')) fail('Corrompido nao e maior que Elite'); else ok('escala Corrompido > Elite');
