(()=>{'use strict';
const timers=new Map();
const native=()=>window.CaosLiveCommand;
function clearTimer(command){const t=timers.get(command);if(t)clearTimeout(t);timers.delete(command)}
function schedule(command,seconds,callback){clearTimer(command);const value=Number(seconds);if(!Number.isFinite(value)||value<=0)return;const wait=Math.min(value,3600)*1000;timers.set(command,setTimeout(()=>{timers.delete(command);try{callback()}catch(e){console.warn('LIVE+ TIMER',command,e)}},wait))}
function install(){
 const fn=native();if(typeof fn!=='function'||fn.__livePlusTimed)return false;
 function timed(input){
  const d=input&&typeof input==='object'?input:{},c=String(d.command||'');
  if(c==='autofire_block'){
   const seconds=Number(d.seconds);const mapped={...d,command:'autofire',value:false,source:d.source||'liveplus-universal'};
   const out=fn(mapped);
   schedule('autofire',seconds,()=>fn({type:'command',command:'autofire',value:true,seconds:0,source:'liveplus-timer',user:''}));
   return out;
  }
  if(c==='autofire_off'){
   clearTimer('autofire');
   return fn({...d,command:'autofire',value:false,seconds:0,source:d.source||'liveplus-universal'});
  }
  if(c==='autofire_on'){
   clearTimer('autofire');
   return fn({...d,command:'autofire',value:true,seconds:0,source:d.source||'liveplus-universal'});
  }
  if(c==='skillmax')return fn({...d,command:'skilltestall',level:5,source:d.source||'liveplus-universal'});
  const out=fn(d);
  try{
   if(c==='eventmeteor'||c==='eventdoublexp'){
    if(d.value)schedule(c,d.seconds,()=>fn({type:'command',...d,command:c,value:false,seconds:0,source:'liveplus-timer',user:''}));
    else clearTimer(c);
   }
   if(c==='autofire'){
    clearTimer('autofire');
    if(d.value===false&&Number(d.seconds)>0)schedule('autofire',d.seconds,()=>fn({type:'command',command:'autofire',value:true,seconds:0,source:'liveplus-timer',user:''}));
   }
  }catch(e){console.warn('LIVE+ TIMER SETUP',e)}
  return out;
 }
 timed.__livePlusTimed=true;timed.__livePlusNative=fn;window.CaosLiveCommand=timed;return true;
}
if(!install()){window.addEventListener('caos:runtime-ready',install);const retry=setInterval(()=>{if(install())clearInterval(retry)},100);setTimeout(()=>clearInterval(retry),10000)}
})();