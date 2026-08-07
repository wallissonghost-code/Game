from pathlib import Path
import json

panel = Path('painel.html')
s = panel.read_text(encoding='utf-8')

if 'id="skillTestSelect"' not in s:
    marker = '<h2>PROGRESSÃO</h2><div class="grid">'
    if marker not in s:
        raise SystemExit('painel: marcador PROGRESSÃO não encontrado')
    block = '''<h2>🧪 TESTE DE HABILIDADES</h2><div style="padding:13px;border:1px solid #283052;border-radius:15px;background:#080d19"><p class="hint" style="margin-top:0">Ative habilidades diretamente para testar sem depender do sorteio de level.</p><div class="tools" style="grid-template-columns:1fr 90px"><select id="skillTestSelect"><option value="speed">🥾 Passos de Guerra</option><option value="medic">🩹 Kit Médico</option><option value="rapid">⚡ Rajada Rápida</option><option value="regen">💚 Regeneração</option><option value="xp">✨ Instinto de Caça</option><option value="blood">🩸 Sanguinário</option><option value="flash">☀️ Flash de Luz</option><option value="arc">⚡ Arco Voltaico</option><option value="pact">◈ Pacto do Abismo · SECRETA</option></select><select id="skillTestLevel"><option value="1">LV1</option><option value="2">LV2</option><option value="3">LV3</option><option value="4">LV4</option><option value="5">LV5</option></select></div><div class="grid" style="margin-top:9px"><button id="skillApply" class="purple">ATIVAR SELECIONADA<small>aplica o nível escolhido</small></button><button id="skillAll" class="gold">ATIVAR TODAS<small>todas no LV escolhido</small></button><button id="skillReset" class="danger">RESETAR HABILIDADES<small>volta tudo para LV0</small></button><button id="skillMax" class="good">TODAS NO MÁXIMO<small>LV5 · secreta permanece LV1</small></button></div><div id="skillStateList" class="net" style="margin-top:10px;text-align:left">Skills do jogo: aguardando estado...</div></div>'''
    s = s.replace(marker, block + marker, 1)

# Atualização da lista de skills ativas no estado recebido
needle = "$('autoState').textContent=d.autoMode?'ON':'OFF'"
if "skillStateList')&&d.skillLv" not in s:
    if needle not in s:
        raise SystemExit('painel: marcador autoState não encontrado')
    repl = needle + ";if($('skillStateList')&&d.skillLv){const names={speed:'Passos',medic:'Kit',rapid:'Rajada',regen:'Regen',xp:'XP',blood:'Sanguinário',flash:'Flash',arc:'Arco',pact:'Pacto'};$('skillStateList').textContent='Ativas: '+(Object.entries(d.skillLv).filter(([k,v])=>v>0).map(([k,v])=>(names[k]||k)+' LV'+v).join(' · ')||'nenhuma')}"
    s = s.replace(needle, repl, 1)

# Bind dos botões do teste
speed_marker = "document.querySelectorAll('[data-speed]').forEach"
if "$('skillApply').onclick" not in s:
    if speed_marker not in s:
        raise SystemExit('painel: marcador data-speed não encontrado')
    bind = "if($('skillTestSelect')){$('skillTestSelect').onchange=()=>{$('skillTestLevel').disabled=$('skillTestSelect').value==='pact';if($('skillTestSelect').value==='pact')$('skillTestLevel').value='1'};$('skillApply').onclick=()=>send({command:'skilltest',skill:$('skillTestSelect').value,level:+$('skillTestLevel').value||1},'🧪 Skill '+$('skillTestSelect').selectedOptions[0].textContent+' LV'+$('skillTestLevel').value);$('skillAll').onclick=()=>send({command:'skilltestall',level:+$('skillTestLevel').value||1},'🧪 Todas as skills LV'+$('skillTestLevel').value);$('skillMax').onclick=()=>send({command:'skilltestall',level:5},'🧪 Todas as skills no máximo');$('skillReset').onclick=()=>send({command:'skillreset'},'🧪 Habilidades resetadas')}"
    s = s.replace(speed_marker, bind + speed_marker, 1)

panel.write_text(s, encoding='utf-8')

server = Path('cloud/connector-server.mjs')
c = server.read_text(encoding='utf-8')
# Impede a injeção duplicada quando o painel base já contém o teste nativo.
old = " // v0.9.5 — Teste de Habilidades\n rep('<h2>PROGRESSÃO</h2><div class=\"grid\">','<h2>🧪 TESTE DE HABILIDADES</h2>"
if old in c:
    c = c.replace(old, " // v0.9.6 — Teste de Habilidades agora é nativo no painel.html\n if(!out.includes('id=\"skillTestSelect\"')) rep('<h2>PROGRESSÃO</h2><div class=\"grid\">','<h2>🧪 TESTE DE HABILIDADES</h2>", 1)
else:
    # Ajuste simples na chamada real, preservando o restante da string longa.
    target = " rep('<h2>PROGRESSÃO</h2><div class=\"grid\">','<h2>🧪 TESTE DE HABILIDADES</h2>"
    if target in c:
        c = c.replace(target, " if(!out.includes('id=\"skillTestSelect\"')) rep('<h2>PROGRESSÃO</h2><div class=\"grid\">','<h2>🧪 TESTE DE HABILIDADES</h2>", 1)

server.write_text(c, encoding='utf-8')

vpath = Path('version.json')
v = json.loads(vpath.read_text(encoding='utf-8'))
v.update({
    'version':'0.9.6',
    'label':'v0.9.6',
    'releasedAt':'2026-08-07T19:15:00-03:00',
    'build':'native-admin-skill-test',
    'notes':[
        'Teste de Habilidades agora é nativo no painel Admin',
        'Não depende mais da injeção dinâmica para aparecer',
        'Mantém seleção de skill, LV1-LV5, todas, máximo e reset',
        'Pacto do Abismo continua limitado ao LV1'
    ]
})
vpath.write_text(json.dumps(v, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('ok: painel nativo de teste de habilidades v0.9.6')
