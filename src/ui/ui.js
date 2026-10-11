// 界面层：HUD、字幕、对白、章节卡、全部菜单页面（标题/暂停/存读档/设置/档案/时间线/关系图/镜头库/致谢）。
import { WORKS, MEDIA, mediumOf } from '../content/works.js';
import { TIMELINE, TAGS } from '../content/timeline.js';
import { SOURCES } from '../content/sources.js';
import { buildGraph, THEMES, PEOPLE, COLLAB } from '../content/graph.js';
import { FRAGMENTS, hintFor, SPACES } from '../content/chapters.js';
import { GraphView } from './graphView.js';
import { SHOT_LIBRARY } from '../fx/camera.js';
import { TRANSITIONS } from '../fx/transitions.js';
import { STATES } from '../audio/musicFSM.js';

const $ = (s) => document.querySelector(s);
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const themeLabel = Object.fromEntries(THEMES.map((t) => [t.id, t.label]));
const fmtDate = (ts) => new Date(ts).toLocaleString('zh-CN', { hour12: false });
const srcLinks = (ids) => h('div', { class: 'src' }, '来源：', ...ids.flatMap((id, i) => [i ? '；' : '', h('a', { href: SOURCES[id]?.url, target: '_blank', rel: 'noopener' }, `[${id}] ${SOURCES[id]?.title ?? id}`)]));

