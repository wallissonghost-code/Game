(()=>{'use strict';
const NativeBlob=window.Blob;
if(typeof NativeBlob!=='function'||window.__caosLivePlusRuntimeHook)return;
window.__caosLivePlusRuntimeHook=true;

function patchFollowHud(){
  const root=document.getElementById('livePlusBattleHud');
  if(!root)return;
  let rules=[];
  try{rules=JSON.parse(localStorage.getItem('caos-liveplus-hud-rules')||'[]')}catch{}
  const manifest=window.CaosLivePlus?.manifest,actions=Array.isArray(manifest?.actions)?manifest.actions:[];
  const follow=rules.find(r=>{
    if(r?.trigger!=='follow')return false;
    const a=actions.find(x=>x.id===r.actionId);
    return a?.hudSide==='player'||a?.donationGroup==='player';
  });
  const grid=root.querySelector('.lpSide.player .lpGiftGrid');
  if(!grid||!follow)return;
  if(grid.querySelector('[data-liveplus-follow-slot="1"]'))return;
  const empty=grid.querySelector('.lpGift.lpEmpty');
  if(!empty)return;
  const seconds=Math.max(1,Number(follow?.actionParams?.seconds)||8);
  const action=actions.find(a=>a.id===follow.actionId);
  const label=follow.actionId==='ghostally'?`Aliado Fantasma ${String(seconds).replace('.0','')}s`:(follow.actionLabel||action?.label||'Ação do player');
  empty.classList.remove('lpEmpty');
  empty.dataset.liveplusFollowSlot='1';
  empty.innerHTML='<div class="lpGiftMissing">👤</div><div class="lpGiftCopy"><b>NOVO SEGUIDOR</b><small>'+String(label).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</small></div>';
}
const hudObserver=new MutationObserver(()=>queueMicrotask(patchFollowHud));
document.addEventListener('DOMContentLoaded',()=>{hudObserver.observe(document.body,{childList:true,subtree:true});patchFollowHud()},{once:true});

window.Blob=new Proxy(NativeBlob,{construct(Target,args,newTarget){
  const parts=Array.isArray(args?.[0])?args[0]:[],options=args?.[1]||{};
  const type=String(options?.type||'').toLowerCase();
  if(type.includes('javascript')&&parts.some(p=>typeof p==='string'&&p.includes('function command(d){'))){
    args=[parts.map(part=>{
      if(typeof part!=='string'||!part.includes('function command(d){')||!part.includes('const SPATIAL=96;'))return part;
      let out=part;
      if(!out.includes('window.CaosLiveCommand=command;'))out=out.replace('const SPATIAL=96;','window.CaosLiveCommand=command;const SPATIAL=96;');
      if(!out.includes('LIVEPLUS_SKILLRESET_UNFREEZE')){
        out=out.replace("if(c==='skillreset'){adminSkillReset();toast('🧪 HABILIDADES RESETADAS')}","if(c==='skillreset'){/*LIVEPLUS_SKILLRESET_UNFREEZE*/adminSkillReset();choosing=false;const sp=$('skillPick');if(sp)sp.classList.remove('show');pierceShotCounter=iceShotCounter=explosiveShotCounter=0;clearAutoTarget();last=performance.now();toast('🧪 HABILIDADES RESETADAS')}");
      }
      const companion=window.CaosGhostAllyCompanion;
      if(companion&&typeof companion.apply==='function')out=companion.apply(out);
      const necromancer=window.CaosNecromancerCompanion;
      if(necromancer&&typeof necromancer.apply==='function')out=necromancer.apply(out);
      if(!out.includes('LIVEPLUS_METEOR_DODGE')&&out.includes('function autoVector(dt){')){
        const inject=`function autoVector(dt){/*LIVEPLUS_METEOR_DODGE*/
  const activeMeteors=meteors.filter(m=>!m.hit&&m.warningLeft>0);
  if(activeMeteors.length){
    const threats=activeMeteors.filter(m=>{const d=Math.hypot(player.x-m.x,player.y-m.y),margin=player.r+44,windowSec=Math.max(1.15,(m.warningTotal||m.warningLeft)*.92);return d<m.r+margin&&m.warningLeft<=windowSec});
    if(threats.length){
      const now=performance.now(),hold=autoVector.__meteorEscape;
      if(!hold||now>=hold.until){
        let bestX=0,bestY=0,bestScore=-Infinity;const prevX=hold?.x||autoMoveX||0,prevY=hold?.y||autoMoveY||0;
        for(let i=0;i<20;i++){
          const a=i*Math.PI*2/20,cx=Math.cos(a),cy=Math.sin(a),probe=155,px=player.x+cx*probe,py=player.y+cy*probe;let score=0,minClear=Infinity;
          for(const m of activeMeteors){const urgency=1/Math.max(.18,m.warningLeft),clear=Math.hypot(px-m.x,py-m.y)-m.r;minClear=Math.min(minClear,clear);score+=Math.min(180,clear)*urgency*.72;if(clear<player.r+18)score-=900+(player.r+18-clear)*20}
          for(const e of enemies){if(e.dead)continue;const d=Math.hypot(px-e.x,py-e.y),boss=!!types[e.type]?.boss,avoid=(boss?260:150)+e.r;if(d<avoid)score-=(avoid-d)*(boss?5.2:2.1)}
          score+=Math.max(-1,Math.min(1,cx*prevX+cy*prevY))*34;if(minClear>player.r+52)score+=85;
          if(score>bestScore){bestScore=score;bestX=cx;bestY=cy}
        }
        autoVector.__meteorEscape={x:bestX,y:bestY,until:now+230};
      }
      const esc=autoVector.__meteorEscape||{x:0,y:0},blend=1-Math.exp(-dt*13);autoMoveX=autoMoveX*(1-blend)+esc.x*blend;autoMoveY=autoMoveY*(1-blend)+esc.y*blend;const n=Math.hypot(autoMoveX,autoMoveY)||1;autoMoveX/=n;autoMoveY/=n;autoMoveStrength+=(1-autoMoveStrength)*(1-Math.exp(-dt*14));autoRetreatActive=true;return{x:autoMoveX*autoMoveStrength,y:autoMoveY*autoMoveStrength};
    }
    autoVector.__meteorEscape=null;
  }else autoVector.__meteorEscape=null;`;
        out=out.replace('function autoVector(dt){',inject);
      }
      return out;
    }),options];
  }
  return Reflect.construct(Target,args,newTarget===window.Blob?Target:newTarget);
}});
})();