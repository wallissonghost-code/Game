import fs from 'node:fs';

const file='cloud/connector-server.mjs';
let s=fs.readFileSync(file,'utf8');
if(s.includes('// v0.10.3 — telemetry isolada e segura')){
  console.log('v0.10.3 already applied');
  process.exit(0);
}

const gameAnchor=`  // v0.9.5 — comandos de teste de habilidades pelo Admin`;
if(!s.includes(gameAnchor)) throw new Error('game anchor not found');
const gamePatch=`  // v0.10.3 — telemetry isolada e segura\n  rep('<div class="ghost" id="connectionMini">PAINEL: DESCONECTADO</div>','<div class="ghost" id="telemetryMini"><div id="connectionMini">PAINEL: DESCONECTADO</div><div id="liveMini">LIVE: DESCONECTADA</div><div id="fpsMini">FPS: --</div></div>');\n  rep("function command(d){const c=d.command;","function command(d){try{window.dispatchEvent(new CustomEvent('caos:admin-command',{detail:d}))}catch{}const c=d.command;");\n  if(!out.includes('data-caos-telemetry-v0103')){\n    out=out.replace('</body>',\`<script data-caos-telemetry-v0103>\n(()=>{\n'use strict';\nconst fpsEl=document.getElementById('fpsMini'),liveEl=document.getElementById('liveMini');\nlet visible=true,frames=0,last=performance.now(),fps=0;\ntry{visible=localStorage.getItem('caos-show-fps')!=='0'}catch{}\nfunction paint(){if(fpsEl){fpsEl.style.display=visible?'block':'none';fpsEl.textContent='FPS: '+fps}}\nfunction tick(t){frames++;if(t-last>=500){fps=Math.max(0,Math.round(frames*1000/(t-last)));frames=0;last=t;paint()}requestAnimationFrame(tick)}\nwindow.addEventListener('caos:admin-command',e=>{const d=e.detail||{};if(d.command==='fps'){visible=!!d.value;try{localStorage.setItem('caos-show-fps',visible?'1':'0')}catch{}paint()}if(d.command==='live-status'&&liveEl){const on=!!d.value;liveEl.textContent='LIVE: '+(on?'CONECTADA':'DESCONECTADA');liveEl.style.color=on?'#22c55e':'#7681aa'}});\npaint();requestAnimationFrame(tick);\n})();\n<\\/script></body>\`);\n  }\n`;
s=s.replace(gameAnchor,gamePatch+gameAnchor);

const adminAnchor=` rep("let rules=[];const cooldowns=new Map();","let rules=[];const cooldowns=new Map();let liveLikeTotal=0,likeShieldProgress=0,likeShieldCooldownUntil=0,pendingShieldOwner='';const mobCommentLastByUser=new Map();let mobCommentWindow=[];let MOB_USER_COOLDOWN=400,MAX_MOB_COMMENTS_10S=20;const MOB_PROFILE_KEY='chaos-mob-profile-v1';");`;
if(!s.includes(adminAnchor)) throw new Error('admin anchor not found');
const adminPatch=` // v0.10.3 — FPS toggle + sincronizacao LIVE sem tocar no nucleo do jogo\n rep('<div class="grid actionGrid">','<button id="fpsModeToggle" class="modeToggle" type="button" data-on="true" style="margin:0 0 12px"><span class="modeInfo"><span class="modeIcon">📊</span><span><b>MOSTRAR FPS</b><small>exibe ou oculta o contador no jogo</small></span></span><span class="modeRight"><span class="modeBadge">ON</span><span class="toggleTrack"><span class="toggleKnob"></span></span></span></button><div class="grid actionGrid">');\n rep("$('connect').onclick=()=>{retry=0;connect(false)};","window.caosAdminSend=send;$('connect').onclick=()=>{retry=0;connect(false)};");\n if(!out.includes('data-caos-admin-telemetry-v0103')){\n   out=out.replace('</body>',\`<script data-caos-admin-telemetry-v0103>\n(()=>{\n'use strict';\nconst fps=document.getElementById('fpsModeToggle'),liveBadge=document.getElementById('liveBadge'),status=document.getElementById('status');\nlet fpsOn=true,lastLive=null;try{fpsOn=localStorage.getItem('caos-show-fps')!=='0'}catch{}\nfunction drawFps(){if(!fps)return;fps.dataset.on=fpsOn?'true':'false';fps.classList.toggle('isOn',fpsOn);const b=fps.querySelector('.modeBadge');if(b)b.textContent=fpsOn?'ON':'OFF'}\nfunction send(data,label){if(typeof window.caosAdminSend==='function')return window.caosAdminSend(data,label);return false}\nfunction syncFps(){drawFps();send({command:'fps',value:fpsOn},'📊 FPS '+(fpsOn?'ON':'OFF'))}\nfunction liveNow(){const t=(liveBadge?.textContent||'').toUpperCase();return t.includes('LIVE CONECTADA')}\nfunction syncLive(force=false){const on=liveNow();if(force||on!==lastLive){lastLive=on;send({command:'live-status',value:on},'📡 LIVE '+(on?'CONECTADA':'DESCONECTADA'))}}\nif(fps){fps.onclick=()=>{fpsOn=!fpsOn;try{localStorage.setItem('caos-show-fps',fpsOn?'1':'0')}catch{}syncFps()};drawFps()}\nif(liveBadge)new MutationObserver(()=>syncLive(false)).observe(liveBadge,{childList:true,subtree:true,characterData:true});\nif(status)new MutationObserver(()=>{if((status.textContent||'').includes('CONECTADO AO JOGO')){setTimeout(()=>{syncFps();syncLive(true)},150)}}).observe(status,{childList:true,subtree:true,characterData:true});\nsetTimeout(()=>{syncFps();syncLive(true)},800);\n})();\n<\\/script></body>\`);\n }\n`;
s=s.replace(adminAnchor,adminPatch+adminAnchor);

fs.writeFileSync(file,s);

const versionFile='version.json';
const v=JSON.parse(fs.readFileSync(versionFile,'utf8'));
v.version='0.10.3';v.label='v0.10.3';v.releasedAt='2026-08-07T21:19:00-03:00';v.build='safe-telemetry-layer';v.notes=['FPS isolado do loop principal','Toggle Mostrar FPS no Admin','Status LIVE conectado/desconectado no jogo','Sem alterar Play, reset ou spawn'];
fs.writeFileSync(versionFile,JSON.stringify(v,null,2)+'\n');
console.log('v0.10.3 applied');
