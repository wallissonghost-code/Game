export function createWaveState(){
  return {
    spawnTimer:0,
    hordeEnabled:true,
    waveCount:0,
    nextWaveAt:0,
    bossFuryCount:0
  };
}

export function assertWaveState(){
  const s=createWaveState();
  if(s.hordeEnabled!==true||s.waveCount!==0)throw new Error('CAOS wave state invalid');
  return true;
}
