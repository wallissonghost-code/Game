(()=>{'use strict';
if(window.CaosGhostAllyCompanion)return;

const RUNTIME_MARKER='LIVEPLUS_GHOST_ALLY_V2';

function apply(source){
  if(typeof source!=='string'||source.includes(RUNTIME_MARKER))return source;
  if(!source.includes('function command(d){')||!source.includes('drawDuoPlayer();drawPlayer();'))return source;

  const inject=`/*LIVEPLUS_GHOST_ALLY_V2*/
let livePlusGhostAllies=[],livePlusGhostSeq=0,livePlusGhostCandidates=[],livePlusGhostCandidatesAt=0,livePlusGhostTelemetryAt=0;
function livePlusGhostSegmentClear(ax,ay,bx,by,px,py,minDist){
  const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay,l2=vx*vx+vy*vy;
  const t=l2>0?Math.max(0,Math.min(1,(wx*vx+wy*vy)/l2)):0;
  return Math.hypot(px-(ax+vx*t),py-(ay+vy*t))>=minDist;
}
function livePlusGhostPerf(){
  const fps=Math.max(0,Number(window.caosCurrentFps||window.__caosFps||60));
  if(fps>=52)return{fps,seekMs:125,shooters:6,bulletCap:16,fireMin:520,fireJitter:160,fx:2};
  if(fps>=44)return{fps,seekMs:155,shooters:5,bulletCap:14,fireMin:570,fireJitter:180,fx:2};
  if(fps>=36)return{fps,seekMs:190,shooters:4,bulletCap:11,fireMin:650,fireJitter:210,fx:1};
  if(fps>=28)return{fps,seekMs:240,shooters:3,bulletCap:8,fireMin:760,fireJitter:230,fx:1};
  return{fps,seekMs:310,shooters:2,bulletCap:6,fireMin:900,fireJitter:260,fx:0};
}
function livePlusGhostRefreshCandidates(now,perf){
  if(now<livePlusGhostCandidatesAt)return;
  livePlusGhostCandidatesAt=now+perf.seekMs;
  const maxR2=760*760,next=[];
  for(const e of enemies){
    if(e.dead)continue;
    const dx=e.x-player.x,dy=e.y-player.y,d2=dx*dx+dy*dy;
    if(d2>maxR2)continue;
    next.push(e);
    if(next.length>=72)break;
  }
  livePlusGhostCandidates=next;
}
function livePlusGhostTarget(g,now,perf){
  if(g.target&&!g.target.dead&&now<g.targetUntil)return g.target;
  let best=null,bestScore=Infinity;
  for(const e of livePlusGhostCandidates){
    if(!e||e.dead)continue;
    const dx=e.x-g.x,dy=e.y-g.y,dist2=dx*dx+dy*dy;
    if(dist2>650*650||dist2<24*24)continue;
    if(!livePlusGhostSegmentClear(g.x,g.y,e.x,e.y,player.x,player.y,54))continue;
    const dist=Math.sqrt(dist2),boss=!!types[e.type]?.boss,score=dist-(boss?60:0);
    if(score<bestScore){bestScore=score;best=e}
  }
  g.target=best;
  g.targetUntil=now+perf.seekMs+(g.slot%3)*17;
  return best;
}
function livePlusGhostActiveShooter(g,now,perf){
  const total=Math.max(1,livePlusGhostAllies.length),budget=Math.min(total,perf.shooters);
  if(budget>=total)return true;
  const phase=Math.floor(now/850)%total;
  return ((g.slot+phase)%total)<budget;
}
function livePlusGhostBulletCount(){
  let n=0;
  for(const b of bullets)if(!b.dead&&b.livePlusGhost)n++;
  return n;
}
function spawnLivePlusGhostAlly(d){
  if(!running||deathState)return;
  const seconds=Math.max(1,Math.min(120,+d.seconds||8)),now=performance.now();
  const user=String(d.user||'Seguidor').replace(/^@/,'').slice(0,24)||'Seguidor';
  const slot=livePlusGhostSeq++%6,angle=Math.PI/6+slot*Math.PI/3,dist=128+(slot%2)*20;
  const g={slot,x:player.x+Math.cos(angle)*dist,y:player.y+Math.sin(angle)*dist,aim:angle+Math.PI,until:now+seconds*1000,born:now,nextShot:now+250+(slot%3)*55,shotFlash:0,user,orbit:angle,walk:0,target:null,targetUntil:0,nameWidth:0};
  livePlusGhostAllies.push(g);
  if(livePlusGhostAllies.length>6)livePlusGhostAllies.shift();
  toast('👻 @'+user+' · ALIADO FANTASMA '+String(seconds).replace('.0','')+'s');
}
function updateLivePlusGhostAllies(dt){
  const now=performance.now(),perf=livePlusGhostPerf();
  livePlusGhostAllies=livePlusGhostAllies.filter(g=>g.until>now);
  if(!livePlusGhostAllies.length)return;
  livePlusGhostRefreshCandidates(now,perf);
  let ghostBullets=livePlusGhostBulletCount();
  for(const g of livePlusGhostAllies){
    g.shotFlash=Math.max(0,g.shotFlash-dt);
    g.orbit+=dt*.62;
    const radius=136+(g.slot%2)*10,tx=player.x+Math.cos(g.orbit)*radius,ty=player.y+Math.sin(g.orbit)*radius,dx=tx-g.x,dy=ty-g.y,d=Math.hypot(dx,dy);
    if(d>2){const step=Math.min(d,142*dt);g.x+=dx/d*step;g.y+=dy/d*step;g.walk+=step*.05}
    const target=livePlusGhostTarget(g,now,perf);
    if(!target){g.aim=g.orbit+Math.PI/2;continue}
    g.aim=Math.atan2(target.y-g.y,target.x-g.x);
    if(now<g.nextShot||ghostBullets>=perf.bulletCap||!livePlusGhostActiveShooter(g,now,perf))continue;
    if(!livePlusGhostSegmentClear(g.x,g.y,target.x,target.y,player.x,player.y,54)){g.target=null;g.targetUntil=0;continue}
    const dir=playerFacing(g.aim),m=muzzleLocal(dir);
    bullets.push({x:g.x+m.x,y:g.y+m.y,vx:Math.cos(g.aim)*610,vy:Math.sin(g.aim)*610,r:4,dead:false,ammo:1,born:now,pierceLeft:0,hits:[],iceHits:0,damage:Math.max(1,player.damage*.65),ice:false,explosive:false,owner:'p1',livePlusGhost:true});
    ghostBullets++;
    g.shotFlash=.11;
    g.nextShot=now+perf.fireMin+Math.random()*perf.fireJitter;
  }
  if(now>=livePlusGhostTelemetryAt){
    livePlusGhostTelemetryAt=now+500;
    window.__caosGhostPerf={allies:livePlusGhostAllies.length,candidates:livePlusGhostCandidates.length,bullets:ghostBullets,fps:perf.fps,shooters:Math.min(livePlusGhostAllies.length,perf.shooters),bulletCap:perf.bulletCap,seekMs:perf.seekMs};
  }
}
function livePlusGhostWeaponLayout(dir){
  return({
    down:{x:2,y:-1,maxW:38,maxH:58,flip:false},dr:{x:16,y:-6,maxW:62,maxH:38,flip:false},right:{x:20,y:-5,maxW:70,maxH:34,flip:true},ur:{x:15,y:-13,maxW:60,maxH:38,flip:false},
    up:{x:0,y:-19,maxW:38,maxH:58,flip:false},ul:{x:-15,y:-13,maxW:60,maxH:38,flip:false},left:{x:-20,y:-5,maxW:70,maxH:34,flip:false},dl:{x:-16,y:-6,maxW:62,maxH:38,flip:false}
  })[dir]||{x:2,y:-1,maxW:38,maxH:58,flip:false};
}
function livePlusGhostDrawWeapon(g,dir,frame,bob){
  const wa=playerWeaponFrames[dir]?.length?playerWeaponFrames[dir]:playerWeaponFrames.down,wi=wa?.[frame%Math.max(1,wa.length)]||wa?.[0]||weaponSprite;
  if(!wi||(!(wi.naturalWidth||wi.width)))return;
  const q=livePlusGhostWeaponLayout(dir),iw=wi.naturalWidth||wi.width||1,ih=wi.naturalHeight||wi.height||1,ratio=iw/Math.max(1,ih);let ww=q.maxW,wh=ww/Math.max(.05,ratio);
  if(wh>q.maxH){wh=q.maxH;ww=wh*ratio}
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.translate(q.x,q.y+bob);if(q.flip)ctx.scale(-1,1);ctx.drawImage(wi,-ww/2,-wh/2,ww,wh);ctx.restore();
}
function drawLivePlusGhostAllies(){
  const now=performance.now(),last=drawLivePlusGhostAllies.__last||now,dt=Math.max(0,Math.min(.05,(now-last)/1000));drawLivePlusGhostAllies.__last=now;
  updateLivePlusGhostAllies(dt);
  if(!livePlusGhostAllies.length)return;
  const perf=livePlusGhostPerf();
  for(const g of livePlusGhostAllies){
    const p=world(g.x,g.y);if(p.x<-90||p.x>W+90||p.y<-100||p.y>H+100)continue;
    const fadeIn=Math.min(1,(now-g.born)/260),fadeOut=Math.min(1,(g.until-now)/520),alpha=.66*Math.max(0,Math.min(fadeIn,fadeOut));
    const dir=playerFacing(g.aim||0),frame=Math.floor(g.walk)%4,bob=Math.sin(g.walk*Math.PI*.5)*.6,pack=playerArmedReady?playerArmedFrames:playerBaseFrames,arr=pack[dir]?.length?pack[dir]:pack.down,img=arr?.[frame%Math.max(1,arr?.length||1)]||soldierSprite;
    ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=alpha;
    if(perf.fx>0){ctx.fillStyle=perf.fx>1?'rgba(56,189,248,.10)':'rgba(56,189,248,.065)';ctx.beginPath();ctx.arc(0,2,36,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle='rgba(0,0,0,.30)';ctx.beginPath();ctx.ellipse(0,25,22,6,0,0,Math.PI*2);ctx.fill();
    const weaponBehind=['up','ur','ul'].includes(dir);
    if(weaponBehind)livePlusGhostDrawWeapon(g,dir,frame,bob);
    if(img&&(img.naturalWidth||img.width)){const h=80,ratio=(img.naturalWidth&&img.naturalHeight)?img.naturalWidth/img.naturalHeight:.8,w=Math.min(78,h*ratio),bottom=36+bob;ctx.imageSmoothingEnabled=true;ctx.drawImage(img,-w/2,bottom-h,w,h)}
    if(!weaponBehind)livePlusGhostDrawWeapon(g,dir,frame,bob);
    if(g.shotFlash>0){const m=muzzleLocal(dir);ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=Math.min(1,alpha+.28);ctx.fillStyle='#dff6ff';if(perf.fx>1){ctx.shadowColor='#38bdf8';ctx.shadowBlur=10}ctx.beginPath();ctx.arc(m.x,m.y+bob,3.8,0,Math.PI*2);ctx.fill();ctx.restore()}
    ctx.globalAlpha=Math.min(1,alpha+.22);const txt='@'+g.user;ctx.font='800 9px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';if(!g.nameWidth)g.nameWidth=ctx.measureText(txt).width+14;const tw=g.nameWidth,ty=-54;ctx.fillStyle='rgba(5,8,18,.82)';ctx.strokeStyle='rgba(56,189,248,.70)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(-tw/2,ty,tw,17,8);ctx.fill();ctx.stroke();ctx.fillStyle='#bae6fd';ctx.fillText(txt,0,ty+8.8);ctx.restore();
  }
}
`;
  let out=source.replace('function command(d){',inject+'function command(d){');
  out=out.replace('const c=d?.command;',"const c=d?.command;if(c==='ghostally')spawnLivePlusGhostAlly(d);");
  out=out.replace('drawDuoPlayer();drawPlayer();','drawDuoPlayer();drawLivePlusGhostAllies();drawPlayer();');
  return out;
}

window.CaosGhostAllyCompanion=Object.freeze({apply,version:'2.0.0'});
})();