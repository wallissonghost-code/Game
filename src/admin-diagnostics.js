(()=>{'use strict';
const $=id=>document.getElementById(id);let db=null,uid='';
function fmt(ms){const s=Math.max(0,Math.floor((+ms||0)/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function lastFrame(d){return Array.isArray(d?.frames)&&d.frames.length?d.frames[d.frames.length-1]:{}}
async function init(){
  const box=$('diagStatus');if(!box)return;
  try{if(!window.CaosRank)throw Error('Firebase não carregado');await window.CaosRank.ready();uid=window.CaosRank.uid();db=window.firebase.firestore();box.textContent='Diagnóstico conectado · buscando última partida...';await loadLatest()}catch(e){box.textContent='Diagnóstico indisponível: '+String(e?.message||e)}
}
async function loadLatest(){
  if(!db||!uid)return;const snap=await db.collection('diagnostic_latest').doc(uid).get();const d=snap.exists?snap.data():null,card=$('diagLatest');
  if(!d){card.innerHTML='<b>NENHUMA PARTIDA RECEBIDA</b><small>Jogue uma partida neste usuário para ela aparecer aqui.</small>';return}
  const f=lastFrame(d),date=new Date(d.updatedAt||d.startedAt||Date.now()).toLocaleString('pt-BR');
  card.innerHTML='<b>ÚLTIMA PARTIDA</b><span>'+date+'</span><div class="diagGrid"><span>LV <strong>'+ (+f.lv||0)+'</strong></span><span>TEMPO <strong>'+fmt(d.durationMs)+'</strong></span><span>KILLS <strong>'+ (+f.kills||0)+'</strong></span><span>FPS <strong>'+Math.round(+f.fps||0)+'</strong></span><span>MOBS <strong>'+ (+f.mobs||0)+'</strong></span><span>FRAMES <strong>'+((d.frames||[]).length)+'</strong></span></div><small>ID '+String(d.sessionId||'—')+'</small>';
  card.dataset.session=String(d.sessionId||'');
}
async function save(){
  if(!db||!uid)return;const latest=await db.collection('diagnostic_latest').doc(uid).get();if(!latest.exists)return alert('Nenhuma partida para salvar.');const d=latest.data(),note=String($('diagNote')?.value||'').trim().slice(0,300),id=String(d.sessionId||('diag-'+Date.now()));await db.collection('diagnostic_saved').doc(id).set({...d,protected:true,note,savedAt:Date.now()},{merge:false});$('diagStatus').textContent='✓ Partida salva e protegida · '+id;await loadSaved()}
async function loadSaved(){if(!db||!uid)return;const out=$('diagSaved');try{const q=await db.collection('diagnostic_saved').where('uid','==',uid).limit(10).get();const rows=q.docs.map(x=>x.data()).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));out.innerHTML=rows.length?rows.map(d=>{const f=lastFrame(d);return '<div class="diagSavedRow"><b>LV '+(+f.lv||0)+' · '+fmt(d.durationMs)+'</b><span>'+String(d.note||'Sem nota')+'</span><small>'+String(d.sessionId||'')+'</small></div>'}).join(''):'<small>Nenhuma partida protegida.</small>'}catch(e){out.textContent='Não foi possível listar: '+String(e?.message||e)}}
window.addEventListener('load',()=>{setTimeout(init,300)});$('diagRefresh')?.addEventListener('click',()=>{loadLatest();loadSaved()});$('diagSave')?.addEventListener('click',save);
})();