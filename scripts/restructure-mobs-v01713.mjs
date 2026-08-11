import fs from 'node:fs';
import path from 'node:path';

const V='0.17.13';
const TAG='01713';
const root='assets/mobs';
const ogro=path.join(root,'Ogro');
const elite=path.join(root,'Ogro Elite');
fs.mkdirSync(ogro,{recursive:true});
fs.mkdirSync(elite,{recursive:true});

for(let i=1;i<=32;i++){
  const n=String(i).padStart(3,'0');
  const src=path.join(root,`frame_${n}.png`);
  const dst=path.join(ogro,`frame_${n}.png`);
  if(fs.existsSync(src)) fs.renameSync(src,dst);
  if(!fs.existsSync(dst)) throw new Error(`Frame ausente apos migracao: ${dst}`);
}
fs.writeFileSync(path.join(elite,'.gitkeep'),'','utf8');

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s,'utf8');
let s;

write('version.json',JSON.stringify({version:V,build:'mob-folder-structure-ogro-elite'},null,2)+'\n');

s=read('src/game.js');
s=s.replace(/const VERSION='\d+\.\d+\.\d+'/,`const VERSION='${V}'`);
s=s.replaceAll("'01712'",`'${TAG}'`).replaceAll('v=01712',`v=${TAG}`);
s=s.replace("loadDirectPngSequence('./assets/mobs',32", "loadDirectPngSequence('./assets/mobs/Ogro',32");
write('src/game.js',s);

s=read('index.html');
s=s.replace(/Caos Live v\d+\.\d+\.\d+/g,`Caos Live v${V}`)
   .replace(/v\d+\.\d+\.\d+ · SINCRONIZADO/g,`v${V} · SINCRONIZADO`)
   .replace(/v\d+\.\d+\.\d+<\/span>/g,`v${V}</span>`)
   .replace(/src\/game\.js\?v=\d+/g,`src/game.js?v=${TAG}`);
write('index.html',s);

s=read('painel.html');
s=s.replace(/Caos Admin v\d+\.\d+\.\d+/g,`Caos Admin v${V}`)
   .replace(/>v\d+\.\d+\.\d+<\/span>/g,`>v${V}</span>`)
   .replace(/panel\.css\?v=\d+/g,`panel.css?v=${TAG}`)
   .replace(/panel\.js\?v=\d+/g,`panel.js?v=${TAG}`)
   .replace(/index\.html\?v=\d+/g,`index.html?v=${TAG}`);
write('painel.html',s);

s=read('scripts/check-game.mjs');
s=s.replace("for(const dir of ['assets/player','assets/mobs','assets/weapons'])", "for(const dir of ['assets/player','assets/mobs/Ogro','assets/weapons'])");
if(!s.includes("assets/mobs/Ogro Elite/.gitkeep")){
  s += "\nif(!fs.existsSync('assets/mobs/Ogro Elite/.gitkeep')) fail('pasta Ogro Elite ausente'); else ok('pasta Ogro Elite pronta');\n";
  s += "for(let i=1;i<=32;i++){const n=String(i).padStart(3,'0');if(fs.existsSync(`assets/mobs/frame_${n}.png`)) fail('frame legado ainda na raiz mobs: '+n)}\n";
}
write('scripts/check-game.mjs',s);

s=read('assets/README.md');
const block='\n## Mobs\n- `mobs/Ogro/` — skin principal atual, 32 frames.\n- `mobs/Ogro Elite/` — pasta reservada para a nova skin Elite.\n';
if(!s.includes('mobs/Ogro/')) s+=block;
write('assets/README.md',s);

console.log('Migracao concluida:',V);
