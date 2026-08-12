from pathlib import Path
import json,re

VERSION='0.17.33'; TAG='01733'
def rw(p): return Path(p).read_text()
def ww(p,s): Path(p).write_text(s)

# ---------- HTML: Firebase SDK + global rank label ----------
for f in ['index.html','duo.html']:
    s=rw(f).replace('0.17.32',VERSION).replace('01732',TAG)
    anchor='<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>'
    assert anchor in s
    firebase='''<script src="https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js"></script><script src="https://www.gstatic.com/firebasejs/12.16.0/firebase-auth-compat.js"></script><script src="https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore-compat.js"></script><script src="src/firebase-ranking.js?v=01733"></script>'''
    if 'firebase-ranking.js' not in s:
        s=s.replace(anchor,anchor+firebase,1)
    if f=='index.html':
        s=s.replace('<p>Histórico salvo neste dispositivo.</p>','<p id="rankStatus">Ranking global · conectando ao Firebase...</p>',1)
    ww(f,s)

# ---------- GAME ----------
g=rw('src/game.js').replace("const VERSION='0.17.32'","const VERSION='0.17.33'",1)
old="let playerNames={p1:'P1',p2:'P2'},totalXpP1=0,totalXpP2=0,matchSaved=false;const RANK_KEY='caos-rank-v1';"
new="let playerNames={p1:'P1',p2:'P2'},totalXpP1=0,totalXpP2=0,matchSaved=false,duoAuthUid='',rankMode='solo';const RANK_KEY='caos-rank-v1';"
assert old in g
g=g.replace(old,new,1)

# Reset old P2 identity when starting a new solo run.
old="try{localStorage.setItem('caos-player-name',playerNames.p1)}catch{};totalXpP1=0;"
new="try{localStorage.setItem('caos-player-name',playerNames.p1)}catch{};if(!duoPlayer.connected){playerNames.p2='P2';duoAuthUid=''}totalXpP1=0;"
assert old in g
g=g.replace(old,new,1)

# Capture the anonymous Firebase UID sent by P2.
old="if(d?.type==='duo-hello'){playerNames.p2=cleanPlayerName(d.name,'P2');if(duoConn&&duoConn!==c&&duoConn.open)"
new="if(d?.type==='duo-hello'){playerNames.p2=cleanPlayerName(d.name,'P2');duoAuthUid=String(d.uid||'').slice(0,128);if(duoConn&&duoConn!==c&&duoConn.open)"
assert old in g
g=g.replace(old,new,1)

