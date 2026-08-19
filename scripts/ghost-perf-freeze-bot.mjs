import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4183,BASE=`http://127.0.0.1:${PORT}`;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitServer(){for(let i=0;i<50;i++){try{const r=await fetch(BASE);if(r.ok)return}catch{}await sleep(200)}throw Error('Ghost perf/freeze server did not start')}

async function run(browser,name,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/i.test(m.text()))errors.push(m.text())});
  await page.goto(`${BASE}/?ci=1&ghost=perf-freeze-${name}-${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.CaosTest&&window.CaosRuntimeReady===true,null,{timeout:20000});
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>window.CaosTest?.snapshot().running===true,null,{timeout:5000});
  const cmd=d=>page.evaluate(d=>window.CaosTest.command(d),d);
  const snap=()=>page.evaluate(()=>window.CaosTest.snapshot());
  await cmd({command:'horde',value:false});
  await cmd({command:'autofire',value:false});

  const tiers=[['normal',null],['elite','elite'],['corrupted','corrupted']];
  for(const [label,tier] of tiers){
    await cmd({command:'clear'});await sleep(250);
    await cmd({command:'spawn',amount:50,tier});
    await sleep(1800);
    const s=await snap();
    console.log(`GHOST PERF [${name}] ${label} mobs=${s.mobs} fps=${s.fps} perf=${s.perfMode}`);
    if(s.mobs<45)throw Error(`[GHOST PERF ${name}] ${label} crowd did not stay populated: ${s.mobs}`);
    if(label==='corrupted'&&s.perfMode<1)throw Error(`[GHOST PERF ${name}] corrupted crowd failed to trigger adaptive perf mode`);
    if(s.fps>0&&s.fps<24)throw Error(`[GHOST PERF ${name}] ${label} crowd catastrophic FPS ${s.fps}`);
  }

  await cmd({command:'clear'});await sleep(250);
  await cmd({command:'eventmeteorconfig',interval:.65,warning:1.2,batch:5,radius:70,playerDamage:1,mobDamage:1});
  await cmd({command:'eventmeteor',value:true});
  await sleep(800);
  let before=await snap();
  if(!before.events?.meteor?.active)throw Error(`[GHOST FREEZE ${name}] meteor event did not activate`);
  if((before.events?.meteor?.pending||0)<1)throw Error(`[GHOST FREEZE ${name}] no pending meteors before freeze`);
  await cmd({command:'freeze',seconds:2});
  await sleep(250);
  before=await snap();
  const pending=before.events.meteor.pending,health=before.health;
  await sleep(1000);
  const during=await snap();
  console.log(`GHOST FREEZE [${name}] pending=${pending}->${during.events.meteor.pending} hp=${health}->${during.health}`);
  if(during.events.meteor.pending!==pending)throw Error(`[GHOST FREEZE ${name}] meteor queue advanced during arena freeze`);
  if(during.health!==health)throw Error(`[GHOST FREEZE ${name}] player took meteor damage during arena freeze`);
  await cmd({command:'eventmeteor',value:false});

  if(errors.length)throw Error(`[GHOST PERF/FREEZE ${name}] runtime errors: ${errors.join(' | ')}`);
  await context.close();
}

let browser;
try{await waitServer();browser=await chromium.launch({headless:true});await run(browser,'mobile',{width:390,height:844});await run(browser,'desktop',{width:1440,height:900});console.log('GHOST PERF/FREEZE BOT: ALL CHECKS PASSED')}finally{if(browser)await browser.close();server.kill('SIGTERM')}
