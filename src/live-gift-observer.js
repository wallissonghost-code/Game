(()=>{'use strict';

const $=id=>document.getElementById(id);
const DISC_KEY='caos-private-live-gifts-v1';
const SAVED_KEY='caos-private-live-gifts-saved-v1';
const CAT_KEY='caos-gift-catalog-v2';
const RULE_KEY='caos-live-rules-v2';

let ws=null;
let active=false;
let verifiedOnly=false;
let divergenceFilter='all';
let cloudDb=null;
let cloudReady=null;

const FIREBASE_CONFIG={
  apiKey:'AIzaSyCVJqZKPhmKUwS_YhtyvUfQCfmvTOB2Wlg',
  authDomain:'caos-live.firebaseapp.com',
  projectId:'caos-live',
  storageBucket:'caos-live.firebasestorage.app',
  messagingSenderId:'652480823706',
  appId:'1:652480823706:web:83551a0d8eaebff93eba23',
  measurementId:'G-04377MKMX1'
};

const read=(k,f=[])=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const discoveries=()=>read(DISC_KEY,[]);
const saveDiscoveries=v=>write(DISC_KEY,v);
const saved=()=>read(SAVED_KEY,[]);
const saveSaved=v=>write(SAVED_KEY,v);
const rules=()=>read(RULE_KEY,[]);
const catSnap=()=>read(CAT_KEY,null);
const catalog=()=>catSnap()?.gifts||[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();

function endpoint(){return $('cloudEndpoint')?.value||'wss://game-f202.onrender.com'}
function key(){return $('cloudKey')?.value?.trim()||''}
function status(t,ok=false){
  const e=$('giftObserverStatus');
  if(e){e.textContent=t;e.style.color=ok?'#86efac':'#fbbf24'}
}
function incomingIcon(d){return d.icon||d.giftIcon||d.image||d.iconUrl||d.imageUrl||''}

function findKnown(id,name){
  const list=catalog();
  const byId=list.find(g=>String(g.id)===String(id));
  if(byId)return{gift:byId,matchedBy:'id'};
  const byName=list.find(g=>norm(g.name)===norm(name));
  return byName?{gift:byName,matchedBy:'name'}:null;
}

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const found=[...document.scripts].find(s=>s.src===src);
    if(found){
      if(window.firebase)return resolve();
      found.addEventListener('load',resolve,{once:true});
      found.addEventListener('error',reject,{once:true});
      return;
    }
    const s=document.createElement('script');
    s.src=src;
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  });
}

async function initCloud(){
  if(cloudReady)return cloudReady;
  cloudReady=(async()=>{
    if(!window.firebase){
      await loadScript('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore-compat.js');
    }
    const app=window.firebase.apps?.length?window.firebase.app():window.firebase.initializeApp(FIREBASE_CONFIG);
    const auth=window.firebase.auth(app);
    try{await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL)}catch{}
    if(!auth.currentUser)await auth.signInAnonymously();
    cloudDb=window.firebase.firestore(app);
    await pullVerifiedCloud();
    return cloudDb;
  })().catch(e=>{
    console.warn('[CAOS GIFTS] cloud indisponível',e);
    cloudDb=null;
    return null;
  });
  return cloudReady;
}

function verifiedPayload(g){
  return{
    id:String(g.id),
    name:String(g.name||''),
    diamondCount:Number(g.diamondCount)||0,
    icon:String(g.icon||''),
    liveVerified:true,
    liveVerifiedCount:Number(g.liveVerifiedCount)||1,
    firstLiveVerifiedAt:Number(g.firstLiveVerifiedAt)||Date.now(),
    lastLiveVerifiedAt:Number(g.lastLiveVerifiedAt)||Date.now(),
    liveVerifiedId:g.liveVerifiedId?String(g.liveVerifiedId):null,
    liveVerifiedName:String(g.liveVerifiedName||g.name||''),
    liveVerifiedValue:Number(g.liveVerifiedValue)||null,
    liveDivergence:g.liveDivergence||null,
    liveNameAutoCorrectedAt:Number(g.liveNameAutoCorrectedAt)||null,
    liveNamePrevious:g.liveNamePrevious?String(g.liveNamePrevious):null,
    source:String(g.source||'catalog')
  };
}

