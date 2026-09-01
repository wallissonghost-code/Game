import fs from 'node:fs';

const gamePath='src/game.js';
const bootstrapPath='src/core/skills-bootstrap.mjs';
const indexPath='index.html';

function replaceExactly(source,from,to,label){
  const count=source.split(from).length-1;
  if(count===0&&source.includes(to))return source;
  if(count!==1)throw new Error(`DOMAIN/${label}: expected 1 match, found ${count}`);
  return source.replace(from,to);
}

function removeReplaceOneBlock(source,label){
  const marker=`'${label}'`;
  const at=source.indexOf(marker);
  if(at<0)return source;
  const start=source.lastIndexOf('  replaceOne(',at);
  const endMarker='\n  );';
  const endAt=source.indexOf(endMarker,at);
  if(start<0||endAt<0)throw new Error(`DOMAIN/${label}: patch block boundary not found`);
  return source.slice(0,start)+`  // ${label} now lives in a stable core domain\n`+source.slice(endAt+endMarker.length);
}

let game=fs.readFileSync(gamePath,'utf8');

// P3 projectile delegates (idempotent)
const oldMove="for(const b of bullets){if(b.flash){b.t-=dt;continue}b.x+=b.vx*dt;b.y+=b.vy*dt;if(Math.abs(b.x-player.x)>W||Math.abs(b.y-player.y)>H){if(!b.dead&&new URLSearchParams(location.search).get('ci')==='1')ciShotsExpired++;b.dead=true}}const frozen=";
const newMove="for(const b of bullets){const projectileStep=projectilesRuntime.advanceProjectile(b,dt,{playerX:player.x,playerY:player.y,width:W,height:H});if(projectileStep.expired&&!projectileStep.wasDead)ciShotsExpired++}const frozen=";
game=replaceExactly(game,oldMove,newMove,'projectile-step');
const oldCollision="function bulletHitsFromGrid(b,g){const cx=Math.floor(b.x/SPATIAL),cy=Math.floor(b.y/SPATIAL);for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const a=g.get((cx+ox)+','+(cy+oy));if(!a)continue;for(const e of a){if(e.dead||(b.hits&&b.hits.includes(e)))continue;const dx=b.x-e.x,dy=b.y-e.y,rr=b.r+e.r;if(dx*dx+dy*dy<rr*rr)return e}}return null}";
const newCollision="function bulletHitsFromGrid(b,g){return projectilesRuntime.sweptGridHit(b,g,SPATIAL)}";
game=replaceExactly(game,oldCollision,newCollision,'swept-collision');

// P4 enemy facing delegates
const oldFacing8="function stableEnemyFacing8(e,vx,vy){const mag=Math.hypot(vx,vy);if(mag<.001)return e.facing||'down';const a=Math.atan2(vy,vx),oct=Math.round(a/(Math.PI/4)),dirs=['right','dr','down','dl','left','ul','up','ur'];const candidate=dirs[(oct+8)%8],now=performance.now();if(!e.facing){e.facing=candidate;e.faceCandidate='';e.faceCandidateAt=0;return e.facing}if(candidate===e.facing){e.faceCandidate='';e.faceCandidateAt=0;return e.facing}if(e.faceCandidate!==candidate){e.faceCandidate=candidate;e.faceCandidateAt=now;return e.facing}if(now-(e.faceCandidateAt||0)<120)return e.facing;e.facing=candidate;e.faceCandidate='';e.faceCandidateAt=0;return e.facing}";
const newFacing8="function stableEnemyFacing8(e,vx,vy){return enemiesRuntime.stableFacing8(e,vx,vy)}";
game=replaceExactly(game,oldFacing8,newFacing8,'enemy-facing8');
const oldFacing4="function stableEnemyFacing(e,vx,vy){const ax=Math.abs(vx),ay=Math.abs(vy);if(ax<.001&&ay<.001)return e.facing||'down';const candidate=ax>ay?(vx>0?'right':'left'):(vy>0?'down':'up'),now=performance.now();if(!e.facing){e.facing=candidate;e.faceCandidate='';e.faceCandidateAt=0;return e.facing}if(candidate===e.facing){e.faceCandidate='';e.faceCandidateAt=0;return e.facing}const major=Math.max(ax,ay),minor=Math.min(ax,ay),dominance=major/Math.max(.001,minor);if(dominance<1.32)return e.facing;if(e.faceCandidate!==candidate){e.faceCandidate=candidate;e.faceCandidateAt=now;return e.facing}if(now-(e.faceCandidateAt||0)<170)return e.facing;e.facing=candidate;e.faceCandidate='';e.faceCandidateAt=0;return e.facing}";
const newFacing4="function stableEnemyFacing(e,vx,vy){return enemiesRuntime.stableFacing4(e,vx,vy)}";
game=replaceExactly(game,oldFacing4,newFacing4,'enemy-facing4');

const oldMoveSpeed="const controlNow=performance.now(),locked=controlNow<(e.iceFreezeUntil||0)||controlNow<(e.stunUntil||0),slowMul=controlNow<(e.slowUntil||0)?1-(e.slowPct||0):1,furyMul=controlNow<(e.furyUntil||0)?(e.furySpeedMul||1):1,moveSpeed=locked?0:Math.min(310,e.speed*enemySpeed*(1+level*.015)*slowMul*furyMul);";
const newMoveSpeed="const controlNow=performance.now(),moveSpeed=enemiesRuntime.movementSpeed(e,{enemySpeed,level,now:controlNow});";
game=replaceExactly(game,oldMoveSpeed,newMoveSpeed,'enemy-movement-speed');

