import fs from 'node:fs';
const path='src/game.js';
let game=fs.readFileSync(path,'utf8');
const from="spawnTarget:(distance=180)=>{spawn('grunt',0);";
const to="spawnTarget:(distance=180)=>{spawn('infected',0);";
if(game.includes(to)){console.log('CI CONTROLLED TARGET ALREADY FIXED');process.exit(0)}
if(!game.includes(from))throw Error('controlled target hook not found');
game=game.replace(from,to);
fs.writeFileSync(path,game);
console.log('CI CONTROLLED TARGET FIXED: grunt -> infected');
