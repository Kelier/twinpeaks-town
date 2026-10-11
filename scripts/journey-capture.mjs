// Walks the nested miniature journey (valley → town → cutaway → 1:1) and the sticker UI, capturing each layer.
import puppeteer from 'puppeteer-core';
const W=+(process.argv[2]??1280),H=+(process.argv[3]??820),tag=process.argv[4]??'desk';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:400000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const p=await b.newPage();const errors=[];p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('pageerror',e=>errors.push(e.message));
await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await p.setViewport({width:W,height:H});
await p.evaluateOnNewDocument(()=>localStorage.clear());
await p.goto('http://localhost:5191/',{waitUntil:'networkidle2',timeout:90000});
const shot=async name=>{await p.evaluate(()=>{const g=window.twinPeaks;g.camera.update(.016);g.world.update?.(.016,1);g.engine.frame(()=>{});});await p.screenshot({path:`.impeccable/review/j-${tag}-${name}.png`});};
await p.evaluate(()=>{const g=window.twinPeaks;g.engine.renderer.setAnimationLoop(null);});await shot('title');
await p.evaluate(async()=>{const g=window.twinPeaks;g.start();for(let i=0;i<20;i++){g.camera.update(.5);await new Promise(r=>setTimeout(r,10));}});
await p.evaluate(async()=>{const g=window.twinPeaks;g.mountDiorama('valley');g.ui.hud();g.camera.fly(new (g.camera.cam.position.constructor)(0,4,-12),new (g.camera.cam.position.constructor)(150,118,205),.01);g.camera.update(.1);});await shot('valley');
await p.evaluate(async()=>{const g=window.twinPeaks;g.transitioning=false;const pr=g.toTown();for(let i=0;i<10;i++)g.camera.update(.5);await pr;});await shot('town');
await p.evaluate(async()=>{const g=window.twinPeaks;const pr=g.dive('diner');for(let i=0;i<10;i++){g.camera.update(.5);g.world.update(.5,i);}await pr;});await shot('cutaway');
await p.evaluate(async()=>{const g=window.twinPeaks;const pr=g.enterRoom('diner');for(let i=0;i<40;i++){g.camera.update(.25);await new Promise(r=>setTimeout(r,30));}await pr;for(let i=0;i<20;i++)g.world.update(.1,i*.1);});await shot('room');
await p.evaluate(()=>{const g=window.twinPeaks;g.state.stickers.push('coffee','pie','owl','receipt');g.state.scrap=[{id:'coffee',x:.3,y:.4,r:-8,s:96},{id:'pie',x:.45,y:.62,r:10,s:96}];g.ui.open('album');});await new Promise(r=>setTimeout(r,800));await p.screenshot({path:`.impeccable/review/j-${tag}-album.png`});
await p.evaluate(()=>{const g=window.twinPeaks;g.state.evidence=['receipt','key','tape'];g.ui.boardSlots=['receipt',null,null];g.ui.open('board');});await new Promise(r=>setTimeout(r,800));await p.screenshot({path:`.impeccable/review/j-${tag}-board.png`});
console.log('errors',JSON.stringify(errors.slice(0,8)));await b.close();
