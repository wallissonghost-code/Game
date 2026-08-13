from pathlib import Path
import json,re

VERSION='0.17.37'
OLD_VERSION='0.17.36'
TAG='01737'
OLD_TAG='01736'

def rw(p): return Path(p).read_text(encoding='utf-8')
def ww(p,s): Path(p).write_text(s,encoding='utf-8')
def rep(s,a,b,label):
    if a not in s: raise RuntimeError('padrao nao encontrado: '+label)
    return s.replace(a,b,1)
def sub(s,pat,repl,label):
    out,n=re.subn(pat,repl,s,count=1,flags=re.S)
    if n!=1: raise RuntimeError(f'padrao regex nao encontrado: {label} ({n})')
    return out

# Pastas reservadas para as novas skins que o usuario ainda vai subir.
for d in ['assets/mobs/Ogro Elite II','assets/mobs/Ogro Corrompido II']:
    p=Path(d); p.mkdir(parents=True,exist_ok=True); (p/'.gitkeep').touch()

# ===== HOST / P1 =====
g=rw('src/game.js').replace(OLD_VERSION,VERSION).replace(OLD_TAG,TAG)

g=rep(g,
"const MOB_VISUAL_HEIGHT={normal:62,elite:86,bossScale:3.55};const BOSS_VARIANTS={normal:{hp:1,dmg:1,speed:1,xp:1},elite:{hp:1.75,dmg:1.25,speed:1.05,xp:1.75},corrupted:{hp:2.5,dmg:1.5,speed:1.10,xp:2.5}};",
"const MOB_VISUAL_HEIGHT={normal:62,elite:86,elite2:94,corrupted:108,corrupted2:118,bossScale:3.55};const BOSS_VARIANTS={normal:{hp:1,dmg:1,speed:1,xp:1},elite:{hp:1.75,dmg:1.25,speed:1.05,xp:1.75},corrupted:{hp:2.5,dmg:1.5,speed:1.10,xp:2.5}};const TIER_VARIANTS={normal:{hp:1,dmg:1,speed:1,xp:1,hitbox:1},elite1:{hp:3,dmg:1.7,speed:1.05,xp:3.5,hitbox:1},elite2:{hp:4.2,dmg:2.05,speed:1.10,xp:4.2,hitbox:1.08},corrupted1:{hp:5,dmg:2.2,speed:1.10,xp:5.5,hitbox:1.14},corrupted2:{hp:7,dmg:2.75,speed:1.16,xp:6.5,hitbox:1.20}};function xpNeedFor(lv){const base=60*Math.pow(Math.max(1,lv),1.42),mult=lv>=90?1.70:lv>=80?1.50:lv>=60?1.30:lv>=40?1.12:1;return Math.floor(base*mult)}",
'regua visual/stats/xp endgame')

g=rep(g,
"const ogreFrames={up:[],down:[],right:[],left:[]},eliteOgreFrames={up:[],down:[],right:[],left:[]},corruptedOgreFrames={up:[],down:[],right:[],left:[]},bossOgreFrames={up:[],down:[],right:[],left:[]},bossColossusFrames={up:[],down:[],right:[],left:[]},bossVoidFrames={up:[],down:[],right:[],left:[]};let ogreReady=false,eliteOgreReady=false,corruptedOgreReady=false,bossOgreReady=false,bossColossusReady=false,bossVoidReady=false;",
"const ogreFrames={up:[],down:[],right:[],left:[]},eliteOgreFrames={up:[],down:[],right:[],left:[]},elite2OgreFrames={up:[],down:[],right:[],left:[]},corruptedOgreFrames={up:[],down:[],right:[],left:[]},corrupted2OgreFrames={up:[],down:[],right:[],left:[]},bossOgreFrames={up:[],down:[],right:[],left:[]},bossColossusFrames={up:[],down:[],right:[],left:[]},bossVoidFrames={up:[],down:[],right:[],left:[]};let ogreReady=false,eliteOgreReady=false,elite2OgreReady=false,corruptedOgreReady=false,corrupted2OgreReady=false,bossOgreReady=false,bossColossusReady=false,bossVoidReady=false,elite2OgreLoading=false,corrupted2OgreLoading=false;",
'packs II host')

