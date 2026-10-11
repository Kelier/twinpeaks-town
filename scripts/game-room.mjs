import puppeteer from 'puppeteer-core';
const lvl=+process.argv[2]||0, xs=(process.argv[3]||'-9,-2,6').split(',').map(Number), tag=process.argv[4]||'room';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:600000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:960,height:540}); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:5191/',{waitUntil:'networkidle0'}); await p.evaluate(()=>localStorage.clear());
await p.waitForSelector('.menu:not([hidden])'); const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=(f,...a)=>p.evaluate(f,...a);
if (lvl>0) { await ev((l)=>{const g=window.__game; g.G.idx=l-1; g.ctx.next();},lvl); await sleep(8000); }
await ev(()=>{const g=window.__game; document.querySelector('#title').style.display='none'; g.G.state='play'; g.G.player.mode='normal'; g.G.fade=1; g.G.fadeTarget=1;});
let i=0; for (const x of xs) { await ev((x)=>{const g=window.__game,G=g.G; G.player.pos.set(x,0,.4); G.player.model.rotation.set(0,G.player.yaw,0); G.player.model.position.y=G.player.model.userData.baseY; g.cam.x=x; g.cam.look.x=x;},x); await sleep(4000); await p.screenshot({path:`previews/game/${tag}-${i++}.png`}); }
console.log(errs.slice(0,3)); await b.close();
