import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const mustReplace=(src,from,to,label)=>{
  if(!src.includes(from)) throw new Error('Trecho não encontrado: '+label);
  return src.replace(from,to);
};
const mustRegex=(src,re,to,label)=>{
  if(!re.test(src)) throw new Error('Padrão não encontrado: '+label);
  re.lastIndex=0;
  return src.replace(re,to);
};
const bump=s=>s.replaceAll('0.17.13','0.17.14').replaceAll('01713','01714');

let game=bump(read('src/game.js')).replaceAll('01711','01714');
let panel=bump(read('src/panel.js'));
let panelHtml=bump(read('painel.html'));
let panelCss=read('src/styles/panel.css');
let gameHtml=bump(read('index.html'));
let check=read('scripts/check-game.mjs');

// Fonte única de cache para TODOS os assets da build.
game=mustReplace(game,"const VERSION='0.17.14',$=","const VERSION='0.17.14',ASSET_TAG=VERSION.replace(/\\./g,''),$=",'ASSET_TAG');
game=mustReplace(game,"autoFire=true,manualAimByMovement=false,runStartedAt=0","autoFire=true,gameplayMode='classic',movementAimAngle=0,runStartedAt=0",'estado gameplay');
game=mustReplace(game,"async function loadDirectPngSequence(folder,count,cacheTag='01714')","async function loadDirectPngSequence(folder,count,cacheTag=ASSET_TAG)",'cache direct PNG');
game=mustReplace(game,"async function loadNamedPngSequence(folder,prefix,count,cacheTag='01714')","async function loadNamedPngSequence(folder,prefix,count,cacheTag=ASSET_TAG)",'cache named PNG');
game=mustReplace(game,"return folder.includes('/mobs')?await cropAlphaFrame(img):img","return(folder.includes('/mobs')||folder.includes('/weapons'))?await cropAlphaFrame(img):img",'crop alpha weapon');
game=game.replaceAll("fetch(path+'?v=01714',{cache:'no-store'})","fetch(path+'?v='+ASSET_TAG,{cache:'no-store'})");
game=mustReplace(game,"soldierSprite.src='./assets/player/soldier-premium-01.png?v=01714';","soldierSprite.src='./assets/player/soldier-premium-01.png?v='+ASSET_TAG;",'cache soldier');
game=mustReplace(game,"weaponSprite.src='./assets/weapons/assault-rifle-01.png?v=01714';","weaponSprite.src='./assets/weapons/assault-rifle-01.png?v='+ASSET_TAG;",'cache weapon sprite');
for(const [from,to,label] of [
  ["loadDirectPngSequence('./assets/player',32,'01714')","loadDirectPngSequence('./assets/player',32,ASSET_TAG)",'player cache'],
  ["loadNamedPngSequence('./assets/player-armed','Posearma',32,'01714')","loadNamedPngSequence('./assets/player-armed','Posearma',32,ASSET_TAG)",'armed cache'],
  ["loadDirectPngSequence('./assets/weapons',32,'01714')","loadDirectPngSequence('./assets/weapons',32,ASSET_TAG)",'weapon cache'],
  ["loadDirectPngSequence('./assets/mobs/Ogro',32,'01714')","loadDirectPngSequence('./assets/mobs/Ogro',32,ASSET_TAG)",'ogro cache']
]) game=mustReplace(game,from,to,label);

// Varredura: prioriza o centro do cone e, em empate visual, o alvo mais próximo.
const sweepHelpers=`const SWEEP_HALF_ANGLE=Math.PI/3;function angleDelta(a,b){return((a-b+Math.PI*3)%(Math.PI*2))-Math.PI}function sweepTarget(){let target=null,best=Infinity;const facing=Number.isFinite(movementAimAngle)?movementAimAngle:(player.aim||0);for(const e of enemies){if(e.dead||!targetVisible(e))continue;const dx=e.x-player.x,dy=e.y-player.y,dist=Math.hypot(dx,dy);if(dist>FIRE_RANGE)continue;const a=Math.atan2(dy,dx),delta=Math.abs(angleDelta(a,facing));if(delta>SWEEP_HALF_ANGLE)continue;const score=delta*900+dist*.18;if(score<best){best=score;target=e}}return target}`;
game=mustReplace(game,'function focusedTarget(){',sweepHelpers+'function focusedTarget(){','sweep helper');

