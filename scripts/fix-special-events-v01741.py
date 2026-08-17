from pathlib import Path
import json, re

GAME = Path('src/game.js')
PANEL = Path('src/panel.js')
PANEL_HTML = Path('painel.html')
s = GAME.read_text(encoding='utf-8')
p = PANEL.read_text(encoding='utf-8')
h = PANEL_HTML.read_text(encoding='utf-8')

# Idempotent: workflow runs again after promotion to main.
if "VERSION='0.17.41'" in s and 'doubleXpEvent=false' in s and 'eventDoubleXp' in h:
    print('Solo v0.17.41 special events already applied; validation only')
    raise SystemExit(0)

def once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    return text.replace(old, new, 1)

s = once(s, "const VERSION='0.17.40'", "const VERSION='0.17.41'", 'game version')
s = once(
    s,
    'explosionFx=[],bossFuryCount=0;',
    "explosionFx=[],bossFuryCount=0,doubleXpEvent=false,meteorEventActive=false,meteorSpawnTimer=.45,meteors=[],meteorShakeLeft=0,meteorConfig={interval:1.7,warning:1.8,radius:92,playerDamage:18,mobDamage:20};",
    'event state'
)
s = once(
    s,
    'aiPhase:Math.floor(Math.random()*4),mvx:0,mvy:0})',
    'aiPhase:Math.floor(Math.random()*4),mvx:0,mvy:0,xpEventMul:doubleXpEvent?2:1})',
    'spawn xp marker'
)

# Tagged XP belongs to the mob, not to the global toggle after spawn.
s, n1 = re.subn(r'gainDuoXP\(e\.xp\)', "gainDuoXP(e.xp*(e.xpEventMul||1))", s)
s, n2 = re.subn(r'gainXP\(e\.xp\)', "gainXP(e.xp*(e.xpEventMul||1))", s)
if n1 != 1 or n2 != 1:
    raise SystemExit(f'XP award patch mismatch: duo={n1}, solo={n2}')

s = once(
    s,
    "function killerLabel(e){if(!e)return 'CAOS';const live=",
    "function killerLabel(e){if(!e)return 'CAOS';if(e.eventName)return e.eventName;const live=",
    'meteor death label'
)

hurt_match = re.search(r"function hurtEnemy\(e,amount,kind='normal'\)\{.*?return dealt\}", s)
if not hurt_match:
    raise SystemExit('hurtEnemy anchor not found')
