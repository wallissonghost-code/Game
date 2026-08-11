import fs from 'node:fs';

const must=(cond,msg)=>{if(!cond)throw new Error(msg)};
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);

const oldVersion='0.17.17';
const newVersion='0.17.18';
const oldTag='01717';
const newTag='01718';

const current=JSON.parse(read('version.json'));
must(current.version===oldVersion,`esperava ${oldVersion}, atual ${current.version}`);

let game=read('src/game.js');
must(game.includes("const VERSION='0.17.17'"),'VERSION antiga nao encontrada');
must(game.includes("const MOB_VISUAL_HEIGHT={normal:62,elite:86,bossScale:3.55};"),'regua visual nao encontrada');
must(game.includes("tier=c.boss?3:(forcedTier===1||forcedTier===2?forcedTier:enemyTier())"),'tier de boss antigo nao encontrado');
must(game.includes("function boss(type){makeEnemy(type||(((Math.floor(level/10))%2)?'colossus':'voidlord'),true)}"),'funcao boss antiga nao encontrada');
must(game.includes("boss(d.mob||null);"),'comando boss antigo nao encontrado');

game=game.replace("const VERSION='0.17.17'","const VERSION='0.17.18'");
game=game.replace(
  "const MOB_VISUAL_HEIGHT={normal:62,elite:86,bossScale:3.55};",
  "const MOB_VISUAL_HEIGHT={normal:62,elite:86,bossScale:3.55};const BOSS_VARIANTS={normal:{hp:1,dmg:1,speed:1,xp:1},elite:{hp:1.75,dmg:1.25,speed:1.05,xp:1.75},corrupted:{hp:2.5,dmg:1.5,speed:1.10,xp:2.5}};"
);

game=game.replace(
  "function enemyTier(){const r=Math.random(),corrupt=level>=30?.12:level>=20?.08:level>=10?.035:0,elite=level>=30?.24:level>=15?.18:level>=5?.10:0;if(r<corrupt)return 2;if(r<corrupt+elite)return 1;return 0}function makeEnemy(type,near=false,forcedTier=null){",
  "function enemyTier(){const r=Math.random(),corrupt=level>=30?.12:level>=20?.08:level>=10?.035:0,elite=level>=30?.24:level>=15?.18:level>=5?.10:0;if(r<corrupt)return 2;if(r<corrupt+elite)return 1;return 0}function bossTier(forced=null){if(forced===1||forced==='1'||forced==='elite')return 1;if(forced===2||forced==='2'||forced==='corrupted')return 2;if(forced===3||forced==='3'||forced==='normal')return 3;const r=Math.random();return r<.01?2:r<.07?1:3}function makeEnemy(type,near=false,forcedTier=null){"
);

game=game.replace(
  "tier=c.boss?3:(forcedTier===1||forcedTier===2?forcedTier:enemyTier()),hpMult=tier===2?5:tier===1?3:1,dmgMult=tier===2?2.2:tier===1?1.7:1,xpMult=tier===2?6:tier===1?3.5:1;enemies.push({x:player.x+Math.cos(a)*dist,y:player.y+Math.sin(a)*dist,type,tier,r:c.r,speed:(c.s+Math.random()*8)*(tier===2?1.10:tier===1?1.05:1),hp:Math.ceil(c.h*hpMult),max:Math.ceil(c.h*hpMult),damage:Math.ceil(c.d*dmgMult),xp:Math.ceil(c.x*xpMult),",
  "tier=c.boss?bossTier(forcedTier):(forcedTier===1||forcedTier===2?forcedTier:enemyTier()),bossVar=c.boss?(tier===2?BOSS_VARIANTS.corrupted:tier===1?BOSS_VARIANTS.elite:BOSS_VARIANTS.normal):null,hpMult=c.boss?bossVar.hp:(tier===2?5:tier===1?3:1),dmgMult=c.boss?bossVar.dmg:(tier===2?2.2:tier===1?1.7:1),xpMult=c.boss?bossVar.xp:(tier===2?6:tier===1?3.5:1);enemies.push({x:player.x+Math.cos(a)*dist,y:player.y+Math.sin(a)*dist,type,tier,r:c.r,speed:(c.s+Math.random()*8)*(c.boss?bossVar.speed:(tier===2?1.10:tier===1?1.05:1)),hp:Math.ceil(c.h*hpMult),max:Math.ceil(c.h*hpMult),damage:Math.ceil(c.d*dmgMult),xp:Math.ceil(c.x*xpMult),"
);

game=game.replace(
  "function boss(type){makeEnemy(type||(((Math.floor(level/10))%2)?'colossus':'voidlord'),true)}",
  "function boss(type,forcedTier=null){makeEnemy(type||(((Math.floor(level/10))%2)?'colossus':'voidlord'),true,forcedTier)}"
);
game=game.replace("boss(d.mob||null);","boss(d.mob||null,d.tier??null);");

