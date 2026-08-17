from pathlib import Path
import re, json

GAME = Path('src/game.js')
s = GAME.read_text(encoding='utf-8')

# Safe to run after promotion: if the release is already present, do not patch twice.
if "const VERSION='0.17.40'" in s and 'autoRetreatActive' in s and 'autoMoveStrength' in s and 'moveScale=autoDriving?Math.min(1,rawMove):1' in s:
    print('Solo v0.17.40 movement smoothing already applied; validation-only run')
    raise SystemExit(0)


def once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    s = s.replace(old, new, 1)

once("const VERSION='0.17.39'", "const VERSION='0.17.40'", 'version')
once(
    'autoMoveX=0,autoMoveY=0,autoDecisionUntil=0,',
    'autoMoveX=0,autoMoveY=0,autoMoveStrength=0,autoRetreatActive=false,autoDecisionUntil=0,',
    'auto movement state'
)
once(
    "deathState=null;autoTarget=null;autoTargetUntil=0;$('deathCam')",
    "deathState=null;autoTarget=null;autoTargetUntil=0;autoMoveX=autoMoveY=autoMoveStrength=0;autoRetreatActive=false;autoDecisionUntil=0;$('deathCam')",
    'reset auto movement state'
)
once(
    "if(c==='auto'){autoMode=!!d.value;pointer=null;clearAutoTarget()}",
    "if(c==='auto'){autoMode=!!d.value;pointer=null;autoMoveX=autoMoveY=autoMoveStrength=0;autoRetreatActive=false;clearAutoTarget()}",
    'admin auto reset'
)

old_auto = '''function autoVector(dt){
  let nearestMob=null,nearestDist=Infinity,vx=0,vy=0,threatCount=0,panic=false;
  for(const e of enemies){
    if(e.dead)continue;
    const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1;
    if(d<nearestDist){nearestDist=d;nearestMob=e}
    const flee=(e.max>=100?360:245)+e.r;
    const critical=(e.max>=100?220:135)+e.r;
    if(d<flee){threatCount++;const w=Math.pow(1-d/flee,1.35)*(e.max>=100?1.8:1);vx+=dx/d*w;vy+=dy/d*w}
    if(d<critical)panic=true;
  }
  if(!nearestMob||!threatCount){autoMoveX*=.72;autoMoveY*=.72;if(Math.hypot(autoMoveX,autoMoveY)<.06){autoMoveX=0;autoMoveY=0}return{x:0,y:0}}
  if(Math.hypot(vx,vy)<.04){const dx=player.x-nearestMob.x,dy=player.y-nearestMob.y,d=nearestDist||1;vx=dx/d;vy=dy/d}
  const n=Math.hypot(vx,vy)||1,desiredX=vx/n,desiredY=vy/n,blend=panic?.42:.16;
  autoMoveX=autoMoveX*(1-blend)+desiredX*blend;autoMoveY=autoMoveY*(1-blend)+desiredY*blend;
  const sn=Math.hypot(autoMoveX,autoMoveY)||1;autoMoveX/=sn;autoMoveY/=sn;
  return{x:autoMoveX,y:autoMoveY}
}'''

