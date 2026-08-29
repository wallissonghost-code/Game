(()=>{'use strict';
const api=window.CaosLivePlus,m=api?.manifest;if(!m||!Array.isArray(m.actions))return;
const actions=m.actions,find=id=>actions.find(a=>a.id===id);
const number=(id,label,min,max,def,step)=>({id,label,type:'number',min,max,default:def,...(step?{step}:{})});
const rename={spawn:'Mobs',boss:'Boss',damage:'Dano',freeze:'Gelo',speed:'Velocidade dos mobs',eventmeteor:'Meteoro',eventmeteorconfig:'Config. Meteoro',heal:'Cura',invincible:'Invencível',saveplayer:'Reviver',clear:'Limpar arena',xp:'XP',level:'Level',eventdoublexp:'XP 2×',skilltest:'Skill',skilltestall:'Skills LV',skillreset:'Reset Skills'};
for(const a of actions)if(rename[a.id])a.label=rename[a.id];
const chaosIds=new Set(['spawn','boss','damage','freeze','speed','eventmeteor','eventmeteorconfig','skillreset','autofire_block','autofire_off']);
const playerIds=new Set(['heal','invincible','xp','level','saveplayer','eventdoublexp','skilltest','skilltestall','skillmax','autofire_on']);
const adminIds=new Set(['clear','pause','resume','restart','auto','horde','autofire','gameplaymode','fps']);
for(const a of actions){
 if(chaosIds.has(a.id)){a.hudSide='chaos';a.donationEligible=true;a.donationGroup='chaos'}
 else if(playerIds.has(a.id)){a.hudSide='player';a.donationEligible=true;a.donationGroup='player'}
 else if(adminIds.has(a.id)){a.hudSide='admin';a.donationEligible=false;a.donationGroup='admin'}
}
const meteor=find('eventmeteor');if(meteor&&!meteor.params.some(p=>p.id==='seconds'))meteor.params.splice(1,0,number('seconds','DURAÇÃO (S) · 0 = ATÉ DESLIGAR',0,3600,30,0.01));
const doubleXp=find('eventdoublexp');if(doubleXp&&!doubleXp.params.some(p=>p.id==='seconds'))doubleXp.params.push(number('seconds','DURAÇÃO (S) · 0 = ATÉ DESLIGAR',0,3600,60,0.01));
if(!find('skillmax'))actions.push({id:'skillmax',label:'Max Skill',icon:'🧪',description:'Coloca todas as habilidades no nível máximo permitido.',hudSide:'player',donationEligible:true,donationGroup:'player',params:[]});
function put(action){const old=find(action.id);if(old)Object.assign(old,action);else actions.push(action)}
put({id:'autofire_block',label:'Bloquear tiro',icon:'🚫',description:'Desativa o tiro automático temporariamente e reativa ao fim do tempo.',hudSide:'chaos',donationEligible:true,donationGroup:'chaos',params:[number('seconds','DURAÇÃO (S)',0.01,600,8,0.01)]});
put({id:'autofire_off',label:'Desativar tiro',icon:'🔇',description:'Desativa o tiro automático sem limite de tempo, até alguém reativar.',hudSide:'chaos',donationEligible:true,donationGroup:'chaos',params:[]});
put({id:'autofire_on',label:'Ativar tiro',icon:'🔫',description:'Reativa o tiro automático imediatamente e cancela qualquer bloqueio temporário.',hudSide:'player',donationEligible:true,donationGroup:'player',params:[]});
m.donationGroups=[{id:'chaos',label:'CAOS'},{id:'player',label:'PLAYER'}];
m.donationActionIds=actions.filter(a=>a.donationEligible===true).map(a=>a.id);
m.adminActionIds=actions.filter(a=>a.donationEligible===false).map(a=>a.id);
})();