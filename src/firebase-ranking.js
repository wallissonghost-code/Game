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
let app=null,auth=null,db=null,currentUser=null,state='boot',initPromise=null;
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
window.CaosRank={ready:init,uid:()=>currentUser?.uid||'',load,saveSolo,saveDuo,status:()=>state};
init().catch(()=>{});
})();
