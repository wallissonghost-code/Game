import * as CaosSkills from './skills.mjs?v=01746-guardian1';
import * as CaosMobs from './mobs.mjs?v=01745';
import * as CaosCombat from './combat.mjs?v=01745';
import * as CaosMatchState from './match-state.mjs?v=01749-p2';
import * as CaosWavesRuntime from './waves-runtime.mjs?v=01754-p7';
import * as CaosEnemiesRuntime from './enemies-runtime.mjs?v=01754-p7';
import * as CaosProjectilesRuntime from './projectiles-runtime.mjs?v=01750-p3';
import * as CaosMultiplayerRuntime from './multiplayer-runtime.mjs?v=01749-p2';
import * as CaosRenderRuntime from './render-runtime.mjs?v=01749-p2';
import { patchNaturalEvents } from './natural-events-runtime.mjs?v=01746-events1';
import './hud-main.mjs?v=01745-main1';
import './live-hud.mjs?v=01745-live1';

CaosSkills.assertSkillCatalog();
CaosMobs.assertMobDomain();
CaosCombat.assertCombatDomain();
CaosMatchState.assertMatchState();
CaosWavesRuntime.assertWaveState();
CaosEnemiesRuntime.assertEnemyState();
CaosProjectilesRuntime.assertProjectileState();
CaosMultiplayerRuntime.assertMultiplayerState();
CaosRenderRuntime.assertRenderState();
window.CaosMatchState = Object.freeze({ ...CaosMatchState });
window.CaosWavesRuntime = Object.freeze({ ...CaosWavesRuntime });
window.CaosEnemiesRuntime = Object.freeze({ ...CaosEnemiesRuntime });
window.CaosProjectilesRuntime = Object.freeze({ ...CaosProjectilesRuntime });
window.CaosMultiplayerRuntime = Object.freeze({ ...CaosMultiplayerRuntime });
window.CaosRenderRuntime = Object.freeze({ ...CaosRenderRuntime });
window.CaosSkills = Object.freeze({ ...CaosSkills });
window.CaosMobs = Object.freeze({ ...CaosMobs });
window.CaosCombat = Object.freeze({ ...CaosCombat });

function loadClassic(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error(`Failed to load ${src}`));document.body.appendChild(s)})}

