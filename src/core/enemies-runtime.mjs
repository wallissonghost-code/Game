export const MAX_ENEMIES=320,GRID=64,CHUNK=640;
export const ENEMY_LIMITS=Object.freeze({MAX_ENEMIES,GRID,CHUNK});

export function createEnemyState(){
  return {
    enemies:[],
    enemySpeed:1,
    autoTarget:null,
    autoTargetUntil:0
  };
}

function facingClock(now){return Number.isFinite(now)?now:performance.now()}

export function stableFacing8(enemy,vx,vy,now){
  const mag=Math.hypot(vx,vy);
  if(mag<.001)return enemy.facing||'down';
  const a=Math.atan2(vy,vx),oct=Math.round(a/(Math.PI/4)),dirs=['right','dr','down','dl','left','ul','up','ur'];
  const candidate=dirs[(oct+8)%8],at=facingClock(now);
  if(!enemy.facing){enemy.facing=candidate;enemy.faceCandidate='';enemy.faceCandidateAt=0;return enemy.facing}
  if(candidate===enemy.facing){enemy.faceCandidate='';enemy.faceCandidateAt=0;return enemy.facing}
  if(enemy.faceCandidate!==candidate){enemy.faceCandidate=candidate;enemy.faceCandidateAt=at;return enemy.facing}
  if(at-(enemy.faceCandidateAt||0)<120)return enemy.facing;
  enemy.facing=candidate;enemy.faceCandidate='';enemy.faceCandidateAt=0;return enemy.facing;
}

export function stableFacing4(enemy,vx,vy,now){
  const ax=Math.abs(vx),ay=Math.abs(vy);
  if(ax<.001&&ay<.001)return enemy.facing||'down';
  const candidate=ax>ay?(vx>0?'right':'left'):(vy>0?'down':'up'),at=facingClock(now);
  if(!enemy.facing){enemy.facing=candidate;enemy.faceCandidate='';enemy.faceCandidateAt=0;return enemy.facing}
  if(candidate===enemy.facing){enemy.faceCandidate='';enemy.faceCandidateAt=0;return enemy.facing}
  const major=Math.max(ax,ay),minor=Math.min(ax,ay),dominance=major/Math.max(.001,minor);
  if(dominance<1.32)return enemy.facing;
  if(enemy.faceCandidate!==candidate){enemy.faceCandidate=candidate;enemy.faceCandidateAt=at;return enemy.facing}
  if(at-(enemy.faceCandidateAt||0)<170)return enemy.facing;
  enemy.facing=candidate;enemy.faceCandidate='';enemy.faceCandidateAt=0;return enemy.facing;
}

export function movementSpeed(enemy,{enemySpeed=1,level=1,now}={}){
  const at=facingClock(now),locked=at<(enemy.iceFreezeUntil||0)||at<(enemy.stunUntil||0);
  if(locked)return 0;
  const slowMul=at<(enemy.slowUntil||0)?1-(enemy.slowPct||0):1;
  const furyMul=at<(enemy.furyUntil||0)?(enemy.furySpeedMul||1):1;
  return Math.min(310,enemy.speed*enemySpeed*(1+level*.015)*slowMul*furyMul);
}

export function updateChaseMotion(enemy,target,{dt=0,enemySpeed=1,level=1,perfMode=0,frameSeq=0,isBoss=false,playerRadius=18,now}={}){
  if(!enemy||!target)return null;
  const dx=target.x-enemy.x,dy=target.y-enemy.y,dist2=dx*dx+dy*dy,near2=420*420;
  const stride=dist2<near2?1:(perfMode>=2?4:perfMode===1?3:2);
  if(!enemy.mvx||((frameSeq+(enemy.aiPhase||0))%stride===0)){
    const dist=Math.sqrt(dist2)||1,baseAngle=Math.atan2(dy,dx);
    let steer=baseAngle;
    if(enemy.type==='crawler')steer+=Math.sin((enemy.t||0)*7+(enemy.seed||0))*.6;
    const stopRadius=playerRadius+enemy.r+(enemy.max>=100?58:38);
    if(dist<=stopRadius){
      enemy.mvx=0;enemy.mvy=0;enemy.speedMul=0;
      (isBoss?stableFacing4:stableFacing8)(enemy,dx,dy,now);
    }else{
      enemy.mvx=Math.cos(steer);enemy.mvy=Math.sin(steer);
      enemy.speedMul=dist<stopRadius+42?.68:1;
      (isBoss?stableFacing4:stableFacing8)(enemy,enemy.mvx,enemy.mvy,now);
    }
  }
  const speed=movementSpeed(enemy,{enemySpeed,level,now});
  enemy.x+=enemy.mvx*speed*dt*(enemy.speedMul||1);
  enemy.y+=enemy.mvy*speed*dt*(enemy.speedMul||1);
  return {speed,stride,dist2};
}

