// 入口：组装引擎、音频、输入、交互、剧情、界面，并管理空间切换与存档。
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { Interaction } from './core/interact.js';
import { Story, INITIAL_ARCHIVE } from './core/story.js';
import { SaveManager, defaultState } from './core/save.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { AudioEngine } from './audio/engine.js';
import { CameraDirector } from './fx/camera.js';
import { Transitioner } from './fx/transitions.js';
import { updateTweens, wait } from './fx/tween.js';
import { RedRoom } from './scenes/redRoom.js';
import { Town } from './scenes/town.js';
import { Highway } from './scenes/highway.js';
import { Theater } from './scenes/theater.js';
import { RadiatorRoom } from './scenes/radiator.js';
import { SPACES, LINES } from './content/chapters.js';
import { UI } from './ui/ui.js';
import { MusicFSM } from './audio/musicFSM.js';

class Game {
  constructor() {
    this.settings = loadSettings();
    this.saves = new SaveManager();
    this.state = defaultState();
    this.mode = 'title';
    this.busy = false;
    this.idle = 0;

    this.engine = new Engine(document.getElementById('stage'));
    this.audio = new AudioEngine();
    this.input = new Input(this.engine.canvas);
    this.camera = new CameraDirector(this.engine.camera, this.input, this.settings);
    this.transitions = new Transitioner(this.engine, this.audio, this.settings);
    this.ui = new UI(this);
    this.story = new Story(this);
    this.interaction = new Interaction(this);
    this.audio.captionFn = (text, kind) => this.ui.subtitle(text, kind);
    this.engine.onQualityChange = (q) => this.ui.announce?.(`画质已调整为${q}`);

    this.spaces = { town: new Town(this), redroom: new RedRoom(this), highway: new Highway(this), theater: new Theater(this), radiator: new RadiatorRoom(this) };
    this.space = null;

    this._bindInput();
    this.applySettings();
    // 标题画面背后先摆好红房间
    this._mount('redroom');
    this.camera.place(new THREE.Vector3(-1.45, 1.55, 2.35), -0.12, -0.06);
    this.camera.locked = true;
    this.ui.open('title');
    this.ui.route(this.ui.initialHash);
    this.transitions.reset();
    this.engine.u.uFade.value = 1;
    this.transitions.in('fade', 2.5);

    document.addEventListener('visibilitychange', () => (document.hidden ? this.audio.suspend() : this.mode !== 'title' && this.audio.resume()));
    this.engine.renderer.setAnimationLoop(() => this.engine.frame((dt, t) => this.update(dt, t)));
    window.__redroom = this; // 供端到端测试读取状态
  }

  _bindInput() {
    this.input.on('key', (e) => {
      if (this.mode !== 'play' || e.repeat) return;
      this.idle = 0;
      if (this.audio.fsm.state === 'silence') this.audio.event('activity');
      if (['KeyE', 'Enter', 'Space'].includes(e.code)) {
        e.preventDefault();
        this.interaction.use();
      } else if (e.code === 'KeyM') {
        this.updateSettings({ muted: !this.settings.muted });
        this.ui.announce(this.settings.muted ? '已静音' : '已取消静音');
      } else if (e.code === 'Tab') {
        e.preventDefault();
        this.interaction.cycle(e.shiftKey ? -1 : 1);
      } else if (/^(Key[WASD]|Arrow)/.test(e.code)) this.interaction.clearTab();
    });
    this.input.on('click', (e) => {
      if (this.mode !== 'play') return;
      this.interaction.clickAt(e.clientX, e.clientY);
    });
  }

  setMode(m) {
    const prev = this.mode;
    this.mode = m;
    this.input.enabled = m === 'play';
    this.ui.showHud(m === 'play' || m === 'dialog');
    this.audio.duck(m === 'dialog');
    if (m !== 'play') { this.audio.listen(false); this.input.keys.clear(); this.ui.listenHeld = false; }
    if (m === 'menu' && prev === 'play') this.audio.event('menu:open');
    if (m === 'play' && prev === 'menu') this.audio.event('menu:close');
  }

