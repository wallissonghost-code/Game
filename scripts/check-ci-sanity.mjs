import fs from 'node:fs';

const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const ok = (m) => console.log('OK:', m);
const read = (p) => fs.readFileSync(p, 'utf8');

const version = JSON.parse(read('version.json')).version;
const cacheTag = String(version).replace(/\./g, '');
const gameHtml = read('index.html');
const panelHtml = read('painel.html');
const panel = read('src/panel.js');
const bootstrap = read('src/core/skills-bootstrap.mjs');

if (!gameHtml.includes(`v${version}`)) fail(`index.html não exibe v${version}`); else ok(`jogo exibe v${version}`);
if (!gameHtml.includes('src/core/skills-bootstrap.mjs?v=')) fail('bootstrap modular não carregado no jogo'); else ok('bootstrap modular carregado');
if (!bootstrap.includes("loadPatchedClassic")) fail('bootstrap não carrega runtime clássico patchado'); else ok('runtime clássico passa pelo bootstrap atual');
if (!bootstrap.includes("startDiagnosticsFeed")) fail('diagnóstico local não inicializado pelo bootstrap'); else ok('diagnóstico local ativo');
if (!panelHtml.includes('id="panelVersion"')) fail('painel sem indicador de versão'); else ok('painel possui indicador de versão');
if (!panel.includes("fetch('./version.json?ts='")) fail('painel não consulta version.json'); else ok('painel usa version.json como fonte de versão');
if (!panel.includes('syncVersion(d.version)')) fail('painel não compara versão do jogo'); else ok('painel compara versão recebida do jogo');
if (!gameHtml.includes('src/map-runtime.js?v=')) fail('map runtime não carregado'); else ok('map runtime carregado');
if (!fs.existsSync('src/core/session-recorder.js')) fail('session recorder ausente'); else ok('session recorder presente');

// Este check é propositalmente estrutural. Regras históricas específicas de versões antigas
// ficam nos testes dedicados; não devem derrubar o CI principal por cache tags legadas.
if (process.exitCode) process.exit(process.exitCode);
console.log(`CI SANITY OK · v${version} · cache ${cacheTag}`);
