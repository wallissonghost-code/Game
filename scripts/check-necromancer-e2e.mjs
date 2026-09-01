import fs from 'node:fs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4183,BASE=`http://127.0.0.1:${PORT}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,msg)=>{if(!ok)throw Error(`NECROMANCER QA FAILED: ${msg}`)};

const actionsSource=fs.readFileSync('src/liveplus-necromancer-actions.js','utf8');
const hookSource=fs.readFileSync('src/liveplus-runtime-hook.js','utf8');
const necroSource=fs.readFileSync('src/companions/necromancer.js','utf8');
assert(/manifest\.actions\.splice\(0,manifest\.actions\.length/.test(actionsSource),'Live+ patch must preserve bridge ACTIONS array identity');
assert(!/manifest\.actions\s*=\s*manifest\.actions\.filter/.test(actionsSource),'manifest actions array is being replaced; panel command will become unsupported');
assert(/necro_raise/.test(actionsSource)&&/necro_config/.test(actionsSource),'required Necromancer Live+ actions missing');
assert(/function command\(d\)\{necromancerCommand\(d\);/.test(hookSource),'runtime hook does not force Necromancer dispatch into command(d)');
assert(/__caosNecromancerRendered/.test(hookSource),'render probe missing; QA cannot prove shadow reached canvas');
assert(/function necroSeparateSummons\(/.test(necroSource),'shadow-to-shadow separation missing');
assert(/necroEnemyTarget\(e\)\|\|duoEnemyTarget\(e\)/.test(necroSource),'enemy chase is not redirected during a Necromancer duel');
assert(/fx:'off'/.test(necroSource),'Necromancer no-FX contract missing');
assert(/function drawNecromancer\(\)\{if\(!necroSummons\.length\)return;for\(const s of necroSummons\)\{const p=world\(s\.x,s\.y\);drawEnemy\(s,p\)\}\}/.test(necroSource),'Necromancer renderer should draw the mob directly without aura/filter/ring');
assert(!/function drawNecromancer\([\s\S]{0,500}ctx\.filter/.test(necroSource),'Necromancer renderer still applies a canvas filter');

const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
async function waitServer(){for(let i=0;i<50;i++){try{const r=await fetch(BASE,{cache:'no-store'});if(r.ok)return}catch{}await sleep(200)}throw Error('Necromancer QA server did not start')}

let browser;
try{
 await waitServer();
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
 page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/i.test(m.text()))errors.push(`console: ${m.text()}`)});
 page.on('requestfailed',req=>{const u=req.url();if(/onrender\.com|firebase|gstatic|unpkg|jsdelivr/i.test(u))return;errors.push(`requestfailed: ${u} :: ${req.failure()?.errorText||'unknown'}`)});
 await page.route('https://caos-live-game-server-va.onrender.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
 await page.goto(`${BASE}/?ci=1&necroqa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('#startBtn').waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(()=>window.CaosTest&&document.getElementById('startBtn')&&!document.getElementById('startBtn').disabled,null,{timeout:20000});
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>window.CaosTest?.snapshot().running===true,null,{timeout:7000});
 await page.waitForFunction(()=>typeof window.CaosLiveCommand==='function'&&window.__caosNecromancer?.snapshot,null,{timeout:7000});

 await page.evaluate(()=>window.CaosLiveCommand({command:'horde',value:false,source:'qa'}));
 await page.evaluate(()=>window.CaosLiveCommand({command:'clear',source:'qa'}));
 await page.evaluate(()=>window.CaosLiveCommand({command:'autofire',value:false,source:'qa'}));
 await page.evaluate(()=>window.CaosLiveCommand({command:'necro_config',enabled:true,maxSummons:3,everyKills:25,hpScale:5,damageScale:.55,aggroPct:12,source:'qa'}));
 const before=await page.evaluate(()=>window.__caosNecromancer.snapshot());
 assert(before.enabled===true,'necro_config reached runtime but did not enable Necromancer');
 assert(before.summons.length===0,'QA expected empty shadow army before summon');
 assert(before.fx==='off','runtime did not expose no-FX mode');

 await page.evaluate(()=>window.CaosLiveCommand({command:'necro_raise',amount:3,mob:'brute',tier:'normal',source:'qa'}));
 await page.waitForFunction(()=>window.__caosNecromancer?.snapshot().summons.length===3,null,{timeout:4000});
 await page.waitForFunction(()=>Number(window.__caosNecromancerRendered||0)>=2,null,{timeout:4000});
 await sleep(300);
 const result=await page.evaluate(()=>({state:window.__caosNecromancer.snapshot(),rendered:window.__caosNecromancerRendered||0,mini:document.getElementById('connectionMini')?.textContent||''}));
 assert(result.state.summons.every(s=>s.type==='brute'),'wrong summoned skin/type');
 assert(result.state.skinSource==='game-mob-renderer','shadow is not using the real game mob renderer/skin source');
 assert(result.state.summons.every(s=>Number(s.hp)>0&&Number(s.max)>0),'summoned shadow has invalid HP');
 assert(Number(result.rendered)>=2,'summoned shadow exists in state but never reached canvas renderer');
 assert(!/AÇÃO NÃO SUPORTADA/i.test(result.mini),'game still reports Necromancer action as unsupported');
 const pts=result.state.summons.map(s=>[s.x,s.y]);
 for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)assert(Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1])>24,`shadows overlap after separation: pair ${i}/${j}`);

 await page.evaluate(()=>window.CaosTest.spawnTarget(95));
 await page.waitForFunction(()=>window.__caosNecromancer?.snapshot().summons.some(s=>s.duel),null,{timeout:5000});
 const duel=await page.evaluate(()=>window.__caosNecromancer.snapshot());
 assert(duel.summons.some(s=>s.duel),'shadow reached an enemy but no 1v1 duel lock was created');
 assert(errors.length===0,errors.join(' | '));
 console.log(`NECROMANCER QA OK: summons=${duel.summons.length} separated=yes duel=yes renderedFrames=${result.rendered} skin=${result.state.skinSource} fx=${duel.fx}`);
 await context.close();
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
