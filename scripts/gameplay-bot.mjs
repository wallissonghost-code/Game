import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4174, BASE=`http://127.0.0.1:${PORT}`;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitServer(){for(let i=0;i<40;i++){try{const r=await fetch(BASE,{cache:'no-store'});if(r.ok)return}catch{}await sleep(250)}throw Error('gameplay bot server did not start')}

async function runScenario(browser,name,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
  await page.route('https://caos-live-game-server-va.onrender.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.goto(`${BASE}/?ci=1&bot=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#startBtn').waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>window.CaosTest&&document.getElementById('startBtn')&&!document.getElementById('startBtn').disabled,null,{timeout:15000});
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>window.CaosTest?.snapshot().running===true,null,{timeout:5000});

  const snap=()=>page.evaluate(()=>window.CaosTest.snapshot());
  const cmd=d=>page.evaluate(d=>window.CaosTest.command(d),d);
  const assert=(ok,msg)=>{if(!ok)throw Error(`[${name}] ${msg}`)};
  const noErrors=label=>assert(errors.length===0,`${label}; ${errors.join(' | ')}`);

  let s0=await snap();
  await sleep(3000);
  let s1=await snap();
  assert(s1.frameSeq>s0.frameSeq+20,'game loop did not advance');
  assert(s1.fps>=20,`low/dead FPS at baseline: ${s1.fps}`);
  assert(s1.mobs>0,'no mobs spawned');
  noErrors('baseline runtime error');

  const x0=s1.test.playerX, y0=s1.test.playerY;
  await page.keyboard.down('d'); await sleep(700); await page.keyboard.up('d'); await sleep(150);
  const moved=await snap();
  assert(Math.hypot(moved.test.playerX-x0,moved.test.playerY-y0)>5,'keyboard movement failed');
  noErrors('movement runtime error');

  await cmd({command:'spawn',amount:18,mob:'grunt'});
  const combat0=await snap();
  await sleep(7000);
  const combat1=await snap();
  assert(combat1.test.shots>combat0.test.shots,'autofire produced no projectiles');
  assert(combat1.kills>combat0.kills || combat1.xp>combat0.xp,'combat produced no kill/xp progress');
  noErrors('combat runtime error');

  await cmd({command:'skilltest',skill:'rapid',level:3});
  await sleep(300);
  const skill=await snap();
  assert(skill.skillLv.rapid===3,'skill application failed');

  await cmd({command:'pause'}); await sleep(250);
  assert((await snap()).paused===true,'pause failed');
  await cmd({command:'resume'}); await sleep(250);
  assert((await snap()).paused===false,'resume failed');

  await cmd({command:'boss',amount:1}); await sleep(500);
  assert((await snap()).bosses>=1,'boss spawn failed');
  noErrors('boss runtime error');

  const hp0=(await snap()).health;
  await cmd({command:'damage',amount:7,target:'p1'}); await sleep(250);
  const hp1=(await snap()).health;
  assert(hp1<hp0,'damage command did not reduce health');

  await cmd({command:'eventmeteor',value:true,interval:.6,warning:.7,batch:2});
  await sleep(2500);
  const meteor=await snap();
  assert(meteor.events.meteor.active===true,'meteor event did not activate');
  noErrors('meteor runtime error');
  await cmd({command:'eventmeteor',value:false});

  await cmd({command:'spawn',amount:140,mob:'grunt'});
  const stress0=await snap();
  await sleep(10000);
  const stress1=await snap();
  assert(stress1.frameSeq>stress0.frameSeq+100,'stress test froze game loop');
  assert(stress1.fps>=10,`stress FPS collapsed: ${stress1.fps}`);
  assert(Number.isFinite(stress1.health),'player health became invalid');
  noErrors('stress runtime error');

  console.log(`GAMEPLAY BOT OK [${name}] fps=${stress1.fps} mobs=${stress1.mobs} kills=${stress1.kills} level=${stress1.level}`);
  await context.close();
}

let browser;
try{
  await waitServer();
  browser=await chromium.launch({headless:true});
  await runScenario(browser,'mobile',{width:390,height:844});
  await runScenario(browser,'desktop',{width:1440,height:900});
  console.log('CAOS GAMEPLAY BOT: ALL SCENARIOS PASSED');
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
