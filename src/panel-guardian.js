(()=>{'use strict';
function installGuardianAdmin(){
  const select=document.getElementById('skillTestSelect');
  if(select&&!select.querySelector('option[value="guardian"]')){
    const option=document.createElement('option');
    option.value='guardian';
    option.textContent='☄️ Guardião Celestial';
    const phoenix=select.querySelector('option[value="phoenix"]');
    select.insertBefore(option,phoenix||null);
  }
  const state=document.getElementById('skillStateList');
  if(state){
    const pretty=()=>{
      if(/\bguardian\b/i.test(state.textContent||'')) state.textContent=state.textContent.replace(/\bguardian\b/gi,'Guardião Celestial');
    };
    pretty();
    new MutationObserver(pretty).observe(state,{childList:true,subtree:true,characterData:true});
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGuardianAdmin,{once:true});else installGuardianAdmin();
})();
