import fs from 'node:fs';

const path='src/game.js';
let s=fs.readFileSync(path,'utf8');

const auraRe=/function tierAura\(e,img,w,h,isBoss\)\{[\s\S]*?\nfunction bossVariantAura/;
if(!auraRe.test(s))throw new Error('SPECIAL FX PERF: tierAura boundary not found');

const aura=`function tierAura(e,img,w,h,isBoss){
  if(!img||isBoss||e.tier<1)return;
  // Elites/Corrompidos antes redesenhavam a mesma skin ate 3x com shadowBlur.
  // Com muitos mobs isso vira o principal gargalo de GPU/canvas.
  // Mantemos no maximo 1 glow extra e removemos completamente o blur em hordas grandes.
  const crowd=enemies.length;
  if(crowd>=80||perfMode>=2)return;
  const pulse=.84+Math.sin(e.t*2.6)*.16;
  ctx.save();
  ctx.globalAlpha=(crowd>=30?(e.tier===2?.13:.10):(e.tier===2?.22:.17))*pulse;
  ctx.shadowColor=e.tier===2?'#ef4444':'#8b5cf6';
  ctx.shadowBlur=crowd>=30?2:(e.tier===2?6:5);
  ctx.drawImage(img,-w/2,-h*.72,w,h);
  ctx.restore();
}
function bossVariantAura`;

s=s.replace(auraRe,aura);
fs.writeFileSync(path,s);

console.log('SPECIAL MOB FX PERF APPLIED');
console.log('>=80 mobs: aura extra OFF');
console.log('30-79 mobs: 1 glow minimo');
console.log('<30 mobs: 1 glow leve');
