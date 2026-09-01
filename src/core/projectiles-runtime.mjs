export function createProjectileState(){
  return {
    shotTimer:0,
    bullets:[],
    flashCounter:0,
    pierceShotCounter:0,
    iceShotCounter:0,
    explosiveShotCounter:0,
    ciShotsFired:0,
    ciShotsHit:0,
    ciShotsExpired:0,
    ciPierceShots:0,
    ciIceShots:0,
    ciExplosiveShots:0,
    ciLastShot:null
  };
}

export function assertProjectileState(){
  const s=createProjectileState();
  if(!Array.isArray(s.bullets)||s.shotTimer!==0||s.ciShotsFired!==0)throw new Error('CAOS projectile state invalid');
  return true;
}
