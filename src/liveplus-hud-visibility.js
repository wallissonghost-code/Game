(()=>{'use strict';
const STORAGE_KEY='caos-live-hud-visible';
const HUD_ID='livePlusBattleHud';
const TOGGLE_ID='livePlusHudToggle';
function read(){try{const value=localStorage.getItem(STORAGE_KEY);return value===null?true:value==='1'}catch{return true}}
function apply(visible,{persist=true}={}){const active=!!visible;const hud=document.getElementById(HUD_ID);const toggle=document.getElementById(TOGGLE_ID);if(hud)hud.hidden=!active;if(toggle)toggle.checked=active;if(persist){try{localStorage.setItem(STORAGE_KEY,active?'1':'0')}catch{}}document.documentElement.dataset.livePlusHud=active?'visible':'hidden';window.dispatchEvent(new CustomEvent('caos:live-hud-visibility',{detail:{visible:active}}));return active}
function mount(){const pause=document.querySelector('#pause .card');if(!pause||document.getElementById(TOGGLE_ID))return;const connectBox=pause.querySelector('.lpConnectBox');if(!connectBox)return;const label=document.createElement('label');label.className='lpHudVisibilityOption';label.htmlFor=TOGGLE_ID;label.innerHTML=`<span><b>HUD DA LIVE</b><small>Exibir presentes e ações na tela</small></span><input id="${TOGGLE_ID}" type="checkbox" aria-label="Exibir HUD da Live">`;connectBox.insertAdjacentElement('afterend',label);const toggle=label.querySelector('input');toggle.checked=read();toggle.addEventListener('change',()=>apply(toggle.checked));apply(read(),{persist:false})}
function refresh(){mount();apply(read(),{persist:false})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
window.addEventListener('pageshow',refresh);
window.CaosLiveHudVisibility={set:apply,get:read,refresh};
})();
