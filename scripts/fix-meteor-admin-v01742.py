from pathlib import Path
import json, re

GAME=Path('src/game.js')
PANEL=Path('src/panel.js')
HTML=Path('painel.html')
CSS=Path('src/styles/panel.css')
VERSION=Path('version.json')
RECOVERY=Path('docs/RECOVERY.md')

s=GAME.read_text(encoding='utf-8')
p=PANEL.read_text(encoding='utf-8')
h=HTML.read_text(encoding='utf-8')
c=CSS.read_text(encoding='utf-8')

# Idempotent on reruns after promotion.
if "VERSION='0.17.42'" in s and 'meteorBatch' in h and 'batch:meteorConfig.batch' in s and 'meteorConfigDirty' in p:
    print('Solo v0.17.42 meteor admin fix already applied; validation only')
    raise SystemExit(0)

def once(text, old, new, label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    return text.replace(old,new,1)

# Game: version + simultaneous meteor waves.
s=once(s,"const VERSION='0.17.41'","const VERSION='0.17.42'",'game version')
s=once(s,"meteorConfig={interval:1.7,warning:1.8,radius:92,playerDamage:18,mobDamage:20}","meteorConfig={interval:1.7,warning:1.8,radius:92,playerDamage:18,mobDamage:20,batch:1}",'meteor config state')
s=once(s,
"function applyMeteorConfig(d={}){meteorConfig.interval=clampEventNumber(d.interval,.45,12,meteorConfig.interval);meteorConfig.warning=clampEventNumber(d.warning,.6,5,meteorConfig.warning);meteorConfig.radius=clampEventNumber(d.radius,45,180,meteorConfig.radius);meteorConfig.playerDamage=clampEventNumber(d.playerDamage,1,80,meteorConfig.playerDamage);meteorConfig.mobDamage=clampEventNumber(d.mobDamage,1,100,meteorConfig.mobDamage)}",
"function applyMeteorConfig(d={}){meteorConfig.interval=clampEventNumber(d.interval,.45,12,meteorConfig.interval);meteorConfig.warning=clampEventNumber(d.warning,.6,5,meteorConfig.warning);meteorConfig.radius=clampEventNumber(d.radius,45,180,meteorConfig.radius);meteorConfig.playerDamage=clampEventNumber(d.playerDamage,1,80,meteorConfig.playerDamage);meteorConfig.mobDamage=clampEventNumber(d.mobDamage,1,100,meteorConfig.mobDamage);meteorConfig.batch=Math.round(clampEventNumber(d.batch,1,25,meteorConfig.batch))}",'meteor config apply')
s=once(s,"if(meteors.length>28)meteors.splice(0,meteors.length-28)","if(meteors.length>90)meteors.splice(0,meteors.length-90)",'meteor pending cap')
s=once(s,
"if(meteorSpawnTimer<=0){scheduleMeteor();meteorSpawnTimer=meteorConfig.interval*(.82+Math.random()*.36)}",
"if(meteorSpawnTimer<=0){for(let i=0;i<meteorConfig.batch;i++)scheduleMeteor();meteorSpawnTimer=meteorConfig.interval*(.82+Math.random()*.36)}",'meteor batch spawn')
s=once(s,"mobDamage:meteorConfig.mobDamage,pending:","mobDamage:meteorConfig.mobDamage,batch:meteorConfig.batch,pending:",'meteor telemetry batch')
GAME.write_text(s,encoding='utf-8')

# Panel JS: editable draft must not be overwritten every 500ms by telemetry.
p=once(p,"function setEventToggle(id,on){", "let meteorConfigDirty=false;\nfunction setEventToggle(id,on){", 'dirty state')
old_sync="function syncSpecialEventState(ev){if(!ev)return;setEventToggle('doubleXpEventToggle',!!ev.doubleXp);const m=ev.meteor||{};setEventToggle('meteorEventToggle',!!m.active);if($('meteorPending'))$('meteorPending').textContent=Number(m.pending)||0;const pairs=[['meteorInterval',m.interval],['meteorWarning',m.warning],['meteorRadius',m.radius],['meteorPlayerDamage',m.playerDamage],['meteorMobDamage',m.mobDamage]];for(const [id,v] of pairs){const el=$(id);if(el&&document.activeElement!==el&&Number.isFinite(+v))el.value=String(v)}}"
new_sync="function syncSpecialEventState(ev){if(!ev)return;setEventToggle('doubleXpEventToggle',!!ev.doubleXp);const m=ev.meteor||{};setEventToggle('meteorEventToggle',!!m.active);if($('meteorPending'))$('meteorPending').textContent=Number(m.pending)||0;if(!meteorConfigDirty){const pairs=[['meteorInterval',m.interval],['meteorWarning',m.warning],['meteorRadius',m.radius],['meteorPlayerDamage',m.playerDamage],['meteorMobDamage',m.mobDamage],['meteorBatch',m.batch]];for(const [id,v] of pairs){const el=$(id);if(el&&Number.isFinite(+v))el.value=String(v)}}}"
p=once(p,old_sync,new_sync,'panel event sync')
p=once(p,
"function meteorPayload(){return{interval:+$('meteorInterval')?.value||1.7,warning:+$('meteorWarning')?.value||1.8,radius:+$('meteorRadius')?.value||92,playerDamage:+$('meteorPlayerDamage')?.value||18,mobDamage:+$('meteorMobDamage')?.value||20}}",
"function meteorPayload(){return{interval:+$('meteorInterval')?.value||1.7,warning:+$('meteorWarning')?.value||1.8,radius:+$('meteorRadius')?.value||92,playerDamage:+$('meteorPlayerDamage')?.value||18,mobDamage:+$('meteorMobDamage')?.value||20,batch:Math.max(1,Math.min(25,Math.round(+$('meteorBatch')?.value||1)))}}",'meteor payload')
p=once(p,
"if($('meteorEventToggle'))$('meteorEventToggle').onclick=()=>{const next=$('meteorEventToggle').dataset.on!=='true';send({command:'eventmeteor',value:next,...meteorPayload()},'☄ Chuva de Meteoro '+(next?'ON':'OFF'))};\nif($('meteorConfigSave'))$('meteorConfigSave').onclick=()=>send({command:'eventmeteorconfig',...meteorPayload()},'☄ Configuração da chuva salva');",
"document.querySelectorAll('#specialEventsCard input').forEach(el=>{el.addEventListener('input',()=>meteorConfigDirty=true);el.addEventListener('change',()=>meteorConfigDirty=true)});\nif($('meteorEventToggle'))$('meteorEventToggle').onclick=()=>{const next=$('meteorEventToggle').dataset.on!=='true';send({command:'eventmeteor',value:next,...meteorPayload()},'☄ Chuva de Meteoro '+(next?'ON':'OFF'))};\nif($('meteorConfigSave'))$('meteorConfigSave').onclick=()=>{const ok=send({command:'eventmeteorconfig',...meteorPayload()},'☄ Configuração da chuva salva');if(ok)meteorConfigDirty=false};",'meteor controls')
PANEL.write_text(p,encoding='utf-8')

# Rebuild event card outside .controls.disabled, with mobile-friendly fields.
card_match=re.search(r'<section class="card specialEventsCard" id="specialEventsCard">.*?</section>\s*',h,re.S)
if not card_match:
    raise SystemExit('special events card not found')
h=h[:card_match.start()]+h[card_match.end():]
card='''<section class="card specialEventsCard" id="specialEventsCard">
  <div class="sectionTitle"><div><span class="eyebrow">EVENTOS ESPECIAIS</span><h2>Caos temporário</h2></div><span class="miniStatus">CONTROLE ADM</span></div>
  <p class="hint">Você pode ajustar os valores mesmo antes de conectar. Para ativar/desativar o evento, conecte o painel ao jogo.</p>
  <div class="modeGrid eventModeGrid">
    <button id="doubleXpEventToggle" class="modeToggle" type="button" data-on="false"><span class="modeInfo"><span class="modeIcon">✨</span><span><b>DOBRO DE XP</b><small>Mobs que nascerem durante o evento recebem 2× XP e ficam marcados.</small></span></span><span class="modeRight"><span id="doubleXpEventState" class="modeBadge">OFF</span><span class="toggleTrack"><span class="toggleKnob"></span></span></span></button>
    <button id="meteorEventToggle" class="modeToggle" type="button" data-on="false"><span class="modeInfo"><span class="modeIcon">☄️</span><span><b>CHUVA DE METEORO</b><small>Cada onda marca o solo e derruba a quantidade configurada de meteoros ao mesmo tempo.</small></span></span><span class="modeRight"><span id="meteorEventState" class="modeBadge">OFF</span><span class="toggleTrack"><span class="toggleKnob"></span></span></span></button>
  </div>
  <h3>Configuração da chuva</h3>
  <div class="meteorConfigGrid">
    <label class="meteorField"><span>INTERVALO ENTRE ONDAS</span><input id="meteorInterval" inputmode="decimal" type="number" min="0.45" max="12" step="0.1" value="1.7"><small>segundos</small></label>
    <label class="meteorField"><span>AVISO NO CHÃO</span><input id="meteorWarning" inputmode="decimal" type="number" min="0.6" max="5" step="0.1" value="1.8"><small>segundos</small></label>
    <label class="meteorField"><span>METEOROS POR ONDA</span><input id="meteorBatch" inputmode="numeric" type="number" min="1" max="25" step="1" value="1"><small>simultâneos · 1–25</small></label>
    <label class="meteorField"><span>RAIO</span><input id="meteorRadius" inputmode="numeric" type="number" min="45" max="180" step="1" value="92"><small>área do impacto</small></label>
    <label class="meteorField"><span>DANO PLAYER</span><input id="meteorPlayerDamage" inputmode="numeric" type="number" min="1" max="80" step="1" value="18"><small>por impacto</small></label>
    <label class="meteorField"><span>DANO MOBS</span><input id="meteorMobDamage" inputmode="numeric" type="number" min="1" max="100" step="1" value="20"><small>por impacto</small></label>
    <button id="meteorConfigSave" class="gold meteorSave" type="button">SALVAR CONFIGURAÇÃO</button>
  </div>
  <div class="net leftNet eventFoot">Meteoros pendentes: <b id="meteorPending">0</b> · Ex.: coloque 10 para cair uma onda de 10 meteoros simultaneamente.</div>
</section>

'''
anchor='<section id="controls" class="controls disabled">'
if anchor not in h:
    raise SystemExit('controls anchor not found')
h=h.replace(anchor,card+anchor,1)
# release/cache sync
h=h.replace('v0.17.41','v0.17.42').replace('v=01741','v=01742')
HTML.write_text(h,encoding='utf-8')

# Panel CSS: compact editable config, especially iPhone.
css_add='''\n/* v0.17.42 special-event editor */\n.specialEventsCard{pointer-events:auto;opacity:1;filter:none}.eventModeGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.meteorConfigGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.meteorField{display:flex;min-width:0;flex-direction:column;gap:6px;padding:11px;border:1px solid #29334f;border-radius:13px;background:#080d18;color:#d9deee}.meteorField>span{font-size:8px;font-weight:950;letter-spacing:.7px;color:#919cbc}.meteorField input{width:100%;min-width:0;padding:11px;border:1px solid #303a58;border-radius:10px;background:#060a13;color:#fff;outline:none;font-size:15px;font-weight:850;-webkit-appearance:none;appearance:none}.meteorField input:focus{border-color:#7657c9;box-shadow:0 0 0 3px #7c3aed15}.meteorField small{color:#65708e;font-size:8px}.meteorSave{grid-column:1/-1;min-height:44px;border-radius:11px;color:#fff;font-weight:950}.eventFoot{margin-top:10px}.controls.disabled~*{}@media(max-width:620px){.eventModeGrid{grid-template-columns:1fr}.meteorConfigGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.meteorField{padding:10px}.meteorField>span{font-size:7.5px}.meteorField input{font-size:16px;padding:10px}.meteorSave{grid-column:1/-1}}\n'''
if '/* v0.17.42 special-event editor */' not in c:
    c += css_add
CSS.write_text(c,encoding='utf-8')

# Other solo cache/version surfaces.
for path in [Path('index.html'),Path('duo.html'),Path('map-lab.html')]:
    t=path.read_text(encoding='utf-8')
    t=t.replace('0.17.41','0.17.42').replace('01741','01742')
    path.write_text(t,encoding='utf-8')
VERSION.write_text(json.dumps({'version':'0.17.42','build':'solo-meteor-admin-editable-simultaneous-waves'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

r=RECOVERY.read_text(encoding='utf-8') if RECOVERY.exists() else '# Recovery\n'
entry='''\n## Solo v0.17.41 stable\n- Branch: `backup/solo-v0.17.41-stable`\n- Estado anterior ao editor de meteoros simultâneos v0.17.42.\n'''
if 'backup/solo-v0.17.41-stable' not in r:
    r += entry
RECOVERY.write_text(r,encoding='utf-8')
print('Applied Solo v0.17.42 meteor admin fix')
