from pathlib import Path
import re, json

VERSION='0.17.38'
TAG='01738'

def must(s, old, new, label):
    if old not in s:
        raise SystemExit(f'anchor missing: {label}')
    return s.replace(old, new, 1)

p=Path('src/game.js')
s=p.read_text(encoding='utf-8')
s=must(s,"const VERSION='0.17.37'",f"const VERSION='{VERSION}'",'version')

old_state="damageFx=[],pierceShotCounter=0,nextWaveAt=0;const skillLv={speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,phoenix:0,armor:0,pierce:0};"
new_state="damageFx=[],pierceShotCounter=0,iceShotCounter=0,explosiveShotCounter=0,nextWaveAt=0,ghostUntil=0,ghostCooldownUntil=0,dodgeCharges=0,dodgeCooldownUntil=0,shockNextAt=0,shockFx=[],explosionFx=[],bossFuryCount=0;const skillLv={speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,phoenix:0,armor:0,pierce:0,ghost:0,dodge:0,ice:0,shock:0,berserker:0,explosive:0};"
s=must(s,old_state,new_state,'runtime state')

pierce="{id:'pierce',n:'Munição Perfurante',i:'🎯',r:'epic',desc:l=>{const every=[0,12,11,10,9,8][l],pass=[0,2,3,4,5,7][l];return `A cada ${every} tiros, 1 projétil atravessa até ${pass} inimigos.`},apply:l=>{}}"
phoenix="{id:'phoenix',n:'Fênix',i:'🔥',r:'secret',desc:l=>'Skill única: revive 1x com 80% da vida máxima e 5s de proteção dourada.',apply:l=>{phoenixReady=true;phoenixConsumed=false}}"
new_skills="""{id:'ghost',n:'Fantasma',i:'👻',r:'epic',desc:l=>`Ao sofrer dano: intocável por ${String([0,.35,.4,.45,.52,.6][l]).replace('.',',')}s · recarga ${String([0,14,13,12,10.5,9][l]).replace('.',',')}s.`,apply:l=>{}},{id:'dodge',n:'Esquiva',i:'🌀',r:'secret',desc:l=>'Abaixo de 50% HP: esquiva de até 2 golpes · recarga 30s.',apply:l=>{}},{id:'ice',n:'Estilhaço de Gelo',i:'❄️',r:'epic',desc:l=>l<5?`A cada 10 tiros: ${[0,12,18,24,30,35][l]}% de lentidão por 1,5s.`:'A cada 10 tiros: congela o 1º alvo por 0,8s; demais recebem lentidão.',apply:l=>{}},{id:'shock',n:'Onda de Choque',i:'🌊',r:'legendary',desc:l=>`5 ondas · ${[0,3,4,5,6,8][l]} dano · stun ${String([0,.4,.5,.6,.75,1][l]).replace('.',',')}s · CD ${[0,12,11,10,9,8][l]}s.`,apply:l=>{shockNextAt=Math.min(shockNextAt||Infinity,performance.now()+700)}},{id:'berserker',n:'Berserker',i:'😡',r:'epic',desc:l=>`HP baixo aumenta combate; no crítico até +${Math.round([0,.09,.13,.17,.21,.25][l]*100)}% cadência e +${Math.round([0,.06,.09,.12,.16,.20][l]*100)}% dano.`,apply:l=>{}},{id:'explosive',n:'Munição Explosiva',i:'💣',r:'legendary',desc:l=>`1 explosiva a cada ${[0,14,13,12,11,10][l]} tiros · raio ${[0,65,70,75,85,95][l]} · dano em área ${[0,3,4,5,6,8][l]}.`,apply:l=>{}}"""
s=must(s,pierce+','+phoenix,pierce+','+new_skills+','+phoenix,'new skill registry')

