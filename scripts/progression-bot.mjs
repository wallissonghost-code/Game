import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT=4175, BASE=`http://127.0.0.1:${PORT}`;
const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const expectedXpNeed=lv=>Math.floor(60*Math.pow(Math.max(1,lv),1.42)*(lv>=90?1.70:lv>=80?1.50:lv>=60?1.30:lv>=40?1.12:1));
const caps={speed:5,medic:5,rapid:5,xp:5,flash:5,regen:5,blood:5,arc:5,phoenix:1,armor:4,pierce:5,ghost:5,dodge:1,ice:5,shock:5,berserker:5,explosive:5};

async function waitServer(){for(let i=0;i<40;i++){try{const r=await fetch(BASE,{cache:'no-store'});if(r.ok)return}catch{}await sleep(250)}throw Error('progression bot server did not start')}

let browser;
try{
  await waitServer();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/i.test(m.text()))errors.push(`console: ${m.text()}`)});
  page.on('requestfailed',req=>{if(!/onrender\.com/i.test(req.url()))errors.push(`requestfailed: ${req.url()} :: ${req.failure()?.errorText||'unknown'}`)});
  await page.route('https://caos-live-game-server-va.onrender.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.goto(`${BASE}/?ci=1&progression=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#startBtn').waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>window.CaosTest&&document.getElementById('startBtn')&&!document.getElementById('startBtn').disabled,null,{timeout:15000});
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>window.CaosTest?.snapshot().running===true,null,{timeout:5000});
  const snap=()=>page.evaluate(()=>window.CaosTest.snapshot());
  const cmd=d=>page.evaluate(d=>window.CaosTest.command(d),d);
  const assert=(ok,msg)=>{if(!ok)throw Error(`PROGRESSION: ${msg}`)};

  await cmd({command:'horde',value:false});
  await cmd({command:'clear'});
  await cmd({command:'autofire',value:false});
  await cmd({command:'skillreset'});
  await cmd({command:'auto',value:true});

  let s=await snap();
  assert(s.level===1,`expected LV1 start, got LV${s.level}`);
  assert(s.xpNeed===expectedXpNeed(1),`LV1 xpNeed mismatch: got ${s.xpNeed}`);

  for(let target=2;target<=50;target++){
    await cmd({command:'clear'});
    const before=await snap();
    assert(before.level===target-1,`before LV${target}: expected ${target-1}, got ${before.level}`);
    await cmd({command:'level',amount:1});
    await sleep(25);
    const after=await snap();
    assert(after.level===target,`level skipped/stalled: expected LV${target}, got LV${after.level}`);
    assert(after.xpNeed===expectedXpNeed(target),`LV${target} xpNeed mismatch: got ${after.xpNeed}, expected ${expectedXpNeed(target)}`);
    assert(Number.isFinite(after.xp)&&after.xp>=0,`LV${target} invalid XP ${after.xp}`);
    assert(after.xp<after.xpNeed,`LV${target} XP overflow persisted: ${after.xp}/${after.xpNeed}`);

    const levels=after.skillLv||{};
    let skillPoints=0;
    for(const [id,lv] of Object.entries(levels)){
      assert(Number.isInteger(lv)&&lv>=0,`LV${target} invalid skill level ${id}=${lv}`);
      assert(id in caps,`LV${target} unknown skill ${id}`);
      assert(lv<=caps[id],`LV${target} skill cap exceeded ${id}=${lv}/${caps[id]}`);
      skillPoints+=lv;
    }
    assert(skillPoints===target-1,`LV${target} skill-point progression mismatch: ${skillPoints}, expected ${target-1}`);

    if(target%10===0){
      assert(after.bosses>=1,`LV${target} did not spawn milestone boss`);
      console.log(`PROGRESSION MILESTONE OK: LV${target} xpNeed=${after.xpNeed} skillPoints=${skillPoints} bosses=${after.bosses}`);
    }else{
      assert(after.bosses===0,`unexpected boss outside milestone at LV${target}`);
    }
    assert(errors.length===0,`runtime error at LV${target}: ${errors.join(' | ')}`);
  }

  const end=await snap();
  assert(end.level===50,'did not finish at LV50');
  assert(end.xpNeed===expectedXpNeed(50),'LV50 final XP curve mismatch');
  console.log(`PROGRESSION BOT OK: LV1→LV50 validated; LV50 xpNeed=${end.xpNeed}; skills=${Object.entries(end.skillLv).filter(([,v])=>v>0).length}`);
  await context.close();
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
