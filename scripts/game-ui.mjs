// Title extras: language switch, guide overlays, soundtrack shelf (with a generated test tone as a "user file").
import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:900000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage(); await p.setViewport({width:1280,height:720}); const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('http://localhost:5191/',{waitUntil:'networkidle0',timeout:240000}); await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('tp-lang','zh');}); await p.reload({waitUntil:'networkidle0',timeout:240000});
await p.waitForSelector('.menu:not([hidden])',{timeout:300000}); const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ev=(f,...a)=>p.evaluate(f,...a);
await sleep(2500); await p.screenshot({path:'previews/game/ui-title-zh.png'});
await p.click('.langs [data-lang=en]'); await sleep(800); await p.screenshot({path:'previews/game/ui-title-en.png'});
console.log('en title', await ev(()=>[...document.querySelectorAll('#title [data-t]')].map(n=>n.textContent).join(' | ')));
await p.click('[data-act=guide-fwwm]'); await sleep(2500); await p.screenshot({path:'previews/game/ui-guide.png'});
await p.keyboard.press('Escape'); await sleep(800);
console.log('after esc: state', await ev(()=>window.__game.G.state), 'guide nodes', await ev(()=>document.querySelectorAll('[class*=guide]').length));
await p.click('[data-act=ost]'); await sleep(1200);
// drop a generated wav into the "diner" slot
await ev(async()=>{const sr=8000,n=sr*2,buf=new ArrayBuffer(44+n*2),v=new DataView(buf);const w=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.sin(i/sr*2*Math.PI*220)*8000,true);
  const f=new File([buf],"Audrey's Dance.wav",{type:'audio/wav'}); const dt=new DataTransfer(); dt.items.add(f); const inp=document.querySelector('#ost .ost-bulk input'); inp.files=dt.files; inp.dispatchEvent(new Event('change',{bubbles:true}));});
await sleep(1500); await p.screenshot({path:'previews/game/ui-ost.png'});
console.log('diner slot', await ev(()=>document.querySelector('#ost [data-cue=diner] .ost-state').textContent));
await p.keyboard.press('Escape'); await sleep(500);
console.log('state after ost', await ev(()=>window.__game.G.state));
// start + jump to the diner: the user file should play and the synth score should stay quiet
await p.click('[data-act=new]'); await sleep(6000);
await ev(()=>window.__game.ctx.goto('diner')); await sleep(16000);
console.log('ost current', await ev(async()=>{const m=await import('/src/game/ost.js'); return m.ost.current;}));
await ev(()=>{const g=window.__game; g.G.state='play';}); await p.keyboard.press('Escape'); await sleep(1500); await p.screenshot({path:'previews/game/ui-pause.png'});
console.log('errors', errs.filter(e=>!/favicon/.test(e)).slice(0,6)); await b.close();
