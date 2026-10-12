import { T } from './i18n.js';
// On by default. Browsers that require a gesture unlock playback on first input.
export const bgm = new Audio('/audio/falling.mp3');
bgm.loop = true;
bgm.preload = 'metadata';
bgm.volume = .42;
bgm.id = 'background-music';
bgm.hidden = true;
document.body.append(bgm);
let enabled = true, failed = false, pending = false, waiting = true;
export function musicControl(emblem='') {
  return `<button class="music-toggle" data-act="bgm" aria-pressed="true">${emblem||'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4"/></svg>'}<span></span><i aria-hidden="true"></i></button>`;
}
export function paintMusic() {
  document.querySelectorAll('[data-act=bgm]').forEach(b=>{
    b.setAttribute('aria-pressed',String(enabled));
    b.disabled=pending;
    b.setAttribute('aria-busy',String(pending));
    b.dataset.waiting=String(waiting&&enabled);
    b.querySelector('span').textContent = pending ? T('音乐加载中…','Loading music…') : failed ? T('音乐未能播放 · 重试','Music unavailable · retry') : enabled ? T(waiting?'音乐已开启 · 轻触启奏':'背景音乐 · 开启',waiting?'Music on · touch to begin':'Music · on') : T('背景音乐 · 关闭','Music · off');
  });
}
async function playMusic(){
  if(pending||!enabled)return;
  failed=false;pending=true;paintMusic();
  try {await bgm.play();waiting=false;}
  catch(e){if(e.name==='NotAllowedError'){waiting=true;}else{enabled=false;waiting=false;failed=true;}}
  pending=false;paintMusic();
}
export async function toggleMusic() {
  if(pending)return;
  if(enabled){enabled=false;waiting=false;bgm.pause();paintMusic();return;}
  enabled=true;waiting=true;await playMusic();
}
function unlock(e){
  if(!enabled||!waiting||e.target.closest?.('[data-act=bgm]'))return;
  if(e.type==='keydown'&&(e.repeat||!['Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)))return;
  playMusic();
}
document.addEventListener('pointerdown',unlock,{capture:true});
document.addEventListener('keydown',unlock,{capture:true});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)bgm.pause();
  else if(enabled&&!waiting)playMusic();
});
bgm.addEventListener('error',()=>{enabled=false;waiting=false;failed=true;pending=false;paintMusic();});
// Try native autoplay; an autoplay refusal preserves the requested default.
playMusic();
