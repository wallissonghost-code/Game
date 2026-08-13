from pathlib import Path
import json

VERSION='0.17.36'
TAG='01736'
OLD_VERSION='0.17.35'
OLD_TAG='01735'

def rw(p): return Path(p).read_text()
def ww(p,s): Path(p).write_text(s)

def must_replace(s, old, new, label):
    if old not in s:
        raise RuntimeError(f'padrao nao encontrado: {label}')
    return s.replace(old,new,1)

# 1) Organiza os 32 frames enviados na raiz de assets/mobs.
target=Path('assets/mobs/Ogro Corrompido')
target.mkdir(parents=True,exist_ok=True)
for i in range(1,33):
    name=f'frame_{i:03d}.png'
    src=Path('assets/mobs')/name
    dst=target/name
    if src.exists():
        if dst.exists(): dst.unlink()
        src.rename(dst)
    elif not dst.exists():
        raise RuntimeError(f'frame corrompido ausente: {name}')

root_frames=list(Path('assets/mobs').glob('frame_*.png'))
if root_frames:
    raise RuntimeError('ainda existem frames soltos em assets/mobs')
if len(list(target.glob('frame_*.png'))) != 32:
    raise RuntimeError('Ogro Corrompido precisa ter exatamente 32 frames')

# 2) P1/Host: pacote dedicado para tier 2.
g=rw('src/game.js')
g=g.replace(OLD_VERSION,VERSION).replace(OLD_TAG,TAG)
g=must_replace(g,
    "const MOB_VISUAL_HEIGHT={normal:62,elite:86,bossScale:3.55};",
    "const MOB_VISUAL_HEIGHT={normal:62,elite:86,corrupted:86,bossScale:3.55};",
    'escala visual corrupted')
g=must_replace(g,
    "const ogreFrames={up:[],down:[],right:[],left:[]},eliteOgreFrames={up:[],down:[],right:[],left:[]},bossOgreFrames={up:[],down:[],right:[],left:[]},bossColossusFrames={up:[],down:[],right:[],left:[]},bossVoidFrames={up:[],down:[],right:[],left:[]};let ogreReady=false,eliteOgreReady=false,bossOgreReady=false,bossColossusReady=false,bossVoidReady=false;",
    "const ogreFrames={up:[],down:[],right:[],left:[]},eliteOgreFrames={up:[],down:[],right:[],left:[]},corruptedOgreFrames={up:[],down:[],right:[],left:[]},bossOgreFrames={up:[],down:[],right:[],left:[]},bossColossusFrames={up:[],down:[],right:[],left:[]},bossVoidFrames={up:[],down:[],right:[],left:[]};let ogreReady=false,eliteOgreReady=false,corruptedOgreReady=false,bossOgreReady=false,bossColossusReady=false,bossVoidReady=false;",
    'frames corrupted P1')
g=must_replace(g,
    "  loadDirectPngSequence('./assets/mobs/Ogro Elite',32,ASSET_TAG).then(eliteFrames=>{if(mapDirect32(eliteFrames,eliteOgreFrames)){eliteOgreReady=true;console.log('ELITE MOBS BACKGROUND READY',eliteFrames.length)}})\n]);",
    "  loadDirectPngSequence('./assets/mobs/Ogro Elite',32,ASSET_TAG).then(eliteFrames=>{if(mapDirect32(eliteFrames,eliteOgreFrames)){eliteOgreReady=true;console.log('ELITE MOBS BACKGROUND READY',eliteFrames.length)}}),\n  loadDirectPngSequence('./assets/mobs/Ogro Corrompido',32,ASSET_TAG).then(corruptedFrames=>{if(mapDirect32(corruptedFrames,corruptedOgreFrames)){corruptedOgreReady=true;console.log('CORRUPTED MOBS BACKGROUND READY',corruptedFrames.length)}})\n]);",
    'loader corrupted P1')
g=must_replace(g,
    "(e.tier===1&&eliteOgreReady?eliteOgreFrames:ogreFrames)",
    "(e.tier===2&&corruptedOgreReady?corruptedOgreFrames:e.tier===1&&eliteOgreReady?eliteOgreFrames:ogreFrames)",
    'selecao de pack corrupted P1')
g=must_replace(g,
    "(e.tier===1&&eliteOgreReady?eliteOgreReady:ogreReady)",
    "(e.tier===2&&corruptedOgreReady?corruptedOgreReady:e.tier===1&&eliteOgreReady?eliteOgreReady:ogreReady)",
    'ready corrupted P1')
g=must_replace(g,
    "(e.tier===1?MOB_VISUAL_HEIGHT.elite:MOB_VISUAL_HEIGHT.normal)",
    "(e.tier===2?MOB_VISUAL_HEIGHT.corrupted:e.tier===1?MOB_VISUAL_HEIGHT.elite:MOB_VISUAL_HEIGHT.normal)",
    'altura corrupted P1')
ww('src/game.js',g)

