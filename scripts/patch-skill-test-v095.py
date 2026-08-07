from pathlib import Path
import json

p=Path('cloud/connector-server.mjs')
s=p.read_text()

# GAME: admin commands to set/reset skills directly
needle=" rep(\"autoMode,hordeEnabled,horde:hordeNumber,hordeTarget,hordeKilled,hordeSpawned,hordeBaseAlive:enemies.filter(e=>e.source==='horde').length,liveExtraMobs:enemies.filter(e=>e.source!=='horde').length,skillLv:{...skillLv},room,ts:Date.now()\","
if needle not in s:
    raise SystemExit('state marker missing')

insert="""
 // v0.9.5 — comandos de teste de habilidades pelo Admin
 rep("if(c==='ping')broadcast();if(c==='restart')reset();ui();broadcast()", "if(c==='skilltest'){const id=String(d.skill||''),lv=Math.max(0,Math.min(id==='pact'?1:5,+d.level||1)),sk=skills.find(x=>x.id===id);if(sk){skillLv[id]=lv;if(id==='pact'){pactReady=lv>0}else if(lv>0)sk.apply(lv);else if(id==='arc'){arcNextAt=0}toast('🧪 '+sk.n.toUpperCase()+' · LV '+lv)}}if(c==='skilltestall'){for(const sk of skills){const lv=sk.id==='pact'?1:Math.max(1,Math.min(5,+d.level||5));skillLv[sk.id]=lv;if(sk.id==='pact')pactReady=true;else sk.apply(lv)}toast('🧪 TODAS AS HABILIDADES ATIVADAS')}if(c==='skillreset'){for(const k in skillLv)skillLv[k]=0;Object.assign(player,{speed:255,fireRate:.28,xpMult:1,regen:0,flashDamage:0,bloodChance:0,bloodHeal:0});pactReady=false;arcNextAt=0;toast('🧪 HABILIDADES RESETADAS')}if(c==='ping')broadcast();if(c==='restart')reset();ui();broadcast()");
"""
# place before admin patch function
marker="function patchAdminHtml(html){const v=currentVersion();let out=patchSharedVersion(html);const rep=(a,b)=>{if(out.includes(a))out=out.replace(a,b)};"
if marker not in s:
    raise SystemExit('admin marker missing')
s=s.replace(marker,insert+"\n"+marker,1)

# ADMIN UI block
admin_insert="""
 // v0.9.5 — Teste de Habilidades
 rep('<h2>PROGRESSÃO</h2><div class="grid">','<h2>🧪 TESTE DE HABILIDADES</h2><div style="padding:13px;border:1px solid #283052;border-radius:15px;background:#080d19"><p class="hint" style="margin-top:0">Ative habilidades diretamente para testar sem depender do sorteio de level.</p><div class="tools" style="grid-template-columns:1fr 90px"><select id="skillTestSelect"><option value="speed">🥾 Passos de Guerra</option><option value="medic">🩹 Kit Médico</option><option value="rapid">⚡ Rajada Rápida</option><option value="regen">💚 Regeneração</option><option value="xp">✨ Instinto de Caça</option><option value="blood">🩸 Sanguinário</option><option value="flash">☀️ Flash de Luz</option><option value="arc">⚡ Arco Voltaico</option><option value="pact">◈ Pacto do Abismo · SECRETA</option></select><select id="skillTestLevel"><option value="1">LV1</option><option value="2">LV2</option><option value="3">LV3</option><option value="4">LV4</option><option value="5">LV5</option></select></div><div class="grid" style="margin-top:9px"><button id="skillApply" class="purple">ATIVAR SELECIONADA<small>aplica o nível escolhido</small></button><button id="skillAll" class="gold">ATIVAR TODAS<small>todas no LV escolhido</small></button><button id="skillReset" class="danger">RESETAR HABILIDADES<small>volta tudo para LV0</small></button><button id="skillMax" class="good">TODAS NO MÁXIMO<small>LV5 · secreta permanece LV1</small></button></div><div id="skillStateList" class="net" style="margin-top:10px;text-align:left">Skills do jogo: aguardando estado...</div></div><h2>PROGRESSÃO</h2><div class="grid">');
 rep("$('autoState').textContent=d.autoMode?'ON':'OFF'", "$('autoState').textContent=d.autoMode?'ON':'OFF';if($('skillStateList')&&d.skillLv){const names={speed:'Passos',medic:'Kit',rapid:'Rajada',regen:'Regen',xp:'XP',blood:'Sanguinário',flash:'Flash',arc:'Arco',pact:'Pacto'};$('skillStateList').textContent='Ativas: '+Object.entries(d.skillLv).filter(([k,v])=>v>0).map(([k,v])=>(names[k]||k)+' LV'+v).join(' · ')||'nenhuma'}");
 rep("document.querySelectorAll('[data-speed]').forEach", "if($('skillTestSelect')){$('skillTestSelect').onchange=()=>{$('skillTestLevel').disabled=$('skillTestSelect').value==='pact';if($('skillTestSelect').value==='pact')$('skillTestLevel').value='1'};$('skillApply').onclick=()=>send({command:'skilltest',skill:$('skillTestSelect').value,level:+$('skillTestLevel').value||1},'🧪 Skill '+$('skillTestSelect').selectedOptions[0].textContent+' LV'+$('skillTestLevel').value);$('skillAll').onclick=()=>send({command:'skilltestall',level:+$('skillTestLevel').value||1},'🧪 Todas as skills LV'+$('skillTestLevel').value);$('skillMax').onclick=()=>send({command:'skilltestall',level:5},'🧪 Todas as skills no máximo');$('skillReset').onclick=()=>send({command:'skillreset'},'🧪 Habilidades resetadas')}document.querySelectorAll('[data-speed]').forEach");
"""
# put right after admin function opening
s=s.replace(marker,marker+admin_insert,1)
p.write_text(s)

v={
  'version':'0.9.5','label':'v0.9.5','releasedAt':'2026-08-07T16:40:00-03:00','build':'admin-skill-test-console',
  'notes':['Admin ganhou Teste de Habilidades','Seleciona skill e LV1-LV5','Ativar todas ou todas no máximo','Pacto do Abismo limitado a LV1','Painel mostra skills ativas em tempo real']
}
Path('version.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
