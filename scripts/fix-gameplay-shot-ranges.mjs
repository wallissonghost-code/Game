import fs from 'node:fs';
const path='scripts/gameplay-bot.mjs';
let s=fs.readFileSync(path,'utf8');
const pairs=[
  ["assert(await spawnTarget(340),'could not create long-range target');","assert(await spawnTarget(Math.min(160,Math.floor(viewport.width*.40))),'could not create visible trajectory target');"],
  ["for(let i=0;i<8;i++)await spawnTarget(180+i*18);","for(let i=0;i<8;i++)await spawnTarget(120+(i%4)*12);"],
  ["for(let i=0;i<16;i++)await spawnTarget(180+i*8);","for(let i=0;i<16;i++)await spawnTarget(120+(i%5)*10);"],
  ["for(let i=0;i<30;i++)await spawnTarget(180+i*5);","for(let i=0;i<30;i++)await spawnTarget(120+(i%6)*8);"],
  ["for(let i=0;i<20;i++)await spawnTarget(180+i*5);","for(let i=0;i<20;i++)await spawnTarget(120+(i%6)*8);"],
  ["await cmd({command:'spawn',amount:140,mob:'grunt'});","await cmd({command:'spawn',amount:140,mob:'infected'});"],
];
for(const [a,b] of pairs){
  if(!s.includes(a) && !s.includes(b)) throw Error('expected gameplay-bot pattern missing: '+a);
  s=s.replaceAll(a,b);
}
// Better timeout diagnostics for shot waits.
s=s.replaceAll(
  "await page.waitForFunction(n=>window.CaosTest.snapshot().test.shotsFired>n,fire0.test.shotsFired,{timeout:1800});",
  "try{await page.waitForFunction(n=>window.CaosTest.snapshot().test.shotsFired>n,fire0.test.shotsFired,{timeout:1800})}catch{const d=await snap();throw Error(`[${name}] controlled target visible but no shot in 1.8s; mobs=${d.mobs} autofire=${d.autofire} mode=${d.gameplayMode} paused=${d.paused} fps=${d.fps} player=(${d.test.playerX.toFixed(1)},${d.test.playerY.toFixed(1)})`)}"
);
s=s.replaceAll(
  "await page.waitForFunction(n=>window.CaosTest.snapshot().test.shotsFired>n,traj0.test.shotsFired,{timeout:1800});",
  "try{await page.waitForFunction(n=>window.CaosTest.snapshot().test.shotsFired>n,traj0.test.shotsFired,{timeout:1800})}catch{const d=await snap();throw Error(`[${name}] visible trajectory target produced no shot; mobs=${d.mobs} autofire=${d.autofire} mode=${d.gameplayMode} paused=${d.paused} fps=${d.fps}`)}"
);
fs.writeFileSync(path,s);
console.log('GAMEPLAY SHOT RANGES FIXED');
