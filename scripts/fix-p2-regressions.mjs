import fs from 'node:fs';

function replaceOne(src, from, to, label){
  const count=src.split(from).length-1;
  if(count!==1)throw new Error(`${label}: expected 1 match, found ${count}`);
  return src.replace(from,to);
}

// 1) Natural events: accept the modularized render state where meteorShakeLeft
// is no longer declared in the same inline event-state block.
const eventPath='src/core/natural-events-runtime.mjs';
let events=fs.readFileSync(eventPath,'utf8');
const oldEventPatch=`  one(\n    \"doubleXpEvent=false,meteorEventActive=false,meteorSpawnTimer=.45,meteors=[],meteorShakeLeft=0,meteorConfig={interval:1.7,warning:1.8,radius:92,playerDamage:18,mobDamage:20,batch:1};\",\n    \"doubleXpEvent=false,meteorEventActive=false,doubleXpAdmin=false,meteorAdmin=false,naturalDoubleXpUntil=0,naturalMeteorUntil=0,naturalDoubleXpNextAt=0,naturalMeteorNextAt=0,meteorSpawnTimer=.45,meteors=[],meteorShakeLeft=0,meteorConfig={interval:1.7,warning:1,radius:100,playerDamage:15,mobDamage:5,batch:4};\",\n    'event-state'\n  );`;
const newEventPatch=`  const legacyEventState=\"doubleXpEvent=false,meteorEventActive=false,meteorSpawnTimer=.45,meteors=[],meteorShakeLeft=0,meteorConfig={interval:1.7,warning:1.8,radius:92,playerDamage:18,mobDamage:20,batch:1};\";\n  const modularEventState=\"doubleXpEvent=false,meteorEventActive=false,meteorSpawnTimer=.45,meteors=[],meteorConfig={interval:1.7,warning:1.8,radius:92,playerDamage:18,mobDamage:20,batch:1};\";\n  const patchedLegacyEventState=\"doubleXpEvent=false,meteorEventActive=false,doubleXpAdmin=false,meteorAdmin=false,naturalDoubleXpUntil=0,naturalMeteorUntil=0,naturalDoubleXpNextAt=0,naturalMeteorNextAt=0,meteorSpawnTimer=.45,meteors=[],meteorShakeLeft=0,meteorConfig={interval:1.7,warning:1,radius:100,playerDamage:15,mobDamage:5,batch:4};\";\n  const patchedModularEventState=\"doubleXpEvent=false,meteorEventActive=false,doubleXpAdmin=false,meteorAdmin=false,naturalDoubleXpUntil=0,naturalMeteorUntil=0,naturalDoubleXpNextAt=0,naturalMeteorNextAt=0,meteorSpawnTimer=.45,meteors=[],meteorConfig={interval:1.7,warning:1,radius:100,playerDamage:15,mobDamage:5,batch:4};\";\n  if(s.includes(legacyEventState)) one(legacyEventState,patchedLegacyEventState,'event-state');\n  else if(s.includes(modularEventState)) one(modularEventState,patchedModularEventState,'event-state');\n  else if(!s.includes('naturalDoubleXpNextAt=0')||!s.includes('naturalMeteorNextAt=0')) throw new Error('NaturalEvents/event-state: unsupported runtime state');`;
if(events.includes(oldEventPatch))events=events.replace(oldEventPatch,newEventPatch);
else if(!events.includes('const modularEventState='))throw new Error('natural-events event-state patch anchor missing');
fs.writeFileSync(eventPath,events);

// 2) Release guard: validate the new owning modules instead of requiring
// implementation details to stay inline in game.js.
const checkPath='scripts/check-game.mjs';
let check=fs.readFileSync(checkPath,'utf8');
if(!check.includes("const runtimeState=read('src/core/runtime-state.js');")){
  check=replaceOne(check,
    "const contracts=read('src/core/contracts.mjs');",
    "const contracts=read('src/core/contracts.mjs');\nconst runtimeState=read('src/core/runtime-state.js');\nconst matchState=read('src/core/match-state.mjs');",
    'check-game domain reads');
}
check=check.replace(
  "if(!game.includes('const duoPlayer=')) fail('estado P2 ausente'); else ok('estado P2 ativo');",
  "if(!(game.includes('runtimeState.createDuoPlayer()')&&runtimeState.includes('createDuoPlayer'))) fail('estado P2 ausente'); else ok('estado P2 ativo');"
);
check=check.replace(
  "if(!game.includes('function xpNeedFor(lv)')) fail('curva XP ausente'); else ok('curva XP ativa');",
  "if(!(game.includes('matchRuntime.xpNeedFor')&&matchState.includes('export function xpNeedFor(lv)'))) fail('curva XP ausente'); else ok('curva XP ativa');"
);
if(!check.includes("runtimeState.includes('createDuoPlayer')"))throw new Error('check-game P2 guard not migrated');
if(!check.includes("matchState.includes('export function xpNeedFor(lv)')"))throw new Error('check-game XP guard not migrated');
fs.writeFileSync(checkPath,check);

console.log('P2 regression repairs prepared: natural-events compatibility + modular release guards');
