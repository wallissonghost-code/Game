(()=>{'use strict';
const base=window.CaosNecromancerCompanion;
if(!base||base.__lifecycleV1)return;
const originalApply=base.apply;
function apply(source){
  let out=originalApply(source);
  if(typeof out!=='string'||out.includes('CAOS_NECROMANCER_LIFECYCLE_V1'))return out;
  if(!out.includes('function updateNecromancer(dt){')||!out.includes('function reset(){')||!out.includes('function beginDeath(e){'))return out;

  const lifecycle=`/*CAOS_NECROMANCER_LIFECYCLE_V1*/
let necroRunEnded=false,necroResumeGuardAt=0;
function necroClearArmy(reason='reset'){
  for(const s of necroSummons)necroReleaseDuel(s);
  for(const e of enemies)if(e&&e.necroDuelShadowId)delete e.necroDuelShadowId;
  necroSummons=[];
  necroKillMeter=0;
  necroSeq=0;
  necroSoulLevel=1;
  necroSoulXp=0;
  necroSoulPoints=0;
  necroSoulKills=0;
  necroUpgrades={life:0,damage:0,regen:0,armor:0};
  necroRefreshHud(true);
  return reason;
}
function necroValidateDuels(){
  for(const s of necroSummons){
    if(!s||s.dead)continue;
    const t=s.necroDuelTarget;
    if(t&&(!enemies.includes(t)||t.dead||!(t.hp>0)))necroReleaseDuel(s);
  }
  for(const e of enemies){
    if(!e||e.dead||!e.necroDuelShadowId)continue;
    if(!necroShadowById(e.necroDuelShadowId))delete e.necroDuelShadowId;
  }
}
function necroOnResume(){
  if(document.hidden)return;
  necroValidateDuels();
  const now=performance.now();
  necroResumeGuardAt=now+220;
  for(const s of necroSummons){
    if(!s||s.dead)continue;
    s.necroNextAttack=Math.max(s.necroNextAttack||0,now+120);
  }
  last=now;
}
if(!window.__caosNecroLifecycleVisibility){
  window.__caosNecroLifecycleVisibility=true;
  document.addEventListener('visibilitychange',necroOnResume,{passive:true});
  window.addEventListener('pageshow',necroOnResume,{passive:true});
}
`;
  out=out.replace('function updateNecromancer(dt){',lifecycle+`function updateNecromancer(dt){
 dt=Math.min(.033,Math.max(0,Number(dt)||0));
 if(deathState){if(!necroRunEnded){necroClearArmy('death');necroRunEnded=true}return}
 if(necroRunEnded)necroRunEnded=false;
 necroValidateDuels();`);

  out=out.replace('function reset(){','function reset(){necroClearArmy(\'new-run\');necroRunEnded=false;');
  out=out.replace("function beginDeath(e){if(deathState)return;","function beginDeath(e){if(deathState)return;necroClearArmy('death');necroRunEnded=true;");
  out=out.replace('const locked=s.necroDuelTarget;if(locked&&!locked.dead&&locked.hp>0)return locked;','const locked=s.necroDuelTarget;if(locked&&enemies.includes(locked)&&!locked.dead&&locked.hp>0)return locked;');
  return out;
}
window.CaosNecromancerCompanion=Object.freeze({...base,apply,version:String(base.version||'0.3.0')+'+lifecycle1',__lifecycleV1:true});
})();

