import fs from 'node:fs';

const gamePath='src/game.js';
const bootstrapPath='src/core/skills-bootstrap.mjs';
const indexPath='index.html';

function replaceExactly(source,from,to,label){
  const count=source.split(from).length-1;
  if(count===0&&source.includes(to))return source;
  if(count!==1)throw new Error(`P5/${label}: expected 1 match, found ${count}`);
  return source.replace(from,to);
}

let game=fs.readFileSync(gamePath,'utf8');

const oldChase="if(!frozen){const chaseP=duoEnemyTarget(e),dxp=chaseP.x-e.x,dyp=chaseP.y-e.y,dist2=dxp*dxp+dyp*dyp,near2=420*420,stride=dist2<near2?1:(perfMode>=2?4:perfMode===1?3:2);if(!e.mvx||((frameSeq+(e.aiPhase||0))%stride===0)){const distp=Math.sqrt(dist2)||1,baseA=Math.atan2(dyp,dxp);let steer=baseA;if(e.type==='crawler')steer+=Math.sin(e.t*7+e.seed)*.6;const stopRadius=player.r+e.r+(e.max>=100?58:38);if(distp<=stopRadius){e.mvx=0;e.mvy=0;e.speedMul=0;const fx=dxp,fy=dyp;(types[e.type]?.boss?stableEnemyFacing:stableEnemyFacing8)(e,fx,fy)}else{e.mvx=Math.cos(steer);e.mvy=Math.sin(steer);e.speedMul=distp<stopRadius+42?.68:1;(types[e.type]?.boss?stableEnemyFacing:stableEnemyFacing8)(e,e.mvx,e.mvy)}}const controlNow=performance.now(),moveSpeed=enemiesRuntime.movementSpeed(e,{enemySpeed,level,now:controlNow});e.x+=e.mvx*moveSpeed*dt*(e.speedMul||1);e.y+=e.mvy*moveSpeed*dt*(e.speedMul||1);}";
const newChase="if(!frozen){const chaseP=duoEnemyTarget(e);enemiesRuntime.updateChaseMotion(e,chaseP,{dt,enemySpeed,level,perfMode,frameSeq,isBoss:!!types[e.type]?.boss,playerRadius:player.r,now:performance.now()})}";
game=replaceExactly(game,oldChase,newChase,'enemy-chase-motion');

const oldAttackGate="if(now>=(e.attackAt||0)&&now>=(e.iceFreezeUntil||0)&&now>=(e.stunUntil||0)&&targetInv<=0&&now>targetShield&&!choiceProtected){e.attackAt=now+(e.max>=100?1100:900);e.attackFlash=.18;";
const newAttackGate="if(enemiesRuntime.tryBeginAttack(e,targetP,{now,targetInv,targetShield,choiceProtected}).started){";
game=replaceExactly(game,oldAttackGate,newAttackGate,'enemy-attack-window');
fs.writeFileSync(gamePath,game);

let bootstrap=fs.readFileSync(bootstrapPath,'utf8');
bootstrap=bootstrap.replace("./enemies-runtime.mjs?v=01751-p4","./enemies-runtime.mjs?v=01752-p5");
bootstrap=bootstrap.replace("./enemies-runtime.mjs?v=01749-p2","./enemies-runtime.mjs?v=01752-p5");
fs.writeFileSync(bootstrapPath,bootstrap);

let index=fs.readFileSync(indexPath,'utf8');
index=index.replace(/src\/core\/skills-bootstrap\.mjs\?v=[^\"]+/,'src/core/skills-bootstrap.mjs?v=01752-p5');
fs.writeFileSync(indexPath,index);

const finalGame=fs.readFileSync(gamePath,'utf8');
const finalBootstrap=fs.readFileSync(bootstrapPath,'utf8');
if(!finalGame.includes('enemiesRuntime.updateChaseMotion'))throw new Error('P5 chase delegate missing');
if(!finalGame.includes('enemiesRuntime.tryBeginAttack'))throw new Error('P5 attack delegate missing');
if(finalGame.includes('const chaseP=duoEnemyTarget(e),dxp='))throw new Error('P5 legacy chase body still present');
if(!finalBootstrap.includes("./enemies-runtime.mjs?v=01752-p5"))throw new Error('P5 enemy runtime cache tag missing');
console.log('P5 OK: enemy chase motion and attack gate delegated to enemies domain');
