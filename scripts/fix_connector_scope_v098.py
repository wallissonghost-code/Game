from pathlib import Path

p=Path('cloud/connector-server.mjs')
s=p.read_text(encoding='utf-8')

comment="\n\n // v0.9.5 — comandos de teste de habilidades pelo Admin\n"
start=s.find(comment)
if start<0:
    raise SystemExit('skill command block marker not found')
end=s.find('\n\nfunction patchAdminHtml', start)
if end<0:
    raise SystemExit('patchAdminHtml marker not found')
block=s[start:end].strip('\n')
s=s[:start]+s[end:]

anchor=' rep("drawMed();drawPlayer();drawShield();drawFreeze();", "drawMed();drawArcFx();drawPlayer();drawShield();drawFreeze();");\n return out;\n}'
if anchor not in s:
    raise SystemExit('patchGameHtml return anchor not found')
replacement=' rep("drawMed();drawPlayer();drawShield();drawFreeze();", "drawMed();drawArcFx();drawPlayer();drawShield();drawFreeze();");\n\n '+block.replace('\n','\n ')+'\n return out;\n}'
s=s.replace(anchor,replacement,1)
p.write_text(s,encoding='utf-8')

# bump version
vp=Path('version.json')
vp.write_text('''{\n  "version": "0.9.8",\n  "label": "v0.9.8",\n  "releasedAt": "2026-08-07T19:35:00-03:00",\n  "build": "fix-skill-command-scope",\n  "notes": [\n    "Corrige crash do connector-server na inicialização",\n    "Comandos de teste de habilidades voltam para dentro de patchGameHtml",\n    "Validação de sintaxe adicionada antes do commit"\n  ]\n}\n''',encoding='utf-8')
print('patched connector scope and version 0.9.8')