(()=>{'use strict';
const base=window.CaosNecromancerCompanion;
if(!base||base.__hudSlotV3)return;
const originalApply=base.apply;
function apply(source){
  let out=originalApply(source);
  if(typeof out!=='string'||out.includes('CAOS_NECROMANCER_HUD_SLOT_V3'))return out;
  const a=out.indexOf('function necroEnsureHud(){');
  const b=out.indexOf('function necroRefreshHud(force=false){',a);
  const c=out.indexOf('function necroRecalc(',b);
  if(a<0||b<0||c<0){console.warn('NECROMANCER HUD: patch target not found');return out}
  const hud=`/*CAOS_NECROMANCER_HUD_SLOT_V3*/
function necroDirectHudSlot(){
  const slot=$('xpBarValue');
  if(!slot)return null;
  slot.dataset.necroHudSlot='1';
  slot.setAttribute('aria-label','Necromante');
  slot.style.setProperty('font-size','0','important');
  slot.style.setProperty('color','transparent','important');
  slot.style.setProperty('text-shadow','none','important');
  slot.style.setProperty('min-width','34px','important');
  slot.style.setProperty('width','34px','important');
  slot.style.setProperty('max-width','34px','important');
  slot.style.setProperty('height','100%','important');
  slot.style.setProperty('pointer-events','auto','important');
  return slot;
}
function necroDrawHudIcon(){
  const cv=$('necroHudCanvas');if(!cv)return;const dpr=Math.min(2,window.devicePixelRatio||1),css=24;
  if(cv.width!==css*dpr){cv.width=css*dpr;cv.height=css*dpr;cv.style.width=css+'px';cv.style.height=css+'px'}
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,css,css);
  const active=!!necroEnabled,count=necroSummons.length,max=Math.max(1,necroConfig.maxSummons);
  g.strokeStyle=active?'#8ee6bb':'#64748b';g.fillStyle=active?'#8ee6bb':'#64748b';g.lineWidth=1.35;g.lineCap='round';g.lineJoin='round';
  g.beginPath();g.arc(12,10.8,6.6,Math.PI*.14,Math.PI*.86,true);g.stroke();
  g.beginPath();g.moveTo(7.5,9.8);g.lineTo(9.5,7.4);g.lineTo(11.4,9.5);g.lineTo(13.5,7.4);g.lineTo(16.5,9.8);g.stroke();
  g.beginPath();g.arc(9.8,11.7,.9,0,Math.PI*2);g.arc(14.2,11.7,.9,0,Math.PI*2);g.fill();
  g.beginPath();g.moveTo(10.6,14.2);g.lineTo(12,13.2);g.lineTo(13.4,14.2);g.stroke();
  const dots=Math.min(max,5),spread=12;for(let i=0;i<dots;i++){const x=dots===1?12:6+i*(spread/(dots-1));g.globalAlpha=i<count?1:.20;g.beginPath();g.arc(x,20,1.05,0,Math.PI*2);g.fill()}g.globalAlpha=1;
}
function necroPlaceHud(){
  const wrap=$('necroHud'),slot=necroDirectHudSlot();if(!wrap||!slot)return;
  const r=slot.getBoundingClientRect(),size=Math.max(24,Math.min(30,r.height||26));
  wrap.style.left=Math.round(r.left+(r.width-size)/2)+'px';
  wrap.style.top=Math.round(r.top+(r.height-size)/2)+'px';
  wrap.style.width=size+'px';wrap.style.height=size+'px';
}
function necroEnsureHud(){
  if(necroHudReady){necroPlaceHud();necroDrawHudIcon();return}
  const stage=$('stage');if(!stage)return;necroHudReady=true;
  const wrap=document.createElement('div');wrap.id='necroHud';wrap.style.cssText='position:fixed;z-index:9;left:12px;top:120px;width:28px;height:28px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;pointer-events:auto';
  wrap.innerHTML='<button id="necroHudBtn" aria-label="Abrir painel do Necromante" title="Necromante" style="width:100%;height:100%;display:grid;place-items:center;border:1px solid rgba(93,192,142,.42);background:linear-gradient(180deg,rgba(8,21,18,.96),rgba(5,13,12,.96));border-radius:9px;padding:1px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)"><canvas id="necroHudCanvas" aria-hidden="true"></canvas></button><div id="necroPanel" style="display:none;position:absolute;left:0;top:calc(100% + 6px);width:220px;padding:10px;border:1px solid #315f4d;border-radius:12px;background:#08100df2;box-shadow:0 12px 30px rgba(0,0,0,.35)"><div style="font-size:9px;letter-spacing:.14em;color:#a7f3d0">NECROMANTE</div><div id="necroPanelStats" style="margin:7px 0 9px;color:#d1fae5;font-size:9px;line-height:1.5"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><button data-necro-up="life">VIDA</button><button data-necro-up="damage">DANO</button><button data-necro-up="regen">REGEN</button><button data-necro-up="armor">ARMOR</button></div></div>';
  stage.appendChild(wrap);const panel=wrap.querySelector('#necroPanel'),btn=wrap.querySelector('#necroHudBtn');btn.onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none';
  for(const u of panel.querySelectorAll('[data-necro-up]')){u.style.cssText='padding:7px;border:1px solid #315f4d;border-radius:8px;background:#0b1511;color:#d1fae5;font-size:8px;font-weight:950';u.onclick=()=>necroSpend(u.dataset.necroUp,1)}
  necroPlaceHud();necroDrawHudIcon();
}
function necroRefreshHud(force=false){
  const now=performance.now();if(!force&&now<necroLastHudAt)return;necroLastHudAt=now+250;necroEnsureHud();const btn=$('necroHudBtn'),stats=$('necroPanelStats');
  if(btn){btn.style.opacity=necroEnabled?'1':'.55';btn.style.borderColor=necroEnabled?'rgba(93,192,142,.58)':'rgba(100,116,139,.34)'}necroDrawHudIcon();
  if(stats)stats.innerHTML=(necroEnabled?'ATIVO':'DESATIVADO')+' · ALMA NV '+necroSoulLevel+'<br>PONTOS '+necroSoulPoints+' · XP '+Math.floor(necroSoulXp)+'/'+necroXpNeed()+'<br>ABATES '+necroSoulKills+' · VIDA +'+(necroUpgrades.life*10)+'%<br>DANO +'+(necroUpgrades.damage*8)+'% · ARMOR '+(necroUpgrades.armor*4)+'%';necroPlaceHud();
}
`;
  out=out.slice(0,a)+hud+out.slice(c);return out;
}
window.CaosNecromancerCompanion=Object.freeze({...base,apply,version:String(base.version||'0.3.0')+'+hudslot3',__hudSlotV3:true});
})();
