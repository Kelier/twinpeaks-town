// Captures the volumetric NPC figures from front, three-quarter and side views.
import puppeteer from 'puppeteer-core';
const out=process.argv[2]??'.impeccable/review/fig';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const p=await b.newPage();p.on('console',m=>{if(['error','warning'].includes(m.type()))console.log('console',m.type(),m.text());});p.on('pageerror',e=>console.log('pageerror',e.message));
await p.setViewport({width:900,height:640});await p.goto('http://localhost:5191/',{waitUntil:'networkidle2',timeout:60000});
await p.evaluate(async()=>{const g=window.twinPeaks;g.engine.renderer.setAnimationLoop(null);await g.start();g.mount('diner');g.ui.close();await new Promise(r=>setTimeout(r,1500));});
const shots=[['front',-3.35+0.3,1.5,3.2+2.6],['three',-3.35+2.2,1.5,3.2+1.8],['side',-3.35+2.8,1.4,3.2+0.05]];
for(const [name,x,y,z] of shots){await p.evaluate((x,y,z)=>{const g=window.twinPeaks;const c=g.camera;c.cam.position.set(x,y,z);const d={x:-3.35-x,y:1.2-y,z:3.2-z};c.yaw=Math.atan2(-d.x,-d.z);c.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));c.roomLook();for(let i=0;i<30;i++)g.world.update(.1,i*.1);g.engine.frame(()=>{});},x,y,z);await p.screenshot({path:`${out}-${name}.png`});}
await b.close();
