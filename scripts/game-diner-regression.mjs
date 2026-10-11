import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/local/bin/chromium',headless:true,protocolTimeout:120000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();p.setDefaultTimeout(120000);p.setDefaultNavigationTimeout(120000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.setViewport({width:900,height:600});
 await p.evaluateOnNewDocument(()=>{localStorage.setItem('tp-lang','zh');localStorage.setItem('tp-little-nightmare-v3',JSON.stringify({id:'diner',flags:{domeDown:true,key:true},pos:[10.6,0,.1],ints:[1,0,0]}));});
 await p.goto('http://localhost:5191/');await p.waitForFunction(()=>window.__game?.G.state==='title');
 await p.evaluate(()=>{window.__game.composer.render=()=>{}});await p.click('[data-act=continue]');await p.waitForFunction(()=>window.__game.G.state==='play');
 assert.equal(await p.evaluate(()=>window.__game.G.world.interactables[2].enabled),true,'stale disabled door must recover for an acquired key');
 // Walk along the clear front aisle before approaching the back-door depth lane.
 console.log('right',await p.evaluate(()=>window.__game.simSteps(165,{x:1})));
 console.log('depth',await p.evaluate(()=>window.__game.simSteps(52,{z:-1})));
 console.log('target',await p.evaluate(()=>{const g=window.__game;return {pos:g.G.player.pos.toArray(),near:g.G.world.nearestInteractable(g.G.player.pos)?.label}}));
 await p.keyboard.press('KeyE');await p.waitForFunction(()=>window.__game.G.flags.doorOpen,{timeout:10000});
 console.log('exit',await p.evaluate(()=>window.__game.simSteps(100,{x:1})));
 await p.waitForFunction(()=>window.__game.G.id==='station'&&window.__game.G.state==='play');console.log('PASS existing key save, real E door, physics exit to station');
 // Interrupted old saves must reconstruct interactability from puzzle flags.
 for(const flags of [{},{domeDown:true},{key:true},{domeDown:true,key:true},{doorOpen:true}]){
  const state=await p.evaluate(async flags=>{const g=window.__game;g.G.state='card';await g.buildLevel('diner',{restore:{flags,ints:[1,0,0],pos:[10.6,0,-.6]}});g.G.state='play';g.simSteps(5);return {flags:g.G.flags,items:g.G.world.interactables.slice(0,3).map(i=>i.enabled)}},flags);
  assert.equal(state.items[1],!!flags.domeDown&&!flags.key,'recover uncollected floor key');
  assert.equal(state.items[2],!flags.doorOpen,'recover closed door');
  if(flags.doorOpen)assert.equal(state.flags.key,true);
  if(flags.key)assert.equal(state.flags.domeDown,true);
  if(flags.domeDown&&!flags.key){
   await p.keyboard.press('KeyE');await p.waitForFunction(()=>window.__game.G.flags.key);
   await p.waitForFunction(()=>JSON.parse(localStorage.getItem('tp-little-nightmare-v3')).id==='diner'&&JSON.parse(localStorage.getItem('tp-little-nightmare-v3')).flags.key,{timeout:10000});
  }
  if(!flags.key&&!flags.doorOpen&&!flags.domeDown){
   await p.evaluate(()=>{const g=window.__game;g.G.player.pos.set(17,0,-1.5)});await p.keyboard.press('KeyE');
   assert.equal(await p.evaluate(()=>!!window.__game.G.flags.doorOpen),false,'no key cannot unlock');
  }
 }
 console.log('PASS: stale disabled interactions repaired; interrupted dome pickup works; acquired key normalizes dome; open door restores; no-key lock preserved.');
 assert.deepEqual(errors,[]);
}finally{await b.close()}
