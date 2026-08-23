import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const PORT = Number(process.env.PORT || 8787);
const ACCESS_KEY = String(process.env.CAOS_CONNECTOR_KEY || '').trim();
const SIGN_API_KEY = String(process.env.SIGN_API_KEY || process.env.EULER_API_KEY || process.env.TIKTOK_SIGN_API_KEY || '').trim();
const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const MODE = SIGN_API_KEY ? 'modern-signed' : 'modern-direct';
const MIME = {
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'
};

function currentVersion(){try{return String(JSON.parse(fs.readFileSync(path.join(ROOT,'version.json'),'utf8')).version||'0.0.0')}catch{return'0.0.0'}}
function patchVersion(html){const v=currentVersion();return html.replace(/Caos Live v\d+\.\d+\.\d+/g,`Caos Live v${v}`).replace(/Caos Admin v\d+\.\d+\.\d+/g,`Caos Admin v${v}`).replace(/PAINEL v\d+\.\d+\.\d+/g,`PAINEL v${v}`).replace(/(<div class="version">)v\d+\.\d+\.\d+/g,`$1v${v}`)}
function serveFile(res,file){fs.readFile(file,(err,data)=>{if(err){res.writeHead(404,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});return res.end('Not found')}const ext=path.extname(file).toLowerCase();const body=ext==='.html'?Buffer.from(patchVersion(data.toString('utf8')),'utf8'):data;res.writeHead(200,{'content-type':MIME[ext]||'application/octet-stream','cache-control':'no-store'});res.end(body)})}

const server=http.createServer((req,res)=>{const pathname=decodeURIComponent((req.url||'/').split('?')[0]);if(pathname==='/health'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({ok:true,service:'caos-tiktok-modern',mode:MODE,version:currentVersion(),clients:wss.clients.size,signerKey:Boolean(SIGN_API_KEY)}))}if(pathname==='/'||pathname==='/admin'||pathname==='/admin-latest'||pathname==='/painel.html')return serveFile(res,path.join(ROOT,'painel.html'));if(pathname==='/jogo')return serveFile(res,path.join(ROOT,'index.html'));const file=path.resolve(ROOT,pathname.replace(/^\/+/,''));if(!file.startsWith(ROOT)){res.writeHead(403);return res.end('Forbidden')}serveFile(res,file)});
const wss=new WebSocketServer({server});
function safeSend(ws,p){if(ws.readyState===ws.OPEN)ws.send(JSON.stringify(p))}
function errorText(e){if(typeof e==='string')return e;if(e?.message)return String(e.message);try{return JSON.stringify(e)}catch{return String(e)}}
function deepValue(obj,keys,depth=0,seen=new Set()){if(!obj||typeof obj!=='object'||depth>5||seen.has(obj))return'';seen.add(obj);for(const k of keys){const v=obj[k];if(typeof v==='string'&&v.trim())return v.trim();if(typeof v==='number'&&Number.isFinite(v))return String(v)}for(const v of Object.values(obj)){if(v&&typeof v==='object'){const found=deepValue(v,keys,depth+1,seen);if(found)return found}}return''}
function userOf(d={}){return deepValue(d,['uniqueId','unique_id','uniqueID','userName','username','displayId','nickname'])||'viewer'}
function commentOf(d={}){return deepValue(d,['comment','content','text','message','msg'])||''}
function onMany(live,names,handler){for(const name of [...new Set(names.filter(Boolean))])live.on(name,handler)}
function attachEvents(ws,s,live,generation){const active=()=>s.live===live&&s.generation===generation;
  onMany(live,[WebcastEvent?.CHAT,'chat','comment'],d=>{if(active())safeSend(ws,{type:'chat',user:userOf(d),comment:commentOf(d),liveUser:s.username})});
  onMany(live,[WebcastEvent?.LIKE,'like'],d=>{if(!active())return;const count=Math.max(1,Number(d?.likeCount??d?.like_count??d?.count??1)||1);safeSend(ws,{type:'like',user:userOf(d),count,liveUser:s.username})});
  onMany(live,[WebcastEvent?.FOLLOW,'follow'],d=>{if(active())safeSend(ws,{type:'follow',user:userOf(d),liveUser:s.username})});
  onMany(live,[WebcastEvent?.SHARE,'share'],d=>{if(active())safeSend(ws,{type:'share',user:userOf(d),liveUser:s.username})});
  onMany(live,[WebcastEvent?.GIFT,'gift'],d=>{if(!active())return;safeSend(ws,{type:'gift',user:userOf(d),gift:d?.giftName||d?.extendedGiftInfo?.name||d?.gift?.name||`gift-${d?.giftId||'unknown'}`,giftId:d?.giftId??d?.gift_id??null,count:Number(d?.repeatCount??d?.repeat_count??d?.count??1)||1,diamondCount:Number(d?.diamondCount??d?.diamond_count??d?.extendedGiftInfo?.diamondCount??0)||0,repeatEnd:d?.repeatEnd??d?.repeat_end??true,giftType:Number(d?.giftType??d?.gift_type??0)||0,liveUser:s.username})});
  live.on('disconnected',()=>{if(!active())return;s.live=null;s.connecting=false;s.connected=false;safeSend(ws,{type:'status',status:'disconnected',reason:'tiktok',username:s.username,mode:MODE})});
  live.on('error',e=>{if(active())safeSend(ws,{type:'debug',event:'ERRO TIKTOK',detail:errorText(e).slice(0,900),mode:MODE,at:Date.now()})});
}
async function stopSession(ws,s,notify=true){s.generation+=1;const live=s.live;s.live=null;s.connecting=false;s.connected=false;s.username='';if(live){try{live.removeAllListeners?.()}catch{}try{await live.disconnect?.()}catch{}}if(notify)safeSend(ws,{type:'status',status:'disconnected',manual:true,mode:MODE})}
async function connectOnce(ws,s,rawUsername){const username=String(rawUsername||'').trim().replace(/^@/,'');if(!username)return safeSend(ws,{type:'error',message:'Informe o @usuario da LIVE.'});if(s.connecting)return safeSend(ws,{type:'status',status:'checking',username:s.username||username,mode:MODE});if(s.connected&&s.live)return safeSend(ws,{type:'status',status:'connected',username:s.username,mode:MODE});await stopSession(ws,s,false);const generation=s.generation;s.username=username;s.connecting=true;safeSend(ws,{type:'status',status:'checking',username,mode:MODE});safeSend(ws,{type:'debug',event:'CONEXÃO MODERNA INICIADA',username,mode:MODE,signerKey:Boolean(SIGN_API_KEY),at:Date.now()});
  const options={processInitialData:false,enableExtendedGiftInfo:false,fetchRoomInfoOnConnect:true,webClientOptions:{timeout:{request:12000}},wsClientOptions:{handshakeTimeout:12000}};
  if(SIGN_API_KEY)options.signApiKey=SIGN_API_KEY;
  const live=new TikTokLiveConnection(username,options);s.live=live;attachEvents(ws,s,live,generation);
  try{const info=await live.connect();if(s.generation!==generation||s.live!==live){try{live.removeAllListeners?.();await live.disconnect?.()}catch{}return}s.connecting=false;s.connected=true;safeSend(ws,{type:'status',status:'connected',username,roomId:info?.roomId||null,mode:MODE});safeSend(ws,{type:'debug',event:'TIKTOK CONECTADA',username,roomId:info?.roomId||null,mode:MODE,at:Date.now()})}
  catch(e){if(s.generation!==generation||s.live!==live)return;const detail=errorText(e).slice(0,1200);try{live.removeAllListeners?.();await live.disconnect?.()}catch{}s.live=null;s.connecting=false;s.connected=false;safeSend(ws,{type:'error',message:detail});safeSend(ws,{type:'status',status:'error',username,reason:detail,mode:MODE});safeSend(ws,{type:'debug',event:'CONEXÃO MODERNA FALHOU',username,detail,mode:MODE,at:Date.now()})}}