async function syncVerifiedCloud(g){
  if(!g?.id||!g.liveVerified)return;
  const db=cloudDb||await initCloud();
  if(!db)return;
  try{
    await db.collection('gift_catalog_verified').doc(String(g.id)).set(verifiedPayload(g),{merge:true});
  }catch(e){
    console.warn('[CAOS GIFTS] falha ao salvar verificação',g.id,e);
  }
}

async function removeVerifiedCloud(id){
  if(!id)return;
  const db=cloudDb||await initCloud();
  if(!db)return;
  try{
    await db.collection('gift_catalog_verified').doc(String(id)).delete();
  }catch(e){
    console.warn('[CAOS GIFTS] falha ao remover ID antigo verificado',id,e);
  }
}

async function pullVerifiedCloud(){
  if(!cloudDb)return;
  try{
    const snap=await cloudDb.collection('gift_catalog_verified').limit(1000).get();
    if(snap.empty)return;
    let local=catSnap();
    if(!local||!Array.isArray(local.gifts))local={capturedAt:0,gifts:[]};
    let changed=false;
    snap.docs.forEach(doc=>{
      const remote=doc.data()||{};
      const id=String(remote.id||doc.id);
      const g=local.gifts.find(x=>String(x.id)===id);
      if(g){
        const before=Number(g.liveVerifiedCount)||0;
        g.liveVerified=true;
        g.liveVerifiedCount=Math.max(before,Number(remote.liveVerifiedCount)||1);
        g.firstLiveVerifiedAt=Math.min(Number(g.firstLiveVerifiedAt)||Infinity,Number(remote.firstLiveVerifiedAt)||Infinity);
        if(!Number.isFinite(g.firstLiveVerifiedAt))g.firstLiveVerifiedAt=Number(remote.firstLiveVerifiedAt)||Date.now();
        g.lastLiveVerifiedAt=Math.max(Number(g.lastLiveVerifiedAt)||0,Number(remote.lastLiveVerifiedAt)||0);
        g.liveVerifiedId=remote.liveVerifiedId??g.liveVerifiedId??null;
        g.liveVerifiedName=remote.liveVerifiedName||g.liveVerifiedName||g.name;
        g.liveVerifiedValue=remote.liveVerifiedValue??g.liveVerifiedValue??null;
        g.liveDivergence=remote.liveDivergence??g.liveDivergence??null;
        g.liveNameAutoCorrectedAt=Math.max(Number(g.liveNameAutoCorrectedAt)||0,Number(remote.liveNameAutoCorrectedAt)||0)||null;
        g.liveNamePrevious=remote.liveNamePrevious||g.liveNamePrevious||null;
        if(!g.icon&&remote.icon)g.icon=remote.icon;
        changed=true;
      }else{
        local.gifts.push({...remote,id,source:remote.source||'cloud-verified'});
        changed=true;
      }
    });
    if(changed){
      write(CAT_KEY,local);
      window.dispatchEvent(new CustomEvent('caos-catalog-updated',{detail:{cloudMerged:true}}));
      decorateVerifiedCatalog();
    }
  }catch(e){
    console.warn('[CAOS GIFS] falha ao carregar verificados',e);
  }
}

function updateCatalogKnown(match,d){
  const meta=match.gift;
  const snap=catSnap();
  if(!snap||!Array.isArray(snap.gifts))return null;
  const g=snap.gifts.find(x=>String(x.id)===String(meta.id));
  if(!g)return null;

  const now=Date.now();
  const liveId=String(d.giftId??'');
  const liveValue=Number(d.diamondCount)||0;
  const liveName=d.gift||d.giftName||g.name;
  const liveIcon=incomingIcon(d);
  const count=Math.max(1,Number(d.count)||1);

  g.liveVerified=true;
  g.liveVerifiedCount=(g.liveVerifiedCount||0)+count;
  g.firstLiveVerifiedAt=g.firstLiveVerifiedAt||now;
  g.lastLiveVerifiedAt=now;
  g.liveVerifiedId=liveId||null;
  g.liveVerifiedName=liveName;
  g.liveVerifiedValue=liveValue||null;
  if(liveIcon&&!g.icon)g.icon=liveIcon;

  const idDiff=!!liveId&&String(g.id)!==liveId;
  let nameDiff=!!norm(liveName)&&norm(g.name)!==norm(liveName);
  const valueDiff=liveValue>0&&Number(g.diamondCount)>0&&liveValue!==Number(g.diamondCount);

  if(nameDiff&&liveName){
    g.liveNamePrevious=g.name;
    g.name=liveName;
    g.liveNameAutoCorrectedAt=now;
    nameDiff=false;
  }

  g.liveDivergence=idDiff||nameDiff||valueDiff?{
    at:now,
    matchedBy:match.matchedBy,
    id:idDiff?{catalog:String(g.id),live:liveId}:null,
    name:nameDiff?{catalog:g.name,live:liveName}:null,
    value:valueDiff?{catalog:Number(g.diamondCount),live:liveValue}:null
  }:null;

  write(CAT_KEY,snap);
  saveDiscoveries(discoveries().filter(x=>String(x.id)!==liveId&&String(x.id)!==String(g.id)));
  syncVerifiedCloud(g);
  window.dispatchEvent(new CustomEvent('caos-catalog-updated',{
    detail:{id:String(g.id),verified:true,divergence:!!g.liveDivergence,nameAutoCorrected:!!g.liveNameAutoCorrectedAt}
  }));
  decorateVerifiedCatalog();
  return g;
}

