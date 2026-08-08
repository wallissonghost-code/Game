from pathlib import Path
import json

p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=s.replace('Caos Live v0.10.7','Caos Live v0.10.8')
s=s.replace("const VERSION='0.10.7'","const VERSION='0.10.8'")
s=s.replace('<div class="version">v0.10.7</div>','<div class="version">v0.10.8</div>')

if 'phoenixShieldUntil=0' not in s:
    s=s.replace('phoenixReady=false,phoenixConsumed=false;', 'phoenixReady=false,phoenixConsumed=false,phoenixShieldUntil=0;')

s=s.replace('phoenixReady=false;phoenixConsumed=false;document.querySelectorAll', 'phoenixReady=false;phoenixConsumed=false;phoenixShieldUntil=0;document.querySelectorAll')

old="player.life=Math.max(1,player.maxLife*.5);player.inv=2;invincibleUntil=performance.now()+2000;"
new="player.life=Math.max(1,player.maxLife*.5);player.inv=2;phoenixShieldUntil=performance.now()+2000;invincibleUntil=phoenixShieldUntil;"
s=s.replace(old,new)

if 'function drawPhoenixShield()' not in s:
    anchor='function drawShield(){'
    phoenix="""function drawPhoenixShield(){const now=performance.now();if(now>=phoenixShieldUntil)return;const left=(phoenixShieldUntil-now)/2000,pulse=.5+.5*Math.sin(now/90),fade=Math.min(1,left*3);ctx.save();ctx.translate(W/2,H/2);ctx.globalAlpha=fade;ctx.globalCompositeOperation='screen';const glow=ctx.createRadialGradient(0,0,20,0,0,54);glow.addColorStop(0,'rgba(255,220,90,.12)');glow.addColorStop(.55,'rgba(255,153,0,.08)');glow.addColorStop(1,'rgba(255,90,0,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,54,0,Math.PI*2);ctx.fill();ctx.shadowColor='#f59e0b';ctx.shadowBlur=20+8*pulse;ctx.lineWidth=3;ctx.strokeStyle='#fde68a';ctx.setLineDash([13,7]);ctx.lineDashOffset=-now/28;ctx.beginPath();ctx.arc(0,0,42+pulse*2,0,Math.PI*2);ctx.stroke();ctx.shadowColor='#fb923c';ctx.shadowBlur=16;ctx.lineWidth=2;ctx.strokeStyle='#fb923c';ctx.setLineDash([5,10]);ctx.lineDashOffset=now/22;ctx.beginPath();ctx.arc(0,0,34-pulse,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);for(let i=0;i<7;i++){const a=now/360+i*Math.PI*2/7,r=48+(i%2)*4;const x=Math.cos(a)*r,y=Math.sin(a)*r;ctx.shadowColor='#fbbf24';ctx.shadowBlur=12;ctx.fillStyle=i%2?'#fb923c':'#fde047';ctx.beginPath();ctx.arc(x,y,1.8+(i%3)*.45,0,Math.PI*2);ctx.fill()}ctx.restore()}"""
    s=s.replace(anchor,phoenix+anchor,1)

s=s.replace('drawMed();drawArcFx();drawPlayer();drawShield();drawFreeze();','drawMed();drawArcFx();drawPlayer();drawPhoenixShield();if(performance.now()>=phoenixShieldUntil)drawShield();drawFreeze();')

p.write_text(s,encoding='utf-8')

Path('version.json').write_text(json.dumps({
  'version':'0.10.8','label':'v0.10.8','releasedAt':'2026-08-08T15:30:00Z','build':'phoenix-golden-shield',
  'notes':['Fênix recebe escudo visual exclusivo dourado/laranja','Anéis duplos giratórios e faíscas orbitais durante os 2s de renascimento','Escudo azul permanece exclusivo da invencibilidade comum']
},ensure_ascii=False,indent=2),encoding='utf-8')
print('Phoenix shield v0.10.8 applied')
