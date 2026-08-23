(()=>{'use strict';
const $=id=>document.getElementById(id);
const CAT_KEY='caos-gift-catalog-v2',RULE_KEY='caos-live-rules-v2';

function loadCatalog(){try{return JSON.parse(localStorage.getItem(CAT_KEY)||'null')?.gifts||[]}catch{return[]}}
function loadRules(){try{return JSON.parse(localStorage.getItem(RULE_KEY)||'[]')||[]}catch{return[]}}
function giftIcon(g){return g?.icon||g?.image||g?.picture||g?.imageUrl||g?.iconUrl||''}
function findGiftFromRow(row,catalog){const txt=row.textContent||'',id=txt.match(/ID\s+([^\s·]+)/i)?.[1]||'';return catalog.find(g=>String(g.id)===String(id))||catalog.find(g=>txt.toLowerCase().includes(String(g.name||'').toLowerCase()))}

function installManualOnlyGuard(){
  if(window.__caosManualLiveOnly)return;
  window.__caosManualLiveOnly=true;
  const blockSynthetic=id=>{
    const el=$(id);if(!el)return;
    el.addEventListener('click',e=>{
      if(e.isTrusted)return;
      e.preventDefault();e.stopImmediatePropagation();
      console.warn('[CAOS DIAG] clique automatico bloqueado:',id);
    },true);
  };
  blockSynthetic('cloudConnect');
  blockSynthetic('tiktokConnect');
  const draw=()=>{
    let badge=$('liveV2Watchdog');
    if(!badge){const state=$('liveV2CaptureState');if(state){badge=document.createElement('span');badge.id='liveV2Watchdog';badge.className='miniStatus';state.insertAdjacentElement('afterend',badge)}}
    if(badge){badge.textContent='AUTO RECONECT OFF · TESTE MANUAL';badge.style.color='#86efac'}
  };
  draw();setTimeout(draw,500);setTimeout(draw,1500);
}

function decorateCatalog(){
  const box=$('giftCatalogList');if(!box)return;
  const catalog=loadCatalog();
  box.querySelectorAll('.giftCatalogRowV2').forEach(row=>{
    const g=findGiftFromRow(row,catalog);if(!g)return;
    const icon=giftIcon(g);
    if(icon&&!row.querySelector('.giftThumb')){
      const img=document.createElement('img');img.className='giftThumb';img.src=icon;img.alt=g.name||'Presente';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();row.prepend(img);
    }
  });
}

function ensurePreview(){
  const sel=$('v2Gift');if(!sel||$('v2GiftPreview'))return;
  const wrap=document.createElement('div');wrap.id='v2GiftPreview';wrap.className='v2GiftPreview';sel.parentElement?.appendChild(wrap);
  const draw=()=>{
    const g=loadCatalog().find(x=>String(x.id)===String(sel.value)),icon=giftIcon(g);
    wrap.innerHTML=g?`${icon?`<img src="${String(icon).replace(/"/g,'&quot;')}" alt="${String(g.name||'').replace(/"/g,'&quot;')}">`:''}<div><b>${g.name||'Presente'}</b><span>ID ${g.id??'?'} · ${g.diamondCount||0} 💎</span></div>`:'<span class="hint">Selecione um presente para visualizar.</span>';
  };
  sel.addEventListener('change',draw);window.addEventListener('caos-catalog-updated',draw);draw();
}

function enhanceBuilder(){
  const action=$('v2Action'),mob=$('v2Mob'),value=$('v2Value');if(!action||action.dataset.contextUx)return;
  action.dataset.contextUx='1';
  const mobField=mob?.closest('.v2Field,.field')||mob?.parentElement,valueField=value?.closest('.v2Field,.field')||value?.parentElement;
  const labels={spawn:'Quantidade de mobs',boss:'Quantidade de bosses',heal:'Pontos de cura',damage:'Pontos de dano',freeze:'Duração (segundos)',invincible:'Duração (segundos)',xp:'XP concedido',level:'Levels concedidos',clear:'Sem valor adicional'};
  const sync=()=>{
    const a=action.value,usesMob=a==='spawn'||a==='boss',usesValue=a!=='clear';
    if(mobField)mobField.style.display=usesMob?'':'none';if(valueField)valueField.style.display=usesValue?'':'none';
    const lab=valueField?.querySelector('span,label');if(lab)lab.textContent=labels[a]||'VALOR / QUANTIDADE';
    if(mob){[...mob.options].forEach(o=>{const boss=['colossus','voidlord'].includes(o.value);o.hidden=a==='boss'?!boss:boss});if(a==='boss'&&!['colossus','voidlord'].includes(mob.value))mob.value='colossus';if(a==='spawn'&&['colossus','voidlord'].includes(mob.value))mob.value='wraith'}
  };
  action.addEventListener('change',sync);sync();
}

function enhanceSavedRules(){
  const root=$('liveV2Rules')||$('v2Rules')||document.querySelector('#caosLiveV2 .v2Rules');if(!root)return;
  const catalog=loadCatalog(),rules=loadRules();
  [...root.children].forEach(card=>{
    if(card.dataset.enhancedRule)return;
    const txt=card.textContent||'',id=txt.match(/ID\s*(\d+)/i)?.[1],g=catalog.find(x=>String(x.id)===String(id));if(!g)return;
    card.dataset.enhancedRule='1';const icon=giftIcon(g);
    if(icon){const img=document.createElement('img');img.className='giftThumb savedRuleGiftThumb';img.src=icon;img.alt=g.name||'Presente';img.onerror=()=>img.remove();card.prepend(img)}
    const buttons=card.querySelectorAll('button');
    if(![...buttons].some(b=>/EDITAR/i.test(b.textContent))){
      const edit=document.createElement('button');edit.type='button';edit.textContent='EDITAR';edit.className='v2EditRule';
      edit.onclick=()=>{const rule=rules.find(r=>r.trigger==='gift'&&String(r.giftId)===String(g.id));if(!rule)return;const set=(k,v)=>{const e=$(k);if(e)e.value=v??''};set('v2Trigger',rule.trigger||'gift');set('v2Gift',rule.giftId||g.id);set('v2Threshold',rule.threshold||1);set('v2Action',rule.action||'spawn');set('v2Mob',rule.mob||'wraith');set('v2Value',rule.value||1);set('v2Cooldown',rule.cooldown||0);$('v2Action')?.dispatchEvent(new Event('change',{bubbles:true}));$('v2Gift')?.dispatchEvent(new Event('change',{bubbles:true}));$('v2BuilderTitle')?.scrollIntoView({behavior:'smooth',block:'start'})};
      card.appendChild(edit);
    }
  });
}

function installVisualRestore(){
  ensurePreview();enhanceBuilder();decorateCatalog();enhanceSavedRules();
  const target=$('caosLiveV2');if(target&&!target.dataset.visualRestore){target.dataset.visualRestore='1';let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorateCatalog();enhanceSavedRules()})}).observe(target,{childList:true,subtree:true})}
  window.addEventListener('caos-catalog-updated',()=>{decorateCatalog();enhanceSavedRules()});
}

function install(){installManualOnlyGuard();installVisualRestore()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
