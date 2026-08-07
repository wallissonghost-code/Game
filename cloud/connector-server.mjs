import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const PORT = Number(process.env.PORT || 8787);
const ACCESS_KEY = String(process.env.CAOS_CONNECTOR_KEY || '').trim();
const MAX_CLIENTS = Math.max(1, Number(process.env.CAOS_MAX_CLIENTS || 25));
const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon' };

function currentVersion() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
    return String(data.version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

function patchSharedVersion(html) {
  const v = currentVersion();
  return html
    .replace(/Caos Live v\d+\.\d+\.\d+/g, `Caos Live v${v}`)
    .replace(/Caos Admin v\d+\.\d+\.\d+/g, `Caos Admin v${v}`)
    .replace(/VERSÃO v\d+\.\d+\.\d+/g, `VERSÃO v${v}`)
    .replace(/PAINEL v\d+\.\d+\.\d+/g, `PAINEL v${v}`)
    .replace(/const VERSION='\d+\.\d+\.\d+'/g, `const VERSION='${v}'`);
}

function patchAdminHtml(html) {
  return patchSharedVersion(html)
    .replace('PRESET: 1 ROSA → ESPECTRO', 'PRESET: 1 CURTIDA → ESCUDO')
    .replace('value="Rosa" placeholder="Presente"', 'value="Curtida" placeholder="Evento"')
    .replace("$('presetRose').onclick=()=>{rules.push({id:Date.now()+'-rose',gift:'Rosa',count:1,action:'spawn',mob:'wraith',value:1,cooldown:2});saveRules();$('liveStatus').textContent='Preset criado: 1 Rosa/Rose → 1 Espectro.'};", "$('presetRose').onclick=()=>{rules.push({id:Date.now()+'-like',gift:'Curtida',count:1,action:'invincible',mob:'wraith',value:2,cooldown:0});saveRules();$('liveStatus').textContent='Preset criado: 1 Curtida → Escudo por 2s.';};")
    .replace("loadRules();cloudState('Cloud desconectado.');", "loadRules();if(!rules.some(r=>norm(r.gift)==='curtida')){rules.push({id:'default-like-shield',gift:'Curtida',count:1,action:'invincible',mob:'wraith',value:2,cooldown:0});saveRules()}cloudState('Cloud desconectado.');")
    .replace("if(d.type==='status'){if(d.status==='connecting')cloudState('Conectando à LIVE de @'+d.username+'...');if(d.status==='connected')", "if(d.type==='status'){if(d.status==='checking')cloudState('🔎 Verificando @'+d.username+' e procurando uma LIVE ativa...');if(d.status==='connecting')cloudState('📡 Conta localizada. Entrando na LIVE de @'+d.username+'...');if(d.status==='connected')")
    .replace("cloudState('Solicitando conexão com @'+u+'...')", "cloudState('🔎 Procurando @'+u+' no TikTok...')")
    .replace("if(d.type==='error')cloudState('Erro: '+d.message,'err')", "if(d.type==='error'){cloudState('❌ '+d.message,'err');$('liveStatus').textContent='Falha ao conectar LIVE: '+d.message;add('TikTok: '+d.message)}");
}

function serveFile(res,file){
  fs.readFile(file,(err,data)=>{
    if(err){
      res.writeHead(404,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
      return res.end('Not found');
    }
    const ext=path.extname(file).toLowerCase();
    let body=data;
    if(ext==='.html'){
      const html=data.toString('utf8');
      body=Buffer.from(path.basename(file)==='painel.html'?patchAdminHtml(html):patchSharedVersion(html),'utf8');
    }
    res.writeHead(200,{'content-type':MIME[ext]||'application/octet-stream','cache-control':'no-store'});
    res.end(body);
  });
}

const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
  if(pathname==='/health'){
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    return res.end(JSON.stringify({ok:true,service:'caos-cloud-connector',version:currentVersion(),clients:wss.clients.size}));
  }
  if(pathname==='/')return serveFile(res,path.join(ROOT,'painel.html'));
  if(pathname==='/admin')return serveFile(res,path.join(ROOT,'painel.html'));
  if(pathname==='/jogo')return serveFile(res,path.join(ROOT,'index.html'));
  const relative=pathname.replace(/^\/+/,''),file=path.resolve(ROOT,relative);
  if(!file.startsWith(ROOT)){
    res.writeHead(403,{'content-type':'text/plain; charset=utf-8'});
    return res.end('Forbidden');
  }
  serveFile(res,file);
});

