from pathlib import Path
import re,json
p=Path('src/game.js')
s=p.read_text()
s=s.replace("const VERSION='0.17.2'","const VERSION='0.17.3'",1)

# Track the player's current movement vector so collision resolution can open a passage laterally.
old="player.moving=!!(dx||dy);if(player.moving){player.x+=dx/l*player.speed*dt;player.y+=dy/l*player.speed*dt;player.walk+=dt*9}"
new="player.moving=!!(dx||dy);player.moveX=player.moving?dx/l:0;player.moveY=player.moving?dy/l:0;if(player.moving){player.x+=player.moveX*player.speed*dt;player.y+=player.moveY*player.speed*dt;player.walk+=dt*9}"
if old not in s: raise SystemExit('player movement block not found')
s=s.replace(old,new,1)

anchor="function separateEnemies(){const g=buildEnemyGrid();for(const e of enemies){if(e.dead)continue;const cx=Math.floor(e.x/SPATIAL),cy=Math.floor(e.y/SPATIAL);for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const a=g.get((cx+ox)+','+(cy+oy));if(!a)continue;for(const o of a){if(o===e||o.dead)continue;const dx=e.x-o.x,dy=e.y-o.y,d=Math.hypot(dx,dy)||.001,min=(types[e.type]?.boss||types[o.type]?.boss)?Math.max(34,(e.r+o.r)*.72):Math.max(22,(e.r+o.r)*.62);if(d<min){const push=Math.min(2.8,(min-d)*.14),ux=dx/d,uy=dy/d;e.x+=ux*push;e.y+=uy*push}}}}}"
if anchor not in s: raise SystemExit('separateEnemies anchor not found')
insert=anchor+"function resolvePlayerMobCollisions(){let close=0;for(const e of enemies){if(e.dead)continue;const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy)||.001,min=player.r+e.r+3;if(d<min+13)close++}const crowded=close>=6,escapeBoost=close>=9?1.45:crowded?1.22:1;for(const e of enemies){if(e.dead)continue;let dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy)||.001;const isBoss=!!types[e.type]?.boss,min=player.r+e.r+(isBoss?8:4);if(d>=min)continue;const ux=dx/d,uy=dy/d,overlap=Math.min(16,min-d);let mobShare=isBoss?.38:.82,playerShare=1-mobShare;if(crowded&&!isBoss){mobShare=.94;playerShare=.06}if(crowded&&isBoss){mobShare=.48;playerShare=.52}let ex=ux*overlap*mobShare*escapeBoost,ey=uy*overlap*mobShare*escapeBoost;if(player.moving&&!isBoss){const mx=player.moveX||0,my=player.moveY||0;const side=Math.sign(mx*uy-my*ux)||((e.seed||0)%2>.5?1:-1),tx=-my*side,ty=mx*side,lateral=overlap*(crowded?.52:.30);ex+=tx*lateral;ey+=ty*lateral}e.x+=ex;e.y+=ey;player.x-=ux*overlap*playerShare;player.y-=uy*overlap*playerShare}}"
s=s.replace(anchor,insert,1)

old="}}}separateEnemies();const enemyGrid=buildEnemyGrid();for(const b of bullets){"
new="}}}separateEnemies();resolvePlayerMobCollisions();const enemyGrid=buildEnemyGrid();for(const b of bullets){"
if old not in s: raise SystemExit('collision call point not found')
s=s.replace(old,new,1)

p.write_text(s)
idx=Path('index.html');i=idx.read_text();i=i.replace('Caos Live v0.17.2','Caos Live v0.17.3').replace('v0.17.2 · GAMEPLAY POLIDO','v0.17.3 · COLISÃO FÍSICA').replace('v0.17.2</span>','v0.17.3</span>').replace('src/game.js?v=0172','src/game.js?v=0173');idx.write_text(i)
vp=Path('version.json');v=json.loads(vp.read_text());v['version']='0.17.3';v['build']='soft-player-mob-collision';vp.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
print('patched soft collision v0.17.3')
