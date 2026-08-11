import fs from 'node:fs';

const must=(cond,msg)=>{if(!cond)throw new Error(msg)};
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);

const oldVersion='0.17.15';
const newVersion='0.17.16';
const oldTag='01715';
const newTag='01716';

const current=JSON.parse(read('version.json'));
must(current.version===oldVersion,`esperava ${oldVersion}, atual ${current.version}`);

let game=read('src/game.js');
must(game.includes("const VERSION='0.17.15'"),'VERSION antiga nao encontrada no game.js');
must(game.includes("const h=isBoss?e.r*3.55:62,ratio="),'render base de mob nao encontrado');
game=game.replace("const VERSION='0.17.15'","const VERSION='0.17.16'");
game=game.replace("const h=isBoss?e.r*3.55:62,ratio=","const h=isBoss?e.r*3.55:(e.tier===1?67:62),ratio=");
write('src/game.js',game);

for(const file of ['index.html','painel.html']){
  let s=read(file);
  s=s.replaceAll(oldVersion,newVersion).replaceAll(oldTag,newTag);
  write(file,s);
}

write('version.json',JSON.stringify({version:newVersion,build:'elite-ogre-visual-scale'},null,2)+'\n');

let check=read('scripts/check-game.mjs');
if(!check.includes('Elite visual 67px')){
  check += `\n// v0.17.16 · Elite visual scale\nif(!game.includes("const h=isBoss?e.r*3.55:(e.tier===1?67:62),ratio=")) fail('escala visual do Elite divergente'); else ok('Elite visual 67px, normal 62px');\n`;
  write('scripts/check-game.mjs',check);
}

console.log('v0.17.16 preparada: Elite 67px, normal 62px; hitbox inalterada.');
