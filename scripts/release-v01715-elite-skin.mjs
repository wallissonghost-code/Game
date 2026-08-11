import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function rep(s,a,b,label){
  if(!s.includes(a)) throw new Error('Trecho nao encontrado: '+label);
  return s.replace(a,b);
}

let game=read('src/game.js');
game=rep(game,"const VERSION='0.17.14',ASSET_TAG","const VERSION='0.17.15',ASSET_TAG",'VERSION game');

game=rep(
  game,
  "const ogreFrames={up:[],down:[],right:[],left:[]},bossOgreFrames={up:[],down:[],right:[],left:[]},bossColossusFrames={up:[],down:[],right:[],left:[]},bossVoidFrames={up:[],down:[],right:[],left:[]};let ogreReady=false,bossOgreReady=false,bossColossusReady=false,bossVoidReady=false;",
  "const ogreFrames={up:[],down:[],right:[],left:[]},eliteOgreFrames={up:[],down:[],right:[],left:[]},bossOgreFrames={up:[],down:[],right:[],left:[]},bossColossusFrames={up:[],down:[],right:[],left:[]},bossVoidFrames={up:[],down:[],right:[],left:[]};let ogreReady=false,eliteOgreReady=false,bossOgreReady=false,bossColossusReady=false,bossVoidReady=false;",
  'elite frame pack'
);

game=rep(
  game,
  "  loadDirectPngSequence('./assets/mobs/Ogro',32,ASSET_TAG).then(mobFrames=>{if(mapDirect32(mobFrames,ogreFrames)){ogreReady=true;console.log('MOBS BACKGROUND READY',mobFrames.length)}})\n]);",
  "  loadDirectPngSequence('./assets/mobs/Ogro',32,ASSET_TAG).then(mobFrames=>{if(mapDirect32(mobFrames,ogreFrames)){ogreReady=true;console.log('MOBS BACKGROUND READY',mobFrames.length)}}),\n  loadDirectPngSequence('./assets/mobs/Ogro Elite',32,ASSET_TAG).then(eliteFrames=>{if(mapDirect32(eliteFrames,eliteOgreFrames)){eliteOgreReady=true;console.log('ELITE MOBS BACKGROUND READY',eliteFrames.length)}})\n]);",
  'elite loader'
);

game=rep(
  game,
  ":ogreFrames,ready=isBoss?(e.type==='colossus'?bossColossusReady:e.type==='voidlord'?bossVoidReady:bossOgreReady):ogreReady;let dir=e.facing||'down';",
  ":(e.tier===1&&eliteOgreReady?eliteOgreFrames:ogreFrames),ready=isBoss?(e.type==='colossus'?bossColossusReady:e.type==='voidlord'?bossVoidReady:bossOgreReady):(e.tier===1&&eliteOgreReady?eliteOgreReady:ogreReady);let dir=e.facing||'down';",
  'elite render routing'
);
write('src/game.js',game);

write('version.json',JSON.stringify({version:'0.17.15',build:'elite-ogre-exclusive-skin'},null,2)+'\n');

for(const p of ['index.html','painel.html']){
  let s=read(p);
  s=s.replaceAll('0.17.14','0.17.15').replaceAll('01714','01715');
  write(p,s);
}

let check=read('scripts/check-game.mjs');
if(!check.includes('// v0.17.15 · elite skin')){
  check += `\n// v0.17.15 · elite skin\nfor(let i=1;i<=32;i++){const n=String(i).padStart(3,'0');const f=\`assets/mobs/Ogro Elite/frame_\${n}.png\`;if(!fs.existsSync(f)) fail('asset Elite ausente '+f)}\nif(!game.includes('eliteOgreFrames={up:[],down:[],right:[],left:[]}')) fail('pack Ogro Elite ausente'); else ok('pack Ogro Elite configurado');\nif(!game.includes(\"loadDirectPngSequence('./assets/mobs/Ogro Elite',32,ASSET_TAG)\")) fail('loader Ogro Elite ausente'); else ok('32 frames Elite carregados');\nif(!game.includes(\"e.tier===1&&eliteOgreReady?eliteOgreFrames:ogreFrames\")) fail('Elite nao usa skin exclusiva'); else ok('tier Elite usa skin Ogro Elite');\n`;
  write('scripts/check-game.mjs',check);
}

console.log('Release v0.17.15 preparada: Elite => assets/mobs/Ogro Elite');
