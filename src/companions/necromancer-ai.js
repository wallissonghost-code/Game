(()=>{'use strict';
const base=window.CaosNecromancerCompanion;
if(!base||base.__guardZoneAI)return;
const originalApply=base.apply;
function apply(source){
  let out=originalApply(source);
  if(typeof out!=='string'||out.includes('CAOS_NECROMANCER_GUARD_ZONE_AI_V2'))return out;
  if(!out.includes('function necroNearestEnemy(s){')||!out.includes('function updateNecromancer(dt){'))return out;

  const helper=`/*CAOS_NECROMANCER_GUARD_ZONE_AI_V2*/
const NECRO_GUARD_AI=Object.freeze({
  normal:{guard:160,search:500,leash:680,returnSpeed:92},
  boss:{guard:210,search:560,leash:760,returnSpeed:82}
});
function necroGuardProfile(s){return s?.necroBoss?NECRO_GUARD_AI.boss:NECRO_GUARD_AI.normal}
function necroGuardPoint(s){
  const seq=Math.max(1,Number(String(s.id).replace('necro-',''))||1),count=Math.max(1,necroConfig.maxSummons||1),p=necroGuardProfile(s);
  const angle=-Math.PI/2+((seq-1)%count)*(Math.PI*2/count);
  return{x:player.x+Math.cos(angle)*p.guard,y:player.y+Math.sin(angle)*p.guard};
}
function necroEnemyInsideLeash(e,s){
  if(!e||e.dead||!(e.hp>0)||!enemies.includes(e))return false;
  const p=necroGuardProfile(s),dp=Math.hypot(e.x-player.x,e.y-player.y);
  return dp<=p.leash;
}
`;
  out=out.replace('function necroNearestEnemy(s){',helper+'function necroNearestEnemy(s){');

  out=out.replace(/function necroNearestEnemy\(s\)\{[\s\S]*?\}function necroEnemyTarget/,
`function necroNearestEnemy(s){
  const profile=necroGuardProfile(s),locked=s.necroDuelTarget;
  if(locked&&necroEnemyInsideLeash(locked,s))return locked;
  if(locked)necroReleaseDuel(s);
  let best=null,bestScore=Infinity;
  for(const e of enemies){
    if(!e||e.dead||!(e.hp>0))continue;
    const holder=necroShadowById(e.necroDuelShadowId);if(holder&&holder!==s)continue;
    const dp=Math.hypot(e.x-player.x,e.y-player.y);if(dp>profile.search)continue;
    const ds=Math.hypot(e.x-s.x,e.y-s.y);if(ds>profile.search+180)continue;
    const boss=!!types[e.type]?.boss;
    const score=dp*.72+ds*.28-(boss?28:0);
    if(score<bestScore){best=e;bestScore=score}
  }
  return best;
}function necroEnemyTarget`);

  const oldIdle="}else{const seq=Number(String(s.id).replace('necro-',''))||1,a=seq*Math.PI*.75,tx=player.x+Math.cos(a)*105,ty=player.y+Math.sin(a)*105,dx=tx-s.x,dy=ty-s.y,d=Math.hypot(dx,dy)||1;if(d>22){s.x+=dx/d*75*dt;s.y+=dy/d*75*dt}}}";
  const newIdle="}else{const gp=necroGuardPoint(s),dx=gp.x-s.x,dy=gp.y-s.y,d=Math.hypot(dx,dy)||1,p=necroGuardProfile(s);if(d>26){s.facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');s.speedMul=1;s.x+=dx/d*p.returnSpeed*dt;s.y+=dy/d*p.returnSpeed*dt}else s.speedMul=0}}";
  if(out.includes(oldIdle))out=out.replace(oldIdle,newIdle);else console.warn('NECROMANCER AI: idle formation target not found');

  return out;
}
window.CaosNecromancerCompanion=Object.freeze({...base,apply,version:String(base.version||'0.3.0')+'+guardai2',__guardZoneAI:true});
})();
