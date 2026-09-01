(()=>{'use strict';
const base=window.CaosNecromancerCompanion;
if(!base||base.__solidBodiesV2)return;
const originalApply=base.apply;
function apply(source){
  let out=originalApply(source);
  if(typeof out!=='string'||out.includes('CAOS_NECROMANCER_SOLID_BODY_V2'))return out;
  if(!out.includes('function updateNecromancer(dt){')||!out.includes('function drawEnemy(e,p){')||!out.includes('function drawOgreSkin(e,isBoss){'))return out;

  const physics=`/*CAOS_NECROMANCER_SOLID_BODY_V2*/
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

  // Invocação de boss não mostra nome/tier de inimigo.
  out=out.replace("if(isBoss){ctx.fillStyle='#fde68a';", "if(isBoss&&!e.necroAlly){ctx.fillStyle='#fde68a';");

  // Bosses usam packs assíncronos. Antes, uma direção vazia (ou pack ainda incompleto)
  // fazia drawOgreSkin retornar false e sobravam apenas HP + sombra verde na tela.
  // Para summon do Necromante: tenta qualquer direção válida do MESMO boss; se o pack
  // ainda não estiver pronto, usa Ogro base só como fallback transitório. Nunca fica invisível.
  const oldSelect="let dir=e.facing||'down';const arr=pack[dir]||pack.down||[];if(!ready||!arr.length)return false;let img=arr[(e.speedMul===0?0:Math.floor(e.t/(isBoss?.15:.135)))%arr.length]||pack.down[0];if(!img)return false;";
  const newSelect="let dir=e.facing||'down';let arr=(pack[dir]&&pack[dir].length)?pack[dir]:[];if(!arr.length){for(const k of['down','up','right','left']){if(pack[k]&&pack[k].length){arr=pack[k];break}}}let necroBossFallback=false;if(!arr.length&&isBoss&&e.necroAlly){const preferred=e.type==='voidlord'?bossVoidFrames:e.type==='colossus'?bossColossusFrames:(bossColossusReady?bossColossusFrames:bossVoidFrames);for(const k of[dir,'down','up','right','left']){if(preferred[k]&&preferred[k].length){arr=preferred[k];break}}if(!arr.length&&ogreReady){for(const k of[dir,'down','up','right','left']){if(ogreFrames[k]&&ogreFrames[k].length){arr=ogreFrames[k];necroBossFallback=true;break}}}}if(!arr.length)return false;let img=arr[(e.speedMul===0?0:Math.floor(e.t/(isBoss?.15:.135)))%arr.length]||arr[0];if(!img)return false;if(isBoss&&e.necroAlly){window.__caosNecromancerBossSkinRendered=(window.__caosNecromancerBossSkinRendered||0)+1;window.__caosNecromancerBossSkinFallback=!!necroBossFallback;}";
  if(out.includes(oldSelect))out=out.replace(oldSelect,newSelect);
  else console.warn('NECROMANCER: boss skin selector patch target not found');
  return out;
}
window.CaosNecromancerCompanion=Object.freeze({...base,apply,version:String(base.version||'0.3.0')+'+solid2',__solidBodiesV2:true});
})();