import fs from 'node:fs';

const gamePath='src/game.js';
const bootstrapPath='src/core/skills-bootstrap.mjs';
const indexPath='index.html';

function replaceExactly(source,from,to,label){
  const count=source.split(from).length-1;
  if(count===0&&source.includes(to))return source;
  if(count!==1)throw new Error(`P7/${label}: expected 1 match, found ${count}`);
  return source.replace(from,to);
}

let game=fs.readFileSync(gamePath,'utf8');

const oldMakeEnemy="function makeEnemy(type,near=false,forcedTier=null){if(enemies.length>=MAX_ENEMIES)return;const c=types[type];if(!c)return;const a=Math.random()*Math.PI*2,dist=near?180+Math.random()*220:Math.max(W,H)*.7+Math.random()*260,tier=c.boss?bossTier(forcedTier):(forcedTier===1||forcedTier===2?forcedTier:enemyTier()),evolution=c.boss?1:enemyEvolution(tier),variant=window.CaosMobs.variantFor({boss:!!c.boss,tier,evolution}),hpMult=variant.hp,dmgMult=variant.dmg,xpMult=variant.xp,hitboxMult=c.boss?1:variant.hitbox;if(!c.boss&&evolution===2)ensureAdvancedOgre(tier);enemies.push({x:player.x+Math.cos(a)*dist,y:player.y+Math.sin(a)*dist,type,tier,evolution,r:c.r*hitboxMult,speed:(c.s+Math.random()*8)*variant.speed,hp:Math.ceil(c.h*hpMult),max:Math.ceil(c.h*hpMult),damage:Math.ceil(c.d*dmgMult),xp:Math.ceil(c.x*xpMult),dead:false,t:Math.random()*8,seed:Math.random()*99,attackAt:0,attackFlash:0,facing:'down',skinVariant:Math.floor(Math.random()*3),aiPhase:Math.floor(Math.random()*4),mvx:0,mvy:0,xpEventMul:doubleXpEvent?2:1})}";
const newMakeEnemy="function makeEnemy(type,near=false,forcedTier=null){const built=enemiesRuntime.buildEnemySpawn({type,typeConfig:types[type],near,forcedTier,level,player,viewportWidth:W,viewportHeight:H,doubleXpEvent,enemyCount:enemies.length,maxEnemies:MAX_ENEMIES,mobDomain:window.CaosMobs,variantFor:window.CaosMobs.variantFor});if(!built)return;if(built.advancedTier===1||built.advancedTier===2)ensureAdvancedOgre(built.advancedTier);enemies.push(built.enemy)}";
game=replaceExactly(game,oldMakeEnemy,newMakeEnemy,'enemy-builder');

const priorNewMakeEnemy="function makeEnemy(type,near=false,forcedTier=null){const built=enemiesRuntime.buildEnemySpawn({type,typeConfig:types[type],near,forcedTier,level,player,viewportWidth:W,viewportHeight:H,doubleXpEvent,enemyCount:enemies.length,maxEnemies:MAX_ENEMIES,mobDomain:window.CaosMobs});if(!built)return;if(built.advancedTier===1||built.advancedTier===2)ensureAdvancedOgre(built.advancedTier);enemies.push(built.enemy)}";
if(game.includes(priorNewMakeEnemy))game=game.replace(priorNewMakeEnemy,newMakeEnemy);

const oldSpawn="function spawn(type,forcedTier=null){if(type)return makeEnemy(type,true,forcedTier);const pool=['wraith','reaper','infected','crawler','eye','brute'];makeEnemy(pool[Math.floor(Math.random()*pool.length)],false,forcedTier)}";
const newSpawn="function spawn(type,forcedTier=null){if(type)return makeEnemy(type,true,forcedTier);makeEnemy(wavesRuntime.pickEnemyType(),false,forcedTier)}";
game=replaceExactly(game,oldSpawn,newSpawn,'spawn-pool');

const oldWave="function spawnWave(){waveCount++;const softCap=Math.min(210,90+level*4),room=Math.max(0,softCap-enemies.length);if(room<=0)return;const n=Math.min(room,Math.min(18,4+Math.floor(level*.65)));for(let i=0;i<n;i++)spawn()}";
const newWave="function spawnWave(){waveCount++;const n=wavesRuntime.waveSpawnCount(level,enemies.length);for(let i=0;i<n;i++)spawn()}";
game=replaceExactly(game,oldWave,newWave,'wave-composition');

const oldBoss="function boss(type,forcedTier=null){makeEnemy(type||(((Math.floor(level/10))%2)?'colossus':'voidlord'),true,forcedTier)}";
const newBoss="function boss(type,forcedTier=null){makeEnemy(type||wavesRuntime.bossTypeForLevel(level),true,forcedTier)}";
game=replaceExactly(game,oldBoss,newBoss,'boss-composition');

