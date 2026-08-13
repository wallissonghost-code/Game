import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'caos-v204-'));
try{
  for(const d of ['src','cloud','scripts'])fs.mkdirSync(path.join(tmp,d),{recursive:true});
  for(const f of ['src/multiplayer-v2.js','cloud/game-server-v3.mjs','multiplayer-v2.html','scripts/patch-v204-skills.py']){
    const dest=path.join(tmp,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,f),dest);
  }
  execFileSync('python3',['scripts/patch-v204-skills.py'],{cwd:tmp,stdio:'inherit'});
  execFileSync(process.execPath,['--check','src/multiplayer-v2.js'],{cwd:tmp,stdio:'inherit'});
  execFileSync(process.execPath,['--check','cloud/game-server-v3.mjs'],{cwd:tmp,stdio:'inherit'});
  const client=fs.readFileSync(path.join(tmp,'src/multiplayer-v2.js'),'utf8');
  const server=fs.readFileSync(path.join(tmp,'cloud/game-server-v3.mjs'),'utf8');
  const html=fs.readFileSync(path.join(tmp,'multiplayer-v2.html'),'utf8');
  const checks=[
    [client.includes('online-v2.0.4'),'client version'],
    [server.includes('online-v2.0.4'),'server version'],
    [server.includes('mobInvUntil'),'280ms creature hit guard'],
    [server.includes("kind:'flash'"),'flash beam event'],
    [server.includes("kind:'arc'"),'arc event'],
    [server.includes("kind:'phoenix'"),'phoenix event'],
    [server.includes('regenStage'),'progressive regen'],
    [client.includes('drawSkillEffects'),'skill visual renderer'],
    [client.includes('piercing'),'piercing projectile visual'],
    [html.includes('01737v204'),'cache bust']
  ];
  for(const [ok,label] of checks)if(!ok)throw new Error('V2.0.4 verification failed: '+label);
  console.log('V2.0.4 skill parity verification OK');
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}
