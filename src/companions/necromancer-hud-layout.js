(()=>{'use strict';
const base=window.CaosNecromancerCompanion;
if(!base||base.__hudSlotV1)return;
const originalApply=base.apply;
function apply(source){
  let out=originalApply(source);
  if(typeof out!=='string'||out.includes('CAOS_NECROMANCER_HUD_SLOT_V1'))return out;
  const a=out.indexOf('function necroEnsureHud(){');
  const b=out.indexOf('function necroRefreshHud(force=false){',a);
  const c=out.indexOf('function necroRecalc(',b);
  if(a<0||b<0||c<0){console.warn('NECROMANCER HUD: patch target not found');return out}
  const hud=`/*CAOS_NECROMANCER_HUD_SLOT_V1*/
function necroFindDuplicateXpSlot(){
  const xpEl=$('xp'),txt=xpEl?.textContent?.trim();
  if(!txt)return null;
  let tagged=stage.querySelector('[data-necro-xp-duplicate="1"]');
  if(tagged)return tagged;
  let best=null,bestScore=1e9;
  for(const el of stage.querySelectorAll('div,span,b,strong')){
    if(el===xpEl||el.closest('.hud')||el.closest('#livePlusBattleHud')||el.closest('#necroHud')||el.children.length)continue;
    if((el.textContent||'').trim()!==txt)continue;
    const cs=getComputedStyle(el),r=el.getBoundingClientRect();
    if(cs.display==='none'||cs.visibility==='hidden')continue;
    if(cs.position!=='fixed'&&cs.position!=='absolute')continue;
    if(r.width<38||r.width>190||r.height<16||r.height>72)continue;
    const score=r.left+r.top*.18;
    if(score<bestScore){best=el;bestScore=score}
  }
  if(best){best.dataset.necroXpDuplicate='1';best.style.setProperty('visibility','hidden','important');best.style.setProperty('pointer-events','none','important')}
  return best;
}
function necroPlaceHud(){
  const wrap=$('necroHud');if(!wrap)return;
  const slot=necroFindDuplicateXpSlot();
  if(slot){const r=slot.getBoundingClientRect();wrap.style.left=Math.max(8,r.left)+'px';wrap.style.top=Math.max(84,r.top)+'px';wrap.style.width=Math.max(76,Math.min(146,r.width))+'px'}
}
function necroEnsureHud(){
  if(necroHudReady){necroPlaceHud();return}
  const stage=$('stage');if(!stage)return;necroHudReady=true;
  const wrap=document.createElement('div');wrap.id='necroHud';wrap.style.cssText='position:fixed;z-index:8;left:8px;top:118px;width:108px;font:900 10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#d1fae5;pointer-events:auto';
  wrap.innerHTML='<button id="necroHudBtn" aria-label="Abrir painel Necromante" style="width:100%;min-height:34px;border:1px solid #285846;background:rgba(7,17,14,.92);color:#d7f7e8;border-radius:11px;padding:7px 9px;font-size:9px;letter-spacing:.08em;font-weight:950;box-shadow:0 4px 14px rgba(0,0,0,.22)">NECRO 0/3</button><div id="necroPanel" style="display:none;position:absolute;left:0;top:calc(100% + 6px);width:220px;padding:10px;border:1px solid #315f4d;border-radius:12px;background:#08100df2;box-shadow:0 12px 30px rgba(0,0,0,.35)"><div style="font-size:9px;letter-spacing:.14em;color:#a7f3d0">NECROMANTE</div><div id="necroPanelStats" style="margin:7px 0 9px;color:#d1fae5;font-size:9px;line-height:1.5"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><button data-necro-up="life">VIDA</button><button data-necro-up="damage">DANO</button><button data-necro-up="regen">REGEN</button><button data-necro-up="armor">ARMOR</button></div></div>';
  stage.appendChild(wrap);
  const panel=wrap.querySelector('#necroPanel'),btn=wrap.querySelector('#necroHudBtn');
  btn.onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none';
  for(const u of panel.querySelectorAll('[data-necro-up]')){u.style.cssText='padding:7px;border:1px solid #315f4d;border-radius:8px;background:#0b1511;color:#d1fae5;font-size:8px;font-weight:950';u.onclick=()=>necroSpend(u.dataset.necroUp,1)}
  necroPlaceHud();
}
function necroRefreshHud(force=false){
  const now=performance.now();if(!force&&now<necroLastHudAt)return;necroLastHudAt=now+250;necroEnsureHud();
  const btn=$('necroHudBtn'),stats=$('necroPanelStats');
  if(btn){btn.textContent='NECRO '+necroSummons.length+'/'+necroConfig.maxSummons;btn.style.opacity=necroEnabled?'1':'.58'}
  if(stats)stats.innerHTML=(necroEnabled?'ATIVO':'DESATIVADO')+' · ALMA NV '+necroSoulLevel+'<br>PONTOS '+necroSoulPoints+' · XP '+Math.floor(necroSoulXp)+'/'+necroXpNeed()+'<br>ABATES '+necroSoulKills+' · VIDA +'+(necroUpgrades.life*10)+'%<br>DANO +'+(necroUpgrades.damage*8)+'% · ARMOR '+(necroUpgrades.armor*4)+'%';
  necroPlaceHud();
}
`;
  out=out.slice(0,a)+hud+out.slice(c);
  return out;
}
window.CaosNecromancerCompanion=Object.freeze({...base,apply,version:String(base.version||'0.3.0')+'+hudslot1',__hudSlotV1:true});
})();
