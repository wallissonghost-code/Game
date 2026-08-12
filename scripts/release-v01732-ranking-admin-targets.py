from pathlib import Path
import json,re

VERSION='0.17.32'; TAG='01732'
def rw(p): return Path(p).read_text()
def ww(p,s): Path(p).write_text(s)

# ---------- HTML GAME ----------
s=rw('index.html').replace('0.17.31','0.17.32').replace('01731','01732')
old='<button class="startBtnPremium" id="startBtn">ENTRAR NA ARENA</button>'
new='''<div style="margin:14px 0 10px"><input id="playerName" maxlength="18" placeholder="SEU NOME" autocomplete="nickname" style="width:100%;padding:13px 14px;border-radius:13px;border:1px solid #343861;background:#080b19;color:#fff;font-weight:900;text-align:center;font-size:15px;outline:none"></div><button class="startBtnPremium" id="startBtn">ENTRAR NA ARENA</button><button id="rankBtn" type="button" style="width:100%;margin-top:9px;padding:11px;border:1px solid #343861;border-radius:13px;background:#0b0e1d;color:#c4b5fd;font-weight:900">🏆 RANK / HISTÓRICO</button>'''
assert old in s
s=s.replace(old,new,1)
rank='''<section id="rankOverlay" class="overlay"><div class="card" style="width:min(680px,94vw);max-height:82vh;overflow:auto"><h1>🏆 RANKING</h1><p>Histórico salvo neste dispositivo.</p><div style="display:flex;gap:8px;margin:12px 0"><button id="rankSoloBtn" class="btn" style="flex:1">SOLITÁRIO</button><button id="rankDuoBtn" class="btn" style="flex:1">DUPLA</button></div><div id="rankList" style="display:grid;gap:8px"></div><button id="rankClose" class="btn" style="margin-top:14px">FECHAR</button></div></section>'''
s=s.replace('</main><script',rank+'</main><script',1)
ww('index.html',s)

# ---------- HTML DUO ----------
s=rw('duo.html').replace('0.17.31','0.17.32').replace('01731','01732')
old='<input id="room" maxlength="8" placeholder="AB7K9P2X" autocomplete="off"><button id="connect">ENTRAR COMO P2</button>'
new='<input id="duoName" maxlength="18" placeholder="SEU NOME" autocomplete="nickname" style="margin-bottom:9px;text-transform:none;letter-spacing:.04em"><input id="room" maxlength="8" placeholder="AB7K9P2X" autocomplete="off"><button id="connect">ENTRAR COMO P2</button>'
assert old in s
s=s.replace(old,new,1)
ww('duo.html',s)

# ---------- PANEL HTML ----------
s=rw('painel.html').replace('0.17.31','0.17.32').replace('01731','01732')
needle='<div class="actionGrid grid">'
assert needle in s
block='''<div class="tools" style="margin:12px 0"><label style="font-size:10px;font-weight:900;color:#9aa8c4">ALVO DOS EFEITOS</label><select id="playerTarget"><option value="p1">P1 · HOST</option><option value="p2">P2 · DUO</option><option value="all">TODOS</option></select><button id="savePlayer" class="good" type="button">🛟 SALVAR / REVIVER JOGADOR</button></div>'''
s=s.replace(needle,block+needle,1)
ww('painel.html',s)

# ---------- GAME JS ----------
g=rw('src/game.js')
g=g.replace("const VERSION='0.17.31'","const VERSION='0.17.32'",1)
# stats vars after revive constants
needle='const REVIVE_RADIUS=68,REVIVE_MS=3000;'
assert needle in g
g=g.replace(needle,needle+"let playerNames={p1:'P1',p2:'P2'},totalXpP1=0,totalXpP2=0,matchSaved=false;const RANK_KEY='caos-rank-v1';",1)

