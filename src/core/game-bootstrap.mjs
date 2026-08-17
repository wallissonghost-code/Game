// Loads core domains before the legacy gameplay runtime.
// This lets us extract subsystems incrementally without changing the public page contract.
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
const tag = (match?.[1] || '01743').replace(/\./g, '');

await import(`../game.js?v=${tag}`);
await import(`../multiplayer-entry.js?v=${tag}`);
