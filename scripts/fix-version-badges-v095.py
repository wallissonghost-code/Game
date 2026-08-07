from pathlib import Path

p=Path('cloud/connector-server.mjs')
s=p.read_text()
old="function patchSharedVersion(html){const v=currentVersion();return html.replace(/Caos Live v\\d+\\.\\d+\\.\\d+/g,`Caos Live v${v}`).replace(/Caos Admin v\\d+\\.\\d+\\.\\d+/g,`Caos Admin v${v}`).replace(/VERSÃO v\\d+\\.\\d+\\.\\d+/g,`VERSÃO v${v}`).replace(/PAINEL v\\d+\\.\\d+\\.\\d+/g,`PAINEL v${v}`).replace(/const VERSION='\\d+\\.\\d+\\.\\d+'/g,`const VERSION='${v}'`)}"
new="function patchSharedVersion(html){const v=currentVersion();return html.replace(/Caos Live v\\d+\\.\\d+\\.\\d+/g,`Caos Live v${v}`).replace(/Caos Admin v\\d+\\.\\d+\\.\\d+/g,`Caos Admin v${v}`).replace(/VERSÃO v\\d+\\.\\d+\\.\\d+/g,`VERSÃO v${v}`).replace(/PAINEL v\\d+\\.\\d+\\.\\d+/g,`PAINEL v${v}`).replace(/(<div class=\\\"version\\\">)v\\d+\\.\\d+\\.\\d+/g,`$1v${v}`).replace(/(<div class=\\\"version\\\">PAINEL )v\\d+\\.\\d+\\.\\d+/g,`$1v${v}`).replace(/const VERSION='\\d+\\.\\d+\\.\\d+'/g,`const VERSION='${v}'`)}"
if old not in s:
    raise SystemExit('patchSharedVersion marker not found')
s=s.replace(old,new,1)
p.write_text(s)

# Keep base HTML badges aligned too, so even static/direct file opens are not misleading.
for fn in ['index.html','painel.html']:
    q=Path(fn)
    t=q.read_text()
    import re
    if fn=='index.html':
        t=re.sub(r'(<div class="version">)v\d+\.\d+\.\d+', r'\1v0.9.5', t)
        t=re.sub(r"const VERSION='\d+\.\d+\.\d+'", "const VERSION='0.9.5'", t)
        t=re.sub(r'<title>Caos Live v\d+\.\d+\.\d+</title>', '<title>Caos Live v0.9.5</title>', t)
    else:
        t=re.sub(r'(<div class="version">PAINEL )v\d+\.\d+\.\d+', r'\1v0.9.5', t)
        t=re.sub(r'<title>Caos Admin v\d+\.\d+\.\d+</title>', '<title>Caos Admin v0.9.5</title>', t)
    q.write_text(t)
print('version badges aligned to v0.9.5')
