(()=>{'use strict';
function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function label(rule){const p=rule?.actionParams&&typeof rule.actionParams==='object'?rule.actionParams:{};switch(String(rule?.actionId||'')){
case'spawn':{const q=n(p.amount,1),tier=String(p.tier||'');return `${q} mob${q===1?'':'s'}${tier==='1'||tier==='elite'?' · Elite':tier==='2'||tier==='corrupted'?' · Corrompido':''}`}
case'boss':{const q=n(p.amount,1);return `${q} Boss`}
case'damage':return `Dano ${n(p.amount,10)} HP`;
case'freeze':return `Congelar Mobs ${n(p.seconds,8)}s`;
case'heal':return `Curar ${n(p.amount,10)} HP`;
case'invincible':return `Invencível ${n(p.seconds,10)}s`;
case'xp':return `+${n(p.amount,50)} XP`;
case'level':{const q=n(p.amount,1);return `+${q} nível${q===1?'':'is'}`}
case'autofire_block':return `Sem arma ${n(p.seconds,8)}s`;
case'autofire_off':return 'Sem arma';
case'autofire_on':return 'Arma reativada';
case'eventmeteor':return `Meteoro ${n(p.seconds,0)>0?n(p.seconds,0)+'s':'ativo'}`;
case'eventdoublexp':return `XP 2× ${n(p.seconds,0)>0?n(p.seconds,0)+'s':'ativo'}`;
case'speed':return `Mobs ${p.value||1}× velocidade`;
case'saveplayer':return 'Reviver jogador';
case'skilltest':return `Skill LV ${n(p.level,1)}`;
case'skilltestall':return `Skills LV ${n(p.level,1)}`;
case'skillmax':return 'Skills no máximo';
case'skillreset':return 'Reseta Skills';
default:return ''}}
function apply(){const api=window.CaosLivePlus;if(!api?.getRules)return;const rules=api.getRules();if(!Array.isArray(rules)||!rules.length)return;const root=document.getElementById('livePlusBattleHud');if(!root)return;for(const card of root.querySelectorAll('.lpGift')){const name=card.querySelector('b')?.textContent?.trim();const small=card.querySelector('small');if(!name||!small)continue;const rule=rules.find(r=>String(r.giftName||'').trim()===name);if(!rule)continue;const text=label(rule);if(text)small.textContent=text}}
let lock=false;function schedule(){if(lock)return;lock=true;requestAnimationFrame(()=>{lock=false;apply()})}
const boot=()=>{schedule();const root=document.getElementById('livePlusBattleHud');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});else{const obs=new MutationObserver(()=>{const r=document.getElementById('livePlusBattleHud');if(r){obs.disconnect();new MutationObserver(schedule).observe(r,{childList:true,subtree:true});schedule()}});obs.observe(document.body,{childList:true,subtree:true})}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();