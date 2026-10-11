// Soundtrack slots. The Twin Peaks score (Angelo Badalamenti / David Lynch) is copyrighted, so none of it ships with
// this fan game and none of it is imitated. Instead every scene has a cue slot: if the player owns the soundtrack
// they can drop their own audio files in (kept only in this browser, IndexedDB), or a host can place files at
// public/audio/ost/<cue>.mp3. Whenever a slot is empty the game's original synthesized score plays instead.
import { T, t } from './i18n.js';

export const CUES = [
  { id: 'title', scene: () => T('标题', 'Title'), track: 'Twin Peaks Theme', keys: ['twin peaks theme', 'falling'] },
  { id: 'shore', scene: () => T('湖岸', 'The Lakeshore'), track: 'Laura Palmer’s Theme', keys: ['laura palmer'] },
  { id: 'diner', scene: () => T('双 R 餐馆', 'The Double R'), track: 'Audrey’s Dance', keys: ['audrey'] },
  { id: 'station', scene: () => T('警长办公室', 'The Station'), track: 'Freshly Squeezed', keys: ['freshly squeezed'] },
  { id: 'dream', scene: () => T('梦', 'The Dream'), track: 'Dance of the Dream Man', keys: ['dream man'] },
  { id: 'cabin', scene: () => T('木头女士的小屋', 'The Log Lady’s Cabin'), track: 'The Bookhouse Boys', keys: ['bookhouse'] },
  { id: 'palmer', scene: () => T('帕默家', 'The Palmer House'), track: 'Night Life in Twin Peaks', keys: ['night life'] },
  { id: 'hotel', scene: () => T('大北方旅馆', 'The Great Northern'), track: 'Love Theme from Twin Peaks', keys: ['love theme'] },
  { id: 'roadhouse', scene: () => T('公路酒吧', 'The Roadhouse'), track: 'The World Spins', keys: ['world spins', 'rockin back inside'] },
  { id: 'cell', scene: () => T('拘留室', 'The Holding Cell'), track: 'Laura Palmer’s Theme', keys: [] },
  { id: 'forest', scene: () => T('幽林', 'Ghostwood'), track: 'Into the Night', keys: ['into the night', 'nightingale'] },
  { id: 'redroom', scene: () => T('红房间', 'The Red Room'), track: 'Dance of the Dream Man', keys: [] },
  { id: 'ending', scene: () => T('谢幕', 'Curtain call'), track: 'Falling', keys: ['falling'] },
];

// ---------------- storage ----------------
const DB = 'tp-ost', STORE = 'cues';
const db = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const s = d.transaction(STORE, mode).objectStore(STORE); const r = fn(s); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };
const getFile = (id) => tx('readonly', (s) => s.get(id)).catch(() => null);
const putFile = (id, file) => tx('readwrite', (s) => s.put({ name: file.name, blob: file }, id));
const delFile = (id) => tx('readwrite', (s) => s.delete(id));

// host-provided files (a dev server answers missing paths with index.html, so check the content type)
const hostCache = new Map();
async function hostFile(id) {
  if (hostCache.has(id)) return hostCache.get(id);
  let url = null;
  for (const ext of ['mp3', 'ogg', 'm4a']) {
    try { const r = await fetch(`./audio/ost/${id}.${ext}`, { method: 'HEAD' }); if (r.ok && (r.headers.get('content-type') || '').startsWith('audio/')) { url = r.url; break; } } catch { }
  }
  hostCache.set(id, url); return url;
}

// ---------------- playback ----------------
let cur = null, muted = false, paused = false;
const VOL = .55;
const urls = new Map();
async function source(id) {
  const f = await getFile(id); if (f?.blob) { if (!urls.has(id)) urls.set(id, URL.createObjectURL(f.blob)); return { url: urls.get(id), name: f.name, user: true }; }
  const h = await hostFile(id); return h ? { url: h, name: h.split('/').pop(), user: false } : null;
}
function fade(a, to, ms, done) {
  const from = a.volume, t0 = performance.now();
  const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) requestAnimationFrame(step); else done?.(); };
  step();
}