new_auto = '''function autoVector(dt){
  let nearestMob=null,nearestDist=Infinity,vx=0,vy=0,threatCount=0,panic=false;
  for(const e of enemies){
    if(e.dead)continue;
    const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1;
    if(d<nearestDist){nearestDist=d;nearestMob=e}
    const flee=(e.max>=100?360:245)+e.r;
    const critical=(e.max>=100?220:135)+e.r;
    if(d<flee){threatCount++;const w=Math.pow(1-d/flee,1.35)*(e.max>=100?1.8:1);vx+=dx/d*w;vy+=dy/d*w}
    if(d<critical)panic=true;
  }
  if(!nearestMob){
    autoRetreatActive=false;
    autoMoveStrength+=(0-autoMoveStrength)*(1-Math.exp(-dt*8));
    if(autoMoveStrength<.015){autoMoveStrength=0;autoMoveX=autoMoveY=0}
    return{x:autoMoveX*autoMoveStrength,y:autoMoveY*autoMoveStrength}
  }
  const bossThreat=!!types[nearestMob.type]?.boss,engage=(bossThreat?360:245)+nearestMob.r,release=engage+(bossThreat?95:70);
  if(threatCount>0)autoRetreatActive=true;
  else if(autoRetreatActive&&nearestDist>=release)autoRetreatActive=false;
  if(autoRetreatActive&&Math.hypot(vx,vy)<.04){const dx=player.x-nearestMob.x,dy=player.y-nearestMob.y,d=nearestDist||1;vx=dx/d;vy=dy/d}
  if(autoRetreatActive){
    const n=Math.hypot(vx,vy)||1,desiredX=vx/n,desiredY=vy/n,blend=1-Math.exp(-dt*(panic?14:7));
    autoMoveX=autoMoveX*(1-blend)+desiredX*blend;autoMoveY=autoMoveY*(1-blend)+desiredY*blend;
    const sn=Math.hypot(autoMoveX,autoMoveY)||1;autoMoveX/=sn;autoMoveY/=sn;
  }
  let targetStrength=0;
  if(autoRetreatActive){
    if(panic)targetStrength=1;
    else if(threatCount>0)targetStrength=.9;
    else{const t=Math.max(0,Math.min(1,(release-nearestDist)/Math.max(1,release-engage)));targetStrength=.28+.52*t}
  }
  autoMoveStrength+=(targetStrength-autoMoveStrength)*(1-Math.exp(-dt*(panic?12:6.5)));
  if(!autoRetreatActive&&autoMoveStrength<.015){autoMoveStrength=0;autoMoveX=autoMoveY=0}
  return{x:autoMoveX*autoMoveStrength,y:autoMoveY*autoMoveStrength}
}'''
once(old_auto, new_auto, 'autoVector')

old_move = "let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);if(pointer){dx=pointer.x-W/2;dy=pointer.y-H/2;if(Math.hypot(dx,dy)<16)dx=dy=0}else if(autoMode&&!dx&&!dy){const v=autoVector(dt);dx=v.x;dy=v.y}if(player.down||choosing){dx=0;dy=0;pointer=null}const l=Math.hypot(dx,dy)||1;player.moving=!!(dx||dy);player.moveX=player.moving?dx/l:0;player.moveY=player.moving?dy/l:0;if(player.moving){player.x+=player.moveX*player.speed*dt;player.y+=player.moveY*player.speed*dt;"
new_move = "let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0),autoDriving=false;if(pointer){dx=pointer.x-W/2;dy=pointer.y-H/2;if(Math.hypot(dx,dy)<16)dx=dy=0}else if(autoMode&&!dx&&!dy){autoDriving=true;const v=autoVector(dt);dx=v.x;dy=v.y}if(player.down||choosing){dx=0;dy=0;pointer=null}const rawMove=Math.hypot(dx,dy),l=rawMove||1,moveScale=autoDriving?Math.min(1,rawMove):1;player.moving=rawMove>.015;player.moveX=player.moving?dx/l:0;player.moveY=player.moving?dy/l:0;if(player.moving){player.x+=player.moveX*player.speed*dt*moveScale;player.y+=player.moveY*player.speed*dt*moveScale;"
once(old_move, new_move, 'update movement scale')

GAME.write_text(s, encoding='utf-8')

# Synchronize only Solo-facing pages/caches. Dedicated Online stays on its own release.
for name in ['index.html', 'painel.html', 'duo.html', 'map-lab.html']:
    p = Path(name)
    text = p.read_text(encoding='utf-8')
    text = text.replace('0.17.39', '0.17.40').replace('01739', '01740')
    p.write_text(text, encoding='utf-8')

Path('version.json').write_text(json.dumps({
    'version': '0.17.40',
    'build': 'solo-auto-movement-hysteresis-smoothing'
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

recovery = Path('docs/RECOVERY.md')
r = recovery.read_text(encoding='utf-8') if recovery.exists() else '# Caos Live - Recovery\n'
entry = '''\n## Stable Solo snapshot before v0.17.40\n\n- Commit: `aabb8edce37ba94b9c4d7f0d7259592f26da6cb7`\n- Branch: `backup/solo-v0.17.39-stable`\n- Reason: restore point before Auto movement hysteresis/smoothing.\n'''
if 'backup/solo-v0.17.39-stable' not in r:
    r += entry
recovery.write_text(r, encoding='utf-8')

print('Solo v0.17.40 auto movement smoothing patch applied')
