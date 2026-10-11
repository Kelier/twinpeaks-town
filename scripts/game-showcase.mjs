import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:600000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:1280,height:720}); await p.goto('http://localhost:5191/',{waitUntil:'networkidle0'});
await p.waitForSelector('.menu:not([hidden])'); const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=(f,...a)=>p.evaluate(f,...a);
await sleep(2000); await p.screenshot({path:'previews/game/show-0-title.png'});
const go=async(l)=>{await ev((l)=>{const g=window.__game; document.querySelector('#title').style.display='none'; g.G.idx=l-1; g.ctx.next();},l); await sleep(8000); await ev(()=>{const {G}=window.__game; G.state='play'; G.player.mode='normal'; G.player.model.rotation.set(0,G.player.yaw,0); G.player.model.position.y=G.player.model.userData.baseY; G.fade=1; G.fadeTarget=1;});};
const place=async(x,y,z,face=1,torch=false)=>{await ev((x,y,z,face,torch)=>{const {G,cam}=window.__game; G.player.pos.set(x,y,z); G.player.face=face; G.player.yaw=face*Math.PI/2; G.player.torchOn=torch; cam.x=x; cam.look.x=x; cam.y=y*.75+2.05; cam.look.y=y*.75+1.25;},x,y,z,face,torch); await sleep(3500);};
// hotel: on the cabinet next to the lit lamp
await ev(()=>{const g=window.__game; document.querySelector('#title').style.display='none'; g.G.state='play'; g.G.player.mode='normal'; g.G.player.model.rotation.set(0,g.G.player.yaw,0); g.G.player.model.position.y=g.G.player.model.userData.baseY; g.G.fade=1; g.G.fadeTarget=1;});
await place(-4,0,.6,1,true); await p.screenshot({path:'previews/game/show-1-hotel.png'});
await go(1); await place(-1.5,0,0,1); await p.screenshot({path:'previews/game/show-2-diner.png'});
await go(2); await ev(()=>{const {G}=window.__game; G.player.pos.set(-16.3,0,0);}); await sleep(1500);
await place(-5.6,0,1.2,1); await ev(()=>window.__game.G.player.pos.set(-7.2,0,1.3)); await sleep(5000); await p.screenshot({path:'previews/game/show-3-forest.png'});
await place(31,0,.2,1); await sleep(4000); await p.screenshot({path:'previews/game/show-4-grove.png'});
await go(3); await place(-1,0,.4,1); await p.screenshot({path:'previews/game/show-5-redroom.png'});
await b.close();