const auraAnchor="function mobSkinFrame(img,v){return img}function drawOgreSkin(e,isBoss){";
must(game.includes(auraAnchor),'ancora de render dos mobs nao encontrada');
game=game.replace(auraAnchor,
  "function bossVariantAura(e,img,w,h){if(!img||(e.tier!==1&&e.tier!==2))return;const pulse=.82+Math.sin(e.t*2.7)*.18,sets=e.tier===1?[['#172554',26],['#3b82f6',18],['#a855f7',10]]:[['#09090b',30],['#7f1d1d',22],['#ef4444',12]];ctx.save();ctx.globalCompositeOperation='source-over';for(const [color,blur] of sets){ctx.save();ctx.globalAlpha=.48*pulse;ctx.shadowColor=color;ctx.shadowBlur=perfMode>=2?Math.max(6,blur*.5):perfMode===1?blur*.72:blur;ctx.drawImage(img,-w/2,-h*.72,w,h);ctx.restore()}ctx.restore()}function mobSkinFrame(img,v){return img}function drawOgreSkin(e,isBoss){"
);

game=game.replace(
  "if(!isBoss)tierAura(e,img,w,h,false);ctx.save();",
  "if(isBoss)bossVariantAura(e,img,w,h);else tierAura(e,img,w,h,false);ctx.save();"
);
game=game.replace(
  "ctx.fillStyle=isBoss?'#f59e0b':e.tier===2?'#ef4444':e.tier===1?'#a855f7':'#fb7185';",
  "ctx.fillStyle=isBoss?(e.tier===2?'#ef4444':e.tier===1?'#a855f7':'#f59e0b'):e.tier===2?'#ef4444':e.tier===1?'#a855f7':'#fb7185';"
);
game=game.replace(
  "ctx.fillText(c.name,0,barY-7)",
  "ctx.fillText(c.name+(e.tier===2?' · CORROMPIDO':e.tier===1?' · ELITE':''),0,barY-7)"
);
write('src/game.js',game);

let panelHtml=read('painel.html');
must(panelHtml.includes('<h3>Bosses · 100 HP</h3>'),'bloco antigo de bosses nao encontrado no painel');
panelHtml=panelHtml.replace(
  '<h3>Bosses · 100 HP</h3><div class="grid"><button class="gold" data-cmd="boss" data-mob="colossus">👹 COLOSSO CARMESIM</button><button class="purple" data-cmd="boss" data-mob="voidlord">👁 SENHOR DO VAZIO</button></div>',
  '<h3>Bosses · variantes raras</h3><div class="tools mobsTools"><select id="bossTier"><option value="">🎲 Natural · 93% normal / 6% Elite / 1% Corrompido</option><option value="normal">Normal</option><option value="1">🟣 Forçar ELITE</option><option value="2">🔴⚫ Forçar CORROMPIDO</option></select></div><div class="grid"><button class="gold" data-cmd="boss" data-mob="colossus">👹 COLOSSO CARMESIM</button><button class="purple" data-cmd="boss" data-mob="voidlord">👁 SENHOR DO VAZIO</button></div>'
);
panelHtml=panelHtml.replaceAll(oldVersion,newVersion).replaceAll(oldTag,newTag);
write('painel.html',panelHtml);

let panel=read('src/panel.js');
const generic="value:b.dataset.value==='true'?true:b.dataset.value==='false'?false:undefined},b.textContent.trim())";
must(panel.includes(generic),'handler generico do painel nao encontrado');
panel=panel.replace(generic,"value:b.dataset.value==='true'?true:b.dataset.value==='false'?false:undefined,tier:b.dataset.cmd==='boss'?($('bossTier')?.value||null):undefined},b.textContent.trim())");
write('src/panel.js',panel);

let index=read('index.html');
index=index.replaceAll(oldVersion,newVersion).replaceAll(oldTag,newTag);
write('index.html',index);

write('version.json',JSON.stringify({version:newVersion,build:'rare-boss-elite-corrupted'},null,2)+'\n');

let check=read('scripts/check-game.mjs');
check=check.replace("'mobTier','mobType'","'bossTier','mobTier','mobType'");
check += `\n// v0.17.18 · variantes raras de Boss\nif(!game.includes("BOSS_VARIANTS={normal:{hp:1,dmg:1,speed:1,xp:1},elite:{hp:1.75,dmg:1.25,speed:1.05,xp:1.75},corrupted:{hp:2.5,dmg:1.5,speed:1.10,xp:2.5}}")) fail('multiplicadores de Boss divergentes'); else ok('Boss Elite/Corrompido balanceados');\nif(!game.includes("return r<.01?2:r<.07?1:3")) fail('chance rara de Boss divergente'); else ok('Boss natural 93/6/1');\nif(!game.includes("boss(d.mob||null,d.tier??null)")) fail('Admin nao envia tier ao Boss'); else ok('Boss aceita tier forcado');\nif(!game.includes("bossVariantAura")) fail('aura de Boss raro ausente'); else ok('aura de Boss raro');\nif(!game.includes("· CORROMPIDO")||!game.includes("· ELITE")) fail('rotulo visual de Boss raro ausente'); else ok('rotulo Elite/Corrompido no Boss');\nif(!panelHtml.includes('id="bossTier"')) fail('seletor de tier do Boss ausente'); else ok('Admin controla tier do Boss');\nif(!panel.includes("b.dataset.cmd==='boss'?($('bossTier')?.value||null):undefined")) fail('painel nao envia tier de Boss'); else ok('painel envia tier de Boss');\n`;
write('scripts/check-game.mjs',check);

console.log('v0.17.18 preparada: Boss normal 93%, Elite 6%, Corrompido 1%; Admin pode forcar tier.');
