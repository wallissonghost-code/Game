(()=>{'use strict';
const api=window.CaosLivePlus,manifest=api?.manifest;
if(!manifest||!Array.isArray(manifest.actions))return;
const actions=manifest.actions;
const find=id=>actions.find(a=>a.id===id);
const select=(id,label,def,options)=>({id,label,type:'select',default:def,options});
const number=(id,label,min,max,def,step)=>({id,label,type:'number',min,max,default:def,...(step?{step}:{})});
const toggle=(id,label,def=false)=>({id,label,type:'toggle',default:def});
const mobs=[
 {value:'wraith',label:'Espectro'},
 {value:'reaper',label:'Ceifador'},
 {value:'infected',label:'Infectado'},
 {value:'crawler',label:'Criatura das Sombras'},
 {value:'eye',label:'Observador'},
 {value:'brute',label:'Brutamonte'}
];
const targets=[{value:'p1',label:'Player 1'},{value:'p2',label:'Player 2'},{value:'all',label:'Todos'}];
const tiers=[{value:'normal',label:'Normal'},{value:'elite',label:'Elite'},{value:'corrupted',label:'Corrompido'}];
const bossTiers=[{value:'normal',label:'Normal'},{value:'1',label:'Elite'},{value:'2',label:'Corrompido'}];
const spawn=find('spawn');
if(spawn)spawn.params=[select('mob','INIMIGO','wraith',mobs),number('amount','QUANTIDADE',1,100,1),select('tier','VARIANTE','normal',tiers)];
const boss=find('boss');
if(boss)boss.params=[select('mob','BOSS','colossus',[{value:'colossus',label:'Colosso Carmesim'},{value:'voidlord',label:'Senhor do Vazio'}]),number('amount','QUANTIDADE',1,20,1),select('tier','VARIANTE','normal',bossTiers)];
function add(action){if(!find(action.id))actions.push(action)}
add({id:'speed',label:'Velocidade dos inimigos',icon:'💨',description:'Altera a velocidade global dos mobs.',hudSide:'chaos',params:[select('value','VELOCIDADE','1',[{value:'0.5',label:'0.5×'},{value:'1',label:'1×'},{value:'1.5',label:'1.5×'},{value:'2.5',label:'2.5×'}])]});
add({id:'eventmeteor',label:'Chuva de Meteoro',icon:'☄️',description:'Liga ou desliga a chuva de meteoros com configuração própria.',hudSide:'chaos',params:[toggle('value','ATIVAR',true),number('batch','METEOROS POR ONDA',1,25,1),number('interval','INTERVALO (S)',0.45,12,1.7,0.1),number('warning','AVISO (S)',0.6,5,1.8,0.1),number('radius','RAIO',45,180,92),number('playerDamage','DANO NO PLAYER',1,80,18),number('mobDamage','DANO NOS MOBS',1,100,20)]});
add({id:'saveplayer',label:'Salvar / Reviver jogador',icon:'🛟',description:'Salva ou revive o jogador selecionado.',hudSide:'player',params:[select('target','ALVO','p1',targets)]});
add({id:'eventdoublexp',label:'Dobro de XP',icon:'✨',description:'Liga ou desliga o evento de XP em dobro.',hudSide:'player',params:[toggle('value','ATIVAR',true)]});
window.dispatchEvent(new CustomEvent('caos:liveplus-actions-ready',{detail:{gameId:manifest.gameId,actions:actions.length}}));
})();
