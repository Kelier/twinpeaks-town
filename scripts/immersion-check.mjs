import puppeteer from 'puppeteer-core';import fs from 'node:fs/promises';
const out='.impeccable/review/immersion';await fs.mkdir(out,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const capture=async name=>{
 await p.evaluate(()=>{const g=window.__game;g.G.state='play';g.G.fade=g.G.fadeTarget=1;g.finish.uniforms.fade.value=1;g.finish.uniforms.flash.value=0;g.finish.uniforms.bars.value=.055;g.G.scene.updateMatrixWorld(true);g.cam.x=g.G.player.pos.x+1;g.cam.y=3;g.cam.z=innerWidth<innerHeight?17:11.2;g.cam.look.set(g.cam.x,1.25,-.6);g.camera.position.set(g.cam.x,g.cam.y,g.cam.z);g.camera.lookAt(g.cam.look);g.captureRender();});
 await p.screenshot({path:`${out}/${name}.png`});
};
try{
await p.setViewport(process.env.MOBILE?{width:390,height:844,isMobile:true,hasTouch:true}:{width:1100,height:700});await p.evaluateOnNewDocument(()=>{localStorage.setItem('tp-lang','zh');localStorage.setItem('tp-little-nightmare-v3',JSON.stringify({id:'shore',flags:{},pos:[8.5,0,.1]}))});await p.goto('http://localhost:5191/');await p.waitForFunction(()=>window.__game?.G.state==='title',{timeout:120000});
// Capture real production shaders at full resolution on demand. Continuous SwiftShader drawing would block readback.
await p.evaluate(()=>{const g=window.__game;g.captureRender=g.composer.render.bind(g.composer);g.composer.render=()=>{};});
await p.click('[data-act=continue]');await p.waitForFunction(()=>window.__game.G.state==='play',{timeout:120000});
const result=(process.env.SCENES||process.env.MOBILE)?JSON.parse(await fs.readFile(`${out}/checks.json`,'utf8')).result:[];
for(const id of (process.env.MOBILE?[]:process.env.SCENES?.split(',')||['shore','diner','station','dream','cabin','palmer','hotel','roadhouse','cell','forest','redroom'])){
 const metrics=await p.evaluate(async(id)=>{const g=window.__game;g.G.state='card';await g.buildLevel(id,{restore:{flags:{},pos:[({shore:8.5,diner:0,station:0,dream:-5,cabin:0,palmer:0,hotel:0,roadhouse:2,cell:4,forest:0,redroom:0})[id],0,.6]}});g.G.world.triggers.forEach(t=>t.done=true);g.G.state='play';g.G.fade=g.G.fadeTarget=1;g.simSteps(3);const T=await import('/node_modules/three/build/three.module.js');g.G.scene.updateMatrixWorld(true);const bb=new T.Box3().setFromObject(g.G.player.model);const movables=g.G.world.movables.map(m=>{const b=new T.Box3().setFromObject(m.mesh);return {geometryBottom:b.min.y,colliderBottom:m.min[1]}});return {id,feet:bb.min.y,physicsY:g.G.player.pos.y,contacts:g.G.scene.userData.immersion,movables};},id);
 await capture(id);const prior=result.findIndex(x=>x.id===id);if(prior>=0)result[prior]=metrics;else result.push(metrics);await fs.writeFile(`${out}/checks.json`,JSON.stringify({captureMode:'production shaders, on-demand full-resolution render; not performance evidence',result,errors},null,2));console.log(JSON.stringify(metrics));
}
await p.setViewport({width:390,height:844,...(process.env.MOBILE?{isMobile:true,hasTouch:true}:{})});await p.evaluate(async()=>{const g=window.__game;await g.buildLevel('shore',{restore:{pos:[8.5,0,.1]}});g.G.world.triggers.forEach(t=>t.done=true);g.G.state='play';g.simSteps(2);});await new Promise(r=>setTimeout(r,100));await capture('mobile');
await p.setViewport({width:844,height:390,...(process.env.MOBILE?{isMobile:true,hasTouch:true}:{})});await p.evaluate(()=>window.__game.G.state='play');await new Promise(r=>setTimeout(r,100));await capture('landscape');
await fs.writeFile(`${out}/checks.json`,JSON.stringify({captureMode:'production shaders; on-demand full-resolution render; not a performance benchmark',mobileContext:process.env.MOBILE?'isMobile and hasTouch, portrait390x844 and landscape844x390':'viewport resize only; run MOBILE=1 for touch evidence',result,errors},null,2));if(errors.length)throw new Error(errors.join('\n'));
}finally{await b.close()}
