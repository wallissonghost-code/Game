(()=>{
  'use strict';
  const Store=window.CaosHudLiveStore;
  if(!Store)return;

  const VIS='caos-hud-live-lab-visible-v1';
  let state=Store.load();
  let visible=localStorage.getItem(VIS)!=='0';
  const frame=document.getElementById('gameFrame');
  const dock=document.getElementById('hudLiveDock');
  const slots=document.getElementById('hudLiveSlots');
  const backdrop=document.getElementById('hudLiveEditorBackdrop');
  const visibilityBtn=document.getElementById('hudLiveVisibility');

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function fallbackIcon(g){const n=(g.name||'').toLowerCase();if(n.includes('rose'))return '🌹';if(n.includes('dino'))return '🦖';if(n==='gg')return '🎮';return '🎁'}
  function icon(g){return g.image?`<img src="${esc(g.image)}" alt="${esc(g.name)}">`:fallbackIcon(g)}

  function refreshRealAssets(){
    state=state.map(g=>{
      const found=(g.id&&Store.findGift(g.id))||Store.findGift(g.name);
      if(!found)return g;
      return {...g,id:found.id||g.id,image:found.image||'',value:found.value||g.value,liveVerified:found.liveVerified||g.liveVerified};
    });
  }

  function syncVisibility(){
    dock.classList.toggle('is-hidden',!visible);
    if(visibilityBtn){
      visibilityBtn.textContent=visible?'👁 HUD LIVE VISÍVEL · TOQUE PARA OCULTAR':'🙈 HUD LIVE OCULTO · TOQUE PARA EXIBIR';
      visibilityBtn.classList.toggle('off',!visible);
    }
    localStorage.setItem(VIS,visible?'1':'0');
  }

  function renderHud(){
    refreshRealAssets();
    const cards=state.slice(0,4);
    dock.innerHTML=`<section class="hudLivePanel"><header class="hudLiveHead"><div class="hudLiveTitle">COMANDOS DA <b>LIVE</b></div><div class="hudLiveBadge"><i></i> AO VIVO</div></header><div class="hudLiveGrid">${cards.length?cards.map(g=>`<div class="hudLiveItem"><div class="hudLiveGiftIcon">${icon(g)}</div><div class="hudLiveText"><div class="hudLiveGiftName">${esc(g.name||'Presente')}</div><div class="hudLiveEffect"><b>${esc(g.effect||'EFEITO')}</b></div></div></div>`).join(''):'<div class="hudLiveEmpty">NENHUM COMANDO VISÍVEL</div>'}</div><footer class="hudLiveFooter">INTERAJA · MUDE O RUMO DO JOGO</footer></section>`;
    syncVisibility();
  }

  function placeDock(){
    try{
      const doc=frame.contentDocument;
      const stats=doc?.querySelector('.hudStatsRow');
      const brand=doc?.querySelector('.hudBrand');
      const pause=doc?.querySelector('.pauseBtn');
      if(!stats)return;
      const sr=stats.getBoundingClientRect();
      const br=brand?.getBoundingClientRect();
      const pr=pause?.getBoundingClientRect();
      // Mantém exatamente o espaço reservado aos indicadores centrais do HUD.
      const left=br&&pr?Math.max(sr.left,br.right+6):sr.left;
      const right=br&&pr?Math.min(sr.right,pr.left-6):sr.right;
      dock.style.left=`${Math.round(left)}px`;
      dock.style.top=`${Math.round(sr.top)}px`;
      dock.style.width=`${Math.round(Math.max(180,right-left))}px`;
      dock.style.height=`${Math.round(sr.height)}px`;
    }catch{}
  }

  function resolvedHtml(g){
    if(!g)return '<div class="hudLiveResolved">Nenhum presente encontrado no catálogo.</div>';
    return `<div class="hudLiveResolved">${g.image?`<img src="${esc(g.image)}" alt="">`:''}<div><b>${esc(g.name)}</b>${g.id?` · ID ${esc(g.id)}`:''}${g.liveVerified?' · ✅ verificado':''}<br>${g.image?'Imagem real do catálogo carregada.':'Este item ainda não tem imagem salva no catálogo.'}</div></div>`;
  }

  function renderEditor(){
    refreshRealAssets();
    syncVisibility();
    slots.innerHTML=state.slice(0,4).map((g,i)=>`<div class="hudLiveSlot" data-i="${i}"><div class="hudLiveSlotTitle">SLOT ${i+1}</div><label>PRESENTE · NOME OU ID</label><input class="hudLiveGiftQuery" value="${esc(g.id||g.name||'')}" placeholder="Ex.: Rose ou 5655"><div class="hudLiveResolvedWrap">${resolvedHtml(g)}</div><div class="hudLiveRow"><div><label>NOME NO HUD</label><input class="hudLiveName" maxlength="28" value="${esc(g.name||'')}"></div><div><label>EFEITO / TEXTO</label><input class="hudLiveEffectInput" maxlength="36" value="${esc(g.effect||'')}"></div></div></div>`).join('');

    slots.querySelectorAll('.hudLiveSlot').forEach(el=>{
      const i=Number(el.dataset.i);
      const query=el.querySelector('.hudLiveGiftQuery');
      const name=el.querySelector('.hudLiveName');
      const effect=el.querySelector('.hudLiveEffectInput');
      const resolved=el.querySelector('.hudLiveResolvedWrap');
      const applyGift=()=>{
        const found=Store.findGift(query.value);
        if(found){
          state[i]={...state[i],...found,effect:state[i].effect};
          name.value=found.name||'';
          state[i].name=name.value;
          resolved.innerHTML=resolvedHtml(found);
          renderHud();
        }else resolved.innerHTML=resolvedHtml(null);
      };
      query.addEventListener('change',applyGift);
      query.addEventListener('blur',applyGift);
      name.addEventListener('input',()=>{state[i].name=name.value;renderHud()});
      effect.addEventListener('input',()=>{state[i].effect=effect.value;renderHud()});
    });
  }

  document.getElementById('hudLiveLabBtn').addEventListener('click',()=>{renderEditor();backdrop.classList.add('show')});
  document.getElementById('hudLiveClose').addEventListener('click',()=>backdrop.classList.remove('show'));
  visibilityBtn?.addEventListener('click',()=>{visible=!visible;syncVisibility()});
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.classList.remove('show')});
  document.getElementById('hudLiveSave').addEventListener('click',()=>{state=Store.save(state);renderHud();backdrop.classList.remove('show')});
  document.getElementById('hudLiveReset').addEventListener('click',()=>{state=Store.reset();visible=true;renderEditor();renderHud()});

  frame.addEventListener('load',()=>{setTimeout(()=>{state=Store.load();renderHud();placeDock()},180);setTimeout(placeDock,700)});
  addEventListener('storage',e=>{if(['caos-gift-catalog-v2','caos-gift-catalog','gift_catalog_verified'].includes(e.key)){state=Store.load();renderHud()}});
  addEventListener('resize',placeDock,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(placeDock,250),{passive:true});
  setInterval(placeDock,1500);
  renderHud();
})();