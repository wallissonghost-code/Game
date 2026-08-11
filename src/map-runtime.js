(()=>{'use strict';
const API={ready:false,name:'Campo / Pântano',version:'',init:null,drawGround:null,drawObjects:null,resolveCollisions:null};
window.CaosMap=API;
let cfg=null,loading=false;
const TILE_W=96,TILE_H=128,PROP_CELL=360,DECOR_CELL=240;
const tiles={dirt:[],moss:[],swamp:[],water:[],transitions:[]};
const propDefs=[
 {id:'bone_gate',path:'./assets/Map/field/obstacles/bone_gate_01.png',h:112,r:38,collide:true},
 {id:'hanging_cage',path:'./assets/Map/field/obstacles/hanging_cage_01.png',h:112,r:32,collide:true},
 {id:'ritual_pit',path:'./assets/Map/field/obstacles/ritual_pit_01.png',h:94,r:0,collide:false},
 {id:'spike_fence',path:'./assets/Map/field/obstacles/spike_fence_01.png',h:104,r:44,collide:true},
 {id:'stone_ruin',path:'./assets/Map/field/obstacles/stone_ruin_01.png',h:126,r:46,collide:true},
 {id:'stone_totem',path:'./assets/Map/field/obstacles/stone_totem_01.png',h:108,r:30,collide:true},
 {id:'wood_bridge',path:'./assets/Map/field/obstacles/wood_bridge_01.png',h:100,r:0,collide:false},
 {id:'rock_cluster',path:'./assets/Map/wasteland/obstacles/rock_cluster_01.png',h:112,r:42,collide:true,rare:true},
 {id:'dead_tree',path:'./assets/Map/wasteland/obstacles/dead_tree_01.png',h:132,r:38,collide:true,rare:true},
 {id:'barricade',path:'./assets/Map/wasteland/obstacles/barricade_01.png',h:108,r:48,collide:true,rare:true},
 {id:'wrecked_car',path:'./assets/Map/wasteland/obstacles/wrecked_car_01.png',h:116,r:52,collide:true,rare:true}
];
const decorDefs=[
 {id:'rocks',path:'./assets/Map/wasteland/decals/rocks_scatter_01.png',h:58},
 {id:'grass',path:'./assets/Map/wasteland/decals/dry_grass_patch_01.png',h:55},
 {id:'crack',path:'./assets/Map/wasteland/decals/cracked_earth_patch_01.png',h:62},
 {id:'oil',path:'./assets/Map/wasteland/decals/oil_stain_01.png',h:56}
];

function cropAlpha(img){try{const c=document.createElement('canvas'),x=c.getContext('2d',{willReadFrequently:true});c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let minX=c.width,minY=c.height,maxX=-1,maxY=-1;for(let y=0;y<c.height;y++)for(let xx=0;xx<c.width;xx++)if(d[(y*c.width+xx)*4+3]>8){if(xx<minX)minX=xx;if(xx>maxX)maxX=xx;if(y<minY)minY=y;if(y>maxY)maxY=y}if(maxX<0)return img;const pad=1,x0=Math.max(0,minX-pad),y0=Math.max(0,minY-pad),x1=Math.min(c.width-1,maxX+pad),y1=Math.min(c.height-1,maxY+pad),o=document.createElement('canvas');o.width=x1-x0+1;o.height=y1-y0+1;o.getContext('2d').drawImage(c,x0,y0,o.width,o.height,0,0,o.width,o.height);return o}catch{return img}}
function loadImg(path,crop=true,optional=false){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(crop?cropAlpha(im):im);im.onerror=()=>optional?resolve(null):reject(Error(path));im.src=path+'?v='+String(API.version||'map').replace(/\./g,'')})}
async function load(){if(loading||!cfg)return;loading=true;try{const groups={dirt:5,moss:10,swamp:7,water:7,transitions:6};for(const [kind,count] of Object.entries(groups)){tiles[kind]=await Promise.all(Array.from({length:count},(_,i)=>loadImg('./assets/Map/field/tiles/'+kind+'/'+kind+'_'+String(i+1).padStart(2,'0')+'.png',true,false)))}await Promise.all(propDefs.map(async d=>{d.img=await loadImg(d.path,true,!!d.rare)}));await Promise.all(decorDefs.map(async d=>{d.img=await loadImg(d.path,true,true)}));API.ready=tiles.dirt.length>0&&tiles.moss.length>0&&tiles.swamp.length>0&&tiles.water.length>0;console.log('CAOS MAP READY',{ready:API.ready,props:propDefs.filter(x=>x.img).length,decals:decorDefs.filter(x=>x.img).length})}catch(e){API.ready=false;console.warn('CAOS MAP FALLBACK',e)}finally{loading=false}}

