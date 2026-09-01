import fs from 'node:fs';

const gamePath='src/game.js';
const bootstrapPath='src/core/skills-bootstrap.mjs';
const indexPath='index.html';

function replaceExactly(source,from,to,label){
  const count=source.split(from).length-1;
  if(count===0&&source.includes(to))return source;
  if(count!==1)throw new Error(`P6/${label}: expected 1 match, found ${count}`);
  return source.replace(from,to);
}

let game=fs.readFileSync(gamePath,'utf8');

const oldMakeEnemy="function makeEnemy(type,near=false,forcedTier=null){if(enemies.length>=MAX_ENEMIES)return;const c=types[type];if(!c)return;const a=Math.random()*Math.PI*2,dist=near?180+Math.random()*220:Math.max(W,H)*.7+Math.random()*260,tier=c.boss?bossTier(forcedTier):(forcedTier===1||forcedTier===2?forcedTier:enemyTier()),evolution=c.boss?1:enemyEvolution(tier),variant=window.CaosMobs.variantFor({boss:!!c.boss,tier,evolution}),hpMult=variant.hp,dmgMult=variant.dmg,xpMult=variant.xp,hitboxMult=c.boss?1:variant.hitbox;if(!c.boss&&evolution===2)ensureAdvancedOgre(tier);enemies.push({x:player.x+Math.cos(a)*dist,y:player.y+Math.sin(a)*dist,type,tier,evolution,r:c.r*hitboxMult,speed:(c.s+Math.random()*8)*variant.speed,hp:Math.ceil(c.h*hpMult),max:Math.ceil(c.h*hpMult),damage:Math.ceil(c.d*dmgMult),xp:Math.ceil(c.x*xpMult),dead:false,t:Math.random()*8,seed:Math.random()*99,attackAt:0,attackFlash:0,facing:'down',skinVariant:Math.floor(Math.random()*3),aiPhase:Math.floor(Math.random()*4),mvx:0,mvy:0,xpEventMul:doubleXpEvent?2:1})}";
const newMakeEnemy="function makeEnemy(type,near=false,forcedTier=null){const built=enemiesRuntime.buildEnemySpawn({type,typeConfig:types[type],near,forcedTier,level,player,viewportWidth:W,viewportHeight:H,doubleXpEvent,enemyCount:enemies.length,maxEnemies:MAX_ENEMIES,mobDomain:window.CaosMobs});if(!built)return;if(built.advancedTier===1||built.advancedTier===2)ensureAdvancedOgre(built.advancedTier);enemies.push(built.enemy)}";
game=replaceExactly(game,oldMakeEnemy,newMakeEnemy,'enemy-builder');

const oldSpawn="function spawn(type,forcedTier=null){if(type)return makeEnemy(type,true,forcedTier);const pool=['wraith','reaper','infected','crawler','eye','brute'];makeEnemy(pool[Math.floor(Math.random()*pool.length)],false,forcedTier)}";
const newSpawn="function spawn(type,forcedTier=null){if(type)return makeEnemy(type,true,forcedTier);makeEnemy(wavesRuntime.pickEnemyType(),false,forcedTier)}";
game=replaceExactly(game,oldSpawn,newSpawn,'spawn-pool');

const oldWave="function spawnWave(){waveCount++;const softCap=Math.min(210,90+level*4),room=Math.max(0,softCap-enemies.length);if(room<=0)return;const n=Math.min(room,Math.min(18,4+Math.floor(level*.65)));for(let i=0;i<n;i++)spawn()}";
const newWave="function spawnWave(){waveCount++;const n=wavesRuntime.waveSpawnCount(level,enemies.length);for(let i=0;i<n;i++)spawn()}";
game=replaceExactly(game,oldWave,newWave,'wave-composition');

const oldBoss="function boss(type,forcedTier=null){makeEnemy(type||(((Math.floor(level/10))%2)?'colossus':'voidlord'),true,forcedTier)}";
const newBoss="function boss(type,forcedTier=null){makeEnemy(type||wavesRuntime.bossTypeForLevel(level),true,forcedTier)}";
game=replaceExactly(game,oldBoss,newBoss,'boss-composition');
fs.writeFileSync(gamePath,game);

let bootstrap=fs.readFileSync(bootstrapPath,'utf8');
bootstrap=bootstrap.replace(/\.\/waves-runtime\.mjs\?v=[^';\"]+/,"./waves-runtime.mjs?v=01753-p6");
bootstrap=bootstrap.replace(/\.\/enemies-runtime\.mjs\?v=[^';\"]+/,"./enemies-runtime.mjs?v=01753-p6");
fs.writeFileSync(bootstrapPath,bootstrap);

let index=fs.readFileSync(indexPath,'utf8');
index=index.replace(/src\/core\/skills-bootstrap\.mjs\?v=[^\"]+/,'src/core/skills-bootstrap.mjs?v=01753-p6');
fs.writeFileSync(indexPath,index);

const finalGame=fs.readFileSync(gamePath,'utf8');
const finalBootstrap=fs.readFileSync(bootstrapPath,'utf8');
if(!finalGame.includes('enemiesRuntime.buildEnemySpawn'))throw new Error('P6 enemy builder delegate missing');
if(!finalGame.includes('wavesRuntime.waveSpawnCount'))throw new Error('P6 wave spawn delegate missing');
if(!finalGame.includes('wavesRuntime.pickEnemyType'))throw new Error('P6 enemy pool delegate missing');
if(!finalGame.includes('wavesRuntime.bossTypeForLevel'))throw new Error('P6 boss composition delegate missing');
if(finalGame.includes("const pool=['wraith','reaper','infected','crawler','eye','brute']"))throw new Error('P6 legacy enemy pool still present');
if(finalGame.includes('const softCap=Math.min(210,90+level*4),room='))throw new Error('P6 legacy wave composition still present');
if(!finalBootstrap.includes("./waves-runtime.mjs?v=01753-p6")||!finalBootstrap.includes("./enemies-runtime.mjs?v=01753-p6"))throw new Error('P6 runtime cache tags missing');
console.log('P6 OK: enemy construction and wave composition delegated to domain runtimes');
