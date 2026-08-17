// Caos Live skill domain
// Pure metadata + a small runtime factory. The gameplay runtime supplies only the mutable hooks it owns.

export const RARITY_LABEL = Object.freeze({
  common: 'COMUM',
  rare: 'RARA',
  epic: 'ÉPICA',
  legendary: 'LENDÁRIA',
  secret: 'SECRETA'
});

export const RARITY_WEIGHT = Object.freeze({
  common: 70,
  rare: 25,
  epic: 9,
  legendary: 3,
  secret: 0.35
});

export const SKILL_CAPS = Object.freeze({
  speed: 5,
  medic: 5,
  rapid: 5,
  regen: 5,
  armor: 4,
  xp: 5,
  blood: 5,
  flash: 5,
  arc: 5,
  pierce: 5,
  ghost: 5,
  dodge: 1,
  ice: 5,
  shock: 5,
  berserker: 5,
  explosive: 5,
  phoenix: 1
});

export const SKILL_IDS = Object.freeze(Object.keys(SKILL_CAPS));

const pct = values => level => values[level] ?? values.at(-1) ?? 0;

export const SKILL_BALANCE = Object.freeze({
  rapid: Object.freeze([0, 0.10, 0.20, 0.30, 0.45, 0.60]),
  regen: Object.freeze([0, 0.4, 0.6, 0.8, 1, 1.2]),
  armor: Object.freeze([0, 0.05, 0.09, 0.13, 0.18]),
  bloodChance: Object.freeze([0, 0.10, 0.12, 0.15, 0.18, 0.20]),
  bloodHeal: Object.freeze([0, 0.5, 0.75, 1, 1.5, 2]),
  flashDamage: Object.freeze([0, 8, 10, 12, 15, 18]),
  arcCooldown: Object.freeze([0, 8, 7.5, 7, 6.5, 6]),
  arcTargets: Object.freeze([0, 2, 2, 3, 3, 4]),
  arcDamage: Object.freeze([0, 2, 3, 4, 5, 6]),
  pierceEvery: Object.freeze([0, 12, 11, 10, 9, 8]),
  piercePass: Object.freeze([0, 2, 3, 4, 5, 7]),
  ghostDuration: Object.freeze([0, 0.35, 0.4, 0.45, 0.52, 0.6]),
  ghostCooldown: Object.freeze([0, 14, 13, 12, 10.5, 9]),
  iceSlow: Object.freeze([0, 12, 18, 24, 30, 35]),
  shockDamage: Object.freeze([0, 3, 4, 5, 6, 8]),
  shockStun: Object.freeze([0, 0.4, 0.5, 0.6, 0.75, 1]),
  shockCooldown: Object.freeze([0, 12, 11, 10, 9, 8]),
  berserkerRate: Object.freeze([0, 0.09, 0.13, 0.17, 0.21, 0.25]),
  berserkerDamage: Object.freeze([0, 0.06, 0.09, 0.12, 0.16, 0.20]),
  explosiveEvery: Object.freeze([0, 14, 13, 12, 11, 10]),
  explosiveRadius: Object.freeze([0, 65, 70, 75, 85, 95]),
  explosiveDamage: Object.freeze([0, 3, 4, 5, 6, 8])
});

function textNumber(value) {
  return String(value).replace('.', ',');
}

