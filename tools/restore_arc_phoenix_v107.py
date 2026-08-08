from pathlib import Path
import re, json

INDEX=Path('index.html'); PANEL=Path('painel.html'); VERSION=Path('version.json')
html=INDEX.read_text(encoding='utf-8'); panel=PANEL.read_text(encoding='utf-8')
html=html.replace('v0.10.6','v0.10.7').replace("const VERSION='0.10.6'","const VERSION='0.10.7'")
panel=panel.replace('v0.10.6','v0.10.7')

# Runtime state
if 'phoenixConsumed=' not in html:
    html=html.replace('phoenixReady=false;const skillLv=', 'phoenixReady=false,phoenixConsumed=false;const skillLv=')
if 'arcNextAt=0' not in html:
    html=html.replace("toastText='',toastUntil=0;", "toastText='',toastUntil=0,arcNextAt=0,arcFx=[],phoenixReady=false,phoenixConsumed=false;")

# Skill level keys
m=re.search(r"const skillLv=\{([^}]*)\};", html)
if m:
    body=m.group(1)
    if 'arc:' not in body: body+=',arc:0'
    if 'phoenix:' not in body: body+=',phoenix:0'
    html=html[:m.start(1)]+body+html[m.end(1):]

# Add skill definitions to current array (rarityLabel is before skills in current build)
if "id:'arc'" not in html or "id:'phoenix'" not in html:
    m=re.search(r"const skills=\[(.*?)\];\n?const soldierSprite=", html, re.S)
    if m:
        skills=m.group(1)
        add=[]
        if "id:'arc'" not in skills:
            add.append("{id:'arc',n:'Arco Voltaico',i:'⚡',r:'epic',desc:l=>{const cd=[0,8,7.5,7,6.5,6][l],targets=[0,2,2,3,3,4][l],dmg=[0,2,3,4,5,6][l];return `Descarga a cada ${String(cd).replace('.',',')}s · até ${targets} alvos · ${dmg} de dano por alvo.`},apply:l=>{arcNextAt=Math.min(arcNextAt||Infinity,performance.now()+500)}}")
        if "id:'phoenix'" not in skills:
            add.append("{id:'phoenix',n:'Fênix',i:'🔥',r:'secret',desc:l=>'Skill única: revive 1x com 50% da vida máxima e 2s de invencibilidade.',apply:l=>{phoenixReady=true;phoenixConsumed=false}}")
        if add:
            skills+=','+','.join(add)
            html=html[:m.start(1)]+skills+html[m.end(1):]

# Fenix only once per run
html=html.replace("const pool=skills.filter(s=>s.id==='phoenix'?skillLv[s.id]<1:skillLv[s.id]<5);", "const pool=skills.filter(s=>s.id==='phoenix'?(!phoenixConsumed&&skillLv[s.id]<1):skillLv[s.id]<5);")
html=html.replace("function tryPhoenix(){if(!phoenixReady)return false;phoenixReady=false;skillLv.phoenix=0;", "function tryPhoenix(){if(!phoenixReady||phoenixConsumed)return false;phoenixReady=false;phoenixConsumed=true;skillLv.phoenix=0;")
html=html.replace('arcNextAt=0;arcFx=[];phoenixReady=false;document.querySelectorAll', 'arcNextAt=0;arcFx=[];phoenixReady=false;phoenixConsumed=false;document.querySelectorAll')

