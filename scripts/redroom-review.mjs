import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='.impeccable/review/redroom';fs.mkdirSync(out,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
try {
 await p.evaluateOnNewDocument(()=>{localStorage.setItem('tp-lang','zh');if(!sessionStorage.getItem('redroom-test')){localStorage.setItem('tp-little-nightmare-v3',JSON.stringify({id:'hotel',flags:{giant:true},pos:[3,0,.5]}));localStorage.setItem('tp-visual-theme','paper');sessionStorage.setItem('redroom-test','1');}});
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390],['small',360,740]]) {
  await p.setViewport({width,height,isMobile:name!=='desktop',hasTouch:name!=='desktop'});
  await p.goto('http://localhost:5191/',{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__game?.G.state==='title');
  await p.evaluate(async()=>{await document.fonts.ready;await document.querySelector('.title-art img').decode();document.getAnimations().forEach(a=>a.finish());});
  await p.screenshot({path:`${out}/${name}.png`,fullPage:true});
  const metrics=await p.evaluate(()=>({scroll:document.querySelector('#title').scrollWidth,width:innerWidth,paper:!!document.querySelector('#paper-stage'),picker:!!document.querySelector('[data-theme]'),music:document.querySelector('[data-act=bgm]').getAttribute('aria-pressed')}));
  assert.equal(metrics.scroll,width,`${name} has no horizontal overflow`);assert.equal(metrics.paper,false);assert.equal(metrics.picker,false);assert.equal(metrics.music,'false');
 }
 // Playback must be driven by a genuine click and the supplied audio must decode.
 await p.click('#title [data-act=bgm]');await p.waitForFunction(()=>document.querySelector('#title [data-act=bgm]').getAttribute('aria-pressed')==='true',{timeout:30000});
 const track=await p.evaluate(async()=>{const bgm=document.querySelector('#background-music');return{src:bgm.currentSrc,duration:bgm.duration,paused:bgm.paused,loop:bgm.loop,time:bgm.currentTime}});
 assert.ok(track.src.endsWith('/audio/falling.mp3'));assert.ok(track.duration>120);assert.equal(track.paused,false);assert.equal(track.loop,true);
 await p.click('#title [data-act=bgm]');assert.equal(await p.evaluate(async()=>document.querySelector('#background-music').paused),true);
 await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await p.click('[data-act=continue]');
 await p.waitForFunction(()=>window.__game.G.state==='play'&&window.__game.G.player.mode==='normal',{timeout:120000});
 await new Promise(r=>setTimeout(r,1800));await p.screenshot({path:`${out}/mobile-play.png`});
 await p.click('#pause-toggle');await p.click('#pause [data-act=bgm]');await p.waitForFunction(()=>document.querySelector('#pause [data-act=bgm]').getAttribute('aria-pressed')==='true');
 assert.equal(await p.evaluate(()=>document.querySelector('#title [data-act=bgm]').getAttribute('aria-pressed')),'true');
 await p.screenshot({path:`${out}/mobile-pause.png`});await p.click('#pause [data-act=bgm]');await p.click('[data-act=resume]');
 await p.setViewport({width:844,height:390,isMobile:true,hasTouch:true});await new Promise(r=>setTimeout(r,1800));await p.screenshot({path:`${out}/landscape-play.png`});
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/checks.json`,JSON.stringify({passed:true,track,errors,checks:['responsive title at 1440/390/844/360','old paper preference ignored','paper renderer and switch removed','actual MP3 decode/play/pause/loop','pause/title controls synchronized','3D game continues from save']},null,2));console.log('PASS: responsive title, removed paper mode, music playback and pause, 3D save continuity',track);
}finally{await b.close()}
