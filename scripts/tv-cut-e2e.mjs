import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.impeccable/review/tv-cut';
const browser=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],protocolTimeout:120000});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));const checks=[];
const click=async s=>{await page.waitForSelector(s);await page.click(s);};
const settle=async()=>{await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await new Promise(r=>setTimeout(r,850));};
const capture=async name=>{await settle();await page.evaluate(()=>{document.getAnimations().forEach(a=>a.pause());window.scrollTo(0,0);});await page.screenshot({path:`${out}/${name}.png`,fullPage:true});};
try{
await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});await page.goto('http://localhost:5191/',{waitUntil:'networkidle0'});await page.evaluate(()=>localStorage.removeItem('twin-peaks-tv-cut-v1'));await page.reload({waitUntil:'networkidle0'});await capture('desktop-opening');
await click('[data-action="start"]');await capture('desktop');
assert.equal(await page.$eval('[data-action="next"]',e=>e.disabled),true);assert.equal(await page.$eval('[data-action="chapter"][data-index="1"]',e=>e.disabled),true);checks.push('Locked timeline and progression gate');
await click('[data-action="pause"]');assert.ok(await page.$('.pause-cover'));await click('.pause-cover [data-action="pause"]');checks.push('Pause and resume');
for(let n=0;n<10;n++){
 await settle();assert.equal(await page.$eval('.timeline [aria-current]',e=>Number(e.dataset.index)),n);
 await click('.beat-link[data-index="0"]');await click('.beat-link[data-index="0"]');assert.match(await page.$eval('.read-marker',e=>e.textContent),/1 \/ 3/);
 await click('.beat-link[data-index="1"]');await click('.beat-link[data-index="2"]');assert.equal(await page.$eval('[data-action="next"]',e=>e.disabled),true);
 await click('[data-action="choice"][data-index="0"]');await click('[data-action="gift"]');
 if(await page.$('[data-action="egg"]')){await click('[data-action="egg"]');await click('[data-action="collectEgg"]');}
 if(n===1)await capture('desktop-diner');if(n===3)await capture('desktop-redroom');
 await click('[data-action="next"]');await new Promise(r=>setTimeout(r,850));
}
assert.ok(await page.$('.memorial'));checks.push('All ten scenes, 30 beats, 10 choices, all stickers, final memorial');await capture('ending');
await click('[data-action="book"]');assert.equal(await page.$$eval('.scrap.owned',e=>e.length),13);await capture('book');await page.keyboard.press('Escape');assert.equal(await page.$eval('#overlay',e=>e.open),false);checks.push('13 collectible stickers and native dialog Escape');
await page.reload({waitUntil:'networkidle0'});await click('[data-action="start"]');assert.equal(await page.$eval('.counter',e=>e.textContent),'13 / 13');assert.equal(await page.$eval('.timeline [aria-current]',e=>Number(e.dataset.index)),9);checks.push('Reload restores chapter, all choices and collections');
await click('[data-action="chapter"][data-index="1"]');await settle();await page.keyboard.press('w');await page.keyboard.press('ArrowLeft');assert.equal(await page.$eval('.timeline [aria-current]',e=>Number(e.dataset.index)),1);checks.push('WASD and arrows do not navigate');
await page.setViewport({width:390,height:844,deviceScaleFactor:1});await capture('mobile');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push('390px mobile no horizontal overflow');
await click('[data-action="book"]');await capture('mobile-book');assert.equal(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.querySelector('dialog').clientWidth),true);await page.keyboard.press('Escape');
await click('[data-action="sources"]');await click('[data-action="motion"]');assert.equal(await page.evaluate(()=>document.body.classList.contains('still')),true);await page.keyboard.press('Escape');checks.push('Reduced-motion setting and close return');
await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});const axe=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
await fs.writeFile(`${out}/e2e.json`,JSON.stringify({checks,errors,axe:axe.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>n.target)}))},null,2));assert.equal(errors.length,0);console.log(JSON.stringify({checks,errors,axe:axe.violations.map(v=>v.id)},null,2));
}finally{await browser.close();}
