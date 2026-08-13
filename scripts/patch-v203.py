from pathlib import Path

client=Path('src/multiplayer-v2.js')
server=Path('cloud/game-server-v3.mjs')
html=Path('multiplayer-v2.html')

s=client.read_text()
s=s.replace('0.17.37-online-v2.0.2','0.17.37-online-v2.0.3')
s=s.replace("TAG='01737v202'","TAG='01737v203'",1)
s=s.replace("pendingInputs=[],lastAck=0;","pendingInputs=[],lastAck=0,rankSavedMatch='';",1)

old="async function loadSafe(folder,count,namer){const arr=await Promise.all(Array.from({length:count},(_,k)=>loadImgRetry(`${folder}/${namer(k+1)}?v=${TAG}`,1)));const good=arr.map((x,i)=>x?i:-1).filter(i=>i>=0);if(!good.length)return null;for(let i=0;i<arr.length;i++)if(!arr[i]){let pick=good[0],dist=Math.abs(pick-i);for(const g of good){const d=Math.abs(g-i);if(d<dist){pick=g;dist=d}}arr[i]=arr[pick]}return arr}"
new="async function cropAlphaFrame(img){try{const c=document.createElement('canvas'),x=c.getContext('2d',{willReadFrequently:true});c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let minX=c.width,minY=c.height,maxX=-1,maxY=-1;for(let y=0;y<c.height;y++)for(let xx=0;xx<c.width;xx++)if(d[(y*c.width+xx)*4+3]>12){if(xx<minX)minX=xx;if(xx>maxX)maxX=xx;if(y<minY)minY=y;if(y>maxY)maxY=y}if(maxX<0)return img;const pad=2,x0=Math.max(0,minX-pad),y0=Math.max(0,minY-pad),w=Math.min(c.width-1,maxX+pad)-x0+1,h=Math.min(c.height-1,maxY+pad)-y0+1,o=document.createElement('canvas');o.width=w;o.height=h;o.getContext('2d').drawImage(c,x0,y0,w,h,0,0,w,h);return o}catch{return img}}\nasync function loadSafe(folder,count,namer,crop=false){const arr=await Promise.all(Array.from({length:count},async(_,k)=>{const im=await loadImgRetry(`${folder}/${namer(k+1)}?v=${TAG}`,1);return im&&crop?await cropAlphaFrame(im):im}));const good=arr.map((x,i)=>x?i:-1).filter(i=>i>=0);if(!good.length)return null;for(let i=0;i<arr.length;i++)if(!arr[i]){let pick=good[0],dist=Math.abs(pick-i);for(const g of good){const d=Math.abs(g-i);if(d<dist){pick=g;dist=d}}arr[i]=arr[pick]}return arr}"
if old not in s: raise SystemExit('loadSafe anchor missing')
s=s.replace(old,new,1)

old="async function optionalPack(folder,target){try{const probe=await fetch(`${folder}/frame_001.png?v=${TAG}`,{cache:'force-cache'});if(!probe.ok)return false;const a=await loadSafe(folder,32,i=>'frame_'+String(i).padStart(3,'0')+'.png');return mapMob32(a,target)}catch{return false}}"
new="async function optionalPack(folder,target){try{const probe=await fetch(`${folder}/frame_001.png?v=${TAG}`,{cache:'force-cache'});if(!probe.ok)return false;const a=await loadSafe(folder,32,i=>'frame_'+String(i).padStart(3,'0')+'.png',true);return mapMob32(a,target)}catch{return false}}"
if old not in s: raise SystemExit('optionalPack anchor missing')
s=s.replace(old,new,1)

