(()=>{'use strict';
const api=window.CaosLivePlus,manifest=api?.manifest;
if(!manifest||!Array.isArray(manifest.actions))return;
const actions=manifest.actions;
const find=id=>actions.find(a=>a.id===id);
const select=(id,label,def,options)=>({id,label,type:'select',default:def,options});
const number=(id,label,min,max,def,step)=>({id,label,type:'number',min,max,default:def,...(step?{step}:{})});
const toggle=(id,label,def=false)=>({id,label,type:'toggle',default:def});
const targets=[{value:'p1',label:'Player 1 · Host'},{value:'p2',label:'Player 2 · Duo'},{value:'all',label:'Todos'}];
const mobs=[{value:'',label:'Mobs mistos'},{value:'wraith',label:'Espectro'},{value:'reaper',label:'Ceifador'},{value:'infected',label:'Infectado'},{value:'crawler',label:'Criatura das Sombras'},{value:'eye',label:'Observador'},{value:'brute',label:'Brutamonte'}];
const spawnTiers=[{value:'normal',label:'Comum'},{value:'1',label:'Elite'},{value:'2',label:'Corrompido'}];
const bossTiers=[{value:'',label:'Natural · 93% / 6% / 1%'},{value:'normal',label:'Normal'},{value:'1',label:'Elite'},{value:'2',label:'Corrompido'}];
const skills=[
 {value:'speed',label:'Passos de Guerra'},{value:'medic',label:'Kit Médico'},{value:'rapid',label:'Rajada Rápida'},
 {value:'regen',label:'Regeneração'},{value:'armor',label:'Armadura'},{value:'xp',label:'Instinto de Caça'},
 {value:'blood',label:'Sanguinário'},{value:'flash',label:'Flash de Luz'},{value:'pierce',label:'Munição Perfurante'},
 {value:'arc',label:'Arco Voltaico'},{value:'ghost',label:'Fantasma'},{value:'dodge',label:'Esquiva · Única'},
 {value:'ice',label:'Estilhaço de Gelo'},{value:'shock',label:'Onda de Choque'},{value:'berserker',label:'Berserker'},
 {value:'explosive',label:'Munição Explosiva'},{value:'phoenix',label:'Fênix · Única'}
];
function put(action){const old=find(action.id);if(old)Object.assign(old,action);else actions.push(action)}
put({id:'spawn',label:'Adicionar mobs',icon:'👾',description:'Cria inimigos escolhendo tipo, quantidade e variante.',hudSide:'chaos',params:[select('mob','INIMIGO','',mobs),number('amount','QUANTIDADE',1,100,25),select('tier','VARIANTE','normal',spawnTiers)]});
put({id:'boss',label:'Invocar Boss',icon:'👑',description:'Invoca Colosso Carmesim ou Senhor do Vazio.',hudSide:'chaos',params:[select('mob','BOSS','colossus',[{value:'colossus',label:'Colosso Carmesim'},{value:'voidlord',label:'Senhor do Vazio'}]),number('amount','QUANTIDADE',1,20,1),select('tier','VARIANTE','',bossTiers)]});
put({id:'speed',label:'Velocidade dos mobs',icon:'💨',description:'Altera a velocidade global dos inimigos.',hudSide:'chaos',params:[select('value','VELOCIDADE','1',[{value:'0.5',label:'0.5×'},{value:'1',label:'1×'},{value:'1.5',label:'1.5×'},{value:'2.5',label:'2.5×'}])]});
put({id:'damage',label:'Causar dano',icon:'💥',description:'Retira vida do jogador selecionado.',hudSide:'chaos',params:[number('amount','DANO',1,100,2),select('target','ALVO','p1',targets)]});
put({id:'freeze',label:'Congelar arena',icon:'❄️',description:'Congela os inimigos temporariamente.',hudSide:'chaos',params:[number('seconds','SEGUNDOS',1,60,8)]});
put({id:'eventmeteor',label:'Chuva de Meteoro',icon:'☄️',description:'Liga/desliga a chuva e aplica toda a configuração do evento.',hudSide:'chaos',params:[toggle('value','ATIVAR',true),number('batch','METEOROS POR ONDA',1,25,1),number('interval','INTERVALO ENTRE ONDAS (S)',0.45,12,1.7,0.1),number('warning','AVISO NO CHÃO (S)',0.6,5,1.8,0.1),number('radius','RAIO',45,180,92),number('playerDamage','DANO PLAYER',1,80,18),number('mobDamage','DANO MOBS',1,100,20)]});
put({id:'eventmeteorconfig',label:'Configurar Meteoro',icon:'☄️',description:'Atualiza a configuração da chuva sem alterar o estado ON/OFF.',hudSide:'chaos',params:[number('batch','METEOROS POR ONDA',1,25,1),number('interval','INTERVALO ENTRE ONDAS (S)',0.45,12,1.7,0.1),number('warning','AVISO NO CHÃO (S)',0.6,5,1.8,0.1),number('radius','RAIO',45,180,92),number('playerDamage','DANO PLAYER',1,80,18),number('mobDamage','DANO MOBS',1,100,20)]});
put({id:'heal',label:'Curar jogador',icon:'❤',description:'Recupera vida do jogador selecionado.',hudSide:'player',params:[number('amount','CURA',1,100,1),select('target','ALVO','p1',targets)]});
put({id:'invincible',label:'Invencibilidade',icon:'🛡️',description:'Ativa invencibilidade temporária.',hudSide:'player',params:[number('seconds','SEGUNDOS',1,60,10),select('target','ALVO','p1',targets)]});
put({id:'saveplayer',label:'Salvar / Reviver jogador',icon:'🛟',description:'Salva ou revive o jogador selecionado.',hudSide:'player',params:[select('target','ALVO','p1',targets)]});
put({id:'clear',label:'Limpar arena',icon:'🧹',description:'Remove todos os mobs atuais.',hudSide:'player',params:[]});
put({id:'xp',label:'Dar XP',icon:'✨',description:'Entrega XP ao jogador.',hudSide:'player',params:[number('amount','XP',1,5000,50),select('target','ALVO','p1',targets)]});
put({id:'level',label:'Dar Level',icon:'⬆️',description:'Adiciona níveis ao jogador.',hudSide:'player',params:[number('amount','LEVELS',1,10,1),select('target','ALVO','p1',targets)]});
put({id:'eventdoublexp',label:'Dobro de XP',icon:'✨',description:'Liga ou desliga o evento de XP em dobro.',hudSide:'player',params:[toggle('value','ATIVAR',true)]});
put({id:'pause',label:'Pausar partida',icon:'Ⅱ',description:'Pausa a partida imediatamente.',hudSide:'admin',params:[]});
put({id:'resume',label:'Continuar partida',icon:'▶️',description:'Retoma a partida imediatamente.',hudSide:'admin',params:[]});
put({id:'restart',label:'Reiniciar partida',icon:'↻',description:'Reinicia a partida atual.',hudSide:'admin',params:[]});
put({id:'auto',label:'Auto Inteligente',icon:'🤖',description:'Liga/desliga movimento, desvio e escolha automática de skills.',hudSide:'admin',params:[toggle('value','ATIVAR',true)]});
put({id:'horde',label:'Hordas automáticas',icon:'🌊',description:'Liga/desliga o spawn normal das hordas.',hudSide:'admin',params:[toggle('value','ATIVAR',true)]});
put({id:'autofire',label:'Tiro automático',icon:'🔫',description:'Liga/desliga os disparos automáticos do soldado.',hudSide:'admin',params:[toggle('value','ATIVAR',true)]});
put({id:'gameplaymode',label:'Modo de jogabilidade',icon:'🎮',description:'Escolhe o comportamento da mira durante controle manual.',hudSide:'admin',params:[select('value','MODO','classic',[{value:'classic',label:'Clássico'},{value:'sweep',label:'Varredura'},{value:'hardcore',label:'Hardcore'}])]});
put({id:'fps',label:'Mostrar FPS',icon:'📊',description:'Liga/desliga o contador de FPS no jogo.',hudSide:'admin',params:[toggle('value','ATIVAR',true)]});
put({id:'skilltest',label:'Ativar Skill',icon:'🧪',description:'Ativa uma habilidade específica no nível escolhido.',hudSide:'admin',params:[select('skill','SKILL','speed',skills),number('level','LEVEL',1,5,1)]});
put({id:'skilltestall',label:'Ativar todas as Skills',icon:'🧪',description:'Ativa todas as habilidades no nível escolhido.',hudSide:'admin',params:[number('level','LEVEL',1,5,1)]});
put({id:'skillreset',label:'Resetar Skills',icon:'🧪',description:'Remove as habilidades concedidas para teste.',hudSide:'admin',params:[]});
manifest.adminReplacement=true;
manifest.adminSource='caos-admin-v0.17.47';
window.dispatchEvent(new CustomEvent('caos:liveplus-actions-ready',{detail:{gameId:manifest.gameId,actions:actions.length,adminReplacement:true}}));
})();