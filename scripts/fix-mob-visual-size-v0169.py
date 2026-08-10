from pathlib import Path
p=Path('src/game.js')
s=p.read_text()
s=s.replace("const VERSION='0.16.8'","const VERSION='0.16.9'",1)
old="async function loadDirectPngSequence(folder,count,cacheTag='0168'){const arr=[];for(let i=1;i<=count;i++){const img=new Image(),name=`frame_${String(i).padStart(3,'0')}.png`;await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error(folder+'/'+name));img.src=`${folder}/${name}?v=${cacheTag}`});arr.push(img)}return arr}"
new="""async function cropAlphaFrame(img){const c=document.createElement('canvas'),x=c.getContext('2d',{willReadFrequently:true});c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let minX=c.width,minY=c.height,maxX=-1,maxY=-1;for(let y=0;y<c.height;y++)for(let xx=0;xx<c.width;xx++)if(d[(y*c.width+xx)*4+3]>12){if(xx<minX)minX=xx;if(xx>maxX)maxX=xx;if(y<minY)minY=y;if(y>maxY)maxY=y}if(maxX<0)return img;const pad=2,x0=Math.max(0,minX-pad),y0=Math.max(0,minY-pad),w=Math.min(c.width-1,maxX+pad)-x0+1,h=Math.min(c.height-1,maxY+pad)-y0+1,o=document.createElement('canvas');o.width=w;o.height=h;o.getContext('2d').drawImage(c,x0,y0,w,h,0,0,w,h);return o}
async function loadDirectPngSequence(folder,count,cacheTag='0169'){const arr=[];for(let i=1;i<=count;i++){const img=new Image(),name=`frame_${String(i).padStart(3,'0')}.png`;await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error(folder+'/'+name));img.src=`${folder}/${name}?v=${cacheTag}`});arr.push(folder.includes('/mobs')?await cropAlphaFrame(img):img)}return arr}"""
if old not in s: raise SystemExit('loader pattern not found')
s=s.replace(old,new,1)
old2="const tierScale=e.tier===2?1.10:e.tier===1?1.05:1,h=(isBoss?e.r*3.55:62)*tierScale,ratio=(img.naturalWidth&&img.naturalHeight)?img.naturalWidth/img.naturalHeight:1,w=h*ratio;"
new2="const h=isBoss?e.r*3.55:62,ratio=(img.naturalWidth&&img.naturalHeight)?img.naturalWidth/img.naturalHeight:1,w=h*ratio;"
if old2 not in s: raise SystemExit('scale pattern not found')
s=s.replace(old2,new2,1)
p.write_text(s)
Path('version.json').write_text('{\n  "version": "0.16.9",\n  "build": "uniform-visible-mob-size"\n}\n')
q=Path('index.html');t=q.read_text().replace('0.16.8','0.16.9').replace('0168','0169');q.write_text(t)
