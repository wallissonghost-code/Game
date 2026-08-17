// Loads core domains before the legacy gameplay runtime.
// Core modules are ESM, but the legacy runtimes must keep classic-script semantics
// until they are fully migrated. Loading them with import() can change global
// resolution/execution behavior and leave the start menu without handlers.
import * as CaosSkills from './skills.mjs';
import * as CaosMobs from './mobs.mjs';
import * as CaosCombat from './combat.mjs';
import * as CaosEvents from './events.mjs';
import * as CaosEffects from './effects.mjs';

CaosSkills.assertSkillCatalog();
CaosMobs.assertMobDomain();
CaosCombat.assertCombatDomain();
CaosEvents.assertEventDomain();
CaosEffects.assertEffectsDomain();
globalThis.CaosSkills = Object.freeze(CaosSkills);
globalThis.CaosMobs = Object.freeze(CaosMobs);
globalThis.CaosCombat = Object.freeze(CaosCombat);
globalThis.CaosEvents = Object.freeze(CaosEvents);
globalThis.CaosEffects = Object.freeze(CaosEffects);

const versionNode = document.getElementById('gameVersion');
const versionText = versionNode?.textContent || '';
const match = versionText.match(/v(\d+\.\d+\.\d+)/i);
const tag = (match?.[1] || '01744').replace(/\./g, '');

function loadClassic(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.body.appendChild(script);
  });
}

try {
  await loadClassic(`src/game.js?v=${tag}`);
  await loadClassic(`src/multiplayer-entry.js?v=${tag}`);
  globalThis.CaosRuntimeReady = true;
} catch (error) {
  console.error('[CAOS BOOT] runtime failed', error);
  globalThis.CaosRuntimeReady = false;
  const start = document.getElementById('start');
  const card = start?.querySelector('.startCard');
  if (card) {
    const warning = document.createElement('div');
    warning.style.cssText = 'margin-top:10px;padding:10px;border:1px solid #7f1d1d;border-radius:10px;background:#2b0b12;color:#fecaca;font:800 11px/1.35 system-ui';
    warning.textContent = 'ERRO AO CARREGAR O JOGO · atualize a página. Se continuar, informe o erro.';
    card.appendChild(warning);
  }
}