export const ost = {
  async has(id) { return !!(id && await source(id)); },
  /** crossfade to the cue; returns true if a soundtrack file is playing (so the synth score should stay quiet) */
  async play(id, { loop = true } = {}) {
    if (cur?.id === id) return true;
    const old = cur; cur = null;
    if (old) fade(old.a, 0, 1400, () => old.a.pause());
    const s = id && await source(id); if (!s) return false;
    const a = new Audio(s.url); a.loop = loop; a.volume = 0; cur = { id, a };
    if (!paused) { try { await a.play(); } catch { } }
    fade(a, muted ? 0 : VOL, 2200);
    return true;
  },
  stop(ms = 1400) { const old = cur; cur = null; if (old) fade(old.a, 0, ms, () => old.a.pause()); },
  setMuted(m) { muted = m; if (cur) fade(cur.a, m ? 0 : VOL, 300); },
  pause() { paused = true; cur?.a.pause(); },
  resume() { paused = false; cur?.a.play().catch(() => { }); },
  get current() { return cur?.id || null; },
};

// ---------------- the panel ----------------
let panel = null;
export function openOst({ onChange } = {}) {
  panel?.remove();
  const el = panel = document.createElement('section'); el.id = 'ost'; el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class="ost-card">
    <h2>${t('ost')}</h2>
    <p class="ost-note">${T('《双峰》原声带由安杰洛·巴达拉曼蒂与大卫·林奇创作，受版权保护，本作不附带也不模仿。若你拥有正版音频，可把文件放进下面对应的场景——文件只保存在你自己的浏览器里，不会上传。空着的场景播放本作的原创配乐。',
      'The Twin Peaks score by Angelo Badalamenti and David Lynch is copyrighted; this fan game neither ships nor imitates it. If you own the soundtrack, drop your own files into the scenes below — they stay in your browser and are never uploaded. Empty slots play this game’s original score.')}
      <a href="https://en.wikipedia.org/wiki/Soundtrack_from_Twin_Peaks" target="_blank" rel="noopener">${T('关于原声带', 'About the soundtrack')} ↗</a></p>
    <label class="ost-bulk"><input type="file" accept="audio/*" multiple hidden><span>${T('一次选择多首（按曲名自动配对）', 'Pick several files (matched by track title)')}</span></label>
    <ol class="ost-list"></ol>
    <button class="ost-close" data-ost="close">${t('close')}</button>
  </div>`;
  document.body.append(el);
  const list = el.querySelector('.ost-list');
  const render = async () => {
    const rows = await Promise.all(CUES.map(async (c) => ({ c, s: await source(c.id) })));
    list.innerHTML = rows.map(({ c, s }) => `<li data-cue="${c.id}">
      <span class="ost-scene">${c.scene()}</span>
      <span class="ost-track">${T('建议', 'Suggested')}: <i>${c.track}</i></span>
      <span class="ost-state ${s ? 'on' : ''}">${s ? '♪ ' + s.name : T('原创配乐', 'Original score')}</span>
      <span class="ost-btns"><label><input type="file" accept="audio/*" hidden>${T('选择文件', 'Choose file')}</label>${s?.user ? `<button data-ost="clear">${T('移除', 'Remove')}</button>` : ''}</span>
    </li>`).join('');
  };
  render();
  const norm = (s) => s.toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ');
  el.addEventListener('change', async (e) => {
    const inp = e.target; if (inp.type !== 'file' || !inp.files.length) return;
    const li = inp.closest('[data-cue]');
    if (li) await putFile(li.dataset.cue, inp.files[0]);
    else for (const f of inp.files) {
      const n = norm(f.name);
      for (const c of CUES) if ([norm(c.track), ...c.keys].some((k) => k && n.includes(k))) await putFile(c.id, f);
    }
    urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear();
    await render(); onChange?.();
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ost]'); if (!b) { if (e.target === el) close(); return; }
    if (b.dataset.ost === 'close') close();
    if (b.dataset.ost === 'clear') { const id = b.closest('[data-cue]').dataset.cue; await delFile(id); const u = urls.get(id); if (u) URL.revokeObjectURL(u); urls.delete(id); await render(); onChange?.(); }
  });
  const onKey = (e) => { if (e.code === 'Escape') { e.stopPropagation(); close(); } };
  addEventListener('keydown', onKey, true);
  function close() { removeEventListener('keydown', onKey, true); el.remove(); if (panel === el) panel = null; }
  return close;
}
