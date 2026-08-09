from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

if "const VERSION='0.13.8'" in s and 'PLAYER_V2_REAL_0138' in s:
    print('v0.13.8 already applied')
    raise SystemExit(0)

s = s.replace('Caos Live v0.13.7', 'Caos Live v0.13.8')
s = s.replace("const VERSION='0.13.7'", "const VERSION='0.13.8'")
s = s.replace('v0.13.7 · OGROS 4D + BOSS', 'v0.13.8 · PLAYER ARMADO V2')
s = s.replace('<span class="startVersion">v0.13.7</span>', '<span class="startVersion">v0.13.8</span>')
s = s.replace('Build · Ogros 4 direções + Boss', 'Build · Oficial1/2 + Arma3 + Munição')

anchor = "const weaponSprite=new Image();let weaponReady=false;weaponSprite.onload=()=>weaponReady=true;weaponSprite.onerror=()=>weaponReady=false;weaponSprite.src='./assets/weapons/assault-rifle-01.png?v=0105';"
if anchor not in s:
    raise SystemExit('weapon anchor not found')

addon = r'''
// PLAYER_V2_REAL_0138
const playerBaseFrames={up:[],down:[],right:[],left:[]},playerArmedFrames={up:[],down:[],right:[],left:[]},playerWeaponFrames={up:[],down:[],right:[],left:[]},playerBackFrames={up:[]};
let ammoFrames=[],playerV2Ready=false,weaponV2Ready=false,backV2Ready=false,ammoReady=false;
async function prepZipImage(blob,removeWhite=false){const raw=URL.createObjectURL(blob),img=new Image();await new Promise((ok,fail)=>{img.onload=ok;img.onerror=fail;img.src=raw});const c=document.createElement('canvas'),cc=c.getContext('2d',{willReadFrequently:true});c.width=img.naturalWidth;c.height=img.naturalHeight;cc.drawImage(img,0,0);let id=cc.getImageData(0,0,c.width,c.height),d=id.data;if(removeWhite){for(let i=0;i<d.length;i+=4){const m=Math.min(d[i],d[i+1],d[i+2]);if(m>242)d[i+3]=0;else if(m>220)d[i+3]=Math.round(d[i+3]*(242-m)/22)}cc.putImageData(id,0,0);id=cc.getImageData(0,0,c.width,c.height);d=id.data}let minX=c.width,minY=c.height,maxX=-1,maxY=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>12){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}if(maxX<0)return img;const pad=2,x0=Math.max(0,minX-pad),y0=Math.max(0,minY-pad),x1=Math.min(c.width-1,maxX+pad),y1=Math.min(c.height-1,maxY+pad),w=x1-x0+1,h=y1-y0+1,o=document.createElement('canvas');o.width=w;o.height=h;o.getContext('2d').drawImage(c,x0,y0,w,h,0,0,w,h);const out=new Image();await new Promise(ok=>{out.onload=ok;out.src=o.toDataURL('image/png')});return out}
async function zipImgs(path,removeWhite=false){const r=await fetch(path+'?v=0138',{cache:'no-store'});if(!r.ok)throw Error(path+' HTTP '+r.status);const z=await JSZip.loadAsync(await r.arrayBuffer()),names=Object.keys(z.files).filter(n=>/\.png$/i.test(n)&&!z.files[n].dir).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'})),arr=[];for(const n of names)arr.push(await prepZipImage(await z.files[n].async('blob'),removeWhite));return arr}
function mapPlayer16(arr,target){if(arr.length>=16){target.up=arr.slice(0,4);target.down=arr.slice(4,8);target.right=arr.slice(8,12);target.left=arr.slice(12,16)}else if(arr.length>=4){target.up=[arr[0]];target.down=[arr[1]||arr[0]];target.right=[arr[2]||arr[0]];target.left=[arr[3]||arr[0]]}}
(async()=>{try{const [base,armed,weap,back,ammo]=await Promise.all([zipImgs('./assets/Oficial1.zip'),zipImgs('./assets/Oficial2.zip'),zipImgs('./assets/weapons/Arma3.zip'),zipImgs('./assets/weapons/Canodaarmasemfundo.zip',true),zipImgs('./assets/weapons/Municao.zip',true)]);mapPlayer16(base,playerBaseFrames);mapPlayer16(armed,playerArmedFrames);mapPlayer16(weap,playerWeaponFrames);playerBackFrames.up=back.slice(0,Math.max(1,Math.min(4,back.length)));ammoFrames=ammo;playerV2Ready=playerBaseFrames.down.length>0&&playerArmedFrames.down.length>0;weaponV2Ready=playerWeaponFrames.down.length>0;backV2Ready=playerBackFrames.up.length>0;ammoReady=ammoFrames.length>0;console.log('PLAYER V2 READY',playerV2Ready,weaponV2Ready,backV2Ready,ammoReady)}catch(e){console.warn('Player V2 fallback ativo',e)}})();
function playerFacing(a){const x=Math.cos(a),y=Math.sin(a);return Math.abs(x)>Math.abs(y)?(x>0?'right':'left'):(y>0?'down':'up')}
function muzzleLocal(dir){return dir==='right'?{x:43,y:-1}:dir==='left'?{x:-43,y:-1}:dir==='up'?{x:0,y:-43}:{x:7,y:29}}
'''
s = s.replace(anchor, anchor + addon)

