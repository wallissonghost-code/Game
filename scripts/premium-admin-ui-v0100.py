from pathlib import Path

p=Path('painel.html')
s=p.read_text(encoding='utf-8')

css="""
/* v0.10.0 premium admin controls */
body{background:radial-gradient(circle at 50% -10%,#15102b 0,#070913 34%,#050711 100%);padding-bottom:42px}
.top{position:sticky;top:0;z-index:20;padding:12px 4px;margin:-8px 0 16px;background:linear-gradient(180deg,#070913f5 72%,#07091300);backdrop-filter:blur(12px)}
.card{background:linear-gradient(155deg,#0d1326f5,#090e1cf2);border-color:#303963;box-shadow:0 16px 45px #00000025,inset 0 1px #ffffff06}
.state div{background:linear-gradient(160deg,#0c1324,#070c18);box-shadow:inset 0 1px #ffffff05}
.modeGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0 16px}
.modeToggle{width:100%;min-height:88px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 15px;border:1px solid #30385d;border-radius:18px;background:linear-gradient(145deg,#10172a,#0a1020);color:#fff;text-align:left;transition:.2s ease;box-shadow:inset 0 1px #ffffff05}
.modeToggle:active{transform:scale(.985)}
.modeToggle .modeInfo{min-width:0;display:flex;gap:11px;align-items:center}.modeToggle .modeIcon{font-size:23px}.modeToggle b{display:block;font-size:12px;letter-spacing:.15px}.modeToggle small{display:block;margin-top:4px;color:#7782a8;font-size:9px;line-height:1.3}.modeRight{display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex:none}.modeBadge{font-size:8px;font-weight:950;letter-spacing:.7px;color:#8c96ba}.toggleTrack{width:47px;height:27px;padding:3px;border-radius:999px;background:#252c42;border:1px solid #39415f;transition:.22s ease}.toggleKnob{display:block;width:19px;height:19px;border-radius:50%;background:#8993b1;box-shadow:0 2px 7px #0008;transition:.22s ease}.modeToggle.isOn{border-color:#326b4a;background:linear-gradient(145deg,#10271d,#0a1514);box-shadow:0 0 24px #22c55e12,inset 0 1px #ffffff08}.modeToggle.isOn .modeBadge{color:#58df87}.modeToggle.isOn .toggleTrack{background:#155b35;border-color:#268c52}.modeToggle.isOn .toggleKnob{transform:translateX(20px);background:#dfffea}.modeToggle.hordeOn{border-color:#3656a1;background:linear-gradient(145deg,#111c39,#0a1225);box-shadow:0 0 24px #3b82f615}.modeToggle.hordeOn .modeBadge{color:#7db3ff}.modeToggle.hordeOn .toggleTrack{background:#2459a5;border-color:#3b82f6}.modeToggle.hordeOn .toggleKnob{transform:translateX(20px);background:#e6f1ff}
.actionGrid button{position:relative;overflow:hidden;min-height:64px;box-shadow:inset 0 1px #ffffff08,0 8px 20px #00000018;transition:.15s ease}.actionGrid button:active{transform:scale(.98);filter:brightness(1.2)}
.sectionTitle{display:flex;align-items:center;justify-content:space-between;gap:10px}.sectionTitle .miniStatus{padding:5px 8px;border:1px solid #31395b;border-radius:999px;background:#090f1d;color:#7e89af;font-size:8px;font-weight:900}
.switchRow{padding:12px 13px;border:1px solid #283052;border-radius:14px;background:#080d19}.switchRow input{appearance:none;-webkit-appearance:none;width:44px!important;height:25px!important;padding:3px;border-radius:999px;background:#252c42;border:1px solid #39415f;position:relative;transition:.2s}.switchRow input:before{content:'';position:absolute;width:17px;height:17px;left:3px;top:3px;border-radius:50%;background:#8993b1;transition:.2s}.switchRow input:checked{background:#155b35;border-color:#268c52}.switchRow input:checked:before{transform:translateX(19px);background:#e5ffed}
@media(max-width:620px){.modeGrid{grid-template-columns:1fr}.modeToggle{min-height:82px}}
"""
if '/* v0.10.0 premium admin controls */' not in s:
    s=s.replace('</style>',css+'</style>',1)

