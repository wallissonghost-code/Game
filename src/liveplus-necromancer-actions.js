(()=>{'use strict';
const api=window.CaosLivePlus,m=api?.manifest;if(!m||!Array.isArray(m.actions))return;
const actions=m.actions,find=id=>actions.find(a=>a.id===id);
const number=(id,label,min,max,def,step)=>({id,label,type:'number',min,max,default:def,...(step?{step}:{})});
const toggle=(id,label,def=false)=>({id,label,type:'toggle',default:def});
const select=(id,label,def,options)=>({id,label,type:'select',default:def,options});
const mobs=[{value:'',label:'Mob misto'},{value:'wraith',label:'Espectro'},{value:'reaper',label:'Ceifador'},{value:'infected',label:'Infectado'},{value:'crawler',label:'Criatura das Sombras'},{value:'eye',label:'Observador'},{value:'brute',label:'Brutamonte'},{value:'colossus',label:'Colosso Carmesim'},{value:'voidlord',label:'Senhor do Vazio'}];
const tiers=[{value:'normal',label:'Normal'},{value:'1',label:'Elite'},{value:'2',label:'Corrompido'}];
function put(a){const old=find(a.id);if(old)Object.assign(old,a);else actions.push(a)}
function installNecroActions(manifest=m){
 if(!manifest||!Array.isArray(manifest.actions))return manifest;
 const target=manifest.actions,findIn=id=>target.find(a=>a.id===id),putIn=a=>{const old=findIn(a.id);if(old)Object.assign(old,a);else target.push(a)};
 putIn({id:'necro_toggle',label:'Necromante · ON/OFF',icon:'☠️',description:'Ativa ou desativa o sistema isolado do Necromante.',hudSide:'admin',donationEligible:false,donationGroup:'admin',donationGroupLabel:'NECROMANTE',params:[toggle('value','ATIVAR',true)]});
 putIn({id:'necro_config',label:'Necromante · Config',icon:'⚙️',description:'Configura limite, cadência de Erga-se, vida, dano e agressividade recebida.',hudSide:'admin',donationEligible:false,donationGroup:'admin',donationGroupLabel:'NECROMANTE',params:[number('maxSummons','MÁXIMO DE SOMBRAS',1,12,3),number('everyKills','ERGA-SE A CADA X ABATES',1,250,25),number('hpScale','VIDA ×',1,20,5,.1),number('damageScale','DANO ×',.1,5,.55,.05),number('aggroPct','AGGRO NOS INVOCADOS %',0,100,12,1)]});
 putIn({id:'necro_raise',label:'Necromante · Erga-se',icon:'🕯️',description:'Força uma ou mais invocações para teste. Também pode ser associado a presente.',hudSide:'player',donationEligible:true,donationGroup:'player',donationGroupLabel:'PLAYER',params:[number('amount','QUANTIDADE',1,12,1),select('mob','MOB','',mobs),select('tier','VARIANTE','normal',tiers)]});
 putIn({id:'necro_clear',label:'Necromante · Limpar',icon:'🧹',description:'Remove somente os invocados do Necromante.',hudSide:'admin',donationEligible:false,donationGroup:'admin',donationGroupLabel:'NECROMANTE',params:[]});
 putIn({id:'necro_points',label:'Necromante · Pontos',icon:'✦',description:'Concede pontos de Alma para teste do painel interno.',hudSide:'admin',donationEligible:false,donationGroup:'admin',donationGroupLabel:'NECROMANTE',params:[number('amount','PONTOS',1,100,1)]});
 putIn({id:'necro_upgrade',label:'Necromante · Upgrade',icon:'⬆️',description:'Gasta/aplica upgrades da tropa sem pausar a partida.',hudSide:'admin',donationEligible:false,donationGroup:'admin',donationGroupLabel:'NECROMANTE',params:[select('upgrade','UPGRADE','life',[{value:'life',label:'Vida'},{value:'damage',label:'Dano'},{value:'regen',label:'Regeneração'},{value:'armor',label:'Armadura'}]),number('levels','NÍVEIS',1,20,1)]});
 const admin=new Set(Array.isArray(manifest.adminActionIds)?manifest.adminActionIds:[]);['necro_toggle','necro_config','necro_clear','necro_points','necro_upgrade'].forEach(id=>admin.add(id));manifest.adminActionIds=[...admin];
 if(Array.isArray(manifest.donationGroups)){const player=manifest.donationGroups.find(g=>g.id==='player');if(player){const ids=new Set(player.actionIds||[]);ids.add('necro_raise');player.actionIds=[...ids]}}
 const donate=new Set(Array.isArray(manifest.donationActionIds)?manifest.donationActionIds:[]);donate.add('necro_raise');manifest.donationActionIds=[...donate];
 manifest.necromancer={protocol:'caos-necromancer-controls-v1',revision:2,isolated:true,actions:['necro_toggle','necro_config','necro_raise','necro_clear','necro_points','necro_upgrade']};
 manifest.schemaRevision='caos-live-manifest-necro-2';
 return manifest;
}
installNecroActions(m);
const proto=window.LivePlusGameSession?.prototype;
if(proto&&!proto.__caosNecroManifestGuard){
 proto.__caosNecroManifestGuard=true;
 const peer=proto.sendManifestPeer,relay=proto.sendManifestRelay;
 if(typeof peer==='function')proto.sendManifestPeer=function(){installNecroActions(this.manifest);return peer.call(this)};
 if(typeof relay==='function')proto.sendManifestRelay=function(){installNecroActions(this.manifest);return relay.call(this)};
}
window.__caosNecromancerManifestCheck=()=>({revision:m.schemaRevision,actions:m.actions.filter(a=>String(a.id).startsWith('necro_')).map(a=>a.id),total:m.actions.length});
window.dispatchEvent(new CustomEvent('caos:necromancer-actions-ready',{detail:{revision:m.schemaRevision,actions:m.necromancer.actions.slice(),total:m.actions.length}}));
})();