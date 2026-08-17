(()=>{'use strict';
const $=id=>document.getElementById(id);
let liveSince=0,timer=null,lastOn=false;
let syncPeer=null,syncConn=null,syncRoom='',syncRetry=null,lastPayload='';
function cleanUser(v=''){v=String(v||'').trim();if(!v)return '—';return '@'+v.replace(/^@/,'')}
function fmt(ms){const s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),x=s%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`}
function liveSnapshot(){const status=$('cloudStatus')?.textContent||'',badge=$('liveBadge')?.textContent||'',dot=$('cloudDot')?.textContent||'',input=$('cloudUser')?.value||'';const on=/TIKTOK LIVE CONECTADA/i.test(status)||(/LIVE CONECTADA/i.test(badge)&&/LIVE/i.test(dot));let user=input;const m=status.match(/@([^\s·]+)/);if(m)user=m[1];return{on,user:String(user||'').replace(/^@/,'').trim().slice(0,32),status,badge,dot}}
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
function sync(){ensure();const snap=liveSnapshot(),on=snap.on,input=$('cloudUser')?.value||'';if(on&&!lastOn){liveSince=Date.now();lastOn=true}if(!on&&lastOn){lastOn=false;liveSince=0}const b=$('liveMonitorBadge');if(b){b.className='liveMonitorBadge '+(on?'on':'off');b.innerHTML=`<i></i> ${on?'LIVE ON':'LIVE OFF'}`}
if($('liveMonitorUser'))$('liveMonitorUser').textContent=on?cleanUser(snap.user):cleanUser(input);
if($('liveMonitorHint'))$('liveMonitorHint').textContent=on?'Transmissão conectada e recebendo eventos':'Aguardando confirmação da TikTok Live';
if($('liveMonitorLikes'))$('liveMonitorLikes').textContent=$('likeTotal')?.textContent||'0';
if($('liveMonitorCloud')){$('liveMonitorCloud').textContent=/ONLINE|LIVE/i.test(snap.dot)?snap.dot:'OFFLINE';$('liveMonitorCloud').classList.toggle('ok',/ONLINE|LIVE/i.test(snap.dot))}
if($('liveMonitorEvent'))$('liveMonitorEvent').textContent=$('liveStatus')?.textContent||'Nenhum evento recebido.';
if($('liveMonitorTime'))$('liveMonitorTime').textContent=on&&liveSince?fmt(Date.now()-liveSince):'00:00';
sendGameLiveState();
}
function roomCode(){return String($('room')?.value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)}
function closeSync(){clearTimeout(syncRetry);syncRetry=null;try{syncConn?.close()}catch{}try{syncPeer?.destroy()}catch{}syncConn=null;syncPeer=null;syncRoom='';lastPayload=''}
function scheduleSync(){if(syncRetry)return;syncRetry=setTimeout(()=>{syncRetry=null;ensureGameSync()},1800)}
function ensureGameSync(){const room=roomCode();if(room.length<6||typeof Peer==='undefined'){closeSync();return}if(syncConn?.open&&syncRoom===room)return;if(syncPeer&&syncRoom===room)return;closeSync();syncRoom=room;try{syncPeer=new Peer(undefined,{debug:0})}catch{return scheduleSync()}syncPeer.on('open',()=>{try{syncConn=syncPeer.connect('chaos-live-'+room.toLowerCase(),{reliable:true,serialization:'json'})}catch{return scheduleSync()}syncConn.on('open',()=>{lastPayload='';sendGameLiveState(true)});syncConn.on('close',()=>{syncConn=null;scheduleSync()});syncConn.on('error',()=>{syncConn=null;scheduleSync()})});syncPeer.on('error',()=>scheduleSync());syncPeer.on('disconnected',()=>scheduleSync())}
function sendGameLiveState(force=false){ensureGameSync();if(!syncConn?.open)return;const snap=liveSnapshot(),payload=JSON.stringify({liveStatus:snap.on?'on':'off',liveUser:snap.user});if(!force&&payload===lastPayload)return;lastPayload=payload;try{syncConn.send({type:'command',command:'ping',liveStatus:snap.on?'on':'off',liveUser:snap.user})}catch{syncConn=null;scheduleSync()}}
function watch(){ensure();['cloudStatus','liveBadge','cloudDot','likeTotal','liveStatus'].forEach(id=>{const el=$(id);if(el)new MutationObserver(sync).observe(el,{childList:true,subtree:true,characterData:true,attributes:true})});$('cloudUser')?.addEventListener('input',sync);$('room')?.addEventListener('input',()=>{closeSync();ensureGameSync()});timer=setInterval(()=>{sync();if(syncConn?.open)sendGameLiveState(true)},2000);sync()}
window.addEventListener('beforeunload',closeSync);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch);else watch();
})();
