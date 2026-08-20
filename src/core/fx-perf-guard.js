(()=>{
'use strict';
const P=globalThis.CanvasRenderingContext2D?.prototype;
if(!P||window.__caosFxPerfGuard)return;
window.__caosFxPerfGuard=true;
window.__caosFxPerfGuardVersion=3;

let fps=60,frames=0,last=performance.now();
let phoenixParticleSeq=0,furySeenAt=0;
let furyBadge=null;

function ensureFuryBadge(){
  if(furyBadge||!document.body)return furyBadge;
  furyBadge=document.createElement('div');
  furyBadge.id='caosFuryPerfBadge';
  furyBadge.textContent='😡 FÚRIA ATIVA';
  Object.assign(furyBadge.style,{
    position:'fixed',left:'50%',top:'82px',transform:'translateX(-50%)',zIndex:'12',
    display:'none',padding:'7px 12px',borderRadius:'999px',font:'900 10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    letterSpacing:'.07em',color:'#fecaca',background:'rgba(69,10,10,.78)',border:'1px solid rgba(239,68,68,.52)',
    boxShadow:'0 0 0 1px rgba(127,29,29,.18)',pointerEvents:'none'
  });
  document.body.appendChild(furyBadge);
  return furyBadge;
}
function noteFury(){
  furySeenAt=performance.now();
  ensureFuryBadge();
}
function tick(t){
  frames++;
  if(t-last>=700){fps=Math.max(1,Math.round(frames*1000/(t-last)));frames=0;last=t;}
  phoenixParticleSeq=0;
  if(furyBadge)furyBadge.style.display=(performance.now()-furySeenAt<220)?'block':'none';
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function mobCount(){
  const n=Number(document.getElementById('mobCount')?.textContent||0);
  return Number.isFinite(n)?n:0;
}
function pressure(){
  const mobs=mobCount();
  if(fps<42||mobs>=165)return 2;
  if(fps<54||mobs>=90)return 1;
  return 0;
}
function normColor(v){return String(v||'').replace(/\s+/g,'').toLowerCase();}

const rawStroke=P.stroke,rawFill=P.fill,rawFillText=P.fillText;

P.stroke=function(...args){
  const c=normColor(this.shadowColor),stroke=normColor(this.strokeStyle),old=this.shadowBlur;
  const width=Number(this.lineWidth)||0;

  // FÚRIA PÓS-BOSS: o estado continua aplicado a TODOS os mobs no gameplay,
  // porém a representação visual agora é apenas global. Nenhum mob recebe aura individual.
  // O conjunto exato abaixo identifica o anel de Fúria sem remover a aura Berserker do player.
  if(c==='#dc2626'&&stroke==='#ef4444'&&Math.abs(width-2.5)<.01){
    noteFury();
    return;
  }

  // FÊNIX: os dois anéis continuam visíveis, mas sem shadowBlur por frame.
  // Em aparelhos fracos o blur do Canvas era o principal pico de GPU no revive.
  if((c==='#f59e0b'||c==='#fb923c')&&this.globalCompositeOperation==='screen'&&old>0){
    this.shadowBlur=0;
    try{return rawStroke.apply(this,args)}finally{this.shadowBlur=old;}
  }

  return rawStroke.apply(this,args);
};

P.fill=function(...args){
  const mode=pressure(),c=normColor(this.shadowColor),old=this.shadowBlur;

  // FÊNIX: no máximo 2 partículas por frame; sob pressão fica apenas 1.
  // As partículas restantes são cosméticas e não alteram escudo, revive ou duração.
  if(c==='#fbbf24'&&this.globalCompositeOperation==='screen'){
    phoenixParticleSeq++;
    const cap=mode>=1?1:2;
    if(phoenixParticleSeq>cap)return;
    if(old>0){
      this.shadowBlur=0;
      try{return rawFill.apply(this,args)}finally{this.shadowBlur=old;}
    }
  }

  if((c==='#f59e0b'||c==='#fb923c')&&this.globalCompositeOperation==='screen'&&old>0){
    this.shadowBlur=0;
    try{return rawFill.apply(this,args)}finally{this.shadowBlur=old;}
  }

  return rawFill.apply(this,args);
};

P.fillText=function(text,...args){
  // Remove o texto repetido em cada mob. A informação é mostrada uma única vez no evento global.
  if(String(text)==='FÚRIA'){
    noteFury();
    return;
  }
  return rawFillText.call(this,text,...args);
};

window.CaosFxPerfGuard={
  version:3,
  get fps(){return fps},
  get pressure(){return pressure()},
  get mobs(){return mobCount()},
  furyVisualMode:'global-only',
  phoenixFxMode:'low-cost'
};
})();
