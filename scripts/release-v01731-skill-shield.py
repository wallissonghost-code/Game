from pathlib import Path
import json

VERSION='0.17.31'

def rw(p): return Path(p).read_text()
def ww(p,s): Path(p).write_text(s)

def function_bounds(src, signature):
    start=src.index(signature)
    brace=src.index('{',start)
    depth=0; in_s=None; esc=False; i=brace
    while i<len(src):
        ch=src[i]
        if in_s:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch==in_s: in_s=None
        else:
            if ch in "'\"`": in_s=ch
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:return start,i+1
        i+=1
    raise RuntimeError('function end not found: '+signature)

def inject_before_last_restore(src, signature, code):
    a,b=function_bounds(src,signature)
    seg=src[a:b]
    pos=seg.rfind('ctx.restore()')
    if pos<0: raise RuntimeError('ctx.restore missing in '+signature)
    seg=seg[:pos]+code+seg[pos:]
    return src[:a]+seg+src[b:]

g=rw('src/game.js')
assert "const VERSION='0.17.30'" in g
g=g.replace("const VERSION='0.17.30'","const VERSION='0.17.31'",1)
needle="function duoEnemyTarget(e){"; assert needle in g
helpers="""function skillShieldP1(){return !!choosing&&!player.down}\nfunction skillShieldP2(){return !!duoPendingSkill&&duoPlayer.connected&&!duoPlayer.down}\nfunction drawSkillShieldAt(x,y,label=''){const now=performance.now(),pulse=.88+Math.sin(now*.008)*.12;ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='screen';const r=34*pulse,g=ctx.createRadialGradient(0,0,10,0,0,r+9);g.addColorStop(0,'rgba(96,165,250,.06)');g.addColorStop(.62,'rgba(59,130,246,.14)');g.addColorStop(1,'rgba(103,232,249,.34)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r+9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(165,243,252,.92)';ctx.lineWidth=2.2;ctx.shadowColor='#22d3ee';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='rgba(224,242,254,.95)';ctx.font='900 8px sans-serif';ctx.textAlign='center';ctx.fillText('ESCUDO DE SKILL'+(label?' · '+label:''),0,-44);ctx.restore()}\n"""
g=g.replace(needle,helpers+needle,1)
old="function duoEnemyTarget(e){if(player.down&&duoPlayer.connected&&!duoPlayer.down)return duoPlayer;if(!duoPlayer.connected||duoPlayer.down)return player;if(player.down)return duoPlayer;const d1=(e.x-player.x)*(e.x-player.x)+(e.y-player.y)*(e.y-player.y),d2=(e.x-duoPlayer.x)*(e.x-duoPlayer.x)+(e.y-duoPlayer.y)*(e.y-duoPlayer.y);return d2<d1?duoPlayer:player}"
new="function duoEnemyTarget(e){const p1Protected=skillShieldP1(),p2Protected=skillShieldP2();if(player.down&&duoPlayer.connected&&!duoPlayer.down)return duoPlayer;if(!duoPlayer.connected||duoPlayer.down)return player;if(player.down)return duoPlayer;if(p1Protected&&!p2Protected)return duoPlayer;if(p2Protected&&!p1Protected)return player;const d1=(e.x-player.x)*(e.x-player.x)+(e.y-player.y)*(e.y-player.y),d2=(e.x-duoPlayer.x)*(e.x-duoPlayer.x)+(e.y-duoPlayer.y)*(e.y-duoPlayer.y);return d2<d1?duoPlayer:player}"
assert old in g; g=g.replace(old,new,1)
old="function updateDuo(dt){if(!duoPlayer.connected)return;duoPlayer.shotFlash=Math.max(0,duoPlayer.shotFlash-dt);if(duoPlayer.down){duoPlayer.moving=false;return}"
new="function updateDuo(dt){if(!duoPlayer.connected)return;duoPlayer.shotFlash=Math.max(0,duoPlayer.shotFlash-dt);if(duoPlayer.down||skillShieldP2()){duoPlayer.moving=false;duoInput.dx=duoInput.dy=0;return}"
assert old in g; g=g.replace(old,new,1)
old="if(now>=(e.attackAt||0)&&targetInv<=0&&now>targetShield){"
new="const choiceProtected=isP1?skillShieldP1():skillShieldP2();if(now>=(e.attackAt||0)&&targetInv<=0&&now>targetShield&&!choiceProtected){"
assert old in g; g=g.replace(old,new,1)
old="ctx.fillStyle='#a5f3fc';ctx.font='900 9px sans-serif';ctx.textAlign='center';ctx.fillText('P2',0,-44);ctx.restore()}"
new="if(skillShieldP2())drawSkillShieldAt(0,0,'P2');ctx.fillStyle='#a5f3fc';ctx.font='900 9px sans-serif';ctx.textAlign='center';ctx.fillText('P2',0,-44);ctx.restore()}"
assert old in g; g=g.replace(old,new,1)
old="p1:{x:player.x,y:player.y,life:player.life,maxLife:player.maxLife,aim:player.aim,down:!!player.down,moving:player.moving,walk:player.walk,shotFlash:player.shotFlash},p2:{x:duoPlayer.x,y:duoPlayer.y,life:duoPlayer.life,maxLife:duoPlayer.maxLife,aim:duoPlayer.aim,down:duoPlayer.down,moving:duoPlayer.moving,walk:duoPlayer.walk,shotFlash:duoPlayer.shotFlash,speed:duoPlayer.speed}"
new="p1:{x:player.x,y:player.y,life:player.life,maxLife:player.maxLife,aim:player.aim,down:!!player.down,moving:player.moving,walk:player.walk,shotFlash:player.shotFlash,skillShield:skillShieldP1()},p2:{x:duoPlayer.x,y:duoPlayer.y,life:duoPlayer.life,maxLife:duoPlayer.maxLife,aim:duoPlayer.aim,down:duoPlayer.down,moving:duoPlayer.moving,walk:duoPlayer.walk,shotFlash:duoPlayer.shotFlash,speed:duoPlayer.speed,skillShield:skillShieldP2()}"
assert old in g; g=g.replace(old,new,1)
g=inject_before_last_restore(g,'function drawPlayer(){',"if(skillShieldP1())drawSkillShieldAt(0,0,'P1');")
ww('src/game.js',g)