wss.on('connection',ws=>{const s={authenticated:!ACCESS_KEY,live:null,username:'',connecting:false,connected:false,generation:0};safeSend(ws,{type:'bridge',status:'ready',authRequired:Boolean(ACCESS_KEY),mode:MODE});ws.on('message',async raw=>{let m;try{m=JSON.parse(raw.toString())}catch{return}if(m.type==='auth'){s.authenticated=!ACCESS_KEY||String(m.key||'')===ACCESS_KEY;return safeSend(ws,{type:'auth',ok:s.authenticated})}if(!s.authenticated)return safeSend(ws,{type:'error',message:'Chave do Caos Connector inválida.'});if(m.type==='connect')return connectOnce(ws,s,m.username);if(m.type==='disconnect')return stopSession(ws,s,true);if(m.type==='ping')return safeSend(ws,{type:'pong',at:Date.now(),mode:MODE,username:s.username,reconnecting:false,attempt:0,tiktokConnected:Boolean(s.connected),sessionEpoch:s.generation});if(m.type==='observe')return safeSend(ws,{type:'observe',ok:false,message:'Observador desativado durante estabilização.'});if(m.type==='giftcatalog')return safeSend(ws,{type:'gift_catalog_error',message:'Catálogo desativado durante estabilização.'})});ws.on('close',()=>{stopSession(ws,s,false)})});
server.listen(PORT,'0.0.0.0',()=>console.log(`CAOS TIKTOK ${MODE} v${currentVersion()} online :${PORT} signerKey=${Boolean(SIGN_API_KEY)}`));