  // ———————————————— 设置 ————————————————
  updateSettings(patch) {
    Object.assign(this.settings, patch);
    saveSettings(this.settings);
    this.applySettings();
    this.ui?.updateHud();
  }
  applySettings() {
    const s = this.settings;
    this.engine.setQuality(s.quality, s.quality !== 'auto');
    this.audio.applySettings(s);
    this.engine.u.uGrain.value = s.grain ? 0.008 : 0;
    this.engine.u.uChroma.value = s.reducedMotion ? 0 : 0.0004;
    document.body.classList.toggle('hc', s.highContrast);
    document.body.classList.toggle('rm', s.reducedMotion);
    document.documentElement.style.setProperty('--sub', { s: '15px', m: '19px', l: '26px' }[s.subtitleSize]);
  }

  // ———————————————— 空间 ————————————————
  _mount(id) {
    if (this.space) {
      this.space.exit();
      this.engine.scene.remove(this.space.root);
    }
    const sp = this.spaces[id];
    sp.ensureBuilt();
    this.engine.scene.add(sp.root);
    sp.enter();
    this.space = sp;
    this.state.space = id;
    this.interaction.clearTab();
    this.camera.place(sp.spawn.pos, sp.spawn.yaw);
    this.ui.updateHud();
  }

  async goto(id, transition = 'curtain', shot) {
    if (this._switching) return; // 防止转场重复触发
    this._switching = true;
    this.busy = true;
    this.input.enabled = false;
    try {
      await this._goto(id, transition, shot);
    } catch (e) {
      // 失败恢复：撤掉所有遮罩，回到红房间，交还控制权
      console.error('空间切换失败', e);
      this.transitions.reset();
      this.camera.release();
      if (this.space?.id !== 'redroom') this._mount('redroom');
      this.ui.subtitle('［场景加载失败，已返回红房间］');
    } finally {
      this._switching = false;
      this.busy = false;
      this.ui.loading(false);
      this.input.enabled = this.mode === 'play';
    }
    const frag = { highway: 'tape', theater: 'key', radiator: 'seed' }[id];
    const introKey = { highway: 'highwayIntro', theater: 'theaterIntro', radiator: 'radiatorIntro' }[id];
    if (frag && this.state.fragments.includes(frag)) await this.story.say(LINES.dreamDone);
    else if (introKey && !this.state.flags[`intro:${id}`]) {
      this.state.flags[`intro:${id}`] = true;
      await this.story.say(LINES[introKey]);
    }
  }

  async _goto(id, transition, shot) {
    // 离开时的镜头
    const ahead = this.camera.pos.clone().add(new THREE.Vector3(-Math.sin(this.camera.yaw), 0, -Math.cos(this.camera.yaw)).multiplyScalar(2));
    if (shot === 'crash') this.camera.crashZoom(ahead, 30, 0.6);
    if (shot === 'vertigo') this.camera.vertigo(ahead, 0.8, 1.6);
    await this.transitions.out(transition);
    this.audio.stopAllSpatial(0.8);
    this.camera.release();
    if (!this.spaces[id].built) {
      this.ui.loading(true);
      await wait(0.05); // 让加载提示先绘制出来
    }
    this._mount(id);
    this.ui.loading(false);
    this.engine.u.uWarp.value = id === 'redroom' ? 0 : 0.25;
    this.audio.event(SPACES[id].music);
    this.space.startAmbience();
    await wait(0.3);
    await this.transitions.in(transition);
    this.ui.announce(`${SPACES[id].title}。${SPACES[id].desc}`);
    this.autosave();
  }

  // 发现记录
  discover(it) {
    const d = (this.state.discoveries ??= []);
    if (d.some((x) => x.id === it.id)) return;
    d.push({ id: it.id, label: it.label.replace(/（.*）/, ''), space: this.space.id, at: Math.round(this.state.playTime) });
  }

