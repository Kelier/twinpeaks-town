import { T } from './i18n.js';
// Explicit opt-in each visit. A gesture is required by mobile browsers.
export const bgm = new Audio('/audio/falling.mp3');
bgm.loop = true;
bgm.preload = 'none';
bgm.volume = .42;
bgm.id = 'background-music';
bgm.hidden = true;
document.body.append(bgm);
let enabled = false, failed = false, pending = false;
export function musicControl() {
  return `<button class="music-toggle" data-act="bgm" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4"/></svg><span></span><i aria-hidden="true"></i></button>`;
}
export function paintMusic() {
  document.querySelectorAll('[data-act=bgm]').forEach(b=>{
    b.setAttribute('aria-pressed',String(enabled));
    b.disabled=pending;
    b.setAttribute('aria-busy',String(pending));
    b.querySelector('span').textContent = pending ? T('音乐加载中…','Loading music…') : failed ? T('音乐未能播放 · 重试','Music unavailable · retry') : enabled ? T('背景音乐 · 开启','Music · on') : T('背景音乐 · 关闭','Music · off');
  });
}
export async function toggleMusic() {
  if (pending) return;
  if (enabled) {enabled=false;bgm.pause();paintMusic();return;}
  failed=false;pending=true;paintMusic();
  try {await bgm.play();enabled=true;} catch {enabled=false;failed=true;}
  pending=false;paintMusic();
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)bgm.pause();
  else if(enabled)bgm.play().catch(()=>{enabled=false;failed=true;paintMusic();});
});
bgm.addEventListener('error',()=>{enabled=false;failed=true;paintMusic();});