oldshoot = "function shoot(){const t=autoMode?focusedTarget():nearestVisible();if(!t)return;player.aim=Math.atan2(t.y-player.y,t.x-player.x);player.shotFlash=.1;bullets.push({x:player.x+Math.cos(player.aim)*34,y:player.y+Math.sin(player.aim)*34,vx:Math.cos(player.aim)*610,vy:Math.sin(player.aim)*610,r:4,dead:false});if(player.flashDamage&&++flashCounter%5===0)flash()}"
newshoot = "function shoot(){const t=autoMode?focusedTarget():nearestVisible();if(!t)return;player.aim=Math.atan2(t.y-player.y,t.x-player.x);player.shotFlash=.1;const dir=playerFacing(player.aim),m=muzzleLocal(dir);bullets.push({x:player.x+m.x,y:player.y+m.y,vx:Math.cos(player.aim)*610,vy:Math.sin(player.aim)*610,r:4,dead:false,ammo:1,born:performance.now()});if(player.flashDamage&&++flashCounter%5===0)flash()}"
if oldshoot not in s:
    raise SystemExit('shoot function not found')
s = s.replace(oldshoot, newshoot)

needle = "const p=world(b.x,b.y),a=Math.atan2(b.vy,b.vx);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);const trail=ctx.createLinearGradient(-22,0,5,0);"
repl = "const p=world(b.x,b.y),a=Math.atan2(b.vy,b.vx);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);if(b.ammo&&ammoReady&&ammoFrames.length){const im=ammoFrames[Math.floor((performance.now()-(b.born||0))/70)%ammoFrames.length];ctx.imageSmoothingEnabled=true;const ah=10,aw=(im.naturalWidth&&im.naturalHeight)?Math.max(10,ah*im.naturalWidth/im.naturalHeight):18;ctx.drawImage(im,-aw*.18,-ah/2,aw,ah);ctx.restore();continue}const trail=ctx.createLinearGradient(-22,0,5,0);"
if needle not in s:
    raise SystemExit('bullet draw anchor not found')
s = s.replace(needle, repl)

start = s.find('function drawPlayer(){')
end = s.find('function drawPhoenixShield()', start)
if start < 0 or end < 0:
    raise SystemExit('drawPlayer boundaries not found')

newdraw = r'''function drawPlayer(){
  ctx.save();ctx.translate(W/2,H/2);
  ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(0,25,23,7,0,0,Math.PI*2);ctx.fill();
  const a=player.aim||0,dir=playerFacing(a),frame=player.moving?Math.floor(player.walk)%4:0,bob=player.moving?Math.sin(player.walk*Math.PI*.5)*.8:0;
  if(playerV2Ready){
    const pack=autoFire?playerArmedFrames:playerBaseFrames,arr=pack[dir]?.length?pack[dir]:pack.down,img=arr[frame%arr.length]||arr[0];
    const h=80,ratio=(img.naturalWidth&&img.naturalHeight)?img.naturalWidth/img.naturalHeight:.8,w=Math.min(78,h*ratio),bottom=36+bob;
    if(autoFire&&dir==='up'&&backV2Ready){const ba=playerBackFrames.up,bi=ba[frame%ba.length]||ba[0],bh=43,br=(bi.naturalWidth&&bi.naturalHeight)?bi.naturalWidth/bi.naturalHeight:.45,bw=Math.min(27,bh*br);ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(bi,-bw/2,-50+bob,bw,bh);ctx.restore()}
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(img,-w/2,bottom-h,w,h);ctx.restore();
    if(autoFire&&dir!=='up'&&weaponV2Ready){const wd=dir==='left'?'right':dir==='right'?'left':dir,wa=playerWeaponFrames[wd]?.length?playerWeaponFrames[wd]:playerWeaponFrames.down,wi=wa[frame%wa.length]||wa[0];let wx=0,wy=-1,ww=48,wh=25;if(dir==='right'){wx=14;ww=50;wh=24}else if(dir==='left'){wx=-14;ww=50;wh=24}else if(dir==='down'){wx=1;wy=3;ww=46;wh=27}ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(wi,wx-ww/2,wy-wh/2+bob,ww,wh);ctx.restore()}
    if(autoFire&&player.shotFlash>0){const m=muzzleLocal(dir);ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle='#fff7b2';ctx.shadowColor='#f59e0b';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(m.x,m.y+bob,4.5,0,Math.PI*2);ctx.fill();ctx.restore()}
    ctx.restore();return;
  }
  const frameOld=player.moving?Math.floor(player.walk)%4:0,row=player.moving?1:0,fs=48,size=72;
  ctx.save();ctx.translate(0,bob);ctx.rotate(a);
  if(soldierReady&&soldierSprite.naturalWidth>=192){ctx.save();ctx.imageSmoothingEnabled=false;ctx.rotate(Math.PI/2);ctx.drawImage(soldierSprite,frameOld*fs,row*fs,fs,fs,-size/2,-size/2-5,size,size);ctx.restore()}else{ctx.fillStyle='#374151';ctx.beginPath();ctx.roundRect(-13,-19,26,38,8);ctx.fill();ctx.fillStyle='#556b2f';ctx.beginPath();ctx.roundRect(-10,-15,20,26,6);ctx.fill();ctx.fillStyle='#c7996b';ctx.beginPath();ctx.arc(0,-18,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3d4b27';ctx.beginPath();ctx.arc(0,-21,11,Math.PI,Math.PI*2);ctx.fill()}
  if(weaponReady){const recoil=player.shotFlash>0?-2:0;ctx.save();ctx.translate(11+recoil,-1);ctx.imageSmoothingEnabled=true;ctx.drawImage(weaponSprite,-7,-6,34,12);ctx.restore()}ctx.restore();ctx.restore();
}'''
s = s[:start] + newdraw + s[end:]
p.write_text(s, encoding='utf-8')
print('index.html patched to v0.13.8')
