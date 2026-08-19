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
"function updateMeteorEvent(dt){meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<meteorConfig.batch;i++)scheduleMeteor();meteorSpawnTimer=meteorConfig.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}",
"function updateMeteorEvent(dt){const frozen=performance.now()<freezeUntil;if(frozen){meteorShakeLeft=0;return}meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<meteorConfig.batch;i++)scheduleMeteor();meteorSpawnTimer=meteorConfig.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}",
'meteor freeze'
);

replaceOnce(
"function tierAura(e,img,w,h,isBoss){if(!img||isBoss||e.tier<1)return;const pulse=.82+Math.sin(e.t*3.2)*.18,sets=e.tier===1?[['#050816',18],['#3b82f6',12],['#a855f7',7]]:[['#000000',22],['#7f1d1d',14],['#ef4444',8]];ctx.save();ctx.globalCompositeOperation='source-over';for(const [color,blur] of sets){ctx.save();ctx.globalAlpha=.40*pulse;ctx.shadowColor=color;ctx.shadowBlur=perfMode>=2?Math.max(4,blur*.45):perfMode===1?blur*.7:blur;ctx.drawImage(img,-w/2,-h*.72,w,h);ctx.restore()}ctx.restore()}",
"function tierAura(e,img,w,h,isBoss){if(!img||isBoss||e.tier<1)return;const pulse=.82+Math.sin(e.t*3.2)*.18,sets=e.tier===1?[['#050816',18],['#3b82f6',12],['#a855f7',7]]:[['#000000',22],['#7f1d1d',14],['#ef4444',8]];ctx.save();ctx.globalCompositeOperation='source-over';if(e.tier===2&&perfMode>=1){ctx.globalAlpha=(perfMode>=2?.22:.28)*pulse;ctx.shadowColor='#ef4444';ctx.shadowBlur=perfMode>=2?4:7;ctx.drawImage(img,-w/2,-h*.72,w,h);ctx.restore();return}for(const [color,blur] of sets){ctx.save();ctx.globalAlpha=.40*pulse;ctx.shadowColor=color;ctx.shadowBlur=perfMode>=2?Math.max(4,blur*.45):perfMode===1?blur*.7:blur;ctx.drawImage(img,-w/2,-h*.72,w,h);ctx.restore()}ctx.restore()}",
'corrupted aura reduction'
);

replaceOnce(
"function tunePerformance(t){perfFrames++;if(t-perfWindowStart<800)return;perfLastFps=Math.max(1,Math.round(perfFrames*1000/(t-perfWindowStart)));window.__caosFps=perfLastFps;perfFrames=0;perfWindowStart=t;const mobs=enemies.length;let next=perfMode;if(perfLastFps<40||mobs>=165)next=2;else if(perfLastFps<53||mobs>=90)next=Math.max(1,perfMode);else if(perfLastFps>58&&mobs<70)next=0;else if(perfLastFps>55&&mobs<110&&perfMode===2)next=1;if(next!==perfMode){perfMode=next;const target=perfMode===2?.56:perfMode===1?.76:1;if(Math.abs(renderScale-target)>.01){renderScale=target;resize()}}}",
"function tunePerformance(t){perfFrames++;if(t-perfWindowStart<800)return;perfLastFps=Math.max(1,Math.round(perfFrames*1000/(t-perfWindowStart)));window.__caosFps=perfLastFps;perfFrames=0;perfWindowStart=t;const mobs=enemies.length,corrupted=enemies.reduce((n,e)=>n+(!e.dead&&e.tier===2?1:0),0),load=mobs+corrupted*.75;let next=perfMode;if(perfLastFps<40||load>=165)next=2;else if(perfLastFps<53||load>=90)next=Math.max(1,perfMode);else if(perfLastFps>58&&load<70)next=0;else if(perfLastFps>55&&load<110&&perfMode===2)next=1;if(next!==perfMode){perfMode=next;const target=perfMode===2?.56:perfMode===1?.76:1;if(Math.abs(renderScale-target)>.01){renderScale=target;resize()}}}",
'corrupted weighted perf load'
);

fs.writeFileSync(path,s);
console.log('SAFE PERF V2 APPLIED');
