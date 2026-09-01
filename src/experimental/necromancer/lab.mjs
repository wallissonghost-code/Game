import {createNecromancerPrototype,assertNecromancerPrototype} from './necromancer.mjs';
assertNecromancerPrototype();
const c=document.getElementById('c'),x=c.getContext('2d'),soul=document.getElementById('soul'),panel=document.getElementById('panel'),stats=document.getElementById('stats');
let W=0,H=0,last=performance.now(),spawn=0;const player={x:0,y:0,r:18,maxLife:100,damage:12},mobs=[];const necro=createNecromancerPrototype();
function resize(){const d=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;c.width=W*d;c.height=H*d;c.style.width=W+'px';c.style.height=H+'px';x.setTransform(d,0,0,d,0,0);player.x=W*.5;player.y=H*.5}addEventListener('resize',resize);resize();
function addMob(){const a=Math.random()*Math.PI*2,d=Math.max(W,H)*.42;const boss=Math.random()<.04;mobs.push({x:player.x+Math.cos(a)*d,y:player.y+Math.sin(a)*d,r:boss?24:11,hp:boss?180:30,max:boss?180:30,damage:boss?14:5,speed:boss?25:40,type:boss?'boss':'ogre',tier:boss?3:0,boss})}
for(let i=0;i<22;i++)addMob();
document.getElementById('raise').onclick=()=>{const e=mobs.find(m=>m.hp<=0)||mobs.splice(Math.floor(Math.random()*mobs.length),1)[0];if(e)necro.raise(e,player)};
soul.onclick=()=>panel.classList.toggle('show');panel.onclick=e=>{const k=e.target?.dataset?.up;if(k)necro.spendPoint(k,player)};
function nearest(from,list){let b=null,bd=Infinity;for(const e of list){const d=(e.x-from.x)**2+(e.y-from.y)**2;if(d<bd){bd=d;b=e}}return b}
function frame(now){const dt=Math.min(.033,(now-last)/1000);last=now;spawn-=dt;if(spawn<=0&&mobs.length<35){addMob();spawn=.35}
 const shadows=necro.snapshot().summons;
 for(const m of mobs){const target=Math.random()<.12&&shadows.length?nearest(m,shadows):player,dx=target.x-m.x,dy=target.y-m.y,d=Math.hypot(dx,dy)||1;m.x+=dx/d*m.speed*dt;m.y+=dy/d*m.speed*dt;if(target.id&&d<m.r+target.r+4)necro.damage(target.id,m.damage*dt*1.8)}
 for(const sh of shadows){const m=nearest(sh,mobs);if(!m)continue;const dx=m.x-sh.x,dy=m.y-sh.y,d=Math.hypot(dx,dy)||1;const live=necro.snapshot().summons.find(q=>q.id===sh.id);if(live){live.x=sh.x;live.y=sh.y}if(d>sh.r+m.r+8){sh.x+=dx/d*85*dt;sh.y+=dy/d*85*dt}else{m.hp-=sh.damage*dt*1.5;if(m.hp<=0){mobs.splice(mobs.indexOf(m),1);necro.recordKill(sh.id);addMob()}}}
 necro.update(dt,player);necro.removeDead();draw();requestAnimationFrame(frame)}
function draw(){x.fillStyle='#070913';x.fillRect(0,0,W,H);x.strokeStyle='#18213b';for(let gx=0;gx<W;gx+=48){x.beginPath();x.moveTo(gx,0);x.lineTo(gx,H);x.stroke()}for(let gy=0;gy<H;gy+=48){x.beginPath();x.moveTo(0,gy);x.lineTo(W,gy);x.stroke()}
 x.fillStyle='#67e8f9';x.beginPath();x.arc(player.x,player.y,player.r,0,7);x.fill();
 for(const m of mobs){x.fillStyle=m.boss?'#ef4444':'#f97316';x.beginPath();x.arc(m.x,m.y,m.r,0,7);x.fill()}
 const snap=necro.snapshot();for(const sh of snap.summons){x.save();x.shadowBlur=16;x.shadowColor='#a855f7';x.fillStyle='#7e22ce';x.beginPath();x.arc(sh.x,sh.y,sh.r+2,0,7);x.fill();x.restore();x.fillStyle='#111827';x.fillRect(sh.x-18,sh.y-sh.r-10,36,4);x.fillStyle='#c084fc';x.fillRect(sh.x-18,sh.y-sh.r-10,36*(sh.life/sh.maxLife),4)}soul.textContent=`☠ ${snap.soulPoints}`;stats.textContent=`Nv ${snap.soulLevel} · XP ${Math.floor(snap.soulXp)}/${snap.soulXpNeed} · Invocados ${snap.summons.length}/${snap.maxSummons} · Kills ${snap.totalSoulKills} · Vida +${snap.upgrades.life*10}% · Dano +${snap.upgrades.damage*8}%`;}
requestAnimationFrame(frame);