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
if(!base||base.__hudSlotV2)return;
const originalApply=base.apply;
function apply(source){
  let out=originalApply(source);
  if(typeof out!=='string'||out.includes('CAOS_NECROMANCER_HUD_SLOT_V2'))return out;
  const a=out.indexOf('function necroEnsureHud(){');
  const b=out.indexOf('function necroRefreshHud(force=false){',a);
  const c=out.indexOf('function necroRecalc(',b);
  if(a<0||b<0||c<0){console.warn('NECROMANCER HUD: patch target not found');return out}
  const hud=`/*CAOS_NECROMANCER_HUD_SLOT_V2*/
function necroFindDuplicateXpSlot(){
  const xpEl=$('xp'),txt=xpEl?.textContent?.trim();if(!txt)return null;
  const tagged=stage.querySelector('[data-necro-xp-duplicate="1"]');if(tagged)return tagged;
  let best=null,bestScore=1e9;
  for(const el of stage.querySelectorAll('div,span,b,strong,small')){
    if(el===xpEl||el.closest('.hud')||el.closest('#livePlusBattleHud')||el.closest('#necroHud'))continue;
    const full=(el.textContent||'').trim();if(full!==txt)continue;
    const cs=getComputedStyle(el),r=el.getBoundingClientRect();
    if(cs.display==='none'||cs.visibility==='hidden'||r.width<35||r.width>180||r.height<18||r.height>80)continue;
    if(r.left>180||r.top<80||r.top>390)continue;
    const area=r.width*r.height,score=area+r.left*2+r.top*.1;
    if(score<bestScore){best=el;bestScore=score}
  }
  if(best){
    let box=best;
    const br=best.getBoundingClientRect();
    for(let p=best.parentElement;p&&p!==stage&&!p.classList.contains('hud');p=p.parentElement){const r=p.getBoundingClientRect();if(r.width>br.width+90||r.height>br.height+50)break;if(r.width>=br.width&&r.height>=br.height)box=p}
    box.dataset.necroXpDuplicate='1';box.style.setProperty('visibility','hidden','important');box.style.setProperty('pointer-events','none','important');return box;
  }
  return null;
}
function necroDrawHudIcon(){
  const cv=$('necroHudCanvas');if(!cv)return;const dpr=Math.min(2,window.devicePixelRatio||1),css=30;
  if(cv.width!==css*dpr){cv.width=css*dpr;cv.height=css*dpr;cv.style.width=css+'px';cv.style.height=css+'px'}
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,css,css);
  const active=!!necroEnabled,count=necroSummons.length,max=Math.max(1,necroConfig.maxSummons);
  g.strokeStyle=active?'#8ee6bb':'#64748b';g.fillStyle=active?'#8ee6bb':'#64748b';g.lineWidth=1.6;g.lineCap='round';g.lineJoin='round';
  g.beginPath();g.arc(15,14,8.2,Math.PI*.14,Math.PI*.86,true);g.stroke();
  g.beginPath();g.moveTo(9.2,12.4);g.lineTo(11.8,9.4);g.lineTo(14.2,12.1);g.lineTo(16.7,9.3);g.lineTo(20.8,12.5);g.stroke();
  g.beginPath();g.arc(12.1,15.1,1.15,0,Math.PI*2);g.arc(17.9,15.1,1.15,0,Math.PI*2);g.fill();
  g.beginPath();g.moveTo(13.2,18.2);g.lineTo(15,16.9);g.lineTo(16.8,18.2);g.stroke();
  for(let i=0;i<Math.min(max,6);i++){const x=7+i*(16/Math.max(1,Math.min(max,6)-1));g.globalAlpha=i<count?1:.22;g.beginPath();g.arc(x,25,1.35,0,Math.PI*2);g.fill()}g.globalAlpha=1;
}
function necroPlaceHud(){
  const wrap=$('necroHud');if(!wrap)return;const slot=necroFindDuplicateXpSlot();
  if(slot){const r=slot.getBoundingClientRect(),size=Math.max(34,Math.min(44,Math.max(r.height,r.width*.48)));wrap.style.left=Math.max(8,r.left)+'px';wrap.style.top=Math.max(82,r.top)+'px';wrap.style.width=size+'px';wrap.style.height=size+'px'}
}
function necroEnsureHud(){
  if(necroHudReady){necroPlaceHud();necroDrawHudIcon();return}
  const stage=$('stage');if(!stage)return;necroHudReady=true;
  const wrap=document.createElement('div');wrap.id='necroHud';wrap.style.cssText='position:fixed;z-index:8;left:12px;top:304px;width:40px;height:40px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;pointer-events:auto';
  wrap.innerHTML='<button id="necroHudBtn" aria-label="Abrir painel do Necromante" title="Necromante" style="width:100%;height:100%;display:grid;place-items:center;border:1px solid rgba(93,192,142,.48);background:linear-gradient(180deg,rgba(8,21,18,.96),rgba(5,13,12,.96));border-radius:12px;padding:4px;box-shadow:0 5px 16px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.04)"><canvas id="necroHudCanvas" aria-hidden="true"></canvas></button><div id="necroPanel" style="display:none;position:absolute;left:0;top:calc(100% + 6px);width:220px;padding:10px;border:1px solid #315f4d;border-radius:12px;background:#08100df2;box-shadow:0 12px 30px rgba(0,0,0,.35)"><div style="font-size:9px;letter-spacing:.14em;color:#a7f3d0">NECROMANTE</div><div id="necroPanelStats" style="margin:7px 0 9px;color:#d1fae5;font-size:9px;line-height:1.5"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><button data-necro-up="life">VIDA</button><button data-necro-up="damage">DANO</button><button data-necro-up="regen">REGEN</button><button data-necro-up="armor">ARMOR</button></div></div>';
  stage.appendChild(wrap);const panel=wrap.querySelector('#necroPanel'),btn=wrap.querySelector('#necroHudBtn');btn.onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none';
  for(const u of panel.querySelectorAll('[data-necro-up]')){u.style.cssText='padding:7px;border:1px solid #315f4d;border-radius:8px;background:#0b1511;color:#d1fae5;font-size:8px;font-weight:950';u.onclick=()=>necroSpend(u.dataset.necroUp,1)}
  necroPlaceHud();necroDrawHudIcon();
}
function necroRefreshHud(force=false){
  const now=performance.now();if(!force&&now<necroLastHudAt)return;necroLastHudAt=now+250;necroEnsureHud();const btn=$('necroHudBtn'),stats=$('necroPanelStats');
  if(btn){btn.style.opacity=necroEnabled?'1':'.52';btn.style.borderColor=necroEnabled?'rgba(93,192,142,.58)':'rgba(100,116,139,.36)'}necroDrawHudIcon();
  if(stats)stats.innerHTML=(necroEnabled?'ATIVO':'DESATIVADO')+' · ALMA NV '+necroSoulLevel+'<br>PONTOS '+necroSoulPoints+' · XP '+Math.floor(necroSoulXp)+'/'+necroXpNeed()+'<br>ABATES '+necroSoulKills+' · VIDA +'+(necroUpgrades.life*10)+'%<br>DANO +'+(necroUpgrades.damage*8)+'% · ARMOR '+(necroUpgrades.armor*4)+'%';necroPlaceHud();
}
`;
  out=out.slice(0,a)+hud+out.slice(c);return out;
}
window.CaosNecromancerCompanion=Object.freeze({...base,apply,version:String(base.version||'0.3.0')+'+hudslot2',__hudSlotV2:true});
})();
