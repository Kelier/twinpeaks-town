import {STICKERS,STICKER_IDS,CASE_STICKERS,stickerHTML,slotHTML,bindStickerTilt,peelSticker,placeSticker} from './stickers.js';
import {EVIDENCE} from '../content/twinPeaks.js';
// Sticker scrapbook and the sticker-board deduction. Stickers are peeled from the world and then
// physically arranged: dragged onto the scrapbook page, or onto Truman's timeline to solve the case.
const SOUNDS={receipt:'杯碟',key:'脚步',tape:'风'};
const ANSWER=['receipt','key','tape'];

export function albumPage(ui){
 const s=ui.g.state,have=new Set(s.stickers);
 const tray=STICKER_IDS.map(id=>have.has(id)?`<button class="tray-sticker" data-drag="${id}" aria-label="把「${STICKERS[id].name}」贴到手账页上" title="${STICKERS[id].caption}">${stickerHTML(id,{size:76,cls:CASE_STICKERS.includes(id)?'holo':'',label:true})}</button>`:`<span class="tray-sticker" aria-label="尚未发现的贴纸">${stickerHTML(id,{size:76,cls:'locked',label:true})}</span>`).join('');
 const placed=s.scrap.map((p,i)=>`<button class="scrap-item" data-scrap="${i}" style="left:${p.x*100}%;top:${p.y*100}%;--rot:${p.r}deg" aria-label="已贴的「${STICKERS[p.id].name}」，双击撕下">${stickerHTML(p.id,{size:p.s??96,cls:CASE_STICKERS.includes(p.id)?'holo':'',peel:true,tilt:0})}</button>`).join('');
 return `<main class="album-page"><div class="section-heading"><p class="eyebrow">DIANE'S SCRAPBOOK / ${s.stickers.length} OF ${STICKER_IDS.length}</p><h2>撕下来的，都是记忆。</h2><p class="album-help">在小镇里点击发光的小物件、与人物交谈、找到线索，就会撕下一张贴纸。把贴纸从左边拖到右边的手账页上；双击已贴的贴纸可以撕下，滚轮或 R 键旋转。</p></div>
 <div class="album-layout"><section class="sticker-tray" aria-label="贴纸收藏">${tray}</section>
 <section class="scrap-page" aria-label="手账页"><div class="scrap-paper"><span class="scrap-date">TWIN PEAKS, WA · FEB 24</span><div class="scrap-polaroid"><i></i><span>“镇上的每个人，都记得不同的昨夜。”</span></div><span class="tape t1"></span><span class="tape t2"></span><div class="scrap-lines"></div>${placed}<p class="scrap-empty">${s.scrap.length?'':'把贴纸拖到这里'}</p></div><div class="scrap-tools"><button data-action="scrap-clear" class="outline">撕掉整页</button><button data-action="resume" class="solid">回到小镇 ↗</button></div></section></div></main>`;
}

export function boardPage(ui){
 const s=ui.g.state,b=ui.boardSlots??=[null,null,null];
 const tray=ANSWER.slice().sort((a,c)=>(a.charCodeAt(0)*7%5)-(c.charCodeAt(0)*7%5)).filter(id=>!b.includes(id)).map(id=>`<button class="tray-sticker board-sticker ${ui.boardPick===id?'picked':''}" data-drag="${id}" data-pick="${id}" aria-label="线索贴纸：${EVIDENCE[id].title}">${stickerHTML(id,{size:104,cls:'holo',label:EVIDENCE[id].label})}</button>`).join('');
 const slots=b.map((id,i)=>`<div class="board-slot" data-slot="${i}" role="button" tabindex="0" aria-label="时间线第 ${i+1} 格${id?'：'+EVIDENCE[id].title:'（空）'}"><span class="slot-no">0${i+1}</span>${id?`<button class="slotted" data-unslot="${i}" aria-label="撕下">${stickerHTML(id,{size:104,cls:'holo',tilt:0})}</button><em>${SOUNDS[id]}</em>`:slotHTML({size:104,label:['第一个声音','接着','最后'][i]})}</div>`).join('<i class="board-arrow">→</i>');
 return `<main class="board-page"><div class="section-heading"><p class="eyebrow">SHERIFF'S DEPT · CASE 0315 · THE MISSING FREQUENCY</p><h2>把声音贴回它经过的时间。</h2><p class="album-help">杜鲁门把录音的三段声音写在白板上：杯碟、脚步、风。把三张线索贴纸拖到时间线上（也可以先点贴纸，再点格子）。贴纸上印着时间。</p></div>
 <div class="board-desk"><div class="board-strip">${slots}</div><div class="board-tray">${tray||'<p class="small-note">三张贴纸都已贴上。</p>'}</div>
 <p id="board-status" role="status">${ui.boardMessage??''}</p><div class="scrap-tools"><button data-action="board-check" class="solid" ${b.every(Boolean)?'':'disabled'}>交给杜鲁门</button><button data-action="board-reset" class="outline">全部撕下</button><button data-action="resume" class="outline">稍后再排</button></div></div></main>`;
}

