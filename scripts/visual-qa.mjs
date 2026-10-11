import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const browser = await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:180000});
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1440,height:900});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('redroom.settings.v1',JSON.stringify({quality:'high',reducedFlashing:true})));
 await page.goto(process.argv[2]??'http://localhost:5191/',{waitUntil:'networkidle0',timeout:120000});
 await page.waitForFunction(()=>window.__redroom?.engine);
 await page.evaluate(()=>{const g=window.__redroom;g.engine.renderer.setAnimationLoop(null);g.transitions.reset();g.engine.u.uFade.value=0;g.camera.apply();g.engine.composer.render();});
 await page.screenshot({path:'docs/screens/release-title.png'});
 const shots=[['redroom',[0,1.6,2.2],0],['town',[0,1.6,5],0],['theater',[0,1.6,4],0],['radiator',[0,1.6,2],0]];
 for(const [id,pos,yaw] of shots){
   await page.evaluate(({id,pos,yaw})=>{const g=window.__redroom;g.ui.closeAll();g.setMode('play');g._mount(id);g.camera.pos.set(...pos);g.camera.yaw=yaw;g.camera.pitch=-.06;g.camera.apply();g.space.update(.1,3);g.engine.composer.render();},{id,pos,yaw});
   await page.screenshot({path:`docs/screens/release-${id}.png`});
 }
 // Verify real keyboard movement and bounded collision in the new space.
 await page.evaluate(()=>{const g=window.__redroom;g._mount('town');g.setMode('play');g.camera.locked=false;g.camera.vel.set(0,0,0);g.camera.pos.set(0,1.6,4);});
 await page.keyboard.down('KeyW');
 const movement=await page.evaluate(()=>{const g=window.__redroom;for(let i=0;i<30;i++)g.camera.update(1/60);return {z:g.camera.pos.z,keys:[...g.input.keys]};});
 await page.keyboard.up('KeyW');
 if(movement.z>=3.8)throw new Error('WASD movement did not move the camera');
 const collision=await page.evaluate(()=>{const g=window.__redroom;g.camera.pos.set(-6,1.6,-4.9);g.camera.yaw=0;g.input.keys.add('KeyW');for(let i=0;i<120;i++)g.camera.update(1/60);g.input.keys.clear();return g.camera.pos.z;});
 if(collision < -5.4)throw new Error('Diner wall collision failed');
 console.log(JSON.stringify({movement,collision}));
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.evaluate(()=>{const g=window.__redroom;g.toTitle();g.engine.composer.render();});
 await page.screenshot({path:'docs/screens/release-mobile.png',fullPage:true});
 const layouts=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('.title-nav button')].map(x=>x.getBoundingClientRect().width)}));
 console.log(JSON.stringify({errors,layouts}));
 fs.writeFileSync('docs/visual-qa.json',JSON.stringify({errors,layouts},null,2));
} finally {await browser.close();}
