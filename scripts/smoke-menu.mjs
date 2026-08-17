import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
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

  // Multiplayer only needs to prove its click handler opens the wake overlay.
  // Avoid depending on Render availability during CI.
  await page.route('https://caos-live-game-server-va.onrender.com/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  async function fresh() {
    await page.goto(`${BASE}/?smoke=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('#startBtn').waitFor({ state: 'visible', timeout: 15000 });
  }

  // Arena: real click must dismiss the start overlay and initialize gameplay.
  await fresh();
  await page.locator('#startBtn').click();
  await page.waitForFunction(() => !document.getElementById('start')?.classList.contains('show'), null, { timeout: 5000 });
  const arena = await page.evaluate(() => ({
    hidden: !document.getElementById('start')?.classList.contains('show'),
    canvas: !!document.getElementById('canvas'),
    fps: document.getElementById('fpsHud')?.textContent || ''
  }));
  if (!arena.hidden || !arena.canvas) throw new Error(`[${name}] Arena button did not start the game`);

  // Rank: real click must open ranking overlay.
  await fresh();
  await page.locator('#rankBtn').click();
  await page.waitForFunction(() => document.getElementById('rankOverlay')?.classList.contains('show'), null, { timeout: 5000 });
  if (!(await page.locator('#rankOverlay').evaluate(el => el.classList.contains('show')))) {
    throw new Error(`[${name}] Rank button did not open overlay`);
  }

  // Multiplayer: real click must open wake overlay immediately.
  await fresh();
  await page.locator('#multiplayerBtn').click();
  await page.waitForFunction(() => document.getElementById('multiplayerWake')?.classList.contains('show'), null, { timeout: 5000 });
  if (!(await page.locator('#multiplayerWake').evaluate(el => el.classList.contains('show')))) {
    throw new Error(`[${name}] Multiplayer button did not open wake overlay`);
  }

  console.log(`SMOKE OK [${name}]: Arena + Rank + Multiplayer`);
  await context.close();
}

let browser;
try {
  await waitServer();
  browser = await chromium.launch({ headless: true });
  await testViewport(browser, 'mobile', { width: 390, height: 844 });
  await testViewport(browser, 'desktop', { width: 1440, height: 900 });
  console.log('MENU SMOKE OK: interactive boot validated on mobile and desktop');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