API.init=o=>{cfg=o;API.version=String(o?.version||'');load()};
function H(x,y,s){return cfg.hash(x,y,s)}
function biome(tx,ty){if(Math.abs(tx)<=1&&Math.abs(ty)<=1)return H(tx,ty,803)>.45?'moss':'dirt';const rx=Math.floor(tx/4),ry=Math.floor(ty/4),coarse=H(rx,ry,811),fine=H(tx,ty,812)*.13,n=Math.min(.999,coarse*.87+fine);return n<.14?'water':n<.38?'swamp':n<.72?'moss':'dirt'}
function tileFor(tx,ty){const k=biome(tx,ty),a=tiles[k];return a[Math.floor(H(tx,ty,821)*a.length)%a.length]}
function propAt(cx,cy){if(H(cx,cy,901)>.34)return null;const x=(cx+.14+H(cx,cy,902)*.72)*PROP_CELL,y=(cy+.14+H(cx,cy,903)*.72)*PROP_CELL;if(Math.hypot(x,y)<175)return null;let pool=propDefs.filter(d=>d.img);if(!pool.length)return null;const rareRoll=H(cx,cy,904),normal=pool.filter(d=>!d.rare),rare=pool.filter(d=>d.rare);if(rare.length&&rareRoll<.22)pool=rare;else if(normal.length)pool=normal;const def=pool[Math.floor(H(cx,cy,905)*pool.length)%pool.length];return{x,y,cx,cy,def}}
function decorAt(cx,cy){if(H(cx,cy,931)>.46)return null;const pool=decorDefs.filter(d=>d.img);if(!pool.length)return null;const x=(cx+.08+H(cx,cy,932)*.84)*DECOR_CELL,y=(cy+.08+H(cx,cy,933)*.84)*DECOR_CELL;if(Math.hypot(x,y)<90)return null;return{x,y,cx,cy,def:pool[Math.floor(H(cx,cy,934)*pool.length)%pool.length]}}
function nearby(cell,fn,extra=2){const p=cfg.player(),v=cfg.viewport(),rx=Math.ceil(v.W/cell/2)+extra,ry=Math.ceil(v.H/cell/2)+extra,cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell),out=[];for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++){const o=fn(x,y);if(o)out.push(o)}return out}
function drawAsset(o,alpha=1){const {ctx}=cfg,im=o.def.img;if(!im)return;const p=cfg.world(o.x,o.y),ratio=(im.width||im.naturalWidth||1)/Math.max(1,(im.height||im.naturalHeight||1)),h=o.def.h,w=h*ratio,v=cfg.viewport();if(p.x<-w||p.x>v.W+w||p.y<-h||p.y>v.H+h)return;ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=true;ctx.drawImage(im,p.x-w/2,p.y-h*.52,w,h);ctx.restore()}

API.drawGround=()=>{if(!API.ready||!cfg)return false;const {ctx}=cfg,p=cfg.player(),v=cfg.viewport(),left=p.x-v.W/2-TILE_W*2,right=p.x+v.W/2+TILE_W*2,top=p.y-v.H/2-TILE_H*2,bottom=p.y+v.H/2+TILE_H*2,minX=Math.floor(left/TILE_W),maxX=Math.ceil(right/TILE_W),minY=Math.floor(top/TILE_H),maxY=Math.ceil(bottom/TILE_H);ctx.fillStyle='#26351e';ctx.fillRect(0,0,v.W,v.H);ctx.save();ctx.imageSmoothingEnabled=true;for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){const im=tileFor(tx,ty);if(!im)continue;const q=cfg.world(tx*TILE_W,ty*TILE_H);ctx.drawImage(im,q.x-2,q.y-2,TILE_W+4,TILE_H+4)}ctx.restore();const g=ctx.createRadialGradient(v.W/2,v.H/2,80,v.W/2,v.H/2,Math.max(v.W,v.H)*.72);g.addColorStop(0,'rgba(7,12,8,0)');g.addColorStop(1,'rgba(4,8,6,.26)');ctx.fillStyle=g;ctx.fillRect(0,0,v.W,v.H);return true};
API.drawObjects=()=>{if(!API.ready||!cfg)return;for(const d of nearby(DECOR_CELL,decorAt,1))drawAsset(d,.74);const a=nearby(PROP_CELL,propAt,2).sort((x,y)=>x.y-y.y);for(const o of a)drawAsset(o,1)};
function resolveOne(t,r,o,slide){if(!o.def.collide||!o.def.r)return;let dx=t.x-o.x,dy=t.y-o.y,d=Math.hypot(dx,dy),min=r+o.def.r;if(d>=min)return;if(d<.001){const a=H(o.cx,o.cy,977)*Math.PI*2;dx=Math.cos(a);dy=Math.sin(a);d=1}const ux=dx/d,uy=dy/d,overlap=Math.min(22,min-d+.5);t.x+=ux*overlap;t.y+=uy*overlap;if(slide){const side=H(o.cx,o.cy,Math.floor((t.seed||1)*17))>.5?1:-1;t.x+=-uy*overlap*.22*side;t.y+=ux*overlap*.22*side}}
API.resolveCollisions=()=>{if(!API.ready||!cfg)return;const objs=nearby(PROP_CELL,propAt,2).filter(o=>o.def.collide),p=cfg.player();for(const o of objs)resolveOne(p,p.r||18,o,false);for(const e of cfg.enemies()){if(e.dead)continue;for(const o of objs)resolveOne(e,e.r||16,o,true)}};
})();
