import fs from 'node:fs';
const p='scripts/check-architecture.mjs';
let s=fs.readFileSync(p,'utf8');
s=s.replaceAll("[['solo', solo], ['multiplayer server', mpServer]]","[['solo', soloContractView], ['multiplayer server', mpServer]]");
fs.writeFileSync(p,s);
