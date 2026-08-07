from pathlib import Path
import json, re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# 1) Estado nativo de horda
old="autoMode=false,autoAngle=0,autoTurn=0,killCount=0,medDrop=null,nextMedDropAt=0,toastText='',toastUntil=0;const skillLv="
new="autoMode=false,autoAngle=0,autoTurn=0,killCount=0,medDrop=null,nextMedDropAt=0,toastText='',toastUntil=0,hordeEnabled=true,hordeNumber=1,hordeTarget=15,hordeKilled=0,hordeSpawned=0,hordeWaitUntil=0;const skillLv="
if old not in s: raise SystemExit('state marker missing')
s=s.replace(old,new,1)

# 2) Reset da horda
old="nextMedDropAt=performance.now()+180000;document.querySelectorAll('.overlay').forEach"
new="nextMedDropAt=performance.now()+180000;hordeEnabled=true;hordeNumber=1;hordeTarget=15;hordeKilled=0;hordeSpawned=0;hordeWaitUntil=0;document.querySelectorAll('.overlay').forEach"
if old not in s: raise SystemExit('reset marker missing')
s=s.replace(old,new,1)

# 3) Inimigos com origem e nome do viewer
s=s.replace("function makeEnemy(type,near=false){if(enemies.length>=MAX_ENEMIES)return;","function makeEnemy(type,near=false,viewerName='',source='extra'){if(enemies.length>=MAX_ENEMIES)return;",1)
old="dead:false,t:Math.random()*8,seed:Math.random()*99})}function spawn(type){if(type)return makeEnemy(type,true);const pool=['wraith','reaper','infected','crawler','eye','brute'];makeEnemy(pool[Math.floor(Math.random()*pool.length)])}function spawnWave(){const n=Math.min(11,3+Math.floor(level/2));for(let i=0;i<n;i++)spawn()}"
new="dead:false,t:Math.random()*8,seed:Math.random()*99,viewerName:String(viewerName||'').slice(0,26),source:String(source||'extra'),hordeCounted:false})}function spawn(type,viewerName=''){if(type)return makeEnemy(type,true,viewerName,viewerName?'live':'extra');const pool=['wraith','reaper','infected','crawler','eye','brute'];makeEnemy(pool[Math.floor(Math.random()*pool.length)],true,viewerName,viewerName?'live':'extra')}function spawnHordeEnemy(){const pool=['wraith','reaper','infected','crawler','eye','brute'],type=pool[Math.floor(Math.random()*pool.length)];makeEnemy(type,false,'','horde')}function spawnWave(){const n=Math.min(11,3+Math.floor(level/2));for(let i=0;i<n;i++)spawn()}"
if old not in s: raise SystemExit('spawn marker missing')
s=s.replace(old,new,1)

# 4) Horda: progressão por eliminações
old="function onKill(e){killCount++;"
new="function hordeSize(n){return Math.min(60,10+n*5)}function markHordeResolved(e){if(!e||e.source!=='horde'||e.hordeCounted)return;e.hordeCounted=true;hordeKilled++;if(hordeKilled>=hordeTarget){hordeNumber++;hordeTarget=hordeSize(hordeNumber);hordeKilled=0;hordeSpawned=0;hordeWaitUntil=performance.now()+1800;spawnTimer=.1;toast('🌊 HORDA '+hordeNumber+' EM 2s')}}function onKill(e){markHordeResolved(e);killCount++;"
if old not in s: raise SystemExit('onKill marker missing')
s=s.replace(old,new,1)

# Colisão com player também resolve o mob da horda
old="if(Math.hypot(e.x-player.x,e.y-player.y)<e.r+player.r){e.dead=true;if(player.inv<=0"
new="if(Math.hypot(e.x-player.x,e.y-player.y)<e.r+player.r){e.dead=true;markHordeResolved(e);if(player.inv<=0"
if old not in s: raise SystemExit('collision marker missing')
s=s.replace(old,new,1)

# 5) Command: spawn com label + Horda OFF realmente limpa os mobs base
old="if(c==='spawn')for(let i=0;i<Math.min(100,+d.amount||25);i++)spawn(d.mob||null);"
new="if(c==='spawn')for(let i=0;i<Math.min(100,+d.amount||25);i++)spawn(d.mob||null,d.label||d.user||'');"
if old not in s: raise SystemExit('command spawn marker missing')
s=s.replace(old,new,1)

