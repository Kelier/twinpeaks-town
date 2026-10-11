// 端到端测试：无头 Chromium（SwiftShader 软件渲染）驱动完整通关流程，记录错误、性能、可访问性与截图。
// 用法：先 `npm run build && npm run preview -- --port 5190`，再 `node scripts/e2e.mjs [url]`
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const URL_ = process.argv[2] ?? 'http://localhost:5190/';
const OUT = path.resolve('docs/screens');
fs.mkdirSync(OUT, { recursive: true });
const report = { url: URL_, startedAt: new Date().toISOString(), steps: [], errors: [], warnings: [], perf: {}, a11y: {}, ok: true };
const axeSrc = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/local/bin/chromium',
  headless: 'new',
  protocolTimeout: 600000,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,720'],
});
const page = await browser.newPage();
const VW = +(process.env.E2E_W ?? 1280), VH = Math.round(VW * 9 / 16);
await page.setViewport({ width: VW, height: VH });
// 软件渲染环境下用低画质跑功能流程；画质档位的帧率单独在后面的步骤里测
if (process.env.E2E_QUALITY) await page.evaluateOnNewDocument((q) => localStorage.setItem('redroom.settings.v1', JSON.stringify({ quality: q })), process.env.E2E_QUALITY);
page.on('console', (m) => {
  if (m.type() === 'error') report.errors.push(m.text());
  else if (m.type() === 'warning') report.warnings.push(m.text());
});
page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = async (name, fn) => {
  const t0 = Date.now();
  try {
    const r = await fn();
    report.steps.push({ name, ok: true, ms: Date.now() - t0, ...(r && typeof r === 'object' ? { result: r } : {}) });
    console.log('✓', name, r ? JSON.stringify(r) : '');
  } catch (e) {
    report.ok = false;
    report.steps.push({ name, ok: false, ms: Date.now() - t0, error: String(e.message ?? e) });
    console.log('✗', name, e.message);
  }
};
const shot = (name) => process.env.E2E_SHOTS === '0' ? Promise.resolve() : page.screenshot({ path: path.join(OUT, `${name}.png`) });
const G = (fn, ...args) => page.evaluate(fn, ...args);
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const SLOW = +(process.env.E2E_SLOW ?? 3); // 共享 / 软件渲染环境下放宽超时
const waitFor = async (fn, ms = 20000, ...args) => {
  ms *= SLOW;
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await G(fn, ...args)) return true;
    await sleep(200);
  }
  const st = await G(() => { const g = window.__redroom; return g ? { mode: g.mode, busy: g.busy, space: g.space?.id, chapter: g.state?.chapter, dialog: !!g.ui?.dialogQueue } : null; }).catch(() => null);
  throw new Error('等待超时：' + fn.toString().slice(0, 80) + ' 当前状态：' + JSON.stringify(st));
};
const perf = async (label, ms = 4000) => {
  await sleep(ms);
  const p = await G(() => ({ ...window.__redroom.engine.perf, samples: undefined, q: window.__redroom.engine.qualityName }));
  report.perf[label] = { fps: +p.fps.toFixed(1), avgMs: +p.avgMs.toFixed(1), worstMs: +(p.lastWorst ?? 0).toFixed(1), drawCalls: p.calls, triangles: p.tris, quality: p.q, cpuMs: +(p.cpuMs ?? 0).toFixed(2) };
  return report.perf[label];
};
const axe = async (label) => {
  await page.evaluate(axeSrc);
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document.querySelector('#menu-root') ?? document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] });
    return { violations: res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), passes: res.passes.length };
  });
  report.a11y[label] = r;
  return { violations: r.violations.length, passes: r.passes };
};
// 自动推进对白
const autoDialog = () => G(() => {
  clearInterval(window.__pump);
  window.__pump = setInterval(() => { const ui = window.__redroom.ui; if (ui.dialogQueue) { ui._lineAt = 0; ui._advance(); } }, 250);
});

await step('加载页面与标题画面', async () => {
  const t0 = Date.now();
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await waitFor(() => window.__redroom && document.querySelector('.menu.title'), 40000);
  report.perf.loadMs = Date.now() - t0;
  await sleep(3000);
  await shot('01-title');
  return { loadMs: report.perf.loadMs };
});
await step('可访问性扫描：标题菜单', () => axe('title'));
await step('性能：标题画面（红房间背景）', () => perf('title', 2000));

await step('开始新游戏 → 序章推镜 → 第一章', async () => {
  await page.evaluate(() => [...document.querySelectorAll('.menu button')].find((b) => b.textContent.includes('新的梦')).click());
  await waitFor(() => window.__redroom.ui.dialogQueue, 20000);
  await sleep(500);
  await shot('02-intro-dialog');
  await autoDialog();
  await waitFor(() => window.__redroom.state.chapter === 'ch1' && window.__redroom.mode === 'play', 20000);
  await sleep(2500);
  await shot('03-redroom');
  return { chapter: await G(() => window.__redroom.state.chapter), music: await G(() => window.__redroom.audio.fsm.state) };
});
await step('性能：红房间', () => perf('redroom'));