p=rw('src/duo.js')
assert "const VERSION='0.17.30'" in p
p=p.replace("const VERSION='0.17.30'","const VERSION='0.17.31'",1).replace('01730','01731')
needle="function drawSoldier(p,label,center=false){"; assert needle in p
helper="""function drawSkillShieldLocal(label){const now=performance.now(),pulse=.88+Math.sin(now*.008)*.12,r=34*pulse,g=ctx.createRadialGradient(0,0,10,0,0,r+9);ctx.save();ctx.globalCompositeOperation='screen';g.addColorStop(0,'rgba(96,165,250,.06)');g.addColorStop(.62,'rgba(59,130,246,.14)');g.addColorStop(1,'rgba(103,232,249,.34)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r+9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(165,243,252,.92)';ctx.lineWidth=2.2;ctx.shadowColor='#22d3ee';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='rgba(224,242,254,.95)';ctx.font='900 8px sans-serif';ctx.textAlign='center';ctx.fillText('ESCUDO DE SKILL · '+label,0,-44);ctx.restore()}\n"""
p=p.replace(needle,helper+needle,1)
p=inject_before_last_restore(p,'function drawSoldier(p,label,center=false){',"if(p.skillShield)drawSkillShieldLocal(label);")
ww('src/duo.js',p)

for f in ['index.html','painel.html','duo.html','map-lab.html']:
    s=rw(f).replace('v0.17.30','v0.17.31').replace('v=01730','v=01731'); ww(f,s)
for f in ['src/panel.js','src/map-lab.js','src/map-runtime.js']:
    s=rw(f).replace('0.17.30','0.17.31').replace('01730','01731'); ww(f,s)
ww('version.json',json.dumps({'version':VERSION,'build':'skill-choice-shield-coop'},indent=2,ensure_ascii=False)+'\n')
print('v0.17.31 skill shield patch applied')
