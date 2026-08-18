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
  const targetDistance=ls=>Math.hypot(ls.targetX-ls.playerX,ls.targetY-ls.playerY);
  const validateShot=ls=>{assert(ls,'missing lastShot telemetry');assert(Number.isFinite(ls.targetX)&&Number.isFinite(ls.targetY),'shot has no target telemetry');const ta=Math.atan2(ls.targetY-ls.playerY,ls.targetX-ls.playerX);assert(angleDiff(ls.aim,ta)<0.10,`GHOST SHOT TO NOWHERE: aim/target mismatch ${(angleDiff(ls.aim,ta)*180/Math.PI).toFixed(1)}deg`)};

  await cmd({command:'horde',value:false});await cmd({command:'clear'});await cmd({command:'skillreset'});await cmd({command:'autofire',value:false});

  // 1) Baseline cadence, isolated targets at the intended distances.
  for(let i=0;i<10;i++)assert(await target(110+(i%3)*12,(i%4)*Math.PI/2),'could not spawn baseline target');
  await cmd({command:'autofire',value:true});const b0=await snap();await sleep(2200);const b1=await snap();const base=b1.test.shotsFired-b0.test.shotsFired;
  assert(base>=4,`baseline autofire too low: ${base}`);

  // 2) Rapid LV5 must fire faster in a fresh scenario.
  await cmd({command:'autofire',value:false});await cmd({command:'clear'});await cmd({command:'skillreset'});await cmd({command:'skilltest',skill:'rapid',level:5});
  for(let i=0;i<14;i++)assert(await target(110+(i%3)*12,(i%6)*Math.PI/3),'could not spawn rapid target');
  await cmd({command:'autofire',value:true});const r0=await snap();await sleep(2200);const r1=await snap();const rapid=r1.test.shotsFired-r0.test.shotsFired;
  assert(rapid>base*1.20,`RAPID REGRESSION: base=${base}, rapid=${rapid}`);
  validateShot(r1.test.lastShot);

  // 3) Exact stale-target reproduction: acquire a far target to the right,
  // then introduce a much closer target behind/diagonal while player is stationary.
  await cmd({command:'autofire',value:false});await cmd({command:'clear'});await cmd({command:'skillreset'});
  assert(await target(170,0),'could not spawn far target');
  await cmd({command:'autofire',value:true});const f0=await snap();await page.waitForFunction(n=>window.CaosTest.snapshot().test.shotsFired>n,f0.test.shotsFired,{timeout:1800});
  const farShot=(await snap()).test.lastShot;validateShot(farShot);const farDist=targetDistance(farShot);
  assert(farDist>150&&farDist<190,`far-target setup invalid: ${farDist.toFixed(1)}px`);

  assert(await target(80,Math.PI*.78),'could not spawn close-priority target');
  const p0=await snap();
  await sleep(1400);const p1=await snap();const stationaryShots=p1.test.shotsFired-p0.test.shotsFired;
  assert(stationaryShots>=3,`STALE AIM/TARGET: autofire stalled while stationary; shots=${stationaryShots}`);
  validateShot(p1.test.lastShot);
  const chosen=targetDistance(p1.test.lastShot);
  assert(chosen<105,`CLOSE TARGET IGNORED: last shot still chose target ${chosen.toFixed(1)}px away (far was ${farDist.toFixed(1)}px)`);

  // 4) Repeated target switching around the player without movement.
  const angles=[-Math.PI*.75,Math.PI*.55,-Math.PI*.15,Math.PI*.95];
  for(let i=0;i<angles.length;i++){
    assert(await target(82+i*3,angles[i]),`could not spawn switch target ${i}`);
    const before=await snap();
    await sleep(700);
    const after=await snap();
    assert(after.test.shotsFired-before.test.shotsFired>=1,`MOVEMENT-DEPENDENT AIM: no shot after target switch ${i}`);
    validateShot(after.test.lastShot);
    assert(targetDistance(after.test.lastShot)<115,`STALE TARGET AFTER SWITCH ${i}: chose ${targetDistance(after.test.lastShot).toFixed(1)}px target`);
  }

  // 5) Keep shooting stationary: movement must not be required to wake aim.
  const s0=await snap();await sleep(1400);const s1=await snap();const continued=s1.test.shotsFired-s0.test.shotsFired;
  assert(continued>=3,`MOVEMENT-DEPENDENT AIM: stationary autofire stopped again; shots=${continued}`);
  validateShot(s1.test.lastShot);
  assert(errors.length===0,`runtime errors: ${errors.join(' | ')}`);
  console.log(`GHOST AIM OK [${name}] base=${base} rapid=${rapid} far=${farDist.toFixed(1)} close=${chosen.toFixed(1)} stationary=${stationaryShots}+${continued}`);
  await context.close();
}

let browser;
try{await waitServer();browser=await chromium.launch({headless:true});await run(browser,'mobile',{width:390,height:844});await run(browser,'desktop',{width:1440,height:900});console.log('GHOST AIM BOT: ALL CHECKS PASSED')}finally{if(browser)await browser.close();server.kill('SIGTERM')}
