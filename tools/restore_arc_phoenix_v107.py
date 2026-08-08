from pathlib import Path
import re, json

INDEX=Path('index.html')
PANEL=Path('painel.html')
VERSION=Path('version.json')

html=INDEX.read_text(encoding='utf-8')
panel=PANEL.read_text(encoding='utf-8')

# Version
html=html.replace('v0.10.6','v0.10.7').replace("const VERSION='0.10.6'","const VERSION='0.10.7'")
panel=panel.replace('v0.10.6','v0.10.7')

# State vars
if 'arcNextAt=0' not in html:
    html=html.replace("toastText='',toastUntil=0;", "toastText='',toastUntil=0,arcNextAt=0,arcFx=[],phoenixReady=false;")

# skillLv keys
m=re.search(r"const skillLv=\{([^}]*)\};", html)
if m:
    body=m.group(1)
    if 'arc:' not in body: body += ',arc:0'
    if 'phoenix:' not in body: body += ',phoenix:0'
    html=html[:m.start(1)] + body + html[m.end(1):]

# Add skills to skills array
m=re.search(r"const skills=\[(.*?)\];const rarityLabel=", html, re.S)
if m:
    skills=m.group(1)
    additions=[]
    if "id:'arc'" not in skills:
        additions.append("{id:'arc',n:'Arco Voltaico',i:'⚡',r:'epic',desc:l=>{const cd=[0,8,7.5,7,6.5,6][l],targets=[0,2,2,3,3,4][l],dmg=[0,2,3,4,5,6][l];return `Descarga a cada ${cd}s · até ${targets} alvos · ${dmg} de dano por alvo.`},apply:l=>{arcNextAt=Math.min(arcNextAt||Infinity,performance.now()+500)}}")
    if "id:'phoenix'" not in skills:
        additions.append("{id:'phoenix',n:'Fênix',i:'🔥',r:'secret',desc:l=>'Revive uma única vez com 50% da vida máxima e 2s de invencibilidade.',apply:l=>{phoenixReady=true}}")
    if additions:
        skills += ',' + ','.join(additions)
        html=html[:m.start(1)] + skills + html[m.end(1):]

# Secret rarity support
html=html.replace("legendary:'LENDÁRIA'}", "legendary:'LENDÁRIA',secret:'SECRETA'}")
html=html.replace("legendary:3};", "legendary:3,secret:.35};")
if '.secret{' not in html:
    html=html.replace('.legendary{border-color:#f59e0b;box-shadow:inset 0 0 34px #f59e0b20}', '.legendary{border-color:#f59e0b;box-shadow:inset 0 0 34px #f59e0b20}.secret{border-color:#f8fafc;box-shadow:inset 0 0 36px #8b5cf655,0 0 22px #c4b5fd33;background:linear-gradient(145deg,#21143a,#090b16)!important}.secret em{background:#ffffff18;color:#f5f3ff}')

# Fenix only LV1 in level-up pool
html=html.replace("const pool=skills.filter(s=>skillLv[s.id]<5);", "const pool=skills.filter(s=>s.id==='phoenix'?skillLv[s.id]<1:skillLv[s.id]<5);")

# Reset skill runtime state
if 'phoenixReady=false' in html:
    html=html.replace("nextMedDropAt=performance.now()+180000;document.querySelectorAll", "nextMedDropAt=performance.now()+180000;arcNextAt=0;arcFx=[];phoenixReady=false;document.querySelectorAll")

# Core functions
if 'function castArc()' not in html:
    core="""function castArc(){const lv=skillLv.arc||0;if(!lv)return;const cds=[0,8,7.5,7,6.5,6],maxTargets=[0,2,2,3,3,4],damage=[0,2,3,4,5,6],now=performance.now();if(now<arcNextAt)return;const first=nearest();if(!first)return;arcNextAt=now+cds[lv]*1000;const hit=[first];while(hit.length<maxTargets[lv]){const last=hit[hit.length-1];let next=null,bd=190;for(const e of enemies){if(e.dead||hit.includes(e))continue;const d=Math.hypot(e.x-last.x,e.y-last.y);if(d<bd){bd=d;next=e}}if(!next)break;hit.push(next)}const pts=[{x:player.x,y:player.y},...hit.map(e=>({x:e.x,y:e.y}))];arcFx.push({pts,until:now+280});for(const e of hit){e.hp-=damage[lv];if(e.hp<=0&&!e.dead){e.dead=true;onKill(e)}}toast('⚡ ARCO VOLTAICO · '+hit.length+' ALVOS')}function tryPhoenix(){if(!phoenixReady)return false;phoenixReady=false;skillLv.phoenix=0;player.life=Math.max(1,player.maxLife*.5);player.inv=2;invincibleUntil=performance.now()+2000;for(const e of enemies){if(e.dead)continue;const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy)||1;if(d<190){const push=(190-d)*.8;e.x+=dx/d*push;e.y+=dy/d*push}}toast('🔥 FÊNIX · RENASCIMENTO');return true}function drawArcFx(){const now=performance.now();arcFx=arcFx.filter(f=>f.until>now);for(const f of arcFx){const alpha=Math.max(0,(f.until-now)/280);ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#a5f3fc';ctx.shadowColor='#22d3ee';ctx.shadowBlur=16;ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<f.pts.length;i++){const p=world(f.pts[i].x,f.pts[i].y);if(i===0)ctx.moveTo(p.x,p.y);else{const prev=world(f.pts[i-1].x,f.pts[i-1].y),mx=(prev.x+p.x)/2+(Math.random()-.5)*12,my=(prev.y+p.y)/2+(Math.random()-.5)*12;ctx.lineTo(mx,my);ctx.lineTo(p.x,p.y)}}ctx.stroke();ctx.restore()}}"""
    html=html.replace('function shoot(){', core+'function shoot(){',1)

