import fs from 'node:fs';
import { patchNaturalEvents } from '../src/core/natural-events-runtime.mjs';

const original=fs.readFileSync('src/game.js','utf8');
const patched=patchNaturalEvents(original);
new Function(patched);

const required=[
  "VERSION='0.17.46'",
  'NATURAL_METEOR_CONFIG',
  'naturalDoubleXpNextAt',
  'naturalMeteorNextAt',
  'startNaturalDoubleXp',
  'startNaturalMeteor',
  'updateNaturalEvents',
  'drawEventHud',
  "gainXP(e.xp*(e.xpEventMul||1)*.25)",
  "doubleXpAdmin?'ADM'",
  "meteorAdmin?'ADM'"
];
for(const token of required)if(!patched.includes(token))throw Error(`native event token missing: ${token}`);

console.log('NATURAL EVENTS OK',{
  originalBytes:original.length,
  patchedBytes:patched.length,
  meteor:{interval:1.7,warning:1,radius:100,playerDamage:15,mobDamage:5,batch:4},
  doubleXp:{durationMinutes:[2,2.5,3,3.5,4],cooldownMinutes:[8,10]},
  meteorTimer:{durationMinutes:[1,1.5,2,2.5,3],cooldownMinutes:[8,12]},
  overlap:true,
  meteorXp:{touched:1,untouched:.25}
});