export function createSoloSkillSystem({
  player,
  onArcApply = () => {},
  onShockApply = () => {},
  onPhoenixApply = () => {}
}) {
  if (!player) throw new Error('CaosSkills: player runtime is required');

  const B = SKILL_BALANCE;
  const skills = [
    { id:'speed', n:'Passos de Guerra', i:'🥾', r:'common', cap:5,
      desc:l=>`Velocidade total +${l*10}%.`,
      apply:l=>{ player.speed=255*(1+l*.10); } },
    { id:'medic', n:'Kit Médico', i:'🩹', r:'common', cap:5,
      desc:l=>`+${l*10} de vida máxima; ao evoluir cura 25 HP.`,
      apply:()=>{ player.maxLife+=10; player.life=Math.min(player.maxLife,player.life+25); } },
    { id:'rapid', n:'Rajada Rápida', i:'⚡', r:'common', cap:5,
      desc:l=>`Cadência +${Math.round(pct(B.rapid)(l)*100)}%.`,
      apply:l=>{ player.fireRate=.28*(1-pct(B.rapid)(l)); } },
    { id:'regen', n:'Regeneração', i:'💚', r:'rare', cap:5,
      desc:l=>`Regen progressiva: ${textNumber(pct(B.regen)(l))} HP/s base; acelera após 3s, 6s e 10s sem sofrer dano.`,
      apply:l=>{ player.regen=pct(B.regen)(l); } },
    { id:'armor', n:'Armadura', i:'🛡️', r:'rare', cap:4,
      desc:l=>`${['','Bronze','Prata','Ouro','Diamante'][l]} · reduz ${Math.round(pct(B.armor)(l)*100)}% do dano recebido por criaturas.`,
      apply:l=>{ player.armorReduction=pct(B.armor)(l); } },
    { id:'xp', n:'Instinto de Caça', i:'✨', r:'rare', cap:5,
      desc:l=>`Recebe +${l*20}% de XP.`,
      apply:l=>{ player.xpMult=1+l*.20; } },
    { id:'blood', n:'Sanguinário', i:'🩸', r:'epic', cap:5,
      desc:l=>`A cada 10 abates: ${Math.round(pct(B.bloodChance)(l)*100)}% de +1 HP máximo; resto cura ${textNumber(pct(B.bloodHeal)(l))} HP.`,
      apply:l=>{ player.bloodChance=pct(B.bloodChance)(l); player.bloodHeal=pct(B.bloodHeal)(l); } },
    { id:'flash', n:'Flash de Luz', i:'☀️', r:'legendary', cap:5,
      desc:l=>`Feixe perfurante de ${pct(B.flashDamage)(l)} de dano a cada 5 tiros.`,
      apply:l=>{ player.flashDamage=pct(B.flashDamage)(l); } },
    { id:'arc', n:'Arco Voltaico', i:'⚡', r:'epic', cap:5,
      desc:l=>`Descarga a cada ${textNumber(pct(B.arcCooldown)(l))}s · até ${pct(B.arcTargets)(l)} alvos · ${pct(B.arcDamage)(l)} de dano por alvo.`,
      apply:l=>onArcApply(l) },
    { id:'pierce', n:'Munição Perfurante', i:'🎯', r:'epic', cap:5,
      desc:l=>`A cada ${pct(B.pierceEvery)(l)} tiros, 1 projétil atravessa até ${pct(B.piercePass)(l)} inimigos.`,
      apply:()=>{} },
    { id:'ghost', n:'Fantasma', i:'👻', r:'epic', cap:5,
      desc:l=>`Ao sofrer dano: intocável por ${textNumber(pct(B.ghostDuration)(l))}s · recarga ${textNumber(pct(B.ghostCooldown)(l))}s.`,
      apply:()=>{} },
    { id:'dodge', n:'Esquiva', i:'🌀', r:'secret', cap:1,
      desc:()=> 'Abaixo de 50% HP: esquiva de até 2 golpes · recarga 30s.',
      apply:()=>{} },
    { id:'ice', n:'Estilhaço de Gelo', i:'❄️', r:'epic', cap:5,
      desc:l=>l<5?`A cada 10 tiros: ${pct(B.iceSlow)(l)}% de lentidão por 1,5s.`:'A cada 10 tiros: congela o 1º alvo por 0,8s; com Perfurante, os seguintes recebem lentidão.',
      apply:()=>{} },
    { id:'shock', n:'Onda de Choque', i:'🌊', r:'legendary', cap:5,
      desc:l=>`5 ondas · ${pct(B.shockDamage)(l)} dano · stun ${textNumber(pct(B.shockStun)(l))}s · CD ${pct(B.shockCooldown)(l)}s.`,
      apply:l=>onShockApply(l) },
    { id:'berserker', n:'Berserker', i:'😡', r:'epic', cap:5,
      desc:l=>`HP baixo aumenta combate; no crítico até +${Math.round(pct(B.berserkerRate)(l)*100)}% cadência e +${Math.round(pct(B.berserkerDamage)(l)*100)}% dano.`,
      apply:()=>{} },
    { id:'explosive', n:'Munição Explosiva', i:'💣', r:'legendary', cap:5,
      desc:l=>`1 explosiva a cada ${pct(B.explosiveEvery)(l)} tiros · raio ${pct(B.explosiveRadius)(l)} · dano em área ${pct(B.explosiveDamage)(l)}.`,
      apply:()=>{} },
    { id:'phoenix', n:'Fênix', i:'🔥', r:'secret', cap:1,
      desc:()=> 'Skill única: revive 1x com 80% da vida máxima e 5s de proteção dourada.',
      apply:l=>onPhoenixApply(l) }
  ];

  return Object.freeze({
    rarityLabel: RARITY_LABEL,
    rarityWeight: RARITY_WEIGHT,
    skills: Object.freeze(skills)
  });
}

export function assertSkillCatalog() {
  const seen = new Set();
  for (const id of SKILL_IDS) {
    if (seen.has(id)) throw new Error(`duplicate skill id: ${id}`);
    seen.add(id);
    if (!Number.isInteger(SKILL_CAPS[id]) || SKILL_CAPS[id] < 1) throw new Error(`invalid cap for ${id}`);
  }
  return true;
}
