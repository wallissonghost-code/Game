(()=>{'use strict';
const $=id=>document.getElementById(id);let db=null,uid='';
const GIFT_CAT_KEY='caos-gift-catalog-v2';
function fmt(ms){const s=Math.max(0,Math.floor((+ms||0)/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function lastFrame(d){return Array.isArray(d?.frames)&&d.frames.length?d.frames[d.frames.length-1]:{}}
async function init(){
  const box=$('diagStatus');if(!box)return;
  try{if(!window.CaosRank)throw Error('Firebase não carregado');await window.CaosRank.ready();uid=window.CaosRank.uid();db=window.firebase.firestore();box.textContent='Diagnóstico conectado · buscando última partida...';await loadLatest()}catch(e){box.textContent='Diagnóstico indisponível: '+String(e?.message||e)}
}
async function loadLatest(){
  if(!db||!uid)return;const snap=await db.collection('diagnostic_latest').doc(uid).get();const d=snap.exists?snap.data():null,card=$('diagLatest');
  if(!d||!card)return;if(!d){card.innerHTML='<b>NENHUMA PARTIDA RECEBIDA</b><small>Jogue uma partida neste usuário para ela aparecer aqui.</small>';return}
  const f=lastFrame(d),date=new Date(d.updatedAt||d.startedAt||Date.now()).toLocaleString('pt-BR');
  card.innerHTML='<b>ÚLTIMA PARTIDA</b><span>'+date+'</span><div class="diagGrid"><span>LV <strong>'+ (+f.lv||0)+'</strong></span><span>TEMPO <strong>'+fmt(d.durationMs)+'</strong></span><span>KILLS <strong>'+ (+f.kills||0)+'</strong></span><span>FPS <strong>'+Math.round(+f.fps||0)+'</strong></span><span>MOBS <strong>'+ (+f.mobs||0)+'</strong></span><span>FRAMES <strong>'+((d.frames||[]).length)+'</strong></span></div><small>ID '+String(d.sessionId||'—')+'</small>';
  card.dataset.session=String(d.sessionId||'');
}
async function save(){
  if(!db||!uid)return;const latest=await db.collection('diagnostic_latest').doc(uid).get();if(!latest.exists)return alert('Nenhuma partida para salvar.');const d=latest.data(),note=String($('diagNote')?.value||'').trim().slice(0,300),id=String(d.sessionId||('diag-'+Date.now()));await db.collection('diagnostic_saved').doc(id).set({...d,protected:true,note,savedAt:Date.now()},{merge:false});if($('diagStatus'))$('diagStatus').textContent='✓ Partida salva e protegida · '+id;await loadSaved()}
async function loadSaved(){if(!db||!uid)return;const out=$('diagSaved');if(!out)return;try{const q=await db.collection('diagnostic_saved').where('uid','==',uid).limit(10).get();const rows=q.docs.map(x=>x.data()).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));out.innerHTML=rows.length?rows.map(d=>{const f=lastFrame(d);return '<div class="diagSavedRow"><b>LV '+(+f.lv||0)+' · '+fmt(d.durationMs)+'</b><span>'+String(d.note||'Sem nota')+'</span><small>'+String(d.sessionId||'')+'</small></div>'}).join(''):'<small>Nenhuma partida protegida.</small>'}catch(e){out.textContent='Não foi possível listar: '+String(e?.message||e)}}

function localVerifiedGifts(){
  try{const snap=JSON.parse(localStorage.getItem(GIFT_CAT_KEY)||'null'),list=Array.isArray(snap?.gifts)?snap.gifts:[];return list.filter(g=>g?.liveVerified&&!g?.liveDivergence)}catch{return[]}
}
function cleanGift(g,idFallback=''){
  const id=String(g?.id??idFallback??'').trim();if(!id)return null;
  return{id,name:String(g?.name||g?.liveVerifiedName||('gift-'+id)),diamondCount:Number(g?.diamondCount||g?.liveVerifiedValue)||0,icon:String(g?.icon||''),verifiedAt:Number(g?.lastLiveVerifiedAt||g?.firstLiveVerifiedAt)||Date.now(),liveVerifiedCount:Math.max(1,Number(g?.liveVerifiedCount)||1),source:String(g?.source||'caos-live-verified')};
}
async function cloudVerifiedGifts(){
  try{
    if(!window.firebase)return[];
    const cloud=db||window.firebase.firestore();
    const snap=await cloud.collection('gift_catalog_verified').limit(1000).get();
    return snap.docs.map(doc=>({...(doc.data()||{}),id:String(doc.data()?.id||doc.id)})).filter(g=>g.liveVerified&&!g.liveDivergence);
  }catch(e){console.warn('[CAOS EXPORT] Firestore indisponível; exportando cache local.',e);return[]}
}
async function collectVerifiedGifts(){
  const local=localVerifiedGifts(),remote=await cloudVerifiedGifts(),map=new Map();
  for(const raw of [...remote,...local]){const g=cleanGift(raw);if(!g)continue;const prev=map.get(g.id);map.set(g.id,prev?{...prev,...g,diamondCount:g.diamondCount||prev.diamondCount||0,icon:g.icon||prev.icon||'',verifiedAt:Math.max(prev.verifiedAt||0,g.verifiedAt||0),liveVerifiedCount:Math.max(prev.liveVerifiedCount||1,g.liveVerifiedCount||1)}:g)}
  return [...map.values()].sort((a,b)=>(a.diamondCount-b.diamondCount)||a.name.localeCompare(b.name));
}
function injectGiftExporter(){
  if($('verifiedGiftExporter'))return true;
  const pane=$('liveDiagIncidentPane'),monitor=$('tiktokLiveMonitor');if(!pane||!monitor)return false;
  const box=document.createElement('div');box.id='verifiedGiftExporter';box.style.cssText='margin-top:14px;padding:16px;border:1px solid #35506d;border-radius:16px;background:#09111f;display:grid;gap:11px';
  box.innerHTML='<div><span style="display:block;color:#9aa8c5;font-size:10px;font-weight:900;letter-spacing:.14em">CATÁLOGO MESTRE · BACKUP</span><b style="display:block;margin-top:6px;font-size:16px">Exportar presentes verificados</b><small style="display:block;margin-top:5px;color:#8592ad;line-height:1.5">Somente leitura · cache local + Firestore · sem alterar Connector, Live ou automações.</small></div><button id="exportVerifiedGifts" type="button" style="width:100%;min-height:50px;border:1px solid #4f3ea6;border-radius:13px;background:#21164a;color:#fff;font-weight:900;letter-spacing:.05em">EXPORTAR CATÁLOGO VERIFICADO</button><div id="exportVerifiedGiftsStatus" style="color:#8492ad;font-size:11px">Pronto para exportar.</div>';
  const list=$('liveDiagList');if(list?.parentNode===pane)pane.insertBefore(box,list);else pane.appendChild(box);
  $('exportVerifiedGifts')?.addEventListener('click',exportVerifiedGifts);return true;
}
async function exportVerifiedGifts(){
  const btn=$('exportVerifiedGifts'),status=$('exportVerifiedGiftsStatus');if(!btn)return;
  const old=btn.textContent;btn.disabled=true;btn.textContent='PREPARANDO...';if(status)status.textContent='Lendo presentes verificados...';
  try{
    const gifts=await collectVerifiedGifts();if(!gifts.length)throw Error('Nenhum presente verificado foi encontrado no cache local ou Firestore.');
    const payload={schema:'liveplus.verified-gifts.v1',version:'1.0.0',verifiedAt:Date.now(),exportedAt:new Date().toISOString(),source:'caos-live-verified-export',count:gifts.length,gifts};
    const json=JSON.stringify(payload,null,2),file=new File([json],`caos-presentes-verificados-${gifts.length}.json`,{type:'application/json'});
    if(navigator.share&&navigator.canShare?.({files:[file]})){
      await navigator.share({title:'Caos · Presentes verificados',text:`${gifts.length} presentes verificados`,files:[file]});
      if(status)status.textContent=`✅ ${gifts.length} presentes preparados. Salve o JSON em Arquivos.`;
    }else{
      const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
      if(status)status.textContent=`✅ ${gifts.length} presentes exportados em JSON.`;
    }
  }catch(e){if(String(e?.name)==='AbortError'){if(status)status.textContent='Exportação cancelada.'}else{console.error('[CAOS EXPORT]',e);if(status)status.textContent='⚠️ '+String(e?.message||e)}}finally{btn.disabled=false;btn.textContent=old}
}

function bootExporter(){let tries=0;const timer=setInterval(()=>{tries++;if(injectGiftExporter()||tries>=20)clearInterval(timer)},250)}
window.addEventListener('load',()=>{setTimeout(init,300);bootExporter()});$('diagRefresh')?.addEventListener('click',()=>{loadLatest();loadSaved()});$('diagSave')?.addEventListener('click',save);
})();