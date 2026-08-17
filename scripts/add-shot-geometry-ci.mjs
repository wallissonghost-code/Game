import fs from 'node:fs';
const path='src/game.js';
let game=fs.readFileSync(path,'utf8');

// CI-only geometry telemetry. No behavior change outside ?ci=1.
if(!game.includes('ciLastShot=null')){
  const needle='ciPierceShots=0,ciIceShots=0,ciExplosiveShots=0,nextWaveAt=0';
  if(!game.includes(needle)) throw Error('geometry counter insertion point not found');
  game=game.replace(needle,'ciPierceShots=0,ciIceShots=0,ciExplosiveShots=0,ciLastShot=null,nextWaveAt=0');
}

if(!game.includes('ciLastShot={spawnX:player.x+m.x')){
  const needle="if(new URLSearchParams(location.search).get('ci')==='1'){ciShotsFired++;if(pierceLeft)ciPierceShots++;if(ice)ciIceShots++;if(explosive)ciExplosiveShots++}bullets.push({x:player.x+m.x";
  const repl="if(new URLSearchParams(location.search).get('ci')==='1'){ciShotsFired++;if(pierceLeft)ciPierceShots++;if(ice)ciIceShots++;if(explosive)ciExplosiveShots++;ciLastShot={spawnX:player.x+m.x,spawnY:player.y+m.y,playerX:player.x,playerY:player.y,aim:player.aim,vx:Math.cos(player.aim)*610,vy:Math.sin(player.aim)*610,targetX:target?.x??null,targetY:target?.y??null,at:performance.now()}}bullets.push({x:player.x+m.x";
  if(!game.includes(needle)) throw Error('shot geometry insertion point not found');
  game=game.replace(needle,repl);
}

if(!game.includes('liveBullets:bullets.filter')){
  const needle='fireRate:player.fireRate,aim:player.aim';
  const repl="fireRate:player.fireRate,aim:player.aim,lastShot:ciLastShot,liveBullets:bullets.filter(b=>!b.flash&&!b.dead).slice(0,8).map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,born:b.born,pierceLeft:b.pierceLeft,ice:!!b.ice,explosive:!!b.explosive}))";
  if(!game.includes(needle)) throw Error('snapshot geometry insertion point not found');
  game=game.replace(needle,repl);
}

// Controlled stationary target, exposed only through CaosTest in ?ci=1.
if(!game.includes('spawnTarget:(distance=180)=>')){
  const needle='command:d=>command(d),reset:()=>reset(),pause:v=>setPaused(!!v)';
  const repl="command:d=>command(d),reset:()=>reset(),pause:v=>setPaused(!!v),spawnTarget:(distance=180)=>{spawn('grunt',0);const e=enemies[enemies.length-1];if(!e)return false;e.x=player.x+Math.max(80,Math.min(360,+distance||180));e.y=player.y;e.speed=0;e.mvx=0;e.mvy=0;e.speedMul=0;return true}";
  if(!game.includes(needle)) throw Error('CaosTest target insertion point not found');
  game=game.replace(needle,repl);
}

for(const token of ['ciLastShot={spawnX:player.x+m.x','liveBullets:bullets.filter','spawnTarget:(distance=180)=>']){
  if(!game.includes(token)) throw Error('missing geometry hook: '+token);
}
fs.writeFileSync(path,game);
console.log('SHOT GEOMETRY CI HOOK INSTALLED');
