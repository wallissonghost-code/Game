(()=>{'use strict';
class LivePlusGameSession extends EventTarget{
  constructor({peerFactory=null,storageKey='liveplus-match-token',manifest=null}={}){super();this.peerFactory=peerFactory||((id)=>new Peer(id,{debug:0}));this.storageKey=storageKey;this.manifest=manifest;this.peer=null;this.conn=null;this.code='';this.token='';this.retry=0;this.retryTimer=null;this.manual=false}
  cleanCode(raw=''){return String(raw).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)}
  target(code){return`liveplus-session-${this.cleanCode(code).toLowerCase()}`}
  emit(type,detail={}){this.dispatchEvent(new CustomEvent(type,{detail}))}
  loadToken(){try{return sessionStorage.getItem(this.storageKey+':'+this.cleanCode(this.code))||''}catch{return''}}
  saveToken(token){this.token=String(token||'');try{sessionStorage.setItem(this.storageKey+':'+this.cleanCode(this.code),this.token)}catch{}}
  cleanupConnection(){clearTimeout(this.retryTimer);this.retryTimer=null;try{this.conn?.close()}catch{}try{this.peer?.destroy()}catch{}this.conn=null;this.peer=null}
  setManifest(manifest){this.manifest=manifest||null;if(this.conn?.open&&this.manifest)this.sendManifest();return this}
  sendManifest(){if(!this.conn?.open||!this.manifest)return false;try{this.conn.send({type:'game_manifest',protocol:'liveplus-game-manifest-v1',manifest:this.manifest});return true}catch{return false}}
  async connect(rawCode){const code=this.cleanCode(rawCode);if(code.length!==8)throw Error('Código da partida inválido.');this.manual=false;this.code=code;this.token=this.loadToken();this.retry=0;this.cleanupConnection();return this.open()}
  open(){return new Promise((resolve,reject)=>{this.peer=this.peerFactory();let settled=false;const fail=e=>{if(!settled){settled=true;reject(e instanceof Error?e:new Error(String(e)))}this.scheduleReconnect()};this.peer.on('open',()=>{this.conn=this.peer.connect(this.target(this.code),{reliable:true,serialization:'json'});this.conn.on('open',()=>{try{this.conn.send({type:'session_hello',token:this.token||'',protocol:'liveplus-match-v1'})}catch{}this.emit('transport',{status:'connected'})});this.conn.on('data',data=>{if(!data||typeof data!=='object')return;if(data.type==='session_accept'){if(data.token)this.saveToken(data.token);this.retry=0;this.sendManifest();this.emit('connected',{code:this.code,exclusive:!!data.exclusive});if(!settled){settled=true;resolve(data)}return}if(data.type==='session_reject'){const err=new Error(data.reason||'Sessão recusada');this.emit('rejected',{reason:err.message});this.manual=true;this.cleanupConnection();if(!settled){settled=true;reject(err)}return}if(data.type==='command')this.emit('command',data);else this.emit('message',data)});this.conn.on('close',()=>{this.emit('transport',{status:'disconnected'});this.scheduleReconnect()});this.conn.on('error',fail)});this.peer.on('error',fail);this.peer.on('disconnected',()=>{try{this.peer.reconnect()}catch{this.scheduleReconnect()}})})}
  scheduleReconnect(){if(this.manual||this.retryTimer||!this.code)return;this.retry++;if(this.retry>6){this.emit('lost',{reason:'reconexão esgotada'});return}const delay=Math.min(5000,500*Math.pow(1.6,this.retry));this.emit('reconnecting',{attempt:this.retry,delay});this.retryTimer=setTimeout(()=>{this.retryTimer=null;if(this.manual)return;this.cleanupConnection();this.open().catch(()=>{})},delay)}
  sendState(state={}){if(!this.conn?.open)return false;try{this.conn.send({type:'state',...state,at:Date.now()});return true}catch{return false}}
  sendEvent(event={}){if(!this.conn?.open)return false;try{this.conn.send({type:'event',...event,at:Date.now()});return true}catch{return false}}
  send(data={}){if(!this.conn?.open)return false;try{this.conn.send(data);return true}catch{return false}}
  disconnect(){this.manual=true;this.code='';this.cleanupConnection();this.emit('transport',{status:'offline'})}
}
window.LivePlusGameSession=LivePlusGameSession;
})();