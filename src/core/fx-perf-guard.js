(()=>{
'use strict';
const P=globalThis.CanvasRenderingContext2D?.prototype;
if(!P||window.__caosFxPerfGuard)return;
window.__caosFxPerfGuard=true;
window.__caosFxPerfGuardVersion=2;

let fps=60,frames=0,last=performance.now();
let phoenixParticleSeq=0,furyStrokeSeq=0,furyTextSeq=0,furySeenAt=0;
let furyBadge=null;

function ensureFuryBadge(){
  if(furyBadge||!document.body)return furyBadge;
  furyBadge=document.createElement('div');
  furyBadge.id='caosFuryPerfBadge';
  furyBadge.textContent='😡 FÚRIA ATIVA';
  Object.assign(furyBadge.style,{
    position:'fixed',left:'50%',top:'82px',transform:'translateX(-50%)',zIndex:'12',
    display:'none',padding:'6px 10px',borderRadius:'999px',font:'900 10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
    letterSpacing:'.05em',color:'#fecaca',background:'rgba(69,10,10,.72)',border:'1px solid rgba(239,68,68,.45)',
    pointerEvents:'none',backdropFilter:'blur(4px)'
  });
  document.body.appendChild(furyBadge);
  return furyBadge;
}
function tick(t){
  frames++;
  if(t-last>=700){fps=Math.max(1,Math.round(frames*1000/(t-last)));frames=0;last=t;}
  phoenixParticleSeq=0;furyStrokeSeq=0;furyTextSeq=0;
  const b=furyBadge;
  if(b)b.style.display=(performance.now()-furySeenAt<220)?'block':'none';
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
function furyLimit(mode){return mode>=2?8:mode===1?20:Infinity;}
function noteFury(mode){
  furySeenAt=performance.now();
  if(mode>0)ensureFuryBadge();
}

const rawStroke=P.stroke,rawFill=P.fill,rawFillText=P.fillText;
P.stroke=function(...args){
  const mode=pressure(),c=normColor(this.shadowColor),old=this.shadowBlur;
  let changed=false;

  // Fúria pós-Boss: todos os mobs continuam buffados, mas só uma amostra visual recebe aura.
  // Isso elimina centenas de arcs + shadowBlur por frame em hordas grandes.
  if(c==='#dc2626'&&old>0){
    noteFury(mode);
    furyStrokeSeq++;
    if(furyStrokeSeq>furyLimit(mode))return;
    this.shadowBlur=mode>=2?0:mode===1?Math.min(old,3):Math.min(old,10);
    changed=true;
  }

  // Fênix: mantém os anéis, mas reduz o glow quando o aparelho entra em pressão.
  if((c==='#f59e0b'||c==='#fb923c')&&this.globalCompositeOperation==='screen'&&old>0){
    this.shadowBlur=mode>=2?4:mode===1?Math.min(old,8):Math.min(old,18);
    changed=true;
  }
  try{return rawStroke.apply(this,args)}finally{if(changed)this.shadowBlur=old;}
};

P.fill=function(...args){
  const mode=pressure(),c=normColor(this.shadowColor),old=this.shadowBlur;
  let changed=false;
  // Partículas da Fênix: no econômico desenha ~1/3; no balanceado ~1/2.
  if(c==='#fbbf24'&&this.globalCompositeOperation==='screen'){
    phoenixParticleSeq++;
    if(mode>=2&&phoenixParticleSeq%3!==0)return;
    if(mode===1&&phoenixParticleSeq%2===0)return;
    if(old>0){this.shadowBlur=mode>=2?2:mode===1?5:Math.min(old,10);changed=true;}
  }else if((c==='#f59e0b'||c==='#fb923c')&&this.globalCompositeOperation==='screen'&&old>0){
    this.shadowBlur=mode>=2?3:mode===1?6:Math.min(old,14);changed=true;
  }
  try{return rawFill.apply(this,args)}finally{if(changed)this.shadowBlur=old;}
};

P.fillText=function(text,...args){
  const mode=pressure();
  if(String(text)==='FÚRIA'&&mode>0){
    noteFury(mode);
    furyTextSeq++;
    if(furyTextSeq>furyLimit(mode))return;
  }
  return rawFillText.call(this,text,...args);
};

window.CaosFxPerfGuard={
  version:2,
  get fps(){return fps},
  get pressure(){return pressure()},
  get mobs(){return mobCount()},
  get furyVisualCap(){return furyLimit(pressure())}
};
})();
