from pathlib import Path
import json

p=Path('src/game.js')
g=p.read_text()

# 1) Add tolerant sequence loader before mapDirect32.
marker='function mapDirect32(arr,target)'
if 'async function loadPngSequenceSafe(' not in g:
    idx=g.index(marker)
    helper="""async function loadPngSequenceSafe(folder,count,namer,crop=false,cacheTag=ASSET_TAG){const raw=await Promise.all(Array.from({length:count},(_,k)=>{const i=k+1,src=`${folder}/${namer(i)}?v=${cacheTag}`;return new Promise(resolve=>{const img=new Image();img.onload=async()=>{try{resolve(crop?await cropAlphaFrame(img):img)}catch{resolve(img)}};img.onerror=()=>{console.warn('ASSET FRAME FALHOU',src);resolve(null)};img.src=src})}));const valid=raw.filter(Boolean).length;if(!valid)throw Error('nenhum frame carregou em '+folder);for(let i=0;i<raw.length;i++){if(raw[i])continue;let repl=null;for(let d=1;d<raw.length&&!repl;d++){repl=raw[i-d]||raw[i+d]||null}raw[i]=repl}return{frames:raw,loaded:valid,missing:count-valid}}\n"""
    g=g[:idx]+helper+g[idx:]

# 2) Make start button resilient: armed OR base skin; animated weapon OR fallback weapon.
start=g.index('let playerLoadFinished=false;function syncStartButton(){')
end=g.index('async function prepZipImage',start)
new_sync="""let playerLoadFinished=false;function syncStartButton(){const b=$('startBtn');if(!b)return;const skinReady=playerArmedReady||playerV2Ready||soldierReady,gunReady=weaponV2Ready||weaponReady;if(skinReady&&gunReady){b.disabled=false;b.textContent='ENTRAR NA ARENA';b.style.opacity='1'}else{b.disabled=true;b.textContent=playerLoadFinished?'SKIN DO PLAYER INDISPONÍVEL':'CARREGANDO PERSONAGEM...';b.style.opacity='.58'}}\n"""
g=g[:start]+new_sync+g[end:]

# 3) Replace fragile player asset startup block. A single failed PNG must not kill the whole pack.
old_start="""(async()=>{\ntry{\n  const base=await loadDirectPngSequence('./assets/player',32,ASSET_TAG);"""
start=g.index(old_start)
end=g.index(']);\n})();',start)+len(']);\n})();')
new_block="""(async()=>{\nconst playerJobs=[];\nplayerJobs.push(loadPngSequenceSafe('./assets/player',32,i=>`frame_${String(i).padStart(3,'0')}.png`,false,ASSET_TAG).then(r=>{mapPlayer32(r.frames,playerBaseFrames);playerV2Ready=playerBaseFrames.down.length===4&&playerBaseFrames.up.length===4&&playerBaseFrames.left.length===4&&playerBaseFrames.right.length===4;console.log('PLAYER BASE SAFE READY',{loaded:r.loaded,missing:r.missing,ready:playerV2Ready})}).catch(e=>console.warn('PLAYER BASE SAFE ERROR',e)));\nplayerJobs.push(loadPngSequenceSafe('./assets/player-armed',32,i=>`Posearma${i}.png`,false,ASSET_TAG).then(r=>{mapPlayer32(r.frames,playerArmedFrames);playerArmedReady=playerArmedFrames.down.length===4&&playerArmedFrames.up.length===4&&playerArmedFrames.left.length===4&&playerArmedFrames.right.length===4;console.log('PLAYER ARMED SAFE READY',{loaded:r.loaded,missing:r.missing,ready:playerArmedReady})}).catch(e=>console.warn('PLAYER ARMED SAFE ERROR',e)));\nplayerJobs.push(loadPngSequenceSafe('./assets/weapons',32,i=>`frame_${String(i).padStart(3,'0')}.png`,true,ASSET_TAG).then(r=>{mapPlayer32(r.frames,playerWeaponFrames);weaponV2Ready=playerWeaponFrames.down.length===4&&playerWeaponFrames.up.length===4&&playerWeaponFrames.left.length===4&&playerWeaponFrames.right.length===4;console.log('WEAPON SAFE READY',{loaded:r.loaded,missing:r.missing,ready:weaponV2Ready})}).catch(e=>console.warn('WEAPON SAFE ERROR',e)));\nPromise.allSettled(playerJobs).then(()=>{playerLoadFinished=true;syncStartButton();console.log('PLAYER LOAD FINISHED',{base:playerV2Ready,armed:playerArmedReady,weapon:weaponV2Ready,fallbackSkin:soldierReady,fallbackWeapon:weaponReady})});\nPromise.allSettled([\n  loadDirectPngSequence('./assets/mobs/Ogro',32,ASSET_TAG).then(mobFrames=>{if(mapDirect32(mobFrames,ogreFrames)){ogreReady=true;console.log('MOBS BACKGROUND READY',mobFrames.length)}}),\n  loadDirectPngSequence('./assets/mobs/Ogro Elite',32,ASSET_TAG).then(eliteFrames=>{if(mapDirect32(eliteFrames,eliteOgreFrames)){eliteOgreReady=true;console.log('ELITE MOBS BACKGROUND READY',eliteFrames.length)}})\n]);\nsyncStartButton();\n})();"""
g=g[:start]+new_block+g[end:]

# 4) Ensure drawPlayer can use the fallback static soldier when the 32-frame base pack is unavailable.
needle="""  if(playerV2Ready){"""
if needle not in g:
    raise SystemExit('drawPlayer readiness marker not found')
# We only alter the first drawPlayer occurrence by inserting a broader condition.
g=g.replace(needle,"""  if(playerV2Ready||playerArmedReady){""",1)

# 5) Bump every synchronized surface.
for path in ['index.html','painel.html','map-lab.html','duo.html','src/game.js','src/panel.js','src/map-lab.js','src/duo.js','src/map-runtime.js']:
    fp=Path(path)
    if not fp.exists():
        continue
    txt = g if path=='src/game.js' else fp.read_text()
    txt=txt.replace('0.17.29','0.17.30').replace('01729','01730')
    fp.write_text(txt)

Path('version.json').write_text(json.dumps({'version':'0.17.30','build':'resilient-player-asset-loader'},ensure_ascii=False,indent=2)+'\n')

# Add explicit regression checks without disturbing existing validator structure.
cp=Path('scripts/check-game.mjs')
c=cp.read_text()
block="""
// v0.17.30 · resilient player asset loader
if(!game.includes('async function loadPngSequenceSafe(')) fail('loader resiliente do player ausente'); else ok('loader resiliente do player ativo');
if(!game.includes('skinReady=playerArmedReady||playerV2Ready||soldierReady')) fail('fallback de skin do P1 ausente'); else ok('fallback de skin P1 ativo');
if(!game.includes('gunReady=weaponV2Ready||weaponReady')) fail('fallback de arma do P1 ausente'); else ok('fallback de arma P1 ativo');
if(!game.includes("loadPngSequenceSafe('./assets/player',32")) fail('player base ainda usa carregamento fragil'); else ok('player base tolera falha individual');
if(!game.includes("loadPngSequenceSafe('./assets/player-armed',32")) fail('player armado ainda usa carregamento fragil'); else ok('player armado tolera falha individual');
if(!game.includes("loadPngSequenceSafe('./assets/weapons',32")) fail('weapon pack ainda usa carregamento fragil'); else ok('weapon pack tolera falha individual');
"""
if '// v0.17.30 · resilient player asset loader' not in c:
    c += block
cp.write_text(c)
print('v0.17.30 player loader resilience patch applied')
