// Caos Live core contracts
// Canonical definitions live here so Solo, Multiplayer, Labs and CI have one source of truth.

export const CORE_SCHEMA_VERSION = 1;

export const ENEMY_TYPES = Object.freeze({
  wraith: Object.freeze({ name: 'Ogro Espectro', r: 15, speed: 96, hp: 3, damage: 2, xp: 7 }),
  reaper: Object.freeze({ name: 'Ogro Ceifador', r: 21, speed: 67, hp: 8, damage: 4, xp: 18 }),
  infected: Object.freeze({ name: 'Ogro Infectado', r: 17, speed: 76, hp: 5, damage: 3, xp: 10 }),
  crawler: Object.freeze({ name: 'Ogro das Sombras', r: 16, speed: 124, hp: 4, damage: 2, xp: 9 }),
  eye: Object.freeze({ name: 'Ogro Observador', r: 16, speed: 86, hp: 5, damage: 2, xp: 11 }),
  brute: Object.freeze({ name: 'Ogro Brutamonte', r: 24, speed: 54, hp: 14, damage: 5, xp: 24 }),
  colossus: Object.freeze({ name: 'Ogro Colosso', r: 42, speed: 42, hp: 100, damage: 8, xp: 150, boss: true }),
  voidlord: Object.freeze({ name: 'Ogro do Vazio', r: 39, speed: 55, hp: 100, damage: 7, xp: 170, boss: true })
});

export const TIER_VARIANTS = Object.freeze({
  normal: Object.freeze({ hp: 1, dmg: 1, speed: 1, xp: 1, hitbox: 1 }),
  elite1: Object.freeze({ hp: 3, dmg: 1.7, speed: 1.05, xp: 3.5, hitbox: 1 }),
  elite2: Object.freeze({ hp: 4.2, dmg: 2.05, speed: 1.10, xp: 4.2, hitbox: 1.08 }),
  corrupted1: Object.freeze({ hp: 5, dmg: 2.2, speed: 1.10, xp: 5.5, hitbox: 1.14 }),
  corrupted2: Object.freeze({ hp: 7, dmg: 2.75, speed: 1.16, xp: 6.5, hitbox: 1.20 })
});

export const BOSS_VARIANTS = Object.freeze({
  normal: Object.freeze({ hp: 1, dmg: 1, speed: 1, xp: 1 }),
  elite: Object.freeze({ hp: 1.75, dmg: 1.25, speed: 1.05, xp: 1.75 }),
  corrupted: Object.freeze({ hp: 2.5, dmg: 1.5, speed: 1.10, xp: 2.5 })
});

export const RARITY_WEIGHT = Object.freeze({
  common: 70,
  rare: 25,
  epic: 9,
  legendary: 3,
  secret: 0.35
});

export const SOLO_SKILL_IDS = Object.freeze([
  'speed', 'medic', 'rapid', 'xp', 'flash', 'regen', 'blood', 'arc', 'phoenix',
  'armor', 'pierce', 'ghost', 'dodge', 'ice', 'shock', 'berserker', 'explosive', 'guardian'
]);

export const MULTIPLAYER_SKILL_IDS = Object.freeze([
  'speed', 'medic', 'rapid', 'xp', 'flash', 'regen', 'blood', 'arc', 'phoenix', 'armor', 'pierce'
]);

export const MULTIPLAYER_SKILL_GAP = Object.freeze(
  SOLO_SKILL_IDS.filter(id => !MULTIPLAYER_SKILL_IDS.includes(id))
);

export const LIMITS = Object.freeze({
  solo: Object.freeze({ maxEnemies: 320 }),
  multiplayer: Object.freeze({ tickRate: 30, snapshotRate: 20, maxEnemies: 180, maxBullets: 260 })
});

export function xpNeedFor(level) {
  const lv = Math.max(1, Number(level) || 1);
  const base = 60 * Math.pow(lv, 1.42);
  const mult = lv >= 90 ? 1.70 : lv >= 80 ? 1.50 : lv >= 60 ? 1.30 : lv >= 40 ? 1.12 : 1;
  return Math.floor(base * mult);
}
