from pathlib import Path
p=Path('scripts/check-game.mjs')
s=p.read_text()
old="if(!game.includes('playerV2Ready&&playerArmedReady&&weaponV2Ready')) fail('Host libera arena antes da arma'); else ok('Host espera arma antes de entrar');"
new="if(!game.includes('skinReady=playerArmedReady||playerV2Ready||soldierReady')||!game.includes('gunReady=weaponV2Ready||weaponReady')) fail('Host libera arena sem skin/arma valida'); else ok('Host exige skin e arma com fallback resiliente');"
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('validator target not found')
p.write_text(s)
print('v0.17.30 validator repaired')
