from pathlib import Path
import re,json

p=Path('src/game.js')
s=p.read_text()
s=s.replace("const VERSION='0.17.3'","const VERSION='0.17.4'",1)

old_direct="async function loadDirectPngSequence(folder,count,cacheTag='0169'){const arr=[];for(let i=1;i<=count;i++){const img=new Image(),name=`frame_${String(i).padStart(3,'0')}.png`;await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error(folder+'/'+name));img.src=`${folder}/${name}?v=${cacheTag}`});arr.push(folder.includes('/mobs')?await cropAlphaFrame(img):img)}return arr}"
new_direct="async function loadDirectPngSequence(folder,count,cacheTag='0174'){const jobs=[];for(let i=1;i<=count;i++){jobs.push((async()=>{const img=new Image(),name=`frame_${String(i).padStart(3,'0')}.png`;await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error(folder+'/'+name));img.src=`${folder}/${name}?v=${cacheTag}`});return folder.includes('/mobs')?await cropAlphaFrame(img):img})())}return Promise.all(jobs)}"
if old_direct not in s: raise SystemExit('direct loader not found')
s=s.replace(old_direct,new_direct,1)

old_named="async function loadNamedPngSequence(folder,prefix,count,cacheTag='0170'){const arr=[];for(let i=1;i<=count;i++){const img=new Image(),name=`${prefix}${i}.png`;await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error(folder+'/'+name));img.src=`${folder}/${name}?v=${cacheTag}`});arr.push(img)}return arr}"
new_named="async function loadNamedPngSequence(folder,prefix,count,cacheTag='0174'){const jobs=[];for(let i=1;i<=count;i++){jobs.push((async()=>{const img=new Image(),name=`${prefix}${i}.png`;await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error(folder+'/'+name));img.src=`${folder}/${name}?v=${cacheTag}`});return img})())}return Promise.all(jobs)}"
if old_named not in s: raise SystemExit('named loader not found')
s=s.replace(old_named,new_named,1)

old_block=re.compile(r"\(async\(\)=>\{\s*try\{\s*const base=await loadDirectPngSequence\('./assets/player',32,'0170'\);\s*const armed=await loadNamedPngSequence\('./assets/player-armed','Posearma',32,'0170'\);\s*mapPlayer32\(base,playerBaseFrames\);mapPlayer32\(armed,playerArmedFrames\);\s*playerV2Ready=.*?\s*console\.log\('PLAYER PNG READY 8DIR'.*?\);\s*\}catch\(e\)\{console\.error\('PLAYER PNG ERROR',e\)\}finally\{playerLoadFinished=true;syncStartButton\(\)\}\s*try\{\s*const weap=await loadDirectPngSequence\('./assets/weapons',32,'0170'\);\s*mapPlayer32\(weap,playerWeaponFrames\);\s*weaponV2Ready=.*?\s*console\.log\('WEAPON PNG READY 8DIR'.*?\);\s*\}catch\(e\)\{console\.warn\('WEAPON PNG indisponível',e\)\}\s*\}\)\(\);",re.S)
new_block="""(async()=>{
try{
  const base=await loadDirectPngSequence('./assets/player',32,'0174');
  mapPlayer32(base,playerBaseFrames);
  playerV2Ready=playerBaseFrames.down.length===4&&playerBaseFrames.up.length===4&&playerBaseFrames.left.length===4&&playerBaseFrames.right.length===4;
  playerLoadFinished=true;syncStartButton();
  console.log('PLAYER BASE READY FAST',{base:base.length,ready:playerV2Ready});
}catch(e){playerLoadFinished=true;syncStartButton();console.error('PLAYER BASE PNG ERROR',e);return}
Promise.allSettled([
  loadNamedPngSequence('./assets/player-armed','Posearma',32,'0174').then(armed=>{mapPlayer32(armed,playerArmedFrames);console.log('PLAYER ARMED BACKGROUND READY',armed.length)}),
  loadDirectPngSequence('./assets/weapons',32,'0174').then(weap=>{mapPlayer32(weap,playerWeaponFrames);weaponV2Ready=playerWeaponFrames.down.length===4&&playerWeaponFrames.up.length===4&&playerWeaponFrames.left.length===4&&playerWeaponFrames.right.length===4;console.log('WEAPON BACKGROUND READY',weap.length)}),
  loadDirectPngSequence('./assets/mobs',32,'0174').then(mobFrames=>{if(mapDirect32(mobFrames,ogreFrames)){ogreReady=true;console.log('MOBS BACKGROUND READY',mobFrames.length)}})
]);
})();"""
s,n=old_block.subn(new_block,s,count=1)
if n!=1: raise SystemExit(f'player preload block replace failed {n}')

# Remove duplicate eager common-mob preload from the older boss loader block; keep bosses loading independently.
old_mobboss=re.compile(r"\(async\(\)=>\{let common=false;try\{const mobFrames=await loadDirectPngSequence\('./assets/mobs',32\);common=mapDirect32\(mobFrames,ogreFrames\);console\.log\('MOB PNG READY',common,mobFrames\.length\)\}catch\(e\)\{console\.error\('MOB PNG ERROR',e\)\}const \[colossus,voidlord\]=await Promise\.all\(\[loadOgrePack\('./assets/bosses/Ogroboss1\.zip',bossColossusFrames,true\),loadOgrePack\('./assets/bosses/Ogro2\.0Boss\.zip',bossVoidFrames,true\)\]\);ogreReady=common;bossColossusReady=colossus;bossVoidReady=voidlord;bossOgreReady=bossColossusReady\|\|bossVoidReady;console\.log\('BOSS SKINS READY',\{colossus:bossColossusReady,voidlord:bossVoidReady\}\)\}\)\(\);",re.S)
new_mobboss="""(async()=>{const [colossus,voidlord]=await Promise.all([loadOgrePack('./assets/bosses/Ogroboss1.zip',bossColossusFrames,true),loadOgrePack('./assets/bosses/Ogro2.0Boss.zip',bossVoidFrames,true)]);bossColossusReady=colossus;bossVoidReady=voidlord;bossOgreReady=bossColossusReady||bossVoidReady;console.log('BOSS SKINS BACKGROUND READY',{colossus:bossColossusReady,voidlord:bossVoidReady})})();"""
s,n=old_mobboss.subn(new_mobboss,s,count=1)
if n!=1: raise SystemExit(f'mob/boss preload replace failed {n}')

# In drawPlayer use armed pack only when it is actually loaded; otherwise keep base animation while background preload continues.
s=s.replace("const pack=autoFire?playerArmedFrames:playerBaseFrames,arr=pack[dir]?.length?pack[dir]:pack.down,img=arr[frame%arr.length]||arr[0];","const armedReady=playerArmedFrames.down.length===4,pack=(autoFire&&armedReady)?playerArmedFrames:playerBaseFrames,arr=pack[dir]?.length?pack[dir]:pack.down,img=arr[frame%arr.length]||arr[0];",1)

p.write_text(s)

idx=Path('index.html');i=idx.read_text();i=i.replace('Caos Live v0.17.3','Caos Live v0.17.4').replace('v0.17.3 · COLISÃO MACIA','v0.17.4 · FAST PRELOAD').replace('v0.17.3</span>','v0.17.4</span>').replace('src/game.js?v=0173','src/game.js?v=0174');idx.write_text(i)
vp=Path('version.json');v=json.loads(vp.read_text());v['version']='0.17.4';v['build']='parallel-fast-preload';vp.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
print('patched fast preload v0.17.4')