const wss=new WebSocketServer({server});
function safeSend(ws,payload){if(ws.readyState===ws.OPEN)ws.send(JSON.stringify(payload))}
function normalizeGift(data={}){const user=data.user?.uniqueId||data.user?.unique_id||data.uniqueId||data.nickname||'viewer';const gift=data.giftName||data.extendedGiftInfo?.name||data.gift?.name||`gift-${data.giftId||'unknown'}`;const count=Number(data.repeatCount||data.repeat_count||data.count||1)||1;const repeatEnd=data.repeatEnd??data.repeat_end??true;const giftType=Number(data.giftType??data.gift_type??data.extendedGiftInfo?.type??0)||0;return{type:'gift',user,gift,count,giftId:data.giftId||data.gift_id||null,repeatEnd,giftType}}
async function closeLive(state){if(!state.live)return;try{state.live.removeAllListeners?.()}catch{}try{state.live.disconnect?.()}catch{}state.live=null;state.username='';state.connecting=false}
async function connectLive(ws,state,username){
  username=String(username||'').trim().replace(/^@/,'');
  if(!username)return safeSend(ws,{type:'error',message:'Informe o @usuario da LIVE.'});
  if(state.connecting)return safeSend(ws,{type:'error',message:'Conexão já em andamento.'});
  if(state.live&&state.username===username)return safeSend(ws,{type:'status',status:'connected',username});
  await closeLive(state);
  state.connecting=true;
  state.username=username;
  safeSend(ws,{type:'status',status:'checking',username});
  const live=new TikTokLiveConnection(username,{enableExtendedGiftInfo:true});
  state.live=live;
  safeSend(ws,{type:'status',status:'connecting',username});
  live.on(WebcastEvent.GIFT,data=>{const gift=normalizeGift(data);if(gift.giftType===1&&gift.repeatEnd===false)return;safeSend(ws,gift)});
  live.on(WebcastEvent.LIKE,data=>{const user=data.user?.uniqueId||data.uniqueId||data.nickname||'viewer';const count=Math.max(1,Number(data.likeCount||data.count||1)||1);safeSend(ws,{type:'gift',user,gift:'Curtida',count,giftId:'tiktok-like',repeatEnd:true,giftType:0})});
  live.on(WebcastEvent.CHAT,data=>safeSend(ws,{type:'chat',user:data.user?.uniqueId||data.uniqueId||'viewer',comment:data.comment||''}));
  live.on('disconnected',()=>safeSend(ws,{type:'status',status:'disconnected',username}));
  live.on('error',err=>safeSend(ws,{type:'error',message:err?.message||String(err)}));
  try{
    const info=await live.connect();
    state.connecting=false;
    safeSend(ws,{type:'status',status:'connected',username,roomId:info?.roomId||null});
  }catch(err){
    state.connecting=false;
    await closeLive(state);
    const raw=err?.message||String(err);
    const lower=raw.toLowerCase();
    let message=raw;
    if(lower.includes('offline')||lower.includes('not live')||lower.includes('room')) message=`@${username} não está em LIVE agora ou a sala não está acessível.`;
    else if(lower.includes('user')&&lower.includes('not')) message=`Não consegui localizar @${username}. Confira o nome de usuário.`;
    safeSend(ws,{type:'error',message});
  }
}
wss.on('connection',ws=>{if(wss.clients.size>MAX_CLIENTS){safeSend(ws,{type:'error',message:'Servidor temporariamente lotado.'});return ws.close(1013,'busy')}const state={authenticated:!ACCESS_KEY,live:null,username:'',connecting:false};safeSend(ws,{type:'bridge',status:'ready',authRequired:Boolean(ACCESS_KEY)});ws.on('message',async raw=>{let msg;try{msg=JSON.parse(raw.toString())}catch{return}if(msg.type==='auth'){state.authenticated=!ACCESS_KEY||String(msg.key||'')===ACCESS_KEY;return safeSend(ws,{type:'auth',ok:state.authenticated})}if(!state.authenticated)return safeSend(ws,{type:'error',message:'Chave do Caos Connector inválida.'});if(msg.type==='connect')await connectLive(ws,state,msg.username);if(msg.type==='disconnect'){await closeLive(state);safeSend(ws,{type:'status',status:'disconnected'})}if(msg.type==='ping')safeSend(ws,{type:'pong',at:Date.now()})});ws.on('close',()=>closeLive(state))});
server.listen(PORT,'0.0.0.0',()=>{console.log(`CAOS CLOUD CONNECTOR v${currentVersion()} online :${PORT}`);console.log('Admin: /admin');console.log('Jogo: /jogo');console.log('Health: /health')});