# ranking helpers before skill helpers
needle='function duoSkillCap(id)'
assert needle in g
helpers="""function cleanPlayerName(v,fallback='PLAYER'){v=String(v||'').trim().replace(/[<>]/g,'').slice(0,18);return v||fallback}\nfunction rankData(){try{return JSON.parse(localStorage.getItem(RANK_KEY)||'{\"solo\":[],\"duo\":[]}')}catch{return{solo:[],duo:[]}}}\nfunction saveRankData(d){try{localStorage.setItem(RANK_KEY,JSON.stringify(d))}catch{}}\nfunction matchDurationMs(){return runStartedAt?Math.max(0,performance.now()-runStartedAt):0}\nfunction saveMatchHistory(){if(matchSaved||!runStartedAt)return;matchSaved=true;const d=rankData(),duration=matchDurationMs(),p1Kills=Math.max(0,killCount-duoKillCount),base={date:Date.now(),duration,level,score};if(duoPlayer.connected||playerNames.p2!=='P2'){d.duo.unshift({...base,totalKills:killCount,players:[{name:playerNames.p1,kills:p1Kills,xp:Math.round(totalXpP1)},{name:playerNames.p2,kills:duoKillCount,xp:Math.round(totalXpP2),level:duoLevel}]});d.duo=d.duo.slice(0,40)}else{d.solo.unshift({...base,name:playerNames.p1,kills:p1Kills,xp:Math.round(totalXpP1)});d.solo=d.solo.slice(0,40)}saveRankData(d)}\nfunction renderRank(mode='solo'){const list=$('rankList');if(!list)return;const d=rankData(),arr=[...(d[mode]||[])].sort((a,b)=>(b.score||0)-(a.score||0)||(b.totalKills||b.kills||0)-(a.totalKills||a.kills||0)||(b.duration||0)-(a.duration||0));list.innerHTML='';if(!arr.length){list.innerHTML='<div style=\"padding:18px;text-align:center;color:#8891ad\">Nenhuma partida salva ainda.</div>';return}arr.slice(0,20).forEach((r,i)=>{const el=document.createElement('div');el.style.cssText='padding:11px 12px;border:1px solid #2d3155;border-radius:12px;background:#090c18';const tm=fmtRunTime(r.duration||0);if(mode==='solo')el.innerHTML='<b style=\"color:#c4b5fd\">#'+(i+1)+' '+r.name+'</b><div style=\"margin-top:5px;font-size:11px;color:#aab1ca\">'+r.kills+' abates · '+r.xp+' XP · LV '+r.level+' · '+tm+' · '+r.score+' pts</div>';else{const ps=r.players||[];el.innerHTML='<b style=\"color:#67e8f9\">#'+(i+1)+' '+ps.map(x=>x.name).join(' + ')+'</b><div style=\"margin-top:5px;font-size:11px;color:#aab1ca\">'+(r.totalKills||0)+' abates totais · LV '+r.level+' · '+tm+' · '+r.score+' pts</div>'+ps.map(x=>'<div style=\"font-size:10px;color:#8993ad;margin-top:3px\">'+x.name+': '+x.kills+' kills · '+x.xp+' XP'+(x.level?' · LV '+x.level:'')+'</div>').join('')}list.appendChild(el)})}\nfunction openRank(mode='solo'){$('rankOverlay')?.classList.add('show');renderRank(mode)}\n"""
g=g.replace(needle,helpers+needle,1)

# total xp accounting
g=g.replace('function gainDuoXP(v){duoXp+=Math.max(0,+v||0)*(duoPlayer.xpMult||1);','function gainDuoXP(v){const earned=Math.max(0,+v||0)*(duoPlayer.xpMult||1);totalXpP2+=earned;duoXp+=earned;',1)
g=g.replace('function gainXP(v){xp+=v*player.xpMult;','function gainXP(v){const earned=v*player.xpMult;totalXpP1+=earned;xp+=earned;',1)

# reset names/stats
old='function reset(){if(!playerV2Ready){syncStartButton();return}'
new="function reset(){if(!playerV2Ready){syncStartButton();return}playerNames.p1=cleanPlayerName($('playerName')?.value||localStorage.getItem('caos-player-name'),'P1');try{localStorage.setItem('caos-player-name',playerNames.p1)}catch{};totalXpP1=0;totalXpP2=0;matchSaved=false;"
assert old in g
g=g.replace(old,new,1)

# store match when death screen closes and on beginDeath (only final death actually)
g=g.replace("function beginDeath(e){if(deathState)return;", "function beginDeath(e){if(deathState)return;saveMatchHistory();",1)

# duo hello captures name
old="if(d?.type==='duo-hello'){if(duoConn&&duoConn!==c&&duoConn.open)"
new="if(d?.type==='duo-hello'){playerNames.p2=cleanPlayerName(d.name,'P2');if(duoConn&&duoConn!==c&&duoConn.open)"
assert old in g
g=g.replace(old,new,1)