needle="function mapDirect32(arr,target){if(arr.length<32)return false;target.down=[arr[0],arr[8],arr[16],arr[24]];target.dr=[arr[1],arr[9],arr[17],arr[25]];target.right=[arr[2],arr[10],arr[18],arr[26]];target.ur=[arr[3],arr[11],arr[19],arr[27]];target.up=[arr[4],arr[12],arr[20],arr[28]];target.ul=[arr[5],arr[13],arr[21],arr[29]];target.left=[arr[6],arr[14],arr[22],arr[30]];target.dl=[arr[7],arr[15],arr[23],arr[31]];return true}"
addon=needle+"\nasync function optionalMobPack(folder,target){try{const probe=await fetch(folder+'/frame_001.png?v='+ASSET_TAG,{cache:'force-cache'});if(!probe.ok)return false;const frames=await loadDirectPngSequence(folder,32,ASSET_TAG);return mapDirect32(frames,target)}catch(e){console.info('SKIN AVANCADA AINDA NAO DISPONIVEL',folder);return false}}async function ensureAdvancedOgre(tier){if(tier===1){if(elite2OgreReady||elite2OgreLoading)return;elite2OgreLoading=true;elite2OgreReady=await optionalMobPack('./assets/mobs/Ogro Elite II',elite2OgreFrames);elite2OgreLoading=false}else if(tier===2){if(corrupted2OgreReady||corrupted2OgreLoading)return;corrupted2OgreLoading=true;corrupted2OgreReady=await optionalMobPack('./assets/mobs/Ogro Corrompido II',corrupted2OgreFrames);corrupted2OgreLoading=false}}"
g=rep(g,needle,addon,'loader opcional skins II host')

# Progressao de tiers e subtier.
g=sub(g,r"function enemyTier\(\)\{.*?\}function bossTier\(",
"function enemyTier(){const r=Math.random();let corrupt=0,elite=0;if(level>=90){corrupt=.34;elite=.42}else if(level>=80){corrupt=.28;elite=.38}else if(level>=60){corrupt=.20;elite=.34}else if(level>=40){corrupt=.14;elite=.28}else{corrupt=level>=30?.12:level>=20?.08:level>=10?.035:0;elite=level>=30?.24:level>=15?.18:level>=5?.10:0}if(r<corrupt)return 2;if(r<corrupt+elite)return 1;return 0}function enemyEvolution(tier){if(tier===1&&level>=40){const chance=level>=80?.90:level>=60?.65:level>=50?.35:.15;return Math.random()<chance?2:1}if(tier===2&&level>=60){const chance=level>=90?1:level>=80?.70:level>=70?.45:.20;return Math.random()<chance?2:1}return 1}function bossTier(",
'curva de spawn endgame')

new_make="""function makeEnemy(type,near=false,forcedTier=null){if(enemies.length>=MAX_ENEMIES)return;const c=types[type];if(!c)return;const a=Math.random()*Math.PI*2,dist=near?180+Math.random()*220:Math.max(W,H)*.7+Math.random()*260,tier=c.boss?bossTier(forcedTier):(forcedTier===1||forcedTier===2?forcedTier:enemyTier()),evolution=c.boss?1:enemyEvolution(tier),bossVar=c.boss?(tier===2?BOSS_VARIANTS.corrupted:tier===1?BOSS_VARIANTS.elite:BOSS_VARIANTS.normal):null,key=tier===2?(evolution===2?'corrupted2':'corrupted1'):tier===1?(evolution===2?'elite2':'elite1'):'normal',variant=c.boss?null:TIER_VARIANTS[key],hpMult=c.boss?bossVar.hp:variant.hp,dmgMult=c.boss?bossVar.dmg:variant.dmg,xpMult=c.boss?bossVar.xp:variant.xp,hitboxMult=c.boss?1:variant.hitbox;if(!c.boss&&evolution===2)ensureAdvancedOgre(tier);enemies.push({x:player.x+Math.cos(a)*dist,y:player.y+Math.sin(a)*dist,type,tier,evolution,r:c.r*hitboxMult,speed:(c.s+Math.random()*8)*(c.boss?bossVar.speed:variant.speed),hp:Math.ceil(c.h*hpMult),max:Math.ceil(c.h*hpMult),damage:Math.ceil(c.d*dmgMult),xp:Math.ceil(c.x*xpMult),dead:false,t:Math.random()*8,seed:Math.random()*99,attackAt:0,attackFlash:0,facing:'down',skinVariant:Math.floor(Math.random()*3),aiPhase:Math.floor(Math.random()*4),mvx:0,mvy:0})}"""
g=sub(g,r"function makeEnemy\(type,near=false,forcedTier=null\)\{.*?\}function spawn\(",new_make+"function spawn(",'makeEnemy stats endgame')

