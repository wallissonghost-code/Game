import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WS_PORT = Number(process.env.CAOS_TIKTOK_PORT || 2121);
const HTTP_PORT = Number(process.env.CAOS_HTTP_PORT || 8787);
const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
const server = http.createServer((req,res)=>{
  try{
    const urlPath = decodeURIComponent((req.url||'/').split('?')[0]);
    const rel = urlPath==='/'?'painel-live.html':urlPath.replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel);
    if(!file.startsWith(ROOT)){res.writeHead(403);return res.end('Forbidden')}
    fs.readFile(file,(err,data)=>{
      if(err){res.writeHead(404);return res.end('Not found')}
      res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(data);
    });
  }catch{res.writeHead(500);res.end('Error')}
});
server.listen(HTTP_PORT,'127.0.0.1');

const wss = new WebSocketServer({ host: '127.0.0.1', port: WS_PORT });
let live = null;
let currentUser = '';
let connecting = false;

function send(ws, payload) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload)); }
function broadcast(payload) { const data=JSON.stringify(payload); for(const client of wss.clients) if(client.readyState===client.OPEN) client.send(data); }
function normalizeGift(e={}) { const user=e.user?.uniqueId||e.uniqueId||e.nickname||'viewer'; const gift=e.giftName||e.extendedGiftInfo?.name||e.gift?.name||`gift-${e.giftId||'unknown'}`; const count=Number(e.repeatCount||e.count||1)||1; const giftId=e.giftId||e.gift_id||null; const repeatEnd=e.repeatEnd??e.repeat_end??true; const giftType=Number(e.giftType??e.gift_type??e.extendedGiftInfo?.type??0)||0; return {type:'gift',user,gift,count,giftId,repeatEnd,giftType}; }

async function disconnectLive(){ if(!live)return; try{live.removeAllListeners?.()}catch{} try{live.disconnect?.()}catch{} live=null;currentUser='';connecting=false; }
async function connectLive(username){ username=String(username||'').trim().replace(/^@/,''); if(!username)throw new Error('Informe o @usuario da LIVE.'); if(connecting)throw new Error('Já existe uma conexão em andamento.'); if(live&&currentUser===username)return; await disconnectLive(); connecting=true;currentUser=username;broadcast({type:'status',status:'connecting',username}); const client=new TikTokLiveConnection(username,{enableExtendedGiftInfo:true}); live=client; client.on(WebcastEvent.GIFT,e=>{const gift=normalizeGift(e);if(gift.giftType===1&&gift.repeatEnd===false)return;broadcast(gift);console.log(`[gift] @${gift.user} -> ${gift.gift} x${gift.count}`)}); client.on(WebcastEvent.CHAT,e=>broadcast({type:'chat',user:e.user?.uniqueId||e.uniqueId||'viewer',comment:e.comment||''})); client.on('disconnected',()=>broadcast({type:'status',status:'disconnected',username})); client.on('error',err=>broadcast({type:'error',message:err?.message||String(err)})); try{const info=await client.connect();connecting=false;broadcast({type:'status',status:'connected',username,roomId:info?.roomId||null});console.log(`[ready] conectado à LIVE de @${username}`)}catch(err){connecting=false;live=null;currentUser='';broadcast({type:'error',message:err?.message||String(err)});throw err} }

wss.on('connection',ws=>{send(ws,{type:'bridge',status:'ready',port:WS_PORT,username:currentUser||null});ws.on('message',async raw=>{let msg;try{msg=JSON.parse(raw.toString())}catch{return}if(msg.type==='connect'){try{await connectLive(msg.username)}catch(err){send(ws,{type:'error',message:err?.message||String(err)})}}if(msg.type==='disconnect'){await disconnectLive();broadcast({type:'status',status:'disconnected'})}if(msg.type==='ping')send(ws,{type:'pong',at:Date.now()})})});

console.log(`\nCAOS LIVE · TikTok Bridge`);console.log(`Painel de teste: http://127.0.0.1:${HTTP_PORT}/painel-live.html`);console.log(`Bridge local: ws://127.0.0.1:${WS_PORT}`);console.log(`Deixe esta janela aberta durante a LIVE.\n`);
process.on('SIGINT',async()=>{await disconnectLive();wss.close();server.close(()=>process.exit(0))});
