(()=>{'use strict';
const api=window.CaosLivePlus,m=api?.manifest;if(!m||!Array.isArray(m.actions))return;
const number=(id,label,min,max,def,step)=>({id,label,type:'number',min,max,default:def,...(step?{step}:{})});
const toggle=(id,label,def=false)=>({id,label,type:'toggle',default:def});
const select=(id,label,def,options)=>({id,label,type:'select',default:def,options});
const mobs=[{value:'',label:'Aleatório'},{value:'wraith',label:'Ogro Espectro'},{value:'reaper',label:'Ogro Ceifador'},{value:'infected',label:'Ogro Infectado'},{value:'crawler',label:'Ogro das Sombras'},{value:'eye',label:'Ogro Observador'},{value:'brute',label:'Ogro Brutamonte'},{value:'colossus',label:'Boss · Colosso'},{value:'voidlord',label:'Boss · Senhor do Vazio'}];
const tiers=[{value:'normal',label:'Normal'},{value:'1',label:'Elite'},{value:'2',label:'Corrompido'}];
const ids=['necro_toggle','necro_config','necro_raise','necro_clear','necro_points','necro_upgrade'];
function install(manifest=m){
 if(!manifest||!Array.isArray(manifest.actions))return manifest;
 // Remove a interface antiga/confusa e publica apenas 2 controles claros.
 manifest.actions=manifest.actions.filter(a=>!ids.includes(String(a?.id||'')));
 manifest.actions.push({
  id:'necro_config',label:'Necromante',icon:'☠️',description:'Liga o Necromante e define como as sombras funcionam.',hudSide:'admin',donationEligible:false,donationGroup:'admin',donationGroupLabel:'NECROMANTE',
  params:[toggle('enabled','ATIVAR NECROMANTE',true),number('maxSummons','MÁXIMO DE SOMBRAS',1,12,3),number('everyKills','ERGA-SE A CADA X ABATES',1,250,25),number('hpScale','VIDA DAS SOMBRAS ×',1,20,5,.1),number('damageScale','DANO DAS SOMBRAS ×',.1,5,.55,.05),number('aggroPct','AGGRO NOS INVOCADOS %',0,100,12,1),toggle('clear','LIMPAR SOMBRAS AGORA',false)]
 });
 manifest.actions.push({
  id:'necro_raise',label:'Erga-se',icon:'🕯️',description:'Invoca sombras imediatamente para teste ou para uma regra do Live+.',hudSide:'player',donationEligible:true,donationGroup:'player',donationGroupLabel:'PLAYER',
  params:[number('amount','QUANTIDADE',1,12,1),select('mob','MOB','',mobs),select('tier','VARIANTE','normal',tiers)]
 });
 const admin=new Set((manifest.adminActionIds||[]).filter(id=>!ids.includes(id)));admin.add('necro_config');manifest.adminActionIds=[...admin];
 if(Array.isArray(manifest.donationGroups)){const player=manifest.donationGroups.find(g=>g.id==='player');if(player){player.actionIds=[...(new Set([...(player.actionIds||[]).filter(id=>!ids.includes(id)),'necro_raise']))]}}
 manifest.donationActionIds=[...(new Set([...(manifest.donationActionIds||[]).filter(id=>!ids.includes(id)),'necro_raise']))];
 manifest.necromancer={protocol:'caos-necromancer-controls-v2',revision:3,isolated:true,actions:['necro_config','necro_raise']};
 manifest.schemaRevision='caos-live-manifest-necro-3';
 return manifest;
}
install(m);
const proto=window.LivePlusGameSession?.prototype;
if(proto&&!proto.__caosNecroManifestGuardV3){
 proto.__caosNecroManifestGuardV3=true;
 const peer=proto.sendManifestPeer,relay=proto.sendManifestRelay;
 if(typeof peer==='function')proto.sendManifestPeer=function(){install(this.manifest);return peer.call(this)};
 if(typeof relay==='function')proto.sendManifestRelay=function(){install(this.manifest);return relay.call(this)};
}
window.__caosNecromancerManifestCheck=()=>({revision:m.schemaRevision,actions:m.actions.filter(a=>String(a.id).startsWith('necro_')).map(a=>a.id),total:m.actions.length});
})();