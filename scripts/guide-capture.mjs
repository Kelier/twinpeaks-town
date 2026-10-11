// Screenshot the crayon guides. Usage: node scripts/guide-capture.mjs [lynch|fwwm] [all]
// Default: a selection of pages; pass "all" to capture every page.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
const out = 'previews/guide'; await fs.mkdir(out, { recursive: true });
const args = process.argv.slice(2);
const all = args.includes('all');
const ids = args.filter((a) => a === 'lynch' || a === 'fwwm');
const GUIDES = ids.length ? ids : ['lynch', 'fwwm'];
const PICK = { lynch: [1, 2, 5, 8, 12, 16], fwwm: [1, 3, 6, 9, 11] };
const VIEWS = [{ name: 'desk', width: 1280, height: 800 }, { name: 'mob', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }];
const base = process.env.BASE || 'http://localhost:5191/';
const browser = await puppeteer.launch({ executablePath: '/usr/local/bin/chromium', headless: true, protocolTimeout: 600000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = []; const report = [];
for (const id of GUIDES) for (const lang of ['zh', 'en']) for (const v of VIEWS) {
  const page = await browser.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(`${id}/${lang}/${v.name}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${id}/${lang}/${v.name}: ${m.text()}`); });
  await page.setViewport(v);
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${id}/${lang}/${v.name}: HTTP ${r.status()} ${r.url()}`); });
  await page.goto(`${base}guide-preview.html?id=${id}&lang=${lang}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.gd-spread canvas');
  await page.evaluate(() => document.fonts.ready); await sleep(700);
  const total = await page.$$eval('.gd-chip', (b) => b.length);
  const pages = all ? Array.from({ length: total }, (_, i) => i + 1) : PICK[id].filter((n) => n <= total);
  for (const n of pages) {
    await page.evaluate((i) => document.querySelector(`.gd-chip[data-i="${i}"]`)?.click(), n - 1);
    await sleep(900);
    // overflow / font checks
    const info = await page.evaluate(() => {
      const sp = [...document.querySelectorAll('.gd-spread')].pop();
      const bad = [...sp.querySelectorAll('.gd-sticker')].filter((s) => s.scrollWidth > s.clientWidth + 1).length;
      const st = sp.querySelector('.gd-stickers'); const scrolls = st.scrollHeight > st.clientHeight + 2 || sp.scrollHeight > sp.clientHeight + 2;
      const fonts = { en: document.fonts.check("20px 'Kid EN'"), zh: document.fonts.check("20px 'Kid ZH'", '双峰') };
      return { bad, scrolls, fonts };
    });
    report.push({ id, lang, view: v.name, page: n, ...info });
    const file = `${out}/${id}-${lang}-${v.name}-p${String(n).padStart(2, '0')}.png`;
    await page.screenshot({ path: file }); console.log('shot', file, JSON.stringify(info));
  }
  // keyboard checks once per run
  if (v.name === 'desk' && lang === 'en') {
    await page.keyboard.press('ArrowRight'); await sleep(700);
    await page.keyboard.press('Escape'); await sleep(400);
    const closed = await page.evaluate(() => ({ closed: window.__guideClosed, left: !!document.querySelector('.gd-root') }));
    console.log('esc-close', id, JSON.stringify(closed));
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ errors: errors.slice(0, 20), overflow: report.filter((r) => r.bad) }, null, 1));