old="if(c==='auto'){autoMode=!!d.value;pointer=null}if(c==='ping')broadcast();"
new="if(c==='auto'){autoMode=Boolean(d.value);pointer=null}if(c==='horde'){hordeEnabled=Boolean(d.value);spawnTimer=.1;if(!hordeEnabled){enemies=enemies.filter(e=>e.source!=='horde');hordeSpawned=hordeKilled;toast('🧪 SOMENTE MOBS DO CHAT')}else{hordeSpawned=Math.min(hordeSpawned,hordeKilled);toast('🌊 HORDAS ATIVADAS')}}if(c==='ping')broadcast();"
if old not in s: raise SystemExit('auto command marker missing')
s=s.replace(old,new,1)

# 6) Spawn automático só quando horda ON
old="spawnTimer-=dt;if(spawnTimer<=0){spawnWave();spawnTimer=Math.max(.11,.52-level*.012)}shotTimer-=dt;"
new="if(hordeEnabled){if(performance.now()>=hordeWaitUntil&&hordeSpawned<hordeTarget){spawnTimer-=dt;if(spawnTimer<=0){if(enemies.length<MAX_ENEMIES){spawnHordeEnemy();hordeSpawned++}spawnTimer=.12}}}else{spawnTimer=.1}shotTimer-=dt;"
if old not in s: raise SystemExit('spawn loop marker missing')
s=s.replace(old,new,1)

# 7) AUTO escolhe skill nativamente
pat=r"function chooseSkill\(\)\{.*?\}\nfunction onKill\(e\)"
m=re.search(pat,s,flags=re.S)
if not m: raise SystemExit('chooseSkill block missing')
choose="""function chooseSkill(){const maxLv=s=>s.id==='pact'?1:5,pool=skills.filter(s=>skillLv[s.id]<maxLv(s));if(!pool.length){toast('TODAS AS SKILLS ESTÃO NO MÁXIMO');choosing=false;return}choosing=true;const available=[...pool],pick=[];while(pick.length<Math.min(3,pool.length)){const s=weightedPick(available);pick.push(s);available.splice(available.indexOf(s),1)}const applySkill=s=>{const next=Math.min(maxLv(s),(skillLv[s.id]||0)+1);skillLv[s.id]=next;s.apply(next);choosing=false;$('skillPick').classList.remove('show');last=performance.now();ui();broadcast();return next};if(autoMode){const score=s=>{const lifeRatio=player.life/Math.max(1,player.maxLife),base={pact:130,flash:115,arc:108,blood:100,rapid:92,regen:82,xp:74,speed:66,medic:58}[s.id]||50;let bonus=0;if(s.id==='medic'&&lifeRatio<.7)bonus+=55;if(s.id==='regen'&&lifeRatio<.8)bonus+=28;if(s.id==='flash'&&level>=8)bonus+=18;if(s.id==='xp'&&level<15)bonus+=18;if(s.id==='speed'&&enemies.length>70)bonus+=14;if(s.id==='pact'&&lifeRatio<.65)bonus+=35;return base+bonus};const s=[...pick].sort((a,b)=>score(b)-score(a))[0],next=applySkill(s);toast('🤖 AUTO: '+s.n.toUpperCase()+' · LV '+next);return}const box=$('skillChoices');box.innerHTML='';pick.forEach(s=>{const cur=skillLv[s.id]||0,next=Math.min(maxLv(s),cur+1),b=document.createElement('button');b.className='skill '+s.r;b.innerHTML=`<span class="ico">${s.i}</span><span class="lvl">LV ${cur} → ${next}</span><b>${s.n}</b><em>${rarityLabel[s.r]}</em><small>${s.desc(next)}</small>`;b.onclick=()=>{const lv=applySkill(s);toast(`${s.n.toUpperCase()} · LV ${lv}`)};box.appendChild(b)});$('skillPick').classList.add('show')}
function onKill(e)"""
s=s[:m.start()]+choose+s[m.end():]

# 8) Telemetria de horda no estado enviado ao Admin
old="autoMode,skillLv:{...skillLv},room,ts:Date.now()"
new="autoMode,hordeEnabled,horde:hordeNumber,hordeTarget,hordeKilled,hordeSpawned,hordeBaseAlive:enemies.filter(e=>e.source==='horde').length,liveExtraMobs:enemies.filter(e=>e.source!=='horde').length,skillLv:{...skillLv},room,ts:Date.now()"
if old not in s: raise SystemExit('state broadcast marker missing')
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')

vp=Path('version.json')
v=json.loads(vp.read_text(encoding='utf-8'))
v.update({
  'version':'0.9.9','label':'v0.9.9','releasedAt':'2026-08-07T19:42:00-03:00','build':'horde-off-auto-skill-native',
  'notes':['Horda OFF remove imediatamente mobs da horda e mantém mobs da LIVE/chat','AUTO escolhe e aplica skill automaticamente em cada level-up','Lógica de Horda e AUTO consolidada no jogo-base']
})
vp.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('patched v0.9.9')
