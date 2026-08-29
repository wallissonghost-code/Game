import fs from 'node:fs';

const hookPath='src/liveplus-runtime-hook.js';
const companionPath='src/companions/ghost-ally.js';
const patchPath='src/liveplus-caos-action-patch.js';
const indexPath='index.html';
const hook=fs.readFileSync(hookPath,'utf8');
const companion=fs.readFileSync(companionPath,'utf8');
const patch=fs.readFileSync(patchPath,'utf8');
const index=fs.readFileSync(indexPath,'utf8');

const companionPos=index.indexOf('src/companions/ghost-ally.js');
const hookPos=index.indexOf('src/liveplus-runtime-hook.js');
const checks=[
  ['manifest action ghostally',/id:'ghostally'/.test(patch)],
  ['ghost duration param',/id:'ghostally'[\s\S]*number\('seconds'/.test(patch)],
  ['ghost player HUD side',/id:'ghostally'[\s\S]*hudSide:'player'/.test(patch)],
  ['isolated companion module exists',/CaosGhostAllyCompanion/.test(companion)&&/LIVEPLUS_GHOST_ALLY_V2/.test(companion)],
  ['companion loads before runtime hook',companionPos>=0&&hookPos>companionPos],
  ['runtime hook delegates companion patch',/CaosGhostAllyCompanion/.test(hook)&&/companion\.apply\(out\)/.test(hook)],
  ['spawn function',/function spawnLivePlusGhostAlly\(/.test(companion)],
  ['command dispatch',/c==='ghostally'[^\n]*spawnLivePlusGhostAlly\(d\)/.test(companion)],
  ['per-frame update function',/function updateLivePlusGhostAllies\(dt\)/.test(companion)],
  ['render drives update',/drawLivePlusGhostAllies\(\)[\s\S]{0,400}updateLivePlusGhostAllies\(dt\)/.test(companion)],
  ['ally movement',/g\.x\+=dx\/d\*step/.test(companion)&&/g\.y\+=dy\/d\*step/.test(companion)],
  ['shared target candidates',/livePlusGhostRefreshCandidates/.test(companion)&&/livePlusGhostCandidates/.test(companion)],
  ['target search throttled',/seekMs:125/.test(companion)&&/livePlusGhostCandidatesAt/.test(companion)&&/g\.targetUntil/.test(companion)],
  ['adaptive shooter budget',/shooters:6/.test(companion)&&/shooters:2/.test(companion)&&/livePlusGhostActiveShooter/.test(companion)],
  ['ghost projectile cap',/bulletCap:16/.test(companion)&&/bulletCap:6/.test(companion)&&/ghostBullets>=perf\.bulletCap/.test(companion)],
  ['player-safe shot geometry',/livePlusGhostSegmentClear/.test(companion)&&/player\.x,player\.y/.test(companion)],
  ['projectile creation',/bullets\.push\(\{[\s\S]*livePlusGhost:true/.test(companion)],
  ['rifle uses player weapon frames',/playerWeaponFrames/.test(companion)&&/livePlusGhostDrawWeapon/.test(companion)&&/weaponSprite/.test(companion)],
  ['muzzle aligned to weapon direction',/muzzleLocal\(dir\)/.test(companion)&&/shotFlash/.test(companion)],
  ['cached username width',/nameWidth/.test(companion)&&/if\(!g\.nameWidth\)/.test(companion)],
  ['performance telemetry',/__caosGhostPerf/.test(companion)],
  ['ghost rendered in game loop',/drawDuoPlayer\(\);drawLivePlusGhostAllies\(\);drawPlayer\(\);/.test(companion)]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ghostally: ${name}`);
if(failed.length){
  console.error(`\nGHOSTALLY CI BLOCKED: ${failed.length} required gameplay/performance link(s) missing.`);
  process.exit(1);
}
console.log('\nGHOSTALLY CI OK: isolated module + spawn → move → shared target → adaptive safe fire → rifle render chain present.');