# snapshot names
old="duo:{level:duoLevel,xp:Math.floor(duoXp),xpNeed:duoXpNeed,skills:{...duoSkillLv},choices:duoPendingSkill}"
new="duo:{level:duoLevel,xp:Math.floor(duoXp),xpNeed:duoXpNeed,skills:{...duoSkillLv},choices:duoPendingSkill,names:{...playerNames}}"
assert old in g
g=g.replace(old,new,1)

# state players telemetry
old="skillLv:{...skillLv},room,ts:Date.now()"
new="skillLv:{...skillLv},players:{p1:{name:playerNames.p1,life:player.life,maxLife:player.maxLife,down:!!player.down,kills:Math.max(0,killCount-duoKillCount),xp:Math.round(totalXpP1)},p2:{name:playerNames.p2,connected:duoPlayer.connected,life:duoPlayer.life,maxLife:duoPlayer.maxLife,down:!!duoPlayer.down,kills:duoKillCount,xp:Math.round(totalXpP2),level:duoLevel}},room,ts:Date.now()"
assert old in g
g=g.replace(old,new,1)

# admin helpers before command
needle='function command(d){'
assert needle in g
admin="""function targetHas(d,id){const t=String(d?.target||'p1');return t==='all'||t===id}\nfunction adminSaveTarget(d){if(targetHas(d,'p1')){if(player.down&&duoPlayer.connected)reviveCoop('p1');else{player.down=false;player.life=player.maxLife;player.inv=2;invincibleUntil=Math.max(invincibleUntil,performance.now()+3000)}}if(targetHas(d,'p2')&&duoPlayer.connected){if(duoPlayer.down)reviveCoop('p2');else{duoPlayer.down=false;duoPlayer.life=duoPlayer.maxLife;duoPlayer.invUntil=performance.now()+3000}}toast('🛟 ADMIN · JOGADOR SALVO')}\n"""
g=g.replace(needle,admin+needle,1)

# Replace player-specific admin commands
patterns=[
("if(c==='heal')player.life=Math.min(player.maxLife,player.life+(+d.amount||1));", "if(c==='heal'){const a=+d.amount||1;if(targetHas(d,'p1'))player.life=Math.min(player.maxLife,player.life+a);if(targetHas(d,'p2')&&duoPlayer.connected)duoPlayer.life=Math.min(duoPlayer.maxLife,duoPlayer.life+a)}"),
("if(c==='invincible')invincibleUntil=performance.now()+(+d.seconds||10)*1000;", "if(c==='invincible'){const until=performance.now()+(+d.seconds||10)*1000;if(targetHas(d,'p1'))invincibleUntil=until;if(targetHas(d,'p2')&&duoPlayer.connected)duoPlayer.invUntil=until}"),
("if(c==='xp')gainXP(+d.amount||50);", "if(c==='xp'){const a=+d.amount||50;if(targetHas(d,'p1'))gainXP(a);if(targetHas(d,'p2')&&duoPlayer.connected)gainDuoXP(a)}"),
]
for a,b in patterns:
    assert a in g,a
    g=g.replace(a,b,1)
# damage block replace via regex between damage and spawn
m=re.search(r"if\(c==='damage'\)\{.*?\}\}if\(c==='spawn'\)",g)
assert m
newdamage="""if(c==='damage'){const a=+d.amount||2;if(targetHas(d,'p1')){player.life=Math.max(0,player.life-a);if(running&&player.life<=0&&!deathState&&!tryPhoenix()){const k={username:d.user?String(d.user).replace(/^@/,''):'ADMIN',type:null,tier:0,x:player.x,y:player.y,r:20,dead:false};knockDownPlayer('p1',k)}}if(targetHas(d,'p2')&&duoPlayer.connected){duoPlayer.life=Math.max(0,duoPlayer.life-a);if(duoPlayer.life<=0&&!duoPlayer.down&&!tryDuoPhoenix()){const k={username:'ADMIN',type:null,tier:0,x:duoPlayer.x,y:duoPlayer.y,r:20,dead:false};knockDownPlayer('p2',k)}}}if(c==='saveplayer')adminSaveTarget(d);if(c==='spawn')"""
g=g[:m.start()]+newdamage+g[m.end():]

