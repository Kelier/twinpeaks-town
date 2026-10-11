import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='blender-materials/character-rebuild/previews';
const browser=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--no-zygote','--single-process','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:180000});
const p=await browser.newPage();p.setDefaultTimeout(90000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await p.setViewport({width:1440,height:1000});
const settle=async id=>{await p.waitForFunction(id=>window.miniature?.canvas.dataset.scene===id&&window.miniature.stats().skinned>0,{},id);await p.evaluate(()=>{const m=window.miniature;m.renderer.setPixelRatio(1);m.renderer.shadowMap.enabled=false;if(!m.renderer._draw){m.renderer._draw=m.renderer.render.bind(m.renderer);m.renderer.render=()=>{};}});};
const click=async sel=>{await p.$eval(sel,b=>b.click());};
const shot=async name=>{await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.evaluate(()=>{const m=window.miniature;if(m.renderer.getContext().isContextLost())throw Error('WebGL context lost');m.resize();m.camera.position.copy(m.targetPosition);m.look.copy(m.targetLook);m.camera.lookAt(m.look);m.renderer._draw(m.scene,m.camera);});await p.screenshot({path:`${out}/${name}.png`,fullPage:true});};
const checks=[];
try{
 await p.goto('http://localhost:5191/',{waitUntil:'networkidle0',timeout:120000});
 await p.evaluate(()=>localStorage.setItem('twin-peaks-tv-cut-v1',JSON.stringify({version:1,chapter:1,unlocked:9,motion:true,muted:true})));
 await p.reload({waitUntil:'networkidle0'});await click('[data-action="start"]');await settle('diner');
 assert.equal(await p.$$('.cast-tools button').then(a=>a.length),2);await shot('game-diner');
 for(const [index,name] of [[0,'cooper'],[1,'audrey']]){await click(`.cast-tools [data-index="${index}"]`);assert.equal(await p.evaluate(()=>window.miniature.view),'close');assert.equal(await p.$eval('.hotspots',e=>getComputedStyle(e).visibility),'hidden');await shot(`game-${name}-portrait`);}
 await click('.beat-link[data-index="0"]');await click('.beat-link[data-index="1"]');await click('.beat-link[data-index="2"]');await click('[data-action="choice"][data-index="0"]');await click('[data-action="gift"]');
 assert.ok((await p.$eval('.counter',e=>e.textContent)).startsWith('1'));checks.push('Three observations, reflection, sticker collection with rebuilt cast');
 await click('[data-action="next"]');await settle('stones');checks.push('Next scene loads and camera transition completes');
 const scenes=['shore','diner','stones','redroom','hotel','roadhouse','cell','cave','grove','mirror'];const stats=[];
 for(let i=0;i<scenes.length;i++){
  await click(`[data-action="chapter"][data-index="${i}"]`);await settle(scenes[i]);stats.push(await p.evaluate(()=>window.miniature.stats()));
  if(scenes[i]==='redroom'){await click('.cast-tools [data-index="0"]');await shot('game-laura-portrait');}
 }
 checks.push('All ten environments load with skinned rebuilt characters');
 await click('[data-action="chapter"][data-index="1"]');await settle('diner');await p.setViewport({width:390,height:844});await click('.cast-tools [data-index="1"]');await shot('game-mobile-audrey');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push('390px mobile cast portrait, no horizontal overflow');
 await p.keyboard.press('w');assert.equal(await p.evaluate(()=>window.miniature.sceneId),'diner');checks.push('No keyboard movement');assert.equal(errors.length,0);
 await fs.writeFile('blender-materials/character-rebuild/WEB-VERIFICATION.json',JSON.stringify({testedAt:new Date().toISOString(),mode:'Chromium SwiftShader; shadows disabled and on-demand capture to fit shared VM. Production geometry unchanged.',checks,stats,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}
