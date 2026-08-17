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
import {
  SKILL_IDS,
  SKILL_CAPS,
  SKILL_BALANCE,
  RARITY_WEIGHT,
  assertSkillCatalog,
  createSoloSkillSystem
} from '../src/core/skills.mjs';
import { assertMobDomain } from '../src/core/mobs.mjs';
import { assertCombatDomain } from '../src/core/combat.mjs';

const fail = message => {
  console.error('ARCH FAIL:', message);
  process.exitCode = 1;
};
const ok = message => console.log('ARCH OK:', message);
const read = path => fs.readFileSync(path, 'utf8');

const solo = read('src/game.js');
const html = read('index.html');
const skillsBootstrap = read('src/core/skills-bootstrap.mjs');
const skillsSource = read('src/core/skills.mjs');
const mobsSource = read('src/core/mobs.mjs');
const combatSource = read('src/core/combat.mjs');
const soloContractView = solo+'\n'+mobsSource+'\n'+combatSource+'\n'+read('src/core/contracts.mjs');
const mpClient = read('src/multiplayer-v2.js');
const mpServer = read('cloud/game-server-v3.mjs');
const rollbackMode = false;
const skillsOnlyMigration = false;
const mobsCombatMigration = html.includes('src/core/skills-bootstrap.mjs') && skillsBootstrap.includes("import * as CaosMobs from './mobs.mjs?v=01745'") && skillsBootstrap.includes("import * as CaosCombat from './combat.mjs?v=01745'");


// Core formulas must remain identical while extraction is incremental.
const xpFormula = '60*Math.pow(Math.max(1,lv),1.42)';
for (const [name, source] of [['solo', soloContractView], ['multiplayer server', mpServer]]) {
  source.includes(xpFormula) ? ok(`${name} XP formula matches contract`) : fail(`${name} XP formula drifted from contract`);
}
if (xpNeedFor(1) !== 60 || xpNeedFor(40) <= xpNeedFor(39)) fail('canonical xpNeedFor sanity check failed');
else ok('canonical xpNeedFor sanity check');

// Mob identity contract. This catches silent balance/name drift between Solo and Multiplayer.
for (const [id, mob] of Object.entries(ENEMY_TYPES)) {
  for (const [name, source] of [['solo', soloContractView], ['multiplayer server', mpServer]]) {
    if (!source.includes(mob.name)) fail(`${name} missing mob ${id}/${mob.name}`);
  }
}
ok(`${Object.keys(ENEMY_TYPES).length} canonical mob identities checked`);

// Tier/Boss multipliers are intentionally duplicated today; CI prevents them diverging
// until both runtimes import contracts.mjs directly.
const tierExpectations = [
  ['elite1', TIER_VARIANTS.elite1, {hp:3,dmg:1.7,speed:1.05}],
  ['corrupted2', TIER_VARIANTS.corrupted2, {hp:7,dmg:2.75,speed:1.16}],
  ['bossElite', BOSS_VARIANTS.elite, {hp:1.75,dmg:1.25,speed:1.05}],
  ['bossCorrupted', BOSS_VARIANTS.corrupted, {hp:2.5,dmg:1.5,speed:1.10}]
];
for (const [name, actual, expected] of tierExpectations) {
  for (const key of ['hp','dmg','speed']) {
    if (actual[key] !== expected[key]) fail(`canonical tier contract mismatch: ${name}.${key}=${actual[key]} expected ${expected[key]}`);
  }
  const sig = `hp:${expected.hp},dmg:${expected.dmg},speed:${expected.speed}`;
  if (!mpServer.includes(sig)) fail(`multiplayer tier contract mismatch: ${sig}`);
}
ok('canonical tier/boss contracts validated; multiplayer duplicate guarded');

try { assertMobDomain(); ok('mob domain behavior validates'); } catch (error) { fail(error.message); }
try { assertCombatDomain(); ok('combat domain behavior validates'); } catch (error) { fail(error.message); }
if(!rollbackMode && !skillsOnlyMigration) for (const token of ['window.CaosMobs.createSoloMobTypes','window.CaosCombat.applyEnemyDamage','window.CaosCombat.projectileTraits']) solo.includes(token)?ok('domain bridge present: '+token):fail('domain bridge missing: '+token);
if(!mobsCombatMigration) fail('Phase 3 bootstrap missing mobs/combat domains');
else ok('Phase 3 bootstrap owns mobs/combat domains');

if (rollbackMode) {
  if (!solo.includes('const skills=[') || !html.includes('src/game.js?v=01745')) fail('stable rollback runtime missing');
  else ok('stable rollback runtime active');
  console.log('ARCH OK: rollback compatibility mode');
  process.exit(process.exitCode || 0);
}

// Phase 2: Skills are a real domain now, not an inline catalog in game.js.
try { assertSkillCatalog(); ok('canonical skill catalog validates'); }
catch (error) { fail(error.message); }

