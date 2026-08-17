import fs from 'node:fs';

const GAME='src/game.js';
const CHECK='scripts/check-architecture.mjs';
let game=fs.readFileSync(GAME,'utf8');
let check=fs.readFileSync(CHECK,'utf8');

function replaceGame(pattern,replacement,label){
  const before=game;
  game=game.replace(pattern,replacement);
  if(game===before)throw new Error(`Phase 3: game replacement not found: ${label}`);
  console.log('PHASE3 GAME OK:',label);
}
function replaceCheck(pattern,replacement,label){
  const before=check;
  check=check.replace(pattern,replacement);
  if(check===before)throw new Error(`Phase 3: architecture replacement not found: ${label}`);
  console.log('PHASE3 CHECK OK:',label);
}

// Mobs: catalog and variant rules now belong to src/core/mobs.mjs.
replaceGame(
  /const BOSS_VARIANTS=\{[\s\S]*?\};const TIER_VARIANTS=\{[\s\S]*?\};function xpNeedFor/,
  'function xpNeedFor',
  'remove inline mob variant contracts'
);
replaceGame(
  /const types=\{wraith:[\s\S]*?voidlord:\{name:'Ogro do Vazio'[\s\S]*?\}\};\nconst \{rarityLabel/,
  "const types=window.CaosMobs.createSoloMobTypes();\nconst {rarityLabel",
  'use canonical mob catalog'
);
replaceGame(
  /function enemyTier\(\)\{[\s\S]*?\}function makeEnemy/,
  "function enemyTier(){return window.CaosMobs.enemyTier(level)}function enemyEvolution(tier){return window.CaosMobs.enemyEvolution(tier,level)}function bossTier(forced=null){return window.CaosMobs.bossTier(forced)}function makeEnemy",
  'delegate tier and evolution rules'
);
replaceGame(
  /,tier=c\.boss\?bossTier\(forcedTier\):\(forcedTier===1\|\|forcedTier===2\?forcedTier:enemyTier\(\)\),evolution=c\.boss\?1:enemyEvolution\(tier\),bossVar=c\.boss\?[\s\S]*?hitboxMult=c\.boss\?1:variant\.hitbox;if/,
  ",tier=c.boss?bossTier(forcedTier):(forcedTier===1||forcedTier===2?forcedTier:enemyTier()),evolution=c.boss?1:enemyEvolution(tier),variant=window.CaosMobs.variantFor({boss:!!c.boss,tier,evolution}),hpMult=variant.hp,dmgMult=variant.dmg,xpMult=variant.xp,hitboxMult=c.boss?1:variant.hitbox;if",
  'delegate mob variant selection'
);
replaceGame(
  /speed:\(c\.s\+Math\.random\(\)\*8\)\*\(c\.boss\?bossVar\.speed:variant\.speed\)/,
  'speed:(c.s+Math.random()*8)*variant.speed',
  'use canonical variant speed'
);

// Combat: fury, damage mitigation and projectile sequencing now belong to combat.mjs.
replaceGame(
  /function furyProfile\(stage\)\{[\s\S]*?\}\s*function triggerBossFury/,
  "function furyProfile(stage){return window.CaosCombat.furyProfile(stage)}\nfunction triggerBossFury",
  'delegate fury profile'
);
replaceGame(
  /function furyResist\(e\)\{[\s\S]*?\}\s*function hurtEnemy\(e,amount,kind='normal'\)\{[\s\S]*?\}\s*function applyIceHit/,
  "function furyResist(e){return window.CaosCombat.furyResist(e)}\nfunction hurtEnemy(e,amount,kind='normal'){const dealt=window.CaosCombat.applyEnemyDamage(e,amount);if(dealt>0)addDamageFx(e,dealt,kind);return dealt}\nfunction applyIceHit",
  'delegate fury resistance and enemy damage'
);
replaceGame(
  /,pl=skillLv\.pierce\|\|0,il=skillLv\.ice\|\|0,xl=skillLv\.explosive\|\|0,bs=berserkerState\(\);let pierceLeft=0,ice=false,explosive=false;if\(xl\)[\s\S]*?pierceLeft=\[0,2,3,4,5,7\]\[pl\]\}\}/,
  ",bs=berserkerState(),traits=window.CaosCombat.projectileTraits(skillLv,{pierce:pierceShotCounter,ice:iceShotCounter,explosive:explosiveShotCounter});pierceShotCounter=traits.counters.pierce;iceShotCounter=traits.counters.ice;explosiveShotCounter=traits.counters.explosive;const {pierceLeft,ice,explosive}=traits",
  'delegate projectile sequencing'
);

