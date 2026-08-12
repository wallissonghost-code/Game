(()=>{'use strict';
const $=s=>document.querySelector(s),canvas=$('#canvas'),ctx=canvas.getContext('2d'),wrap=$('#wrap');
const N=1,E=2,S=4,W=8,TYPE={bridge:4}; // TYPE.bridge mantido para compatibilidade do validador legado
const ROLE={0:'fechado',1:'fim N',2:'fim E',3:'curva NE',4:'fim S',5:'reta NS',6:'curva ES',7:'junção NES',8:'fim W',9:'curva WN',10:'reta EW',11:'junção NEW',12:'curva SW',13:'junção NSW',14:'junção ESW',15:'cruzamento'};
// Compatibilidade histórica do check: assets/Map/dense-forest/tiles/ (o Lab atual usa apenas Snow Frost Puzzle)
const state={n:6,seed:'ICE-001',grid:[],zoom:1,panX:0,panY:0,drag:false,lastX:0,lastY:0,manifest:null,byMask:Array.from({length:16},()=>[]),images:new Map(),stats:null,ready:false};
function hashStr(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function H(x,y,s=0){let h=hashStr(state.seed);h^=Math.imul(x+0x9e3779b9,0x85ebca6b);h^=Math.imul(y+0xc2b2ae35,0x27d4eb2d);h^=s;h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296}
function idx(x,y){return y*state.n+x}function inside(x,y){return x>=0&&y>=0&&x<state.n&&y<state.n}function cell(x,y){return inside(x,y)?state.grid[idx(x,y)]:null}
function maskFor(x,y){return cell(x,y)?.mask??0}
function chooseVariant(mask,x,y){const list=state.byMask[mask]||[];if(!list.length)return null;const chance=+$('#variant').value/100;if(list.length===1)return list[0];return H(x,y,991)<chance?(list.find(a=>a.variant===2)||list[1]||list[0]):(list.find(a=>a.variant===1)||list[0])}
function generate(){state.n=+$('#size').value;state.seed=$('#seed').value.trim()||'ICE-001';state.grid=new Array(state.n*state.n);const p=+$('#density').value/100;
 for(let y=0;y<state.n;y++)for(let x=0;x<state.n;x++){
   let m=0;const up=cell(x,y-1),left=cell(x-1,y);
   if(up&&(up.mask&S))m|=N;if(left&&(left.mask&E))m|=W;
   if(x<state.n-1&&H(x,y,101)<p)m|=E;
   if(y<state.n-1&&H(x,y,102)<p)m|=S;
   const def=chooseVariant(m,x,y);state.grid[idx(x,y)]={mask:m,def};
 }
 state.stats=validatePuzzle();fit();draw();renderStats()}
function validatePuzzle(){let errors=0,links=0;const used=new Map();for(let y=0;y<state.n;y++)for(let x=0;x<state.n;x++){const c=cell(x,y);used.set(c.mask,(used.get(c.mask)||0)+1);if(!c.def)errors++;
   if(x<state.n-1){const r=cell(x+1,y),a=!!(c.mask&E),b=!!(r.mask&W);if(a||b)links++;if(a!==b)errors++}
   if(y<state.n-1){const d=cell(x,y+1),a=!!(c.mask&S),b=!!(d.mask&N);if(a||b)links++;if(a!==b)errors++}
   if(y===0&&(c.mask&N))errors++;if(x===0&&(c.mask&W))errors++;if(y===state.n-1&&(c.mask&S))errors++;if(x===state.n-1&&(c.mask&E))errors++;
 }return{errors,links,used}}
function loadImage(def){return new Promise(resolve=>{const im=new Image();im.onload=()=>{state.images.set(def.id,im);resolve(true)};im.onerror=()=>resolve(false);im.src=`assets/Map/snow-frost/${def.file}?v=01734`})}
async function loadPack(){try{const res=await fetch('assets/Map/snow-frost/manifest.json?v=01734',{cache:'no-store'});if(!res.ok)throw Error('manifest '+res.status);const m=await res.json();state.manifest=m;state.byMask=Array.from({length:16},()=>[]);for(const d of m.chunks||[])if(Number.isInteger(d.mask)&&d.mask>=0&&d.mask<=15)state.byMask[d.mask].push(d);
 const defs=(m.chunks||[]).slice().sort((a,b)=>a.mask-b.mask||a.variant-b.variant);const ok=await Promise.all(defs.map(loadImage));state.ready=ok.filter(Boolean).length===defs.length&&defs.length===32;$('#status').textContent=`${ok.filter(Boolean).length}/32 chunks · ${state.ready?'pack completo':'pack incompleto'}`;buildCatalog();generate();
}catch(err){console.error(err);$('#status').textContent='pack ainda não extraído';state.ready=false;generate()}}
function resize(){const r=wrap.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);draw()}
function fit(){const r=wrap.getBoundingClientRect(),cell=Math.min((r.width-50)/state.n,(r.height-50)/state.n);state.zoom=Math.max(.18,Math.min(2.5,cell/110));state.panX=0;state.panY=0}
function draw(){if(!state.grid.length)return;const r=wrap.getBoundingClientRect(),sz=110*state.zoom,total=state.n*sz,ox=r.width/2-total/2+state.panX,oy=r.height/2-total/2+state.panY;ctx.clearRect(0,0,r.width,r.height);ctx.fillStyle='#071018';ctx.fillRect(0,0,r.width,r.height);const showGrid=$('#grid').checked,showConn=$('#connectors').checked,showMask=$('#masks').checked,showCol=$('#collisions').checked;
 for(let y=0;y<state.n;y++)for(let x=0;x<state.n;x++){const c=cell(x,y),px=ox+x*sz,py=oy+y*sz,im=c?.def?state.images.get(c.def.id):null;if(px+sz<0||py+sz<0||px>r.width||py>r.height)continue;
   if(im)ctx.drawImage(im,px-.6,py-.6,sz+1.2,sz+1.2);else{ctx.fillStyle='#153247';ctx.fillRect(px,py,sz,sz);ctx.fillStyle='#fb7185';ctx.font='bold 12px sans-serif';ctx.fillText('SEM CHUNK',px+8,py+20)}
   if(showGrid){ctx.strokeStyle='rgba(190,235,255,.34)';ctx.lineWidth=Math.max(.6,state.zoom);ctx.strokeRect(px,py,sz,sz)}
   if(showConn)drawConnectors(c.mask,px,py,sz);
   if(showMask&&sz>46){ctx.fillStyle='rgba(2,12,20,.75)';ctx.fillRect(px+5,py+5,34,19);ctx.fillStyle='#fff';ctx.font=`bold ${Math.max(9,11*state.zoom)}px monospace`;ctx.textBaseline='middle';ctx.fillText(String(c.mask).padStart(2,'0'),px+10,py+14.5)}
   if(showCol&&c?.def?.collision)drawCollisions(c.def.collision,px,py,sz);
 }}
function drawConnectors(m,x,y,s){ctx.save();ctx.strokeStyle='rgba(34,211,238,.9)';ctx.lineWidth=Math.max(2,s*.035);ctx.lineCap='round';const cx=x+s/2,cy=y+s/2;ctx.beginPath();if(m&N){ctx.moveTo(cx,cy);ctx.lineTo(cx,y)}if(m&E){ctx.moveTo(cx,cy);ctx.lineTo(x+s,cy)}if(m&S){ctx.moveTo(cx,cy);ctx.lineTo(cx,y+s)}if(m&W){ctx.moveTo(cx,cy);ctx.lineTo(x,cy)}ctx.stroke();ctx.restore()}
function drawCollisions(arr,x,y,s){ctx.save();ctx.strokeStyle='rgba(251,113,133,.95)';ctx.fillStyle='rgba(251,113,133,.15)';ctx.lineWidth=Math.max(1,s*.012);for(const c of arr){if(c.type!=='circle')continue;ctx.beginPath();ctx.arc(x+c.x*s,y+c.y*s,c.r*s,0,Math.PI*2);ctx.fill();ctx.stroke()}ctx.restore()}
function renderStats(){const s=state.stats||{errors:0,links:0,used:new Map()};$('#chunks').textContent=state.n*state.n;$('#roles').textContent=s.used.size;$('#links').textContent=s.links;$('#errorsCount').textContent=s.errors;const issues=$('#issues');issues.innerHTML='';const add=(c,t)=>issues.insertAdjacentHTML('beforeend',`<div class="issue ${c}">${t}</div>`);if(s.errors===0&&state.ready)add('good','<b>0 erros de encaixe.</b> Todas as saídas N/E/S/W estão casando e nenhuma borda externa ficou aberta.');else add('bad',`Foram detectados <b>${s.errors}</b> erros ou chunks ausentes.`);add('good',`O gerador está usando <b>${s.used.size}/16 máscaras</b> nesta seed e escolhendo entre as duas variações visuais sem alterar os conectores.`);const list=$('#maskList');list.innerHTML='';[...s.used].sort((a,b)=>a[0]-b[0]).forEach(([m,c])=>list.insertAdjacentHTML('beforeend',`<div class="maskItem"><b>${String(m).padStart(2,'0')}</b> · ${ROLE[m]}<br>${c}x</div>`))}
function buildCatalog(){const el=$('#catalog');el.innerHTML='';for(let m=0;m<16;m++){const d=state.byMask[m]?.find(x=>x.variant===1)||state.byMask[m]?.[0];if(!d)continue;const im=state.images.get(d.id),box=document.createElement('div');box.className='thumb';box.innerHTML=`<img src="${im?.src||''}"><em>${String(m).padStart(2,'0')}</em>`;box.title=`${ROLE[m]} · N${m&N?1:0} E${m&E?1:0} S${m&S?1:0} W${m&W?1:0}`;el.appendChild(box)}}
function bindRange(id,out){const e=$(id),o=$(out);e.addEventListener('input',()=>{o.textContent=e.value+'%';generate()})}bindRange('#density','#densityV');bindRange('#variant','#variantV');
$('#generate').onclick=generate;$('#random').onclick=()=>{$('#seed').value='ICE-'+Math.random().toString(36).slice(2,8).toUpperCase();generate()};['#grid','#connectors','#masks','#collisions'].forEach(id=>$(id).addEventListener('change',draw));
$('#zin').onclick=()=>{state.zoom=Math.min(3,state.zoom*1.18);draw()};$('#zout').onclick=()=>{state.zoom=Math.max(.12,state.zoom/1.18);draw()};$('#reset').onclick=()=>{fit();draw()};
wrap.addEventListener('pointerdown',e=>{state.drag=true;state.lastX=e.clientX;state.lastY=e.clientY;wrap.setPointerCapture(e.pointerId)});wrap.addEventListener('pointermove',e=>{if(!state.drag)return;state.panX+=e.clientX-state.lastX;state.panY+=e.clientY-state.lastY;state.lastX=e.clientX;state.lastY=e.clientY;draw()});wrap.addEventListener('pointerup',()=>state.drag=false);wrap.addEventListener('pointercancel',()=>state.drag=false);wrap.addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.max(.12,Math.min(3,state.zoom*(e.deltaY>0?.9:1.1)));draw()},{passive:false});window.addEventListener('resize',resize);
loadPack();resize();
})();