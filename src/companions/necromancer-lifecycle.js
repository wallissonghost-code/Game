(()=>{'use strict';
const base=window.CaosNecromancerCompanion;
if(!base||base.__lifecycleV1)return;
const originalApply=base.apply;
function apply(source){
  let out=originalApply(source);
  if(typeof out!=='string'||out.includes('CAOS_NECROMANCER_LIFECYCLE_V1'))return out;
  if(!out.includes('function updateNecromancer(dt){')||!out.includes('function reset(){')||!out.includes('function beginDeath(e){'))return out;

  const lifecycle=`/*CAOS_NECROMANCER_LIFECYCLE_V1*/
let necroRunEnded=false,necroResumeGuardAt=0;
function necroClearArmy(reason='reset'){
  for(const s of necroSummons)necroReleaseDuel(s);
  for(const e of enemies)if(e&&e.necroDuelShadowId)delete e.necroDuelShadowId;
  necroSummons=[];
  necroKillMeter=0;
  necroSeq=0;
  necroSoulLevel=1;
  necroSoulXp=0;
  necroSoulPoints=0;
  necroSoulKills=0;
  necroUpgrades={life:0,damage:0,regen:0,armor:0};
  necroRefreshHud(true);
  return reason;
}
function necroValidateDuels(){
  for(const s of necroSummons){
    if(!s||s.dead)continue;
    const t=s.necroDuelTarget;
    if(t&&(!enemies.includes(t)||t.dead||!(t.hp>0)))necroReleaseDuel(s);
  }
  for(const e of enemies){
    if(!e||e.dead||!e.necroDuelShadowId)continue;
    if(!necroShadowById(e.necroDuelShadowId))delete e.necroDuelShadowId;
  }
}
function necroOnResume(){
  if(document.hidden)return;
  necroValidateDuels();
  const now=performance.now();
  necroResumeGuardAt=now+220;
  for(const s of necroSummons){
    if(!s||s.dead)continue;
    s.necroNextAttack=Math.max(s.necroNextAttack||0,now+120);
  }
  last=now;
}
if(!window.__caosNecroLifecycleVisibility){
  window.__caosNecroLifecycleVisibility=true;
  document.addEventListener('visibilitychange',necroOnResume,{passive:true});
  window.addEventListener('pageshow',necroOnResume,{passive:true});
}
`;
  out=out.replace('function updateNecromancer(dt){',lifecycle+`function updateNecromancer(dt){
 dt=Math.min(.033,Math.max(0,Number(dt)||0));
 if(deathState){if(!necroRunEnded){necroClearArmy('death');necroRunEnded=true}return}
 if(necroRunEnded)necroRunEnded=false;
 necroValidateDuels();`);

  out=out.replace('function reset(){','function reset(){necroClearArmy(\'new-run\');necroRunEnded=false;');
  out=out.replace("function beginDeath(e){if(deathState)return;","function beginDeath(e){if(deathState)return;necroClearArmy('death');necroRunEnded=true;");
  out=out.replace('const locked=s.necroDuelTarget;if(locked&&!locked.dead&&locked.hp>0)return locked;','const locked=s.necroDuelTarget;if(locked&&enemies.includes(locked)&&!locked.dead&&locked.hp>0)return locked;');
  return out;
}
window.CaosNecromancerCompanion=Object.freeze({...base,apply,version:String(base.version||'0.3.0')+'+lifecycle1',__lifecycleV1:true});
})();