const newShoot=`function shoot(){let target=null;if(autoMode){target=focusedTarget();if(!target)return;player.aim=Math.atan2(target.y-player.y,target.x-player.x)}else if(gameplayMode==='sweep'){target=sweepTarget();if(!target)return;player.aim=Math.atan2(target.y-player.y,target.x-player.x)}else if(gameplayMode==='hardcore'){player.aim=movementAimAngle}else{target=nearestVisible();if(!target)return;player.aim=Math.atan2(target.y-player.y,target.x-player.x)}player.shotFlash=.1;const dir=playerFacing(player.aim),m=muzzleLocal(dir),pl=skillLv.pierce||0;let pierceLeft=0;if(pl){pierceShotCounter++;const every=[0,12,11,10,9,8][pl];if(pierceShotCounter>=every){pierceShotCounter=0;pierceLeft=[0,2,3,4,5,7][pl]}}bullets.push({x:player.x+m.x,y:player.y+m.y,vx:Math.cos(player.aim)*610,vy:Math.sin(player.aim)*610,r:4,dead:false,ammo:1,born:performance.now(),pierceLeft,hits:[]});if(player.flashDamage&&++flashCounter%5===0)flash()}`;
game=mustRegex(game,/function shoot\(\)\{.*?\}function setPaused/s,newShoot+'function setPaused','shoot modes');

const oldMove="if(player.moving){player.x+=player.moveX*player.speed*dt;player.y+=player.moveY*player.speed*dt;player.walk+=dt*9}if(manualAimByMovement&&!autoMode){if(player.moving)player.aim=Math.atan2(player.moveY,player.moveX)}else if(autoFire){const target=autoMode?focusedTarget():nearestVisible();if(target){const wanted=Math.atan2(target.y-player.y,target.x-player.x);let da=((wanted-player.aim+Math.PI*3)%(Math.PI*2))-Math.PI;player.aim+=da*Math.min(1,dt*7)}}else if(player.moving){const wanted=Math.atan2(dy,dx);let da=((wanted-player.aim+Math.PI*3)%(Math.PI*2))-Math.PI;player.aim+=da*Math.min(1,dt*5)}";
const newMove="if(player.moving){player.x+=player.moveX*player.speed*dt;player.y+=player.moveY*player.speed*dt;player.walk+=dt*9;if(!autoMode&&(gameplayMode==='sweep'||gameplayMode==='hardcore'))movementAimAngle=Math.atan2(player.moveY,player.moveX)}if(!autoMode&&gameplayMode==='hardcore'){player.aim=movementAimAngle}else if(!autoMode&&gameplayMode==='sweep'){const target=autoFire?sweepTarget():null,wanted=target?Math.atan2(target.y-player.y,target.x-player.x):movementAimAngle;let da=angleDelta(wanted,player.aim);player.aim+=da*Math.min(1,dt*(target?8:11))}else if(autoFire){const target=autoMode?focusedTarget():nearestVisible();if(target){const wanted=Math.atan2(target.y-player.y,target.x-player.x);let da=angleDelta(wanted,player.aim);player.aim+=da*Math.min(1,dt*7)}}else if(player.moving){const wanted=Math.atan2(dy,dx);let da=angleDelta(wanted,player.aim);player.aim+=da*Math.min(1,dt*5)}";
game=mustReplace(game,oldMove,newMove,'update gameplay modes');