# Curva de XP para P1 e P2 host-authoritative.
g=g.replace("xpNeed=Math.floor(60*Math.pow(level,1.42));","xpNeed=xpNeedFor(level);")
g=g.replace("duoXpNeed=Math.floor(60*Math.pow(duoLevel,1.42));","duoXpNeed=xpNeedFor(duoLevel);")

# Sincroniza subtier para P2.
g=rep(g,"tier:e.tier,hp:e.hp,max:e.max","tier:e.tier,evolution:e.evolution||1,hp:e.hp,max:e.max",'snapshot evolution')

# Render Host: skin II tem fallback para I enquanto os PNGs nao existem.
old="function bossVariantAura(e,img,w,h){"
# Troca apenas o miolo de drawOgreSkin por regex para evitar dependencias de formato.
new_draw="""function drawOgreSkin(e,isBoss){const stage=e.evolution||1,pack=isBoss?(e.type==='colossus'?bossColossusFrames:e.type==='voidlord'?bossVoidFrames:bossOgreFrames):(e.tier===2?(stage===2&&corrupted2OgreReady?corrupted2OgreFrames:corruptedOgreReady?corruptedOgreFrames:ogreFrames):e.tier===1?(stage===2&&elite2OgreReady?elite2OgreFrames:eliteOgreReady?eliteOgreFrames:ogreFrames):ogreFrames),ready=isBoss?(e.type==='colossus'?bossColossusReady:e.type==='voidlord'?bossVoidReady:bossOgreReady):(e.tier===2?(stage===2&&corrupted2OgreReady?corrupted2OgreReady:corruptedOgreReady||ogreReady):e.tier===1?(stage===2&&elite2OgreReady?elite2OgreReady:eliteOgreReady||ogreReady):ogreReady);let dir=e.facing||'down';const arr=pack[dir]||pack.down||[];if(!ready||!arr.length)return false;let img=arr[(e.speedMul===0?0:Math.floor(e.t/(isBoss?.15:.135)))%arr.length]||pack.down[0];if(!img)return false;if(!isBoss)img=mobSkinFrame(img,e.skinVariant||0);const h=isBoss?e.r*MOB_VISUAL_HEIGHT.bossScale:(e.tier===2?(stage===2?MOB_VISUAL_HEIGHT.corrupted2:MOB_VISUAL_HEIGHT.corrupted):e.tier===1?(stage===2?MOB_VISUAL_HEIGHT.elite2:MOB_VISUAL_HEIGHT.elite):MOB_VISUAL_HEIGHT.normal),ratio=(img.naturalWidth&&img.naturalHeight)?img.naturalWidth/img.naturalHeight:1,sideScale=!isBoss?(dir==='left'||dir==='right'?.82:(dir==='ul'||dir==='ur'||dir==='dl'||dir==='dr'?.90:1)):1,w=h*ratio*sideScale;if(isBoss)bossVariantAura(e,img,w,h);else tierAura(e,img,w,h,false);ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(img,-w/2,-h*.72,w,h);ctx.restore();return true}"""
g=sub(g,r"function drawOgreSkin\(e,isBoss\)\{.*?return true\}",new_draw,'render skins II host')

ww('src/game.js',g)

# ===== P2 =====
d=rw('src/duo.js').replace(OLD_VERSION,VERSION).replace(OLD_TAG,TAG)
d=rep(d,
"const mk8=()=>({up:[],ur:[],right:[],dr:[],down:[],dl:[],left:[],ul:[]}),mk4=()=>({up:[],down:[],right:[],left:[]});const playerArmedFrames=mk8(),playerWeaponFrames=mk8(),ogreFrames=mk8(),eliteOgreFrames=mk8(),corruptedOgreFrames=mk8(),bossColossusFrames=mk4(),bossVoidFrames=mk4();let armedReady=false,weaponReady=false,ogreReady=false,eliteReady=false,corruptedReady=false,bossColossusReady=false,bossVoidReady=false,eliteLoading=false,corruptedLoading=false,colossusLoading=false,voidLoading=false;",
"const mk8=()=>({up:[],ur:[],right:[],dr:[],down:[],dl:[],left:[],ul:[]}),mk4=()=>({up:[],down:[],right:[],left:[]});const playerArmedFrames=mk8(),playerWeaponFrames=mk8(),ogreFrames=mk8(),eliteOgreFrames=mk8(),elite2OgreFrames=mk8(),corruptedOgreFrames=mk8(),corrupted2OgreFrames=mk8(),bossColossusFrames=mk4(),bossVoidFrames=mk4();let armedReady=false,weaponReady=false,ogreReady=false,eliteReady=false,elite2Ready=false,corruptedReady=false,corrupted2Ready=false,bossColossusReady=false,bossVoidReady=false,eliteLoading=false,elite2Loading=false,corruptedLoading=false,corrupted2Loading=false,colossusLoading=false,voidLoading=false;",
'packs II P2')

