// Close-up of the figurines inside the game (hotel + red room + forest BOB)
import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:600000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:960,height:540}); await p.goto('http://localhost:5191/',{waitUntil:'networkidle0'});
await p.evaluate(()=>localStorage.clear());
await p.waitForSelector('.menu:not([hidden])'); const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=(f,...a)=>p.evaluate(f,...a);
const go=async(l)=>{await ev((l)=>{const g=window.__game; document.querySelector('#title').style.display='none'; g.G.idx=l-1; g.ctx.next();},l); await sleep(8000); await ev(()=>{const {G}=window.__game; G.state='play'; G.player.mode='normal'; G.fade=1; G.fadeTarget=1;});};
const shot=async(name,x,z,zoom,face=1,anim)=>{await ev((x,z,zoom,face,anim)=>{const g=window.__game,G=g.G; G.player.pos.set(x,0,z); G.player.face=face; G.player.yaw=face*Math.PI/2; G.player.model.rotation.set(0,G.player.yaw,0); G.player.model.position.y=G.player.model.userData.baseY; if(anim){G.player.mode='locked'; G.player.lockAnim=anim;} g.ctx.focus(G.player.pos.clone().setY(.75),zoom); g.cam.x=x;},x,z,zoom,face,anim); await sleep(4000); await p.screenshot({path:`previews/game/fig-${name}.png`});};
await ev(()=>{const g=window.__game; document.querySelector('#title').style.display='none'; g.G.state='play'; g.G.player.mode='normal'; g.G.fade=1; g.G.fadeTarget=1;});
await shot('hotel',-3.5,.6,3.2,1,'walk');
await go(3); await shot('red',1.4,-.6,2.6,1,'idle');
await go(2); await ev(()=>{const {G}=window.__game; G.player.pos.set(-16.3,0,0);}); await sleep(1500); await shot('forest',-9.5,1.2,1.6,1,'idle');
await b.close();
