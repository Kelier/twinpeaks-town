// Visit scenes by id, screenshot, open a dialogue. Usage: node scripts/game-story.mjs station roadhouse ...
import puppeteer from 'puppeteer-core';
const ids = process.argv.slice(2);
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:900000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:960,height:540}); const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('http://localhost:5191/',{waitUntil:'networkidle0',timeout:240000}); await p.evaluate(()=>localStorage.clear());
await p.waitForSelector('.menu:not([hidden])',{timeout:300000}); const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=(f,...a)=>p.evaluate(f,...a);
await ev(()=>{document.querySelector('#title').style.display='none';});
for (const id of ids) {
  await ev((id)=>{const g=window.__game; g.G.state='play'; g.ctx.goto(id);},id); await sleep(12000);
  await ev(()=>{const {G}=window.__game; G.state='play'; G.player.mode='normal'; G.fade=1; G.fadeTarget=1;});
  const info = await ev(()=>{const {G}=window.__game; return {id:G.id, npcs:G.world.interactables.map(i=>i.label), spawn:G.player.pos.toArray()};});
  console.log(id, JSON.stringify(info));
  const xs = {station:[-11,0,8,11],roadhouse:[-10,2,12],cabin:[-6,2,7],palmer:[-6,3,14],diner:[-10,0,14],redroom:[-2,4],hotel:[-4,6],shore:[-12,-2,8,17],dream:[-8,0,6],cell:[-9,-2,5,12]}[id]||[0];
  let k=0; for (const x of xs) { await ev((x)=>{const g=window.__game,G=g.G; G.player.pos.set(x, x>12&&G.id==='palmer'?3.37:(x>12&&G.id==='shore'?3.31:0), .3); G.player.model.rotation.set(0,G.player.yaw,0); G.player.model.position.y=G.player.model.userData.baseY; g.cam.x=x; g.cam.look.x=x;},x); await sleep(3500); await p.screenshot({path:`previews/game/story-${id}-${k++}.png`}); }
  // open the first talk and screenshot the dialogue + its choice
  const talked = await ev(()=>{const {G}=window.__game; const it=G.world.interactables.find(i=>/^(与|Talk to)/.test(i.label)); if(!it) return false; G.player.pos.set(it.pos.x, 0, it.pos.z+.5); it.use(it); return it.label;});
  if (talked) { await sleep(4000); await p.screenshot({path:`previews/game/story-${id}-talk.png`}); for (let i=0;i<4;i++){ await p.keyboard.press('Enter'); await sleep(2500);} await p.screenshot({path:`previews/game/story-${id}-talk2.png`}); for (let i=0;i<6;i++){ await p.keyboard.press('Enter'); await sleep(1500);} }
}
console.log('errors', errs.slice(0,6)); await b.close();