  // ———————————————— 开始 / 继续 ————————————————
  async newGame() {
    await this.audio.start(this.settings);
    this.state = defaultState();
    this.state.archive = [...INITIAL_ARCHIVE];
    this.ui.closeAll();
    this.setMode('play');
    this.busy = true;
    await this.transitions.out('curtain', 0.01);
    this._mount('redroom');
    this.spaces.redroom.setLamp(true);
    this.spaces.redroom.finaleActive = false;
    this.camera.place(new THREE.Vector3(0, 1.6, 2.2), 0, -0.08);
    this.audio.event('enter:redroom');
    this.space.startAmbience();
    await this.transitions.in('curtain', 3);
    this.busy = false;
    await this.story.intro();
  }

  async continueFrom(slot) {
    let loaded;
    try {
      loaded = this.saves.load(slot);
    } catch (e) {
      alert(`读取失败：${e.message}`);
      return;
    }
    if (!loaded) return;
    await this.audio.start(this.settings);
    this.ui.closeAll();
    this.setMode('play');
    this.busy = true;
    await this.transitions.out('fade', 0.5);
    this.audio.stopAllSpatial(0.3);
    this.state = loaded.state;
    const s = this.state;
    this.spaces.redroom.setLamp(!s.flags.lampOff);
    this.spaces.redroom.finaleActive = s.chapter === 'epilogue';
    this._mount(s.space);
    if (s.space === 'redroom') this.camera.place(new THREE.Vector3(s.position.x, 1.6, s.position.z), s.yaw);
    this.audio.event(SPACES[s.space].music);
    if (s.space === 'redroom' && s.flags.lampOff) this.audio.event('lamp:off');
    this.space.startAmbience();
    await this.transitions.in('fade', 1.2);
    this.busy = false;
    this.ui.announce(`已读取存档：${SPACES[s.space].title}`);
  }

  snapshot() {
    const p = this.camera.pos;
    return { ...this.state, position: { x: +p.x.toFixed(2), y: 1.6, z: +p.z.toFixed(2) }, yaw: +this.camera.yaw.toFixed(3) };
  }
  autosave() {
    if (this.mode === 'title') return;
    this.saves.save('auto', this.snapshot());
  }
  toTitle() {
    this.ui.closeAll();
    this.audio.stopAllSpatial(1);
    this.audio.event('menu:close');
    this.audio.event('enter:redroom');
    this.audio.fsm._go('silence', 'now', 2, 'title');
    this._mount('redroom');
    this.camera.place(new THREE.Vector3(-1.45, 1.55, 2.35), -0.12, -0.06);
    this.camera.locked = true;
    this.mode = 'title';
    this.ui.showHud(false);
    this.ui.open('title');
    this.camera.locked = true;
  }

  // ———————————————— 预览（镜头库页面） ————————————————
  async previewTransition(name) {
    await this.audio.start(this.settings);
    this.ui.root.style.visibility = 'hidden';
    await this.transitions.play(name);
    this.ui.root.style.visibility = '';
  }
  async previewShot(name) {
    await this.audio.start(this.settings);
    this.ui.root.style.visibility = 'hidden';
    const c = this.camera;
    const saved = { pos: c.pos.clone(), yaw: c.yaw, pitch: c.pitch };
    const target = this.space.id === 'redroom' ? new THREE.Vector3(0.5, 0.9, -1.35) : c.pos.clone().add(new THREE.Vector3(-Math.sin(c.yaw), -0.2, -Math.cos(c.yaw)).multiplyScalar(3));
    const map = {
      pushIn: () => c.pushIn(target, 1, 2.5, true),
      pullBack: () => c.pullBack(target, 1, 2, true),
      dolly: () => c.dolly(new THREE.Vector3(1.2, 0, 0), target, 2.5, true),
      orbit: () => c.orbit(target, 2.2, 1.6, Math.PI / 2, 4, true),
      overhead: () => c.overhead(target, 3.2, 2.5, true),
      dutch: () => c.dutch(0.28, 1.5, true),
      crashZoom: () => c.crashZoom(target, 26, 0.4, true),
      handheld: () => c.handheld(2, 1.4),
      lookAt: () => c.lookAt(target, 1.2),
      vertigo: () => c.vertigo(target, 1.2, 2.5, true),
    };
    await map[name]?.();
    await wait(0.8);
    c.release();
    c.place(saved.pos, saved.yaw, saved.pitch);
    this.ui.root.style.visibility = '';
  }