# rank UI handlers and default name before start button binding
needle="const startButton=$('startBtn');"
assert needle in g
ui="""const nameInput=$('playerName');if(nameInput){try{nameInput.value=localStorage.getItem('caos-player-name')||''}catch{}nameInput.addEventListener('input',()=>{nameInput.value=nameInput.value.slice(0,18)})}const rankBtn=$('rankBtn'),rankClose=$('rankClose'),rankSoloBtn=$('rankSoloBtn'),rankDuoBtn=$('rankDuoBtn');if(rankBtn)rankBtn.onclick=()=>openRank('solo');if(rankClose)rankClose.onclick=()=>$('rankOverlay')?.classList.remove('show');if(rankSoloBtn)rankSoloBtn.onclick=()=>renderRank('solo');if(rankDuoBtn)rankDuoBtn.onclick=()=>renderRank('duo');\n"""
g=g.replace(needle,ui+needle,1)
ww('src/game.js',g)

# ---------- DUO JS ----------
p=rw('src/duo.js').replace("const VERSION='0.17.31'","const VERSION='0.17.32'",1).replace('01731','01732')
# hello includes name, save local
old="conn.send({type:'duo-hello',role:'player2',version:VERSION})"
new="const nm=String($('duoName')?.value||localStorage.getItem('caos-duo-name')||'P2').trim().slice(0,18)||'P2';try{localStorage.setItem('caos-duo-name',nm)}catch{};conn.send({type:'duo-hello',role:'player2',version:VERSION,name:nm})"
assert old in p
p=p.replace(old,new,1)
# load prior duo name before resize
needle='function resize(){'
assert needle in p
p=p.replace(needle,"try{if($('duoName'))$('duoName').value=localStorage.getItem('caos-duo-name')||''}catch{}\n"+needle,1)
ww('src/duo.js',p)

# ---------- PANEL JS ----------
p=rw('src/panel.js')
# generic buttons include target
old="document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>send({command:b.dataset.cmd,amount:+b.dataset.amount||undefined,seconds:+b.dataset.seconds||undefined,mob:b.dataset.mob||undefined,value:b.dataset.value==='true'?true:b.dataset.value==='false'?false:undefined,tier:b.dataset.cmd==='boss'?($('bossTier')?.value||null):undefined},b.textContent.trim()));"
new="document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>send({command:b.dataset.cmd,amount:+b.dataset.amount||undefined,seconds:+b.dataset.seconds||undefined,mob:b.dataset.mob||undefined,value:b.dataset.value==='true'?true:b.dataset.value==='false'?false:undefined,tier:b.dataset.cmd==='boss'?($('bossTier')?.value||null):undefined,target:$('playerTarget')?.value||'p1'},b.textContent.trim()));if($('savePlayer'))$('savePlayer').onclick=()=>send({command:'saveplayer',target:$('playerTarget')?.value||'p1'},'🛟 Salvar / reviver '+($('playerTarget')?.selectedOptions?.[0]?.textContent||'jogador'));"
assert old in p
p=p.replace(old,new,1)
# update target labels from telemetry inside state handler, append after skill list logic recognizable
needle="if($('skillStateList')&&d.skillLv)"
assert needle in p
insert="""if(d.players&&$('playerTarget')){const o1=$('playerTarget').querySelector('option[value="p1"]'),o2=$('playerTarget').querySelector('option[value="p2"]');if(o1)o1.textContent='P1 · '+(d.players.p1?.name||'HOST')+(d.players.p1?.down?' · CAÍDO':'');if(o2)o2.textContent='P2 · '+(d.players.p2?.name||'DUO')+(d.players.p2?.connected?'': ' · OFFLINE')+(d.players.p2?.down?' · CAÍDO':'')}"""
p=p.replace(needle,insert+needle,1)
ww('src/panel.js',p)

# sync other files
for f in ['src/map-runtime.js','src/map-lab.js']:
    x=rw(f).replace('0.17.31','0.17.32').replace('01731','01732');ww(f,x)
ww('version.json',json.dumps({'version':VERSION,'build':'player-names-rank-history-admin-targets'},indent=2,ensure_ascii=False)+'\n')
print('v0.17.32 patch applied')