s=must(s,"function gainXP(v){","const NEW_SOLO_SKILLS=new Set(['ghost','dodge','ice','shock','berserker','explosive']);function skillCap(id){return id==='phoenix'||id==='dodge'?1:id==='armor'?4:5}function gainXP(v){",'skill cap helper')
s=must(s,"function chooseSkill(){const pool=skills.filter(s=>s.id==='phoenix'?(!phoenixConsumed&&skillLv[s.id]<1):s.id==='armor'?skillLv[s.id]<4:skillLv[s.id]<5);","function chooseSkill(){const pool=skills.filter(s=>(skillLv[s.id]||0)<skillCap(s.id)&&(s.id!=='phoenix'||(!phoenixConsumed&&skillLv.phoenix<1)));",'skill pool cap')
s=must(s,"const s=pick[0],cur=skillLv[s.id],next=s.id==='phoenix'?1:Math.min(5,cur+1);","const s=pick[0],cur=skillLv[s.id],next=Math.min(skillCap(s.id),cur+1);",'auto skill cap')

helpers=r"""function furyProfile(stage){stage=Math.max(1,Math.min(10,stage||1));const speed={1:[.50,.80,5000],2:[.40,.60,5000],3:[.20,.40,5000],4:[.10,.30,4500],5:[0,.10,4000]};if(stage<=5){const [lo,hi,duration]=speed[stage],bonus=lo+Math.random()*(hi-lo);return{speedMul:1+bonus,resist:0,duration,label:'+'+Math.round(bonus*100)+'% VEL'}}const resist=[0,0,0,0,0,0,.05,.10,.15,.20,.25][stage],duration=stage===6?4000:stage===7?4000:stage===8?3500:3000;return{speedMul:1,resist,duration,label:'+'+Math.round(resist*100)+'% RESIST'}}
function triggerBossFury(deadBoss){bossFuryCount++;const f=furyProfile(bossFuryCount),now=performance.now(),affected=enemies.filter(m=>m!==deadBoss&&!m.dead&&!types[m.type]?.boss);for(const m of affected){m.furyUntil=now+f.duration;m.furySpeedMul=f.speedMul;m.furyResist=f.resist}if(affected.length)toast('😡 FÚRIA PÓS-BOSS · '+f.label+' · '+String(f.duration/1000).replace('.',',')+'s')}
function furyResist(e){return performance.now()<(e?.furyUntil||0)?Math.max(0,Math.min(.5,e.furyResist||0)):0}
function hurtEnemy(e,amount,kind='normal'){if(!e||e.dead)return 0;const dealt=Math.max(0,(+amount||0)*(1-furyResist(e)));e.hp-=dealt;addDamageFx(e,dealt,kind);return dealt}
function berserkerState(){const lv=skillLv.berserker||0,ratio=player.life/Math.max(1,player.maxLife),rate=[0,.09,.13,.17,.21,.25][lv]||0,dmg=[0,.06,.09,.12,.16,.20][lv]||0;if(!lv||ratio>.5)return{rateMul:1,damageMul:1,stage:0};if(ratio<=.15)return{rateMul:1+rate,damageMul:1+dmg,stage:3};if(ratio<=.30)return{rateMul:1+rate*.8,damageMul:1+dmg*.5,stage:2};return{rateMul:1+rate*.5,damageMul:1,stage:1}}
function triggerGhost(now){player.inv=Math.max(player.inv,.28);const lv=skillLv.ghost||0;if(!lv||now<ghostCooldownUntil)return;const dur=[0,.35,.4,.45,.52,.6][lv],cd=[0,14,13,12,10.5,9][lv];ghostUntil=now+dur*1000;ghostCooldownUntil=now+cd*1000;player.inv=Math.max(player.inv,dur);toast('👻 FANTASMA · '+String(dur).replace('.',',')+'s')}
function tryDodge(now){if(!skillLv.dodge||player.life/player.maxLife>=.5)return false;if(dodgeCharges<=0){if(now<dodgeCooldownUntil)return false;dodgeCharges=2}dodgeCharges--;player.inv=Math.max(player.inv,.10);if(dodgeCharges<=0)dodgeCooldownUntil=now+30000;toast('🌀 ESQUIVA! · '+dodgeCharges+' CARGA'+(dodgeCharges===1?'':'S'));return true}
function applyIceHit(e){const lv=skillLv.ice||0;if(!lv||!e)return;const now=performance.now(),boss=!!types[e.type]?.boss,slow=([0,.12,.18,.24,.30,.35][lv]||0)*(boss?.45:1);e.slowPct=Math.max(e.slowPct||0,slow);e.slowUntil=Math.max(e.slowUntil||0,now+1500);if(lv>=5)e.iceFreezeUntil=Math.max(e.iceFreezeUntil||0,now+(boss?280:800))}
function castShockwave(){const lv=skillLv.shock||0,now=performance.now();if(!lv||now<shockNextAt)return;const near=enemies.some(e=>!e.dead&&Math.hypot(e.x-player.x,e.y-player.y)<285);if(!near)return;const cd=[0,12,11,10,9,8][lv],dmg=[0,3,4,5,6,8][lv],stun=[0,.4,.5,.6,.75,1][lv];shockNextAt=now+cd*1000;const angles=[],hit=new Set();for(let i=0;i<5;i++){const a=(player.aim||0)+i*Math.PI*2/5,ux=Math.cos(a),uy=Math.sin(a);angles.push(a);let target=null,best=1e9;for(const e of enemies){if(e.dead||hit.has(e))continue;const dx=e.x-player.x,dy=e.y-player.y,along=dx*ux+dy*uy,side=Math.abs(dx*uy-dy*ux);if(along>24&&along<280&&side<38+e.r&&along<best){best=along;target=e}}if(target){hit.add(target);hurtEnemy(target,dmg,'shock');target.stunUntil=Math.max(target.stunUntil||0,now+stun*1000*(types[target.type]?.boss?.30:1));if(target.hp<=0&&!target.dead){target.dead=true;onKill(target)}}}shockFx.push({x:player.x,y:player.y,angles,at:now,until:now+420});if(hit.size)toast('🌊 ONDA DE CHOQUE · '+hit.size+' ALVOS')}
function explodeAt(x,y,lv,owner='p1',skip=null){const radius=[0,65,70,75,85,95][lv]||65,base=[0,3,4,5,6,8][lv]||3,now=performance.now();explosionFx.push({x,y,r:radius,at:now,until:now+420});for(const e of enemies){if(e.dead||e===skip)continue;const d=Math.hypot(e.x-x,e.y-y);if(d>radius)continue;const amount=base*(.55+.45*(1-d/radius));hurtEnemy(e,amount,'explosive');if(e.hp<=0&&!e.dead){e.dead=true;onKill(e,owner)}}}
function drawNewSkillFx(){const now=performance.now();shockFx=shockFx.filter(f=>f.until>now);for(const f of shockFx){const life=(f.until-now)/Math.max(1,f.until-f.at),p=world(f.x,f.y);ctx.save();ctx.globalAlpha=Math.max(0,life);ctx.strokeStyle='#c4b5fd';ctx.shadowColor='#38bdf8';ctx.shadowBlur=18;ctx.lineWidth=5;for(const a of f.angles){ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*25,p.y+Math.sin(a)*25);ctx.lineTo(p.x+Math.cos(a)*280,p.y+Math.sin(a)*280);ctx.stroke()}ctx.restore()}explosionFx=explosionFx.filter(f=>f.until>now);for(const f of explosionFx){const life=(f.until-now)/Math.max(1,f.until-f.at),p=world(f.x,f.y),r=f.r*(1-life*.35);ctx.save();ctx.globalAlpha=Math.max(0,life);ctx.strokeStyle='#fb923c';ctx.fillStyle='rgba(251,146,60,.12)';ctx.shadowColor='#f97316';ctx.shadowBlur=20;ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore()}}
function drawPlayerSkillAuras(){const now=performance.now(),b=berserkerState();if(now<ghostUntil){ctx.save();ctx.globalAlpha=.48+.18*Math.sin(now/55);ctx.strokeStyle='#e0f2fe';ctx.shadowColor='#a5f3fc';ctx.shadowBlur=18;ctx.lineWidth=2;ctx.setLineDash([5,7]);ctx.lineDashOffset=-now/25;ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*2);ctx.stroke();ctx.restore()}if(skillLv.dodge&&player.life/player.maxLife<.5&&dodgeCharges>0){ctx.save();ctx.fillStyle='#c4b5fd';ctx.font='900 9px sans-serif';ctx.textAlign='center';ctx.fillText('🌀 ESQUIVA ×'+dodgeCharges,0,-49);ctx.restore()}if(b.stage){ctx.save();ctx.globalAlpha=.30+b.stage*.12;ctx.strokeStyle=b.stage===3?'#ef4444':'#fb7185';ctx.shadowColor='#dc2626';ctx.shadowBlur=10+b.stage*5;ctx.lineWidth=2+b.stage*.5;ctx.beginPath();ctx.arc(0,0,29+b.stage*2,0,Math.PI*2);ctx.stroke();ctx.restore()}}
"""
s=must(s,"function onKill(e,owner='p1'){",helpers+"function onKill(e,owner='p1'){",'new mechanics helpers')
s=must(s,"function onKill(e,owner='p1'){killCount++;","function onKill(e,owner='p1'){if(types[e.type]?.boss)triggerBossFury(e);killCount++;",'boss fury trigger')

