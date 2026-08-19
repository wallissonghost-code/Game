import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4177, BASE=`http://127.0.0.1:${PORT}`;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitServer(){
  for(let i=0;i<40;i++){
    try{const r=await fetch(BASE);if(r.ok)return}catch{}
    await sleep(250)
  }
  throw Error('Ghost whole-game server did not start')
}

function finite(v){return Number.isFinite(Number(v))}

async function run(browser,name,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|favicon/i.test(m.text()))errors.push(`console: ${m.text()}`)});
  await page.route('https://caos-live-game-server-va.onrender.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.goto(`${BASE}/?ci=1&ghost=whole-${name}-${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#startBtn').waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>window.CaosTest&&window.CaosRuntimeReady===true&&document.getElementById('startBtn')&&!document.getElementById('startBtn').disabled,null,{timeout:20000});
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>window.CaosTest?.snapshot().running===true,null,{timeout:5000});

  const snap=()=>page.evaluate(()=>window.CaosTest.snapshot());
  const cmd=d=>page.evaluate(d=>window.CaosTest.command(d),d);
  const target=(distance,angle)=>page.evaluate(({distance,angle})=>window.CaosTest.spawnTarget(distance,angle),{distance,angle});
  const assert=(ok,msg)=>{if(!ok)throw Error(`[GHOST-WHOLE ${name}] ${msg}`)};
  const sanity=(s,label)=>{
    assert(s&&s.running!==undefined,`${label}: no state`);
    for(const [k,v] of Object.entries({health:s.health,maxHealth:s.maxHealth,level:s.level,xp:s.xp,mobs:s.mobs,kills:s.kills}))assert(finite(v),`${label}: ${k} is not finite (${v})`);
    assert(Number(s.health)>=0&&Number(s.health)<=Number(s.maxHealth)+1,`${label}: health out of range ${s.health}/${s.maxHealth}`);
    assert((s.test?.shotsFired??0)>=(s.test?.shotsHit??0),`${label}: hits exceed shots`);
    assert((s.test?.shotsFired??0)>=(s.test?.shotsExpired??0),`${label}: expired exceed shots`);
  };

  let s=await snap(); sanity(s,'boot');
  console.log(`GHOST WHOLE [${name}] boot version=${s.version} fps=${s.fps}`);

  // 1) Natural gameplay + movement + horde pressure.
  await cmd({command:'gameplaymode',value:'classic'});
  await cmd({command:'autofire',value:true});
  await cmd({command:'horde',value:true});
  await page.keyboard.down('d'); await sleep(900); await page.keyboard.up('d');
  await page.keyboard.down('s'); await sleep(700); await page.keyboard.up('s');
  await sleep(2500);
  s=await snap(); sanity(s,'natural-play');
  assert(s.frameSeq>20,'natural-play: frame loop did not advance');

  // 2) Force every skill path once, then create close/medium targets.
  await cmd({command:'skillmax'});
  await cmd({command:'clear'});
  for(let i=0;i<12;i++)assert(await target(42+(i%4)*45,(Math.PI*2*i)/12),`skill/crowd target ${i} failed`);
  const sk0=await snap();
  await sleep(2600);
  const sk1=await snap(); sanity(sk1,'skills-crowd');
  assert(sk1.test.shotsFired>sk0.test.shotsFired,'skills-crowd: no shots fired');
  assert(sk1.test.shotsHit>sk0.test.shotsHit,'skills-crowd: no hits registered');

  // 3) Gameplay mode transitions must keep rendering and state alive.
  for(const mode of ['sweep','hardcore','classic']){
    await cmd({command:'clear'});
    await cmd({command:'gameplaymode',value:mode});
    assert(await target(150,mode==='sweep'?0.25:1.1),`${mode}: target failed`);
    if(mode==='hardcore'){await page.keyboard.down('w');await sleep(350);await page.keyboard.up('w')}
    await sleep(800);
    const ms=await snap(); sanity(ms,`mode-${mode}`);
    assert(ms.gameplayMode===mode,`mode-${mode}: state did not switch`);
  }

  // 4) Native events: double XP + meteor. Must not crash or corrupt player state.
  await cmd({command:'eventdoublexp',value:true});
  await cmd({command:'eventmeteorconfig',interval:.55,warning:.35,radius:70,playerDamage:1,mobDamage:20,batch:2});
  await cmd({command:'eventmeteor',value:true});
  await cmd({command:'clear'});
  for(let i=0;i<8;i++)assert(await target(90+(i%3)*35,(Math.PI*2*i)/8),`meteor target ${i} failed`);
  await sleep(2600);
  const ev=await snap(); sanity(ev,'events');
  assert(ev.events?.doubleXp===true,'events: double XP did not activate');
  assert(ev.events?.meteor?.active===true,'events: meteor did not activate');
  await cmd({command:'eventmeteor',value:false});
  await cmd({command:'eventdoublexp',value:false});

  // 5) Boss + crowd pressure, then clear and recovery.
  await cmd({command:'boss',amount:2});
  await cmd({command:'spawn',amount:50});
  await sleep(1800);
  const pressure=await snap(); sanity(pressure,'boss-pressure');
  assert(pressure.mobs>0,'boss-pressure: no mobs alive');
  await cmd({command:'clear'});
  await sleep(180);
  assert(await target(110,-1.3),'recovery target failed');
  const r0=await snap(); await sleep(1100); const r1=await snap(); sanity(r1,'recovery');
  assert(r1.test.shotsFired>r0.test.shotsFired,'recovery: autofire did not wake after clear');

  // 6) Pause/resume should freeze and recover loop without UI/runtime errors.
  await cmd({command:'pause'}); const p0=await snap(); await sleep(500); const p1=await snap();
  assert(p1.paused===true,'pause: state not paused');
  assert(Math.abs((p1.frameSeq||0)-(p0.frameSeq||0))<40,'pause: frame state advanced unexpectedly');
  await cmd({command:'resume'}); await sleep(500); const p2=await snap(); sanity(p2,'resume');
  assert(p2.paused===false,'resume: still paused');

  // 7) Reset should produce a valid fresh run.
  await page.evaluate(()=>window.CaosTest.reset());
  await sleep(700);
  const reset=await snap(); sanity(reset,'reset');
  assert(reset.running===true,'reset: game not running');
  assert(reset.level===1,'reset: level did not return to 1');

  // Runtime quality gate. CI can be slow, so only reject catastrophic FPS.
  await sleep(900);
  const end=await snap(); sanity(end,'end');
  if(finite(end.fps)&&Number(end.fps)>0)assert(Number(end.fps)>=8,`catastrophic FPS ${end.fps}`);
  assert(errors.length===0,`runtime errors: ${errors.join(' | ')}`);

  console.log(`GHOST WHOLE OK [${name}] frames=${end.frameSeq} fps=${end.fps} shots=${end.test?.shotsFired} hits=${end.test?.shotsHit}`);
  await context.close();
}

let browser;
try{
  await waitServer();
  browser=await chromium.launch({headless:true});
  await run(browser,'mobile',{width:390,height:844});
  await run(browser,'desktop',{width:1440,height:900});
  console.log('GHOST WHOLE-GAME BOT: ALL CHECKS PASSED');
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
