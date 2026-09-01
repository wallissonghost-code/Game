export const ENEMY_LIMITS=Object.freeze({MAX_ENEMIES:320,GRID:64,CHUNK:640});

export function createEnemyState(){
  return {
    enemies:[],
    enemySpeed:1,
    autoTarget:null,
    autoTargetUntil:0
  };
}

export function assertEnemyState(){
  const s=createEnemyState();
  if(!Array.isArray(s.enemies)||s.enemySpeed!==1||ENEMY_LIMITS.MAX_ENEMIES!==320)throw new Error('CAOS enemy state invalid');
  return true;
}
