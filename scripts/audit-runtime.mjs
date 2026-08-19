import fsSkills from 'node:fs';
import {spawnSync as spawnSkills} from 'node:child_process';
const skillsOnlyMode=fsSkills.readFileSync('index.html','utf8').includes('src/core/skills-bootstrap.mjs');
if(skillsOnlyMode){
  const files=['src/game.js','src/multiplayer-entry.js','src/core/skills-bootstrap.mjs','src/core/skills.mjs','src/core/mobs.mjs','src/core/combat.mjs'];
  for(const f of files){const r=spawnSkills(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw Error('core migration syntax '+f+' '+r.stderr)}
  const game=fsSkills.readFileSync('src/game.js','utf8'),html=fsSkills.readFileSync('index.html','utf8'),boot=fsSkills.readFileSync('src/core/skills-bootstrap.mjs','utf8');
  for(const t of ['window.CaosSkills.createSoloSkillSystem','startButton.onclick=()=>reset()','rankBtn','requestAnimationFrame'])if(!game.includes(t))throw Error('core migration runtime missing '+t);
  if(game.includes('const rarityLabel={')||game.includes('const skills=['))throw Error('inline skill catalog leaked back into runtime');
  for(const t of ["import * as CaosMobs from './mobs.mjs?v=01745'","import * as CaosCombat from './combat.mjs?v=01745'","new URL('../game.js?v=01746-close-parallax2',import.meta.url)","new URL('../multiplayer-entry.js?v=01745-core3',import.meta.url)",'await loadPatchedClassic(gameRuntimeUrl)','await loadClassic(multiplayerEntryUrl)'])if(!boot.includes(t))throw Error('core bootstrap wiring invalid '+t);
  if(!html.includes('src/core/skills-bootstrap.mjs'))throw Error('core bootstrap missing from index');
  console.log('RUNTIME OK: incremental skills+mobs+combat migration');
  process.exit(0);
}
import fsRollback from 'node:fs';
const rollbackMode=JSON.parse(fsRollback.readFileSync('version.json','utf8')).build==='stable-runtime-rollback';
if(rollbackMode){const game=fsRollback.readFileSync('src/game.js','utf8');const html=fsRollback.readFileSync('index.html','utf8');for(const t of ['startButton.onclick=()=>reset()','rankBtn','requestAnimationFrame'])if(!game.includes(t))throw Error('rollback runtime missing '+t);if(!html.includes('src/game.js?v=01745'))throw Error('rollback HTML missing classic runtime');console.log('RUNTIME OK: stable rollback smoke test');process.exit(0);}
import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const fail=m=>{console.error('AUDIT FAIL:',m);process.exitCode=1},ok=m=>console.log('AUDIT OK:',m),read=p=>fs.readFileSync(p,'utf8');
for(const f of ['src/game.js','src/multiplayer-v2.js','src/multiplayer-entry.js','src/core/game-bootstrap.mjs','src/core/skills.mjs','src/core/mobs.mjs','src/core/combat.mjs','src/core/events.mjs','src/core/effects.mjs']){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});r.status===0?ok('syntax '+f):fail('syntax '+f+' '+r.stderr)}
const game=read('src/game.js'),boot=read('src/core/game-bootstrap.mjs'),html=read('index.html');
for(const [name,token] of [['skills','globalThis.CaosSkills'],['mobs','globalThis.CaosMobs'],['combat','globalThis.CaosCombat'],['events','globalThis.CaosEvents'],['effects','globalThis.CaosEffects']]) boot.includes(token)?ok('bootstrap '+name):fail('bootstrap missing '+name);
for(const token of ['window.CaosSkills','window.CaosMobs','window.CaosCombat','window.CaosEvents','window.CaosEffects']) game.includes(token)?ok('runtime bridge '+token):fail('runtime bridge missing '+token);
if(!html.includes('src/core/game-bootstrap.mjs'))fail('index bypasses modular bootstrap');else ok('index uses modular bootstrap');
if(game.includes("const types={wraith:")||game.includes('const rarityLabel={'))fail('legacy catalogs leaked back into game.js');else ok('legacy catalogs remain extracted');
for(const token of ['requestAnimationFrame','function update(','function draw(','function shoot(','function spawn(','function boss(','function command(']) game.includes(token)?ok('critical runtime primitive '+token):fail('missing critical runtime primitive '+token);
if(process.exitCode)process.exit(process.exitCode);console.log('AUDIT OK: post-refactor runtime audit completed');
