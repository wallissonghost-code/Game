(()=>{'use strict';
const base=window.CaosNecromancerCompanion;
if(!base||base.__solidBodiesV1)return;
const originalApply=base.apply;
function apply(source){
  let out=originalApply(source);
  if(typeof out!=='string'||out.includes('CAOS_NECROMANCER_SOLID_BODY_V1'))return out;
  if(!out.includes('function updateNecromancer(dt){')||!out.includes('function drawEnemy(e,p){'))return out;

  const physics=`/*CAOS_NECROMANCER_SOLID_BODY_V1*/
function necroResolvePlayerBodyCollision(){
  for(const s of necroSummons){
    if(!s||s.dead)continue;
    const boss=!!s.necroBoss||!!types[s.type]?.boss;
    const bodyR=Math.max(s.r||14,boss?(s.r||14)*1.12:(s.r||14));
    const min=player.r+bodyR+(boss?10:4);
    let dx=player.x-s.x,dy=player.y-s.y,d=Math.hypot(dx,dy);
    if(d>=min)continue;
    if(d<.001){const a=((Number(String(s.id).replace('necro-',''))||1)*2.399963);dx=Math.cos(a);dy=Math.sin(a);d=1}
    const push=min-d,nx=dx/d,ny=dy/d;
    // Invocação é corpo sólido: o player sai da interseção; a sombra não é empurrada.
    player.x+=nx*push;
    player.y+=ny*push;
    if(player.moving){
      const inward=player.moveX*nx+player.moveY*ny;
      if(inward<0){player.moveX-=nx*inward;player.moveY-=ny*inward}
    }
  }
}
`;
  out=out.replace('function updateNecromancer(dt){',physics+'function updateNecromancer(dt){');
  out=out.replace(' necroSeparateSummons();\n for(const e of enemies){',' necroSeparateSummons();necroResolvePlayerBodyCollision();\n for(const e of enemies){');

  // Boss invocado mantém skin e barra, mas não exibe nome/tier acima da cabeça.
  out=out.replace("if(isBoss){ctx.fillStyle='#fde68a';", "if(isBoss&&!e.necroAlly){ctx.fillStyle='#fde68a';");
  return out;
}
window.CaosNecromancerCompanion=Object.freeze({...base,apply,version:String(base.version||'0.3.0')+'+solid1',__solidBodiesV1:true});
})();