export function tryBeginAttack(enemy,target,{now,targetInv=0,targetShield=0,choiceProtected=false}={}){
  if(!enemy||!target)return {started:false,inRange:false,hitDist:Infinity,attackRange:0};
  const at=facingClock(now),hitDist=Math.hypot(enemy.x-target.x,enemy.y-target.y),attackRange=(target.r||18)+enemy.r+(enemy.max>=100?58:38);
  if(hitDist>=attackRange)return {started:false,inRange:false,hitDist,attackRange};
  const ready=at>=(enemy.attackAt||0)&&at>=(enemy.iceFreezeUntil||0)&&at>=(enemy.stunUntil||0)&&targetInv<=0&&at>targetShield&&!choiceProtected;
  if(!ready)return {started:false,inRange:true,hitDist,attackRange};
  enemy.attackAt=at+(enemy.max>=100?1100:900);
  enemy.attackFlash=.18;
  return {started:true,inRange:true,hitDist,attackRange};
}

export function buildEnemySpawn({type,typeConfig,near=false,forcedTier=null,level=1,player,viewportWidth=0,viewportHeight=0,doubleXpEvent=false,enemyCount=0,maxEnemies=MAX_ENEMIES,mobDomain,variantFor=mobDomain?.variantFor,random=Math.random}={}){
  if(enemyCount>=maxEnemies||!typeConfig||!player||!mobDomain||typeof variantFor!=='function')return null;
  const c=typeConfig,a=random()*Math.PI*2,dist=near?180+random()*220:Math.max(viewportWidth,viewportHeight)*.7+random()*260;
  const tier=c.boss?mobDomain.bossTier(forcedTier,random()):(forcedTier===1||forcedTier===2?forcedTier:mobDomain.enemyTier(level,random()));
  const evolution=c.boss?1:mobDomain.enemyEvolution(tier,level,random());
  const variant=variantFor({boss:!!c.boss,tier,evolution}),hpMult=variant.hp,dmgMult=variant.dmg,xpMult=variant.xp,hitboxMult=c.boss?1:variant.hitbox;
  const enemy={x:player.x+Math.cos(a)*dist,y:player.y+Math.sin(a)*dist,type,tier,evolution,r:c.r*hitboxMult,speed:(c.s+random()*8)*variant.speed,hp:Math.ceil(c.h*hpMult),max:Math.ceil(c.h*hpMult),damage:Math.ceil(c.d*dmgMult),xp:Math.ceil(c.x*xpMult),dead:false,t:random()*8,seed:random()*99,attackAt:0,attackFlash:0,facing:'down',skinVariant:Math.floor(random()*3),aiPhase:Math.floor(random()*4),mvx:0,mvy:0,xpEventMul:doubleXpEvent?2:1};
  return {enemy,advancedTier:!c.boss&&evolution===2?tier:null};
}

export function assertEnemyState(){
  const s=createEnemyState(),e={facing:'right',speed:100,x:0,y:0,r:10,max:10,type:'normal',t:0},target={x:100,y:0,r:18};
  if(!Array.isArray(s.enemies)||s.enemySpeed!==1||MAX_ENEMIES!==320)throw new Error('CAOS enemy state invalid');
  if(stableFacing8(e,1,0,100)!=='right'||Math.abs(movementSpeed(e,{enemySpeed:1,level:1,now:100})-101.5)>1e-9)throw new Error('CAOS enemy behavior invalid');
  const before=e.x;updateChaseMotion(e,target,{dt:.1,enemySpeed:1,level:1,perfMode:0,frameSeq:0,playerRadius:18,now:100});
  if(!(e.x>before))throw new Error('CAOS enemy chase invalid');
  const attacker={x:0,y:0,r:10,max:10,attackAt:0,iceFreezeUntil:0,stunUntil:0},near={x:20,y:0,r:18};
  if(!tryBeginAttack(attacker,near,{now:100,targetInv:0,targetShield:0,choiceProtected:false}).started)throw new Error('CAOS enemy attack invalid');
  const rolls=[0,.5,.25,.5,.1,.2,.3,.4,.5],random=()=>rolls.shift()??0,mobDomain={enemyTier:()=>0,enemyEvolution:()=>1,bossTier:()=>3,variantFor:()=>({hp:1,dmg:1,xp:1,hitbox:1,speed:1})};
  const built=buildEnemySpawn({type:'wraith',typeConfig:{r:10,s:20,h:30,d:4,x:5},near:true,level:1,player:{x:0,y:0},viewportWidth:100,viewportHeight:100,mobDomain,random});
  if(!built||built.enemy.type!=='wraith'||built.enemy.hp!==30||Math.abs(built.enemy.x-290)>1e-9)throw new Error('CAOS enemy spawn builder invalid');
  return true;
}
