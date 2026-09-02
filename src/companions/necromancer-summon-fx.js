(()=>{'use strict';
const base=window.CaosNecromancerCompanion;
if(!base||base.__summonFxV1)return;
const originalApply=base.apply;
function apply(source){
  let out=originalApply(source);
  if(typeof out!=='string'||out.includes('CAOS_NECROMANCER_SUMMON_FX_V1'))return out;
  if(!out.includes('function drawNecromancer(){')||!out.includes('function necroForcedRaise('))return out;

  const fx=`/*CAOS_NECROMANCER_SUMMON_FX_V1*/
function necroRiseDuration(s){
  const crowded=enemies.length>85||perfMode==='low';
  if(crowded)return s.necroBoss?900:560;
  return s.necroBoss?1400:820;
}
function necroRiseProgress(s,now=performance.now()){
  return necroClamp((now-(s.necroBorn||now))/necroRiseDuration(s),0,1);
}
function necroDrawRiseGround(s,p,t){
  const r=Math.max(16,(s.r||14)*(s.necroBoss?1.48:1.24));
  const pulse=Math.sin(Math.min(1,t)*Math.PI);
  const scale=.58+t*.48+pulse*.05;
  ctx.save();
  ctx.globalAlpha=.18+.50*pulse;
  ctx.fillStyle='#020504';
  ctx.beginPath();
  ctx.ellipse(p.x,p.y+(s.r||14)*.62,r*scale,r*.32*scale,0,0,Math.PI*2);
  ctx.fill();
  if(enemies.length<86&&perfMode!=='low'){
    ctx.globalAlpha=.10+.20*pulse;
    ctx.strokeStyle='#17382c';
    ctx.lineWidth=Math.max(1,Math.min(2.2,(s.r||14)*.08));
    ctx.beginPath();
    ctx.ellipse(p.x,p.y+(s.r||14)*.62,r*(scale+.12),r*.36*(scale+.12),0,0,Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}
function necroDrawRisingMob(s,p,t){
  const ease=1-Math.pow(1-t,3),height=Math.max(62,(s.r||14)*(s.necroBoss?5.5:4.1));
  const rise=(1-ease)*Math.min(height*.58,72);
  const reveal=Math.max(5,height*ease);
  ctx.save();
  ctx.beginPath();
  ctx.rect(p.x-height*1.4,p.y+height*.58-reveal,height*2.8,reveal+height*.28);
  ctx.clip();
  ctx.globalAlpha=.28+.72*ease;
  ctx.translate(0,rise);
  drawEnemy(s,p);
  ctx.restore();
  window.__caosNecromancerRiseFrames=(window.__caosNecromancerRiseFrames||0)+1;
}
function drawNecromancer(){
  if(!necroSummons.length)return;
  const now=performance.now();
  for(const s of necroSummons){
    const p=world(s.x,s.y),t=necroRiseProgress(s,now);
    if(t<1){necroDrawRiseGround(s,p,t);necroDrawRisingMob(s,p,t)}
    else{drawEnemy(s,p);if(!s.necroRiseDone){s.necroRiseDone=true;window.__caosNecromancerRiseCompleted=(window.__caosNecromancerRiseCompleted||0)+1}}
  }
}
`;
  const start=out.indexOf('function drawNecromancer(){');
  const end=out.indexOf('function necroForcedRaise(',start);
  if(start<0||end<0)return out;
  out=out.slice(0,start)+fx+out.slice(end);

  const updateNeedle='for(const s of necroSummons){if(s.dead)continue;s.t+=dt;';
  if(out.includes(updateNeedle))out=out.replace(updateNeedle,"for(const s of necroSummons){if(s.dead)continue;s.t+=dt;if(performance.now()-(s.necroBorn||0)<necroRiseDuration(s)){s.speedMul=0;continue}");
  return out;
}
window.CaosNecromancerCompanion=Object.freeze({...base,apply,version:String(base.version||'0.3.0')+'+summonfx1',__summonFxV1:true});
})();
