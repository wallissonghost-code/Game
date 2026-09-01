import fs from 'node:fs';

const gamePath='src/game.js';
const bootstrapPath='src/core/skills-bootstrap.mjs';
const indexPath='index.html';

function replaceExactly(source,from,to,label){
  const count=source.split(from).length-1;
  if(count===0&&source.includes(to))return source;
  if(count!==1)throw new Error(`P3/${label}: expected 1 match, found ${count}`);
  return source.replace(from,to);
}

function removeReplaceOneBlock(source,label){
  const marker=`'${label}'`;
  const at=source.indexOf(marker);
  if(at<0)return source;
  const start=source.lastIndexOf('  replaceOne(',at);
  const endMarker='\n  );';
  const endAt=source.indexOf(endMarker,at);
  if(start<0||endAt<0)throw new Error(`P3/${label}: patch block boundary not found`);
  return source.slice(0,start)+`  // ${label} now lives in src/core/projectiles-runtime.mjs\n`+source.slice(endAt+endMarker.length);
}

let game=fs.readFileSync(gamePath,'utf8');
const oldMove="for(const b of bullets){if(b.flash){b.t-=dt;continue}b.x+=b.vx*dt;b.y+=b.vy*dt;if(Math.abs(b.x-player.x)>W||Math.abs(b.y-player.y)>H){if(!b.dead&&new URLSearchParams(location.search).get('ci')==='1')ciShotsExpired++;b.dead=true}}const frozen=";
const newMove="for(const b of bullets){const projectileStep=projectilesRuntime.advanceProjectile(b,dt,{playerX:player.x,playerY:player.y,width:W,height:H});if(projectileStep.expired&&!projectileStep.wasDead)ciShotsExpired++}const frozen=";
game=replaceExactly(game,oldMove,newMove,'projectile-step');

const oldCollision="function bulletHitsFromGrid(b,g){const cx=Math.floor(b.x/SPATIAL),cy=Math.floor(b.y/SPATIAL);for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const a=g.get((cx+ox)+','+(cy+oy));if(!a)continue;for(const e of a){if(e.dead||(b.hits&&b.hits.includes(e)))continue;const dx=b.x-e.x,dy=b.y-e.y,rr=b.r+e.r;if(dx*dx+dy*dy<rr*rr)return e}}return null}";
const newCollision="function bulletHitsFromGrid(b,g){return projectilesRuntime.sweptGridHit(b,g,SPATIAL)}";
game=replaceExactly(game,oldCollision,newCollision,'swept-collision');
fs.writeFileSync(gamePath,game);

let bootstrap=fs.readFileSync(bootstrapPath,'utf8');
bootstrap=bootstrap.replace("./projectiles-runtime.mjs?v=01749-p2","./projectiles-runtime.mjs?v=01750-p3");
bootstrap=removeReplaceOneBlock(bootstrap,'projectile-straight');
bootstrap=removeReplaceOneBlock(bootstrap,'swept-collision');

const oldGeometry="const dir=playerFacing(visualAim),rawM=muzzleLocal(dir),rawMuzzleLen=Math.hypot(rawM.x,rawM.y)||1,targetDist=target?Math.hypot(target.x-player.x,target.y-player.y):Infinity,targetR=target?Math.max(4,Number(target.r)||12):0,safeLen=target?Math.max(player.r*.5,targetDist-targetR-6):rawMuzzleLen,muzzleScale=target?Math.max(.18,Math.min(1,safeLen/rawMuzzleLen)):1,m={x:rawM.x*muzzleScale,y:rawM.y*muzzleScale},spawnX=player.x+m.x,spawnY=player.y+m.y,shotAim=target?Math.atan2(target.y-spawnY,target.x-spawnX):visualAim;if(!Number.isFinite(shotAim))return false;";
const newGeometry="const shotGeometry=projectilesRuntime.buildShotGeometry({player,target,visualAim,directionForAim:playerFacing,muzzleForDirection:muzzleLocal});if(!shotGeometry)return false;const {dir,spawnX,spawnY,aim:shotAim,muzzleScale}=shotGeometry;";
bootstrap=replaceExactly(bootstrap,oldGeometry,newGeometry,'shot-geometry-helper');

const oldProjectile="const vx=Math.cos(shotAim)*610,vy=Math.sin(shotAim)*610;ciLastShot={shotId,spawnX,spawnY,playerX:player.x,playerY:player.y,visualAim,visualDir:dir,aim:shotAim,muzzleScale,vx,vy,targetX:target?.x??null,targetY:target?.y??null,targetType:target?.type??null,at:performance.now()};bullets.push({shotId,x:spawnX,y:spawnY,prevX:spawnX,prevY:spawnY,vx,vy,launchVx:vx,launchVy:vy,r:4,dead:false,ammo:1,born:performance.now(),pierceLeft,hits:[],iceHits:0,damage:player.damage*bs.damageMul,ice,explosive,owner:'p1'});";
const newProjectile="const shotBorn=performance.now(),projectile=projectilesRuntime.createProjectile({shotId,x:spawnX,y:spawnY,aim:shotAim,speed:610,born:shotBorn,pierceLeft,damage:player.damage*bs.damageMul,ice,explosive,owner:'p1'}),{vx,vy}=projectile;ciLastShot={shotId,spawnX,spawnY,playerX:player.x,playerY:player.y,visualAim,visualDir:dir,aim:shotAim,muzzleScale,vx,vy,targetX:target?.x??null,targetY:target?.y??null,targetType:target?.type??null,at:shotBorn};bullets.push(projectile);";
bootstrap=replaceExactly(bootstrap,oldProjectile,newProjectile,'projectile-factory');
bootstrap=bootstrap.replace("../game.js?v=01747-close-parallax2","../game.js?v=01750-p3-projectiles");
fs.writeFileSync(bootstrapPath,bootstrap);

let index=fs.readFileSync(indexPath,'utf8');
index=index.replace(/src\/core\/skills-bootstrap\.mjs\?v=[^\"]+/,'src/core/skills-bootstrap.mjs?v=01750-p3');
fs.writeFileSync(indexPath,index);

const finalGame=fs.readFileSync(gamePath,'utf8');
const finalBootstrap=fs.readFileSync(bootstrapPath,'utf8');
if(!finalGame.includes('projectilesRuntime.advanceProjectile'))throw new Error('P3 projectile movement delegate missing');
if(!finalGame.includes('projectilesRuntime.sweptGridHit'))throw new Error('P3 projectile collision delegate missing');
if(finalBootstrap.includes("'projectile-straight'")||finalBootstrap.includes("'swept-collision'"))throw new Error('P3 legacy projectile string patches still present');
if(!finalBootstrap.includes('projectilesRuntime.buildShotGeometry'))throw new Error('P3 shot geometry helper not wired');
if(!finalBootstrap.includes('projectilesRuntime.createProjectile'))throw new Error('P3 projectile factory not wired');
console.log('P3 OK: projectile movement, swept collision, geometry and construction delegated to projectile domain');