# 3) P2: mesma skin exclusiva para tier 2, com carregamento lazy.
d=rw('src/duo.js')
d=d.replace(OLD_VERSION,VERSION).replace(OLD_TAG,TAG)
d=must_replace(d,
    "const playerArmedFrames=mk8(),playerWeaponFrames=mk8(),ogreFrames=mk8(),eliteOgreFrames=mk8(),bossColossusFrames=mk4(),bossVoidFrames=mk4();let armedReady=false,weaponReady=false,ogreReady=false,eliteReady=false,bossColossusReady=false,bossVoidReady=false,eliteLoading=false,colossusLoading=false,voidLoading=false;",
    "const playerArmedFrames=mk8(),playerWeaponFrames=mk8(),ogreFrames=mk8(),eliteOgreFrames=mk8(),corruptedOgreFrames=mk8(),bossColossusFrames=mk4(),bossVoidFrames=mk4();let armedReady=false,weaponReady=false,ogreReady=false,eliteReady=false,corruptedReady=false,bossColossusReady=false,bossVoidReady=false,eliteLoading=false,corruptedLoading=false,colossusLoading=false,voidLoading=false;",
    'frames corrupted P2')
d=must_replace(d,
    "async function ensureElite(){if(eliteReady||eliteLoading)return;eliteLoading=true;try{eliteReady=mapMob32(await loadFrames('assets/mobs/Ogro Elite',32,i=>'frame_'+String(i).padStart(3,'0')+'.png'),eliteOgreFrames)}catch{}finally{eliteLoading=false}}async function ensureBoss(type){",
    "async function ensureElite(){if(eliteReady||eliteLoading)return;eliteLoading=true;try{eliteReady=mapMob32(await loadFrames('assets/mobs/Ogro Elite',32,i=>'frame_'+String(i).padStart(3,'0')+'.png'),eliteOgreFrames)}catch{}finally{eliteLoading=false}}async function ensureCorrupted(){if(corruptedReady||corruptedLoading)return;corruptedLoading=true;try{corruptedReady=mapMob32(await loadFrames('assets/mobs/Ogro Corrompido',32,i=>'frame_'+String(i).padStart(3,'0')+'.png'),corruptedOgreFrames)}catch{}finally{corruptedLoading=false}}async function ensureBoss(type){",
    'loader lazy corrupted P2')
d=must_replace(d,
    "if(raw.tier===1)ensureElite();if(raw.type==='colossus'||raw.type==='voidlord')ensureBoss(raw.type)",
    "if(raw.tier===1)ensureElite();if(raw.tier===2)ensureCorrupted();if(raw.type==='colossus'||raw.type==='voidlord')ensureBoss(raw.type)",
    'gatilho corrupted P2')
d=must_replace(d,
    "const pack=e.tier===1&&eliteReady?eliteOgreFrames:ogreFrames",
    "const pack=e.tier===2&&corruptedReady?corruptedOgreFrames:e.tier===1&&eliteReady?eliteOgreFrames:ogreFrames",
    'selecao pack corrupted P2')
d=must_replace(d,
    "h=e.tier===1?80:59",
    "h=e.tier===2?80:e.tier===1?80:59",
    'altura corrupted P2')
ww('src/duo.js',d)

# 4) Mantém jogo, P2, painel e Map Lab na mesma versão.
for p in ['index.html','duo.html','painel.html','map-lab.html']:
    s=rw(p).replace(OLD_VERSION,VERSION).replace(OLD_TAG,TAG)
    ww(p,s)
for p in ['src/panel.js','src/map-runtime.js','src/map-lab.js']:
    s=rw(p).replace(OLD_VERSION,VERSION).replace(OLD_TAG,TAG)
    ww(p,s)

ww('version.json',json.dumps({'version':VERSION,'build':'corrupted-ogre-dedicated-skin'},indent=2,ensure_ascii=False)+'\n')

# 5) Regressão: protege a skin dedicada em updates futuros.
check=rw('scripts/check-game.mjs')
addon=r'''
// v0.17.36 · dedicated corrupted ogre skin
const corruptGame=read('src/game.js'),corruptDuo=read('src/duo.js');
if(!corruptGame.includes("./assets/mobs/Ogro Corrompido")) fail('skin Corrompido ausente no Host'); else ok('Host carrega skin Ogro Corrompido');
if(!corruptGame.includes('e.tier===2&&corruptedOgreReady?corruptedOgreFrames')) fail('tier 2 nao usa skin Corrompido no Host'); else ok('tier 2 usa skin Corrompido no Host');
if(!corruptDuo.includes("assets/mobs/Ogro Corrompido")) fail('skin Corrompido ausente no P2'); else ok('P2 carrega skin Ogro Corrompido');
if(!corruptDuo.includes('e.tier===2&&corruptedReady?corruptedOgreFrames')) fail('tier 2 nao usa skin Corrompido no P2'); else ok('tier 2 usa skin Corrompido no P2');
'''
if '// v0.17.36 · dedicated corrupted ogre skin' not in check:
    check += addon
ww('scripts/check-game.mjs',check)

print('v0.17.36 corrupted ogre skin patch applied; 32 frames organized')