export class UI {
  constructor(game) {
    this.game = game;
    this.root = $('#menu-root');
    this.initialHash = location.hash; // 启动时的深链接（打开标题页会清空地址栏的 hash）
    this.stack = [];
    this.dialogQueue = null;
    window.addEventListener('keydown', (e) => this._key(e), true);
    $('#hud-menu-btn').addEventListener('click', () => this.open('pause'));
    $('#hud-archive').addEventListener('click', () => this.open('archive'));
    $('#hud-settings').addEventListener('click', () => this.open('settings'));
    $('#hud-mute').addEventListener('click', () => game.updateSettings({ muted: !game.settings.muted }));
    const lb = $('#hud-listen');
    const hold = (v) => (e) => { e.preventDefault(); this.listenHeld = v; };
    lb.addEventListener('pointerdown', hold(true));
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) lb.addEventListener(ev, hold(false));
    lb.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') this.listenHeld = true; });
    lb.addEventListener('keyup', () => (this.listenHeld = false));
    $('#dialog').addEventListener('click', () => this._advance());
    window.addEventListener('hashchange', () => this.route());
  }

  // ———————————————— 路由（档案页面可直接通过链接打开，并可脱离 3D 浏览） ————————————————
  static ROUTES = [
    [/^#\/archive\/films\/?([\w-]*)$/, 'archive'],
    [/^#\/archive\/people\/([\w-]+)$/, 'person'],
    [/^#\/life$/, 'timeline'],
    [/^#\/connections$/, 'graph'],
    [/^#\/journal$/, 'journal'],
    [/^#\/settings$/, 'settings'],
  ];
  static PATHS = { archive: (a) => `#/archive/films/${a ?? ''}`, person: (a) => `#/archive/people/${a}`, timeline: () => '#/life', graph: () => '#/connections', journal: () => '#/journal', settings: () => '#/settings' };
  route(hash = location.hash) {
    if (hash === this._lastHash) return;
    for (const [re, page] of UI.ROUTES) {
      const m = hash.match(re);
      if (m) {
        const arg = m[1] || undefined;
        const top = this.stack.at(-1);
        if (top && UI.PATHS[top[0]]) this.replace(page, arg);
        else this.open(page, arg);
        return true;
      }
    }
    return false;
  }
  _syncHash() {
    const top = this.stack.at(-1);
    const path = top && UI.PATHS[top[0]] ? UI.PATHS[top[0]](top[1]) : '';
    this._lastHash = path;
    if (location.hash !== path) history.replaceState(null, '', path || location.pathname + location.search);
  }
  setListening(on) {
    if (this._listening === on) return;
    this._listening = on;
    $('#listen-ind').classList.toggle('on', on);
    $('#hud-listen').setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  loading(on) {
    $('#loading-ind').hidden = !on;
  }
  endCard() {
    return new Promise((r) => {
      const el = h('div', { class: 'end-card', role: 'status' }, h('div', {}, h('div', { class: 'l1' }, '致大卫·林奇'), h('div', { class: 'l2' }, '1946 — 2025')));
      document.body.append(el);
      this.announce('致大卫·林奇，1946 至 2025。');
      setTimeout(() => { el.remove(); r(); }, 6000);
    });
  }

  _key(e) {
    if (this.dialogQueue && ['KeyE', 'Enter', 'Space'].includes(e.code)) {
      e.preventDefault();
      e.stopPropagation();
      this._advance();
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (this.stack.length) this.back();
      else if (this.game.mode === 'play' && !this.dialogQueue) this.open('pause');
    }
    if (e.code === 'F3') {
      e.preventDefault();
      this.togglePerf();
    }
  }

  // ———————————————— HUD ————————————————
  showHud(on) {
    $('#hud').hidden = !on;
  }
  updateHud() {
    const s = this.game.state;
    const space = this.game.space;
    $('#hud-chapter .hc-title').textContent = space ? SPACES[space.id].title : '';
    $('#hud-chapter .hc-year').textContent = space ? SPACES[space.id].year : '';
    $('#reticle').hidden = !this.game.settings.showReticle;
    $('#hud-mute').setAttribute('aria-pressed', this.game.settings.muted ? 'true' : 'false');
    $('#hud-mute').textContent = this.game.settings.muted ? '静音' : '♪';
    $('#hud-fragments').replaceChildren(
      ...Object.values(FRAGMENTS).map((f) => h('span', { class: s.fragments.includes(f.id) ? 'got' : '', title: f.name, 'aria-label': `${f.name}${s.fragments.includes(f.id) ? '：已获得' : '：未获得'}` }, f.glyph)),
    );
    const townCount = ['coffee', 'ledger', 'radio'].filter(k => s.flags[`town:${k}`]).length;
    const objectives = {
      town: s.flags.townComplete ? '小镇记忆已收录。林间红幕通向红房间。' : `调查餐馆、旅馆与森林。线索 ${townCount} / 3 · Esc 可随时返回`,
      highway: '跟随夜路前行。停车后，调查路牌。',
      theater: s.flags.micDone ? '声音停止之后，寻找观众席旁的蓝色盒子。' : '走向舞台，调查麦克风。',
      radiator: s.flags.radiatorSolved ? '舞台已经开启。取回那枚种子。' : '聆听三只阀门。墙上的纸条留下了顺序。',
    };
    $('#hud-hint').textContent = space?.id === 'redroom' ? hintFor(s) : objectives[space?.id] ?? '';
    $('#hud-progress').textContent = `记忆 ${s.fragments.length} / 3`;

  }
  prompt(text) {
    $('#hud-prompt').textContent = text;
  }
  announce(text) {
    const el = $('#sr-live');
    el.textContent = '';
    setTimeout(() => (el.textContent = text), 30);
  }

  // ———————————————— 字幕 ————————————————
  subtitle(text, kind = 'speech', ms = 3800) {
    if (!this.game.settings.subtitles || !text) return;
    const box = $('#subtitles');
    // 同一条环境字幕短时间内不重复
    if (kind !== 'speech') {
      const now = performance.now();
      this._capSeen ??= {};
      if (now - (this._capSeen[text] ?? -1e9) < 8000) return;
      this._capSeen[text] = now;
    }
    const el = h('div', { class: `cap ${kind}` }, text);
    box.append(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), ms);
  }

  // ———————————————— 对白 ————————————————
  dialog(lines) {
    return new Promise((resolve) => {
      this.dialogQueue = { lines: [...lines], resolve };
      this.game.setMode('dialog');
      this._showLine();
    });
  }
  _showLine() {
    const q = this.dialogQueue;
    const line = q.lines.shift();
    const d = $('#dialog');
    d.hidden = false;
    d.querySelector('.dialog-speaker').textContent = line.who ?? '';
    d.querySelector('.dialog-text').textContent = line.text;
    d.querySelector('.dialog-actions').replaceChildren(h('button', { type: 'button', onclick: (e) => { e.stopPropagation(); this._advance(); } }, q.lines.length ? '继续 ［E］' : '关闭 ［E］'));
    this.announce(`${line.who ? line.who + '：' : ''}${line.text}`);
    this._lineAt = performance.now();
  }
  _advance() {
    const q = this.dialogQueue;
    if (!q || performance.now() - this._lineAt < 250) return;
    this.game.audio.sfx('click');
    if (q.lines.length) return this._showLine();
    $('#dialog').hidden = true;
    this.dialogQueue = null;
    this.game.setMode(this.stack.length ? 'menu' : 'play');
    q.resolve();
  }

  chapterCard(ch) {
    if (!ch) return Promise.resolve();
    const el = h('div', { class: 'chapter-card', role: 'status' }, h('div', {}, h('div', { class: 'ct' }, ch.title), h('div', { class: 'cg' }, ch.goal)));
    document.body.append(el);
    this.announce(`${ch.title}。目标：${ch.goal}`);
    this.updateHud();
    return new Promise((r) => setTimeout(() => { el.remove(); r(); }, this.game.settings.reducedMotion ? 2500 : 3600));
  }

  togglePerf() {
    if (!this.game.engine) return;
    if (this.perfEl) {
      clearInterval(this.perfTimer);
      this.perfEl.remove();
      this.perfEl = null;
      return;
    }
    this.perfEl = h('div', { id: 'perf', 'aria-hidden': 'true' });
    document.body.append(this.perfEl);
    this.perfTimer = setInterval(() => {
      const p = this.game.engine.perf;
      const fsm = this.game.audio.fsm;
      this.perfEl.textContent = `FPS ${p.fps.toFixed(0)}  帧 ${p.avgMs.toFixed(1)}ms  最差 ${(p.lastWorst ?? 0).toFixed(1)}ms\n绘制 ${p.calls}  三角形 ${p.tris}\n画质 ${this.game.engine.qualityName}${this.game.engine.autoQuality ? '（自动）' : ''}  音乐 ${fsm.state}`;
    }, 500);
  }

  // ———————————————— 菜单栈 ————————————————
  open(page, arg) {
    this.stack.push([page, arg]);
    this._render();
    this.game.setMode(this.stack[0][0] === 'title' ? 'title' : 'menu');
  }
  replace(page, arg) {
    this.stack[this.stack.length - 1] = [page, arg];
    this._render();
  }
  back() {
    const top = this.stack.pop();
    if (top?.[0] === 'title') { this.stack.push(top); return; }
    this._cleanup?.();
    if (this.stack.length) {
      this._render();
      if (this.stack[0][0] === 'title') this.game.setMode('title');
    }
    else {
      this.root.replaceChildren();
      this._syncHash();
      this.game.setMode('play');
      $('#stage').focus?.();
    }
  }
  closeAll() {
    this._cleanup?.();
    this.stack = [];
    this.root.replaceChildren();
    this._syncHash();
  }
  _render() {
    this._cleanup?.();
    this._cleanup = null;
    const [page, arg] = this.stack[this.stack.length - 1];
    const el = this[`page_${page}`](arg);
    this._syncHash();
    const wrap = h('div', { class: `menu ${page}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': el.dataset.label ?? page }, el);
    this.root.replaceChildren(wrap);
    // 焦点管理：进入页面时聚焦第一个可操作元素
    requestAnimationFrame(() => (wrap.querySelector('[autofocus]') ?? wrap.querySelector('button, [href], input, select'))?.focus());
    wrap.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...wrap.querySelectorAll('button, [href], input, select, [tabindex="0"]')].filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    });
  }
  head(title, meta) {
    return h('div', { class: 'page-head' }, h('h2', {}, title), h('div', { class: 'meta' }, meta ?? ''), h('button', { class: 'btn small', onclick: () => this.back() }, '返回 ［Esc］'));
  }

  // ———————————————— 页面 ————————————————
  page_title() {
    const g = this.game;
    const latest = g.saves.latest();
    const mobile = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 700;
    if (g.archiveOnly) {
      return h('div', { class: 'panel narrow', 'data-label': '档案模式' },
        h('div', { class: 'brand' }, h('h1', {}, '红房间'), h('div', { class: 'sub' }, '档案模式 · 无需 3D'), h('div', { class: 'tribute' }, '致大卫·林奇（1946–2025）')),
        g.noGL && h('p', { class: 'warn', role: 'note' }, '此设备或浏览器不支持 WebGL 2，无法进入三维梦境，但全部纪念内容都可以在这里浏览。'),
        h('nav', { class: 'menu-list', 'aria-label': '档案菜单' },
          h('button', { autofocus: true, onclick: () => this.open('archive') }, '作品档案'),
          h('button', { onclick: () => this.open('timeline') }, '生涯时间线'),
          h('button', { onclick: () => this.open('graph') }, '人物与主题'),
          h('button', { onclick: () => this.open('journal') }, '发现记录'),
          h('button', { onclick: () => this.open('settings') }, '设置'),
          h('button', { onclick: () => this.open('credits') }, '关于本作'),
          !g.noGL && h('button', { onclick: () => (location.href = location.pathname) }, '进入三维梦境'),
        ),
      );
    }
    const el = h('div', { class: 'title-layout', 'data-label': '梦境档案' },
      h('header', { class: 'title-masthead' },
        h('span', { class: 'edition' }, 'A DAVID LYNCH TRIBUTE'),
        h('button', { class: 'title-settings', onclick: () => this.open('settings') }, '声音与设置'),
      ),
      h('div', { class: 'title-main' },
        h('p', { class: 'title-kicker' }, 'AN INTERACTIVE DREAM ARCHIVE'),
        h('h1', { class: 'title-wordmark' }, 'LYNCH', h('span', {}, 'THE DREAM ARCHIVE')),
        h('p', { class: 'title-chinese' }, '梦境档案'),
        h('p', { class: 'title-description' }, '有些房间，需要先听见。', h('br'), '循着声音，找回散落在梦里的三段记忆。'),
        h('div', { class: 'title-actions' },
          h('button', { class: 'enter-dream', autofocus: true, onclick: () => latest ? g.continueFrom(latest.slot) : g.newGame() },
            h('span', {}, latest ? '继续上一个梦' : '进入 · 新的梦'), h('span', { 'aria-hidden': 'true' }, '↗')),
          latest && h('button', { class: 'text-button', onclick: () => g.newGame() }, '开始新的梦'),
          h('button', { class: 'text-button', onclick: () => this.open('saves', 'load') }, '读取存档'),
        ),
        h('p', { class: 'title-headphones' }, '建议佩戴耳机 · 桌面沉浸体验'),
      ),
      h('aside', { class: 'title-scene-note', 'aria-label': '序章场景' }, h('span', {}, '00 / THE WAITING ROOM'), h('p', {}, '等候室'), h('small', {}, '一盏灯。一把椅子。一段尚未醒来的梦。')),
      h('footer', { class: 'title-footer' },
        h('nav', { class: 'title-nav', 'aria-label': '档案导航' },
          h('button', { onclick: () => this.open('archive') }, '01', h('span', {}, '作品档案')),
          h('button', { onclick: () => this.open('timeline') }, '02', h('span', {}, '一生的梦')),
          h('button', { onclick: () => this.open('graph') }, '03', h('span', {}, '人物与母题')),
          h('button', { onclick: () => this.open('credits') }, '04', h('span', {}, '关于本作')),
        ),
        h('div', { class: 'title-colophon' }, h('span', {}, 'IN MEMORY OF DAVID LYNCH · 1946—2025'), h('button', { class: 'text-button', onclick: () => (location.href = '?mode=archive') }, '纯文字档案模式')),
      ),
      mobile && h('p', { class: 'title-mobile-note' }, '触屏：左侧滑动移动，右侧滑动环视，轻点物件调查。也可选择纯文字档案模式。'),
    );
    return el;
  }

  page_pause() {
    const g = this.game;
    const inDream = g.space && g.space.id !== 'redroom';
    return h('div', { class: 'panel narrow', 'data-label': '暂停菜单' },
      h('div', { class: 'brand' }, h('h1', { style: 'font-size:42px' }, '暂停'), h('div', { class: 'sub' }, `${SPACES[g.space?.id]?.title ?? ''} · 已找回 ${g.state.fragments.length}/3 枚碎片`)),
      h('nav', { class: 'menu-list' },
        h('button', { autofocus: true, onclick: () => this.back() }, '继续'),
        h('button', { onclick: () => this.open('saves', 'save') }, '保存进度'),
        h('button', { onclick: () => this.open('saves', 'load') }, '读取存档'),
        h('button', { onclick: () => this.open('archive') }, '档案馆'),
        h('button', { onclick: () => this.open('timeline') }, '生涯时间线'),
        h('button', { onclick: () => this.open('graph') }, '人物与主题'),
        h('button', { onclick: () => this.open('journal') }, '发现记录'),
        h('button', { onclick: () => this.open('library') }, '镜头 · 转场 · 音乐'),
        h('button', { onclick: () => this.open('settings') }, '设置与无障碍'),
        inDream && h('button', { onclick: () => { this.closeAll(); g.setMode('play'); g.story.returnToRoom(); } }, '醒来（返回红房间）'),
        h('button', { onclick: () => { g.autosave(); g.toTitle(); } }, '回到标题（自动存档）'),
      ),
    );
  }

  page_saves(mode) {
    const g = this.game;
    const list = g.saves.list();
    const names = { auto: '自动存档', 1: '槽位一', 2: '槽位二', 3: '槽位三' };
    const card = (s) => {
      const info = s.corrupt ? `存档损坏：${s.error}` : s.empty ? '空' : `${SPACES[s.state.space]?.title} · 碎片 ${s.state.fragments.length}/3\n${fmtDate(s.savedAt)} · 游玩 ${Math.round(s.state.playTime / 60)} 分钟`;
      return h('div', { class: `slot ${s.corrupt ? 'corrupt' : ''}` },
        h('h3', {}, names[s.slot]),
        h('div', { class: 'info', style: 'white-space:pre-line' }, info),
        h('div', { class: 'row' },
          mode === 'save' && s.slot !== 'auto' && h('button', { class: 'btn small primary', onclick: () => { g.saves.save(s.slot, g.snapshot()); this.announce(`已保存到${names[s.slot]}`); this.replace('saves', mode); } }, '保存到此'),
          s.state && h('button', { class: 'btn small', onclick: () => g.continueFrom(s.slot) }, '读取'),
          s.state && h('button', { class: 'btn small', onclick: () => this._download(`redroom-${s.slot}.json`, g.saves.exportSlot(s.slot)) }, '导出'),
          s.slot !== 'auto' && h('button', { class: 'btn small', onclick: () => this._import(s.slot, mode) }, '导入'),
          (s.state || s.corrupt) && h('button', { class: 'btn small', onclick: () => { if (confirm(`删除${names[s.slot]}？`)) { g.saves.remove(s.slot); this.replace('saves', mode); } } }, '删除'),
        ),
      );
    };
    return h('div', { class: 'panel', 'data-label': '存档' },
      this.head(mode === 'save' ? '保存进度' : '读取存档', '存档保存在本机浏览器中；可导出为文件备份'),
      h('div', { class: 'slots' }, list.map(card)),
      h('p', { class: 'foot-note' }, '每个存档带版本号与校验和：旧版本存档会自动迁移，被修改或损坏的存档会被识别并拒绝读取。'),
    );
  }
  _download(name, text) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  _import(slot, mode) {
    const inp = h('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = async () => {
      try {
        this.game.saves.importToSlot(slot, await inp.files[0].text());
        this.announce('导入成功');
      } catch (e) {
        alert(`导入失败：${e.message}`);
      }
      this.replace('saves', mode);
    };
    inp.click();
  }

  page_settings() {
    const g = this.game;
    const s = g.settings;
    const set = (k, v) => g.updateSettings({ [k]: v });
    const range = (k, label, min = 0, max = 1, step = 0.05) => h('label', { class: 'field' }, label, h('input', { type: 'range', min, max, step, value: s[k], oninput: (e) => set(k, +e.target.value), 'aria-label': label }));
    const check = (k, label, desc) => h('label', { class: 'field', title: desc ?? '' }, h('span', {}, label, desc ? h('div', { class: 'src' }, desc) : null), h('input', { type: 'checkbox', checked: !!s[k], onchange: (e) => set(k, e.target.checked) }));
    const select = (k, label, opts) => h('label', { class: 'field' }, label, h('select', { onchange: (e) => set(k, e.target.value) }, Object.entries(opts).map(([v, t]) => h('option', { value: v, selected: s[k] === v }, t))));
    return h('div', { class: 'panel', 'data-label': '设置' },
      this.head('设置与无障碍', '更改立即生效并自动保存'),
      h('div', { class: 'settings' },
        h('fieldset', {}, h('legend', {}, '画面'),
          select('quality', '画质', { auto: '自动（按帧率调整）', low: '低', medium: '中', high: '高' }),
          check('grain', '胶片颗粒'),
          check('highContrast', '高对比度界面'),
          check('reducedMotion', '减少镜头运动', '关闭镜头晃动、推轨变焦、荷兰角与梦境扭曲'),
          check('reducedFlashing', '减少闪烁', '关闭灯光闪烁与负片、雪花类转场'),
          check('showReticle', '显示准星'),
        ),
        h('fieldset', {}, h('legend', {}, '声音'),
          check('muted', '静音（M）'),
          range('masterVolume', '总音量'), range('musicVolume', '音乐'), range('ambienceVolume', '环境音'), range('sfxVolume', '音效'),
          check('monoAudio', '单声道', '适合单侧听力或只用一只耳机'),
        ),
        h('fieldset', {}, h('legend', {}, '字幕'),
          check('subtitles', '显示字幕与声音描述'),
          select('subtitleSize', '字幕大小', { s: '小', m: '中', l: '大' }),
        ),
        h('fieldset', {}, h('legend', {}, '操作'),
          range('lookSensitivity', '视角灵敏度', 0.3, 2.5, 0.1),
          check('invertY', '反转垂直视角'),
          check('archiveAll', '档案全部解锁', '不玩游戏也可以直接浏览全部作品档案'),
        ),
      ),
      h('p', { class: 'foot-note' }, '键盘：WASD/方向键 移动与转向 · PageUp/PageDown 抬头/低头 · Tab/Shift+Tab 切换物件 · E/Enter/空格 交互 · 按住 L 聆听 · M 静音 · Esc 菜单 · F3 性能面板'),
    );
  }

  page_archive(selected) {
    const g = this.game;
    const unlocked = new Set(g.settings.archiveAll || g.archiveOnly ? WORKS.map((w) => w.id) : g.state.archive);
    const sel = WORKS.find((w) => w.id === selected);
    const count = WORKS.filter((w) => unlocked.has(w.id)).length;
    const medium = this._medium;
    const list = WORKS.filter((w) => !medium || mediumOf(w) === medium).sort((x, y) => x.year - y.year);
    const people = sel ? COLLAB.filter(([, ws]) => ws.includes(sel.id)).map(([pid]) => PEOPLE.find((p) => p.id === pid)) : [];
    const spoiler = h('div', { class: 'spoiler' });
    const showPlot = () => spoiler.replaceChildren(
      sel.plot
        ? h('dl', { class: 'plot' }, ...[['setup', '起因'], ['conflict', '主要冲突'], ['turn', '转折'], ['ending', '结局']].flatMap(([k, l]) => [h('dt', {}, l), h('dd', {}, sel.plot[k])]))
        : h('p', { class: 'src' }, '完整剧情回顾（起因 · 冲突 · 转折 · 结局）正在撰写，将按内容规范逐部核对原片与可靠资料后上线。'),
    );
    if (sel) spoiler.append(h('button', { class: 'btn small', onclick: showPlot }, '显示完整剧情（含剧透）'));
    return h('div', { class: 'panel', 'data-label': '档案馆' },
      this.head('档案馆', `已解锁 ${count}/${WORKS.length}${g.archiveOnly ? '' : ' · 在梦境中找回碎片可解锁更多'}`),
      h('div', { class: 'chips', role: 'group', 'aria-label': '按媒介筛选' },
        h('button', { class: `chip ${!medium ? 'on' : ''}`, 'aria-pressed': !medium ? 'true' : 'false', onclick: () => { this._medium = null; this.replace('archive', selected); } }, '全部'),
        Object.entries(MEDIA).map(([k, v]) => h('button', { class: `chip ${medium === k ? 'on' : ''}`, 'aria-pressed': medium === k ? 'true' : 'false', onclick: () => { this._medium = k; this.replace('archive', selected); } }, v)),
      ),
      sel && unlocked.has(sel.id) && h('article', { class: 'detail', 'aria-live': 'polite' },
        h('div', { class: 'y' }, `${sel.year} · ${sel.kind}`),
        h('h3', {}, sel.title),
        h('div', { class: 'o' }, sel.original, ' · ', sel.role),
        sel.warning && h('div', { class: 'warn', role: 'note' }, sel.warning),
        h('div', { class: 'chips' }, sel.themes.map((t) => h('button', { class: 'chip', onclick: () => this.replace('graph', t) }, themeLabel[t]))),
        h('p', {}, h('span', { class: 'src' }, '无剧透介绍　'), sel.summary),
        people.length > 0 && h('div', { class: 'chips' }, h('span', { class: 'src' }, '主要合作者：'), people.map((p) => h('button', { class: 'chip', onclick: () => this.replace('person', p.id) }, p.label))),
        spoiler,
        srcLinks(sel.sources),
      ),
      h('div', { class: 'works' }, list.map((w) => unlocked.has(w.id)
        ? h('button', { class: 'work', onclick: () => this.replace('archive', w.id), 'aria-pressed': w.id === selected ? 'true' : 'false' }, h('span', { class: 'y' }, `${w.year} · ${MEDIA[mediumOf(w)]}`), h('span', { class: 't' }, w.title), h('span', { class: 'o' }, w.original))
        : h('button', { class: 'work locked', disabled: true, 'aria-label': `未解锁作品（${w.year}）` }, h('span', { class: 'y' }, w.year), h('span', { class: 't' }, '？？？'), h('span', { class: 'o' }, '在梦境中找回碎片后解锁')),
      )),
    );
  }

  page_person(id) {
    const p = PEOPLE.find((x) => x.id === id) ?? PEOPLE[0];
    const works = p.center ? WORKS : (COLLAB.find(([pid]) => pid === p.id)?.[1] ?? []).map((wid) => WORKS.find((w) => w.id === wid)).filter(Boolean);
    return h('div', { class: 'panel', 'data-label': `人物档案：${p.label}` },
      this.head('人物档案', '现实中的创作者'),
      h('article', { class: 'detail' }, h('h3', {}, p.label), h('p', {}, p.note),
        h('div', { class: 'chips' }, h('span', { class: 'src' }, '人物：'), PEOPLE.map((x) => h('button', { class: `chip ${x.id === p.id ? 'on' : ''}`, onclick: () => this.replace('person', x.id) }, x.label)))),
      h('div', { class: 'works' }, works.map((w) => h('button', { class: 'work', onclick: () => this.replace('archive', w.id) }, h('span', { class: 'y' }, w.year), h('span', { class: 't' }, w.title), h('span', { class: 'o' }, w.original)))),
    );
  }

  page_journal() {
    const g = this.game;
    const d = g.state.discoveries ?? [];
    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return h('div', { class: 'panel narrow', 'data-label': '发现记录' },
      this.head('发现记录', `已调查 ${d.length} 处 · 碎片 ${g.state.fragments.length}/3`),
      d.length
        ? h('ol', { class: 'journal', style: 'list-style:none;padding:0' }, d.map((x) => h('li', {}, h('span', { class: 't' }, fmt(x.at)), h('span', {}, x.label), h('span', { class: 'src' }, SPACES[x.space]?.title ?? ''))))
        : h('p', { class: 'src' }, '还没有调查过任何物件。'),
      h('div', { class: 'chips', style: 'margin-top:16px' }, Object.values(FRAGMENTS).map((f) => h('span', { class: `chip ${g.state.fragments.includes(f.id) ? 'on' : ''}` }, `${f.glyph} ${f.name}`))),
    );
  }

  page_timeline(filter) {
    const items = TIMELINE.filter((t) => !filter || t.tag === filter);
    const checked = TIMELINE.filter((t) => t.verified === 'checked').length;
    return h('div', { class: 'panel', 'data-label': '生涯时间线' },
      this.head('生涯时间线', `${TIMELINE.length} 条记录 · ${checked} 条已核对来源`),
      h('div', { class: 'chips', role: 'group', 'aria-label': '筛选' },
        h('button', { class: `chip ${!filter ? 'on' : ''}`, onclick: () => this.replace('timeline') }, '全部'),
        Object.entries(TAGS).map(([k, v]) => h('button', { class: `chip ${filter === k ? 'on' : ''}`, onclick: () => this.replace('timeline', k), 'aria-pressed': filter === k ? 'true' : 'false' }, v)),
      ),
      h('ol', { class: 'timeline', style: 'list-style:none;margin:16px 0 0' }, items.map((t) => h('li', { class: 'tl-item' },
        h('div', { class: 'd' }, t.date, ' · ', TAGS[t.tag], h('span', { class: `badge ${t.verified}` }, t.verified === 'checked' ? '已核对' : '待复核')),
        h('div', { class: 'tt' }, t.title),
        t.detail && h('div', { class: 'dd' }, t.detail),
        srcLinks(t.sources),
      ))),
    );
  }

  page_graph(focusId) {
    const graph = buildGraph(WORKS);
    const side = h('div', { class: 'graph-side', 'aria-live': 'polite' }, '点击节点查看关联。拖拽节点、拖动画布、滚轮缩放。');
    const canvas = h('canvas', { id: 'graph-canvas', role: 'img', 'aria-label': `关系图：${graph.nodes.length} 个节点，${graph.edges.length} 条关联。可在右侧列表中用键盘浏览。` });
    const list = h('select', { 'aria-label': '用列表选择节点', onchange: (e) => view.select(e.target.value) },
      h('option', { value: '' }, '— 选择一个节点 —'),
      ['person', 'work', 'theme'].map((type) => h('optgroup', { label: { person: '人物', work: '作品', theme: '主题' }[type] }, graph.nodes.filter((n) => n.type === type).map((n) => h('option', { value: n.id }, n.label)))),
    );
    const el = h('div', { class: 'panel', 'data-label': '人物与主题关联图' },
      this.head('人物与主题', `${graph.nodes.length} 个节点 · ${graph.edges.length} 条关联`),
      h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:#e9c46a' }), '人物'), h('span', {}, h('i', { style: 'background:#d9473f' }), '作品'), h('span', {}, h('i', { style: 'background:#7fb3d5;border-radius:0' }), '主题'), list),
      h('div', { class: 'graph-wrap', style: 'margin-top:12px' }, canvas, side),
    );
    let view;
    requestAnimationFrame(() => {
      view = new GraphView(canvas, graph, (n, nb) => {
        if (!n) return side.replaceChildren('点击节点查看关联。');
        const groups = { person: '人物', work: '作品', theme: '主题' };
        side.replaceChildren(
          h('h3', { style: 'margin:0;font-family:var(--serif);font-weight:400' }, n.label),
          h('div', { class: 'src' }, n.note ?? groups[n.type]),
          n.type === 'person' && h('button', { class: 'btn small', style: 'margin-top:8px', onclick: () => this.replace('person', n.id) }, '人物档案'),
          n.type === 'work' && h('button', { class: 'btn small', style: 'margin-top:8px', onclick: () => this.replace('archive', n.id) }, '作品档案'),
          ...['work', 'person', 'theme'].map((t) => {
            const xs = nb.filter((x) => x.type === t);
            return xs.length ? h('div', { style: 'margin-top:10px' }, h('div', { class: 'src' }, `关联${groups[t]}（${xs.length}）`), h('div', { class: 'chips' }, xs.map((x) => h('button', { class: 'chip', onclick: () => view.select(x.id) }, x.label)))) : null;
          }),
        );
        list.value = n.id;
      });
      if (focusId) view.select(focusId);
      this._cleanup = () => view.destroy();
    });
    return el;
  }

  page_library() {
    const g = this.game;
    const fsm = g.audio.fsm;
    return h('div', { class: 'panel', 'data-label': '镜头、转场与音乐库' },
      this.head('镜头 · 转场 · 音乐', '点击“预览”在当前场景中试播'),
      h('div', { class: 'lib' },
        h('div', {},
          h('h3', {}, '转场'),
          h('table', {}, h('tr', {}, h('th', {}, '名称'), h('th', {}, '时长'), h('th', {}, '减少动态'), h('th', {})),
            Object.entries(TRANSITIONS).map(([k, t]) => h('tr', {}, h('td', {}, t.label), h('td', {}, `${t.duration}s`), h('td', {}, t.safe ? '保留' : '→ 淡入淡出'), h('td', {}, h('button', { class: 'btn small', onclick: () => g.previewTransition(k) }, '预览'))))),
          h('h3', { style: 'margin-top:24px' }, '音乐状态'),
          h('table', {}, h('tr', {}, h('th', {}, '状态'), h('th', {}, '速度'), h('th', {}, '声部层'), h('th', {})),
            Object.entries(STATES).map(([k, st]) => h('tr', {}, h('td', {}, st.label, fsm.state === k ? ' ◀' : ''), h('td', {}, st.bpm), h('td', {}, Object.keys(st.layers).join(' · ') || '—'), h('td', {}, st.kind === 'base' && h('button', { class: 'btn small', onclick: () => { g.audio.fsm._go(k, 'now', 1.5, 'preview'); fsm.base = k; this.replace('library'); } }, '试听'))))),
        ),
        h('div', {},
          h('h3', {}, '镜头'),
          h('table', {}, h('tr', {}, h('th', {}, '镜头'), h('th', {}, '用途'), h('th', {})),
            SHOT_LIBRARY.map(([k, label, use]) => h('tr', {}, h('td', {}, label), h('td', {}, use), h('td', {}, h('button', { class: 'btn small', onclick: () => g.previewShot(k) }, '预览'))))),
        ),
      ),
    );
  }

  page_credits() {
    const g = this.game;
    const done = g.state.chapter === 'epilogue';
    return h('div', { class: 'panel narrow', 'data-label': '关于本作' },
      h('div', { class: 'brand' }, h('h1', { style: 'font-size:46px' }, done ? '回声' : '关于'), h('div', { class: 'tribute' }, '致大卫·林奇（1946.1.20 – 2025.1.16）')),
      h('div', { style: 'line-height:1.9;font-size:14px;color:#d8cdb8' },
        done && h('p', { style: 'font-family:var(--serif);font-size:17px;color:var(--paper)' }, '全部档案已经解锁。房间还在，随时可以回来。'),
        h('p', {}, '《红房间》是一部非官方的致敬作品。所有三维模型、着色器、音乐与音效都由本项目原创，在浏览器中实时生成，没有使用任何影片画面、剧照、原声录音或台词。'),
        h('p', {}, '作品档案与时间线由编辑整理，每条都标注了来源编号；带“待复核”标记的条目需要在公开发布前对照原始来源核实。'),
        h('p', {}, '“双峰”“穆赫兰道”等名称及相关商标归各自权利人所有，本作仅在评论与介绍的语境中提及。'),
      ),
      h('nav', { class: 'menu-list', style: 'margin-top:20px' },
        done && h('button', { autofocus: true, onclick: () => { this.closeAll(); g.setMode('play'); } }, '留在房间里'),
        h('button', { onclick: () => this.replace('archive') }, '打开档案馆'),
        h('button', { onclick: () => (this.stack.length > 1 ? this.back() : g.toTitle()) }, '返回'),
      ),
    );
  }
}