# Replace local-only save/render with local fallback + Firestore global ranking.
start=g.index('function saveMatchHistory(){')
end=g.index("function openRank(mode='solo'){",start)
replacement=r'''async function saveMatchHistory(){if(matchSaved||!runStartedAt)return;matchSaved=true;const d=rankData(),duration=matchDurationMs(),p1Kills=Math.max(0,killCount-duoKillCount),isDuo=duoPlayer.connected||playerNames.p2!=='P2',base={date:Date.now(),duration,level,score};if(isDuo){d.duo.unshift({...base,totalKills:killCount,players:[{name:playerNames.p1,kills:p1Kills,xp:Math.round(totalXpP1),level},{name:playerNames.p2,kills:duoKillCount,xp:Math.round(totalXpP2),level:duoLevel}]});d.duo=d.duo.slice(0,40)}else{d.solo.unshift({...base,name:playerNames.p1,kills:p1Kills,xp:Math.round(totalXpP1)});d.solo=d.solo.slice(0,40)}saveRankData(d);const cloud=window.CaosRank;if(!cloud)return;const matchId='caos-'+String(room||'room')+'-'+Math.floor(runStartedAt)+'-'+(isDuo?'duo':'solo');try{if(isDuo)await cloud.saveDuo({p2Uid:duoAuthUid,p1Name:playerNames.p1,p2Name:playerNames.p2,p1Kills,p2Kills:duoKillCount,p1Xp:Math.round(totalXpP1),p2Xp:Math.round(totalXpP2),p1Level:level,p2Level:duoLevel,points:score,durationMs:Math.round(duration),version:VERSION},matchId);else await cloud.saveSolo({name:playerNames.p1,kills:p1Kills,xp:Math.round(totalXpP1),level,points:score,durationMs:Math.round(duration),version:VERSION},matchId);toast('🏆 PARTIDA SALVA NO RANK GLOBAL')}catch(e){console.warn('RANK GLOBAL SAVE',e);toast('🏆 RANK ONLINE INDISPONÍVEL · SALVO LOCAL')}}
function rankEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function localRank(mode){const d=rankData();return[...(d[mode]||[])].sort((a,b)=>(b.score||0)-(a.score||0)||(b.totalKills||b.kills||0)-(a.totalKills||a.kills||0)||(b.duration||0)-(a.duration||0)).slice(0,20)}
function paintRankRows(mode,arr,globalMode){const list=$('rankList');if(!list)return;list.innerHTML='';if(!arr.length){list.innerHTML='<div style="padding:18px;text-align:center;color:#8891ad">Nenhuma partida salva ainda.</div>';return}arr.slice(0,20).forEach((r,i)=>{const el=document.createElement('div');el.style.cssText='padding:11px 12px;border:1px solid #2d3155;border-radius:12px;background:#090c18';if(mode==='solo'){const name=rankEsc(r.name),kills=r.kills||0,xpv=r.xp||0,lv=r.level||1,tm=fmtRunTime(globalMode?(r.durationMs||0):(r.duration||0)),pts=r.points??r.score??0;el.innerHTML='<b style="color:#c4b5fd">#'+(i+1)+' '+name+'</b><div style="margin-top:5px;font-size:11px;color:#aab1ca">'+kills+' abates · '+xpv+' XP · LV '+lv+' · '+tm+' · '+pts+' pts</div>'}else if(globalMode){const p1=rankEsc(r.p1Name||'P1'),p2=rankEsc(r.p2Name||'P2'),tm=fmtRunTime(r.durationMs||0);el.innerHTML='<b style="color:#67e8f9">#'+(i+1)+' '+p1+' + '+p2+'</b><div style="margin-top:5px;font-size:11px;color:#aab1ca">'+(r.totalKills||0)+' abates totais · '+(r.totalXp||0)+' XP total · '+tm+' · '+(r.points||0)+' pts</div><div style="font-size:10px;color:#8993ad;margin-top:3px">'+p1+': '+(r.p1Kills||0)+' kills · '+(r.p1Xp||0)+' XP · LV '+(r.p1Level||1)+'</div><div style="font-size:10px;color:#8993ad;margin-top:3px">'+p2+': '+(r.p2Kills||0)+' kills · '+(r.p2Xp||0)+' XP · LV '+(r.p2Level||1)+'</div>'}else{const ps=r.players||[],tm=fmtRunTime(r.duration||0);el.innerHTML='<b style="color:#67e8f9">#'+(i+1)+' '+ps.map(x=>rankEsc(x.name)).join(' + ')+'</b><div style="margin-top:5px;font-size:11px;color:#aab1ca">'+(r.totalKills||0)+' abates totais · LV '+(r.level||1)+' · '+tm+' · '+(r.score||0)+' pts</div>'+ps.map(x=>'<div style="font-size:10px;color:#8993ad;margin-top:3px">'+rankEsc(x.name)+': '+(x.kills||0)+' kills · '+(x.xp||0)+' XP'+(x.level?' · LV '+x.level:'')+'</div>').join('')}list.appendChild(el)})}
async function renderRank(mode='solo'){rankMode=mode;const list=$('rankList'),status=$('rankStatus');if(!list)return;list.innerHTML='<div style="padding:18px;text-align:center;color:#8891ad">CARREGANDO RANKING GLOBAL...</div>';if(status)status.textContent='Ranking global · conectando ao Firebase...';try{if(!window.CaosRank)throw Error('firebase ranking indisponivel');const arr=await window.CaosRank.load(mode,40);if(status)status.textContent='🌐 Ranking global · todos os jogadores';paintRankRows(mode,arr,true)}catch(e){console.warn('RANK GLOBAL LOAD',e);if(status)status.textContent='⚠️ Offline · mostrando histórico deste dispositivo';paintRankRows(mode,localRank(mode),false)}}
'''
g=g[:start]+replacement+g[end:]
ww('src/game.js',g)

