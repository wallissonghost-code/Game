export function createProjectileState(){
  return {
    shotTimer:0,
    bullets:[],
    flashCounter:0,
    pierceShotCounter:0,
    iceShotCounter:0,
    explosiveShotCounter:0,
    ciShotsFired:0,
    ciShotsHit:0,
    ciShotsExpired:0,
    ciPierceShots:0,
    ciIceShots:0,
    ciExplosiveShots:0,
    ciLastShot:null
  };
}

export function buildShotGeometry({player,target=null,visualAim,directionForAim,muzzleForDirection}){
  if(!player||!Number.isFinite(visualAim))return null;
  if(typeof directionForAim!=='function'||typeof muzzleForDirection!=='function')return null;
  const dir=directionForAim(visualAim);
  const raw=muzzleForDirection(dir)||{x:0,y:0};
  const rawX=Number(raw.x)||0,rawY=Number(raw.y)||0;
  const rawLen=Math.hypot(rawX,rawY)||1;
  const targetDist=target?Math.hypot((Number(target.x)||0)-player.x,(Number(target.y)||0)-player.y):Infinity;
  const targetR=target?Math.max(4,Number(target.r)||12):0;
  const safeLen=target?Math.max(player.r*.5,targetDist-targetR-6):rawLen;
  const muzzleScale=target?Math.max(.18,Math.min(1,safeLen/rawLen)):1;
  const muzzleX=rawX*muzzleScale,muzzleY=rawY*muzzleScale;
  const spawnX=player.x+muzzleX,spawnY=player.y+muzzleY;
  const aim=target?Math.atan2(target.y-spawnY,target.x-spawnX):visualAim;
  if(!Number.isFinite(aim))return null;
  return {dir,spawnX,spawnY,aim,visualAim,muzzleScale,muzzleX,muzzleY};
}

export function createProjectile({shotId,x,y,aim,speed=610,r=4,pierceLeft=0,damage=1,ice=false,explosive=false,owner='p1',born=0}){
  const vx=Math.cos(aim)*speed,vy=Math.sin(aim)*speed;
  return {
    shotId,
    x,y,prevX:x,prevY:y,
    vx,vy,launchVx:vx,launchVy:vy,
    r,dead:false,ammo:1,born,
    pierceLeft,hits:[],iceHits:0,damage,ice,explosive,owner
  };
}

export function advanceProjectile(projectile,dt,{playerX=0,playerY=0,width=0,height=0}={}){
  const b=projectile;
  if(!b)return {expired:false,wasDead:false,flash:false};
  if(b.flash){b.t-=dt;return {expired:false,wasDead:!!b.dead,flash:true};}
  const wasDead=!!b.dead;
  b.prevX=Number.isFinite(b.x)?b.x:0;
  b.prevY=Number.isFinite(b.y)?b.y:0;
  b.x=b.prevX+(Number(b.vx)||0)*dt;
  b.y=b.prevY+(Number(b.vy)||0)*dt;
  const expired=Math.abs(b.x-playerX)>width||Math.abs(b.y-playerY)>height;
  if(expired)b.dead=true;
  return {expired,wasDead,flash:false};
}

export function sweptGridHit(b,grid,spatial){
  if(!b||!grid||!Number.isFinite(spatial)||spatial<=0)return null;
  const ax=Number.isFinite(b.prevX)?b.prevX:b.x,ay=Number.isFinite(b.prevY)?b.prevY:b.y,bx=b.x,by=b.y;
  const minX=Math.min(ax,bx),maxX=Math.max(ax,bx),minY=Math.min(ay,by),maxY=Math.max(ay,by);
  const c0x=Math.floor(minX/spatial)-1,c1x=Math.floor(maxX/spatial)+1,c0y=Math.floor(minY/spatial)-1,c1y=Math.floor(maxY/spatial)+1;
  const seen=new Set();
  for(let cy=c0y;cy<=c1y;cy++)for(let cx=c0x;cx<=c1x;cx++){
    const bucket=grid.get(cx+','+cy);
    if(!bucket)continue;
    for(const e of bucket){
      if(seen.has(e)||e.dead||(b.hits&&b.hits.includes(e)))continue;
      seen.add(e);
      const sx=bx-ax,sy=by-ay,len2=sx*sx+sy*sy;
      const t=len2>0?Math.max(0,Math.min(1,((e.x-ax)*sx+(e.y-ay)*sy)/len2)):0;
      const px=ax+sx*t,py=ay+sy*t,dx=px-e.x,dy=py-e.y,rr=b.r+e.r;
      if(dx*dx+dy*dy<rr*rr)return e;
    }
  }
  return null;
}

export function assertProjectileState(){
  const s=createProjectileState();
  if(!Array.isArray(s.bullets)||s.shotTimer!==0||s.ciShotsFired!==0)throw new Error('CAOS projectile state invalid');
  const b=createProjectile({shotId:1,x:0,y:0,aim:0,speed:10,born:1});
  const step=advanceProjectile(b,1,{playerX:0,playerY:0,width:100,height:100});
  if(step.expired||b.x!==10||b.prevX!==0)throw new Error('CAOS projectile movement invalid');
  const enemy={x:5,y:0,r:2,dead:false};
  const grid=new Map([['0,0',[enemy]]]);
  b.prevX=0;b.prevY=0;b.x=10;b.y=0;b.r=1;
  if(sweptGridHit(b,grid,16)!==enemy)throw new Error('CAOS projectile swept collision invalid');
  return true;
}
