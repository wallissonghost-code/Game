import fs from 'node:fs';

const path='src/game.js';
let s=fs.readFileSync(path,'utf8');

const auraRe=/function tierAura\(e,img,w,h,isBoss\)\{[\s\S]*?\nfunction bossVariantAura/;
if(!auraRe.test(s))throw new Error('SPECIAL LOD: tierAura boundary not found');
const aura=`let specialFxLod=0,specialVisibleCount=0;
function tierAura(e,img,w,h,isBoss){if(!img||isBoss||e.tier<1)return;const pulse=.82+Math.sin(e.t*3.2)*.18;if(specialFxLod>=2){ctx.save();ctx.globalAlpha=(e.tier===2?.16:.12)*pulse;ctx.shadowColor=e.tier===2?'#ef4444':'#8b5cf6';ctx.shadowBlur=2;ctx.drawImage(img,-w/2,-h*.72,w,h);ctx.restore();return}if(specialFxLod===1){ctx.save();ctx.globalAlpha=(e.tier===2?.24:.20)*pulse;ctx.shadowColor=e.tier===2?'#ef4444':'#8b5cf6';ctx.shadowBlur=e.tier===2?5:4;ctx.drawImage(img,-w/2,-h*.72,w,h);ctx.restore();return}const sets=e.tier===1?[['#050816',18],['#3b82f6',12],['#a855f7',7]]:[['#000000',22],['#7f1d1d',14],['#ef4444',8]];ctx.save();ctx.globalCompositeOperation='source-over';for(const [color,blur] of sets){ctx.save();ctx.globalAlpha=.40*pulse;ctx.shadowColor=color;ctx.shadowBlur=blur;ctx.drawImage(img,-w/2,-h*.72,w,h);ctx.restore()}ctx.restore()}
function bossVariantAura`;
s=s.replace(auraRe,aura);

const drawOld="for(const e of enemies){const p=world(e.x,e.y),m=e.r+46;if(p.x<-m||p.x>W+m||p.y<-m||p.y>H+m)continue;drawEnemy(e,p)}";
const drawNew="const visibleEnemies=[];specialVisibleCount=0;for(const e of enemies){const p=world(e.x,e.y),m=e.r+46;if(p.x<-m||p.x>W+m||p.y<-m||p.y>H+m)continue;visibleEnemies.push([e,p]);if(e.tier>0&&!types[e.type]?.boss)specialVisibleCount++}specialFxLod=(specialVisibleCount>=60||perfMode>=2)?2:(specialVisibleCount>=24||perfMode>=1)?1:0;for(const [e,p] of visibleEnemies)drawEnemy(e,p)";
if(!s.includes(drawOld))throw new Error('SPECIAL LOD: draw loop not found');
s=s.replace(drawOld,drawNew);
fs.writeFileSync(path,s);

// Keep architecture CI aligned with the current bootstrap. The runtime is intentionally
// loaded through loadPatchedClassic() so natural-events/aim compatibility patches apply.
const archPath='scripts/check-architecture.mjs';
let a=fs.readFileSync(archPath,'utf8');
const replacements=[
  ["new URL('../game.js?v=01745-core3', import.meta.url)","new URL('../game.js?v=01746-close-parallax2', import.meta.url)"],
  ["if (!skillsBootstrap.includes('await loadClassic(gameRuntimeUrl)')) fail('skills bootstrap does not start classic gameplay runtime');","if (!skillsBootstrap.includes('await loadPatchedClassic(gameRuntimeUrl)')) fail('skills bootstrap does not start patched classic gameplay runtime');"],
  ["else ok('skills bootstrap starts classic gameplay runtime');","else ok('skills bootstrap starts patched classic gameplay runtime');"]
];
for(const [from,to] of replacements){if(!a.includes(from))throw new Error('ARCH PATCH missing: '+from);a=a.replace(from,to)}
fs.writeFileSync(archPath,a);

console.log('SPECIAL MOB LOD APPLIED');
console.log('LOD 0: <24 specials; LOD 1: >=24; LOD 2: >=60 or perfMode 2');
console.log('ARCHITECTURE CHECK ALIGNED WITH CURRENT BOOTSTRAP');