(()=>{'use strict';
const $=id=>document.getElementById(id);
let liveSince=0,timer=null,lastOn=false,lastPayload='';
let gameConn=null;

function cleanUser(v=''){v=String(v||'').trim();if(!v)return '—';return '@'+v.replace(/^@/,'')}
function fmt(ms){const s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),x=s%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`}
function liveSnapshot(){const status=$('cloudStatus')?.textContent||'',badge=$('liveBadge')?.textContent||'',dot=$('cloudDot')?.textContent||'',input=$('cloudUser')?.value||'';const on=/TIKTOK LIVE CONECTADA/i.test(status)||(/LIVE CONECTADA/i.test(badge)&&/LIVE/i.test(dot));let user=input;const m=status.match(/@([^\s·]+)/);if(m)user=m[1];return{on,user:String(user||'').replace(/^@/,'').trim().slice(0,32),status,badge,dot}}

function hookPanelConnection(){
  if(typeof Peer==='undefined'||!Peer.prototype?.connect||Peer.prototype.connect.__caosLiveHook)return;
  const original=Peer.prototype.connect;
  function hooked(...args){
    const c=original.apply(this,args);
    const target=String(args[0]||'');
    if(target.startsWith('chaos-live-')){
      gameConn=c;
      lastPayload='';
      c.on?.('open',()=>{gameConn=c;lastPayload='';sendGameLiveState(true)});
      c.on?.('close',()=>{if(gameConn===c)gameConn=null});
      c.on?.('error',()=>{if(gameConn===c&&!c.open)gameConn=null});
    }
    return c;
  }
  hooked.__caosLiveHook=true;
  Peer.prototype.connect=hooked;
}

function ensure(){if($('tiktokLiveMonitor'))return;const anchor=document.querySelector('.automationsCard');if(!anchor)return;const el=document.createElement('section');el.id='tiktokLiveMonitor';el.className='card liveMonitorCard';el.innerHTML=`
  <div class="liveMonitorHead">
    <div><span class="eyebrow">TIKTOK LIVE</span><h2>Status da transmissão</h2></div>
    <span id="liveMonitorBadge" class="liveMonitorBadge off"><i></i> LIVE OFF</span>
  </div>
  <div class="liveMonitorGrid">
    <div class="liveMonitorMain"><small>CONTA</small><b id="liveMonitorUser">—</b><span id="liveMonitorHint">Aguardando conexão com uma Live</span></div>
    <div><small>DURAÇÃO</small><b id="liveMonitorTime">00:00</b></div>
    <div><small>CURTIDAS</small><b id="liveMonitorLikes">0</b></div>
    <div><small>CONNECTOR</small><b id="liveMonitorCloud">OFFLINE</b></div>
  </div>
  <div class="liveMonitorFoot"><span>ÚLTIMO EVENTO</span><b id="liveMonitorEvent">Nenhum evento recebido.</b></div>`;
anchor.parentNode.insertBefore(el,anchor);
}

function sendGameLiveState(force=false){
  if(!gameConn?.open)return false;
  const snap=liveSnapshot(),payload=JSON.stringify({liveStatus:snap.on?'on':'off',liveUser:snap.user});
  if(!force&&payload===lastPayload)return true;
  try{
    gameConn.send({type:'command',command:'ping',liveStatus:snap.on?'on':'off',liveUser:snap.user});
    lastPayload=payload;
    return true;
  }catch{return false}
}

function sync(){ensure();const snap=liveSnapshot(),on=snap.on,input=$('cloudUser')?.value||'';if(on&&!lastOn){liveSince=Date.now();lastOn=true}if(!on&&lastOn){lastOn=false;liveSince=0}const b=$('liveMonitorBadge');if(b){b.className='liveMonitorBadge '+(on?'on':'off');b.innerHTML=`<i></i> ${on?'LIVE ON':'LIVE OFF'}`}
if($('liveMonitorUser'))$('liveMonitorUser').textContent=on?cleanUser(snap.user):cleanUser(input);
if($('liveMonitorHint'))$('liveMonitorHint').textContent=on?'Transmissão conectada e recebendo eventos':'Aguardando confirmação da TikTok Live';
if($('liveMonitorLikes'))$('liveMonitorLikes').textContent=$('likeTotal')?.textContent||'0';
if($('liveMonitorCloud')){$('liveMonitorCloud').textContent=/ONLINE|LIVE/i.test(snap.dot)?snap.dot:'OFFLINE';$('liveMonitorCloud').classList.toggle('ok',/ONLINE|LIVE/i.test(snap.dot))}
if($('liveMonitorEvent'))$('liveMonitorEvent').textContent=$('liveStatus')?.textContent||'Nenhum evento recebido.';
if($('liveMonitorTime'))$('liveMonitorTime').textContent=on&&liveSince?fmt(Date.now()-liveSince):'00:00';
sendGameLiveState();
}

function watch(){hookPanelConnection();ensure();['cloudStatus','liveBadge','cloudDot','likeTotal','liveStatus'].forEach(id=>{const el=$(id);if(el)new MutationObserver(sync).observe(el,{childList:true,subtree:true,characterData:true,attributes:true})});$('cloudUser')?.addEventListener('input',sync);timer=setInterval(()=>{sync();sendGameLiveState(true)},2000);sync()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch);else watch();
})();