function divergenceSummary(d){
  if(!d)return'';
  const p=[];
  if(d.id)p.push(`ID ${d.id.catalog}→${d.id.live}`);
  if(d.name)p.push(`nome ${d.name.catalog}→${d.name.live}`);
  if(d.value)p.push(`valor ${d.value.catalog}→${d.value.live}💎`);
  return p.join(' · ');
}

function divergenceTypes(d){
  if(!d)return[];
  return['name','value','id'].filter(k=>d[k]);
}

function rememberUnknown(d){
  const id=String(d.giftId??'');
  if(!id)return;
  let list=discoveries();
  let g=list.find(x=>String(x.id)===id);
  const now=Date.now();
  if(!g){
    g={
      id,
      name:d.gift||d.giftName||`gift-${id}`,
      diamondCount:Number(d.diamondCount)||0,
      icon:incomingIcon(d),
      firstSeen:now,
      lastSeen:now,
      seen:0,
      manualValue:false
    };
    list.unshift(g);
  }
  g.name=d.gift||d.giftName||g.name;
  if(!g.manualValue)g.diamondCount=Number(d.diamondCount)||g.diamondCount||0;
  g.icon=incomingIcon(d)||g.icon||'';
  g.lastSeen=now;
  g.seen=(g.seen||0)+Math.max(1,Number(d.count)||1);
  saveDiscoveries(list.slice(0,1000));
  render();
  status(`🆕 ${g.name} · ID ${g.id} · NÃO EXISTE NO CATÁLOGO`,true);
}

function receive(d){
  if(d.type!=='gift')return;
  const id=String(d.giftId??'');
  const name=d.gift||d.giftName||`gift-${id}`;
  if(!id)return;
  const match=findKnown(id,name);
  if(match){
    const beforeName=match.gift?.name;
    const g=updateCatalogKnown(match,d);
    const diff=divergenceSummary(g?.liveDivergence);
    render();
    if(g?.liveNameAutoCorrectedAt&&beforeName&&norm(beforeName)!==norm(g.name)&&!g.liveDivergence){
      status(`✅ ${beforeName} → ${g.name} · NOME CORRIGIDO AUTOMATICAMENTE · VERIFICADO AO VIVO`,true);
    }else{
      status(g?.liveDivergence?`⚠️ ${g.name} · ${diff}`:`✅ ${g?.name||name} · PRESENTE VERIFICADO AO VIVO`,!g?.liveDivergence);
    }
    return;
  }
  rememberUnknown(d);
}

function setValue(id){
  let list=discoveries();
  const g=list.find(x=>String(x.id)===String(id));
  if(!g)return;
  const raw=prompt(`Valor em moedas/diamantes de ${g.name}:`,g.diamondCount||'');
  if(raw===null)return;
  const n=Number(String(raw).replace(',','.'));
  if(!Number.isFinite(n)||n<0)return alert('Valor inválido.');
  g.diamondCount=n;
  g.manualValue=true;
  saveDiscoveries(list);
  let sl=saved();
  const s=sl.find(x=>String(x.id)===String(id));
  if(s){
    s.diamondCount=n;
    s.manualValue=true;
    saveSaved(sl);
  }
  render();
}

