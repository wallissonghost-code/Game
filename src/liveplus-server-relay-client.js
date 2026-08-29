(()=>{'use strict';
const Base=window.LivePlusGameSession;if(!Base||Base.prototype.__serverRelayWrapped)return;
const proto=Base.prototype;
const original={connect:proto.connect,send:proto.send,sendState:proto.sendState,sendEvent:proto.sendEvent,disconnect:proto.disconnect,setManifest:proto.setManifest};
const RELAY_TIMEOUT=2800;
function endpointFor(){
  try{const q=new URLSearchParams(location.search).get('liveplusRelay');if(q)return q;return localStorage.getItem('liveplus-relay-endpoint')||''}catch{return''}
}
function normalizeEndpoint(raw){try{const u=new URL(String(raw||''));if(!['ws:','wss:'].includes(u.protocol))return'';if(location.protocol==='https:'&&u.protocol==='ws:')u.protocol='wss:';return u.toString()}catch{return''}}
function sendRelay(self,payload){if(self.relayWs?.readyState!==WebSocket.OPEN||!self.relayConnected)return false;try{self.relayWs.send(JSON.stringify({type:'relay_game_message',code:self.code,payload}));return true}catch{return false}}
function closeRelay(self){clearTimeout(self.relayTimer);self.relayTimer=null;self.relayConnected=false;try{self.relayWs?.close()}catch{}self.relayWs=null}
function sendManifestRelay(self){if(!self.manifest)return false;return sendRelay(self,{type:'game_manifest',protocol:'liveplus-game-manifest-v1',manifest:self.manifest})}
proto.connect=async function(rawCode){
  const code=this.cleanCode(rawCode);if(code.length!==8)throw Error('Código da partida inválido.');
  const endpoint=normalizeEndpoint(endpointFor());
  if(!endpoint)return original.connect.call(this,rawCode);
  this.manual=false;this.code=code;this.token=this.loadToken?.()||'';this.retry=0;this.cleanupConnection?.();closeRelay(this);
  this.emit('stage',{stage:'relay-starting',code:this.code,endpoint});
  try{return await new Promise((resolve,reject)=>{
    let settled=false;
    const fallback=reason=>{if(settled)return;settled=true;closeRelay(this);this.emit('stage',{stage:'relay-fallback',reason:String(reason||'relay indisponível')});original.connect.call(this,rawCode).then(resolve,reject)};
    let ws;try{ws=new WebSocket(endpoint)}catch(e){fallback(e?.message);return}
    this.relayWs=ws;
    this.relayTimer=setTimeout(()=>fallback('tempo limite do servidor'),RELAY_TIMEOUT);
    ws.onopen=()=>{try{ws.send(JSON.stringify({type:'relay_game_join',code:this.code,gameId:this.manifest?.gameId||''}))}catch(e){fallback(e?.message)}};
    ws.onmessage=ev=>{
      let m;try{m=JSON.parse(ev.data)}catch{return}
      if(m.type==='relay_game_ready'&&m.code===this.code){
        if(settled)return;settled=true;clearTimeout(this.relayTimer);this.relayTimer=null;this.relayConnected=true;this.retry=0;sendManifestRelay(this);this.emit('transport',{status:'connected',transport:'server'});this.emit('connected',{code:this.code,exclusive:true,target:endpoint,transport:'server'});resolve(m);return;
      }
      if(m.type==='relay_message'&&m.from==='panel'&&m.code===this.code){const data=m.payload;if(!data||typeof data!=='object')return;if(data.type==='command')this.emit('command',data);else this.emit('message',data);return}
      if(m.type==='relay_panel_disconnected'&&m.code===this.code){this.emit('stage',{stage:'relay-panel-background',code:this.code});return}
      if(m.type==='relay_error'&&m.scope==='game_join')fallback(m.message||'sessão indisponível');
    };
    ws.onerror=()=>{if(!this.relayConnected)fallback('erro WebSocket do relay')};
    ws.onclose=()=>{const was=this.relayConnected;this.relayConnected=false;if(!settled)return fallback('relay fechado');if(was&&!this.manual){this.emit('transport',{status:'disconnected',transport:'server'});setTimeout(()=>{if(!this.manual&&this.code)original.connect.call(this,this.code).catch(()=>{})},450)}};
  })}catch(e){return original.connect.call(this,rawCode)}
};
proto.setManifest=function(manifest){this.manifest=manifest||null;if(this.relayConnected&&this.manifest)sendManifestRelay(this);return original.setManifest.call(this,manifest)};
proto.send=function(data={}){return this.relayConnected?sendRelay(this,data):original.send.call(this,data)};
proto.sendState=function(state={}){return this.relayConnected?sendRelay(this,{type:'state',...state,at:Date.now()}):original.sendState.call(this,state)};
proto.sendEvent=function(event={}){return this.relayConnected?sendRelay(this,{type:'event',...event,at:Date.now()}):original.sendEvent.call(this,event)};
proto.disconnect=function(){this.manual=true;if(this.relayConnected){try{this.relayWs.send(JSON.stringify({type:'relay_leave',code:this.code}))}catch{}}closeRelay(this);return original.disconnect.call(this)};
proto.__serverRelayWrapped=true;
window.LivePlusServerRelayClient={version:'1.0.0',endpoint:endpointFor};
})();
