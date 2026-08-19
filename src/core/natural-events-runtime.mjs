// Native Caos Live event layer.
// Applies guarded replacements to the classic runtime before it executes.

export function patchNaturalEvents(source) {
  let s = String(source || '');
  let changes = 0;

  const one = (from, to, label) => {
    const count = s.split(from).length - 1;
    if (count !== 1) throw new Error(`NaturalEvents/${label}: expected 1 match, found ${count}`);
    s = s.replace(from, to);
    changes++;
  };

  // v0.17.46 is already the active classic runtime. Keep compatibility with
  // older 0.17.45 sources, but don't fail when the version bump is pre-applied.
  if (s.includes("VERSION='0.17.45'")) one("VERSION='0.17.45'", "VERSION='0.17.46'", 'version');
  else if (!s.includes("VERSION='0.17.46'")) throw new Error('NaturalEvents/version: unsupported runtime version');

  one(
    "doubleXpEvent=false,meteorEventActive=false,meteorSpawnTimer=.45,meteors=[],meteorShakeLeft=0,meteorConfig={interval:1.7,warning:1.8,radius:92,playerDamage:18,mobDamage:20,batch:1};",
    "doubleXpEvent=false,meteorEventActive=false,doubleXpAdmin=false,meteorAdmin=false,naturalDoubleXpUntil=0,naturalMeteorUntil=0,naturalDoubleXpNextAt=0,naturalMeteorNextAt=0,meteorSpawnTimer=.45,meteors=[],meteorShakeLeft=0,meteorConfig={interval:1.7,warning:1,radius:100,playerDamage:15,mobDamage:5,batch:4};",
    'event-state'
  );

  one(
    "function hurtEnemy(e,amount,kind='normal'){const dealt=window.CaosCombat.applyEnemyDamage(e,amount);if(dealt>0)addDamageFx(e,dealt,kind);return dealt}\nfunction clampEventNumber",
    "function hurtEnemy(e,amount,kind='normal',owner='p1'){const dealt=window.CaosCombat.applyEnemyDamage(e,amount);if(dealt>0){addDamageFx(e,dealt,kind);if(kind!=='meteor'){e.playerTouched=true;e.lastPlayerHitOwner=owner}}return dealt}\nfunction clampEventNumber",
    'touch-tracking'
  );

  one(
    "const METEOR_CONFIG_KEY='caos-meteor-config-v1';",
    "const NATURAL_METEOR_CONFIG=Object.freeze({interval:1.7,warning:1,radius:100,playerDamage:15,mobDamage:5,batch:4});const METEOR_CONFIG_KEY='caos-meteor-config-v1';",
    'meteor-config'
  );

  one(
    "function scheduleMeteor(){const halfW=Math.max(170,W*.43),halfH=Math.max(170,H*.43),near=Math.random()<.28,spread=near?110:1,x=near?player.x+(Math.random()*2-1)*spread:player.x+(Math.random()*2-1)*halfW,y=near?player.y+(Math.random()*2-1)*spread:player.y+(Math.random()*2-1)*halfH;meteors.push({x,y,r:meteorConfig.radius,warningLeft:meteorConfig.warning,warningTotal:meteorConfig.warning,hit:false,life:0});if(meteors.length>90)meteors.splice(0,meteors.length-90)}",
    "function activeMeteorConfig(){return meteorAdmin?meteorConfig:NATURAL_METEOR_CONFIG}function scheduleMeteor(){const cfg=activeMeteorConfig(),halfW=Math.max(170,W*.43),halfH=Math.max(170,H*.43),near=Math.random()<.28,spread=near?110:1,x=near?player.x+(Math.random()*2-1)*spread:player.x+(Math.random()*2-1)*halfW,y=near?player.y+(Math.random()*2-1)*spread:player.y+(Math.random()*2-1)*halfH;meteors.push({x,y,r:cfg.radius,warningLeft:cfg.warning,warningTotal:cfg.warning,hit:false,life:0,playerDamage:cfg.playerDamage,mobDamage:cfg.mobDamage});if(meteors.length>90)meteors.splice(0,meteors.length-90)}",
    'meteor-spawn'
  );

  one(
    "function damagePlayerByMeteor(m){const now=performance.now(),amount=meteorConfig.playerDamage;",
    "function damagePlayerByMeteor(m){const now=performance.now(),amount=m.playerDamage??activeMeteorConfig().playerDamage;",
    'meteor-player-damage'
  );

  one(
    "function impactMeteor(m){m.hit=true;m.life=.58;meteorShakeLeft=Math.max(meteorShakeLeft,.38);damagePlayerByMeteor(m);for(const e of enemies){if(e.dead||Math.hypot(e.x-m.x,e.y-m.y)>m.r+e.r)continue;hurtEnemy(e,meteorConfig.mobDamage,'meteor');if(e.hp<=0&&!e.dead){e.dead=true;onKill(e)}}}",
    "function onMeteorKill(e){if(e.playerTouched){onKill(e,e.lastPlayerHitOwner||'p1');return}if(types[e.type]?.boss)triggerBossFury(e);gainXP(e.xp*(e.xpEventMul||1)*.25)}function impactMeteor(m){m.hit=true;m.life=.58;meteorShakeLeft=Math.max(meteorShakeLeft,.38);damagePlayerByMeteor(m);for(const e of enemies){if(e.dead||Math.hypot(e.x-m.x,e.y-m.y)>m.r+e.r)continue;hurtEnemy(e,m.mobDamage??activeMeteorConfig().mobDamage,'meteor');if(e.hp<=0&&!e.dead){e.dead=true;onMeteorKill(e)}}}",
    'meteor-xp'
  );

  one(
    "function updateMeteorEvent(dt){meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<meteorConfig.batch;i++)scheduleMeteor();meteorSpawnTimer=meteorConfig.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}",
    "function updateMeteorEvent(dt){meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){const cfg=activeMeteorConfig();meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<cfg.batch;i++)scheduleMeteor();meteorSpawnTimer=cfg.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}",
    'meteor-loop'
  );

  const director = `\nfunction eventRandMs(min,max){return(min+Math.random()*(max-min))*60000}\nfunction eventDurationMs(values){return values[Math.floor(Math.random()*values.length)]*60000}\nfunction refreshEventFlags(){const now=performance.now();doubleXpEvent=doubleXpAdmin||naturalDoubleXpUntil>now;meteorEventActive=meteorAdmin||naturalMeteorUntil>now}\nfunction resetNaturalEventTimers(now=performance.now()){naturalDoubleXpUntil=0;naturalMeteorUntil=0;naturalDoubleXpNextAt=now+eventRandMs(8,10);naturalMeteorNextAt=now+eventRandMs(8,12);refreshEventFlags()}\nfunction startNaturalDoubleXp(now){const dur=eventDurationMs([2,2.5,3,3.5,4]);naturalDoubleXpUntil=now+dur;naturalDoubleXpNextAt=0;for(const e of enemies)if(!e.dead)e.xpEventMul=Math.max(2,e.xpEventMul||1);refreshEventFlags();toast('✨ 2× XP NATURAL · '+fmtRunTime(dur))}\nfunction startNaturalMeteor(now){const dur=eventDurationMs([1,1.5,2,2.5,3]);naturalMeteorUntil=now+dur;naturalMeteorNextAt=0;meteorSpawnTimer=Math.min(meteorSpawnTimer,.35);refreshEventFlags();toast('☄ CHUVA DE METEOROS · '+fmtRunTime(dur))}\nfunction updateNaturalEvents(){if(!running||deathState)return;const now=performance.now();if(naturalDoubleXpUntil&&now>=naturalDoubleXpUntil){naturalDoubleXpUntil=0;naturalDoubleXpNextAt=now+eventRandMs(8,10);refreshEventFlags();toast('✨ 2× XP NATURAL ENCERRADO')}else if(!naturalDoubleXpUntil&&naturalDoubleXpNextAt&&now>=naturalDoubleXpNextAt)startNaturalDoubleXp(now);if(naturalMeteorUntil&&now>=naturalMeteorUntil){naturalMeteorUntil=0;naturalMeteorNextAt=now+eventRandMs(8,12);refreshEventFlags();toast('☄ CHUVA DE METEOROS ENCERRADA')}else if(!naturalMeteorUntil&&naturalMeteorNextAt&&now>=naturalMeteorNextAt)startNaturalMeteor(now);refreshEventFlags()}\nfunction naturalEventLeft(until){return Math.max(0,until-performance.now())}\nfunction drawEventHud(){const rows=[];if(doubleXpEvent)rows.push(['✨ 2× XP',doubleXpAdmin?'ADM':fmtRunTime(naturalEventLeft(naturalDoubleXpUntil))]);if(meteorEventActive)rows.push(['☄ METEOROS',meteorAdmin?'ADM':fmtRunTime(naturalEventLeft(naturalMeteorUntil))]);if(!rows.length)return;ctx.save();ctx.font='900 10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';ctx.textAlign='center';let y=62;for(const [label,time] of rows){const text=label+' · '+time,w=Math.max(118,ctx.measureText(text).width+22);ctx.fillStyle='rgba(3,7,18,.84)';ctx.strokeStyle='rgba(148,163,184,.35)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(W/2-w/2,y,w,25,11);ctx.fill();ctx.stroke();ctx.fillStyle='#f8fafc';ctx.fillText(text,W/2,y+16);y+=29}ctx.restore()}\n`;

  one("function meteorShakeOffset(){", director + "function meteorShakeOffset(){", 'event-director');
  one("runStartedAt=performance.now();waveCount=0;", "runStartedAt=performance.now();resetNaturalEventTimers(runStartedAt);waveCount=0;", 'timer-reset');
  one("if(deathState)return;updateMeteorEvent(dt);", "if(deathState)return;updateNaturalEvents();updateMeteorEvent(dt);", 'director-hook');

  one(
    "if(c==='eventdoublexp'){doubleXpEvent=!!d.value;toast(doubleXpEvent?'✨ EVENTO 2× XP ATIVADO':'✨ EVENTO 2× XP ENCERRADO · MOBS MARCADOS MANTÊM BÔNUS')}",
    "if(c==='eventdoublexp'){doubleXpAdmin=!!d.value;refreshEventFlags();if(doubleXpAdmin)for(const e of enemies)if(!e.dead)e.xpEventMul=Math.max(2,e.xpEventMul||1);toast(doubleXpAdmin?'✨ EVENTO 2× XP ADM ATIVADO':(doubleXpEvent?'✨ 2× XP ADM ENCERRADO · NATURAL CONTINUA':'✨ EVENTO 2× XP ENCERRADO · MOBS MARCADOS MANTÊM BÔNUS'))}",
    'admin-xp'
  );

  one(
    "if(c==='eventmeteor'){applyMeteorConfig(d);meteorEventActive=!!d.value;if(meteorEventActive)meteorSpawnTimer=Math.min(meteorSpawnTimer,.35);toast(meteorEventActive?'☄ CHUVA DE METEORO ATIVADA':'☄ CHUVA DE METEORO ENCERRADA')}",
    "if(c==='eventmeteor'){applyMeteorConfig(d);meteorAdmin=!!d.value;refreshEventFlags();if(meteorEventActive)meteorSpawnTimer=Math.min(meteorSpawnTimer,.35);toast(meteorAdmin?'☄ CHUVA DE METEORO ADM ATIVADA':(meteorEventActive?'☄ METEORO ADM ENCERRADO · NATURAL CONTINUA':'☄ CHUVA DE METEORO ENCERRADA'))}",
    'admin-meteor'
  );

  one("hurtEnemy(e,dmg,kind);if(b.ice)", "hurtEnemy(e,dmg,kind,b.owner==='p2'?'p2':'p1');if(b.ice)", 'bullet-owner');
  one("for(const e of hit){hurtEnemy(e,damage[lv],'arc');if(e.hp<=0&&!e.dead){e.dead=true;onKill(e,'p2')}}", "for(const e of hit){hurtEnemy(e,damage[lv],'arc','p2');if(e.hp<=0&&!e.dead){e.dead=true;onKill(e,'p2')}}", 'duo-owner');
  one("drawPlayer();drawPhoenixShield();if(performance.now()>=phoenixShieldUntil)drawShield();drawFreeze();if(performance.now()<toastUntil)", "drawPlayer();drawPhoenixShield();if(performance.now()>=phoenixShieldUntil)drawShield();drawFreeze();drawEventHud();if(performance.now()<toastUntil)", 'event-hud');

  one(
    "events:{doubleXp:doubleXpEvent,meteor:{active:meteorEventActive,interval:meteorConfig.interval,warning:meteorConfig.warning,radius:meteorConfig.radius,playerDamage:meteorConfig.playerDamage,mobDamage:meteorConfig.mobDamage,batch:meteorConfig.batch,pending:meteors.filter(m=>!m.hit).length}},",
    "events:{doubleXp:doubleXpEvent,doubleXpSource:doubleXpAdmin?'admin':doubleXpEvent?'natural':'off',doubleXpRemainingMs:doubleXpAdmin?null:naturalEventLeft(naturalDoubleXpUntil),meteor:{active:meteorEventActive,source:meteorAdmin?'admin':meteorEventActive?'natural':'off',remainingMs:meteorAdmin?null:naturalEventLeft(naturalMeteorUntil),interval:activeMeteorConfig().interval,warning:activeMeteorConfig().warning,radius:activeMeteorConfig().radius,playerDamage:activeMeteorConfig().playerDamage,mobDamage:activeMeteorConfig().mobDamage,batch:activeMeteorConfig().batch,pending:meteors.filter(m=>!m.hit).length}},",
    'telemetry'
  );

  one(
    "fps:Math.max(0,Math.round(window.caosCurrentFps||0)),perfMode,skillLv:{...skillLv}",
    "diagnostics:(()=>{const alive=enemies.filter(e=>!e.dead),target=autoTarget&&!autoTarget.dead?autoTarget:null,near=alive.slice().sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).slice(0,5);return{player:{x:Math.round(player.x*10)/10,y:Math.round(player.y*10)/10,aim:player.aim,moving:!!player.moving,life:Math.round(player.life*100)/100},target:target?{type:target.type,x:Math.round(target.x*10)/10,y:Math.round(target.y*10)/10,hp:Math.round(target.hp*100)/100,dist:Math.round(Math.hypot(target.x-player.x,target.y-player.y)*10)/10}:null,lastShot:ciLastShot?{...ciLastShot}:null,shots:{fired:ciShotsFired,hit:ciShotsHit,expired:ciShotsExpired},bullets:bullets.filter(b=>!b.flash&&!b.dead).slice(0,6).map(b=>({x:Math.round(b.x*10)/10,y:Math.round(b.y*10)/10,vx:Math.round(b.vx*10)/10,vy:Math.round(b.vy*10)/10,owner:b.owner||'p1'})),nearby:near.map(e=>({type:e.type,x:Math.round(e.x*10)/10,y:Math.round(e.y*10)/10,hp:Math.round(e.hp*100)/100,dist:Math.round(Math.hypot(e.x-player.x,e.y-player.y)*10)/10}))}})(),fps:Math.max(0,Math.round(window.caosCurrentFps||0)),perfMode,skillLv:{...skillLv}",
    'diagnostic-telemetry'
  );

  one("function broadcast(){const s=state();", "window.CaosStateSnapshot=()=>state();function broadcast(){const s=state();", 'state-export');

  // Aim hardening: classic mode is also auto-targeted. The captured bug happened with autoMode=false
  // and gameplayMode='classic', so classic must reacquire the nearest visible mob on every shot too.
  one(
    "function focusedTarget(){const now=performance.now(),near=nearestVisible();if(!near){autoTarget=null;autoTargetUntil=0;return null}if(autoTarget&&(!autoTarget.dead)&&enemies.includes(autoTarget)&&targetVisible(autoTarget)){const ad=Math.hypot(autoTarget.x-player.x,autoTarget.y-player.y),nd=Math.hypot(near.x-player.x,near.y-player.y);if(ad<=FIRE_RANGE&&now<autoTargetUntil&&ad<=nd+36)return autoTarget}autoTarget=near;autoTargetUntil=now+120;return near}",
    "function focusedTarget(){const near=nearestVisible();if(!near){autoTarget=null;autoTargetUntil=0;return null}autoTarget=near;autoTargetUntil=performance.now()+120;return near}",
    'fresh-aim'
  );

  if (changes < 10) throw new Error(`NaturalEvents: incomplete patch (${changes})`);
  return s;
}
