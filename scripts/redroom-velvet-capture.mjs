// Captures the rebuilt red room miniature in the live Three.js stage (wide, side and focus views).
import puppeteer from 'puppeteer-core';
const out='previews/redroom-velvet';
const browser=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:300000});
const page=await browser.newPage();page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.setViewport({width:1440,height:1000});await page.goto('http://localhost:5191/',{waitUntil:'networkidle0'});
await page.$eval('[data-action="start"]',e=>e.click());await page.waitForFunction(()=>window.miniature?.host);
await page.evaluate(()=>{const m=window.miniature;m.mount(m.host,'redroom',-1,true,false);});
await page.waitForFunction(()=>window.miniature.canvas.dataset.scene==='redroom'&&window.miniature.stats().skinned>0,{timeout:180000});
const shot=async(name,fn)=>{await page.evaluate(fn);await new Promise(r=>setTimeout(r,2500));await page.screenshot({path:`${out}/${name}.png`});};
await shot('game-wide',()=>window.miniature.viewpoint('wide'));
await shot('game-left',()=>window.miniature.viewpoint('left'));
await shot('game-right',()=>window.miniature.viewpoint('right'));
await shot('game-focus-floor',()=>{window.miniature.viewpoint('wide');window.miniature.focus(1);});
console.log(JSON.stringify({stats:await page.evaluate(()=>window.miniature.stats()),errors}));
await browser.close();
