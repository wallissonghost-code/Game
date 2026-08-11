from pathlib import Path
import re
p=Path('src/game.js')
s=p.read_text()

s=s.replace("const VERSION='0.16.9'","const VERSION='0.17.0'",1)
s=s.replace("const playerBaseFrames={up:[],ur:[],right:[],dr:[],down:[],dl:[],left:[],ul:[]},playerArmedFrames={up:[],ur:[],right:[],dr:[],down:[],dl:[],left:[],ul:[]},playerWeaponFrames={up:[],down:[],right:[],left:[]},playerBackFrames={up:[]};",
"const playerBaseFrames={up:[],ur:[],right:[],dr:[],down:[],dl:[],left:[],ul:[]},playerArmedFrames={up:[],ur:[],right:[],dr:[],down:[],dl:[],left:[],ul:[]},playerWeaponFrames={up:[],ur:[],right:[],dr:[],down:[],dl:[],left:[],ul:[]};",1)
s=s.replace("let ammoFrames=[],playerV2Ready=false,weaponV2Ready=false,backV2Ready=false,ammoReady=false;","let playerV2Ready=false,weaponV2Ready=false;",1)

needle="async function loadDirectPngSequence(folder,count,cacheTag='0169'){const arr=[];for(let i=1;i<=count;i++){const img=new Image(),name=`frame_${String(i).padStart(3,'0')}.png`;await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error(folder+'/'+name));img.src=`${folder}/${name}?v=${cacheTag}`});arr.push(folder.includes('/mobs')?await cropAlphaFrame(img):img)}return arr}"
insert=needle+"\nasync function loadNamedPngSequence(folder,prefix,count,cacheTag='0170'){const arr=[];for(let i=1;i<=count;i++){const img=new Image(),name=`${prefix}${i}.png`;await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error(folder+'/'+name));img.src=`${folder}/${name}?v=${cacheTag}`});arr.push(img)}return arr}"
if needle not in s: raise SystemExit('loadDirect needle not found')
s=s.replace(needle,insert,1)

old_init=re.compile(r"\(async\(\)=>\{\ntry\{const all=await loadDirectPngSequence\('./assets/player',32\);.*?\n\}\)\(\);",re.S)
new_init="""(async()=>{
try{
  const base=await loadDirectPngSequence('./assets/player',32,'0170');
  const armed=await loadNamedPngSequence('./assets/player-armed','Posearma',32,'0170');
  mapPlayer32(base,playerBaseFrames);mapPlayer32(armed,playerArmedFrames);
  playerV2Ready=playerBaseFrames.down.length===4&&playerArmedFrames.down.length===4&&playerArmedFrames.up.length===4&&playerArmedFrames.left.length===4&&playerArmedFrames.right.length===4;
  console.log('PLAYER PNG READY 8DIR',{base:base.length,armed:armed.length,ready:playerV2Ready});
}catch(e){console.error('PLAYER PNG ERROR',e)}finally{playerLoadFinished=true;syncStartButton()}
try{
  const weap=await loadDirectPngSequence('./assets/weapons',32,'0170');
  mapPlayer32(weap,playerWeaponFrames);
  weaponV2Ready=playerWeaponFrames.down.length===4&&playerWeaponFrames.up.length===4&&playerWeaponFrames.left.length===4&&playerWeaponFrames.right.length===4;
  console.log('WEAPON PNG READY 8DIR',{frames:weap.length,ready:weaponV2Ready});
}catch(e){console.warn('WEAPON PNG indisponível',e)}
})();"""
s,n=old_init.subn(new_init,s,count=1)
if n!=1: raise SystemExit(f'init replace {n}')

old_muzzle=re.compile(r"function muzzleLocal\(dir\)\{return .*?\}",re.S)
new_muzzle="function muzzleLocal(dir){const m={right:{x:44,y:-3},dr:{x:35,y:22},down:{x:7,y:32},dl:{x:-35,y:22},left:{x:-44,y:-3},ul:{x:-34,y:-26},up:{x:0,y:-44},ur:{x:34,y:-26}};return m[dir]||m.down}"
s,n=old_muzzle.subn(new_muzzle,s,count=1)
if n!=1: raise SystemExit(f'muzzle replace {n}')

old_player=re.compile(r"  if\(playerV2Ready\)\{\n    const pack=.*?\n    ctx\.restore\(\);return;\n  \}",re.S)
new_player="""  if(playerV2Ready){
    const pack=autoFire?playerArmedFrames:playerBaseFrames,arr=pack[dir]?.length?pack[dir]:pack.down,img=arr[frame%arr.length]||arr[0];
    const h=80,bodyRatio=(img.naturalWidth&&img.naturalHeight)?img.naturalWidth/img.naturalHeight:.8,w=Math.min(78,h*bodyRatio),bottom=36+bob;
    const weaponLayout={
      down:{x:0,y:-1,maxW:32,maxH:46},dr:{x:9,y:-5,maxW:54,maxH:34},right:{x:11,y:-4,maxW:58,maxH:31},ur:{x:8,y:-8,maxW:51,maxH:34},
      up:{x:0,y:-13,maxW:29,maxH:48},ul:{x:-8,y:-8,maxW:51,maxH:34},left:{x:-11,y:-4,maxW:58,maxH:31},dl:{x:-9,y:-5,maxW:54,maxH:34}
    };
    const drawWeapon=()=>{if(!autoFire||!weaponV2Ready)return;const wa=playerWeaponFrames[dir]?.length?playerWeaponFrames[dir]:playerWeaponFrames.down,wi=wa[frame%wa.length]||wa[0];if(!wi)return;const q=weaponLayout[dir]||weaponLayout.down,ratio=(wi.naturalWidth&&wi.naturalHeight)?wi.naturalWidth/wi.naturalHeight:1;let ww=q.maxW,wh=ww/Math.max(.05,ratio);if(wh>q.maxH){wh=q.maxH;ww=wh*ratio}ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(wi,q.x-ww/2,q.y-wh/2+bob,ww,wh);ctx.restore()};
    const weaponBehind=autoFire&&['up','ur','ul'].includes(dir);
    if(weaponBehind)drawWeapon();
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(img,-w/2,bottom-h,w,h);ctx.restore();
    if(!weaponBehind)drawWeapon();
    if(autoFire&&player.shotFlash>0){const m=muzzleLocal(dir);ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle='#fff7b2';ctx.shadowColor='#f59e0b';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(m.x,m.y+bob,4.2,0,Math.PI*2);ctx.fill();ctx.restore()}
    ctx.restore();return;
  }"""
s,n=old_player.subn(new_player,s,count=1)
if n!=1: raise SystemExit(f'player block replace {n}')

s=re.sub(r"if\(b\.ammo&&ammoReady&&ammoFrames\.length\)\{.*?ctx\.restore\(\);continue\}","",s,count=1,flags=re.S)

p.write_text(s)
print('patched',p,'version 0.17.0')
