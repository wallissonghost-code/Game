(()=>{'use strict';
const timers=new Map();
const clearTimer=command=>{const t=timers.get(command);if(t)clearTimeout(t);timers.delete(command)};
const secondsValue=value=>{const n=Number(String(value??'').replace(',','.'));return Number.isFinite(n)?Math.max(0,Math.min(n,3600)):0};
function disable(command){clearTimer(command);try{window.CaosLiveCommand?.({type:'command',command,value:false,source:'liveplus-timer',user:''})}catch(e){console.warn('LIVE+ TIMER OFF',command,e)}}
function schedule(command,seconds){clearTimer(command);const s=secondsValue(seconds);if(s<=0)return;timers.set(command,setTimeout(()=>disable(command),s*1000))}
function handle(d){if(!d||d.type!=='command')return;const command=String(d.command||'');if(command!=='eventmeteor'&&command!=='eventdoublexp')return;if(d.value===false||d.value==='false'||d.value===0){clearTimer(command);return}if(d.value===true||d.value==='true'||d.value===1)schedule(command,d.seconds)}
let wrapped=null;
function wrapRuntime(){const current=window.CaosLiveCommand;if(typeof current!=='function'||current===wrapped||current.__livePlusTimedWrapped)return false;const original=current;wrapped=function(d){const result=original.apply(this,arguments);handle(d);return result};wrapped.__livePlusTimedWrapped=true;wrapped.__livePlusOriginal=original;window.CaosLiveCommand=wrapped;return true}
window.addEventListener('caos:runtime-ready',()=>{wrapRuntime()});
window.addEventListener('caos:admin-command',e=>handle(e.detail||{}));
const wait=setInterval(()=>{if(wrapRuntime())clearInterval(wait)},100);
setTimeout(()=>clearInterval(wait),15000);
})();