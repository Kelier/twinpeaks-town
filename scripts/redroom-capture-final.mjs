import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();p.on('pageerror',e=>console.error(e));const out='.impeccable/review/redroom';
try{
 await p.setViewport({width:844,height:390,isMobile:true,hasTouch:true});await p.goto('http://localhost:5191/',{waitUntil:'networkidle0'});await p.evaluate(async()=>{await document.fonts.ready;await document.querySelector('.title-art img').decode();document.getAnimations().forEach(a=>a.finish());});await p.screenshot({path:`${out}/landscape.png`});
 await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await p.evaluate(()=>localStorage.setItem('tp-little-nightmare-v3',JSON.stringify({id:'hotel',flags:{giant:true},pos:[3,0,.5]})));await p.reload({waitUntil:'networkidle0'});await p.click('[data-act=continue]');
 await p.waitForFunction(()=>window.__game?.G.state==='play'&&document.documentElement.dataset.gameState==='play',{timeout:180000});
 await p.evaluate(async()=>{window.__game.G.fade=1;window.__game.cam.z=17;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 await p.screenshot({path:`${out}/mobile-play.png`});console.log('captured portrait play');await p.click('#pause-toggle');await p.evaluate(()=>document.querySelector('#pause').scrollTop=0);await p.screenshot({path:`${out}/mobile-pause-top.png`});console.log('captured pause top');
}finally{await b.close()}
