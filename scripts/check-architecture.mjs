import fs from 'node:fs';
import {
  ENEMY_TYPES,
  TIER_VARIANTS,
  BOSS_VARIANTS,
  SOLO_SKILL_IDS,
  MULTIPLAYER_SKILL_IDS,
  MULTIPLAYER_SKILL_GAP,
  LIMITS,
  xpNeedFor
} from '../src/core/contracts.mjs';

const fail = message => {
  console.error('ARCH FAIL:', message);
  process.exitCode = 1;
};
const ok = message => console.log('ARCH OK:', message);
const read = path => fs.readFileSync(path, 'utf8');

const solo = read('src/game.js');
const mpClient = read('src/multiplayer-v2.js');
const mpServer = read('cloud/game-server-v3.mjs');

// Core formulas must remain identical while extraction is incremental.
const xpFormula = '60*Math.pow(Math.max(1,lv),1.42)';
for (const [name, source] of [['solo', solo], ['multiplayer server', mpServer]]) {
  source.includes(xpFormula) ? ok(`${name} XP formula matches contract`) : fail(`${name} XP formula drifted from contract`);
}
if (xpNeedFor(1) !== 60 || xpNeedFor(40) <= xpNeedFor(39)) fail('canonical xpNeedFor sanity check failed');
else ok('canonical xpNeedFor sanity check');

// Mob identity contract. This catches silent balance/name drift between Solo and Multiplayer.
for (const [id, mob] of Object.entries(ENEMY_TYPES)) {
  for (const [name, source] of [['solo', solo], ['multiplayer server', mpServer]]) {
    if (!source.includes(mob.name)) fail(`${name} missing mob ${id}/${mob.name}`);
  }
}
ok(`${Object.keys(ENEMY_TYPES).length} canonical mob identities checked`);

// Tier/Boss multipliers are intentionally duplicated today; CI prevents them diverging
// until both runtimes import contracts.mjs directly.
const tierSignatures = [
  `hp:${TIER_VARIANTS.elite1.hp},dmg:${TIER_VARIANTS.elite1.dmg},speed:${TIER_VARIANTS.elite1.speed}`,
  `hp:${TIER_VARIANTS.corrupted2.hp},dmg:${TIER_VARIANTS.corrupted2.dmg},speed:${TIER_VARIANTS.corrupted2.speed}`,
  `hp:${BOSS_VARIANTS.elite.hp},dmg:${BOSS_VARIANTS.elite.dmg},speed:${BOSS_VARIANTS.elite.speed}`,
  `hp:${BOSS_VARIANTS.corrupted.hp},dmg:${BOSS_VARIANTS.corrupted.dmg},speed:${BOSS_VARIANTS.corrupted.speed}`
];
for (const sig of tierSignatures) {
  if (!solo.includes(sig)) fail(`solo tier contract mismatch: ${sig}`);
  if (!mpServer.includes(sig)) fail(`multiplayer tier contract mismatch: ${sig}`);
}
ok('tier and boss multipliers guarded against cascade drift');

// Skill gap is explicit technical debt instead of hidden drift.
for (const id of SOLO_SKILL_IDS) {
  if (!solo.includes(`${id}:0`) && !solo.includes(`id:'${id}'`)) fail(`solo canonical skill missing: ${id}`);
}
for (const id of MULTIPLAYER_SKILL_IDS) {
  if (!mpServer.includes(`${id}:`) && !mpServer.includes(`id:'${id}'`)) fail(`multiplayer canonical skill missing: ${id}`);
}
const expectedGap = ['ghost', 'dodge', 'ice', 'shock', 'berserker', 'explosive'];
if (JSON.stringify(MULTIPLAYER_SKILL_GAP) !== JSON.stringify(expectedGap)) {
  fail(`multiplayer skill gap changed unexpectedly: ${MULTIPLAYER_SKILL_GAP.join(', ')}`);
} else {
  ok(`multiplayer skill gap explicitly tracked: ${MULTIPLAYER_SKILL_GAP.join(', ')}`);
}

// Network limits are architecture contracts, not magic numbers allowed to drift unnoticed.
for (const [token, value] of [
  ['TICK_RATE', LIMITS.multiplayer.tickRate],
  ['SNAPSHOT_RATE', LIMITS.multiplayer.snapshotRate],
  ['MAX_ENEMIES', LIMITS.multiplayer.maxEnemies],
  ['MAX_BULLETS', LIMITS.multiplayer.maxBullets]
]) {
  if (!mpServer.includes(`${token}=${value}`)) fail(`multiplayer ${token} differs from core contract ${value}`);
}
if (!solo.includes(`MAX_ENEMIES=${LIMITS.solo.maxEnemies}`)) fail(`solo MAX_ENEMIES differs from core contract ${LIMITS.solo.maxEnemies}`);
else ok('entity/network limits guarded');

// Make sure the active multiplayer client keeps prediction/interpolation primitives.
for (const primitive of ['pendingInputs', 'lastAck', 'interpActor', 'requestAnimationFrame(frame)', 'sendInput(false)']) {
  mpClient.includes(primitive) ? ok(`multiplayer primitive present: ${primitive}`) : fail(`multiplayer primitive missing: ${primitive}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('ARCH OK: core contract guard completed');
