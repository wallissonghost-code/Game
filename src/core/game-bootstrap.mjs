// Loads core domains before the legacy gameplay runtime.
// This lets us extract subsystems incrementally without changing the public page contract.
import * as CaosSkills from './skills.mjs';

CaosSkills.assertSkillCatalog();
globalThis.CaosSkills = Object.freeze(CaosSkills);

const versionNode = document.getElementById('gameVersion');
const versionText = versionNode?.textContent || '';
const match = versionText.match(/v(\d+\.\d+\.\d+)/i);
const tag = (match?.[1] || '01743').replace(/\./g, '');

await import(`../game.js?v=${tag}`);
