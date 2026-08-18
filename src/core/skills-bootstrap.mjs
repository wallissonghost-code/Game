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

  // Classic/auto aim is authoritative: do not smooth toward one mob while shoot() selects another.
  replaceOne(
    "else if(autoFire){const target=autoMode?focusedTarget():nearestVisible();if(target){const wanted=Math.atan2(target.y-player.y,target.x-player.x);let da=angleDelta(wanted,player.aim);player.aim+=da*Math.min(1,dt*7)}}else if(player.moving)",
    "else if(autoFire){const target=(autoMode||gameplayMode==='classic')?focusedTarget():nearestVisible();if(target){const wanted=Math.atan2(target.y-player.y,target.x-player.x);if(autoMode||gameplayMode==='classic')player.aim=wanted;else{let da=angleDelta(wanted,player.aim);player.aim+=da*Math.min(1,dt*7)}}}else if(player.moving)",
    'frame-aim'
  );

  // Replace shoot as one atomic transaction: select target -> calculate angle -> set visual aim -> create projectile.
  // No later read of player.aim is allowed to change the projectile vector.
  const shootRe = /function shoot\(\)\{[\s\S]*?\}function setPaused\(/;
  const shootMatches = patched.match(shootRe);
  if (!shootMatches || shootMatches.length !== 1) throw new Error('ClassicAim/shoot: function boundary not found');
  const shootFn = `function shoot(){if(player.down||(choosing&&duoPlayer.connected))return false;let target=null,shotAim=player.aim;if(autoMode||gameplayMode==='classic'){target=focusedTarget();if(!target)return false;shotAim=Math.atan2(target.y-player.y,target.x-player.x)}else if(gameplayMode==='sweep'){target=sweepTarget();if(!target)return false;shotAim=Math.atan2(target.y-player.y,target.x-player.x)}else if(gameplayMode==='hardcore'){shotAim=movementAimAngle}else{target=nearestVisible();if(!target)return false;shotAim=Math.atan2(target.y-player.y,target.x-player.x)}if(!Number.isFinite(shotAim))return false;player.aim=shotAim;player.shotFlash=.1;const dir=playerFacing(shotAim),m=muzzleLocal(dir),bs=berserkerState(),traits=window.CaosCombat.projectileTraits(skillLv,{pierce:pierceShotCounter,ice:iceShotCounter,explosive:explosiveShotCounter});pierceShotCounter=traits.counters.pierce;iceShotCounter=traits.counters.ice;explosiveShotCounter=traits.counters.explosive;const {pierceLeft,ice,explosive}=traits;ciShotsFired++;if(pierceLeft)ciPierceShots++;if(ice)ciIceShots++;if(explosive)ciExplosiveShots++;ciLastShot={spawnX:player.x+m.x,spawnY:player.y+m.y,playerX:player.x,playerY:player.y,aim:shotAim,vx:Math.cos(shotAim)*610,vy:Math.sin(shotAim)*610,targetX:target?.x??null,targetY:target?.y??null,targetType:target?.type??null,at:performance.now()};bullets.push({x:player.x+m.x,y:player.y+m.y,vx:Math.cos(shotAim)*610,vy:Math.sin(shotAim)*610,r:4,dead:false,ammo:1,born:performance.now(),pierceLeft,hits:[],iceHits:0,damage:player.damage*bs.damageMul,ice,explosive,owner:'p1',targetRef:target||null,homing:!!target&&(autoMode||gameplayMode==='classic'),shotAim});if(player.flashDamage&&++flashCounter%5===0)flash();return true}`;
  patched = patched.replace(shootRe, shootFn + 'function setPaused(');

  // If a frame briefly has no valid target, retry quickly instead of consuming a full fire interval.
  // The watchdog also prevents a live close target from sitting in front of the player without a shot for > ~0.5 s.
  replaceOne(
    "castArc();castShockwave();shotTimer-=dt;if(autoFire&&shotTimer<=0){shoot();shotTimer=player.fireRate/berserkerState().rateMul}else if(!autoFire){shotTimer=Math.min(shotTimer,.05)}for(const b of bullets){",
    "castArc();castShockwave();shotTimer-=dt;if(autoFire){const aimWatchNow=performance.now();if((autoMode||gameplayMode==='classic')&&!player.down&&!choosing){const liveAimTarget=focusedTarget();if(liveAimTarget&&aimWatchNow-(ciLastShot?.at||0)>Math.max(480,player.fireRate*1800))shotTimer=Math.min(shotTimer,0)}if(shotTimer<=0){const didShoot=shoot();shotTimer=didShoot?player.fireRate/berserkerState().rateMul:Math.min(.08,Math.max(.03,player.fireRate*.25))}}else{shotTimer=Math.min(shotTimer,.05)}for(const b of bullets){",
    'shot-watchdog'
  );

  // Classic projectiles retain the selected target. If it dies between shots, the projectile reacquires the current
  // nearest visible target. This removes the 'bullets keep flying into empty space until I move' failure mode.
  replaceOne(
    "for(const b of bullets){if(b.flash){b.t-=dt;continue}b.x+=b.vx*dt;b.y+=b.vy*dt;if(Math.abs(b.x-player.x)>W||Math.abs(b.y-player.y)>H){if(!b.dead&&new URLSearchParams(location.search).get('ci')==='1')ciShotsExpired++;b.dead=true}}const frozen=",
    "for(const b of bullets){if(b.flash){b.t-=dt;continue}if(b.homing){let bt=b.targetRef;if(!bt||bt.dead||!enemies.includes(bt)||Math.hypot(bt.x-player.x,bt.y-player.y)>FIRE_RANGE*1.35){bt=focusedTarget();b.targetRef=bt||null}if(bt){const desired=Math.atan2(bt.y-b.y,bt.x-b.x),current=Math.atan2(b.vy,b.vx),speed=Math.hypot(b.vx,b.vy)||610,maxTurn=Math.min(Math.PI,dt*18),turn=angleDelta(desired,current),next=current+Math.max(-maxTurn,Math.min(maxTurn,turn));b.vx=Math.cos(next)*speed;b.vy=Math.sin(next)*speed}}b.x+=b.vx*dt;b.y+=b.vy*dt;if(Math.abs(b.x-player.x)>W||Math.abs(b.y-player.y)>H){if(!b.dead)ciShotsExpired++;b.dead=true}}const frozen=",
    'projectile-reacquire'
  );

  // Runtime diagnostics must work in normal play, not only ?ci=1.
  replaceOne(
    "if(new URLSearchParams(location.search).get('ci')==='1')ciShotsHit++;",
    "ciShotsHit++;",
    'hit-counter'
  );

  const staleDiagnostic = "const alive=enemies.filter(e=>!e.dead),target=autoTarget&&!autoTarget.dead?autoTarget:null,near=";
  const liveDiagnostic = "const alive=enemies.filter(e=>!e.dead),target=(autoMode||gameplayMode==='classic')?focusedTarget():(autoTarget&&!autoTarget.dead?autoTarget:null),near=";
  replaceOne(staleDiagnostic, liveDiagnostic, 'diagnostic-target');

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

const gameRuntimeUrl = new URL('../game.js?v=01746-aim-final1', import.meta.url).href;
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
