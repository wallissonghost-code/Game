import fs from 'node:fs';
const p='src/game.js';
let s=fs.readFileSync(p,'utf8');
s=s.replace("const frozen=performance.now()<freezeUntil;if(frozen){meteorShakeLeft=0;return}","");
s=s.replace(",corrupted=enemies.reduce((n,e)=>n+(!e.dead&&e.tier===2?1:0),0),load=mobs+corrupted*.75","");
s=s.replaceAll('load>=165','mobs>=165').replaceAll('load>=90','mobs>=90').replaceAll('load<70','mobs<70').replaceAll('load<110','mobs<110');
fs.writeFileSync(p,s);
console.log('isolated aura only');
