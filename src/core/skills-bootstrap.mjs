import * as CaosSkills from './skills.mjs?v=01745';
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

try {
  await loadClassic('../game.js?v=01745-skills1');
  await loadClassic('../multiplayer-entry.js?v=01745-skills1');
  window.CaosRuntimeReady = true;
  window.dispatchEvent(new CustomEvent('caos:runtime-ready', { detail: { skills: true } }));
} catch (error) {
  console.error('CAOS SKILLS BOOTSTRAP', error);
  window.CaosRuntimeReady = false;
  window.dispatchEvent(new CustomEvent('caos:runtime-error', { detail: { message: String(error?.message || error) } }));
}
