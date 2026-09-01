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

export function assertEnemyState(){
  const s=createEnemyState(),e={facing:'right',speed:100};
  if(!Array.isArray(s.enemies)||s.enemySpeed!==1||MAX_ENEMIES!==320)throw new Error('CAOS enemy state invalid');
  if(stableFacing8(e,1,0,100)!=='right'||Math.abs(movementSpeed(e,{enemySpeed:1,level:1,now:100})-101.5)>1e-9)throw new Error('CAOS enemy behavior invalid');
  return true;
}
