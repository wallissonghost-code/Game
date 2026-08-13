(()=>{'use strict';
const FIREBASE_CONFIG={
  apiKey:'AIzaSyCVJqZKPhmKUwS_YhtyvUfQCfmvTOB2Wlg',
  authDomain:'caos-live.firebaseapp.com',
  projectId:'caos-live',
  storageBucket:'caos-live.firebasestorage.app',
  messagingSenderId:'652480823706',
  appId:'1:652480823706:web:83551a0d8eaebff93eba23',
  measurementId:'G-04377MKMX1'
};
let app=null,auth=null,db=null,currentUser=null,state='boot',initPromise=null,migrationPromise=null;const LOCAL_RANK_KEY='caos-rank-v1',MIGRATION_KEY_PREFIX='caos-rank-global-migrated-v1:';
const int=(v,min,max)=>Math.max(min,Math.min(max,Math.round(Number(v)||0)));
const text=(v,fallback='PLAYER',max=20)=>{v=String(v||'').trim().replace(/[<>]/g,'').slice(0,max);return v||fallback};
const docId=v=>String(v||('match-'+Date.now()+'-'+Math.random().toString(36).slice(2,8))).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,120);
function init(){
  if(initPromise)return initPromise;
  initPromise=(async()=>{
    if(!window.firebase)throw Error('Firebase SDK indisponivel');
    app=window.firebase.apps&&window.firebase.apps.length?window.firebase.app():window.firebase.initializeApp(FIREBASE_CONFIG);
    auth=window.firebase.auth();
    db=window.firebase.firestore();
    try{await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL)}catch{}
    if(auth.currentUser)currentUser=auth.currentUser;
    else currentUser=(await auth.signInAnonymously()).user;
    state='ready';
    try{window.dispatchEvent(new CustomEvent('caos:rank-ready',{detail:{uid:currentUser?.uid||''}}))}catch{}
    return currentUser;
  })().catch(e=>{state='error';console.warn('CAOS FIREBASE RANK',e);throw e});
  return initPromise;
}
async function load(mode='solo',limit=40){
  await init();
  try{await migrateLocalHistory()}catch(e){console.warn('CAOS RANK MIGRATION LOAD',e)}
  const collection=mode==='duo'?'ranking_duo':'ranking_solo';
  const snap=await db.collection(collection).orderBy('points','desc').limit(Math.max(1,Math.min(50,limit|0||40))).get();
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function createOnce(collection,id,data){
  const ref=db.collection(collection).doc(docId(id));
  const existing=await ref.get();
  if(existing.exists)return{ok:true,duplicate:true,id:ref.id};
  await ref.set(data);
  return{ok:true,duplicate:false,id:ref.id};
}
async function saveSolo(v,matchId){
  const u=await init();
  return createOnce('ranking_solo',matchId,{
    uid:u.uid,
    mode:'solo',
    name:text(v.name,'P1',20),
    kills:int(v.kills,0,1000000),
    xp:int(v.xp,0,100000000),
    level:int(v.level,1,10000),
    points:int(v.points,0,1000000000),
    durationMs:int(v.durationMs,0,86400000),
    createdAt:window.firebase.firestore.FieldValue.serverTimestamp(),
    version:text(v.version,'0',20)
  });
}
async function saveDuo(v,matchId){
  const u=await init();
  const p1Kills=int(v.p1Kills,0,1000000),p2Kills=int(v.p2Kills,0,1000000),p1Xp=int(v.p1Xp,0,100000000),p2Xp=int(v.p2Xp,0,100000000);
  return createOnce('ranking_duo',matchId,{
    hostUid:u.uid,
    p2Uid:String(v.p2Uid||'').slice(0,128),
    mode:'duo',
    p1Name:text(v.p1Name,'P1',20),
    p2Name:text(v.p2Name,'P2',20),
    p1Kills,p2Kills,
    p1Xp,p2Xp,
    p1Level:int(v.p1Level,1,10000),
    p2Level:int(v.p2Level,1,10000),
    totalKills:p1Kills+p2Kills,
    totalXp:p1Xp+p2Xp,
    points:int(v.points,0,2000000000),
    durationMs:int(v.durationMs,0,86400000),
    createdAt:window.firebase.firestore.FieldValue.serverTimestamp(),
    version:text(v.version,'0',20)
  });
}
function rankHash(v){let h=2166136261;v=String(v||'');for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function soloSig(v){return[text(v.name,'P1',20),int(v.kills,0,1000000),int(v.xp,0,100000000),int(v.level,1,10000),int(v.points??v.score,0,1000000000),int(v.durationMs??v.duration,0,86400000)].join('|')}
function duoSig(v){return[text(v.p1Name,'P1',20),text(v.p2Name,'P2',20),int(v.p1Kills,0,1000000),int(v.p2Kills,0,1000000),int(v.p1Xp,0,100000000),int(v.p2Xp,0,100000000),int(v.p1Level,1,10000),int(v.p2Level,1,10000),int(v.points??v.score,0,2000000000),int(v.durationMs??v.duration,0,86400000)].join('|')}
async function migrateLocalHistory(){
  if(migrationPromise)return migrationPromise;
  migrationPromise=(async()=>{
    const u=await init(),marker=MIGRATION_KEY_PREFIX+u.uid;
    try{if(localStorage.getItem(marker)==='1')return{migrated:0,skipped:0,done:true}}catch{}
    let local={solo:[],duo:[]};
    try{const parsed=JSON.parse(localStorage.getItem(LOCAL_RANK_KEY)||'{}');local={solo:Array.isArray(parsed.solo)?parsed.solo:[],duo:Array.isArray(parsed.duo)?parsed.duo:[]}}catch{}
    if(!local.solo.length&&!local.duo.length){try{localStorage.setItem(marker,'1')}catch{};return{migrated:0,skipped:0,done:true}}
    const [soloSnap,duoSnap]=await Promise.all([
      db.collection('ranking_solo').where('uid','==',u.uid).get(),
      db.collection('ranking_duo').where('hostUid','==',u.uid).get()
    ]);
    const existingSolo=new Set(soloSnap.docs.map(d=>soloSig(d.data()))),existingDuo=new Set(duoSnap.docs.map(d=>duoSig(d.data())));
    let migrated=0,skipped=0;
    for(let i=0;i<local.solo.length;i++){
      const r=local.solo[i]||{};if(r.ranked===false){skipped++;continue}const payload={name:text(r.name,'P1',20),kills:int(r.kills,0,1000000),xp:int(r.xp,0,100000000),level:int(r.level,1,10000),points:int(r.points??r.score,0,1000000000),durationMs:int(r.durationMs??r.duration,0,86400000),version:'legacy-0.17.32'},sig=soloSig(payload);
      if(existingSolo.has(sig)){skipped++;continue}
      const legacyId='legacy-s-'+u.uid.slice(0,10)+'-'+String(Math.max(0,Number(r.date)||0)).slice(0,13)+'-'+i+'-'+rankHash(sig);
      await saveSolo(payload,legacyId);existingSolo.add(sig);migrated++;
    }
    for(let i=0;i<local.duo.length;i++){
      const r=local.duo[i]||{};if(r.ranked===false){skipped++;continue}const ps=Array.isArray(r.players)?r.players:[],a=ps[0]||{},b=ps[1]||{};
      const payload={p2Uid:'',p1Name:text(a.name||r.p1Name,'P1',20),p2Name:text(b.name||r.p2Name,'P2',20),p1Kills:int(a.kills??r.p1Kills,0,1000000),p2Kills:int(b.kills??r.p2Kills,0,1000000),p1Xp:int(a.xp??r.p1Xp,0,100000000),p2Xp:int(b.xp??r.p2Xp,0,100000000),p1Level:int(a.level??r.p1Level??r.level,1,10000),p2Level:int(b.level??r.p2Level??r.level,1,10000),points:int(r.points??r.score,0,2000000000),durationMs:int(r.durationMs??r.duration,0,86400000),version:'legacy-0.17.32'},sig=duoSig(payload);
      if(existingDuo.has(sig)){skipped++;continue}
      const legacyId='legacy-d-'+u.uid.slice(0,10)+'-'+String(Math.max(0,Number(r.date)||0)).slice(0,13)+'-'+i+'-'+rankHash(sig);
      await saveDuo(payload,legacyId);existingDuo.add(sig);migrated++;
    }
    try{localStorage.setItem(marker,'1')}catch{}
    try{window.dispatchEvent(new CustomEvent('caos:rank-migrated',{detail:{migrated,skipped,total:local.solo.length+local.duo.length}}))}catch{}
    console.log('CAOS RANK LEGACY MIGRATED',{migrated,skipped,total:local.solo.length+local.duo.length});
    return{migrated,skipped,done:true};
  })().catch(e=>{migrationPromise=null;throw e});
  return migrationPromise;
}
window.CaosRank={ready:init,uid:()=>currentUser?.uid||'',load,saveSolo,saveDuo,migrateLocalHistory,status:()=>state};
init().then(()=>migrateLocalHistory()).catch(()=>{});
})();
