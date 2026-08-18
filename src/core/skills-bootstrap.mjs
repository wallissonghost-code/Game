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

async function loadPatchedClassic(src) {
  const response = await fetch(src, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to fetch runtime ${response.status}`);
  const original = await response.text();
  const patched = patchNaturalEvents(original);
  const blobUrl = URL.createObjectURL(new Blob([patched], { type: 'text/javascript' }));
  try {
    await loadClassic(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

const gameRuntimeUrl = new URL('../game.js?v=01746-events1', import.meta.url).href;
const multiplayerEntryUrl = new URL('../multiplayer-entry.js?v=01745-core3', import.meta.url).href;

try {
  await loadPatchedClassic(gameRuntimeUrl);
  await loadClassic(multiplayerEntryUrl);
  window.CaosRuntimeReady = true;
  window.dispatchEvent(new CustomEvent('caos:runtime-ready', { detail: { skills: true, mobs: true, combat: true, naturalEvents: true } }));
} catch (error) {
  console.error('CAOS CORE BOOTSTRAP', error);
  window.CaosRuntimeReady = false;
  window.dispatchEvent(new CustomEvent('caos:runtime-error', { detail: { message: String(error?.message || error) } }));
}
