(()=>{'use strict';
const MAX=900,INTERVAL=1000,UPLOAD_INTERVAL=5000;let sessionId='',startedAt=0,last=0,lastUpload=0,frames=[],events=[],uploading=false;
function id(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function start(){sessionId=id();startedAt=Date.now();last=0;lastUpload=0;frames=[];events=[];return sessionId}
function compact(s={}){return{t:Date.now()-startedAt,lv:+s.level||0,hp:+s.health||0,maxHp:+s.maxHealth||0,xp:+s.xp||0,xpNeed:+s.xpNeed||0,fps:+s.fps||0,mobs:+s.mobs||0,kills:+s.kills||0,wave:+s.wave||0,score:+s.score||0,paused:!!s.paused,running:!!s.running,auto:!!s.autoMode,fire:s.autofire!==false,mode:s.gameplayMode||'classic',events:s.events||null}}
function sample(state){if(!sessionId)start();const now=Date.now();if(now-last<INTERVAL)return;last=now;frames.push(compact(state));if(frames.length>MAX)frames.shift();if(now-lastUpload>=UPLOAD_INTERVAL){lastUpload=now;uploadLatest().catch(()=>{})}}
function mark(type,data={}){if(!sessionId)start();events.push({t:Date.now()-startedAt,type:String(type||'event').slice(0,40),data});if(events.length>300)events.shift()}
function snapshot(extra={}){return{schema:1,sessionId,startedAt,updatedAt:Date.now(),durationMs:Date.now()-startedAt,frames:[...frames],events:[...events],...extra}}
async function firebaseCtx(){if(!window.CaosRank?.ready)return null;await window.CaosRank.ready();const uid=window.CaosRank.uid?.();if(!uid||!window.firebase)return null;return{uid,db:window.firebase.firestore()}}
async function uploadLatest(force=false){if(uploading)return false;if(!force&&Date.now()-lastUpload<1000)return false;const ctx=await firebaseCtx();if(!ctx)return false;uploading=true;try{const data=snapshot({uid:ctx.uid,protected:false,note:'',device:navigator.userAgent.slice(0,180)});await ctx.db.collection('diagnostic_latest').doc(ctx.uid).set(data,{merge:false});return true}finally{uploading=false}}
async function saveProtected(note=''){const ctx=await firebaseCtx();if(!ctx)throw Error('Firebase indisponível');await uploadLatest(true);const data=snapshot({uid:ctx.uid,protected:true,note:String(note||'').trim().slice(0,300),savedAt:Date.now()});await ctx.db.collection('diagnostic_saved').doc(sessionId).set(data,{merge:false});return data}
window.addEventListener('pagehide',()=>{uploadLatest(true).catch(()=>{})});
window.CaosSessionRecorder={start,sample,mark,snapshot,uploadLatest,saveProtected,get id(){return sessionId}};
start();
})();