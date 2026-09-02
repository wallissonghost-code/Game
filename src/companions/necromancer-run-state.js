(()=>{'use strict';
const base=window.CaosNecromancerCompanion;
if(!base||base.__runStateV1)return;
const originalApply=base.apply;
function apply(source){
  let out=originalApply(source);
  if(typeof out!=='string'||out.includes('CAOS_NECROMANCER_RUN_STATE_V1'))return out;
  const needle="function necroClearArmy(reason='reset'){";
  if(!out.includes(needle))return out;
  out=out.replace(needle,`/*CAOS_NECROMANCER_RUN_STATE_V1*/\nfunction necroClearArmy(reason='reset'){\n  necroEnabled=false;`);
  return out;
}
window.CaosNecromancerCompanion=Object.freeze({...base,apply,version:String(base.version||'0.3.0')+'+runstate1',__runStateV1:true});
})();
