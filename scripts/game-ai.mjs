// Deterministic check of BOB detection / hiding / catching and the Red Room choice.
import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:600000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage(); await p.setViewport({width:320,height:180}); await p.goto('http://localhost:5191/',{waitUntil:'networkidle0',timeout:240000});
await p.waitForSelector('.menu:not([hidden])',{timeout:300000}); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const sim=(n,inp)=>p.evaluate((n,inp)=>window.__game.simSteps(n,inp),n,inp); const ev=(f,...a)=>p.evaluate(f,...a);
const log=(k,v)=>console.log(k.padEnd(16),JSON.stringify(v));
const go=async(l)=>{await ev((l)=>{const g=window.__game; g.ctx.goto(['hotel','diner','forest','redroom'][l]);},l); await sleep(12000); await ev(()=>{const {G}=window.__game; G.state='play'; G.player.mode='normal';});};
await go(2);
// trigger BOB, then stand hidden behind trunk at x=-7 (trunk z -.6) while BOB patrols at z -3.1
await ev(()=>window.__game.G.player.pos.set(-16.3,0,0)); await sim(5,{});
await ev(()=>window.__game.G.player.pos.set(-7,0,1.4)); 
const bobState=()=>ev(()=>{const w=window.__game.G.world; return null;});
let caught=false;
for(let i=0;i<10;i++){ const r=await sim(60,{}); if(r.mode==='caught'){caught=true;break;} }
log('hidden 10s', {caught, dread:+(await ev(()=>window.__game.G.dread)).toFixed(2)});
// now step into the open with the torch on
await ev(()=>{const {G}=window.__game; G.player.pos.set(-3.5,0,1.2); G.player.torchOn=true;});
let t=0; for(;t<20;t++){ const r=await sim(30,{}); if(r.mode==='caught') break; }
log('open+torch', {caughtAfterSec: t*0.5, dread:+(await ev(()=>window.__game.G.dread)).toFixed(2)});
await sleep(2500); log('respawn', await sim(5,{}));
// red room
await go(3);
await ev(()=>window.__game.G.player.pos.set(3,0,-1.2)); await sim(5,{});
await ev(()=>{const {G}=window.__game; const it=G.world.nearestInteractable(G.player.pos); it&&it.use(it);}); await sleep(6500);
const correct = await ev(()=>{ return null; });
// try every alcove until ending
const alc=[-10,0,10]; let ended=false;
for(const a of alc){ await ev((a)=>{const {G}=window.__game; G.player.mode='normal'; G.player.pos.set(a,0,-1.5);},a); await sim(5,{}); await sim(200,{z:-1}); await sleep(5000);
  const st=await ev(()=>window.__game.G.state); log('alcove '+a, {state:st, pos: await sim(1,{})}); if(st==='ending'||st==='ended'){ended=true;break;} }
log('ended', ended);
console.log('errors',errs.slice(0,5)); await b.close();
