export const ENEMY_POOL=Object.freeze(['wraith','reaper','infected','crawler','eye','brute']);

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

export function waveSpawnCount(level,enemyCount,softCap=softCapForLevel(level)){
  const room=Math.max(0,Math.max(0,Number(softCap)||0)-Math.max(0,Number(enemyCount)||0));
  if(room<=0)return 0;
  return Math.min(room,Math.min(18,4+Math.floor((Number(level)||0)*.65)));
}

export function pickEnemyType(r=Math.random()){
  const value=Number.isFinite(r)?Math.max(0,Math.min(.9999999999999999,r)):0;
  return ENEMY_POOL[Math.floor(value*ENEMY_POOL.length)];
}

export function bossTypeForLevel(level){
  return (Math.floor((Number(level)||0)/10)%2)?'colossus':'voidlord';
}

export function assertWaveState(){
  const s=createWaveState();
  if(s.hordeEnabled!==true||s.waveCount!==0)throw new Error('CAOS wave state invalid');
  if(softCapForLevel(1)!==94||!shouldSpawnWave({now:100,nextWaveAt:50,enemyCount:10,level:1}))throw new Error('CAOS wave behavior invalid');
  if(waveSpawnCount(10,0)!==10||waveSpawnCount(1,94)!==0)throw new Error('CAOS wave spawn count invalid');
  if(pickEnemyType(0)!=='wraith'||pickEnemyType(.999999)!=='brute'||bossTypeForLevel(10)!=='colossus'||bossTypeForLevel(20)!=='voidlord')throw new Error('CAOS wave composition invalid');
  return true;
}