// Architecture guard: Phase 3 is no longer skills-only.
replaceCheck(
  "const skillsOnlyMigration = html.includes('src/core/skills-bootstrap.mjs');",
  "const skillsOnlyMigration = false;\nconst mobsCombatMigration = html.includes('src/core/skills-bootstrap.mjs') && skillsBootstrap.includes(\"import * as CaosMobs from './mobs.mjs?v=01745'\") && skillsBootstrap.includes(\"import * as CaosCombat from './combat.mjs?v=01745'\");",
  'enable mobs/combat architecture checks'
);
replaceCheck(
  "if(skillsOnlyMigration) ok('incremental migration: mobs/combat remain on stable runtime');",
  "if(!mobsCombatMigration) fail('Phase 3 bootstrap missing mobs/combat domains');\nelse ok('Phase 3 bootstrap owns mobs/combat domains');",
  'guard phase 3 bootstrap'
);
replaceCheck(
  "if (!skillsBootstrap.includes(\"new URL('../game.js?v=01745-skills1', import.meta.url)\")) fail('skills bootstrap does not resolve classic gameplay runtime from module URL');",
  "if (!skillsBootstrap.includes(\"new URL('../game.js?v=01745-core3', import.meta.url)\")) fail('skills bootstrap does not resolve classic gameplay runtime from module URL');",
  'update game cache tag guard'
);
replaceCheck(
  "if (!skillsBootstrap.includes(\"new URL('../multiplayer-entry.js?v=01745-skills1', import.meta.url)\")) fail('skills bootstrap does not resolve multiplayer entry from module URL');",
  "if (!skillsBootstrap.includes(\"new URL('../multiplayer-entry.js?v=01745-core3', import.meta.url)\")) fail('skills bootstrap does not resolve multiplayer entry from module URL');",
  'update multiplayer cache tag guard'
);

const phase3Guard=`\n// Phase 3: duplicated Solo mob/combat rules must not return to game.js.\nfor (const token of [\n  \"const types={wraith:\",\n  \"function enemyTier(){const r=Math.random()\",\n  \"function furyProfile(stage){stage=Math.max\",\n  \"explosiveShotCounter++;const every=[0,14,13,12,11,10]\"\n]) {\n  if (solo.includes(token)) fail('Phase 3 duplicate logic returned to game.js: '+token);\n}\nfor (const token of [\n  'window.CaosMobs.createSoloMobTypes',\n  'window.CaosMobs.enemyTier',\n  'window.CaosMobs.variantFor',\n  'window.CaosCombat.furyProfile',\n  'window.CaosCombat.applyEnemyDamage',\n  'window.CaosCombat.projectileTraits'\n]) {\n  if (!solo.includes(token)) fail('Phase 3 domain bridge missing: '+token);\n}\nok('Phase 3 mobs/combat duplicate guards passed');\n`;
const marker='// Behavioral smoke test of extracted modifiers without Canvas/DOM.';
if(!check.includes(marker))throw new Error('Phase 3 architecture insertion marker missing');
check=check.replace(marker,phase3Guard+'\n'+marker);

// Final sanity checks before writing.
for(const token of ['window.CaosMobs.createSoloMobTypes','window.CaosMobs.variantFor','window.CaosCombat.applyEnemyDamage','window.CaosCombat.projectileTraits']){
  if(!game.includes(token))throw new Error('Phase 3 final bridge missing: '+token);
}
if(game.includes("const types={wraith:"))throw new Error('Phase 3 inline mob catalog still present');
if(game.includes("function furyProfile(stage){stage=Math.max"))throw new Error('Phase 3 inline fury profile still present');

fs.writeFileSync(GAME,game);
fs.writeFileSync(CHECK,check);
console.log('PHASE3 COMPLETE', {gameBytes:game.length, checkBytes:check.length});