needle2="async function ensureElite(){if(eliteReady||eliteLoading)return;eliteLoading=true;try{eliteReady=mapMob32(await loadFrames('assets/mobs/Ogro Elite',32,i=>'frame_'+String(i).padStart(3,'0')+'.png'),eliteOgreFrames)}catch{}finally{eliteLoading=false}}async function ensureCorrupted(){if(corruptedReady||corruptedLoading)return;corruptedLoading=true;try{corruptedReady=mapMob32(await loadFrames('assets/mobs/Ogro Corrompido',32,i=>'frame_'+String(i).padStart(3,'0')+'.png'),corruptedOgreFrames)}catch{}finally{corruptedLoading=false}}async function ensureBoss(type){"
new2="async function ensureElite(){if(eliteReady||eliteLoading)return;eliteLoading=true;try{eliteReady=mapMob32(await loadFrames('assets/mobs/Ogro Elite',32,i=>'frame_'+String(i).padStart(3,'0')+'.png'),eliteOgreFrames)}catch{}finally{eliteLoading=false}}async function optionalFrames(folder,target){try{const r=await fetch(folder+'/frame_001.png?v='+TAG,{cache:'force-cache'});if(!r.ok)return false;return mapMob32(await loadFrames(folder,32,i=>'frame_'+String(i).padStart(3,'0')+'.png'),target)}catch{return false}}async function ensureElite2(){if(elite2Ready||elite2Loading)return;elite2Loading=true;elite2Ready=await optionalFrames('assets/mobs/Ogro Elite II',elite2OgreFrames);elite2Loading=false}async function ensureCorrupted(){if(corruptedReady||corruptedLoading)return;corruptedLoading=true;try{corruptedReady=mapMob32(await loadFrames('assets/mobs/Ogro Corrompido',32,i=>'frame_'+String(i).padStart(3,'0')+'.png'),corruptedOgreFrames)}catch{}finally{corruptedLoading=false}}async function ensureCorrupted2(){if(corrupted2Ready||corrupted2Loading)return;corrupted2Loading=true;corrupted2Ready=await optionalFrames('assets/mobs/Ogro Corrompido II',corrupted2OgreFrames);corrupted2Loading=false}async function ensureBoss(type){"
# JS needs TAG available; define constant after VERSION declaration.
d=rep(d,"const VERSION='0.17.37',$=id=>","const VERSION='0.17.37',TAG='01737',$=id=>",'TAG P2')
d=rep(d,needle2,new2,'loaders II P2')
d=rep(d,"if(raw.tier===1)ensureElite();if(raw.tier===2)ensureCorrupted();if(raw.type==='colossus'||raw.type==='voidlord')ensureBoss(raw.type)","if(raw.tier===1){ensureElite();if(raw.evolution===2)ensureElite2()}if(raw.tier===2){ensureCorrupted();if(raw.evolution===2)ensureCorrupted2()}if(raw.type==='colossus'||raw.type==='voidlord')ensureBoss(raw.type)",'lazy II P2')

