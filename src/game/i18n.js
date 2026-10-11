// Tiny i18n: inline bilingual strings T('中文', 'English') resolved at call time, plus UI keys.
// Add a language by extending LANGS and passing a third argument / adding to UI below.
export const LANGS = { zh: '中文', en: 'English' };
const KEY = 'tp-lang';
let lang = (() => { try { return localStorage.getItem(KEY) || (navigator.language?.startsWith('zh') ? 'zh' : 'en'); } catch { return 'zh'; } })();
if (!LANGS[lang]) lang = 'zh';
const listeners = new Set();

export const getLang = () => lang;
export function setLang(l) {
  if (!LANGS[l] || l === lang) return; lang = l;
  try { localStorage.setItem(KEY, l); } catch { }
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : l;
  listeners.forEach((f) => f(l));
}
export const onLang = (f) => { listeners.add(f); return () => listeners.delete(f); };
/** inline bilingual text */
export const T = (zh, en) => (lang === 'en' ? en ?? zh : zh);
/** resolve {zh,en} objects or plain strings */
export const tx = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v[lang] ?? v.zh : v);

const UI = {
  eyebrow: ['一部致敬《双峰》的人偶剧场', 'A puppet-theatre tribute to Twin Peaks'],
  loading: ['正在把布景搬进黑暗里…', 'Carrying the sets into the dark…'],
  start: ['开演', 'Begin'], continue: ['继续', 'Continue'],
  guideLynch: ['导览 · 大卫·林奇', 'Guide · David Lynch'], guideFwwm: ['导览 · 与火同行', 'Guide · Fire Walk with Me'],
  ost: ['原声带', 'Soundtrack'], language: ['语言', 'Language'],
  keys: ['A D 移动 · W S 进出景深 · 空格 跳 · Shift 跑 · E 互动／交谈／按住抓取 · F 手电 · Esc 幕间与节目单',
    'A D move · W S depth · Space jump · Shift run · E interact / talk / hold to grab · F flashlight · Esc intermission'],
  credit: ['非官方同人作品 · 原创配乐与对白转述 · 献给大卫·林奇', 'Unofficial fan work · original score & paraphrased dialogue · for David Lynch'],
  intermission: ['幕间', 'Intermission'], resume: ['继续', 'Resume'], restart: ['从本幕开始', 'Restart act'],
  soundOn: ['声音：开', 'Sound: on'], soundOff: ['声音：关', 'Sound: off'], quit: ['回到标题', 'Back to title'],
  clue: ['线索', 'Clue'], clues: ['线索', 'Clues'], acts: ['幕', 'acts'], pressAny: ['按任意键回到开头', 'Press any key to return'],
  loadFail: ['布景加载失败，请刷新重试。', 'The set failed to load — please refresh.'],
  talkTo: ['与{n}交谈', 'Talk to {n}'], again: ['……再来一次。', '…once more.'], bottomless: ['黑暗没有底。', 'The dark has no floor.'],
  found: ['你找到 {a} / {b} 条线索 · 走过 {c} 幕', 'You found {a} / {b} clues · {c} acts'],
  tribute: ['双峰 · 小小梦魇 —— 一部非官方的致敬短篇 · 献给大卫·林奇', 'Twin Peaks · Little Nightmare — an unofficial tribute · for David Lynch'],
  close: ['合上', 'Close'],
};
export const t = (k, vars) => {
  const e = UI[k]; let s = e ? (lang === 'en' ? e[1] : e[0]) : k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace('{' + a + '}', b);
  return s;
};