if (JSON.stringify([...SKILL_IDS].sort()) !== JSON.stringify([...SOLO_SKILL_IDS].sort())) {
  fail('skills.mjs IDs differ from canonical Solo skill IDs');
} else ok(`${SKILL_IDS.length} Solo skills owned by skills.mjs`);

for (const id of SKILL_IDS) {
  if (!skillsSource.includes(`id:'${id}'`)) fail(`extracted skill definition missing: ${id}`);
  if (!Number.isInteger(SKILL_CAPS[id]) || SKILL_CAPS[id] < 1) fail(`invalid skill cap: ${id}`);
}

if (solo.includes('const skills=[') || solo.includes('const rarityLabel={')) {
  fail('game.js still owns inline skill catalog after Phase 2');
} else ok('game.js no longer owns inline skill catalog');

for (const token of ['window.CaosSkills.createSoloSkillSystem', 'onArcApply', 'onShockApply', 'onPhoenixApply']) {
  solo.includes(token) ? ok(`Solo skill bridge present: ${token}`) : fail(`Solo skill bridge missing: ${token}`);
}

if (!html.includes('src/core/skills-bootstrap.mjs')) fail('index.html does not load skills bootstrap');
else ok('index.html loads skills bootstrap');
if (!skillsBootstrap.includes("import * as CaosSkills from './skills.mjs?v=01745'")) fail('skills bootstrap does not load skills domain first');
else ok('skills bootstrap loads skills domain before gameplay');
if (!skillsBootstrap.includes("new URL('../game.js?v=01745-core3', import.meta.url)")) fail('skills bootstrap does not resolve classic gameplay runtime from module URL');
else ok('skills bootstrap resolves classic gameplay runtime safely');
if (!skillsBootstrap.includes("new URL('../multiplayer-entry.js?v=01745-core3', import.meta.url)")) fail('skills bootstrap does not resolve multiplayer entry from module URL');
else ok('skills bootstrap resolves multiplayer entry safely');
if (!skillsBootstrap.includes('await loadClassic(gameRuntimeUrl)')) fail('skills bootstrap does not start classic gameplay runtime');
else ok('skills bootstrap starts classic gameplay runtime');
if (!skillsBootstrap.includes('await loadClassic(multiplayerEntryUrl)')) fail('skills bootstrap does not start multiplayer entry');
else ok('skills bootstrap starts multiplayer entry after gameplay');


// Phase 3: duplicated Solo mob/combat rules must not return to game.js.
for (const token of ["const types={wraith:","function enemyTier(){const r=Math.random()","function furyProfile(stage){stage=Math.max","explosiveShotCounter++;const every=[0,14,13,12,11,10]"]) if (solo.includes(token)) fail('Phase 3 duplicate logic returned to game.js: '+token);
for (const token of ['window.CaosMobs.createSoloMobTypes','window.CaosMobs.enemyTier','window.CaosMobs.variantFor','window.CaosCombat.furyProfile','window.CaosCombat.applyEnemyDamage','window.CaosCombat.projectileTraits']) if (!solo.includes(token)) fail('Phase 3 domain bridge missing: '+token);
ok('Phase 3 mobs/combat duplicate guards passed');

// Behavioral smoke test of extracted modifiers without Canvas/DOM.
const player = { speed:255, maxLife:100, life:50, fireRate:.28, regen:0, armorReduction:0, xpMult:1, bloodChance:0, bloodHeal:0, flashDamage:0 };
let arc=0, shock=0, phoenix=0;
const domain = createSoloSkillSystem({ player, onArcApply:()=>arc++, onShockApply:()=>shock++, onPhoenixApply:()=>phoenix++ });
const byId = Object.fromEntries(domain.skills.map(skill => [skill.id, skill]));
byId.speed.apply(3);
byId.medic.apply(1);
byId.rapid.apply(5);
byId.regen.apply(5);
byId.armor.apply(4);
byId.xp.apply(5);
byId.blood.apply(5);
byId.flash.apply(5);
byId.arc.apply(1);
byId.shock.apply(1);
byId.phoenix.apply(1);
if (player.speed !== 331.5) fail(`speed skill behavior drifted: ${player.speed}`);
if (player.maxLife !== 110 || player.life !== 75) fail('medic skill behavior drifted');
if (Math.abs(player.fireRate - .112) > 1e-9) fail(`rapid skill behavior drifted: ${player.fireRate}`);
if (player.regen !== 1.2 || player.armorReduction !== .18 || player.xpMult !== 2) fail('core modifier behavior drifted');
if (player.bloodChance !== .20 || player.bloodHeal !== 2 || player.flashDamage !== 18) fail('combat modifier behavior drifted');
if (arc !== 1 || shock !== 1 || phoenix !== 1) fail('skill runtime hooks drifted');
else ok('extracted skill behavior smoke test passed');

if (RARITY_WEIGHT.secret !== .35 || SKILL_BALANCE.explosiveRadius[5] !== 95) fail('skill balance constants drifted');
else ok('skill balance constants validated');

// Skill gap is explicit technical debt instead of hidden drift.
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
