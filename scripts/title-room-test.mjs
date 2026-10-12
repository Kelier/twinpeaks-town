import puppeteer from 'puppeteer-core';import assert from 'node:assert/strict';import fs from 'node:fs';
const out='.impeccable/review/interactive';fs.mkdirSync(out,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.evaluateOnNewDocument(()=>localStorage.setItem('tp-lang','zh'));
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]]){
  await p.setViewport({width,height,isMobile:name!=='desktop',hasTouch:name!=='desktop'});await p.goto('http://localhost:5191/',{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__game?.titleRoom?.ready && window.__game.titleRoom.snapshot.lampPoint,{timeout:120000});await p.evaluate(async()=>{await document.fonts.ready;document.getAnimations().forEach(a=>a.finish());});
  await p.screenshot({path:`${out}/${name}-on.png`});
  assert.ok(await p.evaluate(()=>window.__game.titleRoom.snapshot.render.triangles>0));
  await p.click('.room-light');await p.waitForFunction(()=>window.__game.titleRoom.lightLevel<.1,{timeout:60000});assert.equal(await p.evaluate(()=>window.__game.titleRoom.lit),false);
  await p.screenshot({path:`${out}/${name}-off.png`});
  // Hit the lamp via its projected mesh centre, not the UI fallback switch.
  const lamp=await p.evaluate(()=>{const point=window.__game.titleRoom.snapshot.lampPoint,r=document.querySelector('.room-canvas').getBoundingClientRect();return{x:r.x+(point.x+1)*r.width/2,y:r.y+(1-point.y)*r.height/2};});
  if(name==='desktop')await p.mouse.click(lamp.x,lamp.y);else await p.touchscreen.tap(lamp.x,lamp.y);
  await p.waitForFunction(()=>window.__game.titleRoom.lit,{timeout:10000});
  const rect=await (await p.$('.room-canvas')).boundingBox();const before=await p.evaluate(()=>window.__game.titleRoom.yaw);
  if(name==='desktop'){await p.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.65);await p.mouse.down();await p.mouse.move(rect.x+rect.width*.6-90,rect.y+rect.height*.65,{steps:8});await p.mouse.up();}
  else{const cd=await p.createCDPSession();await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width*.65,y:rect.y+rect.height*.6,id:1}]});await cd.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x+rect.width*.65-65,y:rect.y+rect.height*.6,id:1}]});await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cd.detach();}
  await p.waitForFunction(v=>Math.abs(window.__game.titleRoom.yaw-v)>.15,{timeout:30000},before);
  await p.screenshot({path:`${out}/${name}-drag.png`});console.log(name,'GLB, switch, raycast lamp, drag passed');
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/checks.json`,JSON.stringify({passed:true,errors,checks:['actual GLB model loaded','desktop/mobile/landscape lights transition','raycast lamp click and tap','mouse and touch drag changes camera']},null,2));
}finally{await b.close()}
