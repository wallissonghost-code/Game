import * as CaosSkills from './skills.mjs?v=01745';
import './live-hud.mjs?v=01745-live1';
window.CaosSkills = CaosSkills;

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

const gameRuntimeUrl = new URL('../game.js?v=01745-skills1', import.meta.url).href;
const multiplayerEntryUrl = new URL('../multiplayer-entry.js?v=01745-skills1', import.meta.url).href;

try {
  await loadClassic(gameRuntimeUrl);
  await loadClassic(multiplayerEntryUrl);
  window.CaosRuntimeReady = true;
  window.dispatchEvent(new CustomEvent('caos:runtime-ready', { detail: { skills: true } }));
} catch (error) {
  console.error('CAOS SKILLS BOOTSTRAP', error);
  window.CaosRuntimeReady = false;
  window.dispatchEvent(new CustomEvent('caos:runtime-error', { detail: { message: String(error?.message || error) } }));
}