start=s.index('async function loadBoss(')
end=s.index('\nfunction beginStaticPreload',start)
boss="async function loadBoss(path,target,voidOrder=false){try{if(typeof JSZip==='undefined')return false;const r=await fetch(path+'?v='+TAG,{cache:'no-store'});if(!r.ok)return false;const z=await JSZip.loadAsync(await r.arrayBuffer()),names=Object.keys(z.files).filter(n=>/\\.png$/i.test(n)&&!z.files[n].dir).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),urls={},ordered=[];for(const n of names){const blob=await z.files[n].async('blob'),url=URL.createObjectURL(blob),im=await loadImg(url);URL.revokeObjectURL(url);if(im){urls[n]=im;ordered.push(im)}}const by=(row,col)=>names.find(n=>n.includes(`recorte-${row}-${col}.png`)),named=by(1,1)&&by(2,1)&&by(3,1)&&by(4,1);if(named){target.up=[1,2,3,4].map(c=>urls[by(1,c)]).filter(Boolean);target.down=[1,2,3,4].map(c=>urls[by(2,c)]).filter(Boolean);target.right=[1,2,3,4].map(c=>urls[by(3,c)]).filter(Boolean);target.left=[1,2,3,4].map(c=>urls[by(4,c)]).filter(Boolean)}else if(ordered.length>=16){target.up=ordered.slice(0,4);target.down=ordered.slice(4,8);if(path.includes('Ogroboss1.zip')){target.left=ordered.slice(8,12);target.right=ordered.slice(12,16)}else{target.right=ordered.slice(8,12);target.left=ordered.slice(12,16)}}else if(ordered.length>=4){target.up=[ordered[0]];target.down=[ordered[1]||ordered[0]];target.right=[ordered[2]||ordered[0]];target.left=[ordered[3]||ordered[0]]}return target.up.length>0&&target.down.length>0&&target.right.length>0&&target.left.length>0}catch(e){console.warn('BOSS PACK',path,e);return false}}"
s=s[:start]+boss+s[end:]

s=s.replace("const a=await loadSafe('/assets/weapons',32,i=>'frame_'+String(i).padStart(3,'0')+'.png');","const a=await loadSafe('/assets/weapons',32,i=>'frame_'+String(i).padStart(3,'0')+'.png',true);",1)
for folder in ['Ogro','Ogro Elite','Ogro Corrompido']:
    old=f"const a=await loadSafe('/assets/mobs/{folder}',32,i=>'frame_'+String(i).padStart(3,'0')+'.png');"
    new=f"const a=await loadSafe('/assets/mobs/{folder}',32,i=>'frame_'+String(i).padStart(3,'0')+'.png',true);"
    if old not in s: raise SystemExit('mob crop anchor missing '+folder)
    s=s.replace(old,new,1)

old="if(m.type==='match-start'){started=true;firstSnapshot=false;meta="
if old not in s: raise SystemExit('match start anchor missing')
s=s.replace(old,"if(m.type==='match-start'){started=true;firstSnapshot=false;rankSavedMatch='';meta=",1)

marker='function refreshUi(){'
rank_fn="async function saveGlobalDuoRank(){if(myRole!=='p1'||!meta?.gameOver||!meta?.matchId||!meta?.result||rankSavedMatch===meta.matchId)return;rankSavedMatch=meta.matchId;const list=Array.isArray(meta.result.players)?meta.result.players:[],p1=list.find(x=>x.role==='p1'),p2=list.find(x=>x.role==='p2');if(!p1||!p2)return;try{if(!window.CaosRank)throw Error('CaosRank indisponivel');await window.CaosRank.saveDuo({p2Uid:'',p1Name:p1.name,p2Name:p2.name,p1Kills:p1.kills,p2Kills:p2.kills,p1Xp:p1.xp,p2Xp:p2.xp,p1Level:p1.level,p2Level:p2.level,points:meta.result.points||0,durationMs:meta.durationMs||0,version:ONLINE_VERSION},meta.matchId);console.log('RANK DUO V2 SALVO',meta.matchId)}catch(e){rankSavedMatch='';console.warn('RANK DUO V2',e)}}\n"
if marker not in s: raise SystemExit('rank marker missing')
s=s.replace(marker,rank_fn+marker,1)

