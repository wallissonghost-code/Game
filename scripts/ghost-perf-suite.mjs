import { performance } from 'node:perf_hooks';
import fs from 'node:fs';

// Ghost Performance Suite
// IMPORTANT: GitHub Actions is not a phone/GPU benchmark. This suite measures
// relative CPU/algorithmic cost on the same runner and flags regressions.
// Real mobile FPS remains the final validation for Canvas/GPU-heavy effects.

const RUNS = Number(process.env.GHOST_PERF_RUNS || 7);
const FRAMES = Number(process.env.GHOST_PERF_FRAMES || 600);
const MOB_LEVELS = [0, 100, 200, 320];

function median(a){const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]||0;}
function pct(a,p){const b=[...a].sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor((b.length-1)*p))]||0;}
function bench(name, fn){
  // warmup removes most JIT noise
  for(let i=0;i<3;i++) fn();
  const samples=[];
  for(let r=0;r<RUNS;r++){
    const t0=performance.now(); fn(); samples.push(performance.now()-t0);
  }
  return {name, medianMs:+median(samples).toFixed(2), p95Ms:+pct(samples,.95).toFixed(2), samples:samples.map(x=>+x.toFixed(2))};
}

function makeMobs(n){
  return Array.from({length:n},(_,i)=>({x:(i*37)%1600,y:(i*61)%900,vx:0,vy:0,hp:100,fury:false,tier:i%31===0?'elite':'normal'}));
}
function simMobs(n, boss=false, fury=false){
  const mobs=makeMobs(n); const player={x:800,y:450};
  for(const m of mobs)m.fury=fury;
  let sink=0;
  for(let f=0;f<FRAMES;f++){
    for(const m of mobs){
      const dx=player.x-m.x,dy=player.y-m.y,d2=dx*dx+dy*dy+1;
      // representative movement/target/range arithmetic; no DOM/GPU pretending
      if(d2<900000){const inv=1/Math.sqrt(d2);const sp=m.fury?1.45:1;m.x+=dx*inv*sp;m.y+=dy*inv*sp;}
      if(m.tier==='elite')sink+=(m.x+m.y)*0.000001;
    }
    if(boss){const a=f*.021;sink+=Math.sin(a)*Math.cos(a*.7);}
  }
  return sink;
}
function simProjectiles(nMobs){
  const mobs=makeMobs(nMobs); let sink=0;
  const shots=Array.from({length:120},(_,i)=>({x:i*11,y:i*7,r:18}));
  for(let f=0;f<Math.floor(FRAMES/3);f++) for(const s of shots){
    s.x+=4.2;
    for(let i=0;i<mobs.length;i+=4){const m=mobs[i],dx=s.x-m.x,dy=s.y-m.y;if(dx*dx+dy*dy<900)sink++;}
  }
  return sink;
}
function simMap(){let sink=0;const chunks=Array.from({length:36},(_,i)=>({x:i%6,y:(i/6)|0,tiles:85}));
  for(let f=0;f<FRAMES;f++){const px=(f*3)%1536,py=(f*2)%1536;for(const c of chunks){const dx=c.x*256-px,dy=c.y*256-py;if(dx*dx+dy*dy<700*700)sink+=c.tiles;}}
  return sink;
}
function simFx(kind,count){let sink=0;for(let f=0;f<FRAMES;f++){const cap=kind==='fury'?1:(kind==='phoenix'?2:8);for(let i=0;i<Math.min(count,cap);i++){const a=(f+i)*.13;sink+=Math.sin(a)*Math.cos(a)*Math.sqrt(i+1);}}return sink;}

const tests=[];
tests.push(bench('baseline-loop',()=>simMobs(0)));
for(const n of MOB_LEVELS.slice(1))tests.push(bench(`mobs-${n}`,()=>simMobs(n)));
tests.push(bench('mobs-320-boss',()=>simMobs(320,true,false)));
tests.push(bench('mobs-320-fury-gameplay',()=>simMobs(320,false,true)));
tests.push(bench('projectiles-vs-320',()=>simProjectiles(320)));
tests.push(bench('map-6x6-chunks',()=>simMap()));
tests.push(bench('fx-fury-global',()=>simFx('fury',320)));
tests.push(bench('fx-phoenix-capped',()=>simFx('phoenix',320)));

const base=Math.max(.01,tests.find(x=>x.name==='mobs-100')?.medianMs||1);
for(const t of tests)t.relativeTo100Mobs=+(t.medianMs/base).toFixed(2);
const ranked=[...tests].filter(x=>x.name!=='baseline-loop').sort((a,b)=>b.medianMs-a.medianMs);
const report={
  suite:'Ghost Performance Suite v1',
  disclaimer:'Comparative CPU benchmark on GitHub runner; NOT a phone FPS/GPU simulation. Use it to find relative hotspots/regressions, then validate Canvas/GPU effects on a real device.',
  environment:{node:process.version,platform:process.platform,arch:process.arch,runs:RUNS,frames:FRAMES},
  tests,
  hotspots:ranked.slice(0,5).map((x,i)=>({rank:i+1,test:x.name,medianMs:x.medianMs,p95Ms:x.p95Ms}))
};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/ghost-perf-report.json',JSON.stringify(report,null,2));
console.log('\n=== GHOST PERFORMANCE REPORT ===');
console.log(report.disclaimer);
console.table(tests.map(x=>({test:x.name,median_ms:x.medianMs,p95_ms:x.p95Ms,'x_100mobs':x.relativeTo100Mobs})));
console.log('\nTOP HOTSPOTS');
console.table(report.hotspots);
console.log('REPORT: artifacts/ghost-perf-report.json');
