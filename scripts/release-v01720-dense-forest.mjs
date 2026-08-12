import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(s,n,label)=>{if(!s.includes(n))throw new Error('Marcador ausente: '+label)};

let game=read('src/game.js');
must(game,"VERSION='0.17.19'",'versao 0.17.19');
game=game.replace("VERSION='0.17.19'","VERSION='0.17.20'");
game=game.replace("map:'field'","map:'dense-forest'");
write('src/game.js',game);

for(const p of ['index.html','painel.html','painel-live.html']){
  if(!fs.existsSync(p))continue;
  let s=read(p).replaceAll('0.17.19','0.17.20').replaceAll('01719','01720');
  write(p,s);
}
write('version.json',JSON.stringify({version:'0.17.20',build:'dense-forest-cohesive-map'},null,2)+'\n');

const runtime=String.raw`(()=>{'use strict';
const API={ready:false,name:'Floresta Densa',active:'dense-forest',version:'',init:null,drawGround:null,drawObjects:null,resolveCollisions:null};
window.CaosMap=API;
let cfg=null,loading=false;
const TILE=128,PROP_CELL=330,DECOR_CELL=190;
const tiles=[],decals=[],props=[];
const BASE_TILE_INDEXES=[0,1,2,3,7,8];
const PROP_META=[
 {h:62,r:22,c:1},{h:54,r:0,c:0},{h:108,r:36,c:1},{h:72,r:30,c:1},{h:42,r:0,c:0},
 {h:84,r:34,c:1},{h:58,r:24,c:1},{h:102,r:28,c:1},{h:112,r:42,c:1},{h:78,r:32,c:1},
 {h:96,r:0,c:0},{h:112,r:0,c:0},{h:92,r:0,c:0},{h:100,r:30,c:1},{h:62,r:22,c:1},
 {h:66,r:24,c:1},{h:58,r:20,c:1},{h:54,r:0,c:0},{h:56,r:0,c:0},{h:52,r:0,c:0},{h:48,r:0,c:0}
];
function cropAlpha(img){try{const c=document.createElement('canvas'),x=c.getContext('2d',{willReadFrequently:true});c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let minX=c.width,minY=c.height,maxX=-1,maxY=-1;for(let y=0;y<c.height;y++)for(let xx=0;xx<c.width;xx++)if(d[(y*c.width+xx)*4+3]>8){minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}if(maxX<0)return img;const pad=2,x0=Math.max(0,minX-pad),y0=Math.max(0,minY-pad),x1=Math.min(c.width-1,maxX+pad),y1=Math.min(c.height-1,maxY+pad),o=document.createElement('canvas');o.width=x1-x0+1;o.height=y1-y0+1;o.getContext('2d').drawImage(c,x0,y0,o.width,o.height,0,0,o.width,o.height);return o}catch{return img}}
function cropTile(img){try{const inset=9,w=(img.naturalWidth||img.width)-inset*2,h=(img.naturalHeight||img.height)-inset*2,o=document.createElement('canvas');o.width=Math.max(1,w);o.height=Math.max(1,h);o.getContext('2d').drawImage(img,inset,inset,w,h,0,0,w,h);return o}catch{return img}}
function loadImg(path,mode='alpha'){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(mode==='tile'?cropTile(im):cropAlpha(im));im.onerror=()=>reject(Error(path));im.src=path+'?v='+String(API.version||'map').replace(/\./g,'')})}
async function load(){if(loading||!cfg)return;loading=true;try{
 for(let i=1;i<=10;i++)tiles.push(await loadImg('./assets/Map/dense-forest/tiles/tile_'+String(i).padStart(3,'0')+'.png','tile'));
 for(let i=1;i<=15;i++)decals.push({img:await loadImg('./assets/Map/dense-forest/decals/decal_'+String(i).padStart(3,'0')+'.png'),h:42+(i%5)*5});
 for(let i=1;i<=21;i++){const m=PROP_META[i-1];props.push({img:await loadImg('./assets/Map/dense-forest/obstacles/obstacle_'+String(i).padStart(3,'0')+'.png'),h:m.h,r:m.r,collide:!!m.c,id:i})}
 API.ready=tiles.length===10&&decals.length===15&&props.length===21;console.log('CAOS MAP DENSE FOREST READY',{ready:API.ready,tiles:tiles.length,decals:decals.length,props:props.length})
}catch(e){API.ready=false;console.warn('CAOS MAP DENSE FOREST FALLBACK',e)}finally{loading=false}}
API.init=o=>{cfg=o;API.version=String(o?.version||'');load()};
function H(x,y,s){return cfg.hash(x,y,s)}
function tileFor(tx,ty){const rx=Math.floor(tx/3),ry=Math.floor(ty/3),base=BASE_TILE_INDEXES[Math.floor(H(rx,ry,410)*BASE_TILE_INDEXES.length)%BASE_TILE_INDEXES.length],j=H(tx,ty,411);let idx=base;if(j<.18)idx=BASE_TILE_INDEXES[Math.floor(H(tx,ty,412)*BASE_TILE_INDEXES.length)%BASE_TILE_INDEXES.length];return tiles[idx]||tiles[0]}
function decorAt(cx,cy){if(H(cx,cy,520)>.58)return null;const x=(cx+.08+H(cx,cy,521)*.84)*DECOR_CELL,y=(cy+.08+H(cx,cy,522)*.84)*DECOR_CELL;if(Math.hypot(x,y)<95)return null;const def=decals[Math.floor(H(cx,cy,523)*decals.length)%decals.length];return{x,y,cx,cy,def}}
function propAt(cx,cy){if(H(cx,cy,620)>.30)return null;const x=(cx+.14+H(cx,cy,621)*.72)*PROP_CELL,y=(cy+.14+H(cx,cy,622)*.72)*PROP_CELL;if(Math.hypot(x,y)<190)return null;const def=props[Math.floor(H(cx,cy,623)*props.length)%props.length];return{x,y,cx,cy,def}}
function nearby(cell,fn,extra=2){const p=cfg.player(),v=cfg.viewport(),rx=Math.ceil(v.W/cell/2)+extra,ry=Math.ceil(v.H/cell/2)+extra,cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell),out=[];for(let y=cy-ry;y<=cy+ry;y++)for(let x=cx-rx;x<=cx+rx;x++){const o=fn(x,y);if(o)out.push(o)}return out}
function drawAsset(o,alpha=1){const im=o.def.img;if(!im)return;const {ctx}=cfg,p=cfg.world(o.x,o.y),ratio=(im.width||im.naturalWidth||1)/Math.max(1,(im.height||im.naturalHeight||1)),h=o.def.h,w=h*ratio,v=cfg.viewport();if(p.x<-w||p.x>v.W+w||p.y<-h||p.y>v.H+h)return;ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=true;ctx.drawImage(im,p.x-w/2,p.y-h*.58,w,h);ctx.restore()}
API.drawGround=()=>{if(!API.ready||!cfg)return false;const {ctx}=cfg,p=cfg.player(),v=cfg.viewport(),left=p.x-v.W/2-TILE*2,right=p.x+v.W/2+TILE*2,top=p.y-v.H/2-TILE*2,bottom=p.y+v.H/2+TILE*2,minX=Math.floor(left/TILE),maxX=Math.ceil(right/TILE),minY=Math.floor(top/TILE),maxY=Math.ceil(bottom/TILE);ctx.fillStyle='#22341b';ctx.fillRect(0,0,v.W,v.H);ctx.save();ctx.imageSmoothingEnabled=true;for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){const im=tileFor(tx,ty);if(!im)continue;const q=cfg.world(tx*TILE,ty*TILE);ctx.drawImage(im,q.x-3,q.y-3,TILE+6,TILE+6)}ctx.restore();ctx.fillStyle='rgba(8,25,9,.07)';ctx.fillRect(0,0,v.W,v.H);const g=ctx.createRadialGradient(v.W/2,v.H/2,90,v.W/2,v.H/2,Math.max(v.W,v.H)*.78);g.addColorStop(0,'rgba(2,8,3,0)');g.addColorStop(1,'rgba(2,8,3,.22)');ctx.fillStyle=g;ctx.fillRect(0,0,v.W,v.H);return true};
API.drawObjects=()=>{if(!API.ready||!cfg)return;for(const d of nearby(DECOR_CELL,decorAt,1))drawAsset(d,.88);const list=nearby(PROP_CELL,propAt,2).sort((a,b)=>a.y-b.y);for(const o of list)drawAsset(o,1)};
function resolveOne(t,r,o,slide){if(!o.def.collide||!o.def.r)return;let dx=t.x-o.x,dy=t.y-o.y,d=Math.hypot(dx,dy),min=r+o.def.r;if(d>=min)return;if(d<.001){const a=H(o.cx,o.cy,777)*Math.PI*2;dx=Math.cos(a);dy=Math.sin(a);d=1}const ux=dx/d,uy=dy/d,overlap=Math.min(20,min-d+.5);t.x+=ux*overlap;t.y+=uy*overlap;if(slide){const side=H(o.cx,o.cy,778)>.5?1:-1;t.x+=-uy*overlap*.20*side;t.y+=ux*overlap*.20*side}}
API.resolveCollisions=()=>{if(!API.ready||!cfg)return;const objs=nearby(PROP_CELL,propAt,2).filter(o=>o.def.collide),p=cfg.player();for(const o of objs)resolveOne(p,p.r||18,o,false);for(const e of cfg.enemies()){if(e.dead)continue;for(const o of objs)resolveOne(e,e.r||16,o,true)}};
})();
`;
write('src/map-runtime.js',runtime);