s=must(s,"e.hp-=player.flashDamage;addDamageFx(e,player.flashDamage,'flash')","hurtEnemy(e,player.flashDamage,'flash')",'flash damage helper')
s=must(s,"e.hp-=damage[lv];addDamageFx(e,damage[lv],'arc');if(e.hp<=0&&!e.dead){e.dead=true;onKill(e)}","hurtEnemy(e,damage[lv],'arc');if(e.hp<=0&&!e.dead){e.dead=true;onKill(e)}",'arc damage helper')
s=must(s,"e.hp-=damage[lv];addDamageFx(e,damage[lv],'arc');if(e.hp<=0&&!e.dead){e.dead=true;onKill(e,'p2')}","hurtEnemy(e,damage[lv],'arc');if(e.hp<=0&&!e.dead){e.dead=true;onKill(e,'p2')}",'duo arc fury resistance')

new_shoot=r"""function shoot(){if(player.down||(choosing&&duoPlayer.connected))return;let target=null;if(autoMode){target=focusedTarget();if(!target)return;player.aim=Math.atan2(target.y-player.y,target.x-player.x)}else if(gameplayMode==='sweep'){target=sweepTarget();if(!target)return;player.aim=Math.atan2(target.y-player.y,target.x-player.x)}else if(gameplayMode==='hardcore'){player.aim=movementAimAngle}else{target=nearestVisible();if(!target)return;player.aim=Math.atan2(target.y-player.y,target.x-player.x)}player.shotFlash=.1;const dir=playerFacing(player.aim),m=muzzleLocal(dir),pl=skillLv.pierce||0,il=skillLv.ice||0,xl=skillLv.explosive||0,bs=berserkerState();let pierceLeft=0,ice=false,explosive=false;if(xl){explosiveShotCounter++;const every=[0,14,13,12,11,10][xl];if(explosiveShotCounter>=every){explosiveShotCounter=0;explosive=true}}if(!explosive&&il){iceShotCounter++;if(iceShotCounter>=10){iceShotCounter=0;ice=true}}if(!explosive&&!ice&&pl){pierceShotCounter++;const every=[0,12,11,10,9,8][pl];if(pierceShotCounter>=every){pierceShotCounter=0;pierceLeft=[0,2,3,4,5,7][pl]}}bullets.push({x:player.x+m.x,y:player.y+m.y,vx:Math.cos(player.aim)*610,vy:Math.sin(player.aim)*610,r:4,dead:false,ammo:1,born:performance.now(),pierceLeft,hits:[],damage:player.damage*bs.damageMul,ice,explosive});if(player.flashDamage&&++flashCounter%5===0)flash()}"""
s,n=re.subn(r"function shoot\(\)\{.*?\}function setPaused",new_shoot+"function setPaused",s,count=1,flags=re.S)
if n!=1: raise SystemExit('shoot replacement failed')

