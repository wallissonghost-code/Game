# Necromancer V0 — isolated prototype

Experimental module for the **Erga-se / Necromante** mechanic.

## Isolation contract
- This folder is experimental and must not be imported by the production runtime yet.
- No edits to `src/game.js`, `src/core/skills.mjs`, mob runtime, or production HUD are required for this prototype.
- The module is intentionally dependency-light so it can be wired into a test harness first and removed/moved cleanly.

## V0 rules
- Summons live until killed; there is no lifetime timer.
- Default summon cap: 3.
- Raised mobs preserve a snapshot of type/tier/base combat identity.
- Raised HP is amplified and also scales from the player so a normal mob is not immediately disposable.
- Enemy aggro toward shadows is opt-in/weighted by the host integration; the module itself never redirects the whole horde.
- Shadow kills grant Soul XP. Soul XP becomes banked upgrade points automatically; it never pauses gameplay.
- Upgrade points are spent only when the player opens the small Necromancer panel.
- V0 upgrades: Life, Damage, Regeneration, Armor.
- Shadow kills do not raise more shadows.

## Intended host hooks
`createNecromancerPrototype()` exposes `raise`, `update`, `damage`, `recordKill`, `spendPoint`, `snapshot`, and `removeDead`.

This is deliberately not registered in the normal skill catalog. If the mechanic survives playtesting, it should be integrated cleanly as a first-class domain instead of patched into `game.js`.