function fixClassicAimSync(source){
  let patched=String(source||'');
  const replaceOne=(from,to,label)=>{const count=patched.split(from).length-1;if(count!==1)throw new Error(`ClassicAim/${label}: expected 1 match, found ${count}`);patched=patched.replace(from,to)};

  replaceOne(
    "else if(autoFire){const target=autoMode?focusedTarget():nearestVisible();if(target){const wanted=Math.atan2(target.y-player.y,target.x-player.x);let da=angleDelta(wanted,player.aim);player.aim+=da*Math.min(1,dt*7)}}else if(player.moving)",
    "else if(autoFire){const target=autoMode?focusedTarget():nearestVisible();if(target){const wanted=Math.atan2(target.y-player.y,target.x-player.x);if(gameplayMode==='classic'&&!autoMode)player.aim=wanted;else{let da=angleDelta(wanted,player.aim);player.aim+=da*Math.min(1,dt*7)}}}else if(player.moving)",
    'frame-aim'
  );

  const shootRe=/function shoot\(\)\{[\s\S]*?\}function setPaused\(/;
  if(!patched.match(shootRe))throw new Error('ClassicAim/shoot: function boundary not found');
  const shootFn=`function shoot(){if(player.down||(choosing&&duoPlayer.connected))return false;let target=null,visualAim=player.aim;if(autoMode){target=focusedTarget();if(!target)return false;visualAim=Math.atan2(target.y-player.y,target.x-player.x)}else if(gameplayMode==='classic'){target=nearestVisible();if(!target)return false;visualAim=Math.atan2(target.y-player.y,target.x-player.x)}else if(gameplayMode==='sweep'){target=sweepTarget();if(!target)return false;visualAim=Math.atan2(target.y-player.y,target.x-player.x)}else if(gameplayMode==='hardcore'){visualAim=movementAimAngle}else{target=nearestVisible();if(!target)return false;visualAim=Math.atan2(target.y-player.y,target.x-player.x)}if(!Number.isFinite(visualAim))return false;const shotGeometry=projectilesRuntime.buildShotGeometry({player,target,visualAim,directionForAim:playerFacing,muzzleForDirection:muzzleLocal});if(!shotGeometry)return false;const {dir,spawnX,spawnY,aim:shotAim,muzzleScale}=shotGeometry;player.aim=visualAim;player.shotFlash=.1;const bs=berserkerState(),traits=window.CaosCombat.projectileTraits(skillLv,{pierce:pierceShotCounter,ice:iceShotCounter,explosive:explosiveShotCounter});pierceShotCounter=traits.counters.pierce;iceShotCounter=traits.counters.ice;explosiveShotCounter=traits.counters.explosive;const {pierceLeft,ice,explosive}=traits;ciShotsFired++;const shotId=ciShotsFired;if(pierceLeft)ciPierceShots++;if(ice)ciIceShots++;if(explosive)ciExplosiveShots++;const shotBorn=performance.now(),projectile=projectilesRuntime.createProjectile({shotId,x:spawnX,y:spawnY,aim:shotAim,speed:610,born:shotBorn,pierceLeft,damage:player.damage*bs.damageMul,ice,explosive,owner:'p1'}),{vx,vy}=projectile;ciLastShot={shotId,spawnX,spawnY,playerX:player.x,playerY:player.y,visualAim,visualDir:dir,aim:shotAim,muzzleScale,vx,vy,targetX:target?.x??null,targetY:target?.y??null,targetType:target?.type??null,at:shotBorn};bullets.push(projectile);if(player.flashDamage&&++flashCounter%5===0)flash();return true}`;
  patched=patched.replace(shootRe,shootFn+'function setPaused(');

  replaceOne(
    "castArc();castShockwave();shotTimer-=dt;if(autoFire&&shotTimer<=0){shoot();shotTimer=player.fireRate/berserkerState().rateMul}else if(!autoFire){shotTimer=Math.min(shotTimer,.05)}for(const b of bullets){",
    "castArc();castShockwave();shotTimer-=dt;if(autoFire){const aimWatchNow=performance.now();if(!player.down&&!choosing){const liveAimTarget=autoMode?focusedTarget():(gameplayMode==='classic'?nearestVisible():null);if(liveAimTarget&&aimWatchNow-(ciLastShot?.at||0)>Math.max(480,player.fireRate*1800))shotTimer=Math.min(shotTimer,0)}if(shotTimer<=0){const didShoot=shoot();shotTimer=didShoot?player.fireRate/berserkerState().rateMul:Math.min(.08,Math.max(.03,player.fireRate*.25))}}else{shotTimer=Math.min(shotTimer,.05)}for(const b of bullets){",
    'shot-watchdog'
  );

  // projectile-straight now lives in src/core/projectiles-runtime.mjs


  // swept-collision now lives in src/core/projectiles-runtime.mjs


  replaceOne("if(new URLSearchParams(location.search).get('ci')==='1')ciShotsHit++;","ciShotsHit++;",'hit-counter');
  replaceOne("const alive=enemies.filter(e=>!e.dead),target=autoTarget&&!autoTarget.dead?autoTarget:null,near=","const alive=enemies.filter(e=>!e.dead),target=autoMode?focusedTarget():(gameplayMode==='classic'?nearestVisible():(autoTarget&&!autoTarget.dead?autoTarget:null)),near=",'diagnostic-target');
  replaceOne("map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,born:b.born,pierceLeft:b.pierceLeft,ice:!!b.ice,explosive:!!b.explosive}))","map(b=>({shotId:b.shotId||null,x:b.x,y:b.y,prevX:b.prevX,prevY:b.prevY,vx:b.vx,vy:b.vy,launchVx:b.launchVx,launchVy:b.launchVy,born:b.born,pierceLeft:b.pierceLeft,ice:!!b.ice,explosive:!!b.explosive}))",'diagnostic-projectiles');
  replaceOne("fireRate:player.fireRate,aim:player.aim,lastShot:ciLastShot","fireRate:player.fireRate,aim:player.aim,visualAim:player.aim,lastShot:ciLastShot",'diagnostic-visual-aim');
  replaceOne("dist=Math.max(80,Math.min(360,+distance||180))","dist=Math.max(24,Math.min(360,+distance||180))",'ci-close-target');

  replaceOne(
    "const trail=ctx.createLinearGradient(-22,0,5,0);trail.addColorStop(0,'rgba(34,211,238,0)');",
    "const trailAge=Math.max(0,performance.now()-(b.born||performance.now())),trailLen=Math.max(0,Math.min(22,trailAge*.55)),trail=ctx.createLinearGradient(-Math.max(1,trailLen),0,5,0);trail.addColorStop(0,'rgba(34,211,238,0)');",
    'tracer-origin-growth'
  );
  replaceOne(
    "ctx.beginPath();ctx.moveTo(-22,-2.2);ctx.lineTo(2,-3.5);ctx.lineTo(5,0);ctx.lineTo(2,3.5);ctx.lineTo(-22,2.2);ctx.closePath();ctx.fill();",
    "ctx.beginPath();ctx.moveTo(-trailLen,-2.2);ctx.lineTo(2,-3.5);ctx.lineTo(5,0);ctx.lineTo(2,3.5);ctx.lineTo(-trailLen,2.2);ctx.closePath();ctx.fill();",
    'tracer-tail-growth'
  );

  return patched;
}

function patchGuardianCelestial(source){
  let s=String(source||'');
  const one=(from,to,label)=>{const count=s.split(from).length-1;if(count!==1)throw new Error(`Guardian/${label}: expected 1 match, found ${count}`);s=s.replace(from,to)};
  // guardian now belongs to src/core/runtime-state.js
  const oldMeteor="function damagePlayerByMeteor(m){const now=performance.now(),amount=m.playerDamage??activeMeteorConfig().playerDamage;if(!player.down&&Math.hypot(player.x-m.x,player.y-m.y)<=m.r+player.r){if(now>=invincibleUntil&&player.inv<=0&&!skillShieldP1()){if(!tryDodge(now)){lastDamageAt=now;player.life=Math.max(0,player.life-amount);triggerGhost(now);if(player.life<=0&&!player.down&&!tryPhoenix())knockDownPlayer('p1',meteorKiller(m))}}}if(duoPlayer.connected&&!duoPlayer.down&&Math.hypot(duoPlayer.x-m.x,duoPlayer.y-m.y)<=m.r+duoPlayer.r){if(now>=(duoPlayer.invUntil||0)&&!skillShieldP2()){duoPlayer.life=Math.max(0,duoPlayer.life-amount);duoPlayer.lastDamageAt=now;if(duoPlayer.life<=0&&!duoPlayer.down&&!tryDuoPhoenix())knockDownPlayer('p2',meteorKiller(m))}}}";
  const newMeteor="function damagePlayerByMeteor(m){const now=performance.now(),baseAmount=m.playerDamage??activeMeteorConfig().playerDamage,reduction=[0,.10,.18,.26,.35,.45],p1Lv=skillLv.guardian||0,p2Lv=duoSkillLv.guardian||0,p1Hit=!player.down&&Math.hypot(player.x-m.x,player.y-m.y)<=m.r+player.r,p2Hit=duoPlayer.connected&&!duoPlayer.down&&Math.hypot(duoPlayer.x-m.x,duoPlayer.y-m.y)<=m.r+duoPlayer.r;if(p1Hit&&now>=invincibleUntil&&player.inv<=0&&!skillShieldP1()){const intercepted=p1Lv>=5&&Math.random()<.20;if(intercepted){toast('☄ GUARDIÃO CELESTIAL · METEORO INTERCEPTADO')}else if(!tryDodge(now)){const amount=Math.max(1,baseAmount*(1-(reduction[p1Lv]||0)));lastDamageAt=now;player.life=Math.max(0,player.life-amount);triggerGhost(now);if(player.life<=0&&!player.down&&!tryPhoenix())knockDownPlayer('p1',meteorKiller(m))}}if(p2Hit&&now>=(duoPlayer.invUntil||0)&&!skillShieldP2()){const intercepted=p2Lv>=5&&Math.random()<.20;if(intercepted){toast('☄ P2 · GUARDIÃO CELESTIAL INTERCEPTOU')}else{const amount=Math.max(1,baseAmount*(1-(reduction[p2Lv]||0)));duoPlayer.life=Math.max(0,duoPlayer.life-amount);duoPlayer.lastDamageAt=now;if(duoPlayer.life<=0&&!duoPlayer.down&&!tryDuoPhoenix())knockDownPlayer('p2',meteorKiller(m))}}}";
  one(oldMeteor,newMeteor,'meteor-damage');
  return s;
}

async function loadPatchedClassic(src){const response=await fetch(src,{cache:'no-store'});if(!response.ok)throw new Error(`Failed to fetch runtime ${response.status}`);const original=await response.text();const baseMeteor="function updateMeteorEvent(dt){meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<meteorConfig.batch;i++)scheduleMeteor();meteorSpawnTimer=meteorConfig.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}",frozenMeteor="function updateMeteorEvent(dt){const frozen=performance.now()<freezeUntil;if(frozen){meteorShakeLeft=0;return}meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<meteorConfig.batch;i++)scheduleMeteor();meteorSpawnTimer=meteorConfig.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}",eventMeteor="function updateMeteorEvent(dt){meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){const cfg=activeMeteorConfig();meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<cfg.batch;i++)scheduleMeteor();meteorSpawnTimer=cfg.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}",frozenEventMeteor="function updateMeteorEvent(dt){const frozen=performance.now()<freezeUntil;if(frozen){meteorShakeLeft=0;return}meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){const cfg=activeMeteorConfig();meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<cfg.batch;i++)scheduleMeteor();meteorSpawnTimer=cfg.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}";const materialized=original.includes(frozenMeteor);let compatible=original;if(materialized){compatible=compatible.replace(frozenMeteor,baseMeteor);compatible=compatible.replace("VERSION='0.17.47'","VERSION='0.17.45'")}let natural=patchNaturalEvents(compatible);if(materialized){if(!natural.includes(eventMeteor))throw new Error('MeteorCompat: natural event loop not found after patch');natural=natural.replace(eventMeteor,frozenEventMeteor)}const guardian=patchGuardianCelestial(natural);const patched=fixClassicAimSync(guardian);const blobUrl=URL.createObjectURL(new Blob([patched],{type:'text/javascript'}));try{await loadClassic(blobUrl)}finally{URL.revokeObjectURL(blobUrl)}}

const num=id=>Number(String(document.getElementById(id)?.textContent||'0').replace(/[^0-9.-]/g,''))||0;
function normalGameSnapshot(){const start=document.getElementById('start'),over=document.getElementById('over'),pause=document.getElementById('pause');const started=!!start&&!start.classList.contains('show'),ended=!!over?.classList.contains('show');return{type:'state',version:'0.17.47',running:started&&!ended,paused:!!pause?.classList.contains('show'),level:num('level'),xp:num('xp'),health:num('life'),maxHealth:100,mobs:num('mobCount'),kills:num('deathKills'),wave:num('deathWave'),score:0,fps:Number(window.__caosFps||window.caosCurrentFps||0)||0,autoMode:false,autofire:true,gameplayMode:'classic',events:null}}
function readDiagnosticState(){return window.CaosStateSnapshot?.()||window.CaosTest?.snapshot?.()||normalGameSnapshot()}
function startDiagnosticsFeed(){let wasRunning=false,lastLevel=0,lastKills=0,finishedSession='';setInterval(()=>{try{const state=readDiagnosticState(),rec=window.CaosSessionRecorder;if(!state||!rec)return;if(state.running&&!wasRunning){rec.start();finishedSession='';rec.mark('run-start',{version:state.version||'0.17.47'});lastLevel=+state.level||0;lastKills=+state.kills||0}if(state.running){rec.sample(state);if(+state.level>lastLevel&&lastLevel>0)rec.mark('level-up',{from:lastLevel,to:+state.level});if(+state.kills>lastKills+10)rec.mark('kill-burst',{from:lastKills,to:+state.kills});lastLevel=+state.level||lastLevel;lastKills=+state.kills||lastKills}const overVisible=!!document.getElementById('over')?.classList.contains('show');if(((!state.running&&wasRunning)||overVisible)&&rec.id&&finishedSession!==rec.id){finishedSession=rec.id;rec.mark('run-end',{level:state.level,kills:state.kills,score:state.score});rec.finish({level:state.level,kills:state.kills,score:state.score})}wasRunning=!!state.running}catch(e){console.warn('CAOS LOCAL DIAGNOSTICS',e)}},250)}

const gameRuntimeUrl=new URL('../game.js?v=01747-close-parallax2',import.meta.url).href;
const multiplayerEntryUrl=new URL('../multiplayer-entry.js?v=01745-core3',import.meta.url).href;
try{await loadPatchedClassic(gameRuntimeUrl);await loadClassic(multiplayerEntryUrl);startDiagnosticsFeed();window.CaosRuntimeReady=true;window.dispatchEvent(new CustomEvent('caos:runtime-ready',{detail:{skills:true,mobs:true,combat:true,naturalEvents:true,diagnostics:true}}))}catch(error){console.error('CAOS CORE BOOTSTRAP',error);window.CaosRuntimeReady=false;window.dispatchEvent(new CustomEvent('caos:runtime-error',{detail:{message:String(error?.message||error)}}))}
