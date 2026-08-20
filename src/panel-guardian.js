(()=>{'use strict';
const $=id=>document.getElementById(id);

function installStyles(){
  if(document.querySelector('link[data-caos-admin-shell]'))return;
  const l=document.createElement('link');
  l.rel='stylesheet';l.href='src/styles/panel-shell.css?v=2';l.dataset.caosAdminShell='1';
  document.head.appendChild(l);
}

function installGuardianAdmin(){
  const select=$('skillTestSelect');
  if(select&&!select.querySelector('option[value="guardian"]')){
    const option=document.createElement('option');
    option.value='guardian';
    option.textContent='☄️ Guardião Celestial';
    const phoenix=select.querySelector('option[value="phoenix"]');
    select.insertBefore(option,phoenix||null);
  }
  const state=$('skillStateList');
  if(state){
    const pretty=()=>{
      if(/\bguardian\b/i.test(state.textContent||''))state.textContent=state.textContent.replace(/\bguardian\b/gi,'Guardião Celestial');
    };
    pretty();
    new MutationObserver(pretty).observe(state,{childList:true,subtree:true,characterData:true});
  }
}

function installMobileTapSafety(){
  document.addEventListener('dblclick',e=>{
    if(e.target.closest('button,[role="button"],a.openGame'))e.preventDefault();
  },{passive:false});
  let lastTap=0,lastTarget=null;
  document.addEventListener('touchend',e=>{
    const target=e.target.closest('button,[role="button"]');
    if(!target)return;
    const now=Date.now();
    if(lastTarget===target&&now-lastTap<320)e.preventDefault();
    lastTap=now;lastTarget=target;
  },{passive:false});
}

function proxyCommand(command,patch={}){
  const source=document.querySelector(`[data-cmd="${command}"]`);
  if(!source)return false;
  const old={};
  for(const [k,v] of Object.entries(patch)){old[k]=source.dataset[k];if(v===undefined||v===null)delete source.dataset[k];else source.dataset[k]=String(v)}
  source.click();
  for(const [k,v] of Object.entries(old)){if(v===undefined)delete source.dataset[k];else source.dataset[k]=v}
  return true;
}
function makeButton(label,sub,cls,onClick){const b=document.createElement('button');b.type='button';b.className=cls||'';b.innerHTML=`${label}${sub?`<small>${sub}</small>`:''}`;b.addEventListener('click',onClick);return b}

function installPlayerControlStrip(){
  if($('caosPlayerControlStrip'))return;
  const actionGrid=document.querySelector('.actionGrid');if(!actionGrid)return;
  const strip=document.createElement('div');strip.id='caosPlayerControlStrip';strip.className='caosControlStrip';
  strip.append(
    makeButton('❤ CURAR +5','P1/P2 selecionado','heal',()=>proxyCommand('heal',{amount:5})),
    makeButton('❤ CURAR +25','P1/P2 selecionado','heal',()=>proxyCommand('heal',{amount:25})),
    makeButton('❤ VIDA CHEIA','cura até o máximo','heal',()=>proxyCommand('heal',{amount:9999})),
    makeButton('💥 DANO -10','P1/P2 selecionado','danger',()=>proxyCommand('damage',{amount:10}))
  );
  actionGrid.insertAdjacentElement('afterend',strip);
}

function installLiveDirector(){
  if($('caosLiveDirector'))return;
  const anchor=document.querySelector('.automationsCard');if(!anchor)return;
  const card=document.createElement('section');card.id='caosLiveDirector';card.className='caosQuickCard';card.dataset.adminArea='live';
  card.innerHTML='<div class="caosQuickHead"><div><span class="eyebrow">DIRETOR DA LIVE</span><h2>Ações instantâneas</h2></div><span class="miniStatus">1 TOQUE</span></div><p class="hint">Controles rápidos para reagir à transmissão sem procurar funções pelo painel.</p>';
  const grid=document.createElement('div');grid.className='caosQuickGrid';
  grid.append(
    makeButton('❤ CURA +25','salva o alvo rapidamente','heal',()=>proxyCommand('heal',{amount:25})),
    makeButton('💥 DANO -10','pressão instantânea','danger',()=>proxyCommand('damage',{amount:10})),
    makeButton('👾 +10 MOBS','caos rápido','live',()=>{const amount=$('mobAmount'),old=amount?.value;if(amount)amount.value='10';$('spawn')?.click();if(amount)amount.value=old}),
    makeButton('👾 +50 MOBS','pico de interação','live',()=>{const amount=$('mobAmount'),old=amount?.value;if(amount)amount.value='50';$('spawn')?.click();if(amount)amount.value=old}),
    makeButton('👹 BOSS','tier atual do painel','event',()=>document.querySelector('[data-cmd="boss"]')?.click()),
    makeButton('❄ CONGELAR 5s','evento relâmpago','event',()=>proxyCommand('freeze',{seconds:5})),
    makeButton('🛡 INVENCÍVEL 5s','proteção relâmpago','event',()=>proxyCommand('invincible',{seconds:5})),
    makeButton('☄ METEORO ON/OFF','usa config salva','event',()=>$('meteorEventToggle')?.click())
  );
  card.appendChild(grid);anchor.parentNode.insertBefore(card,anchor);
}

function classifyAreas(){
  const dashboard=document.querySelector('.dashboardTop');
  if(dashboard){dashboard.querySelector('.connectionCard')?.setAttribute('data-admin-area','partida');dashboard.querySelector('.cloudCard')?.setAttribute('data-admin-area','live')}
  document.querySelector('.automationsCard')?.setAttribute('data-admin-area','live');
  $('tiktokLiveMonitor')?.setAttribute('data-admin-area','live');
  $('specialEventsCard')?.setAttribute('data-admin-area','eventos');
  const controls=$('controls');
  if(controls){const cards=[...controls.children].filter(x=>x.classList?.contains('card'));cards[0]?.setAttribute('data-admin-area','partida');cards[1]?.setAttribute('data-admin-area','partida')}
  const cols=document.querySelector('.adminColumns');
  if(cols){const cards=[...cols.children].filter(x=>x.classList?.contains('card'));cards[0]?.setAttribute('data-admin-area','combate');cards[1]?.setAttribute('data-admin-area','skills')}
  document.querySelector('.historyCard')?.setAttribute('data-admin-area','sistema');
  $('caosLiveDirector')?.setAttribute('data-admin-area','live');
  const active=$('caosAdminNav')?.querySelector('button.active')?.dataset.area;
  if(active)document.querySelectorAll('[data-admin-area]').forEach(el=>el.classList.toggle('adminHidden',el.dataset.adminArea!==active));
}

function installNavigation(){
  if($('caosAdminNav'))return;classifyAreas();
  const app=document.querySelector('.app'),top=document.querySelector('.top');if(!app||!top)return;
  const nav=document.createElement('nav');nav.id='caosAdminNav';nav.className='caosAdminNav';
  const areas=[['partida','🎮 PARTIDA'],['live','📡 LIVE'],['eventos','☄ EVENTOS'],['combate','👹 MOBS / BOSS'],['skills','✨ SKILLS'],['sistema','⚙ SISTEMA']];
  const apply=area=>{document.querySelectorAll('[data-admin-area]').forEach(el=>el.classList.toggle('adminHidden',el.dataset.adminArea!==area));nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.area===area));try{localStorage.setItem('caos-admin-area',area)}catch{}window.scrollTo({top:0,behavior:'instant'})};
  for(const [area,label] of areas){const b=document.createElement('button');b.type='button';b.dataset.area=area;b.textContent=label;b.onclick=()=>apply(area);nav.appendChild(b)}
  top.insertAdjacentElement('afterend',nav);
  let initial='partida';try{const saved=localStorage.getItem('caos-admin-area');if(areas.some(x=>x[0]===saved))initial=saved}catch{}
  apply(initial);
  new MutationObserver(()=>classifyAreas()).observe(app,{childList:true,subtree:true});
}

function boot(){installStyles();installGuardianAdmin();installMobileTapSafety();installPlayerControlStrip();installLiveDirector();installNavigation()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
