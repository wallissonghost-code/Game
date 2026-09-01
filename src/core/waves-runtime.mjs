export function createWaveState(){
  return {
    spawnTimer:0,
    hordeEnabled:true,
    waveCount:0,
    nextWaveAt:0,
    bossFuryCount:0
  };
}

export function softCapForLevel(level){
  return Math.min(210,90+Math.max(0,Number(level)||0)*4);
}

export function nextWaveDelay(level,enemyCount,softCap=softCapForLevel(level)){
  const cap=Math.max(1,softCap),pressure=Math.max(0,Number(enemyCount)||0)/cap;
  const base=Math.max(1500,3600-(Number(level)||0)*55);
  return base*(.9+pressure*.65);
}

export function shouldSpawnWave({enabled=true,assetsReady=true,now=0,nextWaveAt=0,enemyCount=0,level=1}={}){
  if(!enabled||!assetsReady)return false;
  return now>=nextWaveAt&&enemyCount<softCapForLevel(level);
}

export function assertWaveState(){
  const s=createWaveState();
  if(s.hordeEnabled!==true||s.waveCount!==0)throw new Error('CAOS wave state invalid');
  if(softCapForLevel(1)!==94||!shouldSpawnWave({now:100,nextWaveAt:50,enemyCount:10,level:1}))throw new Error('CAOS wave behavior invalid');
  return true;
}