meteor_code = r'''
function clampEventNumber(v,min,max,fallback){v=Number(v);return Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback}
function applyMeteorConfig(d={}){meteorConfig.interval=clampEventNumber(d.interval,.45,12,meteorConfig.interval);meteorConfig.warning=clampEventNumber(d.warning,.6,5,meteorConfig.warning);meteorConfig.radius=clampEventNumber(d.radius,45,180,meteorConfig.radius);meteorConfig.playerDamage=clampEventNumber(d.playerDamage,1,80,meteorConfig.playerDamage);meteorConfig.mobDamage=clampEventNumber(d.mobDamage,1,100,meteorConfig.mobDamage)}
function scheduleMeteor(){const halfW=Math.max(170,W*.43),halfH=Math.max(170,H*.43),near=Math.random()<.28,spread=near?110:1,x=near?player.x+(Math.random()*2-1)*spread:player.x+(Math.random()*2-1)*halfW,y=near?player.y+(Math.random()*2-1)*spread:player.y+(Math.random()*2-1)*halfH;meteors.push({x,y,r:meteorConfig.radius,warningLeft:meteorConfig.warning,warningTotal:meteorConfig.warning,hit:false,life:0});if(meteors.length>28)meteors.splice(0,meteors.length-28)}
function meteorKiller(m){return{eventName:'CHUVA DE METEORO',type:null,tier:0,x:m.x,y:m.y,r:m.r,dead:false}}
function damagePlayerByMeteor(m){const now=performance.now(),amount=meteorConfig.playerDamage;if(!player.down&&Math.hypot(player.x-m.x,player.y-m.y)<=m.r+player.r){if(now>=invincibleUntil&&player.inv<=0&&!skillShieldP1()){if(!tryDodge(now)){lastDamageAt=now;player.life=Math.max(0,player.life-amount);triggerGhost(now);if(player.life<=0&&!player.down&&!tryPhoenix())knockDownPlayer('p1',meteorKiller(m))}}}if(duoPlayer.connected&&!duoPlayer.down&&Math.hypot(duoPlayer.x-m.x,duoPlayer.y-m.y)<=m.r+duoPlayer.r){if(now>=(duoPlayer.invUntil||0)&&!skillShieldP2()){duoPlayer.life=Math.max(0,duoPlayer.life-amount);duoPlayer.lastDamageAt=now;if(duoPlayer.life<=0&&!duoPlayer.down&&!tryDuoPhoenix())knockDownPlayer('p2',meteorKiller(m))}}}
function impactMeteor(m){m.hit=true;m.life=.58;meteorShakeLeft=Math.max(meteorShakeLeft,.38);damagePlayerByMeteor(m);for(const e of enemies){if(e.dead||Math.hypot(e.x-m.x,e.y-m.y)>m.r+e.r)continue;hurtEnemy(e,meteorConfig.mobDamage,'meteor');if(e.hp<=0&&!e.dead){e.dead=true;onKill(e)}}}
function updateMeteorEvent(dt){meteorShakeLeft=Math.max(0,meteorShakeLeft-dt);if(meteorEventActive){meteorSpawnTimer-=dt;if(meteorSpawnTimer<=0){scheduleMeteor();meteorSpawnTimer=meteorConfig.interval*(.82+Math.random()*.36)}}for(const m of meteors){if(!m.hit){m.warningLeft-=dt;if(m.warningLeft<=0)impactMeteor(m)}else m.life-=dt}meteors=meteors.filter(m=>!m.hit||m.life>0)}
function meteorShakeOffset(){if(meteorShakeLeft<=0)return{x:0,y:0};const p=Math.min(1,meteorShakeLeft/.38),power=9*p;return{x:(Math.random()*2-1)*power,y:(Math.random()*2-1)*power}}
function drawMeteorFx(){for(const m of meteors){const q=world(m.x,m.y);ctx.save();ctx.translate(q.x,q.y);if(!m.hit){const phase=1-Math.max(0,m.warningLeft)/Math.max(.01,m.warningTotal),pulse=.55+.45*Math.sin((performance.now()/75)+m.x*.01);ctx.fillStyle='rgba(239,68,68,.10)';ctx.strokeStyle='#fb7185';ctx.shadowColor='#ef4444';ctx.shadowBlur=12;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,m.r*(.82+.08*pulse),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(254,202,202,.72)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-m.r*.45,0);ctx.lineTo(m.r*.45,0);ctx.moveTo(0,-m.r*.45);ctx.lineTo(0,m.r*.45);ctx.stroke();ctx.fillStyle='#fecaca';ctx.font='900 9px sans-serif';ctx.textAlign='center';ctx.fillText('☄ '+Math.max(0,m.warningLeft).toFixed(1)+'s',0,-m.r-8);if(phase>.66){const fall=Math.min(1,(phase-.66)/.34),mx=(1-fall)*95,my=-(1-fall)*260;ctx.strokeStyle='rgba(251,146,60,.55)';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(mx+55,my-90);ctx.lineTo(mx,my);ctx.stroke();ctx.shadowColor='#f97316';ctx.shadowBlur=22;ctx.fillStyle='#fde68a';ctx.beginPath();ctx.arc(mx,my,9+fall*4,0,Math.PI*2);ctx.fill()}}else{const life=Math.max(0,m.life/.58),grow=1-life;ctx.globalAlpha=Math.min(1,life*1.6);ctx.fillStyle='rgba(249,115,22,.18)';ctx.strokeStyle='#fb923c';ctx.shadowColor='#ef4444';ctx.shadowBlur=24;ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,m.r*(.35+grow*.95),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='rgba(15,8,8,.62)';ctx.beginPath();ctx.arc(0,0,m.r*.30,0,Math.PI*2);ctx.fill()}ctx.restore()}}
'''.strip()
s = s[:hurt_match.end()] + '\n' + meteor_code + s[hurt_match.end():]

