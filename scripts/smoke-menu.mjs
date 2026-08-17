import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XcyU4QAAAABJRU5ErkJggg==',
  'base64'
);
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(BASE, { cache: 'no-store' });
      if (r.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Static test server did not start');
}

async function testViewport(browser, name, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') browserErrors.push(`console: ${msg.text()}`);
  });

  await page.route(/\.png(?:\?|$)/, route => {
    route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PIXEL_PNG });
  });
  await page.route('https://caos-live-game-server-va.onrender.com/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  async function fresh() {
    browserErrors.length = 0;
    await page.goto(`${BASE}/?smoke=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('#startBtn').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => {
      const b = document.getElementById('startBtn');
      return b && !b.disabled;
    }, null, { timeout: 10000 });
  }

  async function waitState(fn, label) {
    try {
      await page.waitForFunction(fn, null, { timeout: 5000 });
    } catch (error) {
      const ready = await page.evaluate(() => ({
        runtimeReady: window.CaosRuntimeReady,
        startClass: document.getElementById('start')?.className,
        rankClass: document.getElementById('rankOverlay')?.className,
        mpClass: document.getElementById('multiplayerWake')?.className
      }));
      throw new Error(`[${name}] ${label} timeout; state=${JSON.stringify(ready)}; browser=${browserErrors.join(' | ') || 'no browser error captured'}`);
    }
  }

  await fresh();
  await page.locator('#startBtn').click();
  await waitState(() => !document.getElementById('start')?.classList.contains('show'), 'Arena');

  // Soak the actual game loop long enough to exercise delayed waves, AI, shooting,
  // HUD updates and periodic runtime paths that a menu-only smoke cannot catch.
  await sleep(10000);
  const gameplayState = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    const stage = document.getElementById('stage');
    return {
      runtimeReady: window.CaosRuntimeReady,
      canvasW: c?.width || 0,
      canvasH: c?.height || 0,
      stageW: Math.round(stage?.getBoundingClientRect().width || 0),
      stageH: Math.round(stage?.getBoundingClientRect().height || 0),
      fpsRuntime: window.__caosFps || window.caosCurrentFps || 0,
      fpsHud: document.getElementById('fpsHud')?.textContent || '',
      mobs: document.getElementById('mobCount')?.textContent || ''
    };
  });
  if (browserErrors.length) throw new Error(`[${name}] delayed gameplay runtime error; state=${JSON.stringify(gameplayState)}; browser=${browserErrors.join(' | ')}`);
  if (!gameplayState.canvasW || !gameplayState.canvasH) throw new Error(`[${name}] gameplay canvas not initialized; state=${JSON.stringify(gameplayState)}`);
  if (!(Number(gameplayState.fpsRuntime) > 0)) throw new Error(`[${name}] gameplay loop stopped/no FPS after soak; state=${JSON.stringify(gameplayState)}`);

  await fresh();
  await page.locator('#rankBtn').click();
  await waitState(() => document.getElementById('rankOverlay')?.classList.contains('show'), 'Rank');

  await fresh();
  await page.locator('#multiplayerBtn').click();
  await waitState(() => document.getElementById('multiplayerWake')?.classList.contains('show'), 'Multiplayer');

  console.log(`SMOKE OK [${name}]: 10s gameplay soak + Rank + Multiplayer`);
  await context.close();
}

let browser;
try {
  await waitServer();
  browser = await chromium.launch({ headless: true });
  await testViewport(browser, 'mobile', { width: 390, height: 844 });
  await testViewport(browser, 'desktop', { width: 1440, height: 900 });
  console.log('MENU/GAMEPLAY SOAK OK: delayed runtime validated on mobile and desktop');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