function keep(id){
  const g=discoveries().find(x=>String(x.id)===String(id));
  if(!g)return;
  let list=saved();
  const i=list.findIndex(x=>String(x.id)===String(id));
  const item={...g,savedAt:Date.now()};
  if(i>=0)list[i]=item;
  else list.unshift(item);
  saveSaved(list);
  render();
  status(`⭐ ${g.name} salvo na seleção`,true);
}

function addToCatalog(id){
  const g=discoveries().find(x=>String(x.id)===String(id));
  if(!g)return;
  const snap=catSnap();
  if(!snap||!Array.isArray(snap.gifts))return status('⚠️ Capture o catálogo principal primeiro');
  if(snap.gifts.some(x=>String(x.id)===String(id)))return status('Esse ID já existe no catálogo.');
  const item={
    ...g,
    liveVerified:true,
    liveVerifiedCount:g.seen||1,
    firstLiveVerifiedAt:g.firstSeen,
    lastLiveVerifiedAt:g.lastSeen,
    source:'live-discovery'
  };
  snap.gifts.push(item);
  write(CAT_KEY,snap);
  syncVerifiedCloud(item);
  saveDiscoveries(discoveries().filter(x=>String(x.id)!==String(id)));
  window.dispatchEvent(new CustomEvent('caos-catalog-updated',{detail:{id,added:true}}));
  render();
  decorateVerifiedCatalog();
  status(`✅ ${g.name} adicionado ao catálogo principal`,true);
}

function removeSaved(id){
  saveSaved(saved().filter(x=>String(x.id)!==String(id)));
  render();
}

function clearObserved(){
  if(!confirm('Limpar somente os presentes NOVOS descobertos? Os verificados já estão no catálogo e os SALVOS serão mantidos.'))return;
  saveDiscoveries([]);
  render();
  status('Descobertas limpas. Catálogo e Salvos mantidos.',true);
}

function stop(){
  active=false;
  try{ws?.send(JSON.stringify({type:'disconnect'}))}catch{}
  try{ws?.close()}catch{}
  ws=null;
  status('OBSERVADOR OFF');
  if($('giftObserverStart'))$('giftObserverStart').textContent='INICIAR OBSERVAÇÃO';
}

function start(){
  const user=($('giftObserverUser')?.value||'').trim().replace(/^@/,'');
  if(!user)return status('⚠️ Informe o @ da Live pública');
  stop();
  active=true;
  status('CONECTANDO...');
  if($('giftObserverStart'))$('giftObserverStart').textContent='PARAR OBSERVAÇÃO';
  try{ws=new WebSocket(endpoint())}catch(e){active=false;return status('⚠️ '+e.message)}
  ws.onopen=()=>ws.send(JSON.stringify({type:'auth',key:key()}));
  ws.onmessage=e=>{
    let d;
    try{d=JSON.parse(e.data)}catch{return}
    if(d.type==='auth'){
      if(!d.ok){status('⚠️ Chave inválida');return stop()}
      ws.send(JSON.stringify({type:'connect',username:user}));
      return;
    }
    if(d.type==='status'&&d.status==='connected')status(`👁 Observando @${user} · validando catálogo`,true);
    if(d.type==='status'&&d.status==='disconnected'&&active)status('⚠️ Live desconectada');
    if(d.type==='error')status('⚠️ '+(d.message||'Erro no Connector'));
    receive(d);
  };
  ws.onerror=()=>status('⚠️ Falha no observador');
  ws.onclose=()=>{
    ws=null;
    if(active){
      status('RECONECTANDO OBSERVADOR...');
      setTimeout(()=>active&&start(),3000);
    }
  };
}

function card(g,isSaved=false){
  const value=g.diamondCount>0?`${g.diamondCount} 💎`:'VALOR NÃO IDENTIFICADO';
  return `<div class="giftCatalogRow giftCatalogRowV2">${g.icon?`<img class="giftThumb" src="${esc(g.icon)}" alt="${esc(g.name)}" loading="lazy">`:'<div class="giftThumb giftThumbMissing">SEM IMAGEM</div>'}<div class="giftMain"><b>${esc(g.name)}</b><span>ID ${esc(g.id)} · ${esc(value)}</span><div class="giftRowActions"><button class="miniBtn" data-value="${esc(g.id)}">EDITAR VALOR</button>${isSaved?`<button class="miniBtn danger" data-remove="${esc(g.id)}">REMOVER</button>`:`<button class="miniBtn" data-keep="${esc(g.id)}">⭐ SALVAR</button><button class="miniBtn" data-addcat="${esc(g.id)}">+ CATÁLOGO</button>`}</div></div><div class="giftRuleState"><small>${g.manualValue?'VALOR MANUAL':'🆕 DESCOBERTO AO VIVO'}</small><strong>${g.seen||0}× · ${new Date(g.lastSeen||g.savedAt).toLocaleString('pt-BR')}</strong></div></div>`;
}