s = once(
    s,
    "shockFx=[];explosionFx=[];bossFuryCount=0;enemySpeed=1;",
    "shockFx=[];explosionFx=[];bossFuryCount=0;meteors=[];meteorSpawnTimer=.45;meteorShakeLeft=0;enemySpeed=1;",
    'reset meteor transients'
)
s = once(
    s,
    "function update(dt){if(paused||(choosing&&!duoPlayer.connected))return;if(deathState)return;let dx=",
    "function update(dt){if(paused||(choosing&&!duoPlayer.connected))return;if(deathState)return;updateMeteorEvent(dt);let dx=",
    'meteor update hook'
)
s = once(
    s,
    "f.kind==='shock'?'#c4b5fd':'#ffffff'",
    "f.kind==='shock'?'#c4b5fd':f.kind==='meteor'?'#fb7185':'#ffffff'",
    'meteor damage color'
)
s = once(
    s,
    "if(isBoss){ctx.fillStyle='#fde68a';",
    "if((e.xpEventMul||1)>=2){ctx.save();ctx.fillStyle='#fde047';ctx.shadowColor='#f59e0b';ctx.shadowBlur=10;ctx.font='900 9px sans-serif';ctx.textAlign='center';ctx.fillText('2× XP',0,barY-24);ctx.restore()}if(isBoss){ctx.fillStyle='#fde68a';",
    '2x xp mob label'
)
s = once(
    s,
    "function draw(){if(!W||!H)return;ctx.setTransform(dpr,0,0,dpr,0,0);terrain();if(window.CaosMap)window.CaosMap.drawObjects();for(const b of bullets)",
    "function draw(){if(!W||!H)return;ctx.setTransform(dpr,0,0,dpr,0,0);const shake=meteorShakeOffset();ctx.translate(shake.x,shake.y);terrain();if(window.CaosMap)window.CaosMap.drawObjects();drawMeteorFx();for(const b of bullets)",
    'meteor draw hook'
)

cmd_insert = """if(c==='eventdoublexp'){doubleXpEvent=!!d.value;toast(doubleXpEvent?'✨ EVENTO 2× XP ATIVADO':'✨ EVENTO 2× XP ENCERRADO · MOBS MARCADOS MANTÊM BÔNUS')}if(c==='eventmeteorconfig'){applyMeteorConfig(d);toast('☄ CHUVA DE METEORO · CONFIGURAÇÃO SALVA')}if(c==='eventmeteor'){applyMeteorConfig(d);meteorEventActive=!!d.value;if(meteorEventActive)meteorSpawnTimer=Math.min(meteorSpawnTimer,.35);toast(meteorEventActive?'☄ CHUVA DE METEORO ATIVADA':'☄ CHUVA DE METEORO ENCERRADA')}"""
s = once(s, "if(c==='ping')broadcast();", cmd_insert + "if(c==='ping')broadcast();", 'admin event commands')
s = once(
    s,
    'wave:waveCount,bossFuryCount,fps:',
    "wave:waveCount,bossFuryCount,events:{doubleXp:doubleXpEvent,meteor:{active:meteorEventActive,interval:meteorConfig.interval,warning:meteorConfig.warning,radius:meteorConfig.radius,playerDamage:meteorConfig.playerDamage,mobDamage:meteorConfig.mobDamage,pending:meteors.filter(m=>!m.hit).length}},fps:",
    'event telemetry'
)
GAME.write_text(s, encoding='utf-8')

# Panel: special event card.
event_card = r'''
  <section class="card specialEventsCard" id="specialEventsCard">
    <div class="sectionTitle"><div><span class="eyebrow">EVENTOS ESPECIAIS</span><h2>Caos temporário</h2></div><span class="miniStatus">CONTROLE ADM</span></div>
    <p class="hint">Eventos ficam ativos até o ADM desligar. Ativar eventos manualmente invalida a partida ranqueada.</p>
    <div class="modeGrid">
      <button id="doubleXpEventToggle" class="modeToggle" type="button" data-on="false"><span class="modeInfo"><span class="modeIcon">✨</span><span><b>DOBRO DE XP</b><small>Mobs que nascerem durante o evento recebem 2× XP e ficam marcados.</small></span></span><span class="modeRight"><span id="doubleXpEventState" class="modeBadge">OFF</span><span class="toggleTrack"><span class="toggleKnob"></span></span></span></button>
      <button id="meteorEventToggle" class="modeToggle" type="button" data-on="false"><span class="modeInfo"><span class="modeIcon">☄️</span><span><b>CHUVA DE METEORO</b><small>Marca o solo, meteoro cai depois e causa dano em player e mobs.</small></span></span><span class="modeRight"><span id="meteorEventState" class="modeBadge">OFF</span><span class="toggleTrack"><span class="toggleKnob"></span></span></span></button>
    </div>
    <h3 style="margin-top:14px">Configuração da chuva</h3>
    <div class="tools" style="align-items:end;flex-wrap:wrap">
      <label>INTERVALO (s)<input id="meteorInterval" type="number" min="0.45" max="12" step="0.1" value="1.7"></label>
      <label>AVISO NO CHÃO (s)<input id="meteorWarning" type="number" min="0.6" max="5" step="0.1" value="1.8"></label>
      <label>RAIO<input id="meteorRadius" type="number" min="45" max="180" step="1" value="92"></label>
      <label>DANO PLAYER<input id="meteorPlayerDamage" type="number" min="1" max="80" step="1" value="18"></label>
      <label>DANO MOBS<input id="meteorMobDamage" type="number" min="1" max="100" step="1" value="20"></label>
      <button id="meteorConfigSave" class="gold" type="button">SALVAR CONFIG</button>
    </div>
    <div class="net leftNet">Meteoros pendentes: <b id="meteorPending">0</b> · O evento usa aviso visual antes de cada impacto.</div>
  </section>
'''.strip()
anchor = '  <div class="adminColumns">'
if anchor not in h:
    raise SystemExit('panel event card anchor missing')