const oldManual="if(c==='manualaim'){manualAimByMovement=!!d.value;clearAutoTarget();toast('🎯 MIRA PELO MOVIMENTO '+(manualAimByMovement?'ON':'OFF'))}";
const newMode="if(c==='gameplaymode'){const mode=String(d.value||'classic').toLowerCase();gameplayMode=['classic','sweep','hardcore'].includes(mode)?mode:'classic';movementAimAngle=player.aim||0;clearAutoTarget();toast(gameplayMode==='classic'?'🎮 JOGABILIDADE · CLÁSSICO':gameplayMode==='sweep'?'🎯 JOGABILIDADE · VARREDURA':'💀 JOGABILIDADE · HARDCORE')}if(c==='manualaim'){gameplayMode=d.value?'hardcore':'classic';movementAimAngle=player.aim||0;clearAutoTarget()}";
game=mustReplace(game,oldManual,newMode,'command gameplaymode');
game=mustReplace(game,'manualAim:manualAimByMovement,wave:waveCount','gameplayMode,manualAim:gameplayMode===\'hardcore\',wave:waveCount','telemetry gameplay mode');

// Calibração visual da arma: normaliza tamanho/posição por octante.
const oldLayout=`const weaponLayout={
      down:{x:0,y:-2,maxW:44,maxH:60,flip:false},dr:{x:15,y:-6,maxW:72,maxH:44,flip:false},right:{x:16,y:-5,maxW:78,maxH:40,flip:true},ur:{x:14,y:-11,maxW:68,maxH:44,flip:false},
      up:{x:0,y:-20,maxW:40,maxH:62,flip:false},ul:{x:-14,y:-11,maxW:68,maxH:44,flip:false},left:{x:-16,y:-5,maxW:78,maxH:40,flip:false},dl:{x:-15,y:-6,maxW:72,maxH:44,flip:false}
    };`;
const newLayout=`const weaponLayout={
      down:{x:2,y:-1,maxW:30,maxH:50,flip:false},dr:{x:14,y:-6,maxW:52,maxH:31,flip:false},right:{x:17,y:-5,maxW:56,maxH:28,flip:true},ur:{x:13,y:-12,maxW:50,maxH:31,flip:false},
      up:{x:0,y:-18,maxW:30,maxH:50,flip:false},ul:{x:-13,y:-12,maxW:50,maxH:31,flip:false},left:{x:-17,y:-5,maxW:56,maxH:28,flip:false},dl:{x:-14,y:-6,maxW:52,maxH:31,flip:false}
    };`;
game=mustReplace(game,oldLayout,newLayout,'weapon layout');
game=mustReplace(game,"function muzzleLocal(dir){const m={right:{x:50,y:-4},dr:{x:42,y:27},down:{x:7,y:38},dl:{x:-42,y:27},left:{x:-50,y:-4},ul:{x:-42,y:-31},up:{x:0,y:-52},ur:{x:42,y:-31}};return m[dir]||m.down}","function muzzleLocal(dir){const m={right:{x:46,y:-5},dr:{x:38,y:23},down:{x:5,y:35},dl:{x:-38,y:23},left:{x:-46,y:-5},ul:{x:-36,y:-30},up:{x:0,y:-46},ur:{x:36,y:-30}};return m[dir]||m.down}",'muzzle calibration');

// Painel: 3 opções exclusivas de jogabilidade.
const oldManualButton=`      <button id="manualAimModeToggle" class="modeToggle" type="button" data-on="false"><span class="modeInfo"><span class="modeIcon">🎯</span><span><b>MIRA PELO MOVIMENTO</b><small>OFF = clássico · ON = movimento define mira e tiro</small></span></span><span class="modeRight"><span class="modeBadge">OFF</span><span class="toggleTrack"><span class="toggleKnob"></span></span></span></button>`;
const modeBox=`      <div class="gameplayModeBox">
        <div class="gameplayModeHead"><span><b>🎮 JOGABILIDADE</b><small>Escolha como o soldado mira durante o controle manual.</small></span><strong id="gameplayModeState">CLÁSSICO</strong></div>
        <div class="gameplayModeChoices">
          <button id="gameplayClassic" class="gameplayChoice active" type="button" data-gameplay-mode="classic"><b>CLÁSSICO</b><small>mira automática livre</small></button>
          <button id="gameplaySweep" class="gameplayChoice" type="button" data-gameplay-mode="sweep"><b>VARREDURA</b><small>alvos somente à frente</small></button>
          <button id="gameplayHardcore" class="gameplayChoice" type="button" data-gameplay-mode="hardcore"><b>HARDCORE</b><small>tiro preso ao movimento</small></button>
        </div>
        <p id="gameplayModeHint" class="gameplayModeHint">Clássico: comportamento original do Caos Live.</p>
      </div>`;
