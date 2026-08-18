(()=>{'use strict';
const MAX=900,INTERVAL=1000;let sessionId='',startedAt=0,last=0,frames=[],events=[];
function id(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function start(){sessionId=id();startedAt=Date.now();last=0;frames=[];events=[];return sessionId}
function compact(s={}){return{t:Date.now()-startedAt,lv:+s.level||0,hp:+s.health||0,maxHp:+s.maxHealth||0,xp:+s.xp||0,xpNeed:+s.xpNeed||0,fps:+s.fps||0,mobs:+s.mobs||0,kills:+s.kills||0,wave:+s.wave||0,score:+s.score||0,paused:!!s.paused,running:!!s.running,auto:!!s.autoMode,fire:s.autofire!==false,mode:s.gameplayMode||'classic',events:s.events||null}}
function sample(state){if(!sessionId)start();const now=Date.now();if(now-last<INTERVAL)return;last=now;frames.push(compact(state));if(frames.length>MAX)frames.shift()}
function mark(type,data={}){if(!sessionId)start();events.push({t:Date.now()-startedAt,type:String(type||'event').slice(0,40),data});if(events.length>300)events.shift()}
function snapshot(extra={}){return{schema:1,sessionId,startedAt,updatedAt:Date.now(),durationMs:Date.now()-startedAt,frames:[...frames],events:[...events],...extra}}
window.CaosSessionRecorder={start,sample,mark,snapshot,get id(){return sessionId}};
start();
})();