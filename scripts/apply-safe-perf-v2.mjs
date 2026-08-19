import fs from 'node:fs';

const path='src/game.js';
let s=fs.readFileSync(path,'utf8');

function replaceOnce(oldText,newText,label){
  const i=s.indexOf(oldText);
  if(i<0) throw new Error(`PATCH MISS: ${label}`);
  if(s.indexOf(oldText,i+1)>=0) throw new Error(`PATCH AMBIGUOUS: ${label}`);
  s=s.slice(0,i)+newText+s.slice(i+oldText.length);
  console.log('PATCH OK:',label);
}

replaceOnce(
"function tunePerformance(t){perfFrames++;if(t-perfWindowStart<800)return;perfLastFps=Math.max(1,Math.round(perfFrames*1000/(t-perfWindowStart)));window.__caosFps=perfLastFps;perfFrames=0;perfWindowStart=t;const mobs=enemies.length;let next=perfMode;if(perfLastFps<40||mobs>=165)next=2;else if(perfLastFps<53||mobs>=90)next=Math.max(1,perfMode);else if(perfLastFps>58&&mobs<70)next=0;else if(perfLastFps>55&&mobs<110&&perfMode===2)next=1;if(next!==perfMode){perfMode=next;const target=perfMode===2?.56:perfMode===1?.76:1;if(Math.abs(renderScale-target)>.01){renderScale=target;resize()}}}",
"function tunePerformance(t){perfFrames++;if(t-perfWindowStart<800)return;perfLastFps=Math.max(1,Math.round(perfFrames*1000/(t-perfWindowStart)));window.__caosFps=perfLastFps;perfFrames=0;perfWindowStart=t;const mobs=enemies.length,corrupted=enemies.reduce((n,e)=>n+(!e.dead&&e.tier===2?1:0),0),load=mobs+corrupted*.75;let next=perfMode;if(perfLastFps<40||load>=165)next=2;else if(perfLastFps<53||load>=90)next=Math.max(1,perfMode);else if(perfLastFps>58&&load<70)next=0;else if(perfLastFps>55&&load<110&&perfMode===2)next=1;if(next!==perfMode){perfMode=next;const target=perfMode===2?.56:perfMode===1?.76:1;if(Math.abs(renderScale-target)>.01){renderScale=target;resize()}}}",
'corrupted weighted perf load'
);

fs.writeFileSync(path,s);
console.log('CORRUPTED WEIGHTED PERF PATCH APPLIED');
