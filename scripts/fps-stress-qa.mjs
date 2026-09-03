import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT=4192,BASE=`http://127.0.0.1:${PORT}`;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,msg)=>{if(!ok)throw Error(`FPS STRESS QA FAILED: ${msg}`)};

async function waitServer(){for(let i=0;i<50;i++){try{const r=await fetch(BASE,{cache:'no-store'});if(r.ok)return}catch{}await sleep(200)}throw Error('FPS QA server did not start')}

function summarize(label,mobs,summons,s){
  return {label,mobs,summons,frames:s.frames,avgFps:+s.avgFps.toFixed(1),fps1Low:+s.fps1Low.toFixed(1),p95FrameMs:+s.p95.toFixed(1),p99FrameMs:+s.p99.toFixed(1),worstFrameMs:+s.worst.toFixed(1),over16:s.over16,over33:s.over33,over50:s.over50};
}

let browser;
try{
  await waitServer();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/i.test(m.text()))errors.push(m.text())});
  page.on('requestfailed',req=>{if(/onrender\.com|firebase|gstatic|unpkg|jsdelivr/i.test(req.url()))return;errors.push(`${req.url()} ${req.failure()?.errorText||''}`)});
  await page.route('https://caos-live-game-server-va.onrender.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.goto(`${BASE}/?ci=1&fpsqa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#startBtn').waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>window.CaosTest&&document.getElementById('startBtn')&&!document.getElementById('startBtn').disabled,null,{timeout:20000});
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>window.CaosTest?.snapshot().running===true,null,{timeout:7000});
  const cmd=d=>page.evaluate(d=>window.CaosTest.command(d),d);
  const snap=()=>page.evaluate(()=>window.CaosTest.snapshot());
  await cmd({command:'horde',value:false});await cmd({command:'autofire',value:false});await cmd({command:'clear'});

  const collect=ms=>page.evaluate(ms=>new Promise(resolve=>{
    const samples=[];let last=performance.now(),start=last;
    function tick(now){const dt=now-last;last=now;if(dt>0&&dt<1000)samples.push(dt);if(now-start<ms)return requestAnimationFrame(tick);
      const sorted=[...samples].sort((a,b)=>a-b),sum=samples.reduce((a,b)=>a+b,0),pick=p=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))]||0;
      const mean=sum/Math.max(1,samples.length),p99=pick(.99);
      resolve({frames:samples.length,avgFps:1000/Math.max(.01,mean),fps1Low:1000/Math.max(.01,p99),p95:pick(.95),p99,worst:sorted.at(-1)||0,over16:samples.filter(x=>x>16.7).length,over33:samples.filter(x=>x>33.4).length,over50:samples.filter(x=>x>50).length});
    }requestAnimationFrame(tick);
  }),ms);

  const report=[];
  for(const target of [0,50,100,150,220,300]){
    await cmd({command:'clear'});
    if(target)await cmd({command:'spawn',amount:target,mob:'infected'});
    await sleep(450);
    const before=await snap();
    const sample=await collect(2400);
    const after=await snap();
    report.push(summarize(`mobs-${target}`,after.mobs,0,sample));
    assert(after.frameSeq>before.frameSeq+20,`frame loop stalled at ${target} mobs`);
    assert(sample.frames>30,`too few RAF samples at ${target} mobs`);
    assert(sample.worst<350,`catastrophic frame >350ms at ${target} mobs (${sample.worst.toFixed(1)}ms)`);
  }

  await cmd({command:'clear'});await cmd({command:'spawn',amount:220,mob:'infected'});
  await page.waitForFunction(()=>typeof window.CaosLiveCommand==='function'&&window.__caosNecromancer?.snapshot,null,{timeout:7000});
  await page.evaluate(()=>{window.__caosNecromancerBodyCandidateChecks=0;window.__caosNecromancerBodyNaiveChecks=0;window.CaosLiveCommand({command:'necro_config',enabled:true,maxSummons:3,everyKills:25,hpScale:5,damageScale:.55,aggroPct:12,source:'fpsqa'});window.CaosLiveCommand({command:'necro_raise',amount:3,mob:'brute',tier:'normal',source:'fpsqa'});});
  await page.waitForFunction(()=>window.__caosNecromancer?.snapshot().summons.length===3,null,{timeout:5000});
  await sleep(1800);
  const necroSample=await collect(3200),necro=await page.evaluate(()=>({state:window.__caosNecromancer.snapshot(),candidate:Number(window.__caosNecromancerBodyCandidateChecks||0),naive:Number(window.__caosNecromancerBodyNaiveChecks||0)}));
  report.push(summarize('mobs-220-necro-3',220,necro.state.summons.length,necroSample));
  assert(necro.state.summons.length===3,'Necromancer stress scenario lost summons');
  assert(necro.naive>0&&necro.candidate>=0,'Necromancer collision telemetry missing');
  assert(necro.candidate<necro.naive*.35,`spatial collision pruning ineffective: ${necro.candidate}/${necro.naive}`);
  assert(necroSample.worst<350,`Necromancer stress catastrophic frame ${necroSample.worst.toFixed(1)}ms`);
  assert(errors.length===0,errors.join(' | '));

  const output={suite:'Caos Canvas FPS Stress QA v1',note:'Chromium/CI is a regression benchmark, not an iPhone GPU score. Compare runs; real iPhone remains the final device check.',viewport:{width:390,height:844,dpr:2},generatedAt:new Date().toISOString(),collisionPruning:{candidateChecks:necro.candidate,naiveChecks:necro.naive,reductionPct:+((1-necro.candidate/Math.max(1,necro.naive))*100).toFixed(2)},scenarios:report};
  fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/fps-stress-report.json',JSON.stringify(output,null,2));
  console.log('\n=== CAOS CANVAS FPS STRESS QA ===');console.table(report);console.log('Necromancer collision pruning',output.collisionPruning);console.log('REPORT: artifacts/fps-stress-report.json');
  await context.close();
}finally{if(browser)await browser.close();server.kill('SIGTERM')}
