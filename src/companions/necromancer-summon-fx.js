(()=>{'use strict';
const base=window.CaosNecromancerCompanion;
if(!base||base.__summonFxV3)return;
const originalApply=base.apply;
function apply(source){
  let out=originalApply(source);
  if(typeof out!=='string'||out.includes('CAOS_NECROMANCER_SUMMON_FX_V3'))return out;
  if(!out.includes('function drawNecromancer(){')||!out.includes('function necroForcedRaise('))return out;

  const fx=`/*CAOS_NECROMANCER_SUMMON_FX_V3*/
function necroRiseDuration(s){
  const crowded=enemies.length>85||perfMode==='low';
  if(crowded)return s.necroBoss?900:560;
  return s.necroBoss?1400:820;
}
function necroIdleDuration(s){return s.necroBoss?1200:760}
function necroRiseProgress(s,now=performance.now()){
  const born=Number(s.necroBorn)||now,dur=Math.max(1,necroRiseDuration(s)),raw=(now-born)/dur;
  return Number.isFinite(raw)?necroClamp(raw,0,1):1;
}
function necroInIntro(s,now=performance.now()){
  return now-(Number(s.necroBorn)||now)<necroRiseDuration(s)+necroIdleDuration(s);
}
function necroOutwardFacing(angle){
  const x=Math.cos(angle),y=Math.sin(angle);
  return Math.abs(x)>Math.abs(y)?(x>=0?'right':'left'):(y>=0?'down':'up');
}
function necroDrawRiseGround(s,p,t){
  const r=Math.max(16,(s.r||14)*(s.necroBoss?1.48:1.24));
  const pulse=Math.sin(Math.min(1,t)*Math.PI),scale=.58+t*.48+pulse*.05;
  ctx.save();
  ctx.globalAlpha=.72+.22*pulse;
  ctx.fillStyle='#000000';
  ctx.beginPath();
  ctx.ellipse(p.x,p.y+(s.r||14)*.72,r*scale,r*.31*scale,0,0,Math.PI*2);
  ctx.fill();
  if(enemies.length<86&&perfMode!=='low'){
    ctx.globalAlpha=.18+.12*pulse;
    ctx.strokeStyle='#07100c';
    ctx.lineWidth=Math.max(1,Math.min(2,(s.r||14)*.075));
    ctx.beginPath();
    ctx.ellipse(p.x,p.y+(s.r||14)*.72,r*(scale+.10),r*.35*(scale+.10),0,0,Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
}
function necroDrawRisingMob(s,p,t){
  if(!(t>=0&&t<1)){drawEnemy(s,p);return}
  const ease=1-Math.pow(1-t,3);
  const visualH=Math.max(70,(s.r||14)*(s.necroBoss?7.2:5.2));
  const groundY=p.y+(s.r||14)*.74;
  const sink=(1-ease)*visualH*.94;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-W*2,-H*2,W*5,groundY+H*2);
  ctx.clip();
  ctx.globalAlpha=.34+.66*ease;
  ctx.translate(0,sink);
  drawEnemy(s,p);
  ctx.restore();
  window.__caosNecromancerRiseFrames=(window.__caosNecromancerRiseFrames||0)+1;
}
function drawNecromancer(){
  if(!necroSummons.length)return;
  const now=performance.now();
  for(const s of necroSummons){
    const p=world(s.x,s.y),t=necroRiseProgress(s,now);
    if(t<1){
      necroDrawRiseGround(s,p,t);
      necroDrawRisingMob(s,p,t);
    }else{
      drawEnemy(s,p);
      if(!s.necroRiseDone){s.necroRiseDone=true;window.__caosNecromancerRiseCompleted=(window.__caosNecromancerRiseCompleted||0)+1}
      if(necroInIntro(s,now))window.__caosNecromancerIdleFrames=(window.__caosNecromancerIdleFrames||0)+1;
    }
  }
}
`;
  const start=out.indexOf('function drawNecromancer(){');
  const end=out.indexOf('function necroForcedRaise(',start);
  if(start<0||end<0)return out;
  out=out.slice(0,start)+fx+out.slice(end);

  out=out.replace('spawnDist=nearPlayer?110+slot*8:0,spawnX=nearPlayer?player.x+Math.cos(angle)*spawnDist:e.x,spawnY=nearPlayer?player.y+Math.sin(angle)*spawnDist:e.y,',
    'spawnDist=104+slot*10,spawnX=player.x+Math.cos(angle)*spawnDist,spawnY=player.y+Math.sin(angle)*spawnDist,');

  out=out.replace("facing:e.facing||'down'","facing:necroOutwardFacing(angle)");

  const updateNeedle='for(const s of necroSummons){if(s.dead)continue;s.t+=dt;';
  if(out.includes(updateNeedle))out=out.replace(updateNeedle,"for(const s of necroSummons){if(s.dead)continue;s.t+=dt;if(necroInIntro(s,performance.now())){s.speedMul=performance.now()-(s.necroBorn||0)<necroRiseDuration(s)?0:.28;continue}");
  return out;
}
window.CaosNecromancerCompanion=Object.freeze({...base,apply,version:String(base.version||'0.3.0')+'+summonfx3',__summonFxV3:true});
})();
