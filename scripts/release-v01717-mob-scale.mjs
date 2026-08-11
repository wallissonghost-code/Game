import fs from 'node:fs';

const must=(cond,msg)=>{if(!cond)throw new Error(msg)};
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);

const oldVersion='0.17.16';
const newVersion='0.17.17';
const oldTag='01716';
const newTag='01717';

const current=JSON.parse(read('version.json'));
must(current.version===oldVersion,`esperava ${oldVersion}, atual ${current.version}`);

let game=read('src/game.js');
must(game.includes("const VERSION='0.17.16'"),'VERSION antiga nao encontrada no game.js');
must(game.includes("const MAX_ENEMIES=320,GRID=64,CHUNK=640;"),'constantes base nao encontradas');
must(game.includes("const h=isBoss?e.r*3.55:(e.tier===1?67:62),ratio="),'render visual atual nao encontrado');

game=game.replace("const VERSION='0.17.16'","const VERSION='0.17.17'");
game=game.replace(
  "const MAX_ENEMIES=320,GRID=64,CHUNK=640;",
  "const MAX_ENEMIES=320,GRID=64,CHUNK=640;const MOB_VISUAL_HEIGHT={normal:62,elite:86,bossScale:3.55};"
);
game=game.replace(
  "const h=isBoss?e.r*3.55:(e.tier===1?67:62),ratio=",
  "const h=isBoss?e.r*MOB_VISUAL_HEIGHT.bossScale:(e.tier===1?MOB_VISUAL_HEIGHT.elite:MOB_VISUAL_HEIGHT.normal),ratio="
);
write('src/game.js',game);

for(const file of ['index.html','painel.html']){
  let s=read(file);
  s=s.replaceAll(oldVersion,newVersion).replaceAll(oldTag,newTag);
  write(file,s);
}

write('version.json',JSON.stringify({version:newVersion,build:'mob-visual-scale-system'},null,2)+'\n');

let check=read('scripts/check-game.mjs');
check += `\n// v0.17.17 · escala visual dos mobs\nif(!game.includes("MOB_VISUAL_HEIGHT={normal:62,elite:86,bossScale:3.55}")) fail('regua visual dos mobs ausente'); else ok('regua visual normal 62 / elite 86 / boss x3.55');\nif(!game.includes("e.tier===1?MOB_VISUAL_HEIGHT.elite:MOB_VISUAL_HEIGHT.normal")) fail('Elite nao usa regua visual'); else ok('Elite usa escala visual dedicada');\n`;
write('scripts/check-game.mjs',check);

let readme=read('assets/README.md');
if(!readme.includes('## Escala visual')){
  readme += `\n## Escala visual\nTomando o Colosso como referencia de 100% (~149 px):\n- Ogro normal: 62 px (~42%)\n- Ogro Elite: 86 px (~58%)\n- Colosso: ~149 px (100%)\n\nA escala acima altera apenas o tamanho visual. Hitbox, vida, dano e velocidade continuam independentes.\n`;
  write('assets/README.md',readme);
}

console.log('v0.17.17 preparada: normal 62px, Elite 86px, Colosso ~149px.');
