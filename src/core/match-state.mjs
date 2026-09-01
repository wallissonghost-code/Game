export function xpNeedFor(lv){
  const base=60*Math.pow(Math.max(1,lv),1.42);
  const mult=lv>=90?1.70:lv>=80?1.50:lv>=60?1.30:lv>=40?1.12:1;
  return Math.floor(base*mult);
}

export function createMatchState(){
  return {
    score:0,
    level:1,
    xp:0,
    xpNeed:60,
    killCount:0,
    runStartedAt:0,
    deathState:null,
    totalXpP1:0,
    totalXpP2:0,
    matchSaved:false,
    rankMode:'solo',
    rankEligible:true,
    rankInvalidReason:'',
    adminSessionDirty:false
  };
}

export function assertMatchState(){
  const s=createMatchState();
  if(s.level!==1||s.xpNeed!==60||xpNeedFor(1)!==60)throw new Error('CAOS match state invalid');
  return true;
}
