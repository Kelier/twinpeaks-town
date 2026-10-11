// Regression: real lamp interaction, restored saves, and walking through the exit.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/local/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(120000);page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.setViewport({ width: 800, height: 600 });
try {
  await page.evaluateOnNewDocument(() => {
    if (!localStorage.getItem('hotel-regression-seeded')) {
      localStorage.setItem('tp-little-nightmare-v3', JSON.stringify({id:'hotel', flags:{}, pos:[.1,2.45,-1], ints:[0]}));
      localStorage.setItem('hotel-regression-seeded', '1');
    }
  });
  const ready = () => page.waitForFunction(() => window.__game?.G.state === 'play' && window.__game.G.player.mode === 'normal', { timeout: 120000 });
  await page.goto(process.env.GAME_URL || 'http://localhost:5191/', { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction(() => window.__game?.G.state === 'title', {timeout:120000});
  await page.click('[data-act=continue]'); await ready();
  // Old saves can contain a disabled cord without a completed giant scene.
  const enabled = await page.evaluate(() => window.__game.G.world.interactables[0].enabled);
  if (process.env.REPRO) {
    console.log(await page.evaluate(async () => {
      const {G} = window.__game; const it = G.world.interactables[0];
      try { await it.use(it); return {flags:G.flags,mode:G.player.mode}; }
      catch(e) { return {error:e.message,mode:G.player.mode}; }
    }));
  } else {
    assert.equal(enabled, true, 'unfinished saves must allow pulling the cord again');
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__game.G.flags.giant && window.__game.G.player.mode === 'normal', {timeout:60000});
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-little-nightmare-v3')).flags.giant, {timeout:10000});
    await page.reload({waitUntil:'networkidle0'});
    await page.waitForFunction(() => window.__game?.G.state === 'title', {timeout:120000});
    await page.keyboard.press('Enter'); await ready();
    assert.equal(await page.evaluate(() => window.__game.G.world.interactables[0].enabled), false);
    await page.evaluate(() => {const {G}=window.__game; G.player.pos.set(13.5,0,-.25); G.player.vel.set(0,0,0);});
    // Use the game's fixed-step physics hook: software WebGL can run far below real time.
    await page.evaluate(()=>window.__game.simSteps(100,{x:1}));
    try{await page.waitForFunction(() => window.__game.G.id === 'roadhouse', {timeout:120000});}catch(e){console.log(await page.evaluate(()=>({id:window.__game.G.id,state:window.__game.G.state,mode:window.__game.G.player.mode,pos:window.__game.G.player.pos,flags:window.__game.G.flags})));throw e;}
    await page.keyboard.up('KeyD'); await ready();
    assert.deepEqual(errors, []);
    console.log('PASS: interrupted save recovers; lamp scene completes; completed save restores; corridor leads to chapter 8; no page errors.');
  }
} finally { await browser.close(); }
