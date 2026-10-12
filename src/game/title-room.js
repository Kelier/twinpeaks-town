import { T, getLang } from './i18n.js';
import { roomSticker } from './room-stickers.js';

// DOM, navigation and input stay on the main thread. GLB parsing, shader
// compilation, uploads and every WebGL draw belong to the title worker.
export function mountTitleRoom(host) {
  const hint=document.createElement('p');hint.className='room-hint';hint.setAttribute('role','status');host.append(hint);
  const button=document.createElement('button');button.className='room-light scene-guide';button.dataset.roomAnchor='light';button.disabled=true;
  button.innerHTML=roomSticker('light')+'<span></span>';host.append(button);
  const ns='http://www.w3.org/2000/svg',leaders=document.createElementNS(ns,'svg');leaders.classList.add('room-leaders');leaders.setAttribute('aria-hidden','true');host.append(leaders);
  function placeGuides(anchors,hitPoints,geometryBounds){
    const r=host.getBoundingClientRect(),portrait=matchMedia('(max-width:760px) and (orientation:portrait)').matches,short=r.height<360;
    const shifts=portrait?{music:[-8,-62],help:[-45,-5],archive:[-42,40],entry:[22,55],light:[16,-10]}:short?{music:[-10,-40],help:[-100,-18],archive:[-60,40],entry:[15,28],light:[28,0]}:{music:[0,-30],help:[-80,-14],archive:[-65,24],entry:[20,30],light:[32,0]};
    leaders.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);if(!portrait){hint.style.top='';hint.style.bottom='';}
    for(const el of host.querySelectorAll('[data-room-anchor]')){const role=el.dataset.roomAnchor,a=anchors[role];if(!a)continue;const w=el.offsetWidth||80,h=el.offsetHeight||44,[dx,dy]=shifts[role]||[0,0];const x=Math.max(w/2+10,Math.min(r.width-w/2-10,r.width*a.x/100+dx)),y=Math.max(h/2+10,Math.min(r.height-h/2-10,r.height*a.y/100+dy));
      el.style.setProperty('--anchor-x',x+'px');el.style.setProperty('--anchor-y',y+'px');
      const point=hitPoints?.[role];if(!point)continue;const px=(point.x+1)*r.width/2,py=(1-point.y)*r.height/2,line=leaders.querySelector(`[data-line=${role}]`)||document.createElementNS(ns,'line'),dot=leaders.querySelector(`[data-dot=${role}]`)||document.createElementNS(ns,'circle');line.dataset.line=role;dot.dataset.dot=role;
      line.setAttribute('x1',px);line.setAttribute('y1',py);line.setAttribute('x2',x);line.setAttribute('y2',y+(py>y?h/2:-h/2));dot.setAttribute('cx',px);dot.setAttribute('cy',py);dot.setAttribute('r','2');if(!line.parentNode)leaders.append(line,dot);
      if(role==='entry'&&portrait){hint.style.top=Math.max(r.height*(geometryBounds?.bottom||80)/100+14,y+h/2+14)+'px';hint.style.bottom='auto';}
    }
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const state={ready:false,present:false,lit:true,lightLevel:1,yaw:.6,disposed:false,metrics:{},worker:true};
  let worker,canvas,timer,observer,drag,retry;
  const send=data=>worker?.postMessage(data);
  const label=()=>{button.setAttribute('aria-pressed',String(state.lit));const span=button.querySelector('span'),text=state.lit?T('关灯','Lights off'):T('开灯','Lights on');if(span.textContent!==text)span.textContent=text;};label();
  function stop(){clearTimeout(timer);observer?.disconnect();worker?.terminate();worker=null;canvas?.remove();}
  function fail(){
    if(state.disposed)return;stop();state.ready=false;state.present=false;leaders.replaceChildren();host.classList.remove('room-ready','room-present');button.hidden=true;
    hint.textContent=T('红房暂未苏醒，仍可进入游戏','The room is unavailable. You can still enter the game.');
    if(!retry){retry=document.createElement('button');retry.className='room-retry';retry.textContent=T('重新唤醒红房','Reload the room');retry.onclick=start;host.append(retry);}
  }
  function start(){
    if(state.disposed)return;stop();retry?.remove();retry=null;drag=null;
    Object.assign(state,{ready:false,present:false,lit:true,lightLevel:1,yaw:.6,metrics:{}});label();
    host.classList.remove('room-ready','room-present');button.hidden=false;button.disabled=true;hint.textContent=T('红房正在苏醒…','The room is waking…');
    canvas=document.createElement('canvas');canvas.className='room-canvas';canvas.tabIndex=0;
    canvas.setAttribute('aria-label',T('互动红房。拖动旋转，点击落地灯开关灯。方向键转动，L 开关灯，Home 复位。','Interactive Red Room. Drag to rotate; tap the floor lamp to toggle it. Arrow keys rotate, L toggles lights, Home resets.'));
    host.append(canvas);
    try {
      if(!canvas.transferControlToOffscreen)throw new Error('Offscreen rendering unavailable');
      worker=new Worker(new URL('./title-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{
        if(state.disposed)return;
        if(data.state.failed){fail();return;}
        Object.assign(state,data.state);label();
        if(data.state.present)host.classList.add('room-present');
        if(data.state.anchors)placeGuides(data.state.anchors,data.state.hitPoints,data.state.geometryBounds);
        if(data.state.action){const action=data.state.action==='entry'?(document.querySelector('[data-act=continue]:not([hidden])')?'continue':'new'):({archive:'library',music:'bgm',help:'help'})[data.state.action];document.querySelector('[data-act='+action+']')?.click();}
        if(data.state.hint)hint.textContent=data.state.hint;
        if(data.state.ready){clearTimeout(timer);host.classList.add('room-ready');button.disabled=false;}
      };
      worker.onerror=e=>{e.preventDefault();fail();};
      const offscreen=canvas.transferControlToOffscreen(),r=host.getBoundingClientRect();
      worker.postMessage({type:'init',canvas:offscreen,options:{width:r.width,height:r.height,pixelRatio:devicePixelRatio,compact:matchMedia('(pointer:coarse)').matches,reduced:reduced.matches,language:getLang(),hidden:document.hidden}},[offscreen]);
      observer=new ResizeObserver(()=>{const r=host.getBoundingClientRect();send({type:'resize',width:r.width,height:r.height,pixelRatio:devicePixelRatio});});observer.observe(host);
      // This deadline remains responsive even if a GPU driver blocks its worker.
      timer=setTimeout(fail,30000);
    }catch{fail();return;}
    canvas.addEventListener('pointerdown',e=>{if(!state.present)return;canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};canvas.classList.add('dragging');});
    canvas.addEventListener('pointermove',e=>{
      const r=canvas.getBoundingClientRect();send({type:'hover',x:(e.clientX-r.x)/r.width-.5,y:(e.clientY-r.y)/r.height-.5});
      if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      drag.moved ||= Math.abs(dx)+Math.abs(dy)>3;drag.x=e.clientX;drag.y=e.clientY;send({type:'drag',dx,dy});
    });
    const cancel=()=>{drag=null;canvas.classList.remove('dragging');send({type:'dragEnd'});send({type:'hover',x:0,y:0});};
    canvas.addEventListener('pointerup',e=>{if(drag?.id!==e.pointerId)return;if(!drag.moved){const r=canvas.getBoundingClientRect();send({type:'tap',x:(e.clientX-r.x)/r.width*2-1,y:1-(e.clientY-r.y)/r.height*2});}cancel();});
    canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);canvas.addEventListener('pointerleave',()=>{if(!drag)send({type:'hover',x:0,y:0});});
    canvas.addEventListener('wheel',e=>{if(!state.present)return;e.preventDefault();send({type:'zoom',delta:e.deltaY});},{passive:false});
    canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyL','Home'].includes(e.code))return;e.preventDefault();e.stopPropagation();send({type:'key',code:e.code});});
  }
  button.addEventListener('click',()=>send({type:'toggle'}));
  const visibility=()=>send({type:'visibility',hidden:document.hidden});document.addEventListener('visibilitychange',visibility);
  const motion=()=>send({type:'reduced',value:reduced.matches});reduced.addEventListener('change',motion);
  start();
  return {get ready(){return state.ready;},get lit(){return state.lit;},get lightLevel(){return state.lightLevel;},get yaw(){return state.yaw;},get metrics(){return state.metrics;},get snapshot(){return {...state};},
    enter(){document.querySelector('#title')?.classList.add('is-entering');send({type:'enter'});return new Promise(resolve=>setTimeout(resolve,reduced.matches?0:850));},
    dispose(){state.disposed=true;state.ready=false;stop();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion);}};
}
