from pathlib import Path
p=Path('scripts/check-game.mjs')
s=p.read_text()
marker='// v0.17.27 · full visual parity in Duo'
pos=s.find(marker)
if pos<0:
    raise SystemExit('v0.17.27 validation marker not found')
head=s[:pos]
tail=s[pos:]
tail=tail.replace("const duoHtml=read('duo.html'),duoJs=read('src/duo.js');","const duoHtmlV27=read('duo.html'),duoJsV27=read('src/duo.js');",1)
tail=tail.replace('duoHtml.includes(', 'duoHtmlV27.includes(')
tail=tail.replace('duoJs.includes(', 'duoJsV27.includes(')
p.write_text(head+tail)