const oldMelee="{const targetP=duoEnemyTarget(e),isP1=targetP===player,hitDist=Math.hypot(e.x-targetP.x,e.y-targetP.y),attackRange=(targetP.r||18)+e.r+(e.max>=100?58:38);if(hitDist<attackRange){const now=performance.now(),targetInv=isP1?player.inv:0,targetShield=isP1?invincibleUntil:0;const choiceProtected=isP1?skillShieldP1():skillShieldP2();if(enemiesRuntime.tryBeginAttack(e,targetP,{now,targetInv,targetShield,choiceProtected}).started){if(isP1){if(!tryDodge(now)){lastDamageAt=now;player.life=Math.max(0,player.life-Math.max(1,e.damage*(1-player.armorReduction)));triggerGhost(now)}}else if(now>=(duoPlayer.invUntil||0)){duoPlayer.life=Math.max(0,duoPlayer.life-Math.max(1,e.damage*(1-(duoPlayer.armorReduction||0))));duoPlayer.lastDamageAt=now}const kx=e.x-targetP.x,ky=e.y-targetP.y,kd=Math.hypot(kx,ky)||1;e.x+=kx/kd*8;e.y+=ky/kd*8;if(targetP.life<=0){if(isP1){if(!player.down&&!tryPhoenix())knockDownPlayer('p1',e)}else if(!duoPlayer.down){if(!tryDuoPhoenix())knockDownPlayer('p2',e)}}}}}";
const newMelee="{const targetP=duoEnemyTarget(e),isP1=targetP===player,now=performance.now(),targetInv=isP1?player.inv:0,targetShield=isP1?invincibleUntil:0,choiceProtected=isP1?skillShieldP1():skillShieldP2();enemiesRuntime.resolveMeleeAttack(e,targetP,{now,isPrimary:isP1,targetInv,targetShield,choiceProtected,armorReduction:isP1?player.armorReduction:(duoPlayer.armorReduction||0),secondaryInvUntil:duoPlayer.invUntil||0,tryDodge:isP1?()=>tryDodge(now):()=>false,onPrimaryDamage:()=>{lastDamageAt=now;triggerGhost(now)},onSecondaryDamage:()=>{duoPlayer.lastDamageAt=now},tryPhoenix:isP1?()=>tryPhoenix():()=>tryDuoPhoenix(),onKnockDown:()=>knockDownPlayer(isP1?'p1':'p2',e)})}";
game=replaceExactly(game,oldMelee,newMelee,'melee-resolution');
fs.writeFileSync(gamePath,game);

let bootstrap=fs.readFileSync(bootstrapPath,'utf8');
bootstrap=bootstrap.replace(/\.\/waves-runtime\.mjs\?v=[^';\"]+/,"./waves-runtime.mjs?v=01754-p7");
bootstrap=bootstrap.replace(/\.\/enemies-runtime\.mjs\?v=[^';\"]+/,"./enemies-runtime.mjs?v=01754-p7");
fs.writeFileSync(bootstrapPath,bootstrap);

let index=fs.readFileSync(indexPath,'utf8');
index=index.replace(/src\/core\/skills-bootstrap\.mjs\?v=[^\"]+/,'src/core/skills-bootstrap.mjs?v=01754-p7');
fs.writeFileSync(indexPath,index);

const finalGame=fs.readFileSync(gamePath,'utf8');
const finalBootstrap=fs.readFileSync(bootstrapPath,'utf8');
if(!finalGame.includes('enemiesRuntime.buildEnemySpawn'))throw new Error('P7 enemy builder delegate missing');
if(!finalGame.includes('variantFor:window.CaosMobs.variantFor'))throw new Error('P7 mob variant bridge missing');
if(!finalGame.includes('wavesRuntime.waveSpawnCount'))throw new Error('P7 wave spawn delegate missing');
if(!finalGame.includes('wavesRuntime.pickEnemyType'))throw new Error('P7 enemy pool delegate missing');
if(!finalGame.includes('wavesRuntime.bossTypeForLevel'))throw new Error('P7 boss composition delegate missing');
if(!finalGame.includes('enemiesRuntime.resolveMeleeAttack'))throw new Error('P7 melee resolver delegate missing');
if(finalGame.includes('enemiesRuntime.tryBeginAttack(e,targetP'))throw new Error('P7 legacy inline melee attack still present');
if(finalGame.includes("const pool=['wraith','reaper','infected','crawler','eye','brute']"))throw new Error('P7 legacy enemy pool still present');
if(finalGame.includes('const softCap=Math.min(210,90+level*4),room='))throw new Error('P7 legacy wave composition still present');
if(!finalBootstrap.includes("./waves-runtime.mjs?v=01754-p7")||!finalBootstrap.includes("./enemies-runtime.mjs?v=01754-p7"))throw new Error('P7 runtime cache tags missing');
console.log('P7 OK: enemy melee resolution delegated to enemies runtime');