s=must(s,"castArc();shotTimer-=dt;if(autoFire&&shotTimer<=0){shoot();shotTimer=player.fireRate}","castArc();castShockwave();shotTimer-=dt;if(autoFire&&shotTimer<=0){shoot();shotTimer=player.fireRate/berserkerState().rateMul}",'shock + berserker cadence')

move_old="e.x+=e.mvx*e.speed*enemySpeed*(1+level*.015)*dt*(e.speedMul||1);e.y+=e.mvy*e.speed*enemySpeed*(1+level*.015)*dt*(e.speedMul||1);"
move_new="const controlNow=performance.now(),locked=controlNow<(e.iceFreezeUntil||0)||controlNow<(e.stunUntil||0),slowMul=controlNow<(e.slowUntil||0)?1-(e.slowPct||0):1,furyMul=controlNow<(e.furyUntil||0)?(e.furySpeedMul||1):1,moveSpeed=locked?0:Math.min(310,e.speed*enemySpeed*(1+level*.015)*slowMul*furyMul);e.x+=e.mvx*moveSpeed*dt*(e.speedMul||1);e.y+=e.mvy*moveSpeed*dt*(e.speedMul||1);"
s=must(s,move_old,move_new,'mob control/fury movement')
s=must(s,"if(now>=(e.attackAt||0)&&targetInv<=0&&now>targetShield&&!choiceProtected){","if(now>=(e.attackAt||0)&&now>=(e.iceFreezeUntil||0)&&now>=(e.stunUntil||0)&&targetInv<=0&&now>targetShield&&!choiceProtected){",'stun/freeze attack lock')
s=must(s,"if(isP1){lastDamageAt=performance.now();player.life=Math.max(0,player.life-Math.max(1,e.damage*(1-player.armorReduction)));player.inv=.28}else if(now>=(duoPlayer.invUntil||0)){","if(isP1){if(!tryDodge(now)){lastDamageAt=now;player.life=Math.max(0,player.life-Math.max(1,e.damage*(1-player.armorReduction)));triggerGhost(now)}}else if(now>=(duoPlayer.invUntil||0)){",'ghost+dodge damage')

