from pathlib import Path
import json

VERSION='0.17.34'; TAG='01734'
def rw(p): return Path(p).read_text()
def ww(p,s): Path(p).write_text(s)

# Firebase ranking: migrate legacy localStorage history to Firestore once per anonymous UID.
f=rw('src/firebase-ranking.js')
f=f.replace("let app=null,auth=null,db=null,currentUser=null,state='boot',initPromise=null;","let app=null,auth=null,db=null,currentUser=null,state='boot',initPromise=null,migrationPromise=null;const LOCAL_RANK_KEY='caos-rank-v1',MIGRATION_KEY_PREFIX='caos-rank-global-migrated-v1:';",1)

old="""async function load(mode='solo',limit=40){
  await init();
  const collection=mode==='duo'?'ranking_duo':'ranking_solo';
  const snap=await db.collection(collection).orderBy('points','desc').limit(Math.max(1,Math.min(50,limit|0||40))).get();
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
"""
new="""async function load(mode='solo',limit=40){
  await init();
  try{await migrateLocalHistory()}catch(e){console.warn('CAOS RANK MIGRATION LOAD',e)}
  const collection=mode==='duo'?'ranking_duo':'ranking_solo';
  const snap=await db.collection(collection).orderBy('points','desc').limit(Math.max(1,Math.min(50,limit|0||40))).get();
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
"""
assert old in f
f=f.replace(old,new,1)

needle="window.CaosRank={ready:init,uid:()=>currentUser?.uid||'',load,saveSolo,saveDuo,status:()=>state};"
assert needle in f
migration=r'''function rankHash(v){let h=2166136261;v=String(v||'');for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
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
      const r=local.solo[i]||{},payload={name:text(r.name,'P1',20),kills:int(r.kills,0,1000000),xp:int(r.xp,0,100000000),level:int(r.level,1,10000),points:int(r.points??r.score,0,1000000000),durationMs:int(r.durationMs??r.duration,0,86400000),version:'legacy-0.17.32'},sig=soloSig(payload);
      if(existingSolo.has(sig)){skipped++;continue}
      const legacyId='legacy-s-'+u.uid.slice(0,10)+'-'+String(Math.max(0,Number(r.date)||0)).slice(0,13)+'-'+i+'-'+rankHash(sig);
      await saveSolo(payload,legacyId);existingSolo.add(sig);migrated++;
    }
    for(let i=0;i<local.duo.length;i++){
      const r=local.duo[i]||{},ps=Array.isArray(r.players)?r.players:[],a=ps[0]||{},b=ps[1]||{};
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
'''
f=f.replace(needle,migration+"window.CaosRank={ready:init,uid:()=>currentUser?.uid||'',load,saveSolo,saveDuo,migrateLocalHistory,status:()=>state};",1)
f=f.replace("init().catch(()=>{});","init().then(()=>migrateLocalHistory()).catch(()=>{});",1)
ww('src/firebase-ranking.js',f)

# Sync all visible/runtime versions.
for p in ['index.html','duo.html','painel.html','map-lab.html']:
    s=rw(p).replace('0.17.33',VERSION).replace('01733',TAG);ww(p,s)
for p in ['src/game.js','src/duo.js','src/panel.js','src/map-runtime.js','src/map-lab.js']:
    s=rw(p).replace('0.17.33',VERSION).replace('01733',TAG);ww(p,s)
ww('version.json',json.dumps({'version':VERSION,'build':'firebase-migrate-legacy-ranking'},indent=2,ensure_ascii=False)+'\n')

check=rw('scripts/check-game.mjs')
addon=r'''
// v0.17.34 · migrate legacy local ranking to Firebase
const firebaseRank34=read('src/firebase-ranking.js');
if(!firebaseRank34.includes("LOCAL_RANK_KEY='caos-rank-v1'")) fail('migracao nao le historico local antigo'); else ok('historico local antigo detectado');
if(!firebaseRank34.includes('async function migrateLocalHistory()')) fail('migracao de ranking ausente'); else ok('migracao automatica presente');
if(!firebaseRank34.includes("where('uid','==',u.uid)")) fail('deduplicacao solo ausente'); else ok('deduplicacao solo por UID');
if(!firebaseRank34.includes("where('hostUid','==',u.uid)")) fail('deduplicacao duo ausente'); else ok('deduplicacao duo por Host UID');
if(!firebaseRank34.includes("version:'legacy-0.17.32'")) fail('historico legado sem identificacao'); else ok('historico legado identificado');
if(!firebaseRank34.includes('init().then(()=>migrateLocalHistory())')) fail('migracao nao inicia automaticamente'); else ok('migracao inicia ao abrir o jogo');
'''
if '// v0.17.34 · migrate legacy local ranking to Firebase' not in check: check+=addon
ww('scripts/check-game.mjs',check)
print('v0.17.34 legacy rank migration patch applied')
