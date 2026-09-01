import fs from 'node:fs';

const gamePath='src/game.js';
const bootstrapPath='src/core/skills-bootstrap.mjs';
const indexPath='index.html';

const game=fs.readFileSync(gamePath,'utf8');
const oldState="const skillLv={speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,phoenix:0,armor:0,pierce:0,ghost:0,dodge:0,ice:0,shock:0,berserker:0,explosive:0};const player={x:0,y:0,r:18,speed:255,life:100,maxLife:100,inv:0,moving:false,walk:0,aim:0,shotFlash:0,fireRate:.28,xpMult:1,regen:0,flashDamage:0,bloodChance:0,bloodHeal:0,damage:2,armorReduction:0,down:false,downKiller:null};const duoPlayer={x:84,y:0,r:18,speed:255,life:100,maxLife:100,moving:false,walk:0,aim:0,shotFlash:0,connected:false,down:false,fireRate:.28,xpMult:1,regen:0,armorReduction:0,damage:2,bloodChance:0,bloodHeal:0,flashDamage:0,arcLv:0,pierceLv:0,phoenixReady:false,phoenixConsumed:false,invUntil:0,lastDamageAt:0,downKiller:null};const duoInput={dx:0,dy:0};const duoSkillLv={speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,phoenix:0,armor:0,pierce:0};";
const newState="const runtimeState=window.CaosRuntimeState;if(!runtimeState)throw Error('CAOS RuntimeState indisponivel');const skillLv=runtimeState.createSoloSkillLevels(),player=runtimeState.createPlayer(),duoPlayer=runtimeState.createDuoPlayer(),duoInput=runtimeState.createDuoInput(),duoSkillLv=runtimeState.createDuoSkillLevels();";

if(!game.includes(oldState)){
  if(!game.includes('const runtimeState=window.CaosRuntimeState'))throw Error('P1 state extraction anchor not found');
}else{
  fs.writeFileSync(gamePath,game.replace(oldState,newState));
}

let bootstrap=fs.readFileSync(bootstrapPath,'utf8');
const guardianPatch=/\s*one\(\s*"const skillLv=\{speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,phoenix:0,armor:0,pierce:0,ghost:0,dodge:0,ice:0,shock:0,berserker:0,explosive:0\};",\s*"const skillLv=\{speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,phoenix:0,armor:0,pierce:0,ghost:0,dodge:0,ice:0,shock:0,berserker:0,explosive:0,guardian:0\};",\s*'solo-state'\s*\);/m;
if(guardianPatch.test(bootstrap)) bootstrap=bootstrap.replace(guardianPatch,'\n  // guardian now belongs to src/core/runtime-state.js');
if(bootstrap.includes("'solo-state'"))throw Error('legacy guardian state patch still present');
fs.writeFileSync(bootstrapPath,bootstrap);

let index=fs.readFileSync(indexPath,'utf8');
const runtimeTag='<script src="src/core/runtime-state.js?v=01748-p1"></script>';
if(!index.includes(runtimeTag)){
  const anchor='<script type="module" src="src/core/skills-bootstrap.mjs?v=01747-guardian2"></script>';
  if(!index.includes(anchor))throw Error('skills bootstrap tag not found in index.html');
  index=index.replace(anchor,runtimeTag+anchor);
  fs.writeFileSync(indexPath,index);
}

const finalGame=fs.readFileSync(gamePath,'utf8');
if(finalGame.includes(oldState))throw Error('inline player state was not removed');
if(!finalGame.includes('runtimeState.createPlayer()'))throw Error('runtime player factory not wired');
console.log('P1 OK: player, P2, input and skill state extracted from game.js');