new_duo_draw="""function drawEnemy(e){const q=world(e.x,e.y),boss=e.max>=100||e.type==='colossus'||e.type==='voidlord';if(q.x<-160||q.y<-160||q.x>W+160||q.y>H+160)return;let img=null,h=58;if(boss){img=bossFrame(e);h=142}else{const stage=e.evolution||1,pack=e.tier===2?(stage===2&&corrupted2Ready?corrupted2OgreFrames:corruptedReady?corruptedOgreFrames:ogreFrames):e.tier===1?(stage===2&&elite2Ready?elite2OgreFrames:eliteReady?eliteOgreFrames:ogreFrames):ogreFrames,arr=pack[e.facing||'down']?.length?pack[e.facing||'down']:pack.down;if(arr?.length)img=arr[Math.floor((e.anim||0)/.135)%arr.length];h=e.tier===2?(stage===2?110:100):e.tier===1?(stage===2?88:80):59}ctx.save();ctx.translate(q.x,q.y);ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(0,boss?31:17,boss?40:18,boss?10:6,0,0,7);ctx.fill();if(img){const ratio=(img.naturalWidth||img.width)/Math.max(1,img.naturalHeight||img.height),w=h*ratio;ctx.drawImage(img,-w/2,-h*.72,w,h)}else{ctx.fillStyle=boss?'#991b1b':e.tier===2?'#ef4444':'#4d7c0f';ctx.beginPath();ctx.arc(0,0,boss?36:17,0,7);ctx.fill()}if(e.hp<e.max||boss||e.tier>0){const bw=boss?82:54,by=boss?-70:-43;ctx.fillStyle='#24080d';ctx.fillRect(-bw/2,by,bw,5);ctx.fillStyle=e.tier===2?'#ef4444':e.tier===1?'#a855f7':boss?'#f59e0b':'#fb7185';ctx.fillRect(-bw/2,by,bw*Math.max(0,e.hp/e.max),5)}ctx.restore()}"""
d=sub(d,r"function drawEnemy\(e\)\{.*?ctx\.restore\(\)\}",new_duo_draw,'render II P2')
ww('src/duo.js',d)

# ===== VERSIONAMENTO SINCRONIZADO =====
for p in ['index.html','duo.html','painel.html','map-lab.html','src/panel.js','src/map-runtime.js','src/map-lab.js','src/firebase-ranking.js']:
    path=Path(p)
    if path.exists():
        s=rw(p).replace(OLD_VERSION,VERSION).replace(OLD_TAG,TAG)
        ww(p,s)
ww('version.json',json.dumps({'version':VERSION,'build':'endgame-rage-progression'},indent=2,ensure_ascii=False)+'\n')

# ===== VALIDADORES =====
c=rw('scripts/check-game.mjs')
c=c.replace("MOB_VISUAL_HEIGHT={normal:62,elite:86,bossScale:3.55}","MOB_VISUAL_HEIGHT={normal:62,elite:86,elite2:94,corrupted:108,corrupted2:118,bossScale:3.55}")
c=c.replace("e.tier===1?MOB_VISUAL_HEIGHT.elite:MOB_VISUAL_HEIGHT.normal","e.tier===2?(stage===2?MOB_VISUAL_HEIGHT.corrupted2:MOB_VISUAL_HEIGHT.corrupted):e.tier===1?(stage===2?MOB_VISUAL_HEIGHT.elite2:MOB_VISUAL_HEIGHT.elite):MOB_VISUAL_HEIGHT.normal")
addon=r'''
// v0.17.37 · endgame rage progression
for(const d of ['assets/mobs/Ogro Elite II','assets/mobs/Ogro Corrompido II']) if(!fs.existsSync(d+'/.gitkeep')) fail('pasta futura ausente '+d); else ok('pasta futura pronta '+d);
if(!game.includes('function enemyEvolution(tier)')) fail('subtier II ausente'); else ok('Elite II / Corrompido II ativos');
if(!game.includes('level>=40')||!game.includes('level>=60')) fail('unlocks de endgame ausentes'); else ok('unlocks LV40/LV60 ativos');
if(!game.includes("elite2:{hp:4.2,dmg:2.05,speed:1.10,xp:4.2,hitbox:1.08}")) fail('stats Elite II divergentes'); else ok('stats Elite II');
if(!game.includes("corrupted2:{hp:7,dmg:2.75,speed:1.16,xp:6.5,hitbox:1.20}")) fail('stats Corrompido II divergentes'); else ok('stats Corrompido II');
if(!game.includes('function xpNeedFor(lv)')) fail('curva XP endgame ausente'); else ok('curva XP endgame ativa');
if(!game.includes("./assets/mobs/Ogro Elite II")||!game.includes("./assets/mobs/Ogro Corrompido II")) fail('fallback skins II host ausente'); else ok('fallback skins II host');
if(!game.includes('evolution:e.evolution||1')) fail('snapshot sem subtier'); else ok('subtier sincronizado ao P2');
const duo37=read('src/duo.js');
if(!duo37.includes("assets/mobs/Ogro Elite II")||!duo37.includes("assets/mobs/Ogro Corrompido II")) fail('fallback skins II P2 ausente'); else ok('fallback skins II P2');
if(!game.includes('corrupted:108,corrupted2:118')) fail('Corrompido nao e maior que Elite'); else ok('escala Corrompido > Elite');
'''
if '// v0.17.37 · endgame rage progression' not in c: c+='\n'+addon
ww('scripts/check-game.mjs',c)

print('v0.17.37 endgame progression patch applied')
