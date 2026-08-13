from pathlib import Path
import json

VERSION='0.17.35'; TAG='01735'
def rw(p): return Path(p).read_text()
def ww(p,s): Path(p).write_text(s)

# ---------- HTML / visible guard ----------
s=rw('index.html').replace('0.17.34',VERSION).replace('01734',TAG)
needle='<div class="fpsHud" id="fpsHud">FPS --</div>'
assert needle in s
if 'id="rankIntegrity"' not in s:
    s=s.replace(needle,needle+'<div id="rankIntegrity" style="margin-top:4px;font-size:9px;font-weight:950;color:#86efac;letter-spacing:.04em">🏆 RANQUEADA</div>',1)
ww('index.html',s)

s=rw('duo.html').replace('0.17.34',VERSION).replace('01734',TAG)
needle='<span class="badge fps" id="fpsHud">FPS --</span>'
assert needle in s
if 'id="rankIntegrityDuo"' not in s:
    s=s.replace(needle,needle+'<span class="badge" id="rankIntegrityDuo" style="border-color:#166534;color:#86efac">🏆 RANQUEADA</span>',1)
ww('duo.html',s)

s=rw('painel.html').replace('0.17.34',VERSION).replace('01734',TAG)
needle='<span class="miniStatus">ATUALIZAÇÃO 500 MS</span>'
assert needle in s
if 'id="rankGuard"' not in s:
    s=s.replace(needle,needle+'<span id="rankGuard" class="miniStatus" style="color:#86efac">🏆 RANQUEADA</span>',1)
ww('painel.html',s)

s=rw('map-lab.html').replace('0.17.34',VERSION).replace('01734',TAG)
ww('map-lab.html',s)

# ---------- GAME ----------
g=rw('src/game.js').replace("const VERSION='0.17.34'","const VERSION='0.17.35'",1).replace('01734','01735')
old="let playerNames={p1:'P1',p2:'P2'},totalXpP1=0,totalXpP2=0,matchSaved=false,duoAuthUid='',rankMode='solo';const RANK_KEY='caos-rank-v1';"
new="let playerNames={p1:'P1',p2:'P2'},totalXpP1=0,totalXpP2=0,matchSaved=false,duoAuthUid='',rankMode='solo',rankEligible=true,rankInvalidReason='',adminSessionDirty=false;const RANK_KEY='caos-rank-v1',RANK_SAFE_ADMIN_COMMANDS=new Set(['ping','fps']);"
assert old in g
g=g.replace(old,new,1)

needle="function cleanPlayerName(v,fallback='PLAYER')"
assert needle in g
helpers="""function updateRankIntegrity(){const el=$('rankIntegrity');if(el){el.textContent=rankEligible?'🏆 RANQUEADA':'🛠️ ADM ATIVO · RANK OFF';el.style.color=rankEligible?'#86efac':'#fca5a5';el.title=rankEligible?'Partida válida para o ranking global':(rankInvalidReason||'Intervenção administrativa detectada')}}\nfunction adminCommandIsLive(d){const u=String(d?.user||'').replace(/^@/,'').trim().toUpperCase();return !!u&&u!=='TESTE'}\nfunction invalidateRankByAdmin(command){adminSessionDirty=true;if(!rankEligible&&rankInvalidReason)return;rankEligible=false;rankInvalidReason='Intervenção ADM: '+String(command||'comando');updateRankIntegrity();if(running)toast('🛠️ ADM USADO · PARTIDA FORA DO RANK');try{broadcast()}catch{}}\n"""
g=g.replace(needle,helpers+needle,1)

# A page session touched by gameplay admin commands remains unranked after restart.
old="totalXpP1=0;totalXpP2=0;matchSaved=false;cancelAnimationFrame(raf);"
new="totalXpP1=0;totalXpP2=0;matchSaved=false;rankEligible=!adminSessionDirty;rankInvalidReason=adminSessionDirty?'Intervenção ADM nesta sessão':'';updateRankIntegrity();cancelAnimationFrame(raf);"
assert old in g
g=g.replace(old,new,1)

# Save locally for history, but never send admin-assisted runs to Firebase.
old="isDuo=duoPlayer.connected||playerNames.p2!=='P2',base={date:Date.now(),duration,level,score};"
new="isDuo=duoPlayer.connected||playerNames.p2!=='P2',base={date:Date.now(),duration,level,score,ranked:rankEligible,rankInvalidReason};"
assert old in g
g=g.replace(old,new,1)
old="saveRankData(d);const cloud=window.CaosRank;if(!cloud)return;"
new="saveRankData(d);if(!rankEligible){toast('🛠️ PARTIDA ASSISTIDA PELO ADM · NÃO RANQUEADA');return}const cloud=window.CaosRank;if(!cloud)return;"
assert old in g
g=g.replace(old,new,1)

# Manual/admin commands invalidate ranking. TikTok viewer events are legitimate game mechanics.
old="function command(d){try{window.dispatchEvent(new CustomEvent('caos:admin-command',{detail:d}))}catch{}const c=d?.command;"
new="function command(d){try{window.dispatchEvent(new CustomEvent('caos:admin-command',{detail:d}))}catch{}const c=d?.command;if(c&&!adminCommandIsLive(d)&&!RANK_SAFE_ADMIN_COMMANDS.has(c))invalidateRankByAdmin(c);"
assert old in g
g=g.replace(old,new,1)

# Telemetry for panel.
old="skillLv:{...skillLv},players:{p1:{name:playerNames.p1"
new="skillLv:{...skillLv},ranked:rankEligible,rankInvalidReason,adminSessionDirty,players:{p1:{name:playerNames.p1"
assert old in g
g=g.replace(old,new,1)

