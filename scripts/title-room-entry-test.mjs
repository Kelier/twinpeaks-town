import puppeteer from 'puppeteer-core';import assert from 'node:assert/strict';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.setViewport({width:800,height:600});await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await p.evaluateOnNewDocument(()=>localStorage.setItem('tp-little-nightmare-v3',JSON.stringify({id:'hotel',flags:{giant:true},pos:[3,0,.5]})));
 await p.goto('http://localhost:5191/',{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__game?.titleRoom?.ready,{timeout:120000});
 const yaw=await p.evaluate(()=>window.__game.titleRoom.yaw);await new Promise(r=>setTimeout(r,1200));assert.equal(await p.evaluate(()=>window.__game.titleRoom.yaw),yaw,'reduced motion stops idle movement');
 await p.focus('.room-canvas');await p.keyboard.press('KeyL');await p.waitForFunction(()=>!window.__game.titleRoom.lit);
 await p.keyboard.press('ArrowLeft');await p.waitForFunction(y=>window.__game.titleRoom.yaw<y-.05,{timeout:30000},yaw);await p.keyboard.press('Home');await p.waitForFunction(()=>Math.abs(window.__game.titleRoom.yaw-.6)<.01,{timeout:30000});
 await p.click('[data-act=continue]');assert.equal(await p.$('.room-canvas'),null,'viewer canvas disposed on entry');
 await p.waitForFunction(()=>window.__game.G.state==='play',{timeout:120000});assert.equal(await p.evaluate(()=>window.__game.titleRoom.snapshot.disposed),true);assert.deepEqual(errors,[]);console.log('PASS: reduced motion, keyboard lights/rotation/reset, saved-game entry and GPU context disposal.');
}finally{await b.close()}
