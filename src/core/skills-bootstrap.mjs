import * as CaosSkills from './skills.mjs?v=01745';
import * as CaosMobs from './mobs.mjs?v=01745';
import * as CaosCombat from './combat.mjs?v=01745';
import { patchNaturalEvents } from './natural-events-runtime.mjs?v=01746-events1';
import './hud-main.mjs?v=01745-main1';
import './live-hud.mjs?v=01745-live1';

CaosSkills.assertSkillCatalog();
CaosMobs.assertMobDomain();
CaosCombat.assertCombatDomain();
window.CaosSkills = Object.freeze({ ...CaosSkills });
window.CaosMobs = Object.freeze({ ...CaosMobs });
window.CaosCombat = Object.freeze({ ...CaosCombat });

function loadClassic(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(s);
  });
}

function fixClassicAimSync(source) {
  let patched = String(source || '');
  const replaceOne = (from, to, label) => {
    const count = patched.split(from).length - 1;
    if (count !== 1) throw new Error(`ClassicAim/${label}: expected 1 match, found ${count}`);
    patched = patched.replace(from, to);
  };

  replaceOne(
    "else if(autoFire){const target=autoMode?focusedTarget():nearestVisible();if(target){const wanted=Math.atan2(target.y-player.y,target.x-player.x);let da=angleDelta(wanted,player.aim);player.aim+=da*Math.min(1,dt*7)}}else if(player.moving)",
    "else if(autoFire){const target=(autoMode||gameplayMode==='classic')?focusedTarget():nearestVisible();if(target){const wanted=Math.atan2(target.y-player.y,target.x-player.x);if(autoMode||gameplayMode==='classic')player.aim=wanted;else{let da=angleDelta(wanted,player.aim);player.aim+=da*Math.min(1,dt*7)}}}else if(player.moving)",
    'frame-aim'
  );

  const shootRe = /function shoot\(\)\{[\s\S]*?\}function setPaused\(/;
  const shootMatches = patched.match(shootRe);
  if (!shootMatches || shootMatches.length !== 1) throw new Error('ClassicAim/shoot: function boundary not found');
  const shootFn = `function shoot(){if(player.down||(choosing&&duoPlayer.connected))return false;let target=null,shotAim=player.aim;if(autoMode||gameplayMode==='classic'){target=focusedTarget();if(!target)return false;shotAim=Math.atan2(target.y-player.y,target.x-player.x)}else if(gameplayMode==='sweep'){target=sweepTarget();if(!target)return false;shotAim=Math.atan2(target.y-player.y,target.x-player.x)}else if(gameplayMode==='hardcore'){shotAim=movementAimAngle}else{target=nearestVisible();if(!target)return false;shotAim=Math.atan2(target.y-player.y,target.x-player.x)}if(!Number.isFinite(shotAim))return false;player.aim=shotAim;player.shotFlash=.1;const dir=playerFacing(shotAim),m=muzzleLocal(dir),bs=berserkerState(),traits=window.CaosCombat.projectileTraits(skillLv,{pierce:pierceShotCounter,ice:iceShotCounter,explosive:explosiveShotCounter});pierceShotCounter=traits.counters.pierce;iceShotCounter=traits.counters.ice;explosiveShotCounter=traits.counters.explosive;const {pierceLeft,ice,explosive}=traits;ciShotsFired++;const shotId=ciShotsFired;if(pierceLeft)ciPierceShots++;if(ice)ciIceShots++;if(explosive)ciExplosiveShots++;const spawnX=player.x+m.x,spawnY=player.y+m.y,vx=Math.cos(shotAim)*610,vy=Math.sin(shotAim)*610;ciLastShot={shotId,spawnX,spawnY,playerX:player.x,playerY:player.y,aim:shotAim,vx,vy,targetX:target?.x??null,targetY:target?.y??null,targetType:target?.type??null,at:performance.now()};bullets.push({shotId,x:spawnX,y:spawnY,prevX:spawnX,prevY:spawnY,vx,vy,launchVx:vx,launchVy:vy,r:4,dead:false,ammo:1,born:performance.now(),pierceLeft,hits:[],iceHits:0,damage:player.damage*bs.damageMul,ice,explosive,owner:'p1'});if(player.flashDamage&&++flashCounter%5===0)flash();return true}`;
  patched = patched.replace(shootRe, shootFn + 'function setPaused(');

  replaceOne(
    "castArc();castShockwave();shotTimer-=dt;if(autoFire&&shotTimer<=0){shoot();shotTimer=player.fireRate/berserkerState().rateMul}else if(!autoFire){shotTimer=Math.min(shotTimer,.05)}for(const b of bullets){",
    "castArc();castShockwave();shotTimer-=dt;if(autoFire){const aimWatchNow=performance.now();if((autoMode||gameplayMode==='classic')&&!player.down&&!choosing){const liveAimTarget=focusedTarget();if(liveAimTarget&&aimWatchNow-(ciLastShot?.at||0)>Math.max(480,player.fireRate*1800))shotTimer=Math.min(shotTimer,0)}if(shotTimer<=0){const didShoot=shoot();shotTimer=didShoot?player.fireRate/berserkerState().rateMul:Math.min(.08,Math.max(.03,player.fireRate*.25))}}else{shotTimer=Math.min(shotTimer,.05)}for(const b of bullets){",
    'shot-watchdog'
  );

  replaceOne(
    "for(const b of bullets){if(b.flash){b.t-=dt;continue}b.x+=b.vx*dt;b.y+=b.vy*dt;if(Math.abs(b.x-player.x)>W||Math.abs(b.y-player.y)>H){if(!b.dead&&new URLSearchParams(location.search).get('ci')==='1')ciShotsExpired++;b.dead=true}}const frozen=",
    "for(const b of bullets){if(b.flash){b.t-=dt;continue}b.prevX=b.x;b.prevY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;if(Math.abs(b.x-player.x)>W||Math.abs(b.y-player.y)>H){if(!b.dead)ciShotsExpired++;b.dead=true}}const frozen=",
    'projectile-straight'
  );

  replaceOne(
    "function bulletHitsFromGrid(b,g){const cx=Math.floor(b.x/SPATIAL),cy=Math.floor(b.y/SPATIAL);for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const a=g.get((cx+ox)+','+(cy+oy));if(!a)continue;for(const e of a){if(e.dead||(b.hits&&b.hits.includes(e)))continue;const dx=b.x-e.x,dy=b.y-e.y,rr=b.r+e.r;if(dx*dx+dy*dy<rr*rr)return e}}return null}",
    "function bulletHitsFromGrid(b,g){const ax=Number.isFinite(b.prevX)?b.prevX:b.x,ay=Number.isFinite(b.prevY)?b.prevY:b.y,bx=b.x,by=b.y,minX=Math.min(ax,bx),maxX=Math.max(ax,bx),minY=Math.min(ay,by),maxY=Math.max(ay,by),c0x=Math.floor(minX/SPATIAL)-1,c1x=Math.floor(maxX/SPATIAL)+1,c0y=Math.floor(minY/SPATIAL)-1,c1y=Math.floor(maxY/SPATIAL)+1,seen=new Set();for(let cy=c0y;cy<=c1y;cy++)for(let cx=c0x;cx<=c1x;cx++){const a=g.get(cx+','+cy);if(!a)continue;for(const e of a){if(seen.has(e)||e.dead||(b.hits&&b.hits.includes(e)))continue;seen.add(e);const sx=bx-ax,sy=by-ay,len2=sx*sx+sy*sy,t=len2>0?Math.max(0,Math.min(1,((e.x-ax)*sx+(e.y-ay)*sy)/len2)):0,px=ax+sx*t,py=ay+sy*t,dx=px-e.x,dy=py-e.y,rr=b.r+e.r;if(dx*dx+dy*dy<rr*rr)return e}}return null}",
    'swept-collision'
  );

  replaceOne(
    "if(new URLSearchParams(location.search).get('ci')==='1')ciShotsHit++;",
    "ciShotsHit++;",
    'hit-counter'
  );

  const staleDiagnostic = "const alive=enemies.filter(e=>!e.dead),target=autoTarget&&!autoTarget.dead?autoTarget:null,near=";
  const liveDiagnostic = "const alive=enemies.filter(e=>!e.dead),target=(autoMode||gameplayMode==='classic')?focusedTarget():(autoTarget&&!autoTarget.dead?autoTarget:null),near=";
  replaceOne(staleDiagnostic, liveDiagnostic, 'diagnostic-target');

  replaceOne(
    "map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,born:b.born,pierceLeft:b.pierceLeft,ice:!!b.ice,explosive:!!b.explosive}))",
    "map(b=>({shotId:b.shotId||null,x:b.x,y:b.y,prevX:b.prevX,prevY:b.prevY,vx:b.vx,vy:b.vy,launchVx:b.launchVx,launchVy:b.launchVy,born:b.born,pierceLeft:b.pierceLeft,ice:!!b.ice,explosive:!!b.explosive}))",
    'diagnostic-projectiles'
  );

  return patched;
}

async function loadPatchedClassic(src) {
  const response = await fetch(src, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to fetch runtime ${response.status}`);
  const original = await response.text();
  const patched = fixClassicAimSync(patchNaturalEvents(original));
  const blobUrl = URL.createObjectURL(new Blob([patched], { type: 'text/javascript' }));
  try { await loadClassic(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
}

const num=id=>Number(String(document.getElementById(id)?.textContent||'0').replace(/[^0-9.-]/g,''))||0;
function normalGameSnapshot(){
  const start=document.getElementById('start'),over=document.getElementById('over'),pause=document.getElementById('pause');
  const started=!!start&&!start.classList.contains('show');
  const ended=!!over?.classList.contains('show');
  return {
    type:'state',version:'0.17.46',running:started&&!ended,paused:!!pause?.classList.contains('show'),
    level:num('level'),xp:num('xp'),health:num('life'),maxHealth:100,mobs:num('mobCount'),
    kills:num('deathKills'),wave:num('deathWave'),score:0,fps:Number(window.__caosFps||window.caosCurrentFps||0)||0,
    autoMode:false,autofire:true,gameplayMode:'classic',events:null
  };
}
function readDiagnosticState(){return window.CaosStateSnapshot?.()||window.CaosTest?.snapshot?.()||normalGameSnapshot()}

function startDiagnosticsFeed(){
  let wasRunning=false,lastLevel=0,lastKills=0,finishedSession='';
  setInterval(()=>{
    try{
      const state=readDiagnosticState(),rec=window.CaosSessionRecorder;
      if(!state||!rec)return;
      if(state.running&&!wasRunning){
        rec.start();finishedSession='';
        rec.mark('run-start',{version:state.version||'0.17.46'});
        lastLevel=+state.level||0;lastKills=+state.kills||0;
      }
      if(state.running){
        rec.sample(state);
        if(+state.level>lastLevel&&lastLevel>0)rec.mark('level-up',{from:lastLevel,to:+state.level});
        if(+state.kills>lastKills+10)rec.mark('kill-burst',{from:lastKills,to:+state.kills});
        lastLevel=+state.level||lastLevel;lastKills=+state.kills||lastKills;
      }
      const overVisible=!!document.getElementById('over')?.classList.contains('show');
      if(((!state.running&&wasRunning)||overVisible)&&rec.id&&finishedSession!==rec.id){
        finishedSession=rec.id;
        rec.mark('run-end',{level:state.level,kills:state.kills,score:state.score});
        rec.finish({level:state.level,kills:state.kills,score:state.score});
      }
      wasRunning=!!state.running;
    }catch(e){console.warn('CAOS LOCAL DIAGNOSTICS',e)}
  },250);
}

const gameRuntimeUrl = new URL('../game.js?v=01746-shot-atomic2', import.meta.url).href;
const multiplayerEntryUrl = new URL('../multiplayer-entry.js?v=01745-core3', import.meta.url).href;

try {
  await loadPatchedClassic(gameRuntimeUrl);
  await loadClassic(multiplayerEntryUrl);
  startDiagnosticsFeed();
  window.CaosRuntimeReady = true;
  window.dispatchEvent(new CustomEvent('caos:runtime-ready', { detail: { skills: true, mobs: true, combat: true, naturalEvents: true, diagnostics: true } }));
} catch (error) {
  console.error('CAOS CORE BOOTSTRAP', error);
  window.CaosRuntimeReady = false;
  window.dispatchEvent(new CustomEvent('caos:runtime-error', { detail: { message: String(error?.message || error) } }));
}
