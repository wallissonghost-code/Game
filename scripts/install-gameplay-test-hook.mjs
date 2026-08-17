import fs from 'node:fs';
const path='src/game.js';
let game=fs.readFileSync(path,'utf8');
const needle="setInterval(broadcast,500);setInterval(sendDuoSnapshot,125);openPeer();resize();draw()})();";
const hook="setInterval(broadcast,500);setInterval(sendDuoSnapshot,125);if(new URLSearchParams(location.search).get('ci')==='1'){window.CaosTest={snapshot:()=>({...state(),frameSeq,test:{playerX:player.x,playerY:player.y,shots:bullets.filter(b=>!b.flash).length,bullets:bullets.length,enemies:enemies.length}}),command:d=>command(d),reset:()=>reset(),pause:v=>setPaused(!!v)}}openPeer();resize();draw()})();";
if(game.includes('window.CaosTest={snapshot:')){console.log('GAMEPLAY CI HOOK ALREADY INSTALLED');process.exit(0)}
if(!game.includes(needle))throw Error('gameplay CI hook insertion point not found');
game=game.replace(needle,hook);
if(!game.includes("new URLSearchParams(location.search).get('ci')==='1'"))throw Error('CI hook missing after patch');
fs.writeFileSync(path,game);
console.log('GAMEPLAY CI HOOK INSTALLED');