// Pointer drag that works for mouse and touch; drops are resolved by the element under the pointer.
function drag(root,onDrop){
 root.querySelectorAll('[data-drag]').forEach(src=>src.addEventListener('pointerdown',e=>{
  if(e.button>0)return;e.preventDefault();const id=src.dataset.drag,rect=src.getBoundingClientRect();let ghost=null,moved=false;const sx=e.clientX,sy=e.clientY;
  const move=ev=>{if(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<6)return;if(!moved){moved=true;ghost=document.createElement('div');ghost.className='drag-ghost';ghost.innerHTML=stickerHTML(id,{size:Math.max(80,rect.width),cls:CASE_STICKERS.includes(id)?'holo':'',peel:false,tilt:-4});document.body.appendChild(ghost);src.classList.add('dragging');}
   ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px';ghost.style.display='none';const over=document.elementFromPoint(ev.clientX,ev.clientY);ghost.style.display='';root.querySelectorAll('.over').forEach(x=>x.classList.remove('over'));over?.closest('.board-slot,.scrap-paper')?.classList.add('over');};
  const up=ev=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);src.classList.remove('dragging');root.querySelectorAll('.over').forEach(x=>x.classList.remove('over'));if(!moved){src.click?.();return;}ghost.style.display='none';const over=document.elementFromPoint(ev.clientX,ev.clientY);ghost.remove();onDrop(id,over,ev);};
  addEventListener('pointermove',move);addEventListener('pointerup',up);
 }));
}

export function bindAlbum(ui){
 const root=ui.root,g=ui.g,s=g.state;bindStickerTilt(root);const paper=root.querySelector('.scrap-paper');if(!paper)return;
 const stick=(id,x,y)=>{s.scrap.push({id,x,y,r:Math.round((Math.random()-.5)*24),s:96});if(s.scrap.length>40)s.scrap.shift();g.save();ui.open('album');const el=root.querySelector(`[data-scrap="${s.scrap.length-1}"] .tp-sticker`);if(el)placeSticker(el);g.audio.sfx?.('click');};
 drag(root,(id,over,ev)=>{const p=over?.closest('.scrap-paper');if(!p)return;const r=p.getBoundingClientRect();stick(id,Math.min(.92,Math.max(.04,(ev.clientX-r.left)/r.width)),Math.min(.9,Math.max(.04,(ev.clientY-r.top)/r.height)));});
 // Keyboard / tap fallback: activating a tray sticker sticks it at a free spot.
 root.querySelectorAll('.tray-sticker[data-drag]').forEach(b=>b.addEventListener('click',()=>stick(b.dataset.drag,.15+Math.random()*.7,.2+Math.random()*.6)));
 root.querySelectorAll('[data-scrap]').forEach(b=>{const i=+b.dataset.scrap;
  b.addEventListener('dblclick',async()=>{await peelSticker(b.querySelector('.tp-sticker'));s.scrap.splice(i,1);g.save();ui.open('album');});
  b.addEventListener('wheel',e=>{e.preventDefault();s.scrap[i].r+=Math.sign(e.deltaY)*8;b.style.setProperty('--rot',s.scrap[i].r+'deg');g.save();},{passive:false});
  b.addEventListener('keydown',e=>{if(e.key==='r'||e.key==='R'){s.scrap[i].r+=12;b.style.setProperty('--rot',s.scrap[i].r+'deg');g.save();}if(e.key==='Delete'||e.key==='Backspace'){s.scrap.splice(i,1);g.save();ui.open('album');}});
  // Move an already placed sticker by dragging it across the page.
  b.addEventListener('pointerdown',e=>{if(e.button>0)return;const r=paper.getBoundingClientRect();let moved=false;const mv=ev=>{moved=true;s.scrap[i].x=Math.min(.95,Math.max(.02,(ev.clientX-r.left)/r.width));s.scrap[i].y=Math.min(.93,Math.max(.02,(ev.clientY-r.top)/r.height));b.style.left=s.scrap[i].x*100+'%';b.style.top=s.scrap[i].y*100+'%';b.classList.add('moving');};const upf=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',upf);b.classList.remove('moving');if(moved)g.save();};addEventListener('pointermove',mv);addEventListener('pointerup',upf);});
 });
 ui.actions['scrap-clear']=()=>{s.scrap=[];g.save();ui.open('album');};
}

export function bindBoard(ui){
 const root=ui.root,g=ui.g;bindStickerTilt(root);const b=ui.boardSlots;
 const put=(id,i)=>{const prev=b.indexOf(id);if(prev>=0)b[prev]=null;b[i]=id;ui.boardPick=null;ui.boardMessage='';g.audio.sfx?.('click');ui.open('board');const el=root.querySelector(`[data-slot="${i}"] .tp-sticker`);if(el)placeSticker(el);};
 drag(root,(id,over)=>{const slot=over?.closest('.board-slot');if(slot)put(id,+slot.dataset.slot);});
 root.querySelectorAll('[data-pick]').forEach(x=>x.addEventListener('click',()=>{ui.boardPick=x.dataset.pick;root.querySelectorAll('[data-pick]').forEach(y=>y.classList.toggle('picked',y===x));}));
 root.querySelectorAll('.board-slot').forEach(slot=>{const go=()=>{if(ui.boardPick)put(ui.boardPick,+slot.dataset.slot);};slot.addEventListener('click',e=>{if(!e.target.closest('[data-unslot]'))go();});slot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});
 root.querySelectorAll('[data-unslot]').forEach(x=>x.addEventListener('click',async e=>{e.stopPropagation();const i=+x.dataset.unslot;await peelSticker(x.querySelector('.tp-sticker'));b[i]=null;ui.open('board');}));
 ui.actions['board-reset']=()=>{ui.boardSlots=[null,null,null];ui.boardMessage='';ui.open('board');};
 ui.actions['board-check']=async()=>{if(b.join()===ANSWER.join()){ui.boardMessage='';g.solved();return;}
  const wrong=b.map((id,i)=>id!==ANSWER[i]?i:-1).filter(i=>i>=0);await Promise.all(wrong.map(i=>peelSticker(root.querySelector(`[data-slot="${i}"] .tp-sticker`))));
  wrong.forEach(i=>b[i]=null);ui.boardMessage='杜鲁门摇头：“再听一次——杯碟先响，接着是走廊。对照贴纸上的时间。”';ui.open('board');};
}
