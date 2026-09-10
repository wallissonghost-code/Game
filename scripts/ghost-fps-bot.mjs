import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4182,BASE=`http://127.0.0.1:${PORT}`;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitServer(){for(let i=0;i<50;i++){try{const r=await fetch(BASE);if(r.ok)return}catch{}await sleep(200)}throw Error('Ghost FPS server did not start')}

async function run(browser,name,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/i.test(m.text()))errors.push(m.text())});
  await page.route('https://caos-live-game-server-va.onrender.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.goto(`${BASE}/?ci=1&ghost=fps-${name}-${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.CaosTest&&window.CaosRuntimeReady===true,null,{timeout:20000});
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>window.CaosTest?.snapshot().running===true,null,{timeout:5000});
  const cmd=d=>page.evaluate(d=>window.CaosTest.command(d),d);
  const snap=()=>page.evaluate(()=>window.CaosTest.snapshot());
  const fpsSample=async(ms=2400)=>{
    const vals=[];const end=Date.now()+ms;
    while(Date.now()<end){await sleep(180);const s=await snap();const f=Number(s.fps||window.__dummy||0);if(f>0)vals.push(f)}
    vals.sort((a,b)=>a-b);return {min:vals[0]||0,p10:vals[Math.floor(vals.length*.10)]||0,median:vals[Math.floor(vals.length*.5)]||0,avg:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0,samples:vals.length};
  };
  const spawnRing=async(count,base=95)=>{for(let i=0;i<count;i++){const a=i*Math.PI*2/count,d=base+(i%7)*19;await page.evaluate(({d,a})=>window.CaosTest.spawnTarget(d,a),{d,a});}};
  await cmd({command:'horde',value:false});
  await cmd({command:'autofire',value:true});
  await cmd({command:'gameplaymode',value:'classic'});
  await cmd({command:'clear'});
  await sleep(500);

  const results=[];
  for(const tier of [0,30,80,150,240]){
    await cmd({command:'clear'});await sleep(300);
    if(tier)await spawnRing(tier,90);
    await sleep(1200);
    const s=await snap(),f=await fpsSample(tier>=150?3200:2400);
    results.push({tier,mobs:s.mobs,perfMode:s.perfMode,fps:f});
    console.log(`GHOST FPS [${name}] requested=${tier} mobs=${s.mobs} perf=${s.perfMode} min=${f.min} p10=${f.p10} median=${f.median} avg=${f.avg.toFixed(1)}`);
    if(tier<=30&&f.median&&f.median<48)throw Error(`[GHOST FPS ${name}] low-load median FPS ${f.median}`);
    if(tier>=80&&f.median&&f.median<24)throw Error(`[GHOST FPS ${name}] catastrophic FPS under load: ${f.median} at ${s.mobs} mobs`);
  }

  // Stress effects + projectile load on a medium crowd.
  await cmd({command:'clear'});await spawnRing(100,105);await cmd({command:'skillmax'});await sleep(1000);
  await cmd({command:'meteorconfig',interval:.55,warning:.65,batch:12,radius:80,playerDamage:1,mobDamage:1});
  await cmd({command:'meteor',value:true});await sleep(1800);
  const fxState=await snap(),fxFps=await fpsSample(3200);
  console.log(`GHOST FPS FX [${name}] mobs=${fxState.mobs} perf=${fxState.perfMode} median=${fxFps.median} p10=${fxFps.p10} avg=${fxFps.avg.toFixed(1)}`);
  await cmd({command:'meteor',value:false});
  if(fxFps.median&&fxFps.median<20)throw Error(`[GHOST FPS ${name}] effects stress collapsed FPS to ${fxFps.median}`);

  if(errors.length)throw Error(`[GHOST FPS ${name}] runtime errors: ${errors.join(' | ')}`);
  console.log(`GHOST FPS SUMMARY [${name}] ${JSON.stringify({results,fx:{mobs:fxState.mobs,perfMode:fxState.perfMode,fps:fxFps}})}`);
  await context.close();
}

let browser;
try{await waitServer();browser=await chromium.launch({headless:true});await run(browser,'mobile',{width:390,height:844});await run(browser,'desktop',{width:1440,height:900});console.log('GHOST FPS BOT: ALL CHECKS PASSED')}finally{if(browser)await browser.close();server.kill('SIGTERM')}
