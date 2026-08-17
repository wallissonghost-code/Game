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
