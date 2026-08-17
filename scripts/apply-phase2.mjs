import fs from 'node:fs';

function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(from, to);
}

// 1) Extract the Solo skill catalog/factory from the legacy gameplay closure.
const gamePath = 'src/game.js';
let game = fs.readFileSync(gamePath, 'utf8');
const startToken = 'const rarityLabel=';
const endToken = '\nconst soldierSprite=';
const start = game.indexOf(startToken);
const end = game.indexOf(endToken, start);
if (start < 0 || end < 0 || end <= start) throw new Error('game.js: skill block boundaries not found');

const skillBridge = `const {rarityLabel,rarityWeight,skills}=window.CaosSkills.createSoloSkillSystem({\n  player,\n  onArcApply:()=>{arcNextAt=Math.min(arcNextAt||Infinity,performance.now()+500)},\n  onShockApply:()=>{shockNextAt=Math.min(shockNextAt||Infinity,performance.now()+700)},\n  onPhoenixApply:()=>{phoenixReady=true;phoenixConsumed=false}\n});`;

game = game.slice(0, start) + skillBridge + game.slice(end);
fs.writeFileSync(gamePath, game);

// 2) Preserve script ordering: map/firebase first, then modular core -> game -> multiplayer entry.
const indexPath = 'index.html';
let html = fs.readFileSync(indexPath, 'utf8');
html = replaceOnce(
  html,
  '<script src="src/game.js?v=01743"></script>\n<script src="src/multiplayer-entry.js?v=01743"></script>',
  '<script type="module" src="src/core/game-bootstrap.mjs?v=01743"></script>',
  'index bootstrap'
);
fs.writeFileSync(indexPath, html);

// 3) Legacy regression checks see the extracted domain during the transition.
const checkPath = 'scripts/check-game.mjs';
let check = fs.readFileSync(checkPath, 'utf8');
check = replaceOnce(
  check,
  "game=read('src/game.js')",
  "game=read('src/game.js')+'\\n'+read('src/core/skills.mjs')",
  'check-game skill source'
);
check = replaceOnce(
  check,
  "if(!gameHtml.includes(`src/game.js?v=${cacheTag}`)) fail('cache tag do game.js divergente'); else ok('cache tag game.js '+cacheTag);",
  "if(!gameHtml.includes(`src/core/game-bootstrap.mjs?v=${cacheTag}`)) fail('cache tag do bootstrap modular divergente'); else ok('cache tag bootstrap modular '+cacheTag);",
  'check-game bootstrap cache'
);
fs.writeFileSync(checkPath, check);

console.log('Phase 2 migration applied: skills extracted + modular bootstrap enabled.');
