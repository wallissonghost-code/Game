(()=>{
'use strict';
const P=CanvasRenderingContext2D&&CanvasRenderingContext2D.prototype;
if(!P||window.__caosFxPerfGuard)return;
window.__caosFxPerfGuard=true;

let fps=60,frames=0,last=performance.now(),frameId=0,phoenixParticleSeq=0;
function tick(t){
  frameId++;frames++;
  if(t-last>=700){fps=Math.max(1,Math.round(frames*1000/(t-last)));frames=0;last=t;}
  phoenixParticleSeq=0;
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

const rawStroke=P.stroke,rawFill=P.fill;
P.stroke=function(...args){
  const mode=pressure(),c=normColor(this.shadowColor),old=this.shadowBlur;
  let changed=false;
  // Fúria pós-Boss / Berserker: o blur vermelho por mob é caro em hordas grandes.
  if(c==='#dc2626'&&old>0){
    this.shadowBlur=mode>=2?0:mode===1?Math.min(old,4):Math.min(old,10);
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
  // Partículas da Fênix: no modo econômico desenha ~1/3; no balanceado ~1/2.
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

window.CaosFxPerfGuard={get fps(){return fps},get pressure(){return pressure()},get mobs(){return mobCount()}};
})();