# Tick, death and draw hooks
if 'castArc();shotTimer-=dt' not in html:
    html=html.replace('shotTimer-=dt;if(shotTimer<=0)', 'castArc();shotTimer-=dt;if(shotTimer<=0)',1)
html=html.replace("if(player.life<=0){running=false;$('finalText').textContent='Level '+level+' · '+score+' pontos';$('over').classList.add('show')}", "if(player.life<=0){if(!tryPhoenix()){running=false;$('finalText').textContent='Level '+level+' · '+score+' pontos';$('over').classList.add('show')}}")
if 'drawArcFx();drawPlayer()' not in html:
    html=html.replace('drawMed();drawPlayer();drawShield();drawFreeze();','drawMed();drawArcFx();drawPlayer();drawShield();drawFreeze();')

# Admin command support. Inject before ping/restart section if current handlers exist.
anchor="if(c==='ping')broadcast();if(c==='restart')reset();ui();broadcast()"
if anchor in html and "c==='skilltest'" not in html:
    handlers="""if(c==='skilltest'){const id=String(d.skill||''),sk=skills.find(x=>x.id===id);if(sk){const lv=id==='phoenix'?1:Math.max(1,Math.min(5,+d.level||1));skillLv[id]=lv;if(id==='phoenix')phoenixReady=true;else sk.apply(lv);toast('🧪 '+sk.n.toUpperCase()+' · LV '+lv)}}if(c==='skilltestall'){const lv=Math.max(1,Math.min(5,+d.level||5));for(const sk of skills){const sl=sk.id==='phoenix'?1:lv;skillLv[sk.id]=sl;if(sk.id==='phoenix')phoenixReady=true;else sk.apply(sl)}toast('🧪 TODAS AS HABILIDADES ATIVADAS')}if(c==='skillreset'){for(const k in skillLv)skillLv[k]=0;Object.assign(player,{speed:255,fireRate:.28,xpMult:1,regen:0,flashDamage:0,bloodChance:0,bloodHeal:0});arcNextAt=0;arcFx=[];phoenixReady=false;toast('🧪 HABILIDADES RESETADAS')}if(c==='skillmax'){for(const sk of skills){const sl=sk.id==='phoenix'?1:5;skillLv[sk.id]=sl;if(sk.id==='phoenix')phoenixReady=true;else sk.apply(sl)}toast('🧪 HABILIDADES NO MÁXIMO')}"""
    html=html.replace(anchor, handlers+anchor)

# Panel: restore test options
if 'Arco Voltaico' not in panel:
    panel=panel.replace("<option value=\"flash\">☀️ Flash de Luz</option>", "<option value=\"flash\">☀️ Flash de Luz</option><option value=\"arc\">⚡ Arco Voltaico</option><option value=\"phoenix\">🔥 Fênix · ÚNICA</option>")
# If arc exists but phoenix does not
if 'value="arc"' in panel and 'value="phoenix"' not in panel:
    panel=panel.replace("<option value=\"arc\">⚡ Arco Voltaico</option>", "<option value=\"arc\">⚡ Arco Voltaico</option><option value=\"phoenix\">🔥 Fênix · ÚNICA</option>")

# Panel test logic: Fenix locks LV1
panel=panel.replace("$('skillTestSelect').value==='pact'", "$('skillTestSelect').value==='phoenix'")
panel=panel.replace("id==='pact'?1", "id==='phoenix'?1")
panel=panel.replace("secreta permanece LV1", "Fênix permanece LV1")

INDEX.write_text(html,encoding='utf-8')
PANEL.write_text(panel,encoding='utf-8')
VERSION.write_text(json.dumps({
  'version':'0.10.7','label':'v0.10.7','releasedAt':'2026-08-08T15:05:00Z','build':'arc-phoenix-restored',
  'notes':['Restaura Arco Voltaico balanceado em 5 níveis','Restaura Fênix como skill única LV1','Fênix revive 1x com 50% HP e 2s de invencibilidade','Adiciona Arco e Fênix ao Teste de Habilidades do Admin']
},ensure_ascii=False,indent=2),encoding='utf-8')

print('v0.10.7 patch applied')
