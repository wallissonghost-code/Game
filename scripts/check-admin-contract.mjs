import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const panelHtml=read('painel.html');
const panelJs=read('src/panel.js');
const guardianJs=exists('src/panel-guardian.js')?read('src/panel-guardian.js'):'';
const panelSources=panelHtml+'\n'+panelJs+'\n'+guardianJs;
const gameJs=read('src/game.js');
const skillsJs=read('src/core/skills.mjs');
const version=JSON.parse(read('version.json')).version;

const failures=[];
const warnings=[];
const ok=(label,detail='')=>console.log(`OK: ${label}${detail?' · '+detail:''}`);
const fail=(label,detail='')=>{failures.push(label+(detail?' · '+detail:''));console.error(`FAIL: ${label}${detail?' · '+detail:''}`)};
const warn=(label,detail='')=>{warnings.push(label+(detail?' · '+detail:''));console.warn(`WARN: ${label}${detail?' · '+detail:''}`)};
const uniq=a=>[...new Set(a)];
const matches=(s,re,group=1)=>uniq([...s.matchAll(re)].map(m=>m[group]).filter(Boolean));

console.log('=== CAOS ADMIN CONTRACT AUDIT ===');

// 1) Version contract.
const titleVersion=panelHtml.match(/<title>Caos Admin v([^<]+)<\/title>/)?.[1]||'';
const visibleVersion=panelHtml.match(/id="panelVersion"[^>]*>v([^<]+)</)?.[1]||'';
if(titleVersion===version&&visibleVersion===version) ok('painel versionado',version);
else fail('versão painel x version.json',`title=${titleVersion||'?'} visible=${visibleVersion||'?'} json=${version}`);

