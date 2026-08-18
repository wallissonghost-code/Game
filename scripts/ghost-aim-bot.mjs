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
  const dismissSkillPick=async()=>{
    for(let i=0;i<4;i++){
      const visible=await page.evaluate(()=>document.getElementById('skillPick')?.classList.contains('show')||false);
      if(!visible)return false;
      const clicked=await page.evaluate(()=>{const b=document.querySelector('#skillChoices button');if(!b)return false;b.click();return true});
      if(!clicked)return true;
      await sleep(120);
    }
    return await page.evaluate(()=>document.getElementById('skillPick')?.classList.contains('show')||false);
  };
  const assert=(ok,msg)=>{if(!ok)throw Error(`[GHOST ${name}] ${msg}`)};
  const shotAngle=ls=>Math.atan2(ls.targetY-ls.playerY,ls.targetX-ls.playerX);
  const shotSelfConsistent=(ls,tolerance=.08)=>!!ls&&Number.isFinite(ls.targetX)&&Number.isFinite(ls.targetY)&&angleDiff(shotAngle(ls),ls.aim)<tolerance;
  const correctFor=(ls,wanted,tolerance=.18)=>shotSelfConsistent(ls)&&angleDiff(shotAngle(ls),wanted)<tolerance;
  const vectorAngle=v=>Math.atan2(v.vy,v.vx);

  await cmd({command:'horde',value:false});
  await cmd({command:'clear'});
  await cmd({command:'skillreset'});
  await cmd({command:'gameplaymode',value:'classic'});
  await cmd({command:'autofire',value:false});

  // Straight-projectile invariant: the selected direction is locked at spawn and vx/vy must never steer afterward.
  assert(await target(320,0),'could not spawn straight-projectile target');
  const straight0=await snap();
  await cmd({command:'autofire',value:true});
  let straightShot=null,straightBullet=null;
  for(let i=0;i<20;i++){
    await sleep(35);
    const s=await snap();
    if(s.test.shotsFired>straight0.test.shotsFired&&s.test.liveBullets?.length){straightShot=s.test.lastShot;straightBullet=s.test.liveBullets[s.test.liveBullets.length-1];break}
  }
  assert(straightShot&&straightBullet,'could not capture a live straight projectile');
  await cmd({command:'autofire',value:false});
  const spawnVectorError=angleDiff(vectorAngle(straightBullet),vectorAngle(straightShot));
  await sleep(130);
  const straightLater=await snap();
  const laterBullet=straightLater.test.liveBullets?.find(b=>Math.abs((b.born||0)-(straightBullet.born||0))<2);
  const laterVectorError=laterBullet?angleDiff(vectorAngle(laterBullet),vectorAngle(straightShot)):0;
  console.log(`GHOST STRAIGHT BULLET [${name}] spawnErr=${spawnVectorError.toFixed(4)} laterErr=${laterVectorError.toFixed(4)} alive=${!!laterBullet}`);
  assert(spawnVectorError<.025,`projectile already curved after spawn: ${spawnVectorError}`);
  assert(!laterBullet||laterVectorError<.025,`projectile became homing after spawn: ${laterVectorError}`);

  await cmd({command:'clear'});
  await sleep(250);

  // Baseline: a single frozen target. This avoids enemy-separation physics corrupting the expected angle.
  assert(await target(120,0),'could not spawn baseline target');
  await cmd({command:'autofire',value:true});
  const warm0=await snap();
  await sleep(900);
  const warm1=await snap();
  assert(warm1.test.shotsFired>warm0.test.shotsFired,'baseline target produced no shots');
  assert(correctFor(warm1.test.lastShot,0),`baseline shot mismatch aim=${warm1.test.lastShot?.aim}`);

  // Exact stationary retarget: remove the old target, add one in a new direction, never move the player.
  await cmd({command:'autofire',value:false});
  await cmd({command:'clear'});
  const NEW_ANGLE=Math.PI*.78;
  assert(await target(120,NEW_ANGLE),'could not spawn replacement target');
  await cmd({command:'autofire',value:true});
  const hold0=await snap();
  await sleep(1400);
  const hold1=await snap();
  const shotsWhileStill=hold1.test.shotsFired-hold0.test.shotsFired;
  console.log(`GHOST STATIONARY RETARGET [${name}] shots=${shotsWhileStill} aim=${Number(hold1.test.lastShot?.aim).toFixed(3)}`);
  assert(shotsWhileStill>=3,`stationary retarget fired too few shots: ${shotsWhileStill}`);
  assert(correctFor(hold1.test.lastShot,NEW_ANGLE),`stationary retarget stayed on stale direction: ${JSON.stringify(hold1.test.lastShot)}`);

  // Bug22: dense close-range crowd. Validate each NEW shot against the target coordinates captured at shot time.
  await cmd({command:'autofire',value:false});
  await cmd({command:'clear'});
  await cmd({command:'gameplaymode',value:'classic'});
  const crowdAngles=[0,Math.PI*.33,Math.PI*.66,Math.PI,Math.PI*1.33,Math.PI*1.66];
  for(let i=0;i<18;i++)assert(await target(52+(i%4)*24,crowdAngles[i%crowdAngles.length]),'could not spawn Bug22 crowd target');
  await cmd({command:'autofire',value:true});

  const crowdStart=await snap();
  let prevShots=crowdStart.test.shotsFired,observedShots=0,badShots=0,lastBad=null,liveTargetFrames=0;
  for(let i=0;i<32;i++){
    await sleep(180);
    const s=await snap();
    if(s.diagnostics?.target)liveTargetFrames++;
    if(s.test.shotsFired>prevShots){
      observedShots+=s.test.shotsFired-prevShots;
      const ls=s.test.lastShot;
      if(!shotSelfConsistent(ls)){
        badShots++;
        lastBad={t:i*180,shots:s.test.shotsFired,aim:ls?.aim,shot:ls?shotAngle(ls):null,targetX:ls?.targetX,targetY:ls?.targetY,playerX:ls?.playerX,playerY:ls?.playerY,diagnosticTarget:s.diagnostics?.target||null};
      } else badShots=0;
      prevShots=s.test.shotsFired;
    }
    if(badShots>=2)break;
  }
  const crowdEnd=await snap();
  const crowdShots=crowdEnd.test.shotsFired-crowdStart.test.shotsFired;
  console.log(`GHOST BUG22 CROWD [${name}] shots=${crowdShots} observed=${observedShots} liveTargets=${liveTargetFrames} badStreak=${badShots}`,lastBad||'');
  assert(liveTargetFrames>=6,'Bug22 crowd did not expose enough live targets');
  assert(crowdShots>=8,`Bug22 crowd fired too few shots: ${crowdShots}`);
  assert(badShots<2,`BUG22 REPRODUCED: shot vector disagreed with its own selected target ${JSON.stringify(lastBad)}`);

  // No-target recovery: isolate this from level-up pause generated by the crowd phase.
  await cmd({command:'autofire',value:false});
  await cmd({command:'clear'});
  const hadSkillPick=await dismissSkillPick();
  await sleep(250);
  const RECOVERY_ANGLE=-Math.PI*.62;
  assert(await target(86,RECOVERY_ANGLE),'could not spawn recovery target');
  await cmd({command:'autofire',value:true});
  const r0=await snap();
  await sleep(1100);
  const r1=await snap();
  const recoveryShots=r1.test.shotsFired-r0.test.shotsFired;
  console.log(`GHOST RECOVERY [${name}] shots=${recoveryShots} aim=${Number(r1.test.lastShot?.aim).toFixed(3)} skillPick=${hadSkillPick?'dismissed':'none'}`);
  assert(recoveryShots>=2,`new close target did not wake stationary fire: ${recoveryShots}`);
  assert(correctFor(r1.test.lastShot,RECOVERY_ANGLE),`recovery target used stale direction: ${JSON.stringify(r1.test.lastShot)}`);

  assert(errors.length===0,`runtime errors: ${errors.join(' | ')}`);
  console.log(`GHOST AIM OK [${name}] straight bullet + stationary retarget + Bug22 crowd + recovery passed`);
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
