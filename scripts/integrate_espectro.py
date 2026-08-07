from pathlib import Path
import json

p = Path('index.html')
s = p.read_text(encoding='utf-8')

s = s.replace('<title>Caos Live v0.8.0</title>', '<title>Caos Live v0.8.1</title>')
s = s.replace('VERSÃO v0.8.0 · MOBS PREMIUM', 'VERSÃO v0.8.1 · ESPECTRO 1/6')
s = s.replace("const VERSION='0.8.0'", "const VERSION='0.8.1'")

anchor = "const soldierSprite=new Image();let soldierReady=false;soldierSprite.onload=()=>soldierReady=true;soldierSprite.src='./assets/soldier-premium-01.png?v=080';"
addon = "const soldierSprite=new Image();let soldierReady=false;soldierSprite.onload=()=>soldierReady=true;soldierSprite.src='./assets/soldier-premium-01.png?v=081';\nconst wraithSprite=new Image();let wraithReady=false;wraithSprite.onload=()=>wraithReady=true;wraithSprite.onerror=()=>wraithReady=false;wraithSprite.src='./assets/enemies/espectro.svg?v=081';"
if 'const wraithSprite=new Image()' not in s:
    if anchor not in s:
        raise SystemExit('soldier anchor not found')
    s = s.replace(anchor, addon)

old = "if(e.type==='wraith')drawWraith(e);else if(e.type==='reaper')drawReaper(e);"
new = "if(e.type==='wraith'&&wraithReady){const bob=Math.sin(e.t*5+e.seed)*2,sz=e.r*4.5;ctx.save();ctx.globalAlpha=.96;if(e.tier===2)ctx.filter='saturate(1.35) hue-rotate(285deg) brightness(1.05)';else if(e.tier===1)ctx.filter='saturate(1.25) brightness(1.15)';ctx.drawImage(wraithSprite,-sz/2,-sz*.56+bob,sz,sz);ctx.restore()}else if(e.type==='wraith')drawWraith(e);else if(e.type==='reaper')drawReaper(e);"
if old in s:
    s = s.replace(old, new)
elif "e.type==='wraith'&&wraithReady" not in s:
    raise SystemExit('wraith renderer anchor not found')

p.write_text(s, encoding='utf-8')

v = Path('version.json')
data = json.loads(v.read_text(encoding='utf-8'))
data['version'] = '0.8.1'
data['label'] = 'v0.8.1'
data['releasedAt'] = '2026-08-07T13:05:00Z'
data['build'] = 'espectro-family-1-of-6'
data['notes'] = [
    'Espectro agora usa skin própria premium',
    'Flutuação animada durante perseguição',
    'Elite e Corrompido preservam suas auras e tratamento visual',
    'Fallback Canvas impede inimigo invisível se o asset falhar',
    'Primeira das seis famílias convertida para skin dedicada'
]
v.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

bad = Path('assets/enemies/espectro-move-strip.png.b64')
if bad.exists():
    bad.unlink()