await step('键盘交互：Tab 循环聚焦 + E 关灯 → 音乐进入“不安”', async () => {
  await G(() => window.__redroom.state.flags.armchair = false);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    await sleep(700);
    const f = await G(() => window.__redroom.interaction.focused?.id);
    if (f === 'lamp') break;
  }
  const focused = await G(() => window.__redroom.interaction.focused?.id);
  assert(focused === 'lamp', '未能通过 Tab 聚焦到落地灯，当前：' + focused);
  await sleep(900);
  await page.keyboard.press('KeyE');
  await sleep(2500);
  const s = await G(() => ({ lamp: window.__redroom.spaces.redroom.lampOn, music: window.__redroom.audio.fsm.state, live: document.querySelector('#sr-live').textContent }));
  assert(!s.lamp && s.music === 'tension', '关灯或音乐切换失败 ' + JSON.stringify(s));
  await shot('04-lamp-off');
  await page.keyboard.press('KeyE');
  await sleep(1500);
  return s;
});

await step('第一章：查看扶手椅（坐下镜头）与雕像 → 第二章', async () => {
  await G(() => window.__redroom.story.armchair());
  await waitFor(() => window.__redroom.state.flags.armchair && !window.__redroom.busy, 30000);
  await G(() => window.__redroom.story.statue());
  await waitFor(() => window.__redroom.state.chapter === 'ch2', 30000);
  await sleep(4500);
  return { chapter: await G(() => window.__redroom.state.chapter) };
});

await step('第二章：关灯后三道缝隙各自发声；按住 L 聆听，近处缝隙变亮', async () => {
  await G(() => { if (window.__redroom.spaces.redroom.lampOn) return window.__redroom.story.toggleLamp(); });
  await waitFor(() => !window.__redroom.busy, 20000);
  await sleep(1500);
  const sounds = await G(() => Object.keys(window.__redroom.spaces.redroom.portalSounds ?? {}));
  assert(sounds.length === 3, '缝隙声音数量不对 ' + sounds);
  const before = await G(() => Object.fromEntries(Object.entries(window.__redroom.spaces.redroom.portals).map(([k, p]) => [k, +p.open.toFixed(2)])));
  // 走到左侧幕布附近并按住 L
  await G(() => { const c = window.__redroom.camera; c.pos.set(-1.9, 1.6, -0.4); c.yaw = Math.PI / 2; });
  await page.keyboard.down('KeyL');
  await sleep(2500);
  const listening = await G(() => window.__redroom.audio.listening);
  const after = await G(() => Object.fromEntries(Object.entries(window.__redroom.spaces.redroom.portals).map(([k, p]) => [k, +p.open.toFixed(2)])));
  await shot('05-listen-portal');
  await page.keyboard.up('KeyL');
  assert(listening, '聆听未生效');
  assert(after.highway > 0.8 && after.highway > before.highway, '靠近并聆听后缝隙未变亮 ' + JSON.stringify({ before, after }));
  return { sounds, before, after, listening };
});

await step('梦境 A · 夜路：三块路牌 → 录像带', async () => {
  await G(() => window.__redroom.story.portal('highway'));
  await waitFor(() => window.__redroom.space.id === 'highway' && !window.__redroom.busy, 20000);
  await sleep(1500);
  await shot('06-highway');
  report.perf.highway = await perf('highway', 2500);
  for (let i = 0; i < 3; i++) {
    await waitFor((i) => window.__redroom.spaces.highway.stopped && window.__redroom.spaces.highway.markerIndex === i, 30000, i);
    if (i === 2) await shot('07-highway-tape');
    await G((i) => window.__redroom.story.marker(i), i);
    await sleep(500);
  }
  await waitFor(() => window.__redroom.space.id === 'redroom' && !window.__redroom.busy, 30000);
  return { fragments: await G(() => window.__redroom.state.fragments) };
});

await step('梦境 B · 寂静剧场：麦克风 → 蓝色钥匙', async () => {
  await G(() => window.__redroom.story.portal('theater'));
  await waitFor(() => window.__redroom.space.id === 'theater' && !window.__redroom.busy && window.__redroom.mode === 'play', 25000);
  await sleep(1500);
  await shot('08-theater');
  await perf('theater', 2500);
  await G(() => window.__redroom.story.theaterMic());
  await waitFor(() => window.__redroom.spaces.theater.box.visible && window.__redroom.mode === 'play', 30000);
  await sleep(800);
  await shot('09-theater-box');
  await G(() => window.__redroom.story.theaterBox());
  await waitFor(() => window.__redroom.space.id === 'redroom' && !window.__redroom.busy, 30000);
  return { fragments: await G(() => window.__redroom.state.fragments) };
});