h = h.replace(anchor, event_card + '\n\n' + anchor, 1)
PANEL_HTML.write_text(h, encoding='utf-8')

# Panel JS telemetry and controls.
helper = r'''
function setEventToggle(id,on){const el=$(id);if(!el)return;el.dataset.on=on?'true':'false';el.classList.toggle('isOn',!!on);const badge=el.querySelector('.modeBadge');if(badge)badge.textContent=on?'ON':'OFF'}
function syncSpecialEventState(ev){if(!ev)return;setEventToggle('doubleXpEventToggle',!!ev.doubleXp);const m=ev.meteor||{};setEventToggle('meteorEventToggle',!!m.active);if($('meteorPending'))$('meteorPending').textContent=Number(m.pending)||0;const pairs=[['meteorInterval',m.interval],['meteorWarning',m.warning],['meteorRadius',m.radius],['meteorPlayerDamage',m.playerDamage],['meteorMobDamage',m.mobDamage]];for(const [id,v] of pairs){const el=$(id);if(el&&document.activeElement!==el&&Number.isFinite(+v))el.value=String(v)}}
function meteorPayload(){return{interval:+$('meteorInterval')?.value||1.7,warning:+$('meteorWarning')?.value||1.8,radius:+$('meteorRadius')?.value||92,playerDamage:+$('meteorPlayerDamage')?.value||18,mobDamage:+$('meteorMobDamage')?.value||20}}
'''.strip()
p = once(p, "}$('connect').onclick", "}\n" + helper + "\n$('connect').onclick", 'panel event helper')
p = once(p, "});conn.on('close',()=>{", ";syncSpecialEventState(d.events)});conn.on('close',()=>{", 'panel event telemetry')
handlers = r'''
if($('doubleXpEventToggle'))$('doubleXpEventToggle').onclick=()=>{const next=$('doubleXpEventToggle').dataset.on!=='true';send({command:'eventdoublexp',value:next},'✨ Evento Dobro de XP '+(next?'ON':'OFF'))};
if($('meteorEventToggle'))$('meteorEventToggle').onclick=()=>{const next=$('meteorEventToggle').dataset.on!=='true';send({command:'eventmeteor',value:next,...meteorPayload()},'☄ Chuva de Meteoro '+(next?'ON':'OFF'))};
if($('meteorConfigSave'))$('meteorConfigSave').onclick=()=>send({command:'eventmeteorconfig',...meteorPayload()},'☄ Configuração da chuva salva');
'''.strip()
p = once(p, "if($('fpsModeToggle')){", handlers + "if($('fpsModeToggle')){", 'panel event handlers')
PANEL.write_text(p, encoding='utf-8')

# Solo-facing version/cache sync. Dedicated Online remains untouched.
for name in ['index.html', 'painel.html', 'duo.html', 'map-lab.html']:
    path = Path(name)
    text = path.read_text(encoding='utf-8')
    text = text.replace('0.17.40', '0.17.41').replace('01740', '01741')
    path.write_text(text, encoding='utf-8')

Path('version.json').write_text(json.dumps({
    'version': '0.17.41',
    'build': 'solo-special-events-double-xp-meteor-rain'
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

recovery = Path('docs/RECOVERY.md')
r = recovery.read_text(encoding='utf-8') if recovery.exists() else '# Caos Live - Recovery\n'
entry = '''\n## Stable Solo snapshot before v0.17.41\n\n- Commit: `7071e82901635b135c0771779f57cdb569b359f4`\n- Branch: `backup/solo-v0.17.40-stable`\n- Reason: restore point before Double XP and Meteor Rain special events.\n'''
if 'backup/solo-v0.17.40-stable' not in r:
    r += entry
recovery.write_text(r, encoding='utf-8')
print('Solo v0.17.41 special events patch applied')
