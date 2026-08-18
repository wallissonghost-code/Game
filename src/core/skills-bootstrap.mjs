import * as CaosSkills from './skills.mjs?v=01745';
import * as CaosMobs from './mobs.mjs?v=01745';
import * as CaosCombat from './combat.mjs?v=01745';
import { patchNaturalEvents } from './natural-events-runtime.mjs?v=01746-events1';
import './hud-main.mjs?v=01745-main1';
import './live-hud.mjs?v=01745-live1';

CaosSkills.assertSkillCatalog();
CaosMobs.assertMobDomain();
CaosCombat.assertCombatDomain();
window.CaosSkills = Object.freeze({ ...CaosSkills });
window.CaosMobs = Object.freeze({ ...CaosMobs });
window.CaosCombat = Object.freeze({ ...CaosCombat });

function loadClassic(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(s);
  });
}

function fixClassicAimSync(source) {
  let patched = String(source || '');
  const staleClassic = "if(autoMode||gameplayMode==='classic'){target=focusedTarget();";
  if (!patched.includes(staleClassic)) throw new Error('Classic aim sync: patched shoot branch not found');
  patched = patched.replace(staleClassic, "if(autoMode){target=focusedTarget();");

  const staleDiagnostic = "const alive=enemies.filter(e=>!e.dead),target=autoTarget&&!autoTarget.dead?autoTarget:null,near=";
  const liveDiagnostic = "const alive=enemies.filter(e=>!e.dead),target=!autoMode&&gameplayMode==='classic'?nearestVisible():(autoTarget&&!autoTarget.dead?autoTarget:null),near=";
  if (!patched.includes(staleDiagnostic)) throw new Error('Classic aim sync: diagnostic target branch not found');
  patched = patched.replace(staleDiagnostic, liveDiagnostic);
  return patched;
}

async function loadPatchedClassic(src) {
  const response = await fetch(src, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to fetch runtime ${response.status}`);
  const original = await response.text();
  const patched = fixClassicAimSync(patchNaturalEvents(original));
  const blobUrl = URL.createObjectURL(new Blob([patched], { type: 'text/javascript' }));
  try { await loadClassic(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
}

const num=id=>Number(String(document.getElementById(id)?.textContent||'0').replace(/[^0-9.-]/g,''))||0;
function normalGameSnapshot(){
  const start=document.getElementById('start'),over=document.getElementById('over'),pause=document.getElementById('pause');
  const started=!!start&&!start.classList.contains('show');
  const ended=!!over?.classList.contains('show');
  return {
    type:'state',version:'0.17.46',running:started&&!ended,paused:!!pause?.classList.contains('show'),
    level:num('level'),xp:num('xp'),health:num('life'),maxHealth:100,mobs:num('mobCount'),
    kills:num('deathKills'),wave:num('deathWave'),score:0,fps:Number(window.__caosFps||window.caosCurrentFps||0)||0,
    autoMode:false,autofire:true,gameplayMode:'classic',events:null
  };
}
function readDiagnosticState(){return window.CaosStateSnapshot?.()||window.CaosTest?.snapshot?.()||normalGameSnapshot()}

function startDiagnosticsFeed(){
  let wasRunning=false,lastLevel=0,lastKills=0,finishedSession='';
  setInterval(()=>{
    try{
      const state=readDiagnosticState(),rec=window.CaosSessionRecorder;
      if(!state||!rec)return;
      if(state.running&&!wasRunning){
        rec.start();finishedSession='';
        rec.mark('run-start',{version:state.version||'0.17.46'});
        lastLevel=+state.level||0;lastKills=+state.kills||0;
      }
      if(state.running){
        rec.sample(state);
        if(+state.level>lastLevel&&lastLevel>0)rec.mark('level-up',{from:lastLevel,to:+state.level});
        if(+state.kills>lastKills+10)rec.mark('kill-burst',{from:lastKills,to:+state.kills});
        lastLevel=+state.level||lastLevel;lastKills=+state.kills||lastKills;
      }
      const overVisible=!!document.getElementById('over')?.classList.contains('show');
      if(((!state.running&&wasRunning)||overVisible)&&rec.id&&finishedSession!==rec.id){
        finishedSession=rec.id;
        rec.mark('run-end',{level:state.level,kills:state.kills,score:state.score});
        rec.finish({level:state.level,kills:state.kills,score:state.score});
      }
      wasRunning=!!state.running;
    }catch(e){console.warn('CAOS LOCAL DIAGNOSTICS',e)}
  },250);
}

const gameRuntimeUrl = new URL('../game.js?v=01746-events1', import.meta.url).href;
const multiplayerEntryUrl = new URL('../multiplayer-entry.js?v=01745-core3', import.meta.url).href;

try {
  await loadPatchedClassic(gameRuntimeUrl);
  await loadClassic(multiplayerEntryUrl);
  startDiagnosticsFeed();
  window.CaosRuntimeReady = true;
  window.dispatchEvent(new CustomEvent('caos:runtime-ready', { detail: { skills: true, mobs: true, combat: true, naturalEvents: true, diagnostics: true } }));
} catch (error) {
  console.error('CAOS CORE BOOTSTRAP', error);
  window.CaosRuntimeReady = false;
  window.dispatchEvent(new CustomEvent('caos:runtime-error', { detail: { message: String(error?.message || error) } }));
}