await step('梦境 C · 散热器之室：错误顺序被重置，正确顺序解开 → 种子', async () => {
  await G(() => window.__redroom.story.portal('radiator'));
  await waitFor(() => window.__redroom.space.id === 'radiator' && !window.__redroom.busy && window.__redroom.mode === 'play', 25000);
  await sleep(1500);
  await shot('10-radiator');
  await perf('radiator', 2500);
  await G(() => window.__redroom.story.valve(1));
  await waitFor(() => window.__redroom.mode === 'play', 10000);
  const afterWrong = await G(() => window.__redroom.spaces.radiator.order.length);
  assert(afterWrong === 0, '错误顺序未重置');
  for (const v of [0, 2, 1]) {
    await G((v) => window.__redroom.story.valve(v), v);
    await waitFor(() => window.__redroom.mode === 'play' && !window.__redroom.busy, 15000);
    await sleep(400);
  }
  assert(await G(() => window.__redroom.state.flags.radiatorSolved), '谜题未解开');
  await shot('11-radiator-stage');
  await G(() => window.__redroom.story.radiatorSeed());
  await waitFor(() => window.__redroom.space.id === 'redroom' && window.__redroom.state.chapter === 'finale', 40000);
  return { fragments: await G(() => window.__redroom.state.fragments), chapter: await G(() => window.__redroom.state.chapter) };
});

await step('存档：写入槽位一 → 刷新页面 → 列表中可读取并校验', async () => {
  await waitFor(() => !window.__redroom.busy && window.__redroom.mode === 'play', 20000);
  await G(() => window.__redroom.saves.save('1', window.__redroom.snapshot()));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  await waitFor(() => window.__redroom && document.querySelector('.menu.title'), 40000);
  const list = await G(() => window.__redroom.saves.list().map((s) => ({ slot: s.slot, frags: s.state?.fragments.length, corrupt: !!s.corrupt, empty: !!s.empty })));
  assert(list.find((s) => s.slot === '1').frags === 3, '槽位一未正确保存');
  // 篡改检测
  const tamper = await G(() => {
    const k = 'redroom.save.2';
    const raw = JSON.parse(localStorage.getItem('redroom.save.1'));
    raw.body = raw.body.replace('"playTime":', '"playTime":9');
    localStorage.setItem(k, JSON.stringify(raw));
    return window.__redroom.saves.list().find((s) => s.slot === '2');
  });
  assert(tamper.corrupt, '篡改的存档未被识别');
  await G(() => localStorage.removeItem('redroom.save.2'));
  await page.evaluate(() => [...document.querySelectorAll('.menu button')].find((b) => b.textContent.includes('继续')).click());
  await waitFor(() => window.__redroom.mode === 'play' && !window.__redroom.busy && window.__redroom.state.fragments.length === 3, 20000);
  return { list, tamperDetected: tamper.corrupt };
});

await step('终章：放回三枚碎片 → 俯拍 / 环绕 → 留在变化后的红房间（无名单），出口出现', async () => {
  await autoDialog();
  await sleep(1500);
  await G(() => window.__redroom.story.statue());
  await sleep(9000);
  await shot('12-finale');
  await waitFor(() => window.__redroom.state.chapter === 'epilogue' && window.__redroom.mode === 'play' && !window.__redroom.busy, 60000);
  await sleep(3500);
  await shot('13-epilogue-room');
  const r = await G(() => ({ chapter: window.__redroom.state.chapter, archive: window.__redroom.state.archive.length, menuOpen: !!document.querySelector('.menu'), exit: +window.__redroom.spaces.redroom.exitMat.opacity.toFixed(2) }));
  assert(!r.menuOpen, '终章后不应弹出名单页');
  assert(r.exit > 0.5, '出口未出现');
  return r;
});

await step('小镇支线：三个地点调查 → 记忆记录 → 返回红房间', async () => {
  await G(() => window.__redroom.story.tv());
  assert(await G(() => window.__redroom.space.id === 'town'), '电视没有进入小镇');
  await shot('town');
  for (const id of ['coffee', 'ledger', 'radio']) {
    await G((id) => window.__redroom.spaces.town.investigate(id), id);
  }
  assert(await G(() => window.__redroom.state.flags.townComplete), '小镇未完成');
  const count = await G(() => window.__redroom.state.discoveries.filter(d => d.id.startsWith('town:')).length);
  assert(count === 3, '小镇线索未写入发现记录');
  await G(() => window.__redroom.story.returnToRoom());
  return { clues: count, returned: await G(() => window.__redroom.space.id) };
});