function render(){
  const box=$('privateGiftList');
  const meta=$('privateGiftMeta');
  if(!box)return;
  const tab=$('giftObserverSavedTab')?.classList.contains('active')?'saved':'observed';
  const q=norm($('privateGiftSearch')?.value);
  const all=tab==='saved'?saved():discoveries();
  const arr=all.filter(g=>!q||norm(g.name).includes(q)||String(g.id).includes(q));
  if(meta)meta.textContent=tab==='saved'?`${all.length} presentes selecionados`:`${all.length} NOVOS fora do catálogo`;
  box.innerHTML=arr.slice(0,100).map(g=>card(g,tab==='saved')).join('')||'<div class="hint">Nenhum presente novo nesta aba. Os conhecidos são validados direto no catálogo principal.</div>';
  box.querySelectorAll('[data-value]').forEach(b=>b.onclick=()=>setValue(b.dataset.value));
  box.querySelectorAll('[data-keep]').forEach(b=>b.onclick=()=>keep(b.dataset.keep));
  box.querySelectorAll('[data-addcat]').forEach(b=>b.onclick=()=>addToCatalog(b.dataset.addcat));
  box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeSaved(b.dataset.remove));
}

function rowGift(row,list){
  const txt=row.textContent||'';
  const id=txt.match(/ID\s+([^\s·]+)/i)?.[1]||'';
  return list.find(g=>String(g.id)===String(id))||list.find(g=>g.name&&txt.toLowerCase().includes(String(g.name).toLowerCase()));
}

function finalizeDivergence(g,snap){
  if(!g.liveDivergence)return;
  const d=g.liveDivergence;
  if(!d.id&&!d.name&&!d.value)g.liveDivergence=null;
  else g.liveDivergence={...d,at:Date.now()};
  write(CAT_KEY,snap);
  syncVerifiedCloud(g);
  window.dispatchEvent(new CustomEvent('caos-catalog-updated',{
    detail:{id:String(g.id),verified:true,divergence:!!g.liveDivergence,corrected:true}
  }));
  decorateVerifiedCatalog();
}

function correctName(id){
  const snap=catSnap();
  if(!snap||!Array.isArray(snap.gifts))return;
  const g=snap.gifts.find(x=>String(x.id)===String(id));
  const diff=g?.liveDivergence?.name;
  if(!g||!diff)return;
  g.liveNamePrevious=g.name;
  g.name=diff.live||g.liveVerifiedName||g.name;
  g.liveVerifiedName=g.name;
  g.liveNameAutoCorrectedAt=Date.now();
  g.liveDivergence.name=null;
  finalizeDivergence(g,snap);
  status(`✅ ${g.name} · NOME CORRIGIDO · ${g.liveDivergence?'AINDA HÁ DIVERGÊNCIA':'VERIFICADO AO VIVO'}`,!g.liveDivergence);
}

function correctValue(id){
  const snap=catSnap();
  if(!snap||!Array.isArray(snap.gifts))return;
  const g=snap.gifts.find(x=>String(x.id)===String(id));
  const diff=g?.liveDivergence?.value;
  if(!g||!diff)return;
  const liveValue=Number(diff.live);
  if(!Number.isFinite(liveValue)||liveValue<0)return alert('Valor recebido da Live é inválido.');
  if(!confirm(`Corrigir ${g.name} de ${diff.catalog} 💎 para ${liveValue} 💎?`))return;
  g.diamondCount=liveValue;
  g.liveVerifiedValue=liveValue;
  g.liveDivergence.value=null;
  finalizeDivergence(g,snap);
  status(`✅ ${g.name} · VALOR CORRIGIDO PARA ${liveValue} 💎 · ${g.liveDivergence?'AINDA HÁ DIVERGÊNCIA':'VERIFICADO AO VIVO'}`,!g.liveDivergence);
}