old="if(meta.gameOver){ui.finalText.textContent=`${meta.totalKills||0} abates · ${fmtTime(meta.durationMs)}`;ui.gameOver.classList.add('show')}else ui.gameOver.classList.remove('show')}"
new="if(meta.gameOver){ui.finalText.textContent=`${meta.totalKills||0} abates · ${fmtTime(meta.durationMs)}`;ui.gameOver.classList.add('show');saveGlobalDuoRank()}else ui.gameOver.classList.remove('show')}"
if old not in s: raise SystemExit('gameover anchor missing')
s=s.replace(old,new,1)
client.write_text(s)

s=server.read_text()
s=s.replace('0.17.37-online-v2.0.2','0.17.37-online-v2.0.3')
s=s.replace('xp:0,level:1,xpNeed:60,xpMult:1,','xp:0,totalXp:0,level:1,xpNeed:60,xpMult:1,',1)
s=s.replace('spawnAccumulator:0,totalKills:0,totalXp:0,wave:1,','spawnAccumulator:0,totalKills:0,totalXp:0,points:0,wave:1,',1)
old='function gainXp(r,p,amount){const n=Math.max(0,amount)*(p.xpMult||1);p.xp+=n;r.totalXp+=n;'
if old not in s: raise SystemExit('gainXp anchor missing')
s=s.replace(old,'function gainXp(r,p,amount){const n=Math.max(0,amount)*(p.xpMult||1);p.xp+=n;p.totalXp=(p.totalXp||0)+n;r.totalXp+=n;',1)
old='function onKill(r,p,e){r.totalKills++;p.kills++;gainXp(r,p,e.xp);'
if old not in s: raise SystemExit('onKill anchor missing')
s=s.replace(old,"function onKill(r,p,e){r.totalKills++;r.points=(r.points||0)+(e.boss?500:e.tier===2?35:e.tier===1?20:10);p.kills++;gainXp(r,p,e.xp);",1)
s=s.replace('speed:255,xp:0,level:1,xpNeed:60,xpMult:1,','speed:255,xp:0,totalXp:0,level:1,xpNeed:60,xpMult:1,',1)
s=s.replace('r.totalKills=0;r.totalXp=0;r.wave=1;','r.totalKills=0;r.totalXp=0;r.points=0;r.wave=1;',1)
old='const live=a.filter(p=>!p.down),down=a.filter(p=>p.down);'
if old not in s: raise SystemExit('revive anchor missing')
s=s.replace(old,'const live=a.filter(p=>!p.down&&!p.choices),down=a.filter(p=>p.down);',1)
old='medDrop:r.medDrop?{x:q(r.medDrop.x),y:q(r.medDrop.y)}:null},players:'
new="medDrop:r.medDrop?{x:q(r.medDrop.x),y:q(r.medDrop.y)}:null,points:r.points||0,result:r.gameOver?{points:r.points||0,players:[...r.players.values()].map(x=>({role:x.role,name:x.name,kills:x.kills||0,xp:Math.round(x.totalXp||0),level:x.level||1}))}:null},players:"
if old not in s: raise SystemExit('snapshot result anchor missing')
s=s.replace(old,new,1)
server.write_text(s)

s=html.read_text()
s=s.replace('0.17.37-online-v2.0.2','0.17.37-online-v2.0.3')
s=s.replace('01737v202','01737v203')
anchor='<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>'
firebase=anchor+'\n<script src="https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js"></script>\n<script src="https://www.gstatic.com/firebasejs/12.16.0/firebase-auth-compat.js"></script>\n<script src="https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore-compat.js"></script>\n<script src="/src/firebase-ranking.js?v=01737"></script>'
if anchor not in s: raise SystemExit('firebase anchor missing')
s=s.replace(anchor,firebase,1)
html.write_text(s)