// 2) Every local JS/CSS referenced by painel.html must exist.
const localRefs=matches(panelHtml,/(?:src|href)="((?:src\/)[^"?#]+)(?:[?#][^"]*)?"/g);
for(const ref of localRefs){if(exists(ref))ok('asset painel existe',ref);else fail('asset painel ausente',ref)}

// 3) DOM contract: IDs referenced through $('id') / getElementById('id') must exist in HTML.
const htmlIds=new Set(matches(panelHtml,/\bid="([^"]+)"/g));
const jsIds=uniq([
  ...matches(panelJs,/\$\(['"]([^'"]+)['"]\)/g),
  ...matches(panelJs,/getElementById\(['"]([^'"]+)['"]\)/g),
  ...matches(guardianJs,/getElementById\(['"]([^'"]+)['"]\)/g)
]);
const missingIds=jsIds.filter(id=>!htmlIds.has(id));
if(!missingIds.length)ok('DOM painel íntegro',`${jsIds.length} IDs verificados`);
else fail('IDs usados pelo JS não existem no HTML',missingIds.join(', '));

// 4) Skill contract: source of truth is SKILL_CAPS in core/skills.mjs.
const capsBody=skillsJs.match(/export const SKILL_CAPS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/)?.[1]||'';
const skillPairs=[...capsBody.matchAll(/\b([a-z][a-z0-9_]*)\s*:\s*(\d+)/gi)].map(m=>[m[1],Number(m[2])]);
const coreSkills=skillPairs.map(x=>x[0]);
if(coreSkills.length>=10)ok('catálogo central de skills',`${coreSkills.length} skills`);else fail('não foi possível ler SKILL_CAPS');

const selectBlock=panelHtml.match(/<select id="skillTestSelect">([\s\S]*?)<\/select>/)?.[1]||'';
const htmlSkillIds=matches(selectBlock,/<option\s+value="([^"]+)"/g);
const injectedSkillIds=uniq([
  ...matches(guardianJs,/\.value\s*=\s*['"]([a-z][a-z0-9_]*)['"]/gi),
  ...matches(panelJs,/option\.value\s*=\s*['"]([a-z][a-z0-9_]*)['"]/gi)
]);
const adminSkills=uniq([...htmlSkillIds,...injectedSkillIds]);
const missingSkills=coreSkills.filter(id=>!adminSkills.includes(id));
const staleSkills=adminSkills.filter(id=>!coreSkills.includes(id));
if(!missingSkills.length)ok('todas as skills do jogo estão no ADM',`${adminSkills.length}/${coreSkills.length}`);else fail('skills do jogo ausentes no ADM',missingSkills.join(', '));
if(!staleSkills.length)ok('ADM sem skills obsoletas');else fail('skills obsoletas no ADM',staleSkills.join(', '));
const maxPanelLevel=Math.max(...matches(panelHtml,/<select id="skillTestLevel">([\s\S]*?)<\/select>/g,1).flatMap(block=>matches(block,/<option value="(\d+)"/g).map(Number)),0);
const tooHigh=skillPairs.filter(([,cap])=>cap>maxPanelLevel);
if(!tooHigh.length)ok('níveis de skill compatíveis',`painel até LV${maxPanelLevel}`);else fail('skill excede seletor de nível',tooHigh.map(([id,cap])=>`${id}:${cap}`).join(', '));

// 5) Panel -> game command contract.
const panelLiteralCommands=matches(panelJs,/command\s*:\s*['"]([a-z][a-z0-9_-]*)['"]/gi);
const htmlDataCommands=matches(panelHtml,/data-cmd="([a-z][a-z0-9_-]*)"/gi);
const giftActionBlock=panelHtml.match(/<select id="giftAction">([\s\S]*?)<\/select>/)?.[1]||'';
const liveRuleCommands=matches(giftActionBlock,/<option value="([a-z][a-z0-9_-]*)"/gi);
const panelCommands=uniq([...panelLiteralCommands,...htmlDataCommands,...liveRuleCommands]);
const gameCommands=matches(gameJs,/if\(c===['"]([a-z][a-z0-9_-]*)['"]\)/gi);
const unsupported=panelCommands.filter(c=>!gameCommands.includes(c));
if(!unsupported.length)ok('comandos ADM possuem handler no jogo',`${panelCommands.length} comandos`);else fail('painel envia comandos sem handler',unsupported.join(', '));

// Critical controls we expect to remain exposed in the admin UI.
const criticalCommands=['pause','resume','heal','damage','clear','freeze','invincible','restart','spawn','boss','speed','xp','level','auto','autofire','gameplaymode','horde','skilltest','skilltestall','skillreset','eventdoublexp','eventmeteor','eventmeteorconfig','fps','saveplayer'];
const hiddenCritical=criticalCommands.filter(c=>!panelCommands.includes(c));
if(!hiddenCritical.length)ok('controles críticos presentes no ADM');else fail('controles críticos sumiram do ADM',hiddenCritical.join(', '));

// 6) Boss/mob tier control contract.
const bossTierBlock=panelHtml.match(/<select id="bossTier">([\s\S]*?)<\/select>/)?.[1]||'';
const bossTiers=matches(bossTierBlock,/<option value="([^"]*)"/g);
for(const tier of ['normal','1','2']){if(bossTiers.includes(tier))ok('tier de Boss no ADM',tier);else fail('tier de Boss ausente no ADM',tier)}
const mobTierBlock=panelHtml.match(/<select id="mobTier">([\s\S]*?)<\/select>/)?.[1]||'';
const mobTiers=matches(mobTierBlock,/<option value="([^"]*)"/g);
for(const tier of ['1','2']){if(mobTiers.includes(tier))ok('tier de mob no ADM',tier);else fail('tier de mob ausente no ADM',tier)}

// 7) State/telemetry contract: fields consumed by panel must be produced by game state().
const stateBody=gameJs.match(/function state\(\)\{([\s\S]*?)\}function broadcast\(/)?.[1]||'';
const telemetryKeys=['version','health','maxHealth','level','xp','xpNeed','score','mobs','kills','wave','elite','corrupted','bosses','elapsedMs','perfMode','ranked','fps','skillLv','events','players','gameplayMode','hordeEnabled','autofire','autoMode'];
const missingState=telemetryKeys.filter(k=>!new RegExp(`\\b${k}\\b`).test(stateBody));
if(!missingState.length)ok('telemetria jogo → painel compatível',`${telemetryKeys.length} campos críticos`);else fail('telemetria esperada pelo ADM ausente no state()',missingState.join(', '));

// 8) Guardian regression sentinel: this is the exact class of omission that motivated this CI.
if(coreSkills.includes('guardian')&&adminSkills.includes('guardian'))ok('regressão Guardião Celestial coberta');
else fail('regressão Guardião Celestial voltou');

if(warnings.length)console.log(`WARNINGS: ${warnings.length}`);
if(failures.length){
  console.error(`\nADMIN CONTRACT FAILED (${failures.length})`);
  for(const x of failures)console.error(' - '+x);
  process.exit(1);
}
console.log(`\nADMIN CONTRACT OK · ${coreSkills.length} skills · ${panelCommands.length} comandos · ${jsIds.length} IDs`);
