export const REVIVE=Object.freeze({RADIUS:68,MS:3000});

export function createMultiplayerState(){
  return {
    duoConn:null,
    duoShotTimer:.05,
    duoEntitySeq:1,
    duoShotCounter:0,
    duoArcNextAt:0,
    duoLevel:1,
    duoXp:0,
    duoXpNeed:60,
    duoKillCount:0,
    duoPendingSkill:null,
    reviveP1Ms:0,
    reviveP2Ms:0,
    lastCoopKiller:null,
    playerNames:{p1:'P1',p2:'P2'},
    duoAuthUid:''
  };
}

export function assertMultiplayerState(){
  const s=createMultiplayerState();
  if(s.duoLevel!==1||s.duoXpNeed!==60||REVIVE.MS!==3000)throw new Error('CAOS multiplayer state invalid');
  return true;
}