old='''<h2>CONTROLE DA PARTIDA</h2><div class="grid"><button data-cmd="pause">Ⅱ PAUSAR</button><button data-cmd="resume">▶ CONTINUAR</button><button class="good" data-cmd="auto" data-value="true">🤖 AUTO INTELIGENTE ON<small>anda e desvia dos mobs</small></button><button class="blue" data-cmd="auto" data-value="false">🕹 AUTO OFF<small>volta ao controle manual</small></button><button class="good" data-cmd="heal" data-amount="1">❤ CURAR +1</button><button class="danger" data-cmd="damage" data-amount="2">💥 DANO -2</button><button data-cmd="clear">🧹 LIMPAR ARENA</button><button class="blue" data-cmd="freeze" data-seconds="8">❄ CONGELAR 8s</button><button class="gold" data-cmd="invincible" data-seconds="10">🛡 INVENCÍVEL 10s</button><button class="danger" data-cmd="restart">↻ REINICIAR</button></div>'''
new='''<div class="sectionTitle"><h2>CONTROLE DA PARTIDA</h2><span class="miniStatus">MODOS EM TEMPO REAL</span></div><div class="modeGrid"><button id="autoModeToggle" class="modeToggle" type="button" data-on="false"><span class="modeInfo"><span class="modeIcon">🤖</span><span><b>AUTO INTELIGENTE</b><small>anda, desvia e seleciona skills</small></span></span><span class="modeRight"><span class="modeBadge">OFF</span><span class="toggleTrack"><span class="toggleKnob"></span></span></span></button><button id="hordeModeToggle" class="modeToggle" type="button" data-on="true"><span class="modeInfo"><span class="modeIcon">🌊</span><span><b>HORDAS AUTOMÁTICAS</b><small>desligue para manter somente mobs externos</small></span></span><span class="modeRight"><span class="modeBadge">ON</span><span class="toggleTrack"><span class="toggleKnob"></span></span></span></button></div><div class="grid actionGrid"><button data-cmd="pause">Ⅱ PAUSAR<small>congela a partida</small></button><button data-cmd="resume">▶ CONTINUAR<small>retoma imediatamente</small></button><button class="good" data-cmd="heal" data-amount="1">❤ CURAR +1<small>ação instantânea</small></button><button class="danger" data-cmd="damage" data-amount="2">💥 DANO -2<small>ação instantânea</small></button><button data-cmd="clear">🧹 LIMPAR ARENA<small>remove todos os mobs</small></button><button class="blue" data-cmd="freeze" data-seconds="8">❄ CONGELAR 8s<small>efeito temporário</small></button><button class="gold" data-cmd="invincible" data-seconds="10">🛡 INVENCÍVEL 10s<small>escudo temporário</small></button><button class="danger" data-cmd="restart">↻ REINICIAR<small>reinicia a partida</small></button></div>'''
if old not in s:
    raise SystemExit('control block marker missing')
s=s.replace(old,new,1)

oldstate="$('autoState').textContent=d.autoMode?'ON':'OFF';"
newstate="$('autoState').textContent=d.autoMode?'ON':'OFF';const at=$('autoModeToggle');if(at){at.dataset.on=d.autoMode?'true':'false';at.classList.toggle('isOn',!!d.autoMode);const b=at.querySelector('.modeBadge');if(b)b.textContent=d.autoMode?'ON':'OFF'}const ht=$('hordeModeToggle');if(ht&&typeof d.hordeEnabled==='boolean'){ht.dataset.on=d.hordeEnabled?'true':'false';ht.classList.toggle('hordeOn',!!d.hordeEnabled);const b=ht.querySelector('.modeBadge');if(b)b.textContent=d.hordeEnabled?'ON':'OFF'};"
if oldstate not in s:
    raise SystemExit('state marker missing')
s=s.replace(oldstate,newstate,1)

marker="document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>send({command:b.dataset.cmd,amount:+b.dataset.amount||undefined,seconds:+b.dataset.seconds||undefined,mob:b.dataset.mob||undefined,value:b.dataset.value==='true'?true:b.dataset.value==='false'?false:undefined},b.textContent.trim()));"
addon=marker+"if($('autoModeToggle'))$('autoModeToggle').onclick=()=>{const next=$('autoModeToggle').dataset.on!=='true';send({command:'auto',value:next},'🤖 Auto Inteligente '+(next?'ON':'OFF'))};if($('hordeModeToggle'))$('hordeModeToggle').onclick=()=>{const next=$('hordeModeToggle').dataset.on!=='true';send({command:'horde',value:next},'🌊 Hordas '+(next?'ON':'OFF'))};"
if marker not in s:
    raise SystemExit('handler marker missing')
s=s.replace(marker,addon,1)

p.write_text(s,encoding='utf-8')
print('premium admin UI patched')
