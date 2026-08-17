from pathlib import Path
import json, re

GAME=Path('src/game.js')
PANEL=Path('src/panel.js')
HTML=Path('painel.html')
VERSION=Path('version.json')
RECOVERY=Path('docs/RECOVERY.md')

s=GAME.read_text(encoding='utf-8')
p=PANEL.read_text(encoding='utf-8')
h=HTML.read_text(encoding='utf-8')

if "VERSION='0.17.43'" in s and "METEOR_CONFIG_KEY='caos-meteor-config-v1'" in s and "METEOR_CONFIG_KEY='caos-meteor-config-v1'" in p:
    print('Solo v0.17.43 meteor persistence already applied; validation only')
    raise SystemExit(0)

def once(text, old, new, label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    return text.replace(old,new,1)

# --- GAME: persistent meteor defaults on same origin/local browser ---
s=once(s,"const VERSION='0.17.42'","const VERSION='0.17.43'",'game version')
old_apply="function applyMeteorConfig(d={}){meteorConfig.interval=clampEventNumber(d.interval,.45,12,meteorConfig.interval);meteorConfig.warning=clampEventNumber(d.warning,.6,5,meteorConfig.warning);meteorConfig.radius=clampEventNumber(d.radius,45,180,meteorConfig.radius);meteorConfig.playerDamage=clampEventNumber(d.playerDamage,1,80,meteorConfig.playerDamage);meteorConfig.mobDamage=clampEventNumber(d.mobDamage,1,100,meteorConfig.mobDamage);meteorConfig.batch=Math.round(clampEventNumber(d.batch,1,25,meteorConfig.batch))}"
new_apply="const METEOR_CONFIG_KEY='caos-meteor-config-v1';function meteorConfigSnapshot(){return{interval:meteorConfig.interval,warning:meteorConfig.warning,radius:meteorConfig.radius,playerDamage:meteorConfig.playerDamage,mobDamage:meteorConfig.mobDamage,batch:meteorConfig.batch}}function saveMeteorConfig(){try{localStorage.setItem(METEOR_CONFIG_KEY,JSON.stringify(meteorConfigSnapshot()))}catch{}}function applyMeteorConfig(d={},persist=true){meteorConfig.interval=clampEventNumber(d.interval,.45,12,meteorConfig.interval);meteorConfig.warning=clampEventNumber(d.warning,.6,5,meteorConfig.warning);meteorConfig.radius=clampEventNumber(d.radius,45,180,meteorConfig.radius);meteorConfig.playerDamage=clampEventNumber(d.playerDamage,1,80,meteorConfig.playerDamage);meteorConfig.mobDamage=clampEventNumber(d.mobDamage,1,100,meteorConfig.mobDamage);meteorConfig.batch=Math.round(clampEventNumber(d.batch,1,25,meteorConfig.batch));if(persist)saveMeteorConfig()}function loadMeteorConfig(){try{const raw=localStorage.getItem(METEOR_CONFIG_KEY);if(!raw)return;const cfg=JSON.parse(raw);if(cfg&&typeof cfg==='object')applyMeteorConfig(cfg,false)}catch{}}loadMeteorConfig()"
s=once(s,old_apply,new_apply,'persistent game meteor config')
GAME.write_text(s,encoding='utf-8')

# --- PANEL: persist draft/default and restore on next opening ---
anchor="let meteorConfigDirty=false;"
if anchor not in p:
    raise SystemExit('meteor dirty anchor missing')
p=once(p,anchor,"const METEOR_CONFIG_KEY='caos-meteor-config-v1';let meteorConfigDirty=false;",'panel persistence key')

old_payload="function meteorPayload(){return{interval:+$('meteorInterval')?.value||1.7,warning:+$('meteorWarning')?.value||1.8,radius:+$('meteorRadius')?.value||92,playerDamage:+$('meteorPlayerDamage')?.value||18,mobDamage:+$('meteorMobDamage')?.value||20,batch:Math.max(1,Math.min(25,Math.round(+$('meteorBatch')?.value||1)))}}"
new_payload="function clampMeteorPanel(v,min,max,fallback){v=Number(v);return Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback}function normalizeMeteorPanelConfig(d={}){return{interval:clampMeteorPanel(d.interval,.45,12,1.7),warning:clampMeteorPanel(d.warning,.6,5,1.8),radius:Math.round(clampMeteorPanel(d.radius,45,180,92)),playerDamage:clampMeteorPanel(d.playerDamage,1,80,18),mobDamage:clampMeteorPanel(d.mobDamage,1,100,20),batch:Math.round(clampMeteorPanel(d.batch,1,25,1))}}function meteorPayload(){return normalizeMeteorPanelConfig({interval:$('meteorInterval')?.value,warning:$('meteorWarning')?.value,radius:$('meteorRadius')?.value,playerDamage:$('meteorPlayerDamage')?.value,mobDamage:$('meteorMobDamage')?.value,batch:$('meteorBatch')?.value})}function writeMeteorFields(cfg){const pairs=[['meteorInterval',cfg.interval],['meteorWarning',cfg.warning],['meteorRadius',cfg.radius],['meteorPlayerDamage',cfg.playerDamage],['meteorMobDamage',cfg.mobDamage],['meteorBatch',cfg.batch]];for(const [id,v] of pairs){const el=$(id);if(el)el.value=String(v)}}function persistMeteorPanelConfig(cfg=meteorPayload()){cfg=normalizeMeteorPanelConfig(cfg);try{localStorage.setItem(METEOR_CONFIG_KEY,JSON.stringify(cfg))}catch{}writeMeteorFields(cfg);return cfg}function loadMeteorPanelConfig(){try{const raw=localStorage.getItem(METEOR_CONFIG_KEY);if(!raw)return false;const cfg=normalizeMeteorPanelConfig(JSON.parse(raw));writeMeteorFields(cfg);meteorConfigDirty=true;return true}catch{return false}}loadMeteorPanelConfig()"
p=once(p,old_payload,new_payload,'panel persistence helpers')

old_controls="document.querySelectorAll('#specialEventsCard input').forEach(el=>{el.addEventListener('input',()=>meteorConfigDirty=true);el.addEventListener('change',()=>meteorConfigDirty=true)});\nif($('meteorEventToggle'))$('meteorEventToggle').onclick=()=>{const next=$('meteorEventToggle').dataset.on!=='true';send({command:'eventmeteor',value:next,...meteorPayload()},'☄ Chuva de Meteoro '+(next?'ON':'OFF'))};\nif($('meteorConfigSave'))$('meteorConfigSave').onclick=()=>{const ok=send({command:'eventmeteorconfig',...meteorPayload()},'☄ Configuração da chuva salva');if(ok)meteorConfigDirty=false};"
new_controls="document.querySelectorAll('#specialEventsCard input').forEach(el=>{el.addEventListener('input',()=>meteorConfigDirty=true);el.addEventListener('change',()=>meteorConfigDirty=true)});\nif($('meteorEventToggle'))$('meteorEventToggle').onclick=()=>{const next=$('meteorEventToggle').dataset.on!=='true',cfg=persistMeteorPanelConfig();const ok=send({command:'eventmeteor',value:next,...cfg},'☄ Chuva de Meteoro '+(next?'ON':'OFF'));if(ok)meteorConfigDirty=false};\nif($('meteorConfigSave'))$('meteorConfigSave').onclick=()=>{const cfg=persistMeteorPanelConfig(),btn=$('meteorConfigSave');const ok=send({command:'eventmeteorconfig',...cfg},'☄ Configuração da chuva salva');meteorConfigDirty=!ok;if(btn){const old=btn.textContent;btn.textContent=ok?'✓ SALVO E APLICADO':'✓ SALVO NESTE DISPOSITIVO';setTimeout(()=>btn.textContent=old,1600)}if(!ok)add('☄ Configuração persistida; conecte ao jogo para aplicar nesta partida')};"
p=once(p,old_controls,new_controls,'panel save behavior')
PANEL.write_text(p,encoding='utf-8')

# Panel wording/cache: make persistence explicit.
h=h.replace('Você pode ajustar os valores mesmo antes de conectar. Para ativar/desativar o evento, conecte o painel ao jogo.','Você pode ajustar e salvar os valores mesmo antes de conectar. O último padrão fica guardado neste dispositivo e é carregado na próxima abertura.')
h=h.replace('Meteoros pendentes: <b id="meteorPending">0</b> · Ex.: coloque 10 para cair uma onda de 10 meteoros simultaneamente.','Meteoros pendentes: <b id="meteorPending">0</b> · Configuração persistente neste dispositivo. Ex.: 10 = uma onda de 10 meteoros.')
h=h.replace('v0.17.42','v0.17.43').replace('v=01742','v=01743')
HTML.write_text(h,encoding='utf-8')

# Solo release/cache surfaces.
for path in [Path('index.html'),Path('duo.html'),Path('map-lab.html')]:
    t=path.read_text(encoding='utf-8')
    t=t.replace('0.17.42','0.17.43').replace('01742','01743')
    path.write_text(t,encoding='utf-8')
VERSION.write_text(json.dumps({'version':'0.17.43','build':'solo-persistent-meteor-admin-config'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

r=RECOVERY.read_text(encoding='utf-8') if RECOVERY.exists() else '# Recovery\n'
entry='''\n## Solo v0.17.42 stable\n- Branch: `backup/solo-v0.17.42-stable`\n- Estado anterior à persistência da configuração de meteoros v0.17.43.\n'''
if 'backup/solo-v0.17.42-stable' not in r:
    r += entry
RECOVERY.write_text(r,encoding='utf-8')
print('Applied Solo v0.17.43 persistent meteor config')
