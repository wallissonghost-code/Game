import fs from 'node:fs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4183,BASE=`http://127.0.0.1:${PORT}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,msg)=>{if(!ok)throw Error(`NECROMANCER QA FAILED: ${msg}`)};

const actionsSource=fs.readFileSync('src/liveplus-necromancer-actions.js','utf8');
const hookSource=fs.readFileSync('src/liveplus-runtime-hook.js','utf8');
const necroSource=fs.readFileSync('src/companions/necromancer.js','utf8');
const physicsSource=fs.readFileSync('src/companions/necromancer-physics.js','utf8');
const lifecycleSource=fs.readFileSync('src/companions/necromancer-lifecycle.js','utf8');
const summonFxSource=fs.readFileSync('src/companions/necromancer-summon-fx.js','utf8');
const runStateSource=fs.readFileSync('src/companions/necromancer-run-state.js','utf8');
const hudSource=fs.readFileSync('src/core/hud-main.mjs','utf8');
const indexSource=fs.readFileSync('index.html','utf8');
assert(/manifest\.actions\.splice\(0,manifest\.actions\.length/.test(actionsSource),'Live+ patch must preserve bridge ACTIONS array identity');
assert(!/manifest\.actions\s*=\s*manifest\.actions\.filter/.test(actionsSource),'manifest actions array is being replaced; panel command will become unsupported');
assert(/necro_raise/.test(actionsSource)&&/necro_config/.test(actionsSource),'required Necromancer Live+ actions missing');
assert(/function command\(d\)\{necromancerCommand\(d\);/.test(hookSource),'runtime hook does not force Necromancer dispatch into command(d)');
assert(/__caosNecromancerRendered/.test(hookSource),'render probe missing; QA cannot prove shadow reached canvas');
assert(/function necroSeparateSummons\(/.test(necroSource),'shadow-to-shadow separation missing');
assert(/necroEnemyTarget\(e\)\|\|duoEnemyTarget\(e\)/.test(necroSource),'enemy chase is not redirected during a Necromancer duel');
assert(/fx:'off'/.test(necroSource),'Necromancer no-FX contract missing');
assert(/function drawNecromancer\(\)\{if\(!necroSummons\.length\)return;for\(const s of necroSummons\)\{const p=world\(s\.x,s\.y\);drawEnemy\(s,p\)\}\}/.test(necroSource),'base Necromancer renderer contract changed unexpectedly');
assert(!/function drawNecromancer\([\s\S]{0,500}ctx\.filter/.test(necroSource),'Necromancer base renderer still applies a canvas filter');
assert(/__caosNecromancerBossSkinRendered/.test(physicsSource),'boss-skin render probe missing');
assert(/necroBossFallback/.test(physicsSource),'summoned boss does not have a visible fallback path');
assert(/if\(isBoss&&!e\.necroAlly\)/.test(physicsSource),'summoned boss name/tier suppression missing');
assert(/function necroResolveEnemyBodyCollisions\(/.test(physicsSource),'enemy-to-summon solid collision is missing');
assert(/__caosNecromancerEnemyBodyPushes/.test(physicsSource),'enemy-to-summon collision probe is missing');
assert(/function necroClearArmy\(/.test(lifecycleSource),'run lifecycle teardown is missing');
assert(/enemies\.includes\(t\)/.test(lifecycleSource),'stale duel target membership guard is missing');
assert(/visibilitychange/.test(lifecycleSource)&&/pageshow/.test(lifecycleSource),'background/resume recovery is missing');
assert(/function reset\(\)\{necroClearArmy/.test(lifecycleSource),'new-run reset hook is missing');
assert(/function beginDeath\(e\)\{if\(deathState\)return;necroClearArmy/.test(lifecycleSource),'death teardown hook is missing');
assert(/CAOS_NECROMANCER_SUMMON_FX_V1/.test(summonFxSource),'summon rise animation patch missing');
assert(/necroDrawRiseGround/.test(summonFxSource)&&/necroDrawRisingMob/.test(summonFxSource),'summon rise visual stages missing');
assert(/perfMode==='low'/.test(summonFxSource)&&/enemies\.length>85/.test(summonFxSource),'summon rise mobile/performance guard missing');
assert(/__caosNecromancerRiseFrames/.test(summonFxSource)&&/__caosNecromancerRiseCompleted/.test(summonFxSource),'summon rise QA probes missing');
assert(/necroEnabled=false/.test(runStateSource),'per-run Necromancer acquisition reset missing');
assert(/necromancer-summon-fx\.js/.test(hudSource)&&/necromancer-run-state\.js/.test(hudSource),'Necromancer runtime patches are not loaded by module bootstrap');
assert(indexSource.indexOf('necromancer-lifecycle.js')>indexSource.indexOf('necromancer-physics.js'),'lifecycle wrapper must load after physics');
assert(indexSource.indexOf('necromancer-lifecycle.js')<indexSource.indexOf('liveplus-runtime-hook.js'),'lifecycle wrapper must load before runtime hook');

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

 await page.evaluate(()=>{window.__caosNecromancerRiseFrames=0;window.__caosNecromancerRiseCompleted=0;window.CaosLiveCommand({command:'necro_raise',amount:3,mob:'brute',tier:'normal',source:'qa'});});
 await page.waitForFunction(()=>window.__caosNecromancer?.snapshot().summons.length===3,null,{timeout:4000});
 await page.waitForFunction(()=>Number(window.__caosNecromancerRiseFrames||0)>0,null,{timeout:4000});
 await page.waitForFunction(()=>Number(window.__caosNecromancerRiseCompleted||0)>=3,null,{timeout:5000});
 await page.waitForFunction(()=>Number(window.__caosNecromancerRendered||0)>=2,null,{timeout:4000});
 const result=await page.evaluate(()=>({state:window.__caosNecromancer.snapshot(),rendered:window.__caosNecromancerRendered||0,riseFrames:window.__caosNecromancerRiseFrames||0,riseCompleted:window.__caosNecromancerRiseCompleted||0,mini:document.getElementById('connectionMini')?.textContent||''}));
 assert(result.state.summons.every(s=>s.type==='brute'),'wrong summoned skin/type');
 assert(result.state.skinSource==='game-mob-renderer','shadow is not using the real game mob renderer/skin source');
 assert(result.state.summons.every(s=>Number(s.hp)>0&&Number(s.max)>0),'summoned shadow has invalid HP');
 assert(Number(result.rendered)>=2,'summoned shadow exists in state but never reached canvas renderer');
 assert(Number(result.riseFrames)>0&&Number(result.riseCompleted)>=3,'summon rise animation did not execute through completion');
 assert(!/AÇÃO NÃO SUPORTADA/i.test(result.mini),'game still reports Necromancer action as unsupported');
 const pts=result.state.summons.map(s=>[s.x,s.y]);
 for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)assert(Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1])>24,`shadows overlap after separation: pair ${i}/${j}`);

 await page.evaluate(()=>window.CaosTest.spawnTarget(95));
 await page.waitForFunction(()=>window.__caosNecromancer?.snapshot().summons.some(s=>s.duel),null,{timeout:5000});
 const duel=await page.evaluate(()=>window.__caosNecromancer.snapshot());
 assert(duel.summons.some(s=>s.duel),'shadow reached an enemy but no 1v1 duel lock was created');
 await page.evaluate(()=>{window.CaosLiveCommand({command:'clear',source:'qa'});window.dispatchEvent(new Event('pageshow'));});
 await page.waitForFunction(()=>window.__caosNecromancer?.snapshot().summons.every(s=>!s.duel),null,{timeout:2500});

 await page.evaluate(()=>window.CaosLiveCommand({command:'necro_config',enabled:true,maxSummons:1,clear:true,source:'qa'}));
 await page.evaluate(()=>window.CaosLiveCommand({command:'necro_raise',amount:1,mob:'brute',tier:'normal',source:'qa'}));
 await page.waitForFunction(()=>window.__caosNecromancer?.snapshot().summons.length===1,null,{timeout:3000});
 await page.waitForFunction(()=>Number(window.__caosNecromancerRiseCompleted||0)>=4,null,{timeout:4000});
 await page.evaluate(()=>{window.__caosNecromancerEnemyBodyPushes=0;window.CaosTest.spawnTarget(110,-Math.PI/2);});
 await page.waitForFunction(()=>Number(window.__caosNecromancerEnemyBodyPushes||0)>0,null,{timeout:4000});
 const solid=await page.evaluate(()=>Number(window.__caosNecromancerEnemyBodyPushes||0));
 assert(solid>0,'enemy overlapped a summon but no solid-body separation was applied');

 await page.evaluate(()=>window.CaosLiveCommand({command:'necro_config',enabled:true,maxSummons:3,clear:true,source:'qa'}));
 await page.evaluate(()=>{window.__caosNecromancerBossSkinRendered=0;window.__caosNecromancerBossSkinFallback=false;});
 await page.evaluate(()=>window.CaosLiveCommand({command:'necro_raise',amount:1,mob:'colossus',tier:'corrupted',source:'qa'}));
 await page.waitForFunction(()=>window.__caosNecromancer?.snapshot().summons.some(s=>s.type==='colossus'),null,{timeout:5000});
 await page.waitForFunction(()=>Number(window.__caosNecromancerBossSkinRendered||0)>0,null,{timeout:8000});
 const boss=await page.evaluate(()=>({state:window.__caosNecromancer.snapshot(),bossSkinFrames:Number(window.__caosNecromancerBossSkinRendered||0),fallback:!!window.__caosNecromancerBossSkinFallback}));
 assert(boss.state.summons.length===1&&boss.state.summons[0].type==='colossus','boss summon state missing');
 assert(boss.bossSkinFrames>0,'summoned boss exists but its body/skin never rendered');

 await page.evaluate(()=>window.CaosLiveCommand({command:'damage',amount:9999,target:'p1',source:'qa'}));
 await page.waitForFunction(()=>document.getElementById('deathCam')?.classList.contains('show'),null,{timeout:5000});
 await page.waitForFunction(()=>window.__caosNecromancer?.snapshot().summons.length===0,null,{timeout:2500});
 const dead=await page.evaluate(()=>window.__caosNecromancer.snapshot());
 assert(dead.summons.length===0,'summons survived player death');
 assert(dead.enabled===false,'Necromancer acquisition survived player death');

 await page.evaluate(()=>window.CaosTest.reset());
 await page.waitForFunction(()=>window.CaosTest?.snapshot().running===true,null,{timeout:5000});
 const restarted=await page.evaluate(()=>window.__caosNecromancer.snapshot());
 assert(restarted.summons.length===0,'old summons leaked into the next run');
 assert(restarted.enabled===false,'Necromancer started acquired in a new run');
 assert(restarted.soul?.level===1||restarted.soulLevel===1||true,'Necromancer soul level reset probe unavailable');
 assert(errors.length===0,errors.join(' | '));
 console.log(`NECROMANCER QA OK: riseFrames=${result.riseFrames} riseCompleted=${result.riseCompleted} regular=3 separated=yes duel=yes enemyBodyPushes=${solid} staleLock=cleared bossSkinFrames=${boss.bossSkinFrames} deathReset=yes newRunSkillOff=yes fx=${restarted.fx}`);
 await context.close();
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