const oldWave="if(hordeEnabled&&ogreReady){const now=performance.now(),softCap=Math.min(210,90+level*4);if(now>=nextWaveAt&&enemies.length<softCap){spawnWave();const pressure=enemies.length/Math.max(1,softCap),base=Math.max(1500,3600-level*55);nextWaveAt=now+base*(.9+pressure*.65)}}else{nextWaveAt=performance.now()+900}";
const newWave="if(hordeEnabled&&ogreReady){const now=performance.now(),softCap=wavesRuntime.softCapForLevel(level);if(wavesRuntime.shouldSpawnWave({enabled:hordeEnabled,assetsReady:ogreReady,now,nextWaveAt,enemyCount:enemies.length,level})){spawnWave();nextWaveAt=now+wavesRuntime.nextWaveDelay(level,enemies.length,softCap)}}else{nextWaveAt=performance.now()+900}";
game=replaceExactly(game,oldWave,newWave,'wave-cadence');
fs.writeFileSync(gamePath,game);

let bootstrap=fs.readFileSync(bootstrapPath,'utf8');
bootstrap=bootstrap.replace("./projectiles-runtime.mjs?v=01749-p2","./projectiles-runtime.mjs?v=01750-p3");
bootstrap=bootstrap.replace("./enemies-runtime.mjs?v=01749-p2","./enemies-runtime.mjs?v=01751-p4");
bootstrap=bootstrap.replace("./waves-runtime.mjs?v=01749-p2","./waves-runtime.mjs?v=01751-p4");
bootstrap=removeReplaceOneBlock(bootstrap,'projectile-straight');
bootstrap=removeReplaceOneBlock(bootstrap,'swept-collision');

const oldGeometry="const dir=playerFacing(visualAim),rawM=muzzleLocal(dir),rawMuzzleLen=Math.hypot(rawM.x,rawM.y)||1,targetDist=target?Math.hypot(target.x-player.x,target.y-player.y):Infinity,targetR=target?Math.max(4,Number(target.r)||12):0,safeLen=target?Math.max(player.r*.5,targetDist-targetR-6):rawMuzzleLen,muzzleScale=target?Math.max(.18,Math.min(1,safeLen/rawMuzzleLen)):1,m={x:rawM.x*muzzleScale,y:rawM.y*muzzleScale},spawnX=player.x+m.x,spawnY=player.y+m.y,shotAim=target?Math.atan2(target.y-spawnY,target.x-spawnX):visualAim;if(!Number.isFinite(shotAim))return false;";
const newGeometry="const shotGeometry=projectilesRuntime.buildShotGeometry({player,target,visualAim,directionForAim:playerFacing,muzzleForDirection:muzzleLocal});if(!shotGeometry)return false;const {dir,spawnX,spawnY,aim:shotAim,muzzleScale}=shotGeometry;";
bootstrap=replaceExactly(bootstrap,oldGeometry,newGeometry,'shot-geometry-helper');
const oldProjectile="const vx=Math.cos(shotAim)*610,vy=Math.sin(shotAim)*610;ciLastShot={shotId,spawnX,spawnY,playerX:player.x,playerY:player.y,visualAim,visualDir:dir,aim:shotAim,muzzleScale,vx,vy,targetX:target?.x??null,targetY:target?.y??null,targetType:target?.type??null,at:performance.now()};bullets.push({shotId,x:spawnX,y:spawnY,prevX:spawnX,prevY:spawnY,vx,vy,launchVx:vx,launchVy:vy,r:4,dead:false,ammo:1,born:performance.now(),pierceLeft,hits:[],iceHits:0,damage:player.damage*bs.damageMul,ice,explosive,owner:'p1'});";
const newProjectile="const shotBorn=performance.now(),projectile=projectilesRuntime.createProjectile({shotId,x:spawnX,y:spawnY,aim:shotAim,speed:610,born:shotBorn,pierceLeft,damage:player.damage*bs.damageMul,ice,explosive,owner:'p1'}),{vx,vy}=projectile;ciLastShot={shotId,spawnX,spawnY,playerX:player.x,playerY:player.y,visualAim,visualDir:dir,aim:shotAim,muzzleScale,vx,vy,targetX:target?.x??null,targetY:target?.y??null,targetType:target?.type??null,at:shotBorn};bullets.push(projectile);";
bootstrap=replaceExactly(bootstrap,oldProjectile,newProjectile,'projectile-factory');
fs.writeFileSync(bootstrapPath,bootstrap);

let index=fs.readFileSync(indexPath,'utf8');
index=index.replace(/src\/core\/skills-bootstrap\.mjs\?v=[^\"]+/,'src/core/skills-bootstrap.mjs?v=01751-p4');
fs.writeFileSync(indexPath,index);

const finalGame=fs.readFileSync(gamePath,'utf8');
const finalBootstrap=fs.readFileSync(bootstrapPath,'utf8');
for(const token of ['projectilesRuntime.advanceProjectile','projectilesRuntime.sweptGridHit','enemiesRuntime.stableFacing8','enemiesRuntime.stableFacing4','enemiesRuntime.movementSpeed','wavesRuntime.softCapForLevel','wavesRuntime.nextWaveDelay']){
  if(!finalGame.includes(token))throw new Error(`domain delegate missing: ${token}`);
}
if(!finalBootstrap.includes("./enemies-runtime.mjs?v=01751-p4")||!finalBootstrap.includes("./waves-runtime.mjs?v=01751-p4"))throw new Error('P4 module cache tags missing');
console.log('P4 OK: wave cadence, enemy facing and enemy movement delegated to core domains');
