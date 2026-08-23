(()=>{'use strict';
// MODO DE DIAGNOSTICO: conexao TikTok estritamente manual.
// Esta camada foi reduzida temporariamente para eliminar qualquer watchdog,
// rescue ou clique programatico enquanto isolamos o Connector.
const $=id=>document.getElementById(id);

function installManualOnlyGuard(){
  if(window.__caosManualLiveOnly)return;
  window.__caosManualLiveOnly=true;

  const blockSynthetic=id=>{
    const el=$(id);
    if(!el)return;
    el.addEventListener('click',e=>{
      // Cliques reais do usuario sao trusted. Chamadas element.click() nao sao.
      if(e.isTrusted)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      console.warn('[CAOS DIAG] clique automatico bloqueado:',id);
    },true);
  };

  blockSynthetic('cloudConnect');
  blockSynthetic('tiktokConnect');

  const draw=()=>{
    let badge=$('liveV2Watchdog');
    if(!badge){
      const state=$('liveV2CaptureState');
      if(state){
        badge=document.createElement('span');
        badge.id='liveV2Watchdog';
        badge.className='miniStatus';
        state.insertAdjacentElement('afterend',badge);
      }
    }
    if(badge){
      badge.textContent='AUTO RECONECT OFF · TESTE MANUAL';
      badge.style.color='#86efac';
    }
  };

  draw();
  setTimeout(draw,500);
  setTimeout(draw,1500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installManualOnlyGuard,{once:true});
else installManualOnlyGuard();
})();
