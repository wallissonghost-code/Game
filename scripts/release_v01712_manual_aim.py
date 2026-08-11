from pathlib import Path
import json,re

V='0.17.12'
TAG=V.replace('.','')

def read(p): return Path(p).read_text(encoding='utf-8')
def write(p,s): Path(p).write_text(s,encoding='utf-8')

# Single source of truth
write('version.json',json.dumps({'version':V,'build':'optional-manual-aim-gameplay'},ensure_ascii=False,indent=2)+'\n')

# ---------------- GAME ----------------
p='src/game.js'; s=read(p)
s,n=re.subn(r"const VERSION='\d+\.\d+\.\d+'",f"const VERSION='{V}'",s,count=1)
assert n==1,'game VERSION not found'

old='autoFire=true,runStartedAt=0'
assert old in s,'autoFire state marker missing'
s=s.replace(old,'autoFire=true,manualAimByMovement=false,runStartedAt=0',1)

# In optional manual mode, shooting uses the current player aim and does not retarget behind the player.
old="function shoot(){const t=autoMode?focusedTarget():nearestVisible();if(!t)return;player.aim=Math.atan2(t.y-player.y,t.x-player.x);player.shotFlash=.1;"
new="function shoot(){const manual=manualAimByMovement&&!autoMode;if(!manual){const t=autoMode?focusedTarget():nearestVisible();if(!t)return;player.aim=Math.atan2(t.y-player.y,t.x-player.x)}player.shotFlash=.1;"
assert old in s,'shoot target marker missing'
s=s.replace(old,new,1)

old="if(autoFire){const target=autoMode?focusedTarget():nearestVisible();if(target){const wanted=Math.atan2(target.y-player.y,target.x-player.x);let da=((wanted-player.aim+Math.PI*3)%(Math.PI*2))-Math.PI;player.aim+=da*Math.min(1,dt*7)}}else if(player.moving){const wanted=Math.atan2(dy,dx);let da=((wanted-player.aim+Math.PI*3)%(Math.PI*2))-Math.PI;player.aim+=da*Math.min(1,dt*5)}"
new="if(manualAimByMovement&&!autoMode){if(player.moving)player.aim=Math.atan2(player.moveY,player.moveX)}else if(autoFire){const target=autoMode?focusedTarget():nearestVisible();if(target){const wanted=Math.atan2(target.y-player.y,target.x-player.x);let da=((wanted-player.aim+Math.PI*3)%(Math.PI*2))-Math.PI;player.aim+=da*Math.min(1,dt*7)}}else if(player.moving){const wanted=Math.atan2(dy,dx);let da=((wanted-player.aim+Math.PI*3)%(Math.PI*2))-Math.PI;player.aim+=da*Math.min(1,dt*5)}"
assert old in s,'aim update marker missing'
s=s.replace(old,new,1)

old="if(c==='autofire'){autoFire=!!d.value;player.shotFlash=0;shotTimer=.05;toast('🔫 TIRO AUTOMÁTICO '+(autoFire?'ON':'OFF'))}"
new=old+"if(c==='manualaim'){manualAimByMovement=!!d.value;clearAutoTarget();toast('🎯 MIRA PELO MOVIMENTO '+(manualAimByMovement?'ON':'OFF'))}"
assert old in s,'autofire command marker missing'
s=s.replace(old,new,1)

old='autofire:autoFire,wave:waveCount'
assert old in s,'state autofire marker missing'
s=s.replace(old,'autofire:autoFire,manualAim:manualAimByMovement,wave:waveCount',1)

# Refresh asset cache tags used by this release.
s=re.sub(r"cacheTag='\d+'",f"cacheTag='{TAG}'",s)
s=re.sub(r"\?v=\d+'",f"?v={TAG}'",s)
s=re.sub(r"'\d+'\);",lambda m:m.group(0),s)
write(p,s)

# ---------------- GAME HTML ----------------
p='index.html'; s=read(p)
s=re.sub(r'<title>Caos Live v\d+\.\d+\.\d+</title>',f'<title>Caos Live v{V}</title>',s)
s=re.sub(r'v\d+\.\d+\.\d+ · SINCRONIZADO',f'v{V} · SINCRONIZADO',s)
s=re.sub(r'<span class="startVersion" id="startVersion">v\d+\.\d+\.\d+</span>',f'<span class="startVersion" id="startVersion">v{V}</span>',s)
s=re.sub(r'src="src/game\.js\?v=\d+"',f'src="src/game.js?v={TAG}"',s)
write(p,s)

