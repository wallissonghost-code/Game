import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4174, BASE=`http://127.0.0.1:${PORT}`;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const angleDiff=(a,b)=>Math.abs(((a-b+Math.PI*3)%(Math.PI*2))-Math.PI);

async function waitServer(){for(let i=0;i<40;i++){try{const r=await fetch(BASE,{cache:'no-store'});if(r.ok)return}catch{}await sleep(250)}throw Error('gameplay bot server did not start')}

async function runScenario(browser,name,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()!=='error')return;const text=m.text();if(/Failed to load resource/i.test(text))return;errors.push(`console: ${text}`)});
  page.on('response',res=>{const status=res.status();if(status<400)return;const url=res.url(),msg=`http ${status}: ${url}`;if(/\/favicon\.ico(?:\?|$)/i.test(url))warnings.push(msg);else errors.push(msg)});
  page.on('requestfailed',req=>{const url=req.url();if(/onrender\.com/i.test(url))return;errors.push(`requestfailed: ${url} :: ${req.failure()?.errorText||'unknown'}`)});
  await page.route('https://caos-live-game-server-va.onrender.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.goto(`${BASE}/?ci=1&bot=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#startBtn').waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>window.CaosTest&&document.getElementById('startBtn')&&!document.getElementById('startBtn').disabled,null,{timeout:15000});
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>window.CaosTest?.snapshot().running===true,null,{timeout:5000});

  const snap=()=>page.evaluate(()=>window.CaosTest.snapshot());
  const cmd=d=>page.evaluate(d=>window.CaosTest.command(d),d);
  const spawnTarget=d=>page.evaluate(d=>window.CaosTest.spawnTarget(d),d);
  const assert=(ok,msg)=>{if(!ok)throw Error(`[${name}] ${msg}`)};
  const noErrors=label=>assert(errors.length===0,`${label}; ${errors.join(' | ')}`);

  let s0=await snap(); await sleep(3000); let s1=await snap();
  assert(s1.frameSeq>s0.frameSeq+20,'game loop did not advance');
  assert(s1.fps>=20,`low/dead FPS at baseline: ${s1.fps}`);
  assert(s1.mobs>0,'no mobs spawned'); noErrors('baseline runtime error');

  const x0=s1.test.playerX,y0=s1.test.playerY;
  await page.keyboard.down('d');await sleep(700);await page.keyboard.up('d');await sleep(150);
  const moved=await snap();assert(Math.hypot(moved.test.playerX-x0,moved.test.playerY-y0)>5,'keyboard movement failed');noErrors('movement runtime error');

  await cmd({command:'horde',value:false});await cmd({command:'clear'});await cmd({command:'autofire',value:false});await cmd({command:'skillreset'});

  const empty0=await snap();await cmd({command:'autofire',value:true});await sleep(900);const empty1=await snap();
  assert(empty1.test.shotsFired===empty0.test.shotsFired,'autofire fired with no target');

  await cmd({command:'autofire',value:false});assert(await spawnTarget(180),'could not create controlled target');
  const off0=await snap();await sleep(800);const off1=await snap();
  assert(off1.test.shotsFired===off0.test.shotsFired,'shots fired while autofire was OFF');

  await cmd({command:'autofire',value:true});
  const fire0=await snap();
  try{await page.waitForFunction(n=>window.CaosTest.snapshot().test.shotsFired>n,fire0.test.shotsFired,{timeout:1800});}catch{
    const stuck=await snap(),sx=stuck.test.playerX,sy=stuck.test.playerY,beforeMoveShots=stuck.test.shotsFired;
    await page.keyboard.down('d');await sleep(220);await page.keyboard.up('d');await sleep(120);
    let recovered=false,recovery=null;try{await page.waitForFunction(n=>window.CaosTest.snapshot().test.shotsFired>n,beforeMoveShots,{timeout:1400});recovered=true;recovery=await snap()}catch{}
    if(recovered){const movedPx=Math.hypot(recovery.test.playerX-sx,recovery.test.playerY-sy),ls=recovery.test.lastShot,aimInfo=ls?` aim=${(ls.aim*180/Math.PI).toFixed(1)}deg spawn=(${ls.spawnX.toFixed(1)},${ls.spawnY.toFixed(1)}) target=(${Number(ls.targetX).toFixed(1)},${Number(ls.targetY).toFixed(1)})`:' no-last-shot';throw Error(`[${name}] GHOST REPRODUCED STALE AIM/TARGET: target visible while stationary produced no shot for 1.8s, then movement ${movedPx.toFixed(1)}px restored autofire; mobs=${stuck.mobs} mode=${stuck.gameplayMode} fps=${stuck.fps}${aimInfo}`)}
    throw Error(`[${name}] controlled target visible but no shot in 1.8s and movement did NOT recover it; mobs=${stuck.mobs} autofire=${stuck.autofire} mode=${stuck.gameplayMode} paused=${stuck.paused} fps=${stuck.fps} player=(${sx.toFixed(1)},${sy.toFixed(1)})`);
  }
  const geo=await snap(),ls=geo.test.lastShot;assert(ls,'shot fired but last-shot geometry missing');
  const muzzleDist=Math.hypot(ls.spawnX-ls.playerX,ls.spawnY-ls.playerY);assert(muzzleDist>=4&&muzzleDist<=75,`projectile spawned away from weapon/player: ${muzzleDist.toFixed(1)}px`);
  const velocityAngle=Math.atan2(ls.vy,ls.vx),speed=Math.hypot(ls.vx,ls.vy);assert(angleDiff(velocityAngle,ls.aim)<0.025,`projectile velocity disagrees with aim: ${(angleDiff(velocityAngle,ls.aim)*180/Math.PI).toFixed(2)}deg`);assert(speed>600&&speed<620,`projectile speed abnormal: ${speed.toFixed(1)}`);
  if(Number.isFinite(ls.targetX)&&Number.isFinite(ls.targetY)){const targetAngle=Math.atan2(ls.targetY-ls.playerY,ls.targetX-ls.playerX);assert(angleDiff(ls.aim,targetAngle)<0.08,`shot points away from target: ${(angleDiff(ls.aim,targetAngle)*180/Math.PI).toFixed(2)}deg`)}

  await cmd({command:'clear'});await cmd({command:'autofire',value:false});assert(await spawnTarget(Math.min(160,Math.floor(viewport.width*.40))),'could not create visible trajectory target');
  const traj0=await snap();await cmd({command:'autofire',value:true});
  try{await page.waitForFunction(n=>window.CaosTest.snapshot().test.shotsFired>n,traj0.test.shotsFired,{timeout:1800})}catch{const d=await snap();throw Error(`[${name}] visible trajectory target produced no shot; mobs=${d.mobs} autofire=${d.autofire} mode=${d.gameplayMode} paused=${d.paused} fps=${d.fps}`)}
  await cmd({command:'autofire',value:false});await sleep(25);const ta=await snap();const bulletA=[...(ta.test.liveBullets||[])].sort((a,b)=>b.born-a.born)[0];assert(bulletA,'new projectile disappeared before trajectory could be sampled');
  await sleep(65);const tb=await snap();const bulletB=(tb.test.liveBullets||[]).find(b=>b.born===bulletA.born);assert(bulletB,'projectile vanished unexpectedly during open-flight sample');
  const dx=bulletB.x-bulletA.x,dy=bulletB.y-bulletA.y,travel=Math.hypot(dx,dy),forward=dx*bulletA.vx+dy*bulletA.vy;assert(travel>=15&&travel<=80,`projectile spatial jump abnormal in 65ms: ${travel.toFixed(1)}px`);assert(forward>0,'projectile moved backwards relative to its velocity');
  const moveAngle=Math.atan2(dy,dx),bulletAngle=Math.atan2(bulletA.vy,bulletA.vx);assert(angleDiff(moveAngle,bulletAngle)<0.05,`projectile trajectory bends unexpectedly: ${(angleDiff(moveAngle,bulletAngle)*180/Math.PI).toFixed(2)}deg`);

  await cmd({command:'clear'});await cmd({command:'autofire',value:false});for(let i=0;i<8;i++)await spawnTarget(120+(i%4)*12);await cmd({command:'autofire',value:true});
  const hit0=await snap();await sleep(3500);const hit1=await snap();const firedNormal=hit1.test.shotsFired-hit0.test.shotsFired,hitNormal=hit1.test.shotsHit-hit0.test.shotsHit,expiredNormal=hit1.test.shotsExpired-hit0.test.shotsExpired;
  assert(firedNormal>=6,`controlled normal fire cadence too low: ${firedNormal} shots/3.5s`);assert(hitNormal>0,`shots exist visually but no projectile collision registered; fired=${firedNormal} hit=${hitNormal}`);assert(expiredNormal<=Math.max(5,Math.floor(firedNormal*.75)),`too many controlled shots miss/expire: fired=${firedNormal} hit=${hitNormal} expired=${expiredNormal}`);noErrors('shot geometry/collision runtime error');

  await cmd({command:'clear'});await cmd({command:'skillreset'});await cmd({command:'autofire',value:false});await sleep(50);
  const rapidBaseState=await snap(),baseFireRate=Number(rapidBaseState.test?.fireRate);assert(Number.isFinite(baseFireRate)&&Math.abs(baseFireRate-.28)<.01,`Rapid baseline fireRate drifted: ${baseFireRate}`);
  await cmd({command:'skilltest',skill:'rapid',level:5});await sleep(50);const rapidAppliedState=await snap(),rapidFireRate=Number(rapidAppliedState.test?.fireRate);assert(Number.isFinite(rapidFireRate),`Rapid fireRate telemetry missing: ${rapidFireRate}`);assert(rapidFireRate<baseFireRate*.60&&Math.abs(rapidFireRate-.112)<.01,`Rapid LV5 modifier incorrect: base=${baseFireRate}, rapid=${rapidFireRate}`);
  for(let i=0;i<40;i++)await spawnTarget(150+(i%5)*8);await cmd({command:'autofire',value:true});const rapid0=await snap();await sleep(1400);const rapid1=await snap();const rapidRate=rapid1.test.shotsFired-rapid0.test.shotsFired;if(rapidRate<3)warnings.push(`Rapid cadence sample unavailable (${rapidRate} shots), modifier validated directly at ${rapidFireRate}s`);

  // Special-shot schedules are validated by waiting for enough actual shots, not by a fixed wall-clock window.
  // This removes false reds on slower CI runners while still requiring the real projectile counters to advance.
  const checkSpecial=async(skill,counterField,minShots,label)=>{
    await cmd({command:'autofire',value:false});await cmd({command:'clear'});await cmd({command:'skillreset'});await sleep(40);
    await cmd({command:'skilltest',skill,level:5});
    for(let i=0;i<60;i++)await spawnTarget(150+(i%8)*10);
    const before=await snap();const startShots=before.test.shotsFired,startCounter=before.test[counterField];
    await cmd({command:'autofire',value:true});
    try{await page.waitForFunction(({startShots,minShots})=>window.CaosTest.snapshot().test.shotsFired>=startShots+minShots,{startShots,minShots},{timeout:7000})}catch{}
    const after=await snap();
    assert(after.test.shotsFired>=startShots+minShots,`${label} sample did not fire enough shots: fired=${after.test.shotsFired-startShots}`);
    assert(after.test[counterField]>startCounter,`${label} schedule produced no special projectile after ${after.test.shotsFired-startShots} shots`);
  };
  await checkSpecial('pierce','pierceShots',10,'Pierce');
  await checkSpecial('ice','iceShots',12,'Ice');
  await checkSpecial('explosive','explosiveShots',12,'Explosive');
  noErrors('special-shot runtime error');

  await cmd({command:'pause'});await sleep(250);assert((await snap()).paused===true,'pause failed');await cmd({command:'resume'});await sleep(250);assert((await snap()).paused===false,'resume failed');
  await cmd({command:'boss',amount:1});await sleep(500);assert((await snap()).bosses>=1,'boss spawn failed');noErrors('boss runtime error');
  const hp0=(await snap()).health;await cmd({command:'damage',amount:7,target:'p1'});await sleep(250);assert((await snap()).health<hp0,'damage command did not reduce health');
  await cmd({command:'eventmeteor',value:true,interval:.6,warning:.7,batch:2});await sleep(2500);assert((await snap()).events.meteor.active===true,'meteor event did not activate');noErrors('meteor runtime error');await cmd({command:'eventmeteor',value:false});
  await cmd({command:'spawn',amount:140,mob:'infected'});const stress0=await snap();await sleep(10000);const stress1=await snap();assert(stress1.frameSeq>stress0.frameSeq+100,'stress test froze game loop');assert(stress1.fps>=10,`stress FPS collapsed: ${stress1.fps}`);assert(Number.isFinite(stress1.health),'player health became invalid');noErrors('stress runtime error');

  if(warnings.length)console.log(`GAMEPLAY BOT WARN [${name}] ${warnings.join(' | ')}`);
  console.log(`GAMEPLAY BOT OK [${name}] fps=${stress1.fps} mobs=${stress1.mobs} fired=${stress1.test.shotsFired} hit=${stress1.test.shotsHit} expired=${stress1.test.shotsExpired}`);
  await context.close();
}

let browser;
try{await waitServer();browser=await chromium.launch({headless:true});await runScenario(browser,'mobile',{width:390,height:844});await runScenario(browser,'desktop',{width:1440,height:900});console.log('CAOS GAMEPLAY BOT: ALL SCENARIOS PASSED')}finally{if(browser)await browser.close();server.kill('SIGTERM')}
