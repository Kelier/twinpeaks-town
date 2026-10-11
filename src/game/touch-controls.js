import { T } from './i18n.js';
export function mountTouch(app,{press,release}){
  const el=document.createElement('nav');el.id='touch-controls';el.setAttribute('aria-label',T('触屏游戏控制','Touch controls'));
  const arrow=(d)=>`<svg viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${d}deg)"><path d="m9 5 7 7-7 7"/></svg>`;
  el.innerHTML=`<div class="touch-directions"><button data-key="KeyW" aria-label="${T('向后走','Move back')}">${arrow(-90)}</button><button data-key="KeyA" aria-label="${T('向左走','Move left')}">${arrow(180)}</button><button data-key="KeyS" aria-label="${T('向前走','Move forward')}">${arrow(90)}</button><button data-key="KeyD" aria-label="${T('向右走','Move right')}">${arrow(0)}</button></div><div class="touch-actions"><button data-key="ShiftLeft">${T('跑','Run')}</button><button data-key="KeyF">${T('灯','Light')}</button><button data-key="Space">${T('跳','Jump')}</button><button data-key="KeyE" class="touch-use">${T('互动 / 抓取','Use / hold')}</button></div>`;
  app.append(el);
  const held=new Map();
  el.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-key]');if(!b)return;e.preventDefault();b.setPointerCapture(e.pointerId);held.set(e.pointerId,b.dataset.key);b.classList.add('held');press(b.dataset.key);});
  const up=e=>{const k=held.get(e.pointerId);if(!k)return;held.delete(e.pointerId);if(![...held.values()].includes(k))release(k);el.querySelector(`[data-key="${k}"]`)?.classList.remove('held');};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(name,up);
  addEventListener('blur',()=>{for(const k of held.values())release(k);held.clear();el.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));});
  return el;
}
