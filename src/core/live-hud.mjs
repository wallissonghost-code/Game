const $=id=>document.getElementById(id);
const CLOUD_URL='wss://game-f202.onrender.com';
const CLOUD_KEY='chaos-cloud-key-v1';
const CLOUD_USER='chaos-cloud-user-v1';
let panelLastSeen=0;
let panelLiveOn=false;
let panelLiveUser='';
let cloudWs=null;
let cloudAuthed=false;
let cloudStateKnown=false;
let cloudLiveOn=false;
let cloudLiveUser='';
let reconnectTimer=null;
let reconnectDelay=1200;

const style=document.createElement('style');
style.textContent=`
#gameLiveStatus{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:4px;min-width:72px;height:30px;padding:0 6px;border:1px solid rgba(71,85,105,.58);border-radius:9px;background:rgba(7,12,26,.89);color:#94a3b8;font:900 4.9px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;overflow:hidden;pointer-events:none;box-shadow:none}
#gameLiveStatus .liveDot{width:5px;height:5px;border-radius:999px;background:#64748b;flex:0 0 auto}
#gameLiveStatus .liveText{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#gameLiveStatus.liveOn{color:#bbf7d0;border-color:rgba(34,197,94,.55);background:rgba(5,31,20,.90)}
#gameLiveStatus.liveOn .liveDot{background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.78)}
#gameLiveStatus.liveOff{color:#cbd5e1}
#gameLiveStatus.reconnecting{color:#fde68a;border-color:rgba(245,158,11,.42)}
#gameLiveStatus.reconnecting .liveDot{background:#f59e0b}
#gameLiveStatus.disconnected{color:#94a3b8}
.hudPreview .hudStatusRow{grid-template-columns:1.08fr 1.16fr .92fr .62fr .52fr!important}
.hudPreview #gameLiveStatus{position:static!important;width:100%;min-width:0;height:30px}
@media(max-width:430px){.hudPreview #gameLiveStatus{height:30px;padding:0 3px;font-size:4.25px}.hudPreview .hudStatusRow{grid-template-columns:1.03fr 1.08fr .90fr .60fr .49fr!important}}
body:not(:has(.hudPreview)) #gameLiveStatus{position:fixed;z-index:7;top:max(88px,calc(env(safe-area-inset-top) + 82px));left:50%;transform:translateX(-50%);height:24px;font-size:5.3px}
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

function cleanUser(v=''){
  return String(v||'').replace(/^@/,'').trim().slice(0,32);
}

function setBadge(kind,label){
  const el=ensureBadge(),text=el.querySelector('.liveText');
  el.className=kind;
  text.textContent=label;
}

function paint(){
  // Connector direto é a fonte oficial quando já respondeu ao jogo.
  if(cloudStateKnown){
    if(cloudLiveOn){
      const u=cleanUser(cloudLiveUser);
      setBadge('liveOn','LIVE ON'+(u?' @'+u:''));
    }else if(cloudAuthed){
      setBadge('liveOff','LIVE OFF');
    }else{
      setBadge('disconnected','DESCONECTADO');
    }
    return;
  }

  // Fallback legado enquanto o Connector direto ainda está acordando/autenticando.
  const fresh=Date.now()-panelLastSeen<30000;
  if(fresh){
    if(panelLiveOn){
      const u=cleanUser(panelLiveUser);
      setBadge('liveOn','LIVE ON'+(u?' @'+u:''));
    }else setBadge('liveOff','LIVE OFF');
    return;
  }

  if(cloudWs&&cloudWs.readyState===WebSocket.CONNECTING){
    setBadge('reconnecting','CONECTANDO...');
  }else{
    setBadge('disconnected','DESCONECTADO');
  }
}

function scheduleReconnect(){
  clearTimeout(reconnectTimer);
  reconnectTimer=setTimeout(connectCloudDirect,reconnectDelay);
  reconnectDelay=Math.min(10000,Math.round(reconnectDelay*1.6));
}

function connectCloudDirect(){
  clearTimeout(reconnectTimer);
  reconnectTimer=null;
  const key=localStorage.getItem(CLOUD_KEY)||'';
  if(!key){
    cloudAuthed=false;
    cloudStateKnown=false;
    paint();
    return;
  }
  try{cloudWs?.close()}catch{}
  cloudAuthed=false;
  cloudStateKnown=false;
  paint();
  try{cloudWs=new WebSocket(CLOUD_URL)}catch{scheduleReconnect();return}

  cloudWs.onopen=()=>{
    reconnectDelay=1200;
    try{cloudWs.send(JSON.stringify({type:'auth',key}))}catch{}
  };

  cloudWs.onmessage=e=>{
    let d;
    try{d=JSON.parse(e.data)}catch{return}
    if(d.type==='bridge'&&!d.authRequired){
      cloudAuthed=true;
      paint();
    }
    if(d.type==='auth'){
      cloudAuthed=!!d.ok;
      if(!cloudAuthed){cloudStateKnown=true;cloudLiveOn=false}
      paint();
    }
    if(d.type==='status'){
      if(d.status==='connected'){
        cloudStateKnown=true;
        cloudAuthed=true;
        cloudLiveOn=true;
        cloudLiveUser=cleanUser(d.username||localStorage.getItem(CLOUD_USER)||'');
      }else if(d.status==='disconnected'){
        cloudStateKnown=true;
        cloudLiveOn=false;
      }else if(d.status==='connecting'){
        cloudAuthed=true;
        cloudStateKnown=false;
      }
      paint();
    }
    // Eventos reais provam que a ponte TikTok está viva, mesmo se o status inicial não foi reenviado.
    if(d.type==='like'||d.type==='gift'||d.type==='chat'){
      cloudStateKnown=true;
      cloudAuthed=true;
      cloudLiveOn=true;
      if(!cloudLiveUser)cloudLiveUser=cleanUser(localStorage.getItem(CLOUD_USER)||'');
      paint();
    }
  };

  cloudWs.onerror=()=>{};
  cloudWs.onclose=()=>{
    cloudAuthed=false;
    cloudStateKnown=true;
    cloudLiveOn=false;
    paint();
    scheduleReconnect();
  };
}

window.addEventListener('caos:admin-command',e=>{
  const d=e.detail||{};
  if(d.command!=='ping'||!Object.prototype.hasOwnProperty.call(d,'liveStatus'))return;
  panelLastSeen=Date.now();
  panelLiveOn=d.liveStatus==='on'||d.liveStatus===true;
  panelLiveUser=cleanUser(d.liveUser);
  // Enquanto o Connector direto ainda não deu um estado oficial, aceitamos o painel como fallback.
  if(!cloudStateKnown)paint();
});

window.addEventListener('storage',e=>{
  if(e.key===CLOUD_KEY||e.key===CLOUD_USER)connectCloudDirect();
});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&(!cloudWs||cloudWs.readyState>1))connectCloudDirect();
});
window.addEventListener('online',()=>connectCloudDirect());

ensureBadge();
paint();
connectCloudDirect();
setInterval(paint,3000);
