import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();const out='.impeccable/review/themes';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 await p.setViewport({width:1440,height:900});await p.evaluateOnNewDocument(()=>{localStorage.setItem('tp-lang','zh');localStorage.setItem('tp-visual-theme','paper');localStorage.setItem('tp-little-nightmare-v3',JSON.stringify({id:'diner',flags:{},pos:[0,2.15,-3.2]}));});
 await p.goto('http://localhost:5191/',{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__game?.G.state==='title');await p.click('[data-act=continue]');await p.waitForFunction(()=>window.__game.G.state==='play',{timeout:120000});await sleep(2000);await p.screenshot({path:`${out}/desktop-paper-diner.png`});
 assert.ok(await p.evaluate(()=>window.__game.G.world.statics.some(s=>s.max[0]-s.min[0]>19&&s.max[1]===2.15)));
 await p.setViewport({width:390,height:844});await sleep(300);await p.screenshot({path:`${out}/mobile-paper-diner.png`});
 await p.setViewport({width:844,height:390});await p.reload({waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__game?.G.state==='title');
 for(const theme of ['paper','velvet']){await p.click(`#title [data-theme=${theme}]`);await sleep(300);await p.screenshot({path:`${out}/landscape-${theme}-title.png`});}
 await p.setViewport({width:1440,height:900});await p.click('#title [data-theme=paper]');await sleep(300);await p.screenshot({path:`${out}/desktop-paper-title.png`});
 console.log('CAPTURED: corrected diner fixtures and title archive contrast.');
}finally{await b.close()}
