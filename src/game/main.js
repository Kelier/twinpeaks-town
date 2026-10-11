// 双峰 · 小小梦魇 —— a 2.5D puppet-theatre tribute. Entry: loading, input, camera, dialogue, story graph, saving.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRenderer, createComposer, TEX } from './gfx.js';
import { Sound } from './audio.js';
import { Player } from './player.js';
import { World } from './world.js';
import { dressStage } from './immersion.js';
import { LEVELS } from './levels.js';
import { ORDER, NEXT, CROSSROADS, CLUES, ENDINGS, EPISODES, newStory, endingFor, insight } from './story.js';
import { t, tx, T, LANGS, getLang, setLang, onLang } from './i18n.js';
import { mountTitleRoom } from './title-room.js';
import { musicControl, paintMusic, toggleMusic } from './bgm.js';
import './game.css';
import './theme.css';
import { mountTouch } from './touch-controls.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <div id="stage"></div>
  <div id="hud">
    <div class="prompt" hidden><kbd>E</kbd><span></span></div>
    <p class="subtitle" aria-live="polite"></p>
    <p class="hint"></p>
    <p class="clue-toast"></p>
    <div class="card" hidden><small></small><h2></h2></div>
    <div class="dread"></div>
  </div>
  <section id="dialog" hidden><b class="who"></b><p class="line"></p><ol class="choices"></ol><span class="more">▼</span></section>
  <section id="title">
    <div class="title-art"><img src="/themes/red-room-miniature.webp" alt="" fetchpriority="high" /></div>
    <header class="title-top"><span class="wordmark">双峰 · 梦境剧场</span><button data-act="library" class="quiet-button">${T('档案与设置','Archive & settings')}</button></header>
    <div class="title-inner">
      <h1>双峰<span>TWIN PEAKS</span></h1>
      <p class="title-copy">${T('有些梦，从未醒来。','Some dreams never end.')}</p>
      <p class="loading" data-t="loading"></p>
      <div class="menu" hidden>
        <button data-act="new" data-t="start"></button>
        <button data-act="continue" hidden><b data-t="continue"></b><em></em></button>
      </div>