hit_old="const dmg=b.damage||player.damage;e.hp-=dmg;addDamageFx(e,dmg,b.hits&&b.hits.length?'pierce':'normal');if(e.hp<=0){e.dead=true;onKill(e,b.owner==='p2'?'p2':'p1')}"
hit_new="const dmg=b.damage||player.damage,kind=b.ice?'ice':b.explosive?'explosive':b.hits&&b.hits.length?'pierce':'normal';hurtEnemy(e,dmg,kind);if(b.ice)applyIceHit(e);if(b.explosive)explodeAt(e.x,e.y,skillLv.explosive||1,b.owner==='p2'?'p2':'p1',e);if(e.hp<=0){e.dead=true;onKill(e,b.owner==='p2'?'p2':'p1')}"
s=must(s,hit_old,hit_new,'bullet skill resolution')

s=must(s,"f.kind==='flash'?'#fde047':f.kind==='arc'?'#67e8f9':f.kind==='pierce'?'#f0abfc':'#ffffff'","f.kind==='flash'?'#fde047':f.kind==='arc'?'#67e8f9':f.kind==='pierce'?'#f0abfc':f.kind==='ice'?'#bae6fd':f.kind==='explosive'?'#fb923c':f.kind==='shock'?'#c4b5fd':'#ffffff'",'damage fx colors')

s=must(s,"trail.addColorStop(1,'rgba(125,211,252,.8)');ctx.fillStyle=trail;","trail.addColorStop(1,b.ice?'rgba(103,232,249,.92)':b.explosive?'rgba(251,146,60,.92)':'rgba(125,211,252,.8)');ctx.fillStyle=trail;",'bullet trail color')
s=must(s,"ctx.shadowColor='#38bdf8';ctx.shadowBlur=10;ctx.fillStyle='#e0f2fe';","ctx.shadowColor=b.ice?'#67e8f9':b.explosive?'#f97316':'#38bdf8';ctx.shadowBlur=10;ctx.fillStyle=b.ice?'#dff6ff':b.explosive?'#fed7aa':'#e0f2fe';",'bullet body color')
s=must(s,"ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(13,-3.2);","ctx.fillStyle=b.ice?'#ffffff':b.explosive?'#fde68a':'#fff';ctx.beginPath();ctx.moveTo(13,-3.2);",'bullet tip color')