  // ———————————————— 主循环 ————————————————
  update(dt, t) {
    updateTweens(dt);
    if (this.mode === 'play' || this.mode === 'dialog') {
      this.state.playTime += dt;
      this.idle += dt;
      if (this.input.look.dx || this.input.look.dy) this.idle = 0;
      if (this.idle > 75 && this.audio.fsm.state === 'explore') this.audio.event('idle');
    }
    if (this.mode === 'title' && this.space) {
      // 标题画面：缓慢的呼吸式推轨
      const motion = this.settings.reducedMotion ? 0 : 1;
      this.camera.yaw = -0.12 + Math.sin(t * 0.07) * 0.025 * motion;
      this.camera.pos.set(-1.45 + Math.sin(t * 0.05) * 0.06 * motion, 1.55, 2.35);
    }
    if (this.mode === 'dialog') this.input.consumeLook();
    // 聆听：按住 L（或 HUD 按钮）
    const listening = this.mode === 'play' && (this.input.held('KeyL') || this.ui.listenHeld);
    this.audio.listen(listening);
    this.ui.setListening(listening);
    if (listening && !this.state.flags.listened) {
      this.state.flags.listened = true;
      this.ui.subtitle(LINES.listenFirst.text, 'speech', 5000);
    }
    const before = this.camera.pos.clone();
    this.camera.update(dt);
    // 脚步声
    if (this.mode === 'play' && this.camera.free && !this.camera.locked) {
      this._stride = (this._stride ?? 0) + Math.hypot(this.camera.pos.x - before.x, this.camera.pos.z - before.z);
      if (this._stride > 0.75) {
        this._stride = 0;
        this.audio.sfx('step');
      }
    }
    this.space?.update(dt, t);
    this.interaction.update();
    this.audio.setListener(this.engine.camera);
    this._autosaveT = (this._autosaveT ?? 0) + dt;
    if (this._autosaveT > 30 && this.mode === 'play' && !this.busy) {
      this._autosaveT = 0;
      this.autosave();
    }
  }
}

// 档案模式：不初始化任何 3D / 音频，只提供界面所需的最小接口。
// 用于不支持 WebGL 2 的设备、移动端，以及选择不进行第一人称漫游的用户。
class ArchiveShell {
  constructor({ noGL }) {
    this.archiveOnly = true;
    this.noGL = noGL;
    this.settings = loadSettings();
    this.saves = new SaveManager();
    this.state = this.saves.latest()?.state ?? { ...defaultState(), archive: [...INITIAL_ARCHIVE] };
    this.mode = 'menu';
    this.space = null;
    this.engine = null;
    this.audio = { fsm: new MusicFSM(), sfx() {}, event() {}, duck() {}, listen() {} };
    document.getElementById('stage').hidden = true;
    document.body.style.background = 'radial-gradient(ellipse at 50% 30%, #2a0a0d, #090909 70%)';
    this.ui = new UI(this);
    this.applySettings();
    this.ui.open('title');
    this.ui.route(this.ui.initialHash);
    window.__redroom = this;
  }
  setMode() {}
  updateSettings(patch) {
    Object.assign(this.settings, patch);
    saveSettings(this.settings);
    this.applySettings();
    this.ui?.updateHud();
  }
  applySettings() {
    document.body.classList.toggle('hc', this.settings.highContrast);
    document.body.classList.toggle('rm', this.settings.reducedMotion);
  }
  continueFrom() {
    if (!this.noGL) location.href = location.pathname;
  }
  newGame() {
    this.continueFrom();
  }
  toTitle() {
    this.ui.closeAll();
    this.ui.open('title');
  }
}

function boot() {
  const gl = document.createElement('canvas').getContext('webgl2');
  const wantArchive = new URLSearchParams(location.search).get('mode') === 'archive';
  if (!gl || wantArchive) new ArchiveShell({ noGL: !gl });
  else new Game();
}
boot();