async function correctId(id){
  const snap=catSnap();
  if(!snap||!Array.isArray(snap.gifts))return;
  const g=snap.gifts.find(x=>String(x.id)===String(id));
  const diff=g?.liveDivergence?.id;
  if(!g||!diff)return;
  const oldId=String(g.id);
  const liveId=String(diff.live||'').trim();
  if(!liveId)return alert('ID recebido da Live é inválido.');
  const collision=snap.gifts.find(x=>x!==g&&String(x.id)===liveId);
  if(collision)return alert(`Não foi possível corrigir: o ID ${liveId} já pertence a ${collision.name||'outro presente'}.`);
  if(!confirm(`ATENÇÃO: trocar o ID de ${g.name}\n${oldId} → ${liveId}\n\nConfirma após conferir no painel de doação?`))return;
  g.id=liveId;
  g.liveVerifiedId=liveId;
  g.liveDivergence.id=null;
  finalizeDivergence(g,snap);
  await syncVerifiedCloud(g);
  if(oldId!==liveId)removeVerifiedCloud(oldId);
  status(`✅ ${g.name} · ID CORRIGIDO PARA ${liveId} · ${g.liveDivergence?'AINDA HÁ DIVERGÊNCIA':'VERIFICADO AO VIVO'}`,!g.liveDivergence);
}

function divergenceMatches(g,filter){
  const d=g.liveDivergence;
  if(!d)return false;
  const types=divergenceTypes(d);
  if(filter==='all')return true;
  if(filter==='multi')return types.length>1;
  return !!d[filter];
}

function divergenceCard(g){
  const d=g.liveDivergence||{};
  const types=divergenceTypes(d);
  const rows=[];
  if(d.name)rows.push(`<div><b>NOME</b> · catálogo: <span>${esc(d.name.catalog)}</span> → Live: <strong>${esc(d.name.live)}</strong></div>`);
  if(d.value)rows.push(`<div><b>VALOR</b> · catálogo: <span>${esc(d.value.catalog)} 💎</span> → Live: <strong>${esc(d.value.live)} 💎</strong></div>`);
  if(d.id)rows.push(`<div><b>ID</b> · catálogo: <span>${esc(d.id.catalog)}</span> → Live: <strong>${esc(d.id.live)}</strong></div>`);
  const actions=[];
  if(d.name)actions.push(`<button class="miniBtn" data-fix-name="${esc(g.id)}">CORRIGIR NOME</button>`);
  if(d.value)actions.push(`<button class="miniBtn" data-fix-value="${esc(g.id)}">CORRIGIR VALOR</button>`);
  if(d.id)actions.push(`<button class="miniBtn danger" data-fix-id="${esc(g.id)}">CORRIGIR ID</button>`);
  return `<div class="giftCatalogRow giftCatalogRowV2 caosDivergenceRow" style="display:block;padding:10px;margin:8px 0"><div class="giftMain"><b>${esc(g.name||'Presente')}</b><span>ID atual ${esc(g.id)} · ${esc(g.diamondCount||0)} 💎 · verificado ${g.liveVerifiedCount||1}×</span><div style="font-size:10px;line-height:1.55;margin-top:7px;color:#fbbf24">${rows.join('')}</div><div class="giftRowActions" style="margin-top:8px">${actions.join('')}</div><small style="display:block;margin-top:6px;opacity:.72">${types.length>1?'⚠️ MÚLTIPLAS DIVERGÊNCIAS':'⚠️ DIVERGÊNCIA DE '+types[0].toUpperCase()}</small></div></div>`;
}

