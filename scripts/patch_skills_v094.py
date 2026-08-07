from pathlib import Path
import json

p=Path('cloud/connector-server.mjs')
s=p.read_text(encoding='utf-8')
marker=' return out;\n}\n\nfunction patchAdminHtml'
if marker not in s:
    raise SystemExit('patchGameHtml return marker not found')
block=r''' // v0.9.4 — Arco Voltaico + Pacto do Abismo
 rep('.legendary{border-color:#f59e0b;box-shadow:inset 0 0 34px #f59e0b20}', '.legendary{border-color:#f59e0b;box-shadow:inset 0 0 34px #f59e0b20}.secret{border-color:#f8fafc;box-shadow:inset 0 0 36px #8b5cf655,0 0 22px #c4b5fd33;background:linear-gradient(145deg,#21143a,#090b16)!important}.secret em{background:#ffffff18;color:#f5f3ff}');
 rep("toastText='',toastUntil=0,shieldOwner='',shieldOwnerUntil=0", "toastText='',toastUntil=0,arcNextAt=0,arcFx=[],pactReady=false,shieldOwner='',shieldOwnerUntil=0");
 rep("const skillLv={speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0};", "const skillLv={speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,pact:0};");
 rep("const rarityLabel={common:'COMUM',rare:'RARA',epic:'ÉPICA',legendary:'LENDÁRIA'},rarityWeight={common:70,rare:25,epic:9,legendary:3};", "const rarityLabel={common:'COMUM',rare:'RARA',epic:'ÉPICA',legendary:'LENDÁRIA',secret:'SECRETA'},rarityWeight={common:70,rare:25,epic:9,legendary:3,secret:.35};");
 rep("{id:'flash',n:'Flash de Luz',i:'☀️',r:'legendary',desc:l=>`Feixe perfurante de ${[0,8,10,12,15,18][l]} de dano a cada 5 tiros.`,apply:l=>player.flashDamage=[0,8,10,12,15,18][l]}];", "{id:'flash',n:'Flash de Luz',i:'☀️',r:'legendary',desc:l=>`Feixe perfurante de ${[0,8,10,12,15,18][l]} de dano a cada 5 tiros.`,apply:l=>player.flashDamage=[0,8,10,12,15,18][l]},{id:'arc',n:'Arco Voltaico',i:'⚡',r:'epic',desc:l=>`A cada 7s, descarga salta pelo alvo + até 3 mobs. Dano ${[0,1,1,2,2,3][l]}.`,apply:l=>{arcNextAt=Math.min(arcNextAt||Infinity,performance.now()+700)}},{id:'pact',n:'Pacto do Abismo',i:'◈',r:'secret',desc:l=>'Uma segunda chance: revive 1x com 50% da vida e 2s de invencibilidade.',apply:l=>{pactReady=true}}];");
 rep("const pool=skills.filter(s=>skillLv[s.id]<5);", "const pool=skills.filter(s=>s.id==='pact'?skillLv[s.id]<1:skillLv[s.id]<5);");
 rep("base={flash:110,blood:100,rapid:92,regen:82,xp:74,speed:66,medic:58}", "base={pact:1000,arc:96,flash:110,blood:100,rapid:92,regen:82,xp:74,speed:66,medic:58}");
 rep("nextMedDropAt=performance.now()+180000;shieldOwner='';", "nextMedDropAt=performance.now()+180000;arcNextAt=0;arcFx=[];pactReady=false;shieldOwner='';");
 rep("function shoot(){const t=nearest();", "function castArc(){if(!skillLv.arc||performance.now()<arcNextAt)return;const first=nearest();if(!first)return;arcNextAt=performance.now()+7000;const hit=[first],damage=[0,1,1,2,2,3][skillLv.arc]||1;while(hit.length<4){const last=hit[hit.length-1];let next=null,bd=180;for(const e of enemies){if(e.dead||hit.includes(e))continue;const d=Math.hypot(e.x-last.x,e.y-last.y);if(d<bd){bd=d;next=e}}if(!next)break;hit.push(next)}const pts=[{x:player.x,y:player.y},...hit.map(e=>({x:e.x,y:e.y}))];arcFx.push({pts,until:performance.now()+260});for(const e of hit){e.hp-=damage;if(e.hp<=0&&!e.dead){e.dead=true;onKill(e)}}toast('⚡ ARCO VOLTAICO · '+hit.length+' ALVOS')}function tryPact(){if(!pactReady)return false;pactReady=false;player.life=Math.max(1,player.maxLife*.5);player.inv=2;invincibleUntil=performance.now()+2000;for(const e of enemies){if(e.dead)continue;const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy)||1;if(d<190){const push=(190-d)*.8;e.x+=dx/d*push;e.y+=dy/d*push}}toast('◈ PACTO DO ABISMO · SEGUNDA CHANCE');return true}function drawArcFx(){const now=performance.now();arcFx=arcFx.filter(f=>f.until>now);for(const f of arcFx){const alpha=Math.max(0,(f.until-now)/260);ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#a5f3fc';ctx.shadowColor='#22d3ee';ctx.shadowBlur=16;ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<f.pts.length;i++){const p=world(f.pts[i].x,f.pts[i].y);if(i===0)ctx.moveTo(p.x,p.y);else{const prev=world(f.pts[i-1].x,f.pts[i-1].y),mx=(prev.x+p.x)/2+(Math.random()-.5)*12,my=(prev.y+p.y)/2+(Math.random()-.5)*12;ctx.lineTo(mx,my);ctx.lineTo(p.x,p.y)}}ctx.stroke();ctx.restore()}}function shoot(){const t=nearest();");
 rep("shotTimer-=dt;if(shotTimer<=0){shoot();shotTimer=player.fireRate}", "castArc();shotTimer-=dt;if(shotTimer<=0){shoot();shotTimer=player.fireRate}");
 rep("if(player.life<=0){running=false;$('finalText').textContent='Level '+level+' · '+score+' pontos';$('over').classList.add('show')}", "if(player.life<=0){if(!tryPact()){running=false;$('finalText').textContent='Level '+level+' · '+score+' pontos';$('over').classList.add('show')}}");
 rep("drawMed();drawPlayer();drawShield();drawFreeze();", "drawMed();drawArcFx();drawPlayer();drawShield();drawFreeze();");
 return out;
}

function patchAdminHtml'''
s=s.replace(marker,block,1)
p.write_text(s,encoding='utf-8')

v={
  'version':'0.9.4','label':'v0.9.4','releasedAt':'2026-08-07T16:40:00-03:00','build':'arc-voltaic-pact-abyss',
  'notes':['Arco Voltaico: cadeia de até 4 alvos a cada 7s','Pacto do Abismo: raridade Secreta e revive único','Pacto volta com 50% da vida e 2s de invencibilidade','Efeitos visuais leves em Canvas']
}
Path('version.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
