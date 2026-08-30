(()=>{'use strict';
const SDK=()=>window.LivePlusGameSDK;
const CODE_SELECTOR='.lpPanelCode';
function installInput(input){
  if(!input||input.dataset.liveplusSdkAdapter)return;
  input.dataset.liveplusSdkAdapter='1';
  input.addEventListener('paste',event=>{
    const text=event.clipboardData?.getData('text/plain')||'';
    const sdk=SDK();
    const ticket=sdk?.parseTicket?.(text);
    if(!ticket)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    sdk.configureRelay?.(ticket.endpoint);
    const formatted=ticket.code.slice(0,4)+'-'+ticket.code.slice(4);
    input.value=formatted;
    input.dataset.relayTicket='1';
    try{sessionStorage.setItem('caos-liveplus-panel-code',formatted)}catch{}
    input.dispatchEvent(new Event('input',{bubbles:true}));
  },true);
}
function install(){document.querySelectorAll(CODE_SELECTOR).forEach(installInput)}
const observer=new MutationObserver(install);
if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',install);
window.addEventListener('pageshow',install);
install();
window.CaosLivePlusSDK={
  version:'1.0.0',
  sdk:()=>SDK(),
  relay:()=>SDK()?.relayEndpoint?.()||'',
  transport:()=>window.CaosLiveUniversal?.session?.getTransport?.()||'unknown'
};
})();
