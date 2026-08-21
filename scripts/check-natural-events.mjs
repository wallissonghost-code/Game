import fs from 'node:fs';
import { patchNaturalEvents } from '../src/core/natural-events-runtime.mjs';

const original=fs.readFileSync('src/game.js','utf8');
const currentVersion=JSON.parse(fs.readFileSync('version.json','utf8')).version;

// The active runtime intentionally freezes the meteor loop while the
// global freeze skill is active. patchNaturalEvents owns the natural-event
// transformation, while skills-bootstrap preserves this freeze guard around
// that transformation. Reproduce the same compatibility path here instead of
// asking the event patch to match an obsolete pre-freeze loop verbatim.
const baseMeteor="function updateMeteorEvent(dt){meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<meteorConfig.batch;i++)scheduleMeteor();meteorSpawnTimer=meteorConfig.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}";
const frozenMeteor="function updateMeteorEvent(dt){const frozen=performance.now()<freezeUntil;if(frozen){meteorShakeLeft=0;return}meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<meteorConfig.batch;i++)scheduleMeteor();meteorSpawnTimer=meteorConfig.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}";
const eventMeteor="function updateMeteorEvent(dt){meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){const cfg=activeMeteorConfig();meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<cfg.batch;i++)scheduleMeteor();meteorSpawnTimer=cfg.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}";
const frozenEventMeteor="function updateMeteorEvent(dt){const frozen=performance.now()<freezeUntil;if(frozen){meteorShakeLeft=0;return}meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){const cfg=activeMeteorConfig();meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){for(let i=0;i<cfg.batch;i++)scheduleMeteor();meteorSpawnTimer=cfg.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}";

const materialized=original.includes(frozenMeteor);
let compatible=original;
if(materialized){
  compatible=compatible.replace(frozenMeteor,baseMeteor);
  compatible=compatible.replace(`VERSION='${currentVersion}'`,"VERSION='0.17.45'");
}
let patched=patchNaturalEvents(compatible);
if(materialized){
  if(!patched.includes(eventMeteor))throw Error('MeteorCompat: natural event loop not found after patch');
  patched=patched.replace(eventMeteor,frozenEventMeteor);
}
new Function(patched);

const required=[
  `VERSION='${currentVersion}'`,
  'NATURAL_METEOR_CONFIG',
  'naturalDoubleXpNextAt',
  'naturalMeteorNextAt',
  'startNaturalDoubleXp',
  'startNaturalMeteor',
  'updateNaturalEvents',
  'drawEventHud',
  "gainXP(e.xp*(e.xpEventMul||1)*.25)",
  "doubleXpAdmin?'ADM'",
  "meteorAdmin?'ADM'",
  'const frozen=performance.now()<freezeUntil'
];
for(const token of required)if(!patched.includes(token))throw Error(`native event token missing: ${token}`);

console.log('NATURAL EVENTS OK',{
  originalBytes:original.length,
  patchedBytes:patched.length,
  meteor:{interval:1.7,warning:1,radius:100,playerDamage:15,mobDamage:5,batch:4},
  doubleXp:{durationMinutes:[2,2.5,3,3.5,4],cooldownMinutes:[8,10]},
  meteorTimer:{durationMinutes:[1,1.5,2,2.5,3],cooldownMinutes:[8,12]},
  overlap:true,
  meteorXp:{touched:1,untouched:.25},
  freezeCompatible:materialized
});
