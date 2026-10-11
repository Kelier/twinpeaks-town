// Captures each 1:1 room after the volumetric figures have loaded.
import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:1280,height:820});
await p.goto('http://localhost:5191/',{waitUntil:'networkidle2',timeout:90000});
for(const id of ['lodge','woods','redroom']){await p.evaluate(async id=>{const g=window.twinPeaks;g.engine.renderer.setAnimationLoop(null);g.started=true;g.state.place=id;g.mount(id);g.setMode('play');g.ui.hud();await Promise.all((g.world.figures??[]).map(f=>f.ready));for(let i=0;i<20;i++)g.world.update(.1,i*.1);g.engine.frame(()=>{});},id);await p.screenshot({path:`.impeccable/review/final-${id}.png`});}
console.log('errors',errors);await b.close();