s=must(s,"drawMed();drawArcFx();","drawMed();drawArcFx();drawNewSkillFx();",'new skill draw call')
s=must(s,"ctx.restore();return;\n  }\n  if(skillShieldP1())drawSkillShieldAt(0,0,'P1');ctx.restore();return;","drawPlayerSkillAuras();ctx.restore();return;\n  }\n  drawPlayerSkillAuras();if(skillShieldP1())drawSkillShieldAt(0,0,'P1');ctx.restore();return;",'player skill auras')

enemy_tail="if(performance.now()<freezeUntil){const sec=Math.ceil((freezeUntil-performance.now())/1000);ctx.fillStyle='#dff6ff';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText('❄ '+sec+'s',0,barY-17)}ctx.restore()}"
enemy_new="if(performance.now()<freezeUntil){const sec=Math.ceil((freezeUntil-performance.now())/1000);ctx.fillStyle='#dff6ff';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText('❄ '+sec+'s',0,barY-17)}const fxNow=performance.now();if(fxNow<(e.furyUntil||0)){const pulse=.7+.3*Math.sin(fxNow/70);ctx.save();ctx.globalAlpha=.55+.25*pulse;ctx.strokeStyle='#ef4444';ctx.shadowColor='#dc2626';ctx.shadowBlur=16;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,4,e.r+10+pulse*2,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fecaca';ctx.font='900 8px sans-serif';ctx.textAlign='center';ctx.fillText('FÚRIA',0,barY-11);ctx.restore()}if(fxNow<(e.iceFreezeUntil||0)||fxNow<(e.slowUntil||0)){ctx.save();ctx.strokeStyle=fxNow<(e.iceFreezeUntil||0)?'#e0f2fe':'#67e8f9';ctx.shadowColor='#38bdf8';ctx.shadowBlur=12;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,3,e.r+6,0,Math.PI*2);ctx.stroke();ctx.restore()}if(fxNow<(e.stunUntil||0)){ctx.fillStyle='#fde68a';ctx.font='900 10px sans-serif';ctx.textAlign='center';ctx.fillText('✦ ✦',0,barY-18)}ctx.restore()}"
s=must(s,enemy_tail,enemy_new,'enemy fury/ice/stun visuals')

reset_old="damageFx=[];pierceShotCounter=0;nextWaveAt=performance.now()+900;enemySpeed=1;"
reset_new="damageFx=[];pierceShotCounter=0;iceShotCounter=0;explosiveShotCounter=0;nextWaveAt=performance.now()+900;ghostUntil=ghostCooldownUntil=0;dodgeCharges=dodgeCooldownUntil=0;shockNextAt=0;shockFx=[];explosionFx=[];bossFuryCount=0;enemySpeed=1;"
s=must(s,reset_old,reset_new,'new skill reset')

s=must(s,"function adminSkillReset(){for(const k in skillLv)skillLv[k]=0;Object.assign(player,{speed:255,fireRate:.28,xpMult:1,regen:0,flashDamage:0,bloodChance:0,bloodHeal:0,maxLife:100,armorReduction:0});player.life=Math.min(player.life,player.maxLife);arcNextAt=0;arcFx=[];phoenixReady=false;phoenixConsumed=false}","function adminSkillReset(){for(const k in skillLv)skillLv[k]=0;Object.assign(player,{speed:255,fireRate:.28,xpMult:1,regen:0,flashDamage:0,bloodChance:0,bloodHeal:0,maxLife:100,armorReduction:0});player.life=Math.min(player.life,player.maxLife);arcNextAt=0;arcFx=[];phoenixReady=false;phoenixConsumed=false;ghostUntil=ghostCooldownUntil=0;dodgeCharges=dodgeCooldownUntil=0;shockNextAt=0;iceShotCounter=explosiveShotCounter=0;shockFx=[];explosionFx=[]}",'admin reset')
s=must(s,"lv=id==='phoenix'?(+lv>0?1:0):id==='armor'?Math.max(0,Math.min(4,+lv||0)):Math.max(0,Math.min(5,+lv||0));","lv=skillCap(id)===1?(+lv>0?1:0):Math.max(0,Math.min(skillCap(id),+lv||0));",'admin cap')
s=must(s,"const id=String(d.skill||''),lv=id==='phoenix'?1:id==='armor'?Math.max(1,Math.min(4,+d.level||1)):Math.max(0,Math.min(5,+d.level||1));","const id=String(d.skill||''),lv=skillCap(id)===1?1:Math.max(0,Math.min(skillCap(id),+d.level||1));",'admin skilltest cap')
s=must(s,"for(const sk of skills)adminSkillApply(sk.id,sk.id==='armor'?Math.min(4,lv):lv);","for(const sk of skills)adminSkillApply(sk.id,Math.min(skillCap(sk.id),lv));",'admin all cap')
s=must(s,"for(const sk of skills)adminSkillApply(sk.id,sk.id==='armor'?4:5);","for(const sk of skills)adminSkillApply(sk.id,skillCap(sk.id));",'admin max cap')