panelHtml=mustReplace(panelHtml,oldManualButton,modeBox,'painel gameplay selector');
panelHtml=mustReplace(panelHtml,'<div><span>PERFORMANCE</span><b id="perfState">—</b></div>','<div><span>PERFORMANCE</span><b id="perfState">—</b></div><div><span>JOGABILIDADE</span><b id="gameplayState">CLÁSSICO</b></div>','telemetry gameplay');

const oldPanelSync="const mat=$('manualAimModeToggle');if(mat&&typeof d.manualAim==='boolean'){mat.dataset.on=d.manualAim?'true':'false';mat.classList.toggle('isOn',!!d.manualAim);const mb=mat.querySelector('.modeBadge');if(mb)mb.textContent=d.manualAim?'ON':'OFF'};";
const newPanelSync="const mode=String(d.gameplayMode||(d.manualAim?'hardcore':'classic'));if($('gameplayState'))$('gameplayState').textContent=mode==='sweep'?'VARREDURA':mode==='hardcore'?'HARDCORE':'CLÁSSICO';if($('gameplayModeState'))$('gameplayModeState').textContent=mode==='sweep'?'VARREDURA':mode==='hardcore'?'HARDCORE':'CLÁSSICO';document.querySelectorAll('[data-gameplay-mode]').forEach(x=>x.classList.toggle('active',x.dataset.gameplayMode===mode));if($('gameplayModeHint'))$('gameplayModeHint').textContent=mode==='sweep'?'Varredura: só trava e dispara em inimigos dentro do cone frontal de 120°; sem alvo, não atira.':mode==='hardcore'?'Hardcore: movimento define exatamente a direção da mira e do tiro.':'Clássico: comportamento original, mirando no inimigo visível mais próximo.';";
panel=mustReplace(panel,oldPanelSync,newPanelSync,'panel state gameplay');
const oldPanelClick="if($('manualAimModeToggle'))$('manualAimModeToggle').onclick=()=>{const next=$('manualAimModeToggle').dataset.on!=='true';send({command:'manualaim',value:next},'🎯 Mira pelo Movimento '+(next?'ON':'OFF'))};";
const newPanelClick="document.querySelectorAll('[data-gameplay-mode]').forEach(b=>b.onclick=()=>{const mode=b.dataset.gameplayMode;send({command:'gameplaymode',value:mode},'🎮 Jogabilidade '+(mode==='sweep'?'VARREDURA':mode==='hardcore'?'HARDCORE':'CLÁSSICO'))});";
panel=mustReplace(panel,oldPanelClick,newPanelClick,'panel click gameplay');

