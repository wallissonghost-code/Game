from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
repls={
"const VERSION='0.8.2'":"const VERSION='0.8.3'",
"<title>Caos Live v0.8.2</title>":"<title>Caos Live v0.8.3</title>",
"VERSÃO v0.8.2 · CEIFADOR 2/6":"VERSÃO v0.8.3 · ESCALA MOBS",
"sz=e.r*4.5":"sz=e.r*3.5",
"sz=e.r*4.7":"sz=e.r*3.0",
"soldierSprite.src='./assets/soldier-premium-01.png?v=081'":"soldierSprite.src='./assets/soldier-premium-01.png?v=083'",
"wraithSprite.src='./assets/enemies/espectro.svg?v=081'":"wraithSprite.src='./assets/enemies/espectro.svg?v=083'",
"reaperSprite.src='./assets/enemies/ceifador.svg?v=082'":"reaperSprite.src='./assets/enemies/ceifador.svg?v=083'",
}
for a,b in repls.items():
    if a not in s:
        print('WARN missing:',a)
    s=s.replace(a,b)
p.write_text(s,encoding='utf-8')

v=Path('version.json')
if v.exists():
    import json
    d=json.loads(v.read_text(encoding='utf-8'))
    d.update({'version':'0.8.3','label':'v0.8.3','build':'enemy-sprite-scale-fix'})
    d['notes']=['Espectro reduzido para escala proporcional ao jogador','Ceifador reduzido para escala proporcional ao jogador','Apenas escala visual alterada; atributos e hitboxes preservados']
    v.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
