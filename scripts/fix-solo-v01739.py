from pathlib import Path
import json

GAME = Path('src/game.js')
s = GAME.read_text(encoding='utf-8')

if "const VERSION='0.17.38'" not in s:
    raise SystemExit('expected Solo 0.17.38 base')

s = s.replace("const VERSION='0.17.38'", "const VERSION='0.17.39'", 1)

old_ice = "function applyIceHit(e){const lv=skillLv.ice||0;if(!lv||!e)return;const now=performance.now(),boss=!!types[e.type]?.boss,slow=([0,.12,.18,.24,.30,.35][lv]||0)*(boss?.45:1);e.slowPct=Math.max(e.slowPct||0,slow);e.slowUntil=Math.max(e.slowUntil||0,now+1500);if(lv>=5)e.iceFreezeUntil=Math.max(e.iceFreezeUntil||0,now+(boss?280:800))}"
new_ice = "function applyIceHit(e,allowFreeze=true){const lv=skillLv.ice||0;if(!lv||!e)return;const now=performance.now(),boss=!!types[e.type]?.boss,slow=([0,.12,.18,.24,.30,.35][lv]||0)*(boss?.45:1);e.slowPct=Math.max(e.slowPct||0,slow);e.slowUntil=Math.max(e.slowUntil||0,now+1500);if(lv>=5&&allowFreeze)e.iceFreezeUntil=Math.max(e.iceFreezeUntil||0,now+(boss?280:800))}"
if old_ice not in s:
    raise SystemExit('applyIceHit anchor missing')
s = s.replace(old_ice, new_ice, 1)

old_shoot = "let pierceLeft=0,ice=false,explosive=false;if(xl){explosiveShotCounter++;const every=[0,14,13,12,11,10][xl];if(explosiveShotCounter>=every){explosiveShotCounter=0;explosive=true}}if(!explosive&&il){iceShotCounter++;if(iceShotCounter>=10){iceShotCounter=0;ice=true}}if(!explosive&&!ice&&pl){pierceShotCounter++;const every=[0,12,11,10,9,8][pl];if(pierceShotCounter>=every){pierceShotCounter=0;pierceLeft=[0,2,3,4,5,7][pl]}}bullets.push({x:player.x+m.x,y:player.y+m.y,vx:Math.cos(player.aim)*610,vy:Math.sin(player.aim)*610,r:4,dead:false,ammo:1,born:performance.now(),pierceLeft,hits:[],damage:player.damage*bs.damageMul,ice,explosive});"
new_shoot = "let pierceLeft=0,ice=false,explosive=false;if(xl){explosiveShotCounter++;const every=[0,14,13,12,11,10][xl];if(explosiveShotCounter>=every){explosiveShotCounter=0;explosive=true}}if(!explosive&&il){iceShotCounter++;if(iceShotCounter>=10){iceShotCounter=0;ice=true}}if(!explosive&&pl){pierceShotCounter++;const every=[0,12,11,10,9,8][pl];if(pierceShotCounter>=every){pierceShotCounter=0;pierceLeft=[0,2,3,4,5,7][pl]}}bullets.push({x:player.x+m.x,y:player.y+m.y,vx:Math.cos(player.aim)*610,vy:Math.sin(player.aim)*610,r:4,dead:false,ammo:1,born:performance.now(),pierceLeft,hits:[],iceHits:0,damage:player.damage*bs.damageMul,ice,explosive});"
if old_shoot not in s:
    raise SystemExit('shoot combo anchor missing')
s = s.replace(old_shoot, new_shoot, 1)

old_hit = "if(b.ice)applyIceHit(e);if(b.explosive)explodeAt(e.x,e.y,skillLv.explosive||1,b.owner==='p2'?'p2':'p1',e);"
new_hit = "if(b.ice){applyIceHit(e,(b.iceHits||0)===0);b.iceHits=(b.iceHits||0)+1}if(b.explosive)explodeAt(e.x,e.y,skillLv.explosive||1,b.owner==='p2'?'p2':'p1',e);"
if old_hit not in s:
    raise SystemExit('ice hit resolution anchor missing')
s = s.replace(old_hit, new_hit, 1)

old_desc = "'A cada 10 tiros: congela o 1º alvo por 0,8s; demais recebem lentidão.'"
new_desc = "'A cada 10 tiros: congela o 1º alvo por 0,8s; com Perfurante, os seguintes recebem lentidão.'"
if old_desc in s:
    s = s.replace(old_desc, new_desc, 1)

GAME.write_text(s, encoding='utf-8')

# Synchronized Solo release labels/cache. Online V2 files are intentionally untouched.
for name in ['index.html', 'painel.html', 'duo.html', 'map-lab.html']:
    p = Path(name)
    txt = p.read_text(encoding='utf-8')
    txt = txt.replace('0.17.38', '0.17.39').replace('01738', '01739')
    p.write_text(txt, encoding='utf-8')

vp = Path('version.json')
v = json.loads(vp.read_text(encoding='utf-8'))
v['version'] = '0.17.39'
v['build'] = 'solo-ice-pierce-safe-fix'
vp.write_text(json.dumps(v, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Recovery note points to immutable pre-change commit and backup branches.
docs = Path('docs')
docs.mkdir(exist_ok=True)
Path('docs/RECOVERY.md').write_text('''# Caos Live - Recovery\n\nStable Solo snapshot before v0.17.39:\n\n- Commit: `f4044edd63df062704a305aa632d3204d10227b4`\n- Branch: `backup/solo-v0.17.38-stable`\n- Dated branch: `backup/solo-v0.17.38-pre-fix-2026-08-16`\n\nIf a future Solo release breaks, restore `main` to the stable commit/branch only after verifying the rollback target.\n\nOnline V2 is a separate release channel and is not part of this Solo rollback.\n''', encoding='utf-8')

print('patched Solo 0.17.39: Ice + Pierce interaction and recovery note')
