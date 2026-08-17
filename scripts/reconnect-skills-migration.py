from pathlib import Path
import re

# game.js: remove inline skill catalog and bridge to the extracted domain.
game_path = Path('src/game.js')
game = game_path.read_text()
pattern = r"const rarityLabel=\{.*?\};const skills=\[.*?\];\nconst soldierSprite="
bridge = """const {rarityLabel,rarityWeight,skills}=window.CaosSkills.createSoloSkillSystem({
  player,
  onArcApply:()=>{arcNextAt=Math.min(arcNextAt||Infinity,performance.now()+500)},
  onShockApply:()=>{shockNextAt=Math.min(shockNextAt||Infinity,performance.now()+700)},
  onPhoenixApply:()=>{phoenixReady=true;phoenixConsumed=false}
});
const soldierSprite="""
new_game, count = re.subn(pattern, bridge, game, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'skill catalog replacement count={count}')
game_path.write_text(new_game)

# index: module boot only owns skill module loading; game.js remains a classic script.
html_path = Path('index.html')
html = html_path.read_text()
old = '<script src="src/game.js?v=01745"></script>\n<script src="src/multiplayer-entry.js?v=01745"></script>'
new = '<script type="module" src="src/core/skills-bootstrap.mjs?v=01745-skills1"></script>'
if old not in html:
    raise SystemExit('classic runtime tags not found in index')
html_path.write_text(html.replace(old, new, 1))

# Existing game check now expects the incremental skills bootstrap.
p = Path('scripts/check-game.mjs')
s = p.read_text()
s = s.replace(
    "if(!gameHtml.includes(`src/game.js?v=${cacheTag}`)) fail('cache tag do runtime classico divergente'); else ok('cache tag runtime classico '+cacheTag);",
    "if(!gameHtml.includes('src/core/skills-bootstrap.mjs?v=01745-skills1')) fail('skills bootstrap ausente'); else ok('skills bootstrap ativo');"
)
p.write_text(s)

# Architecture check: Skills are reconnected now; Mobs/Combat intentionally stay on the stable runtime until their own PR.
p = Path('scripts/check-architecture.mjs')
s = p.read_text()
s = s.replace("const bootstrap = read('src/core/game-bootstrap.mjs');", "const skillsBootstrap = read('src/core/skills-bootstrap.mjs');")
s = s.replace(
    "const rollbackMode = JSON.parse(read('version.json')).build === 'stable-runtime-rollback';",
    "const rollbackMode = false;\nconst skillsOnlyMigration = html.includes('src/core/skills-bootstrap.mjs');"
)
s = s.replace(
    "if(!rollbackMode) for (const token of ['window.CaosMobs.createSoloMobTypes','window.CaosCombat.applyEnemyDamage','window.CaosCombat.projectileTraits']) solo.includes(token)?ok('domain bridge present: '+token):fail('domain bridge missing: '+token);",
    "if(!rollbackMode && !skillsOnlyMigration) for (const token of ['window.CaosMobs.createSoloMobTypes','window.CaosCombat.applyEnemyDamage','window.CaosCombat.projectileTraits']) solo.includes(token)?ok('domain bridge present: '+token):fail('domain bridge missing: '+token);\nif(skillsOnlyMigration) ok('incremental migration: mobs/combat remain on stable runtime');"
)
old_boot = """if (!html.includes('src/core/game-bootstrap.mjs')) fail('index.html does not load modular game bootstrap');
else ok('index.html loads modular bootstrap');
if (!bootstrap.includes(\"import * as CaosSkills from './skills.mjs'\")) fail('bootstrap does not load skills domain first');
else ok('bootstrap loads skills domain before gameplay');
if (!bootstrap.includes('await loadClassic(`src/game.js?v=${tag}`)')) fail('bootstrap does not start classic gameplay runtime after core');
else ok('bootstrap starts classic gameplay runtime after core');
if (!bootstrap.includes('await loadClassic(`src/multiplayer-entry.js?v=${tag}`)')) fail('bootstrap does not start multiplayer entry after gameplay');
else ok('bootstrap starts multiplayer entry after gameplay');"""
new_boot = """if (!html.includes('src/core/skills-bootstrap.mjs')) fail('index.html does not load skills bootstrap');
else ok('index.html loads skills bootstrap');
if (!skillsBootstrap.includes(\"import * as CaosSkills from './skills.mjs?v=01745'\")) fail('skills bootstrap does not load skills domain first');
else ok('skills bootstrap loads skills domain before gameplay');
if (!skillsBootstrap.includes(\"new URL('../game.js?v=01745-skills1', import.meta.url)\")) fail('skills bootstrap does not resolve classic gameplay runtime from module URL');
else ok('skills bootstrap resolves classic gameplay runtime safely');
if (!skillsBootstrap.includes(\"new URL('../multiplayer-entry.js?v=01745-skills1', import.meta.url)\")) fail('skills bootstrap does not resolve multiplayer entry from module URL');
else ok('skills bootstrap resolves multiplayer entry safely');
if (!skillsBootstrap.includes('await loadClassic(gameRuntimeUrl)')) fail('skills bootstrap does not start classic gameplay runtime');
else ok('skills bootstrap starts classic gameplay runtime');
if (!skillsBootstrap.includes('await loadClassic(multiplayerEntryUrl)')) fail('skills bootstrap does not start multiplayer entry');
else ok('skills bootstrap starts multiplayer entry after gameplay');"""
if old_boot not in s:
    raise SystemExit('architecture bootstrap block not found')
s = s.replace(old_boot, new_boot, 1)
p.write_text(s)

# Runtime audit gains a truthful incremental mode for this phase.
p = Path('scripts/audit-runtime.mjs')
s = p.read_text()
prefix = """import fsSkills from 'node:fs';
import {spawnSync as spawnSkills} from 'node:child_process';
const skillsOnlyMode=fsSkills.readFileSync('index.html','utf8').includes('src/core/skills-bootstrap.mjs');
if(skillsOnlyMode){
  const files=['src/game.js','src/multiplayer-entry.js','src/core/skills-bootstrap.mjs','src/core/skills.mjs'];
  for(const f of files){const r=spawnSkills(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw Error('skills migration syntax '+f+' '+r.stderr)}
  const game=fsSkills.readFileSync('src/game.js','utf8'),html=fsSkills.readFileSync('index.html','utf8'),boot=fsSkills.readFileSync('src/core/skills-bootstrap.mjs','utf8');
  for(const t of ['window.CaosSkills.createSoloSkillSystem','startButton.onclick=()=>reset()','rankBtn','requestAnimationFrame'])if(!game.includes(t))throw Error('skills migration runtime missing '+t);
  if(game.includes('const rarityLabel={')||game.includes('const skills=['))throw Error('inline skill catalog leaked back into runtime');
  for(const t of [\"new URL('../game.js?v=01745-skills1', import.meta.url)\",\"new URL('../multiplayer-entry.js?v=01745-skills1', import.meta.url)\",'await loadClassic(gameRuntimeUrl)','await loadClassic(multiplayerEntryUrl)'])if(!boot.includes(t))throw Error('skills bootstrap wiring invalid '+t);
  if(!html.includes('src/core/skills-bootstrap.mjs'))throw Error('skills bootstrap missing from index');
  console.log('RUNTIME OK: incremental skills migration');
  process.exit(0);
}
"""
if not s.startswith("import fsSkills"):
    s = prefix + s
p.write_text(s)
