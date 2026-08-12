import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(s,n,l)=>{if(!s.includes(n))throw new Error('Marcador ausente: '+l)};

// Map Lab HTML
let html=read('map-lab.html');
html=html.replaceAll('0.17.21','0.17.22').replaceAll('01721','01722');
html=html.replace('<option value="dense-forest">Floresta Densa</option>','<option value="snow-frost" selected>Gelo / Neve</option><option value="dense-forest">Floresta Densa</option>');
html=html.replace('value="CAOS-001"','value="GELO-001"');
html=html.replace('<label>Água</label>','<label>Lagos gelados</label>');
html=html.replace('<label>Clareiras</label>','<label>Gelo exposto</label>');
html=html.replace('Assets atuais · Dense Forest','Assets atuais · Snow Frost');
html=html.replace('Esses são os <b>10 tiles atuais</b>. O Lab vai mostrar quantos formatos de encaixe o mapa realmente pede.','O pack de gelo atual tem <b>1 tile base</b>. O Lab mostra exatamente quais bordas, cantos e transições precisam ser produzidos para virar um autotile de verdade.');
html=html.replace('<span><i class="dot" style="background:#315f2b"></i>floresta</span><span><i class="dot" style="background:#7b5a32"></i>terra</span><span><i class="dot" style="background:#277089"></i>água</span><span><i class="dot" style="background:#b78a48"></i>trilha</span><span><i class="dot" style="background:#8d6b43"></i>ponte</span>','<span><i class="dot" style="background:#dcecf3"></i>neve</span><span><i class="dot" style="background:#9ed7e8"></i>gelo</span><span><i class="dot" style="background:#3f8fb2"></i>lago gelado</span><span><i class="dot" style="background:#c9d7df"></i>trilha</span><span><i class="dot" style="background:#8ec8dc"></i>ponte de gelo</span>');
write('map-lab.html',html);

// Map Lab JS
let js=read('src/map-lab.js');
js=js.replace("const COLORS=['#315f2b','#7b5a32','#277089','#b78a48','#8d6b43'];","const COLORS=['#dcecf3','#9ed7e8','#3f8fb2','#c9d7df','#8ec8dc'];");
js=js.replace("const NAMES=['floresta','terra','água','trilha','ponte'];","const NAMES=['neve','gelo','lago gelado','trilha','ponte de gelo'];");
js=js.replace("seed:'CAOS-001'","seed:'GELO-001'").replace("||'CAOS-001'","||'GELO-001'");
js=js.replace("ctx.fillStyle='#071007';","ctx.fillStyle='#0c1820';");
js=js.replace("if(t!==TYPE.forest&&t!==TYPE.dirt)continue;","if(t!==TYPE.forest&&t!==TYPE.dirt)continue;");
js=js.replace("add('bad',`O pack atual tem <b>10 tiles genéricos</b>, mas o mapa gerado pediu <b>${s.roles} combinações tipo+máscara</b>.`);","add('bad',`O pack de gelo atual tem <b>${state.tiles.length} tile base</b>, mas o mapa gerado pediu <b>${s.roles} combinações tipo+máscara</b>.`);");
js=js.replace("add('good','A macrogeração já separa floresta, clareiras, água, trilhas e pontes. O próximo passo é produzir/classificar as peças correspondentes às máscaras mais usadas.');","add('good','A macrogeração já separa neve, gelo exposto, lagos congelados, trilhas e pontes de gelo. O próximo passo é produzir/classificar as peças correspondentes às máscaras mais usadas.');");
const start=js.indexOf('function loadAssets(){');
const end=js.indexOf('function buildLibrary(){');
if(start<0||end<0||end<=start)throw new Error('loadAssets nao localizado');
const loader=`function loadAssets(){
 const tileLoads=[];for(let i=1;i<=1;i++){const im=new Image();im.src=\`assets/Map/snow-frost/tiles/tile_\${String(i).padStart(3,'0')}.png?v=01722\`;tileLoads.push(new Promise(r=>{im.onload=()=>r(im);im.onerror=()=>r(null)}))}
 Promise.all(tileLoads).then(a=>{state.tiles=a.filter(Boolean);buildLibrary();$('#status').textContent=\`Snow Frost · \${state.tiles.length}/1 tile · \${state.props.length}/8 elementos\`;state.ready=true;draw()});
 const visualLoads=[];
 for(let i=1;i<=4;i++){const im=new Image();im.src=\`assets/Map/snow-frost/obstacles/obstacle_\${String(i).padStart(3,'0')}.png?v=01722\`;visualLoads.push(new Promise(r=>{im.onload=()=>r(im);im.onerror=()=>r(null)}))}
 for(let i=1;i<=4;i++){const im=new Image();im.src=\`assets/Map/snow-frost/decals/decal_\${String(i).padStart(3,'0')}.png?v=01722\`;visualLoads.push(new Promise(r=>{im.onload=()=>r(im);im.onerror=()=>r(null)}))}
 Promise.all(visualLoads).then(a=>{state.props=a.filter(Boolean);$('#status').textContent=\`Snow Frost · \${state.tiles.length}/1 tile · \${state.props.length}/8 elementos\`;draw()})}
`;
js=js.slice(0,start)+loader+js.slice(end);
write('src/map-lab.js',js);

// Version sync game + panel
let game=read('src/game.js');
must(game,"VERSION='0.17.21'",'game 0.17.21');
game=game.replace("VERSION='0.17.21'","VERSION='0.17.22'");
write('src/game.js',game);
for(const p of ['index.html','painel.html','painel-live.html']){
 if(!fs.existsSync(p))continue;
 let s=read(p).replaceAll('0.17.21','0.17.22').replaceAll('01721','01722');
 write(p,s);
}
write('version.json',JSON.stringify({version:'0.17.22',build:'map-lab-snow-frost-first'},null,2)+'\n');

// Validation update
let checks=read('scripts/check-game.mjs');
checks=checks.replace("if(!labJs.includes('assets/Map/dense-forest/tiles/')) fail('map lab nao usa assets reais'); else ok('map lab usa Dense Forest real');","if(!labJs.includes('assets/Map/snow-frost/tiles/')) fail('map lab nao usa assets Snow Frost reais'); else ok('map lab usa Snow Frost real');");
if(!checks.includes('// v0.17.22 · Ice-first Map Lab')) checks+=`\n\n// v0.17.22 · Ice-first Map Lab\nif(!labHtml.includes('Gelo / Neve')) fail('Map Lab sem bioma gelo'); else ok('Map Lab inicia em gelo');\nif(!labJs.includes("const NAMES=['neve','gelo','lago gelado','trilha','ponte de gelo']")) fail('semantica Snow Frost ausente'); else ok('semantica Snow Frost ativa');\nfor(const f of ['assets/Map/snow-frost/tiles/tile_001.png','assets/Map/snow-frost/decals/decal_004.png','assets/Map/snow-frost/obstacles/obstacle_004.png']) fs.existsSync(f)?ok('snow asset '+f):fail('snow asset ausente '+f);\n`;
write('scripts/check-game.mjs',checks);
console.log('v0.17.22 Snow Frost Map Lab preparado');
