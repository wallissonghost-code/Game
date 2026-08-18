// Ghost isolated stale-aim reproduction
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4176, BASE=`http://127.0.0.1:${PORT}`;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const angleDiff=(a,b)=>Math.abs(((a-b+Math.PI*3)%(Math.PI*2))-Math.PI);
async function waitServer(){for(let i=0;i<40;i++){try{const r=await fetch(BASE);if(r.ok)return}catch{}await sleep(250)}throw Error('Ghost server did not start')}

async function run(browser,name,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/i.test(m.text()))errors.push(m.text())});
  await page.route('https://caos-live-game-server-va.onrender.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.goto(`${BASE}/?ci=1&ghost=aim-${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#startBtn').waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>window.CaosTest&&document.getElementById('startBtn')&&!document.getElementById('startBtn').disabled,null,{timeout:15000});
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>window.CaosTest?.snapshot().running===true,null,{timeout:5000});

  const snap=()=>page.evaluate(()=>window.CaosTest.snapshot());
  const cmd=d=>page.evaluate(d=>window.CaosTest.command(d),d);
  const target=(distance,angle=0)=>page.evaluate(({distance,angle})=>window.CaosTest.spawnTarget(distance,angle),{distance,angle});
  const assert=(ok,msg)=>{if(!ok)throw Error(`[GHOST ${name}] ${msg}`)};
  const shotAngle=ls=>Math.atan2(ls.targetY-ls.playerY,ls.targetX-ls.playerX);
  const correctFor=(ls,wanted,tolerance=.16)=>!!ls&&Number.isFinite(ls.targetX)&&angleDiff(shotAngle(ls),wanted)<tolerance&&angleDiff(ls.aim,wanted)<tolerance;
  const spawnLine=async(angle,distances)=>{for(const d of distances)assert(await target(d,angle),`could not spawn isolated target ${d}`)};

  await cmd({command:'horde',value:false});
  await cmd({command:'clear'});
  await cmd({command:'skillreset'});
  await cmd({command:'autofire',value:false});

  // Targets are separated by > the enemy separation radius, so the physics solver cannot bend the test line.
  await spawnLine(0,[95,130,165]);
  await cmd({command:'autofire',value:true});
  const warm0=await snap();
  await sleep(1200);
  const warm1=await snap();
  assert(warm1.test.shotsFired>warm0.test.shotsFired,'initial front target produced no shots');
  assert(correctFor(warm1.test.lastShot,0),'initial aim was not pointing at front target');

  await cmd({command:'autofire',value:false});
  await cmd({command:'clear'});
  const NEW_ANGLE=Math.PI*.78;
  // Four isolated targets = ~12 normal shots, enough to cover the user-observed ~4 s window without stacking mobs.
  await spawnLine(NEW_ANGLE,[95,130,165,200]);
  await cmd({command:'autofire',value:true});
  const hold0=await snap();
  await sleep(4000);
  const hold1=await snap();
  const shotsWhileStill=hold1.test.shotsFired-hold0.test.shotsFired;
  const correctStill=correctFor(hold1.test.lastShot,NEW_ANGLE);
  const staleStill=!correctStill || shotsWhileStill===0;
  console.log(`GHOST 4S ISOLATED [${name}] shots=${shotsWhileStill} correct=${correctStill} aim=${Number(hold1.test.aim).toFixed(3)}`);

  let recoveredAfterMove=false,moveShots=0,moved=0;
  if(staleStill){
    const beforeMove=await snap();
    await page.keyboard.down('d');
    await sleep(260);
    await page.keyboard.up('d');
    await sleep(1100);
    const afterMove=await snap();
    moveShots=afterMove.test.shotsFired-beforeMove.test.shotsFired;
    moved=Math.abs(afterMove.test.playerX-beforeMove.test.playerX);
    recoveredAfterMove=moveShots>0&&correctFor(afterMove.test.lastShot,NEW_ANGLE);
    console.log(`GHOST MOVE RECOVERY [${name}] moved=${moved.toFixed(1)} shots=${moveShots} recovered=${recoveredAfterMove}`);
  }

  if(staleStill&&recoveredAfterMove)throw Error(`[GHOST ${name}] MOVEMENT UNLOCK CONFIRMED: isolated aim stayed stale for 4s, then recovered after movement`);
  if(staleStill&&!recoveredAfterMove)throw Error(`[GHOST ${name}] AIM STUCK: isolated aim stale for 4s; movement=${moved.toFixed(1)}px recovery=${recoveredAfterMove}`);
  assert(shotsWhileStill>=3,`stationary retarget fired too few shots: ${shotsWhileStill}`);
  assert(errors.length===0,`runtime errors: ${errors.join(' | ')}`);
  console.log(`GHOST AIM OK [${name}] isolated stationary retarget works without movement`);
  await context.close();
}

let browser;
try{
  await waitServer();
  browser=await chromium.launch({headless:true});
  await run(browser,'mobile',{width:390,height:844});
  await run(browser,'desktop',{width:1440,height:900});
  console.log('GHOST AIM BOT: ALL CHECKS PASSED');
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
