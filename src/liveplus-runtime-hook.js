(()=>{'use strict';
const NativeBlob=window.Blob;
if(typeof NativeBlob!=='function'||window.__caosLivePlusRuntimeHook)return;
window.__caosLivePlusRuntimeHook=true;

function patchFollowHud(){
  const root=document.getElementById('livePlusBattleHud');
  if(!root)return;
  let rules=[];
  try{rules=JSON.parse(localStorage.getItem('caos-liveplus-hud-rules')||'[]')}catch{}
  const manifest=window.CaosLivePlus?.manifest,actions=Array.isArray(manifest?.actions)?manifest.actions:[];
  const follow=rules.find(r=>{
    if(r?.trigger!=='follow')return false;
    const a=actions.find(x=>x.id===r.actionId);
    return a?.hudSide==='player'||a?.donationGroup==='player';
  });
  const grid=root.querySelector('.lpSide.player .lpGiftGrid');
  if(!grid||!follow)return;
  if(grid.querySelector('[data-liveplus-follow-slot="1"]'))return;
  const empty=grid.querySelector('.lpGift.lpEmpty');
  if(!empty)return;
  const seconds=Math.max(1,Number(follow?.actionParams?.seconds)||8);
  const action=actions.find(a=>a.id===follow.actionId);
  const label=follow.actionId==='ghostally'?`Aliado Fantasma ${String(seconds).replace('.0','')}s`:(follow.actionLabel||action?.label||'Ação do player');
  empty.classList.remove('lpEmpty');
  empty.dataset.liveplusFollowSlot='1';
  empty.innerHTML='<div class="lpGiftMissing">👤</div><div class="lpGiftCopy"><b>NOVO SEGUIDOR</b><small>'+String(label).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</small></div>';
}
const hudObserver=new MutationObserver(()=>queueMicrotask(patchFollowHud));
document.addEventListener('DOMContentLoaded',()=>{hudObserver.observe(document.body,{childList:true,subtree:true});patchFollowHud()},{once:true});

window.Blob=new Proxy(NativeBlob,{construct(Target,args,newTarget){
  const parts=Array.isArray(args?.[0])?args[0]:[],options=args?.[1]||{};
  const type=String(options?.type||'').toLowerCase();
  if(type.includes('javascript')&&parts.some(p=>typeof p==='string'&&p.includes('function command(d){'))){
    args=[parts.map(part=>{
      if(typeof part!=='string'||!part.includes('function command(d){')||!part.includes('const SPATIAL=96;'))return part;
      let out=part;
      if(!out.includes('window.CaosLiveCommand=command;'))out=out.replace('const SPATIAL=96;','window.CaosLiveCommand=command;const SPATIAL=96;');
      if(!out.includes('LIVEPLUS_GHOST_ALLY')){
        const ghostInject=`/*LIVEPLUS_GHOST_ALLY*/
let livePlusGhostAllies=[],livePlusGhostSeq=0;
function livePlusGhostSegmentClear(ax,ay,bx,by,px,py,minDist){
  const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay,l2=vx*vx+vy*vy;
  const t=l2>0?Math.max(0,Math.min(1,(wx*vx+wy*vy)/l2)):0;
  return Math.hypot(px-(ax+vx*t),py-(ay+vy*t))>=minDist;
}
function livePlusGhostTarget(g){
  let best=null,bestScore=Infinity;
  for(const e of enemies){
    if(e.dead)continue;
    const dist=Math.hypot(e.x-g.x,e.y-g.y);
    if(dist>650||dist<24)continue;
    if(!livePlusGhostSegmentClear(g.x,g.y,e.x,e.y,player.x,player.y,54))continue;
    const boss=!!types[e.type]?.boss,score=dist-(boss?60:0);
    if(score<bestScore){bestScore=score;best=e}
  }
  return best;
}
function spawnLivePlusGhostAlly(d){
  if(!running||deathState)return;
  const seconds=Math.max(1,Math.min(120,+d.seconds||8)),now=performance.now();
  const user=String(d.user||'Seguidor').replace(/^@/,'').slice(0,24)||'Seguidor';
  const slot=livePlusGhostSeq++%6,angle=Math.PI/6+slot*Math.PI/3,dist=128+(slot%2)*20;
  const g={x:player.x+Math.cos(angle)*dist,y:player.y+Math.sin(angle)*dist,aim:angle+Math.PI,until:now+seconds*1000,born:now,nextShot:now+220+Math.random()*160,shotFlash:0,user,orbit:angle,walk:0};
  livePlusGhostAllies.push(g);
  if(livePlusGhostAllies.length>6)livePlusGhostAllies.shift();
  toast('👻 @'+user+' · ALIADO FANTASMA '+String(seconds).replace('.0','')+'s');
}
function updateLivePlusGhostAllies(dt){
  const now=performance.now();
  livePlusGhostAllies=livePlusGhostAllies.filter(g=>g.until>now);
  for(const g of livePlusGhostAllies){
    g.shotFlash=Math.max(0,g.shotFlash-dt);
    g.orbit+=dt*.65;
    const tx=player.x+Math.cos(g.orbit)*138,ty=player.y+Math.sin(g.orbit)*138,dx=tx-g.x,dy=ty-g.y,d=Math.hypot(dx,dy);
    if(d>2){const step=Math.min(d,145*dt);g.x+=dx/d*step;g.y+=dy/d*step;g.walk+=step*.05}
    const target=livePlusGhostTarget(g);
    if(!target){g.aim=g.orbit+Math.PI/2;continue}
    g.aim=Math.atan2(target.y-g.y,target.x-g.x);
    if(now<g.nextShot)continue;
    const m=muzzleLocal(playerFacing(g.aim));
    bullets.push({x:g.x+m.x*.78,y:g.y+m.y*.78,vx:Math.cos(g.aim)*610,vy:Math.sin(g.aim)*610,r:4,dead:false,ammo:1,born:now,pierceLeft:0,hits:[],iceHits:0,damage:Math.max(1,player.damage*.65),ice:false,explosive:false,owner:'p1',livePlusGhost:true});
    g.shotFlash=.12;
    g.nextShot=now+500+Math.random()*160;
  }
}
function drawLivePlusGhostAllies(){
  const now=performance.now(),last=drawLivePlusGhostAllies.__last||now,dt=Math.max(0,Math.min(.05,(now-last)/1000));drawLivePlusGhostAllies.__last=now;updateLivePlusGhostAllies(dt);
  for(const g of livePlusGhostAllies){
    const p=world(g.x,g.y);
    if(p.x<-90||p.x>W+90||p.y<-100||p.y>H+100)continue;
    const fadeIn=Math.min(1,(now-g.born)/260),fadeOut=Math.min(1,(g.until-now)/520),alpha=.62*Math.max(0,Math.min(fadeIn,fadeOut));
    const dir=playerFacing(g.aim||0),pack=playerArmedReady?playerArmedFrames:playerBaseFrames,arr=pack[dir]?.length?pack[dir]:pack.down,img=arr?.[Math.floor(g.walk)%Math.max(1,arr?.length||1)]||soldierSprite;
    ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=alpha;ctx.globalCompositeOperation='screen';
    const glow=ctx.createRadialGradient(0,0,8,0,0,42);glow.addColorStop(0,'rgba(125,211,252,.18)');glow.addColorStop(1,'rgba(125,211,252,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,42,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(0,24,21,6,0,0,Math.PI*2);ctx.fill();
    if(img&&(img.naturalWidth||img.width)){const h=76,ratio=(img.naturalWidth&&img.naturalHeight)?img.naturalWidth/img.naturalHeight:.8,w=Math.min(75,h*ratio);ctx.imageSmoothingEnabled=true;ctx.drawImage(img,-w/2,34-h,w,h)}
    if(g.shotFlash>0){const m=muzzleLocal(dir);ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle='#dff6ff';ctx.shadowColor='#38bdf8';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(m.x*.78,m.y*.78,4,0,Math.PI*2);ctx.fill();ctx.restore()}
    ctx.globalAlpha=Math.min(1,alpha+.22);const txt='@'+g.user;ctx.font='800 9px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const tw=ctx.measureText(txt).width+14,ty=-54;ctx.fillStyle='rgba(5,8,18,.82)';ctx.strokeStyle='rgba(56,189,248,.78)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(-tw/2,ty,tw,17,8);ctx.fill();ctx.stroke();ctx.fillStyle='#bae6fd';ctx.fillText(txt,0,ty+8.8);ctx.restore();
  }
}
`;
        out=out.replace('function command(d){',ghostInject+'function command(d){');
        out=out.replace('const c=d?.command;',"const c=d?.command;if(c==='ghostally')spawnLivePlusGhostAlly(d);");
        out=out.replace('drawDuoPlayer();drawPlayer();','drawDuoPlayer();drawLivePlusGhostAllies();drawPlayer();');
      }
      if(!out.includes('LIVEPLUS_METEOR_DODGE')&&out.includes('function autoVector(dt){')){
        const inject=`function autoVector(dt){/*LIVEPLUS_METEOR_DODGE*/
  const activeMeteors=meteors.filter(m=>!m.hit&&m.warningLeft>0);
  if(activeMeteors.length){
    const threats=activeMeteors.filter(m=>{const d=Math.hypot(player.x-m.x,player.y-m.y),margin=player.r+44,windowSec=Math.max(1.15,(m.warningTotal||m.warningLeft)*.92);return d<m.r+margin&&m.warningLeft<=windowSec});
    if(threats.length){
      const now=performance.now(),hold=autoVector.__meteorEscape;
      if(!hold||now>=hold.until){
        let bestX=0,bestY=0,bestScore=-Infinity;const prevX=hold?.x||autoMoveX||0,prevY=hold?.y||autoMoveY||0;
        for(let i=0;i<20;i++){
          const a=i*Math.PI*2/20,cx=Math.cos(a),cy=Math.sin(a),probe=155,px=player.x+cx*probe,py=player.y+cy*probe;let score=0,minClear=Infinity;
          for(const m of activeMeteors){const urgency=1/Math.max(.18,m.warningLeft),clear=Math.hypot(px-m.x,py-m.y)-m.r;minClear=Math.min(minClear,clear);score+=Math.min(180,clear)*urgency*.72;if(clear<player.r+18)score-=900+(player.r+18-clear)*20}
          for(const e of enemies){if(e.dead)continue;const d=Math.hypot(px-e.x,py-e.y),boss=!!types[e.type]?.boss,avoid=(boss?260:150)+e.r;if(d<avoid)score-=(avoid-d)*(boss?5.2:2.1)}
          score+=Math.max(-1,Math.min(1,cx*prevX+cy*prevY))*34;if(minClear>player.r+52)score+=85;
          if(score>bestScore){bestScore=score;bestX=cx;bestY=cy}
        }
        autoVector.__meteorEscape={x:bestX,y:bestY,until:now+230};
      }
      const esc=autoVector.__meteorEscape||{x:0,y:0},blend=1-Math.exp(-dt*13);autoMoveX=autoMoveX*(1-blend)+esc.x*blend;autoMoveY=autoMoveY*(1-blend)+esc.y*blend;const n=Math.hypot(autoMoveX,autoMoveY)||1;autoMoveX/=n;autoMoveY/=n;autoMoveStrength+=(1-autoMoveStrength)*(1-Math.exp(-dt*14));autoRetreatActive=true;return{x:autoMoveX*autoMoveStrength,y:autoMoveY*autoMoveStrength};
    }
    autoVector.__meteorEscape=null;
  }else autoVector.__meteorEscape=null;`;
        out=out.replace('function autoVector(dt){',inject);
      }
      return out;
    }),options];
  }
  return Reflect.construct(Target,args,newTarget===window.Blob?Target:newTarget);
}});
})();