function renderDivergencePanel(){
  const box=$('giftCatalogList');
  if(!box)return;
  let panel=$('giftDivergencePanel');
  if(!panel){
    panel=document.createElement('section');
    panel.id='giftDivergencePanel';
    panel.style.cssText='margin:10px 0 14px;padding:10px;border:1px solid rgba(251,191,36,.24);border-radius:12px;background:rgba(251,191,36,.035)';
    box.insertAdjacentElement('beforebegin',panel);
  }

  const list=catalog().filter(g=>g.liveVerified&&g.liveDivergence);
  const counts={
    all:list.length,
    name:list.filter(g=>g.liveDivergence?.name).length,
    value:list.filter(g=>g.liveDivergence?.value).length,
    id:list.filter(g=>g.liveDivergence?.id).length,
    multi:list.filter(g=>divergenceTypes(g.liveDivergence).length>1).length
  };
  const filtered=list.filter(g=>divergenceMatches(g,divergenceFilter));
  const button=(k,label)=>`<button class="miniBtn${divergenceFilter===k?' active':''}" data-div-filter="${k}">${label} (${counts[k]})</button>`;

  panel.innerHTML=`<div class="caosQuickHead" style="margin-bottom:8px"><div><span class="eyebrow">VALIDAÇÃO AO VIVO</span><h3 style="margin:2px 0">Divergências</h3></div><span class="miniStatus">${counts.all} pendentes</span></div><div class="v2CatalogActions" style="display:flex;gap:6px;flex-wrap:wrap">${button('all','TODAS')}${button('name','NOME')}${button('value','VALOR')}${button('id','ID')}${button('multi','MÚLTIPLAS')}</div><p class="hint" style="margin:8px 0">Nome novo passa a ser corrigido automaticamente nas próximas verificações. ID e valor continuam manuais para segurança.</p><div id="giftDivergenceList">${filtered.map(divergenceCard).join('')||'<div class="hint">Nenhuma divergência neste filtro.</div>'}</div>`;

  panel.querySelectorAll('[data-div-filter]').forEach(b=>b.onclick=()=>{
    divergenceFilter=b.dataset.divFilter||'all';
    renderDivergencePanel();
  });
  panel.querySelectorAll('[data-fix-name]').forEach(b=>b.onclick=()=>correctName(b.dataset.fixName));
  panel.querySelectorAll('[data-fix-value]').forEach(b=>b.onclick=()=>correctValue(b.dataset.fixValue));
  panel.querySelectorAll('[data-fix-id]').forEach(b=>b.onclick=()=>correctId(b.dataset.fixId));
}

function decorateVerifiedCatalog(){
  const box=$('giftCatalogList');
  if(!box)return;
  const list=catalog();
  const verified=list.filter(g=>g.liveVerified&&!g.liveDivergence);
  let btn=$('giftVerifiedFilter');
  if(!btn){
    btn=document.createElement('button');
    btn.id='giftVerifiedFilter';
    btn.type='button';
    btn.className='miniBtn';
    btn.style.margin='8px 0';
    btn.onclick=()=>{
      verifiedOnly=!verifiedOnly;
      decorateVerifiedCatalog();
    };
    box.insertAdjacentElement('beforebegin',btn);
  }
  const btnText=`✅ VERIFICADOS (${verified.length})${verifiedOnly?' · ATIVO':''}`;
  if(btn.textContent!==btnText)btn.textContent=btnText;
  btn.classList.toggle('active',verifiedOnly);

  box.querySelectorAll('.giftCatalogRowV2,.giftCatalogRow').forEach(row=>{
    if(row.closest('#giftDivergencePanel'))return;
    const g=rowGift(row,list);
    if(!g)return;
    const nextDisplay=verifiedOnly&&(!g.liveVerified||g.liveDivergence)?'none':'';
    if(row.style.display!==nextDisplay)row.style.display=nextDisplay;
    let badge=row.querySelector('.caosVerifiedBadge');
    if(g.liveVerified){
      if(!badge){
        badge=document.createElement('div');
        badge.className='caosVerifiedBadge';
        badge.style.cssText='font-size:8px;font-weight:900;color:#86efac;margin-top:6px';
        (row.querySelector('.giftMain')||row).appendChild(badge);
      }
      const when=g.lastLiveVerifiedAt?new Date(g.lastLiveVerifiedAt).toLocaleString('pt-BR'):'';
      const badgeText=g.liveDivergence
        ?`⚠️ VERIFICADO COM DIVERGÊNCIA · ${divergenceSummary(g.liveDivergence)}`
        :`✅ VERIFICADO AO VIVO · ${g.liveVerifiedCount||1}×${when?' · '+when:''}`;
      if(badge.textContent!==badgeText)badge.textContent=badgeText;
      badge.style.color=g.liveDivergence?'#fbbf24':'#86efac';
    }else if(badge){
      badge.remove();
    }
  });

  renderDivergencePanel();
}