# ---------- DUO CLIENT ----------
p=rw('src/duo.js').replace("const VERSION='0.17.32'","const VERSION='0.17.33'",1).replace('01732','01733')
old="conn.on('open',()=>{setStatus('P2 CONECTADO',true);$('join').classList.add('hide');const nm=String($('duoName')?.value||localStorage.getItem('caos-duo-name')||'P2').trim().slice(0,18)||'P2';try{localStorage.setItem('caos-duo-name',nm)}catch{};conn.send({type:'duo-hello',role:'player2',version:VERSION,name:nm})})"
new="conn.on('open',async()=>{setStatus('P2 CONECTADO',true);$('join').classList.add('hide');const nm=String($('duoName')?.value||localStorage.getItem('caos-duo-name')||'P2').trim().slice(0,18)||'P2';try{localStorage.setItem('caos-duo-name',nm)}catch{};let uid='';try{await window.CaosRank?.ready?.();uid=window.CaosRank?.uid?.()||''}catch{};conn.send({type:'duo-hello',role:'player2',version:VERSION,name:nm,uid})})"
assert old in p
p=p.replace(old,new,1)
ww('src/duo.js',p)

# ---------- Sync panel/map/version ----------
for f in ['painel.html','map-lab.html']:
    s=rw(f).replace('0.17.32',VERSION).replace('01732',TAG);ww(f,s)
for f in ['src/panel.js','src/map-runtime.js','src/map-lab.js']:
    s=rw(f).replace('0.17.32',VERSION).replace('01732',TAG);ww(f,s)
ww('version.json',json.dumps({'version':VERSION,'build':'firebase-global-ranking'},indent=2,ensure_ascii=False)+'\n')

# Add explicit regression contract to the project validator.
check=rw('scripts/check-game.mjs')
addon=r'''
// v0.17.33 · Firebase global ranking
const firebaseRank=read('src/firebase-ranking.js'),duo33=read('src/duo.js');
if(!gameHtml.includes('firebase-ranking.js?v='+cacheTag)) fail('Firebase ranking nao carregado no P1'); else ok('Firebase ranking carregado no P1');
if(!read('duo.html').includes('firebase-ranking.js?v='+cacheTag)) fail('Firebase ranking nao carregado no P2'); else ok('Firebase ranking carregado no P2');
if(!firebaseRank.includes("projectId:'caos-live'")) fail('Firebase project divergente'); else ok('Firebase caos-live configurado');
if(!firebaseRank.includes('signInAnonymously')) fail('Auth anonimo ausente'); else ok('Auth anonimo ativo');
if(!firebaseRank.includes("collection('ranking_solo')")||!firebaseRank.includes("collection('ranking_duo')")) fail('colecoes globais ausentes'); else ok('colecoes global solo/duo');
if(!firebaseRank.includes('FieldValue.serverTimestamp()')) fail('ranking sem timestamp do servidor'); else ok('serverTimestamp no ranking');
if(!game.includes('window.CaosRank.load(mode,40)')) fail('UI ainda nao consulta ranking global'); else ok('UI consulta Firestore');
if(!game.includes('cloud.saveSolo')||!game.includes('cloud.saveDuo')) fail('fim da partida nao salva no Firestore'); else ok('partidas solo/duo gravadas globalmente');
if(!duo33.includes('version:VERSION,name:nm,uid')) fail('P2 nao envia UID anonimo ao Host'); else ok('UID anonimo P2 sincronizado');
'''
if '// v0.17.33 · Firebase global ranking' not in check:
    check += addon
ww('scripts/check-game.mjs',check)
print('v0.17.33 Firebase global ranking patch applied')
