import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4176, BASE=`http://127.0.0.1:${PORT}`;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const angleDiff=(a,b)=>Math.abs(((a-b+Math.PI*3)%(Math.PI*2))-Math.PI);
const vectorAngle=v=>Math.atan2(v.vy,v.vx);
const facing=a=>['right','dr','down','dl','left','ul','up','ur'][Math.round((((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2))/(Math.PI/4))%8];
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
  const shotAngle=ls=>Math.atan2(ls.targetY-ls.spawnY,ls.targetX-ls.spawnX);
  const centerAngle=ls=>Math.atan2(ls.targetY-ls.playerY,ls.targetX-ls.playerX);
  const shotOK=(ls,t=.03)=>!!ls&&Number.isFinite(ls.targetX)&&Number.isFinite(ls.targetY)&&Number.isFinite(ls.spawnX)&&Number.isFinite(ls.spawnY)&&angleDiff(shotAngle(ls),ls.aim)<t;
  const visualOK=ls=>!!ls&&Number.isFinite(ls.visualAim)&&angleDiff(ls.visualAim,centerAngle(ls))<.035&&ls.visualDir===facing(ls.visualAim)&&angleDiff(ls.visualAim,ls.aim)<.44;
  const dismissSkillPick=async()=>{for(let i=0;i<5;i++){const v=await page.evaluate(()=>document.getElementById('skillPick')?.classList.contains('show')||false);if(!v)return;await page.evaluate(()=>document.querySelector('#skillChoices button')?.click());await sleep(100)}};

  await cmd({command:'horde',value:false});
  await cmd({command:'clear'});
  await cmd({command:'skillreset'});
  await cmd({command:'gameplaymode',value:'classic'});
  await cmd({command:'autofire',value:false});

  // Straight ballistic invariant.
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
  assert(shotOK(shot),`launch direction is not spawn-to-target: ${JSON.stringify(shot)}`);
  assert(visualOK(shot),`far visual/ballistic geometry invalid: ${JSON.stringify(shot)}`);
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

  // 16-angle close matrix: targets can be closer than the full visual barrel length.
  // This specifically catches the old oscillation: right muzzle -> target behind muzzle -> opposite muzzle -> ghost shot.
  const closeAngles=Array.from({length:16},(_,i)=>i*Math.PI/8);
  for(const CLOSE_ANGLE of closeAngles){
    await cmd({command:'autofire',value:false});await cmd({command:'clear'});await sleep(70);
    assert(await target(40,CLOSE_ANGLE),`could not spawn close target at ${CLOSE_ANGLE}`);
    const close0=await snap();
    await cmd({command:'autofire',value:true});
    let closeShot=null;
    for(let i=0;i<100;i++){
      await sleep(8);
      const s=await snap();
      if(s.test.shotsFired>close0.test.shotsFired){closeShot=s.test.lastShot;break}
    }
    assert(closeShot,`close target ${CLOSE_ANGLE} produced no shot`);
    const muzzleErr=angleDiff(closeShot.aim,shotAngle(closeShot));
    const visualErr=angleDiff(closeShot.visualAim,closeShot.aim);
    const centerErr=angleDiff(closeShot.visualAim,centerAngle(closeShot));
    console.log(`GHOST CLOSE [${name}] a=${CLOSE_ANGLE.toFixed(3)} id=${closeShot.shotId} dir=${closeShot.visualDir} scale=${Number(closeShot.muzzleScale).toFixed(3)} center=${centerErr.toFixed(4)} muzzle=${muzzleErr.toFixed(4)} visualBallistic=${visualErr.toFixed(4)}`);
    assert(shotOK(closeShot),`close shot is not aimed from its real spawn: ${JSON.stringify(closeShot)}`);
    assert(visualOK(closeShot),`close visual facing and ballistic shot diverged: ${JSON.stringify(closeShot)}`);
    assert(closeShot.muzzleScale>=.18&&closeShot.muzzleScale<=1,`invalid close muzzle scale: ${closeShot.muzzleScale}`);
    const sx=closeShot.spawnX-closeShot.playerX,sy=closeShot.spawnY-closeShot.playerY,tx=closeShot.targetX-closeShot.playerX,ty=closeShot.targetY-closeShot.playerY;
    assert(sx*tx+sy*ty>0,`projectile spawned on the opposite side of the target: ${JSON.stringify(closeShot)}`);
    await sleep(340);
    const close1=await snap();
    assert(close1.test.shotsHit>close0.test.shotsHit,`close target ${CLOSE_ANGLE} was fired at but not hit`);
  }
  await cmd({command:'autofire',value:false});

  await cmd({command:'clear'});await sleep(180);
  assert(await target(120,0),'could not spawn baseline target');
  await cmd({command:'autofire',value:true});
  const w0=await snap();await sleep(900);const w1=await snap();
  assert(w1.test.shotsFired>w0.test.shotsFired,'baseline produced no shots');
  assert(shotOK(w1.test.lastShot)&&visualOK(w1.test.lastShot),`baseline geometry mismatch ${JSON.stringify(w1.test.lastShot)}`);

  await cmd({command:'autofire',value:false});await cmd({command:'clear'});
  const NEW=Math.PI*.78;assert(await target(120,NEW),'could not spawn replacement target');
  await cmd({command:'autofire',value:true});const h0=await snap();await sleep(1400);const h1=await snap();
  assert(h1.test.shotsFired-h0.test.shotsFired>=3,'stationary retarget fired too few shots');
  assert(shotOK(h1.test.lastShot)&&visualOK(h1.test.lastShot),`stationary retarget stale: ${JSON.stringify(h1.test.lastShot)}`);
  console.log(`GHOST RETARGET [${name}] OK`);

  await cmd({command:'autofire',value:false});await cmd({command:'clear'});await cmd({command:'gameplaymode',value:'classic'});
  const angles=[0,Math.PI*.33,Math.PI*.66,Math.PI,Math.PI*1.33,Math.PI*1.66];
  for(let i=0;i<18;i++)assert(await target(40+(i%4)*18,angles[i%angles.length]),'could not spawn crowd');
  await cmd({command:'autofire',value:true});
  const c0=await snap();let prev=c0.test.shotsFired,bad=0,seen=0;
  for(let i=0;i<40;i++){await sleep(150);const s=await snap();if(s.test.shotsFired>prev){seen+=s.test.shotsFired-prev;bad=(shotOK(s.test.lastShot)&&visualOK(s.test.lastShot))?0:bad+1;prev=s.test.shotsFired}if(bad>=2)break}
  const c1=await snap();
  console.log(`GHOST CROWD [${name}] shots=${c1.test.shotsFired-c0.test.shotsFired} hits=${c1.test.shotsHit-c0.test.shotsHit} observed=${seen} badStreak=${bad}`);
  assert(c1.test.shotsFired-c0.test.shotsFired>=8,'crowd fired too few shots');
  assert(c1.test.shotsHit-c0.test.shotsHit>=5,'close crowd shots are still missing too often');
  assert(bad<2,'crowd reproduced stale/ghost-shot geometry');

  await cmd({command:'autofire',value:false});await cmd({command:'clear'});await dismissSkillPick();await sleep(200);
  const REC=-Math.PI*.62;assert(await target(86,REC),'could not spawn recovery target');
  await cmd({command:'autofire',value:true});const r0=await snap();await sleep(1100);const r1=await snap();
  assert(r1.test.shotsFired-r0.test.shotsFired>=2,'new target did not wake stationary fire');
  assert(shotOK(r1.test.lastShot)&&visualOK(r1.test.lastShot),`recovery stale: ${JSON.stringify(r1.test.lastShot)}`);

  await cmd({command:'autofire',value:false});await sleep(700);
  const end=await snap();
  const live=end.test.liveBullets?.length||0,accounted=end.test.shotsHit+end.test.shotsExpired+live;
  assert(accounted<=end.test.shotsFired,`projectile accounting exceeded fired: fired=${end.test.shotsFired} accounted=${accounted}`);
  assert(end.test.shotsFired-accounted<=2,`too many shots vanished: fired=${end.test.shotsFired} hit=${end.test.shotsHit} expired=${end.test.shotsExpired} live=${live}`);
  assert(errors.length===0,`runtime errors: ${errors.join(' | ')}`);
  console.log(`GHOST AIM OK [${name}] 16-angle close parallax + visual facing + straight + crowd + recovery passed`);
  await context.close();
}

let browser;
try{await waitServer();browser=await chromium.launch({headless:true});await run(browser,'mobile',{width:390,height:844});await run(browser,'desktop',{width:1440,height:900});console.log('GHOST AIM BOT: ALL CHECKS PASSED')}finally{if(browser)await browser.close();server.kill('SIGTERM')}