await step('尾声：走出幕布 → 致敬黑场 → 回到标题', async () => {
  await G(() => { window.__redroom.story.leave(); });
  await waitFor(() => document.querySelector('.end-card'), 20000);
  await sleep(1500);
  await shot('14-end-card');
  await waitFor(() => document.querySelector('.menu.title'), 20000);
  return {};
});

await step('界面页面：档案馆 / 时间线 / 关系图 / 设置 / 镜头库 截图与扫描', async () => {
  await G(() => { const ui = window.__redroom.ui; ui.closeAll(); ui.open('archive', 'mulholland'); });
  await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll('.spoiler button')][0]?.click());
  await sleep(600);
  await shot('14-archive');
  const a1 = await axe('archive');
  await G(() => window.__redroom.ui.replace('timeline'));
  await sleep(600);
  await shot('15-timeline');
  const a2 = await axe('timeline');
  await G(() => window.__redroom.ui.replace('graph', 'badalamenti'));
  await sleep(3500);
  await shot('16-graph');
  const a3 = await axe('graph');
  await G(() => window.__redroom.ui.replace('settings'));
  await sleep(500);
  await shot('17-settings');
  const a4 = await axe('settings');
  await G(() => window.__redroom.ui.replace('library'));
  await sleep(500);
  await shot('18-library');
  const a5 = await axe('library');
  await G(() => window.__redroom.ui.replace('saves', 'save'));
  await sleep(500);
  await shot('19-saves');
  const a6 = await axe('saves');
  await G(() => window.__redroom.ui.replace('journal'));
  await sleep(500);
  await shot('19b-journal');
  const a7 = await axe('journal');
  return { archive: a1, timeline: a2, graph: a3, settings: a4, library: a5, saves: a6, journal: a7, discoveries: await G(() => window.__redroom.state.discoveries.length) };
});

await step('减少闪烁：闪烁类转场降级为淡入淡出', async () => {
  const r = await G(() => {
    const g = window.__redroom;
    g.updateSettings({ reducedFlashing: true });
    const a = g.transitions.resolve('static')[0];
    const b = g.transitions.resolve('invert')[0];
    const c = g.transitions.resolve('curtain')[0];
    g.updateSettings({ reducedFlashing: false });
    return { static: a, invert: b, curtain: c };
  });
  assert(r.static === 'fade' && r.invert === 'fade' && r.curtain === 'curtain', JSON.stringify(r));
  return r;
});

await step('画质档位切换：低 / 中 / 高 各自帧率', async () => {
  await G(() => { window.__redroom.ui.closeAll(); window.__redroom.setMode('play'); });
  const out = {};
  for (const q of ['low', 'medium', 'high']) {
    await G((q) => window.__redroom.updateSettings({ quality: q }), q);
    out[q] = await perf(`quality-${q}`, 3500);
  }
  await G(() => window.__redroom.updateSettings({ quality: 'auto' }));
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.fps]));
});

await step('移动端视口（390×844）标题与 HUD', async () => {
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await sleep(1500);
  await shot('20-mobile');
  await G(() => window.__redroom.ui.open('title'));
  await sleep(800);
  await shot('21-mobile-title');
  return {};
});

await step('档案模式（脱离 3D）：直接链接打开作品与时间线', async () => {
  await page.setViewport({ width: VW, height: VH });
  await page.goto(URL_ + '?mode=archive#/archive/films/fwwm', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await waitFor(() => window.__redroom?.archiveOnly && document.querySelector('.menu.archive'));
  await sleep(500);
  const r = await G(() => ({ hasCanvasEngine: !!window.__redroom.engine, warning: !!document.querySelector('.detail .warn'), title: document.querySelector('.detail h3')?.textContent, total: document.querySelectorAll('.work').length }));
  assert(!r.hasCanvasEngine && r.warning && r.total >= 27, JSON.stringify(r));
  await shot('22-archive-mode');
  const a = await axe('archive-mode');
  await page.goto(URL_ + '?mode=archive#/life', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await waitFor(() => document.querySelector('.menu.timeline'));
  await page.goto(URL_ + '?mode=archive#/archive/people/badalamenti', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await waitFor(() => document.querySelector('.menu.person'));
  await shot('23-person');
  return { ...r, axe: a };
});

report.mem = await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 180000 }).then(() => sleep(2000)).then(() => G(() => (performance.memory ? { usedMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) } : null)));
report.gl = await G(() => { const r = window.__redroom.engine.renderer; const gl = r.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
report.finishedAt = new Date().toISOString();
fs.writeFileSync('docs/e2e-report.json', JSON.stringify(report, null, 2));
console.log(`\n结果：${report.steps.filter((s) => s.ok).length}/${report.steps.length} 通过，控制台错误 ${report.errors.length} 条`);
await browser.close();
process.exit(report.ok ? 0 : 1);
