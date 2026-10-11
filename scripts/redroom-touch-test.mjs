import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();const sleep=ms=>new Promise(r=>setTimeout(r,ms));const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await p.evaluateOnNewDocument(()=>{localStorage.setItem('tp-little-nightmare-v3',JSON.stringify({id:'hotel',flags:{giant:true},pos:[7.2,0,-1]}));});
 await p.goto('http://localhost:5191/',{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__game?.G.state==='title');await p.click('[data-act=continue]');await p.waitForFunction(()=>window.__game.G.state==='play',{timeout:120000});
 await p.waitForFunction(()=>document.documentElement.dataset.gameState==='play',{timeout:120000});
 const client=await p.createCDPSession();
 const point=async(key,id)=>{const r=await (await p.$(`#touch-controls [data-key=${key}]`)).boundingBox();return{x:r.x+r.width/2,y:r.y+r.height/2,id};};
 for(const theme of ['3d']){
  await p.evaluate(()=>{const g=window.__game;g.G.player.pos.set(g.G.world.movables[0].max[0]+.45,0,-1);g.G.player.vel.set(0,0,0);g.simSteps(8,{});});
  const before=await p.evaluate(()=>window.__game.G.world.movables[0].mesh.position.x);
  const use=await point('KeyE',1),left=await point('KeyA',2);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[use]});
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[use,left]});await p.waitForFunction(x=>window.__game.G.world.movables[0].mesh.position.x<x-.2,{timeout:45000},before);
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(await p.evaluate(x=>window.__game.G.world.movables[0].mesh.position.x<x-.2,before),`${theme}: two-finger grab and drag`);
  await p.evaluate(()=>{const g=window.__game;g.G.player.pos.set(3,0,.5);g.G.player.vel.set(0,0,0);g.simSteps(8,{});});
  const jump=await point('Space',3);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[jump]});await sleep(250);
  console.log('jump',theme,await p.evaluate(()=>({pos:window.__game.G.player.pos,mode:window.__game.G.player.mode,ground:window.__game.G.player.onGround,state:window.__game.G.state,held:[...document.querySelectorAll('.held')].map(e=>e.dataset.key)})));
  await p.waitForFunction(()=>window.__game.G.player.pos.y>.1,{timeout:15000});
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await sleep(100);
  assert.equal(await p.evaluate(()=>document.querySelectorAll('#touch-controls .held').length),0);
 }
 assert.deepEqual(errors,[]);console.log('PASS: 3D theatre supports two-finger grab + directional drag, jump and touch cancellation.');
}finally{await b.close()}
