import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(s,needle,label)=>{if(!s.includes(needle))throw new Error('Marcador ausente: '+label)};

let game=read('src/game.js');
must(game,"VERSION='0.17.18'",'versao 0.17.18 no game');
game=game.replace("VERSION='0.17.18'","VERSION='0.17.19'");

const initMarker='function toast(t){';
must(game,initMarker,'toast');
game=game.replace(initMarker,"if(window.CaosMap)window.CaosMap.init({version:VERSION,ctx,viewport:()=>({W,H}),player:()=>player,enemies:()=>enemies,hash,world:(x,y)=>world(x,y)});\n"+initMarker);

const terrainMarker='function terrain(){';
must(game,terrainMarker,'terrain');
game=game.replace(terrainMarker,"function terrain(){if(window.CaosMap&&window.CaosMap.drawGround&&window.CaosMap.drawGround())return;");

const drawMarker="ctx.setTransform(dpr,0,0,dpr,0,0);terrain();for(const b of bullets)";
must(game,drawMarker,'draw terrain');
game=game.replace(drawMarker,"ctx.setTransform(dpr,0,0,dpr,0,0);terrain();if(window.CaosMap)window.CaosMap.drawObjects();for(const b of bullets)");

const collisionMarker='}separateEnemies();resolvePlayerMobCollisions();const enemyGrid=buildEnemyGrid();';
must(game,collisionMarker,'collision pipeline');
game=game.replace(collisionMarker,'}separateEnemies();resolvePlayerMobCollisions();if(window.CaosMap)window.CaosMap.resolveCollisions();const enemyGrid=buildEnemyGrid();');

const stateMarker="return{type:'state',version:VERSION,running";
must(game,stateMarker,'state');
game=game.replace(stateMarker,"return{type:'state',version:VERSION,map:'field',mapReady:!!window.CaosMap?.ready,running");
write('src/game.js',game);

for(const p of ['index.html','painel.html','painel-live.html']){
  if(!fs.existsSync(p))continue;
  let s=read(p).replaceAll('0.17.18','0.17.19').replaceAll('01718','01719');
  if(p==='index.html'&&!s.includes('src/map-runtime.js')){
    s=s.replace('<script src="src/game.js?v=01719"></script>','<script src="src/map-runtime.js?v=01719"></script>\n<script src="src/game.js?v=01719"></script>');
  }
  write(p,s);
}

write('version.json',JSON.stringify({version:'0.17.19',build:'field-swamp-map-runtime'},null,2)+'\n');

let checks=read('scripts/check-game.mjs');
if(!checks.includes('// v0.17.19 · Field map runtime')){
checks+=`\n\n// v0.17.19 · Field map runtime\nconst mapRuntime=read('src/map-runtime.js');\nif(!gameHtml.includes('src/map-runtime.js?v='+cacheTag)) fail('map-runtime sem cache sincronizado'); else ok('map-runtime cache '+cacheTag);\nif(!game.includes('window.CaosMap.init')) fail('game nao inicializa mapa'); else ok('mapa inicializado');\nif(!game.includes('window.CaosMap.resolveCollisions')) fail('colisao do mapa nao ligada'); else ok('colisao do mapa ligada');\nif(!mapRuntime.includes("name:'Campo / Pântano'")) fail('runtime Campo/Pantano ausente'); else ok('runtime Campo/Pantano');\nfor(const f of ['assets/Map/field/tiles/dirt/dirt_01.png','assets/Map/field/tiles/moss/moss_01.png','assets/Map/field/tiles/swamp/swamp_01.png','assets/Map/field/tiles/water/water_01.png','assets/Map/field/obstacles/spike_fence_01.png','assets/Map/field/obstacles/stone_ruin_01.png','assets/Map/wasteland/obstacles/wrecked_car_01.png','assets/Map/wasteland/obstacles/barricade_01.png']) fs.existsSync(f)?ok('map asset '+f):fail('map asset ausente '+f);\n`;
}
write('scripts/check-game.mjs',checks);

let assets=read('assets/README.md');
if(!assets.includes('[Map](./Map/)')) assets=assets.replace('- [Weapons](./weapons/) — armas, cano, munição e efeitos relacionados.','- [Weapons](./weapons/) — armas, cano, munição e efeitos relacionados.\n- [Map](./Map/) — tiles, obstáculos e cenários dos biomas.');
if(!assets.includes('## Mapa Campo / Pântano · v0.17.19')) assets+='\n\n## Mapa Campo / Pântano · v0.17.19\n- Chão procedural determinístico usando tiles de terra, musgo, pântano e água.\n- Objetos do Field Pack distribuídos por setores; cerca, ruína, totem e gaiola possuem colisão.\n- Ponte e fosso ritual são atravessáveis nesta primeira versão.\n- Carro destruído, barricada, árvore seca e pedras do pack extra entram como obstáculos raros, em versões otimizadas para mobile.\n- Decals extras são apenas visuais e não possuem colisão.\n- Projéteis continuam atravessando obstáculos nesta etapa.\n';
write('assets/README.md',assets);

for(const p of ['assets/Map/field/README.md','assets/Map/field/manifest.json']) if(fs.existsSync(p)) write(p,read(p).replaceAll('assets/map/','assets/Map/'));
console.log('v0.17.19 map release preparado');
