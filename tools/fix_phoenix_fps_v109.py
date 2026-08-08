from pathlib import Path
import re, json

idx=Path('index.html')
panel=Path('painel.html')
ver=Path('version.json')
html=idx.read_text(encoding='utf-8')
p=panel.read_text(encoding='utf-8')

# Version
html=html.replace('v0.10.8','v0.10.9').replace("const VERSION='0.10.8'","const VERSION='0.10.9'")
p=p.replace('v0.10.8','v0.10.9').replace('v0.10.7','v0.10.9')

# Phoenix: revive with 80% max HP and 5s protection.
# Target only tryPhoenix function body.
m=re.search(r"function tryPhoenix\(\)\{.*?return true\}", html)
if not m:
    raise SystemExit('tryPhoenix not found')
old=m.group(0)
new=old
new=new.replace('player.maxLife*.5','player.maxLife*.8')
new=new.replace('performance.now()+2000','performance.now()+5000')
new=new.replace("toast('🔥 FÊNIX · RENASCIMENTO')","toast('🔥 FÊNIX · 80% HP · ESCUDO 5s')")
# Support golden shield variables introduced in v0.10.8, whichever name was used.
new=re.sub(r'(phoenix(?:Shield|Aura|Guard|Protection)Until\s*=\s*performance\.now\(\)\+)2000', r'\g<1>5000', new, flags=re.I)
html=html[:m.start()]+new+html[m.end():]

# Update skill description everywhere in game.
html=html.replace('Skill única: revive 1x com 50% da vida máxima e 2s de invencibilidade.','Skill única: revive 1x com 80% da vida máxima e 5s de proteção dourada.')
html=html.replace('revive 1x com 50% da vida máxima e 2s de invencibilidade','revive 1x com 80% da vida máxima e 5s de proteção dourada')

# Ensure the Phoenix visual lasts 5s if v0.10.8 stored a fixed duration elsewhere.
html=re.sub(r'(phoenix(?:Shield|Aura|Guard|Protection)Until\s*=\s*performance\.now\(\)\+)2000', r'\g<1>5000', html, flags=re.I)

# FPS HUD: permanent dedicated badge in top HUD, controlled by admin/localStorage.
if '.fpsHud{' not in html:
    html=html.replace('.version{display:inline-block;', '.fpsHud{display:inline-block;margin-left:5px;padding:3px 7px;border:1px solid #245f83;border-radius:999px;background:#071827dd;color:#7dd3fc;font-size:8px;font-weight:900;white-space:nowrap;line-height:1;box-shadow:0 0 12px #38bdf833}.version{display:inline-block;',1)

if 'id="fpsHud"' not in html:
    # Put it right beside the visible version badge.
    html=re.sub(r'(<div class="version">v0\.10\.9</div>)', r'\1<div class="fpsHud" id="fpsHud">FPS --</div>', html, count=1)

# Add a robust FPS controller after the existing scripts. It listens to same admin command.
if 'data-caos-fps-hud-v109' not in html:
    fps_script="""<script data-caos-fps-hud-v109>(()=>{'use strict';let on=true,frames=0,last=performance.now(),fps=0;try{on=localStorage.getItem('caos-show-fps')!=='0'}catch{}const el=document.getElementById('fpsHud');function paint(){if(!el)return;el.style.display=on?'inline-block':'none';el.textContent='FPS '+(fps||'--')}function tick(t){frames++;if(t-last>=500){fps=Math.round(frames*1000/(t-last));frames=0;last=t;paint()}requestAnimationFrame(tick)}window.addEventListener('caos:admin-command',e=>{const d=e.detail||{};if(d.command==='fps'){on=!!d.value;try{localStorage.setItem('caos-show-fps',on?'1':'0')}catch{}paint()}});paint();requestAnimationFrame(tick)})();</script>"""
    html=html.replace('</body></html>',fps_script+'</body></html>')

# Panel wording/version; button already exists, keep it.
p=p.replace('PAINEL v0.10.7','PAINEL v0.10.9').replace('Caos Admin v0.10.7','Caos Admin v0.10.9')

idx.write_text(html,encoding='utf-8')
panel.write_text(p,encoding='utf-8')
ver.write_text(json.dumps({
  'version':'0.10.9','label':'v0.10.9','releasedAt':'2026-08-08T15:35:00Z','build':'phoenix-80-fps-hud',
  'notes':['Fênix revive com 80% do HP máximo atual','Fênix concede 5s de proteção dourada','FPS passa a aparecer em badge próprio no HUD','Botão Mostrar FPS do Admin controla o badge do jogo']
},ensure_ascii=False,indent=2),encoding='utf-8')
print('v0.10.9 applied')
