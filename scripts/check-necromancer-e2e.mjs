import fs from 'node:fs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4183,BASE=`http://127.0.0.1:${PORT}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,msg)=>{if(!ok)throw Error(`NECROMANCER QA FAILED: ${msg}`)};

// Gate 1: contrato Live+ real. O bridge mantém ACTIONS por referência; o patch NÃO pode trocar o Array.
const actionsSource=fs.readFileSync('src/liveplus-necromancer-actions.js','utf8');
const hookSource=fs.readFileSync('src/liveplus-runtime-hook.js','utf8');
assert(/manifest\.actions\.splice\(0,manifest\.actions\.length/.test(actionsSource),'Live+ patch must preserve bridge ACTIONS array identity');
assert(!/manifest\.actions\s*=\s*manifest\.actions\.filter/.test(actionsSource),'manifest actions array is being replaced; panel command will become unsupported');
assert(/necro_raise/.test(actionsSource)&&/necro_config/.test(actionsSource),'required Necromancer Live+ actions missing');
assert(/function command\(d\)\{necromancerCommand\(d\);/.test(hookSource),'runtime hook does not force Necromancer dispatch into command(d)');
assert(/__caosNecromancerRendered/.test(hookSource),'render probe missing; QA cannot prove shadow reached canvas');

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

 // Mata ruído da horda e executa o MESMO command(d) usado pelo Live+.
 await page.evaluate(()=>window.CaosLiveCommand({command:'horde',value:false,source:'qa'}));
 await page.evaluate(()=>window.CaosLiveCommand({command:'clear',source:'qa'}));
 await page.evaluate(()=>window.CaosLiveCommand({command:'autofire',value:false,source:'qa'}));
 await page.evaluate(()=>window.CaosLiveCommand({command:'necro_config',enabled:true,maxSummons:3,everyKills:25,hpScale:5,damageScale:.55,aggroPct:12,source:'qa'}));
 const before=await page.evaluate(()=>window.__caosNecromancer.snapshot());
 assert(before.enabled===true,'necro_config reached runtime but did not enable Necromancer');
 assert(before.summons.length===0,'QA expected empty shadow army before summon');

 await page.evaluate(()=>window.CaosLiveCommand({command:'necro_raise',amount:1,mob:'brute',tier:'normal',source:'qa'}));
 await page.waitForFunction(()=>window.__caosNecromancer?.snapshot().summons.length===1,null,{timeout:4000});
 await page.waitForFunction(()=>Number(window.__caosNecromancerRendered||0)>=2,null,{timeout:4000});
 const result=await page.evaluate(()=>({state:window.__caosNecromancer.snapshot(),rendered:window.__caosNecromancerRendered||0,mini:document.getElementById('connectionMini')?.textContent||''}));
 const shadow=result.state.summons[0];
 assert(shadow?.type==='brute',`wrong summoned skin/type: ${shadow?.type}`);
 assert(result.state.skinSource==='game-mob-renderer','shadow is not using the real game mob renderer/skin source');
 assert(Number(shadow.hp)>0&&Number(shadow.max)>0,'summoned shadow has invalid HP');
 assert(Number(result.rendered)>=2,'summoned shadow exists in state but never reached canvas renderer');
 assert(!/AÇÃO NÃO SUPORTADA/i.test(result.mini),'game still reports Necromancer action as unsupported');
 assert(errors.length===0,errors.join(' | '));
 console.log(`NECROMANCER QA OK: summon=${shadow.type} hp=${Math.round(shadow.hp)}/${Math.round(shadow.max)} renderedFrames=${result.rendered} skin=${result.state.skinSource}`);
 await context.close();
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