# ---------------- PANEL HTML ----------------
p='painel.html'; s=read(p)
s=re.sub(r'<title>Caos Admin v\d+\.\d+\.\d+</title>',f'<title>Caos Admin v{V}</title>',s)
s=re.sub(r'<span id="panelVersion" class="topVersion">v\d+\.\d+\.\d+</span>',f'<span id="panelVersion" class="topVersion">v{V}</span>',s)
s=re.sub(r'src/styles/panel\.css\?v=\d+',f'src/styles/panel.css?v={TAG}',s)
s=re.sub(r'src/panel\.js\?v=\d+',f'src/panel.js?v={TAG}',s)
s=re.sub(r'index\.html\?v=\d+',f'index.html?v={TAG}',s)

manual_btn='''\n      <button id="manualAimModeToggle" class="modeToggle" type="button" data-on="false"><span class="modeInfo"><span class="modeIcon">🎯</span><span><b>MIRA PELO MOVIMENTO</b><small>OFF = clássico · ON = movimento define mira e tiro</small></span></span><span class="modeRight"><span class="modeBadge">OFF</span><span class="toggleTrack"><span class="toggleKnob"></span></span></span></button>'''
if 'id="manualAimModeToggle"' not in s:
    marker='      <button id="fpsModeToggle"'
    assert marker in s,'fps toggle marker missing'
    s=s.replace(marker,manual_btn+'\n'+marker,1)
write(p,s)

# ---------------- PANEL JS ----------------
p='src/panel.js'; s=read(p)
# Telemetry keeps the panel toggle synchronized with the game state.
marker="const aft=$('autoFireModeToggle');if(aft&&typeof d.autofire==='boolean'){aft.dataset.on=d.autofire?'true':'false';aft.classList.toggle('isOn',!!d.autofire);const ab=aft.querySelector('.modeBadge');if(ab)ab.textContent=d.autofire?'ON':'OFF'};"
assert marker in s,'autofire telemetry marker missing'
addition=marker+"const mat=$('manualAimModeToggle');if(mat&&typeof d.manualAim==='boolean'){mat.dataset.on=d.manualAim?'true':'false';mat.classList.toggle('isOn',!!d.manualAim);const mb=mat.querySelector('.modeBadge');if(mb)mb.textContent=d.manualAim?'ON':'OFF'};"
s=s.replace(marker,addition,1)

marker="if($('autoFireModeToggle'))$('autoFireModeToggle').onclick=()=>{const next=$('autoFireModeToggle').dataset.on!=='true';send({command:'autofire',value:next},'🔫 Tiro Automático '+(next?'ON':'OFF'))};"
assert marker in s,'autofire panel handler missing'
s=s.replace(marker,marker+"if($('manualAimModeToggle'))$('manualAimModeToggle').onclick=()=>{const next=$('manualAimModeToggle').dataset.on!=='true';send({command:'manualaim',value:next},'🎯 Mira pelo Movimento '+(next?'ON':'OFF'))};",1)
write(p,s)

# ---------------- PANEL CSS ----------------
p='src/styles/panel.css'; s=read(p)
s=s.replace('.modeGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));', '.modeGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));',1)
write(p,s)

# ---------------- VALIDATOR ----------------
p='scripts/check-game.mjs'; s=read(p)
checks="""
if(!game.includes('manualAimByMovement=false')) fail('estado opcional Mira pelo Movimento ausente'); else ok('Mira pelo Movimento OFF por padrao');
if(!game.includes("if(c==='manualaim')")) fail('comando manualaim ausente'); else ok('comando manualaim');
if(!game.includes('manualAim:manualAimByMovement')) fail('telemetria manualAim ausente'); else ok('telemetria manualAim');
if(!game.includes('if(manualAimByMovement&&!autoMode){if(player.moving)player.aim=Math.atan2(player.moveY,player.moveX)}')) fail('movimento nao controla mira no modo extra'); else ok('movimento controla mira no modo extra');
if(!game.includes('const manual=manualAimByMovement&&!autoMode')) fail('tiro ainda pode retargetar no modo extra'); else ok('tiro respeita mira manual');
if(!panelHtml.includes('id="manualAimModeToggle"')) fail('toggle Mira pelo Movimento ausente no Admin'); else ok('toggle Mira pelo Movimento no Admin');
if(!panel.includes("command:'manualaim'")) fail('painel nao envia manualaim'); else ok('painel envia manualaim');
if(!panel.includes("typeof d.manualAim==='boolean'")) fail('painel nao sincroniza manualAim'); else ok('painel sincroniza manualAim');
"""
if 'Mira pelo Movimento OFF por padrao' not in s:
    idx=s.rfind("if(process.exitCode) process.exit(process.exitCode);")
    assert idx!=-1,'validator tail missing'
    s=s[:idx]+checks+'\n'+s[idx:]
write(p,s)
