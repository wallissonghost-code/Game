import fs from 'node:fs';

const hookPath='src/liveplus-runtime-hook.js';
const patchPath='src/liveplus-caos-action-patch.js';
const hook=fs.readFileSync(hookPath,'utf8');
const patch=fs.readFileSync(patchPath,'utf8');

const checks=[
  ['manifest action ghostally',/id:'ghostally'/.test(patch)],
  ['ghost duration param',/id:'ghostally'[\s\S]*number\('seconds'/.test(patch)],
  ['ghost player HUD side',/id:'ghostally'[\s\S]*hudSide:'player'/.test(patch)],
  ['runtime injection marker',/LIVEPLUS_GHOST_ALLY/.test(hook)],
  ['spawn function',/function spawnLivePlusGhostAlly\(/.test(hook)],
  ['command dispatch',/c==='ghostally'[^\n]*spawnLivePlusGhostAlly\(d\)/.test(hook)],
  ['per-frame update function',/function updateLivePlusGhostAllies\(dt\)/.test(hook)],
  ['render drives update',/drawLivePlusGhostAllies\(\)[\s\S]{0,300}updateLivePlusGhostAllies\(dt\)/.test(hook)],
  ['ally movement',/g\.x\+=dx\/d\*step/.test(hook)&&/g\.y\+=dy\/d\*step/.test(hook)],
  ['target acquisition',/function livePlusGhostTarget\(g\)/.test(hook)&&/for\(const e of enemies\)/.test(hook)],
  ['player-safe shot geometry',/livePlusGhostSegmentClear/.test(hook)&&/player\.x,player\.y/.test(hook)],
  ['projectile creation',/bullets\.push\(\{[\s\S]*livePlusGhost:true/.test(hook)],
  ['shot cadence',/g\.nextShot=now\+/.test(hook)],
  ['ghost rendered in game loop',/drawDuoPlayer\(\);drawLivePlusGhostAllies\(\);drawPlayer\(\);/.test(hook)]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ghostally: ${name}`);
if(failed.length){
  console.error(`\nGHOSTALLY CI BLOCKED: ${failed.length} required gameplay link(s) missing.`);
  process.exit(1);
}
console.log('\nGHOSTALLY CI OK: spawn → update → move → target → safe shot → render chain present.');