# Duo snapshot shows the same rank integrity state.
old="revive:{radius:REVIVE_RADIUS,ms:REVIVE_MS,p1:reviveP1Ms,p2:reviveP2Ms},enemies:near"
new="revive:{radius:REVIVE_RADIUS,ms:REVIVE_MS,p1:reviveP1Ms,p2:reviveP2Ms},rank:{eligible:rankEligible,reason:rankInvalidReason},enemies:near"
assert old in g
g=g.replace(old,new,1)
ww('src/game.js',g)

# ---------- DUO ----------
d=rw('src/duo.js').replace("const VERSION='0.17.34'","const VERSION='0.17.35'",1).replace('01734','01735')
needle="function onData(d){if(!d||d.type!=='duo-snapshot')return;"
assert needle in d
replacement="function onData(d){if(!d||d.type!=='duo-snapshot')return;const rg=$('rankIntegrityDuo');if(rg){const ok=d.rank?.eligible!==false;rg.textContent=ok?'🏆 RANQUEADA':'🛠️ ADM · RANK OFF';rg.style.color=ok?'#86efac':'#fca5a5';rg.style.borderColor=ok?'#166534':'#7f1d1d';rg.title=d.rank?.reason||'';}"
d=d.replace(needle,replacement,1)
ww('src/duo.js',d)

# ---------- PANEL ----------
p=rw('src/panel.js').replace('0.17.34','0.17.35').replace('01734','01735')
needle="$('gameState').textContent=d.paused?'PAUSADO':d.running?'RODANDO':'PARADO';$('autoState').textContent=d.autoMode?'ON':'OFF';"
assert needle in p
replacement=needle+"if($('rankGuard')){const ok=d.ranked!==false;$('rankGuard').textContent=ok?'🏆 RANQUEADA':'🛠️ NÃO RANQUEADA';$('rankGuard').style.color=ok?'#86efac':'#fca5a5';$('rankGuard').title=d.rankInvalidReason||'';}"
p=p.replace(needle,replacement,1)
ww('src/panel.js',p)

# ---------- Firebase migration safety ----------
f=rw('src/firebase-ranking.js')
old="for(let i=0;i<local.solo.length;i++){\n      const r=local.solo[i]||{},payload="
new="for(let i=0;i<local.solo.length;i++){\n      const r=local.solo[i]||{};if(r.ranked===false){skipped++;continue}const payload="
assert old in f
f=f.replace(old,new,1)
old="for(let i=0;i<local.duo.length;i++){\n      const r=local.duo[i]||{},ps="
new="for(let i=0;i<local.duo.length;i++){\n      const r=local.duo[i]||{};if(r.ranked===false){skipped++;continue}const ps="
assert old in f
f=f.replace(old,new,1)
ww('src/firebase-ranking.js',f)

# ---------- remaining synchronized runtime/version files ----------
for pth in ['src/map-runtime.js','src/map-lab.js']:
    x=rw(pth).replace('0.17.34','0.17.35').replace('01734','01735');ww(pth,x)
ww('version.json',json.dumps({'version':VERSION,'build':'ranked-admin-integrity-guard'},indent=2,ensure_ascii=False)+'\n')

# ---------- regression contract ----------
check=rw('scripts/check-game.mjs')
addon=r'''
// v0.17.35 · ranked integrity guard against manual admin assistance
const duo35=read('src/duo.js'),firebase35=read('src/firebase-ranking.js');
if(!gameHtml.includes('id="rankIntegrity"')) fail('HUD sem selo de integridade do rank'); else ok('HUD mostra RANQUEADA/RANK OFF');
if(!read('duo.html').includes('id="rankIntegrityDuo"')) fail('Duo sem selo de rank'); else ok('Duo mostra integridade do rank');
if(!panelHtml.includes('id="rankGuard"')) fail('Painel sem estado do rank'); else ok('Painel mostra integridade do rank');
if(!game.includes("RANK_SAFE_ADMIN_COMMANDS=new Set(['ping','fps'])")) fail('allowlist segura ADM ausente'); else ok('ping/FPS nao invalidam rank');
if(!game.includes('adminCommandIsLive(d)')) fail('eventos legitimos da live nao separados'); else ok('TikTok separado de ADM manual');
if(!game.includes('invalidateRankByAdmin(c)')) fail('comando ADM nao invalida rank'); else ok('ADM manual invalida rank');
if(!game.includes("rankEligible=!adminSessionDirty")) fail('restart pode limpar fraude ADM'); else ok('rank continua OFF ate reload');
if(!game.includes("if(!rankEligible){toast('🛠️ PARTIDA ASSISTIDA PELO ADM · NÃO RANQUEADA');return}")) fail('partida assistida ainda pode ir ao Firebase'); else ok('partida assistida bloqueada no rank global');
if(!game.includes('ranked:rankEligible,rankInvalidReason')) fail('historico local nao marca run assistida'); else ok('historico local marca integridade');
if(!game.includes('rank:{eligible:rankEligible,reason:rankInvalidReason}')) fail('P2 nao recebe estado do rank'); else ok('P2 recebe estado do rank');
if(!game.includes('ranked:rankEligible,rankInvalidReason,adminSessionDirty')) fail('painel nao recebe estado do rank'); else ok('painel recebe estado do rank');
if(!firebase35.includes('if(r.ranked===false){skipped++;continue}')) fail('migracao pode subir run ADM antiga'); else ok('migracao ignora runs explicitamente nao ranqueadas');
'''
if '// v0.17.35 · ranked integrity guard against manual admin assistance' not in check:
    check += addon
ww('scripts/check-game.mjs',check)
print('v0.17.35 ranked admin integrity guard applied')