s=must(s,"function duoSkillCap(id){return id==='phoenix'?1:id==='armor'?4:5}","function duoSkillCap(id){return skillCap(id)}",'duo cap')
s=must(s,"function queueDuoSkill(){if(duoPendingSkill)return;const pool=skills.filter(s=>{const cur=duoSkillLv[s.id]||0;","function queueDuoSkill(){if(duoPendingSkill)return;const pool=skills.filter(s=>{if(NEW_SOLO_SKILLS.has(s.id))return false;const cur=duoSkillLv[s.id]||0;",'keep new skills solo test')

s=must(s,"wave:waveCount,fps:","wave:waveCount,bossFuryCount,fps:",'fury telemetry')
p.write_text(s,encoding='utf-8')

pp=Path('src/panel.js'); ps=pp.read_text(encoding='utf-8')
ps=must(ps,"phoenix:'Fênix'}","phoenix:'Fênix',ghost:'Fantasma',dodge:'Esquiva',ice:'Gelo',shock:'Onda',berserker:'Berserker',explosive:'Explosiva'}",'panel skill names')
ps=must(ps,"const id=$('skillTestSelect').value,isPhoenix=id==='phoenix',isArmor=id==='armor';$('skillTestLevel').disabled=isPhoenix;if(isPhoenix)$('skillTestLevel').value='1';","const id=$('skillTestSelect').value,isUnique=id==='phoenix'||id==='dodge',isArmor=id==='armor';$('skillTestLevel').disabled=isUnique;if(isUnique)$('skillTestLevel').value='1';",'panel unique skill cap')
pp.write_text(ps,encoding='utf-8')

ph=Path('painel.html'); h=ph.read_text(encoding='utf-8')
options="<option value=\"ghost\">👻 Fantasma</option><option value=\"dodge\">🌀 Esquiva · ÚNICA</option><option value=\"ice\">❄️ Estilhaço de Gelo</option><option value=\"shock\">🌊 Onda de Choque</option><option value=\"berserker\">😡 Berserker</option><option value=\"explosive\">💣 Munição Explosiva</option>"
h=must(h,"<option value=\"phoenix\">🔥 Fênix · ÚNICA</option>",options+"<option value=\"phoenix\">🔥 Fênix · ÚNICA</option>",'panel skill options')
h=h.replace('v0.17.37','v0.17.38').replace('v=01737','v=01738')
ph.write_text(h,encoding='utf-8')

idx=Path('index.html'); ih=idx.read_text(encoding='utf-8')
ih=ih.replace('Caos Live v0.17.37','Caos Live v0.17.38').replace('v0.17.37 · SINCRONIZADO','v0.17.38 · NOVAS SKILLS + FÚRIA').replace('v0.17.37</span>','v0.17.38</span>').replace('v=01737','v=01738')
idx.write_text(ih,encoding='utf-8')

vp=Path('version.json'); v=json.loads(vp.read_text(encoding='utf-8'));v['version']=VERSION;v['build']='solo-new-skills-boss-fury-test';vp.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('patched',VERSION)
