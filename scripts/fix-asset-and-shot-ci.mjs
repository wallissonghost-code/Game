import fs from 'node:fs';
const path='src/game.js';
let game=fs.readFileSync(path,'utf8');

// Patch version 2: fix stale player fallback and expose CI-only shot telemetry.
// 1) Remove stale missing fallback sprite request. The real player pack is assets/player/frame_*.png.
game=game.replace("soldierSprite.src='./assets/player/soldier-premium-01.png?v='+ASSET_TAG;","soldierSprite.src='./assets/player/frame_001.png?v='+ASSET_TAG;");

// 2) CI-only shot telemetry counters.
const countersNeedle="pierceShotCounter=0,iceShotCounter=0,explosiveShotCounter=0,nextWaveAt=0";
const countersReplace="pierceShotCounter=0,iceShotCounter=0,explosiveShotCounter=0,ciShotsFired=0,ciShotsHit=0,ciShotsExpired=0,ciPierceShots=0,ciIceShots=0,ciExplosiveShots=0,nextWaveAt=0";
if(!game.includes('ciShotsFired=0')){
  if(!game.includes(countersNeedle)) throw Error('shot counter insertion point not found');
  game=game.replace(countersNeedle,countersReplace);
}

const pushNeedle="const {pierceLeft,ice,explosive}=traits;bullets.push({x:player.x+m.x";
const pushReplace="const {pierceLeft,ice,explosive}=traits;if(new URLSearchParams(location.search).get('ci')==='1'){ciShotsFired++;if(pierceLeft)ciPierceShots++;if(ice)ciIceShots++;if(explosive)ciExplosiveShots++}bullets.push({x:player.x+m.x";
if(!game.includes('ciShotsFired++;')){
  if(!game.includes(pushNeedle)) throw Error('shot fire instrumentation point not found');
  game=game.replace(pushNeedle,pushReplace);
}

const hitNeedle="const e=bulletHitsFromGrid(b,enemyGrid);if(e){if(b.pierceLeft>0)";
const hitReplace="const e=bulletHitsFromGrid(b,enemyGrid);if(e){if(new URLSearchParams(location.search).get('ci')==='1')ciShotsHit++;if(b.pierceLeft>0)";
if(!game.includes("ciShotsHit++;if(b.pierceLeft")){
  if(!game.includes(hitNeedle)) throw Error('shot hit instrumentation point not found');
  game=game.replace(hitNeedle,hitReplace);
}

const expireNeedle="if(Math.abs(b.x-player.x)>W||Math.abs(b.y-player.y)>H)b.dead=true";
const expireReplace="if(Math.abs(b.x-player.x)>W||Math.abs(b.y-player.y)>H){if(!b.dead&&new URLSearchParams(location.search).get('ci')==='1')ciShotsExpired++;b.dead=true}";
if(!game.includes('ciShotsExpired++;b.dead=true')){
  if(!game.includes(expireNeedle)) throw Error('shot expiration instrumentation point not found');
  game=game.replace(expireNeedle,expireReplace);
}

const snapNeedle="shots:bullets.filter(b=>!b.flash).length,bullets:bullets.length,enemies:enemies.length";
const snapReplace="shots:bullets.filter(b=>!b.flash).length,bullets:bullets.length,enemies:enemies.length,shotsFired:ciShotsFired,shotsHit:ciShotsHit,shotsExpired:ciShotsExpired,pierceShots:ciPierceShots,iceShots:ciIceShots,explosiveShots:ciExplosiveShots,fireRate:player.fireRate,aim:player.aim";
if(!game.includes('shotsFired:ciShotsFired')){
  if(!game.includes(snapNeedle)) throw Error('CI snapshot extension point not found');
  game=game.replace(snapNeedle,snapReplace);
}

if(game.includes('soldier-premium-01.png')) throw Error('stale soldier fallback still present');
for(const token of ['shotsFired:ciShotsFired','ciShotsHit++','ciShotsExpired++']) if(!game.includes(token)) throw Error('missing '+token);
fs.writeFileSync(path,game);
console.log('ASSET FALLBACK + SHOT CI TELEMETRY PATCHED');