<div class="title-music">${musicControl()}<p>Julee Cruise — Falling</p></div>
    </div>
    <footer class="title-footer"><span>${T('献给大卫·林奇','For David Lynch')}<small>1946 — 2025</small></span><button data-act="help" class="quiet-button">${T('如何游玩','How to play')}</button><span class="footer-note">${T('非官方互动致敬','An unofficial interactive tribute')}</span></footer>
  </section>
  <section id="library" hidden aria-label="${T('档案与设置','Archive and settings')}">
    <button class="panel-close quiet-button" data-act="close-library">${T('返回','Back')} <span aria-hidden="true">×</span></button>
    <h2>${T('梦境档案','The dream archive')}</h2>
    <p>${T('在故事之外，再多停留片刻。','Stay a little longer, beyond the story.')}</p>
    <div class="extras">
      <button data-act="guide-lynch" data-t="guideLynch"></button>
      <button data-act="guide-fwwm" data-t="guideFwwm"></button>
      <span class="langs" role="group"></span>
    </div>
    <details id="help"><summary>${T('操作说明','Controls')}</summary><p class="keys" data-t="keys"></p><p>${T('手机：左侧方向键移动，右侧跳跃与互动。按住「互动 / 抓取」拖动道具，同时按方向键。','On touch screens, move with the left controls. Jump and interact on the right. Hold Use and a direction to drag objects.')}</p></details>
  </section>
  <button id="pause-toggle" data-act="pause" aria-label="${T('暂停游戏','Pause game')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg></button>
  <section id="pause" hidden>
    <h2 data-t="intermission"></h2>
    <div class="program"></div>
    <div class="pause-music">${musicControl()}</div>
    <div class="pause-buttons">
      <button data-act="resume" data-t="resume"></button>
      <button data-act="restart" data-t="restart"></button>
      <button data-act="mute"></button>
      <button data-act="guide-lynch" data-t="guideLynch"></button>
      <button data-act="guide-fwwm" data-t="guideFwwm"></button>
      <span class="langs" role="group"></span>
      <button data-act="quit" data-t="quit"></button>
    </div>
  </section>
  <section id="ending" hidden></section>`;

const $ = (s) => app.querySelector(s);
// ---------------- language ----------------
function paintUI() {
  app.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
  app.querySelectorAll('.langs').forEach((g) => { g.innerHTML = Object.entries(LANGS).map(([k, v]) => `<button data-lang="${k}" class="${k === getLang() ? 'on' : ''}" aria-pressed="${k === getLang()}">${v}</button>`).join(''); });
  $('[data-act=mute]').textContent = (sound.muted ? T('环境音效 · 关闭','Effects · off') : T('环境音效 · 开启','Effects · on'));
  const cont = $('[data-act=continue] em'); if (cont && LEVELS[saved.id]) cont.textContent = tx(LEVELS[saved.id].name);
  if (G.state === 'paused') $('#pause .program').innerHTML = program();
  paintMusic();
  $('.title-copy').textContent=T('有些梦，从未醒来。','Some dreams never end.');
  $('[data-act=library]').textContent=T('档案与设置','Archive & settings');
  $('[data-act=help]').textContent=T('如何游玩','How to play');

  document.title = getLang() === 'zh' ? '双峰 · 小小梦魇' : 'Twin Peaks · Little Nightmare';
}
onLang(paintUI);
// overlays (guide book, soundtrack shelf) swallow the game's keys while open
let overlay = null;
function openOverlay(kind) {
  if (overlay) return;
  const done = () => { overlay = null; };
  overlay = { close: () => { } };
  import('./guide.js').then((m) => { overlay.close = m.openGuide(kind, { onClose: done }); }).catch((e) => { console.error(e); done(); });
}
try { localStorage.removeItem('tp-visual-theme'); } catch {}
const renderer = createRenderer($('#stage'));
renderer.domElement.id = 'velvet-stage';
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, .1, 220);
const { composer, finish } = createComposer(renderer, new THREE.Scene(), camera);
const sound = new Sound();
let titleRoom;
const SAVE = 'tp-little-nightmare-v3';
let saved = (() => { try { return JSON.parse(localStorage.getItem(SAVE)) || {}; } catch { return {}; } })();

// ---------------- input ----------------
const keys = new Set(); const pressed = new Set();
addEventListener('keydown', (e) => { if(e.code === 'Space' && e.target.closest?.('button')) return; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); if (!keys.has(e.code)) pressed.add(e.code); keys.add(e.code); onKey(e); });
addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'KeyE') interactHeldBlock = false; });
addEventListener('blur', () => keys.clear());
let interactHeldBlock = false;
mountTouch(app, { press(code) { if(overlay)return; if(!keys.has(code))pressed.add(code); keys.add(code);onKey({code}); }, release(code) {keys.delete(code);if(code==='KeyE')interactHeldBlock=false;} });
const input = () => ({
  x: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
  z: (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0),
  run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  jumpPressed: pressed.has('Space'), jumpHeld: keys.has('Space'),
  grab: keys.has('KeyE') && !interactHeldBlock,
});

// ---------------- state ----------------
const G = { state: 'loading', level: null, id: null, world: null, scene: null, player: null, models: { cast: {}, sets: {} }, flags: {}, story: newStory(), checkpoint: 0, t: 0, dread: 0, shake: 0, focus: null };
const cam = { x: 0, y: 2.4, z: 15, look: new THREE.Vector3() };
const hud = { sub: $('.subtitle'), hint: $('.hint'), card: $('.card'), prompt: $('.prompt'), dread: $('.dread'), clue: $('.clue-toast') };
let subTimer, hintTimer, clueTimer;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let readyResolve; let readyP = new Promise((r) => (readyResolve = r));

// ---------------- dialogue ----------------
const dlg = { el: $('#dialog'), who: $('#dialog .who'), line: $('#dialog .line'), choices: $('#dialog .choices'), resolve: null, sel: 0, opts: null };
function openDialog() { dlg.el.hidden = false; requestAnimationFrame(() => dlg.el.classList.add('on')); }
function closeDialog() { dlg.el.classList.remove('on'); dlg.el.hidden = true; dlg.choices.innerHTML = ''; }
function line(who, text, { focus, zoom = 2.6 } = {}) {
  if (focus) ctx.focus(focus, zoom);
  openDialog(); dlg.who.textContent = who || ''; dlg.line.textContent = ''; dlg.choices.innerHTML = ''; dlg.el.classList.remove('choosing');
  let i = 0; const chars = [...text];
  dlg.typing = setInterval(() => { dlg.line.textContent += chars[i++] ?? ''; if (i % 3 === 0) sound.noise({ dur: .02, freq: 2400, q: 6, gain: .02 }); if (i >= chars.length) { clearInterval(dlg.typing); dlg.typing = null; } }, 32);
  return new Promise((res) => { dlg.resolve = () => { if (dlg.typing) { clearInterval(dlg.typing); dlg.typing = null; dlg.line.textContent = text; return false; } res(); return true; }; });
}
function choice(prompt, options, who = '') {
  openDialog(); dlg.who.textContent = who; dlg.line.textContent = prompt; dlg.el.classList.add('choosing');
  dlg.sel = 0; dlg.opts = options;
  dlg.choices.innerHTML = options.map((o, i) => `<li><button data-choice="${i}">${o.text ?? o}</button></li>`).join('');
  paintChoice();
  return new Promise((res) => { dlg.resolve = (i = dlg.sel) => { res(i); return true; }; });
}
function paintChoice() { [...dlg.choices.querySelectorAll('button')].forEach((b, i) => b.classList.toggle('sel', i === dlg.sel)); }
async function talk(script) {
  const prev = G.state; G.state = 'dialog'; G.player.mode = 'locked'; G.player.lockAnim = 'idle';
  try { return await script(); } finally { closeDialog(); ctx.focus(null); G.state = prev === 'dialog' ? 'play' : prev; if (G.player.mode === 'locked') G.player.mode = 'normal'; persist(); }
}

const ctx = {
  sound, models: G.models, wait,
  get ready() { return readyP; }, get flags() { return G.flags; }, get story() { return G.story; },
  say(text, ms = 3000, who) { clearTimeout(subTimer); hud.sub.innerHTML = (who ? `<b>${who}</b>` : '') + text; hud.sub.classList.add('on'); subTimer = setTimeout(() => hud.sub.classList.remove('on'), ms); },
  hint(text, ms = 4000) { clearTimeout(hintTimer); hud.hint.textContent = text; hud.hint.classList.add('on'); hintTimer = setTimeout(() => hud.hint.classList.remove('on'), ms); },
  line, choice, talk,
  clue(key) {
    if (G.story.clues[key]) return; G.story.clues[key] = true; sound.pickup();
    clearTimeout(clueTimer); hud.clue.innerHTML = `<small>${t('clue')} · ${insight(G.story)}</small>${CLUES[key]?.() || key}`; hud.clue.classList.add('on');
    clueTimer = setTimeout(() => hud.clue.classList.remove('on'), 4200); persist();
  },
  pick(key, value) { G.story.picks[key] = value; persist(); },
  next: (id) => nextLevel(id),
  goto: (id) => nextLevel(id, true),
  caught: (why) => caught(why),
  checkpoint: (i) => { G.checkpoint = i; },
  focus: (v, zoom = 1.5) => { G.focus = v ? { v: v.clone(), zoom } : null; },
  dim: (on) => { G.dim = on ? .45 : 0; },
  blackout: async (on, speed = .08) => { G.fadeTarget = on ? 0 : 1; G.fadeSpeed = speed; },
  shake: (a) => { G.shake = a; },
  setDread: (v) => { G.dread = v; },
  camJump: (dx, snap) => { if (snap) cam.x = G.player.pos.x; else cam.x += dx; },
  dropGrab: () => { if (G.player) G.player.grabbed = null; interactHeldBlock = true; },
  ending: (opts = {}) => ending(endingFor(G.story, opts)),
  save: () => setTimeout(persist, 50),
};

// ---------------- assets (loaded per chapter) ----------------
const loader = new GLTFLoader();
const cache = new Map();
const load = (path) => { if (!cache.has(path)) cache.set(path, loader.loadAsync(path).catch((e) => { cache.delete(path); throw e; })); return cache.get(path); };
async function loadCast(id) {
  if (G.models.cast[id]) return G.models.cast[id];
  const g = await load(`./game/cast/${id}.glb`).catch(() => load(`./game/${id}.glb`)).catch(() => null);
  if (g) { G.models.cast[id] = g; } return g;
}
async function ensureAssets(L) {
  const ids = ['cooper', ...(L.cast || [])];
  const [cast, set] = await Promise.all([Promise.all(ids.map(loadCast)), L.set ? load(`./game/sets/${L.set}.glb`).catch(() => null) : null]);
  G.models.cooper = cast[0]; G.models.bob = G.models.cast.bob; G.models.laura = G.models.cast.laura;
  if (L.set) G.models.sets[L.set] = set;
}

// ---------------- saving ----------------
const hasSave = () => saved.id && LEVELS[saved.id] && (saved.id !== ORDER[0] || !!saved.pos || saved.story?.visited?.length > 1);
function persist() {
  if (!G.world || G.state !== 'play' || !G.player || G.player.mode !== 'normal' || !G.player.onGround) return;
  saved = { id: G.id, story: G.story, flags: G.flags, checkpoint: G.checkpoint, pos: G.player.pos.toArray(),
    movables: G.world.movables.map((m) => [...m.mesh.position.toArray(), m.locked ? 1 : 0]),
    ints: G.world.interactables.map((it) => (it.enabled ? 1 : 0)), trig: G.world.triggers.map((t) => (t.done ? 1 : 0)), t: Date.now() };
  try { localStorage.setItem(SAVE, JSON.stringify(saved)); } catch { }
}
setInterval(persist, 1500);
addEventListener('pagehide', persist); addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

// ---------------- proscenium: a velvet arch fixed to the camera, so every room reads as a stage ----------------
function proscenium() {
  const g = new THREE.Group();
  const tex = TEX.velvetFold();
  const m = new THREE.MeshBasicMaterial({ map: tex, color: '#3a0608', fog: false });
  const valance = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .22), m); valance.position.set(0, .62, -2); g.add(valance);
  for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.PlaneGeometry(.26, 1.6), m); leg.position.set(sx * 1.23, 0, -2); g.add(leg); }
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .1), new THREE.MeshBasicMaterial({ color: '#050303', fog: false })); apron.position.set(0, -.6, -2); g.add(apron);
  g.traverse((o) => { if (o.isMesh) { o.renderOrder = 50; o.material.depthTest = false; } });
  return g;
}
const arch = proscenium(); camera.add(arch);
function fitArch() {
  arch.visible = innerWidth >= innerHeight;
  const h = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2, w = h * camera.aspect;
  arch.children[0].position.y = h - .05; arch.children[0].scale.x = w;                 // valance
  arch.children[1].position.x = -w + .06; arch.children[2].position.x = w - .06;       // legs
  arch.children[3].position.y = -h + .02; arch.children[3].scale.x = w;
}

// Ambient room tone remains separate from the explicitly enabled Falling track.
async function syncMusic() {
  const cue = G.cue; if (!cue) return;
  const kind = cue === 'title' ? 'title' : LEVELS[cue]?.ambience;
  sound.ambience(kind, { noMusic: true });
}

// ---------------- chapters ----------------
function disposeScene(s) {
  const materials=new Set();
  s?.traverse(o=>{o.geometry?.dispose?.();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));o.shadow?.dispose?.();});
  materials.forEach(m=>m.dispose());
}

async function buildLevel(id, { title = false, restore = null } = {}) {
  const L = LEVELS[id]; await ensureAssets(L);
  disposeScene(G.scene);
  G.id = id; G.level = L;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#000000');
  scene.fog = new THREE.FogExp2(L.fog[0], L.fog[1]); scene.add(camera);
  const world = new World(scene); G.world = world; G.scene = scene;
  G.player = new Player(G.models.cooper, sound); scene.add(G.player.root); G.player.pos.copy(L.spawn);
  const follow = new THREE.PointLight('#ffe2c4', 3, 3.2, 1.8); follow.position.set(.4, 1.9, .9); G.player.root.add(follow);
  // theatre follow-spot: lands on whoever is speaking
  G.followSpot = new THREE.SpotLight('#fff0dc', 0, 26, .2, .5, 1.2); G.followSpot.position.set(0, 12, 6); scene.add(G.followSpot, G.followSpot.target);
  G.flags = restore?.flags ? { ...restore.flags } : {};
  Object.assign(ctx, { scene, world, player: G.player, intro: null, onRespawn: null, onRestore: null, restoring: !!restore });
  world.onFall = () => caught('fall');
  scene.userData.chapter = id;
  L.build(ctx);
  dressStage(ctx, renderer);
  renderer.toneMappingExposure = (L.exposure || 1.1) * (id === 'redroom' ? .85 : 1);
  composer.passes[0].scene = scene;
  G.checkpoint = 0; G.focus = null; G.dim = 0; G.dread = 0;
  if (restore) {
    (restore.movables || []).forEach((v, k) => { const m = world.movables[k]; if (!m) return; m.mesh.position.set(v[0], v[1], v[2]); m.locked = !!v[3]; m.sync(); });
    (restore.ints || []).forEach((v, k) => { if (world.interactables[k]) world.interactables[k].enabled = !!v; });
    (restore.trig || []).forEach((v, k) => { if (world.triggers[k]) world.triggers[k].done = !!v; });
    if (restore.pos) G.player.pos.fromArray(restore.pos);
    G.checkpoint = restore.checkpoint || 0;
    ctx.onRestore?.(G.flags);
  }
  cam.x = G.player.pos.x + 3; cam.y = 2.6; cam.z = 15;
  G.cue = title ? 'title' : id; await syncMusic();
  if (!title) {
    if (!G.story.visited.includes(id)) G.story.visited.push(id);
    if (!restore) { saved = { id, story: G.story, flags: {}, pos: null }; try { localStorage.setItem(SAVE, JSON.stringify(saved)); } catch { } }
  }
  if (ctx.intro && !restore && !title) (async () => { await ctx.intro(); })();
}

async function startGame(resume) {
  if(G.state !== 'title')return;
  titleRoom?.dispose(); sound.start(); $('#title').classList.add('gone'); G.state = 'card';
  hud.card.hidden=false; hud.card.classList.add('on');hud.card.querySelector('small').textContent='';hud.card.querySelector('h2').textContent=t('loading');
  if (resume) { G.story = saved.story || newStory(); await buildLevel(saved.id, { restore: saved }); }
  else { G.story = newStory(); await buildLevel(ORDER[0]); }
  await chapterCard(G.level);
  G.state = 'play'; readyResolve();
}

async function chapterCard(L) {
  G.fade = 0; G.fadeTarget = 0;
  const n = ORDER.indexOf(L.id) + 1;
  hud.card.querySelector('small').textContent = (getLang() === 'zh' ? `第 ${n} 幕 · ` : `Act ${n} · `) + (EPISODES[L.id] || '');
  hud.card.querySelector('h2').textContent = tx(L.name);
  hud.card.hidden = false; requestAnimationFrame(() => hud.card.classList.add('on')); sound.sting();
  await wait(2600); hud.card.classList.remove('on'); await wait(700); hud.card.hidden = true;
  G.fadeTarget = 1; G.fadeSpeed = .025;
}

let transitioning = false;
async function nextLevel(id, force = false) {
  if (transitioning) return; transitioning = true;
  try {
    if (!id && !force) {
      const cr = CROSSROADS[G.id];
      if (cr) {
        const i = await talk(() => choice(cr.prompt, cr.options)); id = cr.options[i].to; ctx.pick(G.id, cr.options[i].mark);
      } else id = NEXT[G.id];
    }
    G.player.mode = 'locked'; sound.transition(); G.fadeTarget = 0; G.fadeSpeed = .06;
    await wait(1300); sound.stopAmbience(.5);
    if (!id) { transitioning = false; return ctx.ending({ chosenRight: true }); }
    G.state = 'card'; await buildLevel(id); G.fade = 0; G.fadeTarget = 0;
    await chapterCard(LEVELS[id]); G.state = 'play';
  } finally { transitioning = false; }
}

async function caught(why) {
  const p = G.player; if (p.mode === 'caught') return;
  p.mode = 'caught'; p.play('caught', .1); p.grabbed = null;
  if (why === 'bob') { sound.scream(); G.red = 1; G.shake = .5; } else sound.thud(1);
  await wait(why === 'bob' ? 700 : 300);
  G.fadeTarget = 0; G.fadeSpeed = .12; await wait(900);
  const cps = G.level.checkpoints || [G.level.spawn];
  p.pos.copy(cps[Math.min(G.checkpoint, cps.length - 1)]); p.vel.set(0, 0, 0); p.mode = 'normal'; p.play('idle');
  ctx.onRespawn?.(G.checkpoint); G.red = 0; G.dread = 0; cam.x = p.pos.x + 2;
  await wait(400); G.fadeTarget = 1; G.fadeSpeed = .05;
  ctx.say(t(why === 'bob' ? 'again' : 'bottomless'), 1800);
}

async function ending(kind = 'annie') {
  const E = ENDINGS[kind]; G.state = 'ending'; sound.stopAmbience(1.5); G.fadeTarget = 0; G.fadeSpeed = .05;
  const el = $('#ending'); el.hidden = false; el.innerHTML = '';
  const show = async (html, ms, cls = '') => { const p = document.createElement('p'); p.className = cls; p.innerHTML = html; el.append(p); await wait(30); p.classList.add('on'); await wait(ms); };
  await wait(1200); sound.sting();
  const lines = E.lines();
  for (const [i, l] of lines.entries()) await show(l, 3000, i === lines.length - 1 ? 'big' : '');
  if (kind === 'annie') { sound.scream(); await wait(600); }
  el.innerHTML = ''; await wait(800);
  await show(E.title(), 2400, 'big');
  await show(E.note(), 2600, 'small');
  await show(t('found', { a: insight(G.story), b: Object.keys(CLUES).length, c: G.story.visited.length }), 1800, 'small');
  await show(t('tribute'), 1600, 'small');
  await show(t('pressAny'), 100, 'small blink');
  try { localStorage.removeItem(SAVE); } catch { }
  G.state = 'ended';
}

// ---------------- programme (story tree) ----------------
function program() {
  const v = G.story.visited; const names = (id) => tx(LEVELS[id]?.name) || id;
  const node = (id) => `<span class="node ${v.includes(id) ? 'seen' : ''} ${G.id === id ? 'here' : ''}"><small>${EPISODES[id] || ''}</small>${v.includes(id) || G.id === id ? names(id) : '· · ·'}</span>`;
  const clues = Object.entries(CLUES).map(([k, f]) => `<li class="${G.story.clues[k] ? 'got' : ''}">${G.story.clues[k] ? f() : '？？？'}</li>`).join('');
  return `<div class="tree">${ORDER.map(node).join('<i>→</i>')}</div>
    <h3>${t('clues')} ${insight(G.story)} / ${Object.keys(CLUES).length}</h3><ul class="clues">${clues}</ul>`;
}

// ---------------- keys & menus ----------------
function onKey(e) {
  if (overlay || !$('#library').hidden) return;
  if (e.target?.closest('button, summary, input') && ['Enter','Space'].includes(e.code)) return;
  sound.ctx && sound.ctx.state === 'suspended' && sound.ctx.resume();
  if (G.state === 'title' && (e.code === 'Enter' || e.code === 'Space')) { startGame(hasSave()); return; }
  if (G.state === 'ended') { location.reload(); return; }
  if (G.state === 'dialog' && dlg.resolve) {
    if (dlg.opts && dlg.el.classList.contains('choosing')) {
      if (['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'].includes(e.code)) { dlg.sel = (dlg.sel + dlg.opts.length - 1) % dlg.opts.length; paintChoice(); sound.click(); }
      if (['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD'].includes(e.code)) { dlg.sel = (dlg.sel + 1) % dlg.opts.length; paintChoice(); sound.click(); }
      if (['Enter', 'Space', 'KeyE'].includes(e.code)) { const r = dlg.resolve; dlg.resolve = null; dlg.opts = null; r(dlg.sel); sound.click(); }
    } else if (['Enter', 'Space', 'KeyE'].includes(e.code)) { if (dlg.resolve()) dlg.resolve = null; }
    interactHeldBlock = true; return;
  }
  if (e.code === 'Escape' && (G.state === 'play' || G.state === 'paused')) togglePause();
  if (G.state !== 'play') return;
  if (e.code === 'KeyF' && G.player.mode === 'normal') G.player.setTorch(!G.player.torchOn);
  if (e.code === 'KeyM') { sound.setMuted(!sound.muted); }
  if (e.code === 'KeyE' && G.player.mode === 'normal') { const it = G.world.nearestInteractable(G.player.pos); if (it) { interactHeldBlock = true; it.use(it); } }
}
app.addEventListener('click', (e) => {
  const c = e.target.closest('[data-choice]'); if (c && dlg.resolve) { const r = dlg.resolve; dlg.resolve = null; dlg.opts = null; r(+c.dataset.choice); return; }
  if (G.state === 'dialog' && e.target.closest('#dialog') && dlg.resolve && !dlg.opts) { if (dlg.resolve()) dlg.resolve = null; return; }
  const b = e.target.closest('button'); if (!b) return; const a = b.dataset.act;
  if (b.dataset.act === 'bgm') { toggleMusic(); return; }
  if (a === 'library' || a === 'help') {$('#library').hidden=false;$('#help').open=a==='help';$('#library button').focus();return;}
  if(a === 'close-library') {$('#library').hidden=true;$('[data-act=library]').focus();return;}
  if(a === 'pause') {if(G.state==='play'||G.state==='paused')togglePause();return;}
  if (b.dataset.lang) { setLang(b.dataset.lang); return; }
  if (a === 'guide-lynch' || a === 'guide-fwwm') { openOverlay(a === 'guide-lynch' ? 'lynch' : 'fwwm'); return; }
  
  if (a === 'new') startGame(false);
  if (a === 'continue') startGame(true);
  if (a === 'resume') togglePause();
  if (a === 'restart') { togglePause(); G.state = 'card'; buildLevel(G.id).then(() => chapterCard(G.level)).then(() => { G.state = 'play'; readyResolve(); }); }
  if (a === 'mute') { sound.setMuted(!sound.muted); b.textContent = (sound.muted ? T('环境音效 · 关闭','Effects · off') : T('环境音效 · 开启','Effects · on')); }
  if (a === 'quit') { persist(); location.reload(); }
});
function togglePause() {
  const p = $('#pause');
  if (G.state === 'play') { G.state = 'paused'; p.querySelector('.program').innerHTML = program(); p.hidden = false; sound.ctx?.suspend(); }
  else { G.state = 'play'; p.hidden = true; sound.ctx?.resume(); }
}

// ---------------- boot ----------------
(async () => {
  try {
    paintUI();
    // The title has its own artwork; load scene assets only when the player enters.
    $('.loading').hidden = true; $('.menu').hidden = false;
    if (hasSave()) { const b = $('[data-act=continue]'); b.hidden = false; b.querySelector('em').textContent = tx(LEVELS[saved.id].name); $('.menu').prepend(b); }
    G.state = 'title';
    titleRoom = mountTitleRoom($('.title-art'));
  } catch (e) { $('.loading').textContent = t('loadFail'); console.error(e); }
})();

// ---------------- loop ----------------
const clock = new THREE.Clock(); G.fade = 0; G.fadeTarget = 1; G.fadeSpeed = .02;
const tmp = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30); G.t += dt;
  if (G.player && G.world && G.state !== 'paused' && G.state !== 'loading') {
    const inp = G.state === 'play' ? input() : { x: 0, z: 0 };
    G.player.update(dt, inp, G.world);
    G.world.update(dt, G.t, G.player);
    G.scene.traverse((o) => { if (o.userData.beam) o.material.uniforms.time.value = G.t; });
    const it = G.state === 'play' && G.player.mode === 'normal' ? G.world.nearestInteractable(G.player.pos) : null;
    if (it) { tmp.copy(it.pos).project(camera); hud.prompt.hidden = false; hud.prompt.style.left = ((tmp.x * .5 + .5) * 100) + '%'; hud.prompt.style.top = ((-tmp.y * .5 + .5) * 100) + '%'; hud.prompt.querySelector('span').textContent = it.label; }
    else hud.prompt.hidden = true;
    updateCamera(dt);
    const fsp = G.followSpot; if (fsp) { const on = G.focus && G.state === 'dialog'; if (on) { fsp.target.position.copy(G.focus.v); fsp.position.set(G.focus.v.x + 1, G.focus.v.y + 11, G.focus.v.z + 6); } fsp.intensity += ((on ? 180 : 0) - fsp.intensity) * Math.min(1, dt * 4); }
  }
  pressed.clear();
  G.fade += ((G.fadeTarget ?? 1) - G.fade) * Math.min(1, (G.fadeSpeed || .05) * 60 * dt);
  finish.uniforms.time.value = G.t; finish.uniforms.fade.value = G.fade * (1 - (G.dim || 0));
  finish.uniforms.red.value += ((G.red || 0) * .8 + G.dread * .25 - finish.uniforms.red.value) * Math.min(1, dt * 4);
  finish.uniforms.bars.value += ((G.focus ? .1 : .055) - finish.uniforms.bars.value) * Math.min(1, dt * 3);
  hud.dread.style.opacity = G.dread;
  document.documentElement.dataset.gameState = G.state;
  if (G.state !== 'title' && G.state !== 'loading') composer.render();
}
function updateCamera(dt) {
  const p = G.player.pos, L = G.level;
  let tx = p.x + G.player.face * 1.0, ty = p.y * .75 + 3.0, tz = innerWidth < innerHeight ? 17 : 11.2, lx = tx, ly = p.y * .75 + 1.25;
  if (!L.loop) { const hw = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * tz * camera.aspect * .82; tx = Math.max(L.bounds[0] + hw, Math.min(L.bounds[1] - hw, tx)); lx = tx; }
  if (G.focus) { const f = G.focus.v; tx = f.x; lx = f.x; ty = f.y + 1.4; ly = f.y; tz = 12.5 / G.focus.zoom; }
  const k = Math.min(1, dt * 2.2);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * Math.min(1, dt * 1.6);
  cam.look.x += (lx - cam.look.x) * k; cam.look.y += (ly - cam.look.y) * k;
  G.shake *= Math.pow(.02, dt);
  const sx = (Math.random() - .5) * G.shake, sy = (Math.random() - .5) * G.shake;
  camera.position.set(cam.x + Math.sin(G.t * .23) * .08 + sx, cam.y + Math.sin(G.t * .31) * .05 + sy, cam.z);
  camera.lookAt(cam.look.x, cam.look.y, -.6);
}
function resize() {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); fitArch();
  finish.uniforms.res.value.set(innerWidth, innerHeight);
}
addEventListener('resize', resize); resize(); frame();

// deterministic test hook: advance the simulation n fixed steps with a scripted input (used by headless playtests)
function simSteps(n, inp = {}) {
  const base = { x: 0, z: 0, run: false, jumpPressed: false, jumpHeld: false, grab: false };
  for (let i = 0; i < n; i++) { const it = { ...base, ...inp, jumpPressed: !!inp.jump && i === 0 }; G.player.update(1 / 60, it, G.world); G.world.update(1 / 60, G.t += 1 / 60, G.player); }
  return { pos: G.player.pos.toArray().map((v) => +v.toFixed(2)), ground: G.player.onGround, mode: G.player.mode, grabbed: !!G.player.grabbed };
}
window.__game = { get titleRoom(){return titleRoom;}, G, ctx, cam, composer, finish, renderer, camera, simSteps, dlg, buildLevel };