# Ensure admin skill helpers understand Phoenix and Arc
html=html.replace("function adminSkillReset(){for(const k in skillLv)skillLv[k]=0;Object.assign(player,{speed:255,fireRate:.28,xpMult:1,regen:0,flashDamage:0,bloodChance:0,bloodHeal:0,maxLife:100});player.life=Math.min(player.life,player.maxLife)}", "function adminSkillReset(){for(const k in skillLv)skillLv[k]=0;Object.assign(player,{speed:255,fireRate:.28,xpMult:1,regen:0,flashDamage:0,bloodChance:0,bloodHeal:0,maxLife:100});player.life=Math.min(player.life,player.maxLife);arcNextAt=0;arcFx=[];phoenixReady=false;phoenixConsumed=false}")
old="function adminSkillApply(id,lv){lv=Math.max(0,Math.min(5,+lv||0));const sk=skills.find(x=>x.id===id);if(!sk)return false;skillLv[id]=lv;if(id==='medic'){player.maxLife=100+lv*10;player.life=Math.min(player.maxLife,player.life);return true}if(lv>0)sk.apply(lv);else{if(id==='speed')player.speed=255;if(id==='rapid')player.fireRate=.28;if(id==='regen')player.regen=0;if(id==='xp')player.xpMult=1;if(id==='blood'){player.bloodChance=0;player.bloodHeal=0}if(id==='flash')player.flashDamage=0}return true}"
new="function adminSkillApply(id,lv){lv=id==='phoenix'?(+lv>0?1:0):Math.max(0,Math.min(5,+lv||0));const sk=skills.find(x=>x.id===id);if(!sk)return false;skillLv[id]=lv;if(id==='phoenix'){phoenixReady=lv>0;phoenixConsumed=false;return true}if(id==='medic'){player.maxLife=100+lv*10;player.life=Math.min(player.maxLife,player.life);return true}if(lv>0)sk.apply(lv);else{if(id==='speed')player.speed=255;if(id==='rapid')player.fireRate=.28;if(id==='regen')player.regen=0;if(id==='xp')player.xpMult=1;if(id==='blood'){player.bloodChance=0;player.bloodHeal=0}if(id==='flash')player.flashDamage=0;if(id==='arc'){arcNextAt=0;arcFx=[]}}return true}"
html=html.replace(old,new)
html=html.replace("if(c==='skilltest'){const id=String(d.skill||''),lv=Math.max(0,Math.min(5,+d.level||1));if(adminSkillApply(id,lv))toast('🧪 '+id.toUpperCase()+' · LV '+lv)}", "if(c==='skilltest'){const id=String(d.skill||''),lv=id==='phoenix'?1:Math.max(0,Math.min(5,+d.level||1));if(adminSkillApply(id,lv))toast('🧪 '+id.toUpperCase()+' · LV '+lv)}")

# Core functions if missing
if 'function castArc()' not in html:
    core="""function castArc(){const lv=skillLv.arc||0;if(!lv)return;const cds=[0,8,7.5,7,6.5,6],maxTargets=[0,2,2,3,3,4],damage=[0,2,3,4,5,6],now=performance.now();if(now<arcNextAt)return;const first=nearest();if(!first)return;arcNextAt=now+cds[lv]*1000;const hit=[first];while(hit.length<maxTargets[lv]){const last=hit[hit.length-1];let next=null,bd=190;for(const e of enemies){if(e.dead||hit.includes(e))continue;const d=Math.hypot(e.x-last.x,e.y-last.y);if(d<bd){bd=d;next=e}}if(!next)break;hit.push(next)}const pts=[{x:player.x,y:player.y},...hit.map(e=>({x:e.x,y:e.y}))];arcFx.push({pts,until:now+280});for(const e of hit){e.hp-=damage[lv];if(e.hp<=0&&!e.dead){e.dead=true;onKill(e)}}toast('⚡ ARCO VOLTAICO · '+hit.length+' ALVOS')}function tryPhoenix(){if(!phoenixReady||phoenixConsumed)return false;phoenixReady=false;phoenixConsumed=true;skillLv.phoenix=0;player.life=Math.max(1,player.maxLife*.5);player.inv=2;invincibleUntil=performance.now()+2000;for(const e of enemies){if(e.dead)continue;const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy)||1;if(d<190){const push=(190-d)*.8;e.x+=dx/d*push;e.y+=dy/d*push}}toast('🔥 FÊNIX · RENASCIMENTO');return true}function drawArcFx(){const now=performance.now();arcFx=arcFx.filter(f=>f.until>now);for(const f of arcFx){const alpha=Math.max(0,(f.until-now)/280);ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#a5f3fc';ctx.shadowColor='#22d3ee';ctx.shadowBlur=16;ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<f.pts.length;i++){const p=world(f.pts[i].x,f.pts[i].y);if(i===0)ctx.moveTo(p.x,p.y);else{const prev=world(f.pts[i-1].x,f.pts[i-1].y),mx=(prev.x+p.x)/2+(Math.random()-.5)*12,my=(prev.y+p.y)/2+(Math.random()-.5)*12;ctx.lineTo(mx,my);ctx.lineTo(p.x,p.y)}}ctx.stroke();ctx.restore()}}"""
    html=html.replace('function shoot(){',core+'function shoot(){',1)
