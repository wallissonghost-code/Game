from pathlib import Path
import re

p=Path('src/game.js')
s=p.read_text()

if "const VERSION='0.15.7'" not in s:
    raise SystemExit('version marker missing')
s=s.replace("const VERSION='0.15.7'","const VERSION='0.15.8'",1)

old="async function loadOgrePack(path,target,bossMode=false){try{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const zip=await JSZip.loadAsync(await r.arrayBuffer());const names=Object.keys(zip.files).filter(n=>/\\.png$/i.test(n)&&!zip.files[n].dir).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));const urls={};for(const n of names){const blob=await zip.files[n].async('blob'),url=URL.createObjectURL(blob),img=new Image();await new Promise((ok,fail)=>{img.onload=ok;img.onerror=fail;img.src=url});urls[n]=img}const by=(row,col)=>names.find(n=>n.includes(`recorte-${row}-${col}.png`));if(bossMode){target.up=[1,2,3,4].map(c=>urls[by(1,c)]).filter(Boolean);target.down=[1,2,3,4].map(c=>urls[by(2,c)]).filter(Boolean);target.right=[1,2,3,4].map(c=>urls[by(3,c)]).filter(Boolean);target.left=[1,2,3,4].map(c=>urls[by(4,c)]).filter(Boolean)}else{target.up=[1,2,3,4].map(row=>urls[by(row,1)]).filter(Boolean);target.down=[1,2,3,4].map(row=>urls[by(row,2)]).filter(Boolean);const side=[];for(let row=1;row<=4;row++)for(const col of[3,4]){const img=urls[by(row,col)];if(img)side.push(img)}target.right=side;target.left=side}return target.up.length>=4&&target.down.length>=4&&target.right.length>=4&&target.left.length>=4}catch(e){console.warn('Ogre pack indisponível',path,e);return false}}"

new="async function loadOgrePack(path,target,bossMode=false){try{const r=await fetch(path+'?v=0158',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const zip=await JSZip.loadAsync(await r.arrayBuffer());const names=Object.keys(zip.files).filter(n=>/\\.png$/i.test(n)&&!zip.files[n].dir).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));const urls={},ordered=[];for(const n of names){const blob=await zip.files[n].async('blob'),url=URL.createObjectURL(blob),img=new Image();await new Promise((ok,fail)=>{img.onload=ok;img.onerror=fail;img.src=url});urls[n]=img;ordered.push(img)}const by=(row,col)=>names.find(n=>n.includes(`recorte-${row}-${col}.png`));if(bossMode){const named=by(1,1)&&by(2,1)&&by(3,1)&&by(4,1);if(named){target.up=[1,2,3,4].map(c=>urls[by(1,c)]).filter(Boolean);target.down=[1,2,3,4].map(c=>urls[by(2,c)]).filter(Boolean);target.right=[1,2,3,4].map(c=>urls[by(3,c)]).filter(Boolean);target.left=[1,2,3,4].map(c=>urls[by(4,c)]).filter(Boolean)}else if(ordered.length>=16){target.up=ordered.slice(0,4);target.down=ordered.slice(4,8);target.right=ordered.slice(8,12);target.left=ordered.slice(12,16)}else if(ordered.length>=4){target.up=[ordered[0]];target.down=[ordered[1]||ordered[0]];target.right=[ordered[2]||ordered[0]];target.left=[ordered[3]||ordered[0]]}}else{target.up=[1,2,3,4].map(row=>urls[by(row,1)]).filter(Boolean);target.down=[1,2,3,4].map(row=>urls[by(row,2)]).filter(Boolean);const side=[];for(let row=1;row<=4;row++)for(const col of[3,4]){const img=urls[by(row,col)];if(img)side.push(img)}target.right=side;target.left=side}return target.up.length>0&&target.down.length>0&&target.right.length>0&&target.left.length>0}catch(e){console.warn('Ogre pack indisponível',path,e);return false}}"

if old not in s:
    raise SystemExit('loader marker missing')
s=s.replace(old,new,1)

old="(async()=>{ogreReady=await loadOgrePack('./assets/recorte-split (1).zip?v=0137',ogreFrames,false);bossOgreReady=false;bossColossusReady=false;bossVoidReady=false})();"
new="(async()=>{const [common,colossus,voidlord]=await Promise.all([loadOgrePack('./assets/recorte-split (1).zip',ogreFrames,false),loadOgrePack('./assets/Ogroboss1.zip',bossColossusFrames,true),loadOgrePack('./assets/Ogro2.0Boss.zip',bossVoidFrames,true)]);ogreReady=common;bossColossusReady=colossus;bossVoidReady=voidlord;bossOgreReady=bossColossusReady||bossVoidReady;console.log('BOSS SKINS READY',{colossus:bossColossusReady,voidlord:bossVoidReady})})();"
if old not in s:
    raise SystemExit('boss init marker missing')
s=s.replace(old,new,1)

old="function drawOgreSkin(e,isBoss){const pack=isBoss?bossOgreFrames:ogreFrames,ready=isBoss?bossOgreReady:ogreReady,dir=e.facing||'down',arr=pack[dir]||pack.down||[];"
new="function drawOgreSkin(e,isBoss){const pack=isBoss?(e.type==='colossus'?bossColossusFrames:e.type==='voidlord'?bossVoidFrames:bossOgreFrames):ogreFrames,ready=isBoss?(e.type==='colossus'?bossColossusReady:e.type==='voidlord'?bossVoidReady:bossOgreReady):ogreReady,dir=e.facing||'down',arr=pack[dir]||pack.down||[];"
if old not in s:
    raise SystemExit('boss renderer marker missing')
s=s.replace(old,new,1)

p.write_text(s)

idx=Path('index.html')
h=idx.read_text()
h=h.replace('Caos Live v0.15.7','Caos Live v0.15.8')
h=h.replace('v0.15.7 · BARRA DE VIDA','v0.15.8 · 2 BOSS SKINS')
h=h.replace('v0.15.7</span>','v0.15.8</span>')
h=re.sub(r'src/game\\.js\\?v=\\d+','src/game.js?v=0158',h,count=1)
idx.write_text(h)
Path('version.json').write_text('{\n  "version": "0.15.8",\n  "build": "two-boss-skins"\n}\n')
