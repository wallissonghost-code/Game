(()=>{'use strict';
const api=window.CaosLivePlus,m=api?.manifest;if(!m||!Array.isArray(m.actions))return;const actions=m.actions,find=id=>actions.find(a=>a.id===id);const number=(id,label,min,max,def,step)=>({id,label,type:'number',min,max,default:def,...(step?{step}:{})});
const rename={spawn:'Mobs',boss:'Boss',damage:'Dano',freeze:'Gelo',eventmeteor:'Meteoro',eventmeteorconfig:'Config. Meteoro',heal:'Cura',invincible:'Invencível',saveplayer:'Reviver',clear:'Limpar arena',xp:'XP',level:'Level',eventdoublexp:'XP 2×',skilltest:'Skill',skilltestall:'Skills LV',skillreset:'Reset Skills'};for(const a of actions)if(rename[a.id])a.label=rename[a.id];
const meteor=find('eventmeteor');if(meteor&&!meteor.params.some(p=>p.id==='seconds'))meteor.params.splice(1,0,number('seconds','DURAÇÃO (S) · 0 = ATÉ DESLIGAR',0,3600,30));
const doubleXp=find('eventdoublexp');if(doubleXp&&!doubleXp.params.some(p=>p.id==='seconds'))doubleXp.params.push(number('seconds','DURAÇÃO (S) · 0 = ATÉ DESLIGAR',0,3600,60));
if(!find('skillmax'))actions.push({id:'skillmax',label:'Max Skill',icon:'🧪',description:'Coloca todas as habilidades no nível máximo permitido.',hudSide:'player',params:[]});
})();