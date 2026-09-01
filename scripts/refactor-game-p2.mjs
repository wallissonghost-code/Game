// trigger: p2 domain extraction v5 - regression pass
import fs from 'node:fs';

const gamePath='src/game.js';
const bootstrapPath='src/core/skills-bootstrap.mjs';
const archPath='scripts/check-architecture.mjs';

function splitTopLevel(input){
  const out=[];let start=0,depth=0,quote=null,esc=false;
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(quote){if(esc){esc=false;continue}if(ch==='\\'){esc=true;continue}if(ch===quote)quote=null;continue}
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{'||ch==='['||ch==='(')depth++;
    else if(ch==='}'||ch===']'||ch===')')depth--;
    else if(ch===','&&depth===0){out.push(input.slice(start,i));start=i+1}
  }
  out.push(input.slice(start));return out.map(s=>s.trim()).filter(Boolean);
}
function varName(entry){return entry.slice(0,entry.indexOf('=')).trim()}
function extractLet(src,startAnchor,endAnchor,groups,replacementBuilder){
  const start=src.indexOf(startAnchor);if(start<0)throw Error('missing start anchor '+startAnchor);
  const bodyStart=start+startAnchor.length,end=src.indexOf(endAnchor,bodyStart);if(end<0)throw Error('missing end anchor '+endAnchor);
  const entries=splitTopLevel(src.slice(bodyStart,end));
  const selected=new Map(Object.keys(groups).map(k=>[k,[]])),keep=[];
  for(const e of entries){const n=varName(e);let hit=false;for(const [group,names] of Object.entries(groups)){if(names.has(n)){selected.get(group).push(n);hit=true;break}}if(!hit)keep.push(e)}
  for(const [group,names] of Object.entries(groups)){const got=new Set(selected.get(group));for(const n of names)if(!got.has(n))throw Error(`missing ${group} variable ${n}`)}
  const replacement=startAnchor+(keep.length?keep.join(','):'__EMPTY__')+replacementBuilder(selected);
  return src.slice(0,start)+replacement+src.slice(end);
}

let game=fs.readFileSync(gamePath,'utf8');
if(!game.includes('const matchRuntime=window.CaosMatchState')){
  const groups={
    match:new Set(['score','level','xp','xpNeed','killCount','runStartedAt','deathState']),
    waves:new Set(['spawnTimer','hordeEnabled','waveCount','nextWaveAt','bossFuryCount']),
    enemies:new Set(['enemies','enemySpeed','autoTarget','autoTargetUntil']),
    projectiles:new Set(['shotTimer','bullets','flashCounter','pierceShotCounter','iceShotCounter','explosiveShotCounter','ciShotsFired','ciShotsHit','ciShotsExpired','ciPierceShots','ciIceShots','ciExplosiveShots','ciLastShot']),
    render:new Set(['W','H','dpr','raf','pointer','perfMode','perfFrames','perfWindowStart','perfLastFps','renderScale','frameSeq','damageFx','arcFx','shockFx','explosionFx','meteorShakeLeft'])
  };
  game=extractLet(game,",keys={};let ",';const runtimeState=window.CaosRuntimeState',groups,sel=>{
    const decl=(g,api,fn)=>`;let {${sel.get(g).join(',')}}=${api}.${fn}()`;
    return decl('match','matchRuntime','createMatchState')+decl('waves','wavesRuntime','createWaveState')+decl('enemies','enemiesRuntime','createEnemyState')+decl('projectiles','projectilesRuntime','createProjectileState')+decl('render','renderRuntime','createRenderState');
  });
  game=game.replace(',keys={};let __EMPTY__',',keys={}');
  const runtimeAnchor=';const runtimeState=window.CaosRuntimeState';
  const domainInit=";const matchRuntime=window.CaosMatchState,wavesRuntime=window.CaosWavesRuntime,enemiesRuntime=window.CaosEnemiesRuntime,projectilesRuntime=window.CaosProjectilesRuntime,renderRuntime=window.CaosRenderRuntime,multiplayerRuntime=window.CaosMultiplayerRuntime;if(!matchRuntime||!wavesRuntime||!enemiesRuntime||!projectilesRuntime||!renderRuntime||!multiplayerRuntime)throw Error('CAOS domain runtime indisponivel')";
  game=game.replace(runtimeAnchor,domainInit+runtimeAnchor);
}

// Domain APIs must be initialized before destructuring their state factories.
{
  const firstState=game.indexOf(';let {score,level,xp,xpNeed');
  const domainStart=game.indexOf(';const matchRuntime=window.CaosMatchState');
  const runtimeStart=domainStart>=0?game.indexOf(';const runtimeState=window.CaosRuntimeState',domainStart):-1;
  if(firstState>=0&&domainStart>firstState&&runtimeStart>domainStart){
    const domainBlock=game.slice(domainStart,runtimeStart);
    game=game.slice(0,domainStart)+game.slice(runtimeStart);
    const insertion=game.indexOf(';let {score,level,xp,xpNeed');
    if(insertion<0)throw Error('state insertion point lost while reordering domains');
    game=game.slice(0,insertion)+domainBlock+game.slice(insertion);
  }
}

const xpRe=/function xpNeedFor\(lv\)\{const base=60\*Math\.pow\(Math\.max\(1,lv\),1\.42\),mult=lv>=90\?1\.70:lv>=80\?1\.50:lv>=60\?1\.30:lv>=40\?1\.12:1;return Math\.floor\(base\*mult\)\}/;
if(xpRe.test(game))game=game.replace(xpRe,'const xpNeedFor=matchRuntime.xpNeedFor');
if(game.includes('const MAX_ENEMIES=320,GRID=64,CHUNK=640;'))game=game.replace('const MAX_ENEMIES=320,GRID=64,CHUNK=640;','const {MAX_ENEMIES,GRID,CHUNK}=enemiesRuntime.ENEMY_LIMITS;');

const oldMp="let duoConn=null,duoShotTimer=.05,duoEntitySeq=1,duoShotCounter=0,duoArcNextAt=0,duoLevel=1,duoXp=0,duoXpNeed=60,duoKillCount=0,duoPendingSkill=null,reviveP1Ms=0,reviveP2Ms=0,lastCoopKiller=null;const REVIVE_RADIUS=68,REVIVE_MS=3000;let playerNames={p1:'P1',p2:'P2'},totalXpP1=0,totalXpP2=0,matchSaved=false,duoAuthUid='',rankMode='solo',rankEligible=true,rankInvalidReason='',adminSessionDirty=false;";
const newMp="let {duoConn,duoShotTimer,duoEntitySeq,duoShotCounter,duoArcNextAt,duoLevel,duoXp,duoXpNeed,duoKillCount,duoPendingSkill,reviveP1Ms,reviveP2Ms,lastCoopKiller,playerNames,duoAuthUid}=multiplayerRuntime.createMultiplayerState();const {RADIUS:REVIVE_RADIUS,MS:REVIVE_MS}=multiplayerRuntime.REVIVE;let {totalXpP1,totalXpP2,matchSaved,rankMode,rankEligible,rankInvalidReason,adminSessionDirty}=matchRuntime.createMatchState();";
if(game.includes(oldMp))game=game.replace(oldMp,newMp);
else if(!game.includes('multiplayerRuntime.createMultiplayerState()'))throw Error('multiplayer extraction anchor missing');

fs.writeFileSync(gamePath,game);

let bootstrap=fs.readFileSync(bootstrapPath,'utf8');
const imports=`import * as CaosMatchState from './match-state.mjs?v=01749-p2';\nimport * as CaosWavesRuntime from './waves-runtime.mjs?v=01749-p2';\nimport * as CaosEnemiesRuntime from './enemies-runtime.mjs?v=01749-p2';\nimport * as CaosProjectilesRuntime from './projectiles-runtime.mjs?v=01749-p2';\nimport * as CaosMultiplayerRuntime from './multiplayer-runtime.mjs?v=01749-p2';\nimport * as CaosRenderRuntime from './render-runtime.mjs?v=01749-p2';\n`;
if(!bootstrap.includes("./match-state.mjs"))bootstrap=bootstrap.replace("import * as CaosCombat from './combat.mjs?v=01745';\n",m=>m+imports);
const expose=`CaosMatchState.assertMatchState();\nCaosWavesRuntime.assertWaveState();\nCaosEnemiesRuntime.assertEnemyState();\nCaosProjectilesRuntime.assertProjectileState();\nCaosMultiplayerRuntime.assertMultiplayerState();\nCaosRenderRuntime.assertRenderState();\nwindow.CaosMatchState = Object.freeze({ ...CaosMatchState });\nwindow.CaosWavesRuntime = Object.freeze({ ...CaosWavesRuntime });\nwindow.CaosEnemiesRuntime = Object.freeze({ ...CaosEnemiesRuntime });\nwindow.CaosProjectilesRuntime = Object.freeze({ ...CaosProjectilesRuntime });\nwindow.CaosMultiplayerRuntime = Object.freeze({ ...CaosMultiplayerRuntime });\nwindow.CaosRenderRuntime = Object.freeze({ ...CaosRenderRuntime });\n`;
if(!bootstrap.includes('CaosMatchState.assertMatchState()'))bootstrap=bootstrap.replace('CaosCombat.assertCombatDomain();\n','CaosCombat.assertCombatDomain();\n'+expose);
fs.writeFileSync(bootstrapPath,bootstrap);

let arch=fs.readFileSync(archPath,'utf8');
if(!arch.includes("const matchStateSource = read('src/core/match-state.mjs');")){
  arch=arch.replace("const combatSource = read('src/core/combat.mjs');\n", "const combatSource = read('src/core/combat.mjs');\nconst matchStateSource = read('src/core/match-state.mjs');\nconst enemiesRuntimeSource = read('src/core/enemies-runtime.mjs');\n");
}
arch=arch.replace("const soloContractView = solo+'\\n'+mobsSource+'\\n'+combatSource+'\\n'+read('src/core/contracts.mjs');","const soloContractView = solo+'\\n'+mobsSource+'\\n'+combatSource+'\\n'+matchStateSource+'\\n'+enemiesRuntimeSource+'\\n'+read('src/core/contracts.mjs');");
arch=arch.replace("if (!solo.includes(`MAX_ENEMIES=${LIMITS.solo.maxEnemies}`)) fail(`solo MAX_ENEMIES differs from core contract ${LIMITS.solo.maxEnemies}`);","if (!soloContractView.includes(`MAX_ENEMIES=${LIMITS.solo.maxEnemies}`)) fail(`solo MAX_ENEMIES differs from core contract ${LIMITS.solo.maxEnemies}`);");
fs.writeFileSync(archPath,arch);

const finalGame=fs.readFileSync(gamePath,'utf8');
for(const needle of ['matchRuntime.createMatchState()','wavesRuntime.createWaveState()','enemiesRuntime.createEnemyState()','projectilesRuntime.createProjectileState()','renderRuntime.createRenderState()','multiplayerRuntime.createMultiplayerState()'])if(!finalGame.includes(needle))throw Error('missing extraction '+needle);
if(finalGame.includes('function xpNeedFor(lv)'))throw Error('xpNeedFor still inline');
const domainPos=finalGame.indexOf('const matchRuntime=window.CaosMatchState'),statePos=finalGame.indexOf('let {score,level,xp,xpNeed');
if(domainPos<0||statePos<0||domainPos>statePos)throw Error('domain APIs are not initialized before state factories');
console.log('P2 OK: match, waves, enemies, projectiles, multiplayer and render state boundaries extracted');
