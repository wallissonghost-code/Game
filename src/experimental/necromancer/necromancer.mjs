const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const NECROMANCER_V0=Object.freeze({
  maxSummons:3,
  baseHpMultiplier:5,
  playerHpShare:.65,
  baseDamageMultiplier:.55,
  playerDamageShare:.30,
  soulXpPerKill:1,
  soulXpBase:18,
  soulXpGrowth:1.28,
  upgrades:Object.freeze({life:10,damage:8,regen:.35,armor:4})
});

function requiredSoulXp(level,cfg){return Math.max(1,Math.round(cfg.soulXpBase*Math.pow(cfg.soulXpGrowth,Math.max(0,level-1))))}
function publicShadow(s){return {id:s.id,type:s.type,tier:s.tier,boss:s.boss,x:s.x,y:s.y,r:s.r,life:s.life,maxLife:s.maxLife,damage:s.damage,kills:s.kills,dead:s.dead,createdAt:s.createdAt,sourceMax:s.sourceMax}}

export function createNecromancerPrototype(options={}){
  const cfg={...NECROMANCER_V0,...options};
  const state={summons:[],soulLevel:1,soulXp:0,soulPoints:0,totalSoulKills:0,upgrades:{life:0,damage:0,regen:0,armor:0},seq:0};

  function bonuses(){
    return {
      lifeMul:1+state.upgrades.life*(cfg.upgrades.life/100),
      damageMul:1+state.upgrades.damage*(cfg.upgrades.damage/100),
      regenPerSecond:state.upgrades.regen*cfg.upgrades.regen,
      armorReduction:clamp(state.upgrades.armor*(cfg.upgrades.armor/100),0,.65)
    };
  }

  function recalc(s,player={}){
    const b=bonuses(),oldMax=s.maxLife||1,ratio=clamp(s.life/oldMax,0,1);
    const baseMax=Math.max(20,s.sourceMax*cfg.baseHpMultiplier+(player.maxLife||100)*cfg.playerHpShare);
    s.maxLife=Math.round(baseMax*b.lifeMul);
    s.life=Math.max(1,Math.round(s.maxLife*ratio));
    s.damage=Math.max(1,(s.sourceDamage*cfg.baseDamageMultiplier+(player.damage||1)*cfg.playerDamageShare)*b.damageMul);
    return s;
  }

  function raise(enemy,player={}){
    if(!enemy)return null;
    if(state.summons.length>=cfg.maxSummons)return null;
    const now=performance.now(),s={
      id:`shadow-${++state.seq}`,type:enemy.type||'normal',tier:enemy.tier??0,boss:!!enemy.boss||enemy.max>=100,
      x:enemy.x||0,y:enemy.y||0,r:enemy.r||14,sourceMax:Math.max(1,enemy.max||enemy.hp||20),sourceDamage:Math.max(1,enemy.damage||1),
      life:1,maxLife:1,damage:1,kills:0,dead:false,createdAt:now,lastDamageAt:0
    };
    recalc(s,player);s.life=s.maxLife;state.summons.push(s);return publicShadow(s);
  }

  function damage(id,rawDamage){
    const s=state.summons.find(x=>x.id===id&&!x.dead);if(!s)return null;
    const reduction=bonuses().armorReduction,amount=Math.max(1,(Number(rawDamage)||0)*(1-reduction));
    s.life=Math.max(0,s.life-amount);s.lastDamageAt=performance.now();if(s.life<=0)s.dead=true;return {shadow:publicShadow(s),damage:amount};
  }

  function recordKill(id,{soulXp=cfg.soulXpPerKill}={}){
    const s=state.summons.find(x=>x.id===id&&!x.dead);if(!s)return false;
    s.kills++;state.totalSoulKills++;state.soulXp+=Math.max(0,soulXp);
    while(state.soulXp>=requiredSoulXp(state.soulLevel,cfg)){
      state.soulXp-=requiredSoulXp(state.soulLevel,cfg);state.soulLevel++;state.soulPoints++;
    }
    return true;
  }

  function spendPoint(key,player={}){
    if(state.soulPoints<=0||!(key in state.upgrades))return false;
    state.soulPoints--;state.upgrades[key]++;
    for(const s of state.summons)if(!s.dead)recalc(s,player);
    return true;
  }

  function update(dt,player={}){
    const b=bonuses();
    for(const s of state.summons){if(s.dead)continue;if(b.regenPerSecond>0&&performance.now()-s.lastDamageAt>1800)s.life=Math.min(s.maxLife,s.life+b.regenPerSecond*dt);}
  }

  function removeDead(){const dead=state.summons.filter(s=>s.dead).map(publicShadow);state.summons=state.summons.filter(s=>!s.dead);return dead}
  function snapshot(){return {soulLevel:state.soulLevel,soulXp:state.soulXp,soulXpNeed:requiredSoulXp(state.soulLevel,cfg),soulPoints:state.soulPoints,totalSoulKills:state.totalSoulKills,upgrades:{...state.upgrades},summons:state.summons.map(publicShadow),maxSummons:cfg.maxSummons}}

  return Object.freeze({raise,damage,recordKill,spendPoint,update,removeDead,snapshot});
}

export function assertNecromancerPrototype(){
  const n=createNecromancerPrototype({soulXpBase:2,soulXpGrowth:1});
  const s=n.raise({type:'ogre',tier:0,max:20,damage:4,x:0,y:0,r:12},{maxLife:100,damage:10});
  if(!s||s.maxLife<=20)throw Error('Necromancer V0: raise scaling failed');
  n.recordKill(s.id);n.recordKill(s.id);if(n.snapshot().soulPoints!==1)throw Error('Necromancer V0: soul point failed');
  return true;
}