let checks=read('scripts/check-game.mjs');
const old='// v0.17.19 · Field map runtime';
const pos=checks.indexOf(old);
if(pos>=0)checks=checks.slice(0,pos).trimEnd()+'\n';
checks+=`\n// v0.17.20 · Dense Forest cohesive map\nconst mapRuntime=read('src/map-runtime.js');\nif(!gameHtml.includes('src/map-runtime.js?v='+cacheTag)) fail('map-runtime sem cache sincronizado'); else ok('map-runtime cache '+cacheTag);\nif(!game.includes("map:'dense-forest'")) fail('telemetria do mapa divergente'); else ok('mapa ativo dense-forest');\nif(!mapRuntime.includes("name:'Floresta Densa'")) fail('runtime Floresta Densa ausente'); else ok('runtime Floresta Densa');\nif(!mapRuntime.includes('BASE_TILE_INDEXES=[0,1,2,3,7,8]')) fail('selecao segura de tiles ausente'); else ok('tiles de base coesos');\nfor(const f of ['assets/Map/dense-forest/tiles/tile_001.png','assets/Map/dense-forest/tiles/tile_010.png','assets/Map/dense-forest/decals/decal_015.png','assets/Map/dense-forest/obstacles/obstacle_021.png']) fs.existsSync(f)?ok('map asset '+f):fail('map asset ausente '+f);\nfor(const d of ['field','wasteland','extras-uploaded']) if(fs.existsSync('assets/Map/'+d)) fail('mapa antigo ainda existe: '+d); else ok('mapa antigo removido: '+d);\nif(fs.existsSync('assets/CAOS_LIVE_WORLDS_FINAL_CORRIGIDO.zip')) fail('ZIP de upload ainda na pasta assets'); else ok('ZIP extraido e removido');\nconst expectedWorlds=['cave-mines','dense-forest','desert-canyon','ruined-city','shadow-corruption','snow-frost'];\nconst actualWorlds=fs.readdirSync('assets/Map',{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort();\nif(JSON.stringify(actualWorlds)!==JSON.stringify(expectedWorlds)) fail('pastas de mundos divergentes: '+actualWorlds.join(',')); else ok('6 mundos novos organizados');\n`;
write('scripts/check-game.mjs',checks);

let assets=read('assets/README.md');
const oldSection='## Mapa Campo / Pântano · v0.17.19';
const si=assets.indexOf(oldSection);
if(si>=0)assets=assets.slice(0,si).trimEnd()+'\n';
assets+='\n## Biblioteca de Mundos · v0.17.20\n- O mapa Campo/Pântano e os extras Wasteland antigos foram removidos.\n- A biblioteca atual veio exclusivamente de `CAOS_LIVE_WORLDS_FINAL_CORRIGIDO.zip`.\n- Mundos disponíveis: Dense Forest, Cave Mines, Ruined City, Snow Frost, Shadow Corruption e Desert Canyon.\n- Mundo ativo para teste: **Dense Forest**.\n- O runtime recorta as bordas escuras dos tiles e usa sobreposição de 6 px para reduzir emendas visuais.\n- Decals não possuem colisão; obstáculos sólidos selecionados possuem colisão leve para player e mobs.\n';
write('assets/README.md',assets);
console.log('v0.17.20 Dense Forest release preparado');
