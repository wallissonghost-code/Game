import fs from 'node:fs';
const path='scripts/gameplay-bot.mjs';
let s=fs.readFileSync(path,'utf8');
s=s.replace("const spawnTarget=d=>page.evaluate(d=>window.CaosTest.spawnTarget(d),d);","const spawnTarget=(distance=180,angle=0)=>page.evaluate(({distance,angle})=>window.CaosTest.spawnTarget(distance,angle),{distance,angle});");
s=s.replace("await cmd({command:'spawn',amount:140,mob:'grunt'});","await cmd({command:'spawn',amount:140,mob:'infected'});");
const anchor="  if(Number.isFinite(ls.targetX)&&Number.isFinite(ls.targetY)){\n    const targetAngle=Math.atan2(ls.targetY-ls.playerY,ls.targetX-ls.playerX);\n    assert(angleDiff(ls.aim,targetAngle)<0.08,`shot points away from target: ${(angleDiff(ls.aim,targetAngle)*180/Math.PI).toFixed(2)}deg`);\n  }\n";
if(!s.includes('SHOT MATRIX: 8 directions')){
  if(!s.includes(anchor)) throw Error('geometry anchor not found');
  const block=`${anchor}\n  // SHOT MATRIX: 8 directions x 3 distances.\n  const directions=[0,Math.PI/4,Math.PI/2,Math.PI*3/4,Math.PI,Math.PI*5/4,Math.PI*3/2,Math.PI*7/4];\n  const distances=[120,220,340];\n  for(const dist of distances){\n    for(const ang of directions){\n      await cmd({command:'clear'});await cmd({command:'autofire',value:false});\n      assert(await spawnTarget(dist,ang),\`matrix target failed dist=\${dist} angle=\${ang.toFixed(2)}\`);\n      const m0=await snap();await cmd({command:'autofire',value:true});\n      await page.waitForFunction(n=>window.CaosTest.snapshot().test.shotsFired>n,m0.test.shotsFired,{timeout:1800});\n      await cmd({command:'autofire',value:false});const ms=await snap(),shot=ms.test.lastShot;\n      assert(shot,\`matrix shot missing dist=\${dist} angle=\${ang.toFixed(2)}\`);\n      const expected=Math.atan2(shot.targetY-shot.playerY,shot.targetX-shot.playerX);\n      const err=angleDiff(shot.aim,expected);\n      assert(err<0.08,\`matrix aim error dist=\${dist} angle=\${(ang*180/Math.PI).toFixed(0)}deg err=\${(err*180/Math.PI).toFixed(2)}deg\`);\n      const origin=Math.hypot(shot.spawnX-shot.playerX,shot.spawnY-shot.playerY);\n      assert(origin<=75,\`matrix muzzle too far dist=\${dist} angle=\${(ang*180/Math.PI).toFixed(0)}deg origin=\${origin.toFixed(1)}\`);\n    }\n  }\n`;
  s=s.replace(anchor,block);
}
if(!s.includes("mob:'infected'});const stress0")) throw Error('stress mob replacement failed');
if(!s.includes('SHOT MATRIX: 8 directions')) throw Error('shot matrix insertion failed');
fs.writeFileSync(path,s);
console.log('GAMEPLAY SHOT MATRIX INSTALLED');
// trigger workflow
