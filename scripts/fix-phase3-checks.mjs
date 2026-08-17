import fs from 'node:fs';
const p='scripts/check-architecture.mjs';
let s=fs.readFileSync(p,'utf8');
s=s.replaceAll("[['solo', solo], ['multiplayer server', mpServer]]","[['solo', soloContractView], ['multiplayer server', mpServer]]");
s=s.replace("const soloContractView = solo+'\\n'+mobsSource+'\\n'+combatSource;","const soloContractView = solo+'\\n'+mobsSource+'\\n'+combatSource+'\\n'+read('src/core/contracts.mjs');");
fs.writeFileSync(p,s);
