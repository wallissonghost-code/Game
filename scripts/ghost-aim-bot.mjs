import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4176, BASE=`http://127.0.0.1:${PORT}`;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const angleDiff=(a,b)=>Math.abs(((a-b+Math.PI*3)%(Math.PI*2))-Math.PI);
const vectorAngle=v=>Math.atan2(v.vy,v.vx);
async function waitServer(){for(let i=0;i<40;i++){try{const r=await fetch(BASE);if(r.ok)return}catch{}await sleep(250)}throw Error('Ghost server did not start')}

async function run(browser,name,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage(),errors=[];
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
  const shotOK=(ls,t=.08)=>!!ls&&Number.isFinite(ls.targetX)&&Number.isFinite(ls.targetY)&&angleDiff(shotAngle(ls),ls.aim)<t;
  const correctFor=(ls,a,t=.18)=>shotOK(ls)&&angleDiff(shotAngle(ls),a)<t;
  const dismissSkillPick=async()=>{for(let i=0;i<5;i++){const v=await page.evaluate(()=>document.getElementById('skillPick')?.classList.contains('show')||false);if(!v)return;await page.evaluate(()=>document.querySelector('#skillChoices button')?.click());await sleep(100)}};

  await cmd({command:'horde',value:false});
  await cmd({command:'clear'});
  await cmd({command:'skillreset'});
  await cmd({command:'gameplaymode',value:'classic'});
  await cmd({command:'autofire',value:false});

  // Keep this target inside both mobile and desktop visible bounds.
  assert(await target(300,Math.PI/2),'could not spawn straight projectile target');
  const before=await snap();
  await cmd({command:'autofire',value:true});
  let shot=null,bullet=null;
  for(let i=0;i<180;i++){
    const s=await snap();
    if(s.test.shotsFired>before.test.shotsFired&&s.test.lastShot){
      shot=s.test.lastShot;
      bullet=s.test.liveBullets?.find(b=>b.shotId===shot.shotId)||null;
      if(bullet)break;
    }
    await sleep(8);
  }
  assert(shot,'straight projectile test saw no shot');
  assert(bullet,`shot ${shot?.shotId} was never observable as a live projectile`);
  await cmd({command:'autofire',value:false});
  assert(angleDiff(vectorAngle(bullet),vectorAngle(shot))<.02,'projectile launch vector differs from atomic shot vector');
  let observed=1,maxVectorError=0;
  for(let i=0;i<18;i++){
    await sleep(8);
    const s=await snap(),b=s.test.liveBullets?.find(x=>x.shotId===shot.shotId);
    if(!b)break;
    observed++;
    maxVectorError=Math.max(maxVectorError,angleDiff(vectorAngle(b),vectorAngle(shot)));
    assert(Math.abs((b.vx||0)-(b.launchVx||0))<.01&&Math.abs((b.vy||0)-(b.launchVy||0))<.01,`shot ${shot.shotId} changed vx/vy in flight`);
  }
  console.log(`GHOST STRAIGHT [${name}] shotId=${shot.shotId} samples=${observed} maxErr=${maxVectorError.toFixed(5)}`);
  assert(maxVectorError<.02,`projectile curved in flight: ${maxVectorError}`);

  await cmd({command:'clear'});await sleep(180);
  assert(await target(120,0),'could not spawn baseline target');
  await cmd({command:'autofire',value:true});
  const w0=await snap();await sleep(900);const w1=await snap();
  assert(w1.test.shotsFired>w0.test.shotsFired,'baseline produced no shots');
  assert(correctFor(w1.test.lastShot,0),`baseline atomic shot mismatch ${JSON.stringify(w1.test.lastShot)}`);

  await cmd({command:'autofire',value:false});await cmd({command:'clear'});
  const NEW=Math.PI*.78;assert(await target(120,NEW),'could not spawn replacement target');
  await cmd({command:'autofire',value:true});const h0=await snap();await sleep(1400);const h1=await snap();
  assert(h1.test.shotsFired-h0.test.shotsFired>=3,'stationary retarget fired too few shots');
  assert(correctFor(h1.test.lastShot,NEW),`stationary retarget stale: ${JSON.stringify(h1.test.lastShot)}`);
  console.log(`GHOST RETARGET [${name}] OK`);

  await cmd({command:'autofire',value:false});await cmd({command:'clear'});await cmd({command:'gameplaymode',value:'classic'});
  const angles=[0,Math.PI*.33,Math.PI*.66,Math.PI,Math.PI*1.33,Math.PI*1.66];
  for(let i=0;i<18;i++)assert(await target(52+(i%4)*24,angles[i%angles.length]),'could not spawn crowd');
  await cmd({command:'autofire',value:true});
  const c0=await snap();let prev=c0.test.shotsFired,bad=0,seen=0;
  for(let i=0;i<40;i++){await sleep(150);const s=await snap();if(s.test.shotsFired>prev){seen+=s.test.shotsFired-prev;bad=shotOK(s.test.lastShot)?0:bad+1;prev=s.test.shotsFired}if(bad>=2)break}
  const c1=await snap();
  console.log(`GHOST CROWD [${name}] shots=${c1.test.shotsFired-c0.test.shotsFired} observed=${seen} badStreak=${bad}`);
  assert(c1.test.shotsFired-c0.test.shotsFired>=8,'crowd fired too few shots');
  assert(bad<2,'crowd reproduced stale atomic shot direction');

  await cmd({command:'autofire',value:false});await cmd({command:'clear'});await dismissSkillPick();await sleep(200);
  const REC=-Math.PI*.62;assert(await target(86,REC),'could not spawn recovery target');
  await cmd({command:'autofire',value:true});const r0=await snap();await sleep(1100);const r1=await snap();
  assert(r1.test.shotsFired-r0.test.shotsFired>=2,'new target did not wake stationary fire');
  assert(correctFor(r1.test.lastShot,REC),`recovery stale: ${JSON.stringify(r1.test.lastShot)}`);

  assert(errors.length===0,`runtime errors: ${errors.join(' | ')}`);
  console.log(`GHOST AIM OK [${name}] straight + atomic target + crowd + recovery passed`);
  await context.close();
}

let browser;
try{await waitServer();browser=await chromium.launch({headless:true});await run(browser,'mobile',{width:390,height:844});await run(browser,'desktop',{width:1440,height:900});console.log('GHOST AIM BOT: ALL CHECKS PASSED')}finally{if(browser)await browser.close();server.kill('SIGTERM')}
