import puppeteer from 'puppeteer-core';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const out='.impeccable/review/title-loading/worker';await fs.mkdir(out,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:120000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],checks=[];let p;
async function page(mode='normal',width=1100,height=760){
 if(p)await p.close();p=await b.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(45000);
 await p.setViewport({width,height,isMobile:width<900,hasTouch:width<900});
 await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await p.evaluateOnNewDocument(mode=>{
  if(location.protocol!=='http:')return;localStorage.setItem('tp-lang','zh');
  window.tasks=[];new PerformanceObserver(l=>window.tasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  if(mode==='normal')return;
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker {
   constructor(url,opts){
    const code=mode==='blocked'?`while(true){}`:`
     const pending=[];self.onmessage=event=>pending.push(event);
     const originalFetch=globalThis.fetch;globalThis.fetch=(input,options)=>{
      const url=new URL(input,${JSON.stringify(location.origin)}).href;
      if(url.endsWith(${JSON.stringify(mode==='poster'?'red-room-interactive.glb':'room-environment.hdr')}))return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
      return originalFetch(url,options);
     };
     await import(${JSON.stringify(String(url))});
     const handler=self.onmessage;for(const event of pending)handler(event);`;
    const blob=URL.createObjectURL(new Blob([code],{type:'application/javascript'}));super(blob,opts);URL.revokeObjectURL(blob);
   }
  };
 },mode);
 await p.goto('http://localhost:5191/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__game?.titleRoom);return p;
}
async function navLatency(){const t=Date.now();await p.click('[data-act=library]');assert.equal(await p.$eval('#library',e=>e.hidden),false);const ms=Date.now()-t;await p.click('[data-act=close-library]');return ms;}
try {
 for(const [name,w,h] of [['desktop',2048,1187],['mobile',390,844],['landscape',844,390]]){
  await page('poster',w,h);
  const dimensions=await p.evaluate(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height};};return{host:r('.title-art'),poster:r('.title-art img'),entry:r('[data-act=new]'),gameRendererAbsent:!window.__game.renderer};});
  assert.equal(dimensions.host.h,dimensions.poster.h);assert.ok(dimensions.entry.y+dimensions.entry.h<=h);assert.equal(dimensions.gameRendererAbsent,true);
  await p.screenshot({path:`${out}/${name}-loading.png`,fromSurface:false});checks.push({name,dimensions,pendingNavigationMs:await navLatency()});console.log(name,'pending pass');
 }
 await page('blocked');const blockedLatency=await navLatency();assert.ok(blockedLatency<1000,'navigation responds while worker is completely blocked');
 await p.waitForSelector('.room-retry',{timeout:35000});assert.equal(await p.$('.room-canvas'),null);await p.screenshot({path:`${out}/worker-timeout.png`,fromSurface:false});checks.push({workerTimeout:true,blockedNavigationMs:blockedLatency});console.log('blocked worker recovery pass');
 await page('hdr');await p.waitForFunction(()=>window.__game.titleRoom.ready);assert.equal(await p.evaluate(()=>window.__game.titleRoom.metrics.environmentFallback),true);await p.click('.room-light');await p.waitForFunction(()=>window.__game.titleRoom.lightLevel<.1);checks.push({hdrTimeoutInteractive:true});console.log('HDR fallback pass');
 for(const [name,w,h] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]]){
  await page('normal',w,h);const mounted=await p.evaluate(()=>performance.now());const latencies=[await navLatency()];
  await p.waitForFunction(()=>window.__game.titleRoom.ready&&window.__game.titleRoom.snapshot.lampPoint);await new Promise(r=>setTimeout(r,1300));
  const profile=await p.evaluate(start=>({readyAt:performance.now(),tasks:window.tasks,preparationTasks:window.tasks.filter(t=>t.start>=start),snapshot:window.__game.titleRoom.snapshot}),mounted);
  await p.screenshot({path:`${out}/${name}-on.png`,fromSurface:false});await p.click('.room-light');await p.waitForFunction(()=>window.__game.titleRoom.lightLevel<.1);await p.screenshot({path:`${out}/${name}-off.png`,fromSurface:false});
  const lamp=await p.evaluate(()=>{const r=document.querySelector('.room-canvas').getBoundingClientRect(),p=window.__game.titleRoom.snapshot.lampPoint;return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};});
  if(w<900)await p.touchscreen.tap(lamp.x,lamp.y);else await p.mouse.click(lamp.x,lamp.y);await p.waitForFunction(()=>window.__game.titleRoom.lit);
  const rect=await(await p.$('.room-canvas')).boundingBox(),yaw=await p.evaluate(()=>window.__game.titleRoom.yaw);
  if(w<900){const cd=await p.createCDPSession();await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width*.65,y:rect.y+rect.height*.6,id:1}]});await cd.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x+rect.width*.65-65,y:rect.y+rect.height*.6,id:1}]});await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cd.detach();}
  else {await p.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.6);await p.mouse.down();await p.mouse.move(rect.x+rect.width*.6-90,rect.y+rect.height*.6,{steps:8});await p.mouse.up();}
  await p.waitForFunction(y=>Math.abs(window.__game.titleRoom.yaw-y)>.15,{},yaw);await p.screenshot({path:`${out}/${name}-drag.png`,fromSurface:false});
  checks.push({name,normal:true,latencies,profile,lightButton:true,raycastLamp:true,drag:true});console.log(name,'normal interactive pass');
 }
 await page('poster');await p.click('[data-act=new]');await p.waitForFunction(()=>!!window.__game.renderer);assert.equal(await p.$('.room-canvas'),null);assert.equal(await p.evaluate(()=>window.__game.titleRoom.snapshot.disposed),true);checks.push({entryDuringLoading:true,workerDisposed:true});
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/checks.json`,JSON.stringify({passed:true,checks,errors},null,2));console.log('PASS',JSON.stringify(checks.map(({profile,...rest})=>({...rest,preparationTasks:profile?.preparationTasks}))));
}finally {await b.close();}
