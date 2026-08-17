const $=id=>document.getElementById(id);
let lastSeen=0;
let liveOn=false;
let liveUser='';

const style=document.createElement('style');
style.textContent=`
#gameLiveStatus{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:5px;min-width:86px;height:30px;padding:0 8px;border:1px solid rgba(71,85,105,.58);border-radius:9px;background:rgba(7,12,26,.89);color:#94a3b8;font:900 5.3px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;box-shadow:none}
#gameLiveStatus .liveDot{width:5px;height:5px;border-radius:999px;background:#64748b;flex:0 0 auto}
#gameLiveStatus.liveOn{color:#fecaca;border-color:rgba(239,68,68,.58);background:rgba(38,8,15,.88)}
#gameLiveStatus.liveOn .liveDot{background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,.8)}
#gameLiveStatus.liveOff{color:#cbd5e1}
#gameLiveStatus.disconnected{color:#94a3b8}
.hudPreview .hudStatusRow{grid-template-columns:1.05fr 1.12fr .92fr .72fr .54fr!important}
.hudPreview #gameLiveStatus{position:static!important;width:100%;min-width:0;height:30px}
@media(max-width:430px){.hudPreview #gameLiveStatus{height:30px;padding:0 3px;font-size:4.7px}.hudPreview .hudStatusRow{grid-template-columns:1fr 1.05fr .88fr .72fr .5fr!important}}
body:not(:has(.hudPreview)) #gameLiveStatus{position:fixed;z-index:7;top:max(88px,calc(env(safe-area-inset-top) + 82px));left:50%;transform:translateX(-50%);height:24px;font-size:6px}
`;
document.head.appendChild(style);

function ensureBadge(){
  let el=$('gameLiveStatus');
  if(el)return el;
  el=document.createElement('div');
  el.id='gameLiveStatus';
  el.className='disconnected';
  el.innerHTML='<span class="liveDot"></span><span class="liveText">DESCONECTADO</span>';
  const row=document.querySelector('.hudStatusRow');
  if(row){
    const fps=$('fpsHud');
    if(fps&&fps.parentNode===row)row.insertBefore(el,fps);else row.appendChild(el);
  }else document.body.appendChild(el);
  return el;
}

function paint(){
  const el=ensureBadge(),text=el.querySelector('.liveText');
  const connected=Date.now()-lastSeen<6500;
  if(!connected){
    el.className='disconnected';
    text.textContent='DESCONECTADO';
    return;
  }
  if(liveOn){
    el.className='liveOn';
    text.textContent='LIVE ON'+(liveUser?' @'+liveUser.replace(/^@/,''):'');
  }else{
    el.className='liveOff';
    text.textContent='LIVE OFF';
  }
}

window.addEventListener('caos:admin-command',e=>{
  const d=e.detail||{};
  if(d.command!=='ping'||!Object.prototype.hasOwnProperty.call(d,'liveStatus'))return;
  lastSeen=Date.now();
  liveOn=d.liveStatus==='on'||d.liveStatus===true;
  liveUser=String(d.liveUser||'').replace(/^@/,'').trim().slice(0,32);
  paint();
});

ensureBadge();
paint();
setInterval(paint,1500);
