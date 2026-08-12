import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(s,n,l)=>{if(!s.includes(n))throw new Error('Marcador ausente: '+l)};

for(const f of ['map-lab.html','src/map-lab.js']) if(!fs.existsSync(f)) throw new Error('Arquivo ausente: '+f);

let game=read('src/game.js');
must(game,"VERSION='0.17.20'",'game v0.17.20');
game=game.replace("VERSION='0.17.20'","VERSION='0.17.21'");
write('src/game.js',game);

for(const p of ['index.html','painel.html','painel-live.html']){
  if(!fs.existsSync(p))continue;
  let s=read(p).replaceAll('0.17.20','0.17.21').replaceAll('01720','01721');
  write(p,s);
}
write('version.json',JSON.stringify({version:'0.17.21',build:'map-lab-puzzle-prototype'},null,2)+'\n');

let checks=read('scripts/check-game.mjs');
if(!checks.includes('// v0.17.21 · Map Lab')) checks+=`\n\n// v0.17.21 · Map Lab\nfor(const f of ['map-lab.html','src/map-lab.js']) fs.existsSync(f)?ok('map lab '+f):fail('map lab ausente '+f);\nconst labHtml=read('map-lab.html'),labJs=read('src/map-lab.js');\nif(!labHtml.includes('src/map-lab.js?v='+cacheTag)) fail('map lab cache dessincronizado'); else ok('map lab cache '+cacheTag);\nif(!labJs.includes('function maskFor')) fail('map lab sem autotile mask'); else ok('map lab autotile mask');\nif(!labJs.includes('TYPE.bridge')) fail('map lab sem ponte contextual'); else ok('map lab ponte contextual');\nif(!labJs.includes('assets/Map/dense-forest/tiles/')) fail('map lab nao usa assets reais'); else ok('map lab usa Dense Forest real');\n`;
write('scripts/check-game.mjs',checks);

let assets=read('assets/README.md');
if(!assets.includes('Map Lab · v0.17.21')) assets+='\n\n## Map Lab · v0.17.21\n- Laboratório visual separado do jogo em `map-lab.html`.\n- Gera macro mapa de floresta, clareiras, água, trilhas e pontes por seed.\n- Calcula máscaras N/E/S/W (0–15) para diagnosticar as peças de autotile necessárias.\n- Mostra os 10 tiles e 21 obstáculos reais do Dense Forest sem alterar o mapa ativo do jogo.\n';
write('assets/README.md',assets);
console.log('v0.17.21 Map Lab preparado');