if 'castArc();shotTimer-=dt' not in html: html=html.replace('shotTimer-=dt;if(shotTimer<=0)','castArc();shotTimer-=dt;if(shotTimer<=0)',1)
if 'drawArcFx();drawPlayer()' not in html: html=html.replace('drawMed();drawPlayer();drawShield();drawFreeze();','drawMed();drawArcFx();drawPlayer();drawShield();drawFreeze();')
html=html.replace("if(player.life<=0){running=false;$('finalText').textContent='Level '+level+' · '+score+' pontos';$('over').classList.add('show')}","if(player.life<=0){if(!tryPhoenix()){running=false;$('finalText').textContent='Level '+level+' · '+score+' pontos';$('over').classList.add('show')}}")

# Panel options — robustly inject right before closing skill select
if 'value="arc"' not in panel or 'value="phoenix"' not in panel:
    m=re.search(r'(<select id="skillTestSelect">)(.*?)(</select>)',panel,re.S)
    if m:
        opts=m.group(2)
        if 'value="arc"' not in opts: opts+='<option value="arc">⚡ Arco Voltaico</option>'
        if 'value="phoenix"' not in opts: opts+='<option value="phoenix">🔥 Fênix · ÚNICA LV1</option>'
        panel=panel[:m.start(2)]+opts+panel[m.end(2):]
panel=panel.replace("const names={speed:'Passos',medic:'Kit',rapid:'Rajada',regen:'Regen',xp:'XP',blood:'Sanguinário',flash:'Flash',arc:'Arco',pact:'Pacto'}", "const names={speed:'Passos',medic:'Kit',rapid:'Rajada',regen:'Regen',xp:'XP',blood:'Sanguinário',flash:'Flash',arc:'Arco',phoenix:'Fênix'}")
# Lock LV selector visually when Fenix selected
needle="if($('skillTestSelect')){$('skillApply').onclick="
if needle in panel and "value==='phoenix'" not in panel:
    panel=panel.replace(needle, "if($('skillTestSelect')){$('skillTestSelect').onchange=()=>{const isPhoenix=$('skillTestSelect').value==='phoenix';$('skillTestLevel').disabled=isPhoenix;if(isPhoenix)$('skillTestLevel').value='1'};$('skillApply').onclick=")
panel=panel.replace('LV5 · secreta permanece LV1','LV5 · Fênix permanece LV1')

INDEX.write_text(html,encoding='utf-8'); PANEL.write_text(panel,encoding='utf-8')
VERSION.write_text(json.dumps({'version':'0.10.7','label':'v0.10.7','releasedAt':'2026-08-08T15:15:00Z','build':'arc-phoenix-restored-final','notes':['Arco Voltaico: LV1 8s/2 alvos/2 dano; LV5 6s/4 alvos/6 dano','Fênix única LV1: revive 1x com 50% HP e 2s invencível','Fênix consumida não volta ao sorteio na mesma partida','Arco e Fênix disponíveis no Teste de Habilidades do Admin']},ensure_ascii=False,indent=2),encoding='utf-8')
print('v0.10.7 final patch applied')
