import fs from 'node:fs';
const path='src/game.js';
let game=fs.readFileSync(path,'utf8');
const old="spawnTarget:(distance=180)=>{spawn('infected',0);const e=enemies[enemies.length-1];if(!e)return false;e.x=player.x+Math.max(80,Math.min(360,+distance||180));e.y=player.y;e.speed=0;e.mvx=0;e.mvy=0;e.speedMul=0;return true}";
const repl="spawnTarget:(distance=180,angle=0)=>{const before=enemies.length;makeEnemy('infected',true,0);if(enemies.length<=before)return false;const e=enemies[enemies.length-1],dist=Math.max(80,Math.min(360,+distance||180)),a=Number.isFinite(+angle)?+angle:0;e.x=player.x+Math.cos(a)*dist;e.y=player.y+Math.sin(a)*dist;e.speed=0;e.mvx=0;e.mvy=0;e.speedMul=0;e.attackAt=performance.now()+60000;return true}";
if(!game.includes(old)) throw Error('spawnTarget old hook not found');
game=game.replace(old,repl);
fs.writeFileSync(path,game);
console.log('CI SHOT TARGET UPGRADED');