function editAnyRule(rule){
  const set=(id,v)=>{const e=$(id);if(e)e.value=v??''};
  set('v2Trigger',rule.trigger||'like');
  $('v2Trigger')?.dispatchEvent(new Event('change',{bubbles:true}));
  if(rule.giftId!=null)set('v2Gift',rule.giftId);
  set('v2Threshold',rule.threshold??rule.count??1);
  set('v2Action',rule.action||'spawn');
  $('v2Action')?.dispatchEvent(new Event('change',{bubbles:true}));
  set('v2Mob',rule.mob||'wraith');
  $('v2Mob')?.dispatchEvent(new Event('change',{bubbles:true}));
  set('v2Value',rule.value??1);
  set('v2Cooldown',rule.cooldown??0);
  $('v2Gift')?.dispatchEvent(new Event('change',{bubbles:true}));
  ($('v2BuilderTitle')||$('caosLiveV2'))?.scrollIntoView({behavior:'smooth',block:'start'});
}

function ensureUniversalRuleEdit(){
  const root=$('v2Rules')||$('liveV2Rules')||document.querySelector('#caosLiveV2 .v2Rules');
  if(!root)return;
  const list=rules();
  [...root.querySelectorAll('.v2Rule')].forEach((card,index)=>{
    const rule=list[index];
    if(!rule)return;
    const actions=card.querySelector('.v2RuleActions')||card;
    if(actions.querySelector('.v2EditRule,[data-caos-edit-rule]'))return;
    const b=document.createElement('button');
    b.type='button';
    b.textContent='EDITAR';
    b.className='v2EditRule';
    b.dataset.caosEditRule='1';
    b.onclick=()=>editAnyRule(rule);
    actions.insertBefore(b,actions.firstChild);
  });
}

function installManagementObserver(){
  const root=$('caosLiveV2');
  if(!root||root.dataset.giftManagementObserver)return;
  root.dataset.giftManagementObserver='1';
  let queued=false;
  new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      decorateVerifiedCatalog();
      ensureUniversalRuleEdit();
    });
  }).observe(root,{childList:true,subtree:true});
  window.addEventListener('caos-catalog-updated',decorateVerifiedCatalog);
  decorateVerifiedCatalog();
  ensureUniversalRuleEdit();
  initCloud();
}

function install(){
  if($('giftObserverCard')){
    installManagementObserver();
    return true;
  }
  const v2=$('caosLiveV2');
  if(!v2)return false;
  document.querySelector('.automationsCard')?.style.setProperty('display','none');
  const card=document.createElement('section');
  card.id='giftObserverCard';
  card.className='caosQuickCard liveV2Card';
  card.dataset.adminArea='live';
  card.innerHTML=`<div class="caosQuickHead"><div><span class="eyebrow">OBSERVAÇÃO</span><h2>Descobertas de presentes</h2></div><span id="giftObserverStatus" class="miniStatus">OBSERVADOR OFF</span></div><p class="hint">Presentes que já existem no catálogo NÃO aparecem aqui: eles recebem selo de verificação no catálogo principal. Esta lista mostra somente IDs novos.</p><div class="row"><input id="giftObserverUser" class="v2Input" placeholder="@usuario da Live para observar"><button id="giftObserverStart" class="primaryBtn">INICIAR OBSERVAÇÃO</button></div><div class="v2CatalogActions" style="margin-top:10px"><button id="giftObserverSeenTab" class="miniBtn active">🆕 NOVOS</button><button id="giftObserverSavedTab" class="miniBtn">⭐ SALVOS</button><button id="giftObserverClear" class="miniBtn danger">LIMPAR NOVOS</button></div><div class="v2CatalogActions" style="margin-top:10px"><input id="privateGiftSearch" class="v2Input" placeholder="Buscar nesta lista"><span id="privateGiftMeta" class="miniStatus">0 NOVOS fora do catálogo</span></div><div id="privateGiftList" class="giftCatalogList"></div>`;
  v2.insertAdjacentElement('afterend',card);
  $('giftObserverStart').onclick=()=>active?stop():start();
  $('privateGiftSearch').oninput=render;
  $('giftObserverSeenTab').onclick=()=>{
    $('giftObserverSeenTab').classList.add('active');
    $('giftObserverSavedTab').classList.remove('active');
    render();
  };
  $('giftObserverSavedTab').onclick=()=>{
    $('giftObserverSavedTab').classList.add('active');
    $('giftObserverSeenTab').classList.remove('active');
    render();
  };
  $('giftObserverClear').onclick=clearObserved;
  render();
  installManagementObserver();
  return true;
}

let n=0;
const t=setInterval(()=>{if(install()||++n>40)clearInterval(t)},250);

})();