if(!panelCss.includes('.gameplayModeBox{')) panelCss+=`\n/* Gameplay selector v0.17.14 */\n.gameplayModeBox{grid-column:1/-1;border:1px solid rgba(116,132,204,.22);border-radius:18px;padding:14px;background:linear-gradient(135deg,rgba(15,23,42,.82),rgba(9,13,27,.74))}.gameplayModeHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.gameplayModeHead>span{display:flex;flex-direction:column;gap:3px}.gameplayModeHead b{font-size:12px;letter-spacing:.08em}.gameplayModeHead small,.gameplayModeHint{color:#8e9aba;font-size:10px}.gameplayModeHead strong{font-size:10px;letter-spacing:.08em;color:#c4b5fd;border:1px solid rgba(139,92,246,.34);background:rgba(109,40,217,.12);padding:7px 10px;border-radius:999px}.gameplayModeChoices{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.gameplayChoice{min-height:66px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;padding:11px 12px;border:1px solid rgba(99,115,170,.25);background:rgba(6,10,22,.72);border-radius:13px;color:#dbe5ff;text-align:left}.gameplayChoice b{font-size:11px;letter-spacing:.055em}.gameplayChoice small{font-size:9px;color:#7784a6}.gameplayChoice.active{border-color:rgba(34,211,238,.75);background:linear-gradient(135deg,rgba(8,145,178,.19),rgba(109,40,217,.18));box-shadow:0 0 0 1px rgba(34,211,238,.08),0 10px 30px rgba(0,0,0,.18)}.gameplayChoice.active b{color:#a5f3fc}.gameplayModeHint{margin:10px 2px 0;line-height:1.45}@media(max-width:620px){.gameplayModeChoices{grid-template-columns:1fr}.gameplayChoice{min-height:54px}.gameplayModeHead{align-items:flex-start}}\n`;

// Atualiza validador para a nova arquitetura.
check=check.replace(/\nif\(!game\.includes\('manualAimByMovement=false'\)[\s\S]*?if\(!panel\.includes\("typeof d\.manualAim==='boolean'"\)\) fail\('painel nao sincroniza manualAim'\); else ok\('painel sincroniza manualAim'\);\n/,'\n');
check+=`\n// v0.17.14 · gameplay + weapon\nif(!game.includes("gameplayMode='classic'")) fail('jogabilidade nao inicia em Classico'); else ok('Classico por padrao');\nif(!game.includes("gameplayMode==='sweep'")) fail('modo Varredura ausente'); else ok('Varredura presente');\nif(!game.includes("gameplayMode==='hardcore'")) fail('modo Hardcore ausente'); else ok('Hardcore presente');\nif(!game.includes('const SWEEP_HALF_ANGLE=Math.PI/3')) fail('cone de Varredura divergente'); else ok('cone Varredura 120 graus');\nif(!game.includes("target=sweepTarget();if(!target)return")) fail('Varredura pode atirar sem alvo'); else ok('Varredura nao atira sem alvo');\nif(!game.includes("if(c==='gameplaymode')")) fail('comando gameplaymode ausente'); else ok('comando gameplaymode');\nif(!game.includes("gameplayMode,manualAim:gameplayMode==='hardcore'")) fail('telemetria gameplay ausente'); else ok('telemetria gameplay');\nfor(const id of ['gameplayClassic','gameplaySweep','gameplayHardcore','gameplayModeState','gameplayModeHint','gameplayState']) if(!panelHtml.includes(\`id="\${id}"\`)) fail('controle gameplay ausente: '+id);\nif(!panel.includes("command:'gameplaymode'")) fail('painel nao envia gameplaymode'); else ok('painel envia gameplaymode');\nif(!panel.includes("d.gameplayMode||(d.manualAim?'hardcore':'classic')")) fail('painel nao sincroniza gameplay'); else ok('painel sincroniza gameplay');\nif(!game.includes("folder.includes('/mobs')||folder.includes('/weapons')")) fail('arma nao normaliza alpha'); else ok('arma normaliza margens transparentes');\nif(game.includes('01711')) fail('cache legado 01711 ainda presente no game'); else ok('sem cache legado 01711');\nif(!game.includes("ASSET_TAG=VERSION.replace(/\\\\./g,'')")) fail('ASSET_TAG dinamico ausente'); else ok('cache de assets deriva da versao');\n`;

write('src/game.js',game);
write('src/panel.js',panel);
write('painel.html',panelHtml);
write('src/styles/panel.css',panelCss);
write('index.html',gameHtml);
write('scripts/check-game.mjs',check);
write('version.json',JSON.stringify({version:'0.17.14',build:'gameplay-classic-sweep-hardcore-weapon-calibration'},null,2)+'\n');

console.log('Release v0.17.14 aplicada.');
