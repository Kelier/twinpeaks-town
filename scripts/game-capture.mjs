// Headless playtest: title, each chapter, key interactions. Usage: node scripts/game-capture.mjs [level...]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
const out = 'previews/game'; await fs.mkdir(out, { recursive: true });
const only = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/usr/local/bin/chromium', headless: true, protocolTimeout: 600000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(); page.setDefaultTimeout(300000);
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.setViewport({ width: 1280, height: 720 });
await page.goto('http://localhost:5191/', { waitUntil: 'networkidle0' });
await page.waitForSelector('.menu:not([hidden])');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const hold = async (code, ms) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); };
await sleep(1500); await shot('00-title');
await page.keyboard.press('Enter'); await sleep(4500); await shot('01-hotel-card');
await sleep(9000); await shot('02-hotel-wake');
const goto = async (i) => { await page.evaluate((i) => { const { G } = window.__game; G.state = 'play'; window.__game.ctx.next.call(null); }, i); };
if (!only.length || only.includes('hotel')) {
  await hold('KeyD', 2500); await shot('03-hotel-walk');
  await page.keyboard.press('KeyF'); await sleep(800); await shot('04-hotel-torch');
  // teleport next to the suitcase, push it, climb, pull the lamp cord
  await page.evaluate(() => { const { G } = window.__game; G.player.pos.set(7.2, 0, -1.0); G.player.face = -1; });
  await sleep(600); await page.keyboard.down('KeyE'); await hold('KeyA', 3600); await page.keyboard.up('KeyE'); await shot('05-hotel-push');
  await page.evaluate(() => console.log('case', JSON.stringify(window.__game.G.world.movables[0].min)));
  await page.evaluate(() => { const { G } = window.__game; G.player.pos.set(.3, 2.46, -1.2); });
  await sleep(800); await page.keyboard.press('KeyE'); await sleep(5000); await shot('06-hotel-giant'); await sleep(9000); await shot('07-hotel-giant2');
  await sleep(9000); await shot('08-hotel-door');
}
for (const [i, name] of [[1, 'diner'], [2, 'forest'], [3, 'redroom']]) {
  if (only.length && !only.includes(name)) continue;
  await page.evaluate((i) => { const { G } = window.__game; G.idx = i - 1; }, i);
  await page.evaluate(() => window.__game.ctx.next()); await sleep(7000); await shot(`1${i}-${name}-start`);
  await hold('KeyD', 2200); await shot(`1${i}-${name}-walk`);
  if (name === 'diner') { await page.evaluate(() => { const { G } = window.__game; G.player.pos.set(3, 2.16, -3.2); }); await sleep(1000); await shot('1x-diner-counter'); }
  if (name === 'forest') { await page.evaluate(() => { const { G } = window.__game; G.player.pos.set(-12, 0, .8); }); await sleep(3000); await shot('1x-forest-bob'); await page.evaluate(() => { const { G } = window.__game; G.player.pos.set(30, 0, 0); }); await sleep(5000); await shot('1x-forest-grove'); }
  if (name === 'redroom') { await page.evaluate(() => { const { G } = window.__game; G.player.pos.set(2, 0, -1.2); }); await sleep(1500); await shot('1x-redroom-laura'); }
}
console.log(JSON.stringify({ errors: errors.slice(0, 12) }));
await browser.close();
