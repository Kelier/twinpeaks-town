// 程序化音频引擎：全部声音由 WebAudio 实时合成（原创，无第三方录音素材）。
// 结构：声部层(music) / 环境(ambience, HRTF 空间化) / 音效(sfx) 三条总线 → 混响发送 → 压缩 → 输出。
import { MusicFSM, STATES, LAYERS } from './musicFSM.js';
import DESIGN from '../design/tokens.json';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// 原创和声进行（以 MIDI 音高记）
const HARMONY = {
  explore: [[50, 53, 57, 60, 64], [46, 50, 53, 57, 62], [43, 46, 50, 53, 57], [45, 50, 52, 55, 58]], // Dm9 Bbmaj9 Gm9 A7sus(b9)
  tension: [[50, 51, 57], [50, 51, 56], [49, 50, 56], [50, 51, 57]],
  dream_highway: [[40, 47, 52], [40, 41, 47], [40, 47, 52], [38, 41, 46]],
  dream_theater: [[51, 55, 58, 62], [48, 51, 55, 58, 62], [44, 48, 51, 55], [46, 50, 53, 56, 60]],
  dream_radiator: [[48, 50, 52, 54], [49, 51, 53, 55], [48, 50, 52, 54], [47, 49, 51, 53]],
  finale: [[50, 54, 57, 61, 64], [47, 50, 54, 57], [43, 47, 50, 54, 57], [45, 49, 52, 55, 59]],
  revelation: [[50, 57, 62, 64, 69], [50, 57, 62, 64, 69]],
  menu: [[50, 53, 57, 60], [46, 50, 53, 57]],
  silence: [[50]],
};
// 寂静剧场的原创旋律（音高, 拍长）
const THEATER_LEAD = [[67, 2], [70, 1], [72, 1], [74, 3], [72, 1], [70, 2], [67, 2], [65, 3], [0, 1], [63, 2], [65, 1], [67, 1], [70, 4], [0, 4]];
const FINALE_LEAD = [[69, 3], [66, 1], [64, 2], [62, 2], [61, 3], [64, 1], [62, 4], [0, 4]];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.fsm = new MusicFSM('silence');
    this.spatials = new Set();
    this.captionFn = () => {};
    this.stateFn = () => {};
  }

  get ready() {
    return !!this.ctx;
  }

  // 必须在用户手势中调用
  async start(settings) {
    if (this.ctx) return this.ctx.resume();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));

    this.out = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.ratio.value = 3;
    this.monoNode = ctx.createGain();
    this.master = ctx.createGain();
    this.master.connect(this.comp).connect(this.monoNode).connect(this.out).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(4.2, 2.6);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.55;
    this.reverb.connect(this.reverbGain).connect(this.master);

    this.bus = {};
    for (const b of ['music', 'ambience', 'sfx']) {
      const g = ctx.createGain();
      g.connect(this.master);
      const send = ctx.createGain();
      send.gain.value = b === 'music' ? 0.5 : 0.3;
      g.connect(send).connect(this.reverb);
      this.bus[b] = g;
    }
    // 音乐总线上的低通（菜单时压暗）
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicFilter.connect(this.bus.music);

    this.layer = {};
    for (const l of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.musicFilter);
      this.layer[l] = g;
    }
    this.noise = this._noiseBuffer(2);
    this._startDrone();

    this.applySettings(settings);

    // 调度器
    this.nextBeat = ctx.currentTime + 0.1;
    this.beatIndex = 0;
    this.pending = null;
    this.fsm.on((tr) => this._onTransition(tr));
    this.timer = setInterval(() => this._schedule(), 25);
  }

  applySettings(s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.s = s;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.masterVolume, t, 0.05);
    this._mix();
    this.bus.sfx.gain.setTargetAtTime(s.sfxVolume, t, 0.05);
    this.monoNode.channelCount = s.monoAudio ? 1 : 2;
    this.monoNode.channelCountMode = 'explicit';
    this.monoNode.channelInterpretation = 'speakers';
  }

  // 分组混音：对白时压低音乐（MUSIC_DUCK）；聆听时压低音乐、放大环境与空间声
  _mix() {
    if (!this.ctx || !this.s) return;
    const t = this.ctx.currentTime;
    const s = this.s;
    const musicK = this.listening ? DESIGN.sound.listenDuck : this.ducked ? DESIGN.sound.dialogDuck : 1;
    const ambK = this.listening ? 1.8 : 1;
    this.bus.music.gain.setTargetAtTime(s.musicVolume * musicK, t, 0.25);
    this.bus.ambience.gain.setTargetAtTime(s.ambienceVolume * ambK, t, 0.25);
  }
  duck(on) {
    this.ducked = on;
    this._mix();
  }
  listen(on) {
    if (this.listening === on) return;
    this.listening = on;
    this._mix();
  }

  event(name) {
    return this.fsm.dispatch(name);
  }

  // ———————————————— 调度 ————————————————
  _onTransition(tr) {
    this.stateFn(tr);
    if (!this.ctx) return;
    if (tr.quantize === 'now') this._applyLayers(tr, this.ctx.currentTime);
    else this.pending = tr;
  }

  _applyLayers(tr, when) {
    const def = STATES[tr.to];
    for (const l of LAYERS) {
      const target = def.layers[l] ?? 0;
      const p = this.layer[l].gain;
      p.cancelScheduledValues(when);
      p.setTargetAtTime(target, when, Math.max(0.05, tr.fade / 3));
    }
    this.musicFilter.frequency.setTargetAtTime(def.lowpass ?? 18000, when, 0.3);
    if (tr.to === 'revelation') this.sfx('reveal', when);
  }

  _schedule() {
    const ctx = this.ctx;
    const look = ctx.currentTime + 0.12;
    while (this.nextBeat < look) {
      const def = this.fsm.def;
      const spb = 60 / def.bpm;
      const beatInBar = this.beatIndex % 4;
      if (this.pending) {
        if (this.pending.quantize === 'beat' || beatInBar === 0) {
          this._applyLayers(this.pending, this.nextBeat);
          this.pending = null;
        }
      }
      if (beatInBar === 0) {
        this.barIndex = (this.barIndex ?? -1) + 1;
        this.fsm.onBar();
      }
      this._playBeat(this.nextBeat, beatInBar, spb);
      this.nextBeat += spb;
      this.beatIndex++;
    }
  }

  _layerOn(l) {
    return (STATES[this.fsm.state].layers[l] ?? 0) > 0.01 || this.layer[l].gain.value > 0.01;
  }

  _harmony() {
    const key = HARMONY[this.fsm.state] ? this.fsm.state : 'explore';
    const prog = HARMONY[key];
    return prog[(this.barIndex ?? 0) % prog.length];
  }

  _playBeat(t, beat, spb) {
    const chord = this._harmony();
    const bar = spb * 4;
    if (beat === 0 && this._layerOn('pad')) chord.forEach((n) => this._pad(midi(n), t, bar * 1.05));
    if (this._layerOn('bass')) {
      const root = chord[0] - 12;
      const walk = [root, root + 7, root + 3, root + (beat === 3 ? 1 : 5)];
      this._bass(midi(walk[beat]), t, spb * 0.9);
    }
    if (this._layerOn('brush')) {
      if (beat % 2 === 1) this._brush(t, 0.35, 0.18);
      this._tick(t, 0.25);
      this._tick(t + spb * 0.66, 0.15); // 摇摆八分
    }
    if (this._layerOn('keys') && Math.random() < 0.45) {
      const n = chord[Math.floor(Math.random() * chord.length)] + 12;
      this._bell(midi(n), t + (Math.random() < 0.5 ? 0 : spb * 0.5), 2.5);
    }
    if (this._layerOn('pulse')) {
      this._thump(t, 0.9);
      if (this.fsm.state === 'tension' && beat % 2 === 0) this._thump(t + 0.22, 0.5);
      if (this.fsm.state === 'dream_highway') this._tick(t + spb / 2, 0.2);
    }
    if (this._layerOn('metal') && Math.random() < 0.3) this._clank(t + Math.random() * spb);
    if (this._layerOn('lead')) this._lead(t, spb);
  }

  _lead(t, spb) {
    const phrase = this.fsm.state === 'finale' ? FINALE_LEAD : THEATER_LEAD;
    const total = phrase.reduce((a, [, d]) => a + d, 0);
    const pos = this.beatIndex % total;
    let acc = 0;
    for (const [n, d] of phrase) {
      if (acc === pos && n > 0) this._voice(midi(n), t, d * spb * 0.95);
      acc += d;
    }
  }

  // ———————————————— 合成器 ————————————————
  _env(g, t, a, peak, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
  }

  _pad(f, t, dur) {
    const c = this.ctx;
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(1100, t + dur / 2);
    lp.frequency.linearRampToValueAtTime(600, t + dur);
    lp.connect(g).connect(this.layer.pad);
    for (const d of [-7, 6]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 2.2);
    }
    this._env(g, t, 1.4, 0.05, dur, 1.8);
  }

  _bass(f, t, dur) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    o.connect(g).connect(this.layer.bass);
    this._env(g, t, 0.01, 0.35, dur * 0.6, dur * 0.4);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  _noiseSrc(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur);
    return s;
  }

  _brush(t, peak, dur) {
    const c = this.ctx;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2800;
    bp.Q.value = 0.7;
    const g = c.createGain();
    this._noiseSrc(t, dur + 0.2).connect(bp).connect(g).connect(this.layer.brush);
    this._env(g, t, 0.06, peak * 0.3, dur * 0.4, dur * 0.6);
  }

  _tick(t, peak) {
    const c = this.ctx;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = c.createGain();
    this._noiseSrc(t, 0.12).connect(hp).connect(g).connect(this.layer.brush.gain.value > 0.01 ? this.layer.brush : this.layer.pulse);
    this._env(g, t, 0.002, peak * 0.25, 0.01, 0.07);
  }

  _bell(f, t, dur) {
    const c = this.ctx;
    const car = c.createOscillator();
    const mod = c.createOscillator();
    const mg = c.createGain();
    car.frequency.value = f;
    mod.frequency.value = f * 4;
    mg.gain.setValueAtTime(f * 1.2, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 0.6);
    mod.connect(mg).connect(car.frequency);
    const g = c.createGain();
    // 颤音（像电颤琴的风扇）
    const trem = c.createOscillator();
    const tg = c.createGain();
    trem.frequency.value = 5.2;
    tg.gain.value = 0.3;
    trem.connect(tg).connect(g.gain);
    car.connect(g).connect(this.layer.keys);
    this._env(g, t, 0.005, 0.12, 0.05, dur);
    for (const o of [car, mod, trem]) {
      o.start(t);
      o.stop(t + dur + 0.2);
    }
  }

  _voice(f, t, dur) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const vib = c.createOscillator();
    const vg = c.createGain();
    vib.frequency.value = 5;
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.8, dur));
    vib.connect(vg).connect(o.frequency);
    const lp = c.createBiquadFilter();
    lp.frequency.value = 2200;
    const g = c.createGain();
    o.connect(lp).connect(g).connect(this.layer.lead);
    this._env(g, t, 0.25, 0.14, dur, 0.8);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 1);
    vib.stop(t + dur + 1);
  }

  _thump(t, peak) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const g = c.createGain();
    o.connect(g).connect(this.layer.pulse);
    this._env(g, t, 0.005, peak * 0.6, 0.05, 0.3);
    o.start(t);
    o.stop(t + 0.5);
  }

  _clank(t) {
    const c = this.ctx;
    const g = c.createGain();
    g.connect(this.layer.metal);
    for (const f of [420, 1130, 1870, 2640].map((x) => x * (0.8 + Math.random() * 0.4))) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 30;
      this._noiseSrc(t, 0.05).connect(bp).connect(g);
    }
    this._env(g, t, 0.002, 1.2, 0.02, 1.4);
  }

  _startDrone() {
    const c = this.ctx;
    const g = this.layer.drone;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    lp.Q.value = 6;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.05;
    lg.gain.value = 180;
    lfo.connect(lg).connect(lp.frequency);
    lfo.start();
    const mix = c.createGain();
    mix.gain.value = 0.12;
    lp.connect(mix).connect(g);
    for (const [f, type] of [[36.7, 'sawtooth'], [36.9, 'sawtooth'], [73.4, 'sine'], [55, 'sine']]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    }
  }

  // ———————————————— 环境音（空间化） ————————————————
  setListener(cam) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    const t = this.ctx.currentTime;
    const p = cam.position;
    const fwd = cam.getWorldDirection(cam.userData._v ?? (cam.userData._v = cam.position.clone()));
    if (L.positionX) {
      L.positionX.setTargetAtTime(p.x, t, 0.05);
      L.positionY.setTargetAtTime(p.y, t, 0.05);
      L.positionZ.setTargetAtTime(p.z, t, 0.05);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.05);
      L.forwardY.setTargetAtTime(fwd.y, t, 0.05);
      L.forwardZ.setTargetAtTime(fwd.z, t, 0.05);
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;
    } else {
      L.setPosition(p.x, p.y, p.z);
      L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  // type: hum | hiss | wind | murmur | engine | drip | roomtone | rustle
  spatial(type, pos, gain = 1, caption) {
    if (!this.ctx) return { stop() {}, setGain() {} };
    const c = this.ctx;
    const out = c.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(gain, c.currentTime, 0.8);
    let dest = this.bus.ambience;
    let panner = null;
    if (pos) {
      panner = c.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1.2;
      panner.rolloffFactor = 1.4;
      panner.positionX.value = pos.x;
      panner.positionY.value = pos.y;
      panner.positionZ.value = pos.z;
      out.connect(panner).connect(dest);
    } else out.connect(dest);

    const nodes = [];
    const osc = (f, type = 'sine', g = 1, to = out) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const gg = c.createGain();
      gg.gain.value = g;
      o.connect(gg).connect(to);
      o.start();
      nodes.push(o);
      return o;
    };
    const noise = (filterType, f, q = 1, g = 1) => {
      const s = c.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      const fl = c.createBiquadFilter();
      fl.type = filterType;
      fl.frequency.value = f;
      fl.Q.value = q;
      const gg = c.createGain();
      gg.gain.value = g;
      s.connect(fl).connect(gg).connect(out);
      s.start(0, Math.random() * 1.9);
      nodes.push(s);
      return { fl, gg };
    };
    const lfoTo = (param, rate, depth) => {
      const l = c.createOscillator();
      const lg = c.createGain();
      l.frequency.value = rate;
      lg.gain.value = depth;
      l.connect(lg).connect(param);
      l.start();
      nodes.push(l);
    };
    let interval = null;
    switch (type) {
      case 'hum': {
        const lp = c.createBiquadFilter();
        lp.frequency.value = 900;
        lp.connect(out);
        osc(60, 'sawtooth', 0.05, lp);
        osc(120, 'sine', 0.05, lp);
        osc(180, 'sine', 0.02, lp);
        break;
      }
      case 'rain': {
        const n = noise('lowpass', 2200, .6, .35);
        lfoTo(n.gg.gain, .17, .03);
        noise('highpass', 4200, .4, .055);
        break;
      }
      case 'hiss': {
        const n = noise('highpass', 3500, 0.5, 0.12);
        lfoTo(n.gg.gain, 0.13, 0.05);
        break;
      }
      case 'wind': {
        const n = noise('lowpass', 500, 1.5, 0.4);
        lfoTo(n.fl.frequency, 0.08, 300);
        lfoTo(n.gg.gain, 0.11, 0.2);
        break;
      }
      case 'murmur': {
        for (const f of [400, 900, 1700]) {
          const n = noise('bandpass', f, 8, 0.25);
          lfoTo(n.fl.frequency, 0.7 + Math.random(), f * 0.3);
          lfoTo(n.gg.gain, 2 + Math.random() * 3, 0.15);
        }
        break;
      }
      case 'engine': {
        const lp = c.createBiquadFilter();
        lp.frequency.value = 220;
        lp.connect(out);
        const o = osc(42, 'sawtooth', 0.3, lp);
        lfoTo(o.frequency, 0.3, 3);
        noise('lowpass', 900, 0.7, 0.3);
        break;
      }
      case 'roomtone':
        noise('lowpass', 250, 0.5, 0.18);
        break;
      case 'rustle': {
        const n = noise('bandpass', 1400, 0.6, 0.0);
        lfoTo(n.gg.gain, 0.21, 0.08);
        break;
      }
      case 'drip':
        interval = setInterval(() => {
          const t = c.currentTime;
          const o = c.createOscillator();
          o.frequency.setValueAtTime(1800 + Math.random() * 600, t);
          o.frequency.exponentialRampToValueAtTime(700, t + 0.08);
          const g = c.createGain();
          o.connect(g).connect(out);
          this._env(g, t, 0.002, 0.25, 0.01, 0.15);
          o.start(t);
          o.stop(t + 0.3);
        }, 1700 + Math.random() * 900);
        break;
    }
    if (caption) this.captionFn(caption, 'ambience');
    const h = {
      type,
      setGain: (v) => out.gain.setTargetAtTime(v, c.currentTime, 0.3),
      stop: (fade = 1) => {
        out.gain.setTargetAtTime(0, c.currentTime, fade / 3);
        clearInterval(interval);
        setTimeout(() => {
          nodes.forEach((n) => { try { n.stop(); } catch {} });
          out.disconnect();
          panner?.disconnect();
        }, fade * 1000 + 300);
        this.spatials.delete(h);
      },
    };
    this.spatials.add(h);
    return h;
  }

  stopAllSpatial(fade = 1) {
    [...this.spatials].forEach((h) => h.stop(fade));
  }

  // ———————————————— 一次性音效 ————————————————
  sfx(name, when) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = when ?? c.currentTime;
    const g = c.createGain();
    g.connect(this.bus.sfx);
    const caption = {
      curtain: '［幕布拂动］', flicker: '［灯丝噼啪作响］', pickup: '［钟声上行］', whoosh: '［风声掠过］',
      static: '［电视雪花噪声］', thunk: '［沉闷的撞击］', reverse: '［倒放般的吸气声］', reveal: '［和弦展开］',
      valve: '［阀门转动，金属尖啸］', click: null, deny: '［低沉的否定音］', step: null,
    }[name];
    if (caption) this.captionFn(caption, 'sfx');
    const nz = (ft, f, q, dur) => {
      const fl = c.createBiquadFilter();
      fl.type = ft;
      fl.frequency.value = f;
      fl.Q.value = q;
      this._noiseSrc(t, dur).connect(fl).connect(g);
      return fl;
    };
    switch (name) {
      case 'click': {
        const o = c.createOscillator();
        o.frequency.value = 1200;
        o.connect(g);
        this._env(g, t, 0.001, 0.08, 0.005, 0.04);
        o.start(t);
        o.stop(t + 0.08);
        break;
      }
      case 'curtain': {
        const fl = nz('bandpass', 600, 0.8, 1.8);
        fl.frequency.exponentialRampToValueAtTime(2400, t + 1.2);
        this._env(g, t, 0.4, 0.5, 0.6, 0.8);
        break;
      }
      case 'whoosh': {
        const fl = nz('lowpass', 200, 4, 2);
        fl.frequency.exponentialRampToValueAtTime(5000, t + 1);
        fl.frequency.exponentialRampToValueAtTime(300, t + 1.8);
        this._env(g, t, 0.6, 0.6, 0.6, 0.8);
        break;
      }
      case 'static':
        nz('highpass', 1000, 0.3, 1);
        this._env(g, t, 0.01, 0.25, 0.6, 0.2);
        break;
      case 'flicker':
        for (let i = 0; i < 6; i++) {
          const gg = c.createGain();
          const tt = t + i * 0.07 + Math.random() * 0.04;
          const fl = c.createBiquadFilter();
          fl.type = 'highpass';
          fl.frequency.value = 2000;
          this._noiseSrc(tt, 0.05).connect(fl).connect(gg).connect(g);
          this._env(gg, tt, 0.001, 0.4, 0.01, 0.03);
        }
        g.gain.value = 1;
        break;
      case 'step': {
        const fl = nz('lowpass', 380 + Math.random() * 120, 1.2, 0.12);
        fl.Q.value = 2;
        this._env(g, t, 0.004, 0.22, 0.02, 0.09);
        break;
      }
      case 'thunk': {
        const o = c.createOscillator();
        o.frequency.setValueAtTime(90, t);
        o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
        o.connect(g);
        this._env(g, t, 0.003, 0.9, 0.05, 0.5);
        o.start(t);
        o.stop(t + 0.7);
        break;
      }
      case 'deny': {
        const o = c.createOscillator();
        o.type = 'square';
        o.frequency.value = 98;
        const lp = c.createBiquadFilter();
        lp.frequency.value = 400;
        o.connect(lp).connect(g);
        this._env(g, t, 0.01, 0.12, 0.2, 0.2);
        o.start(t);
        o.stop(t + 0.5);
        break;
      }
      case 'pickup':
      case 'reveal':
        [0, 7, 12, 16, 19].forEach((iv, i) => this._bellTo(midi(62 + iv), t + i * 0.09, 3, g));
        g.gain.value = name === 'reveal' ? 0.7 : 1;
        break;
      case 'valve': {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(300, t);
        o.frequency.linearRampToValueAtTime(520, t + 0.5);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1500;
        bp.Q.value = 12;
        o.connect(bp).connect(g);
        this._env(g, t, 0.05, 0.25, 0.4, 0.3);
        o.start(t);
        o.stop(t + 1);
        break;
      }
      case 'reverse': {
        const buf = this._noiseBuffer(1.6);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] *= Math.pow(i / d.length, 3); // 渐强后戛然而止
        const s = c.createBufferSource();
        s.buffer = buf;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 3;
        s.connect(bp).connect(g);
        g.gain.value = 0.6;
        s.start(t);
        break;
      }
    }
  }

  _bellTo(f, t, dur, dest) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.value = f;
    const g = c.createGain();
    o.connect(g).connect(dest);
    this._env(g, t, 0.004, 0.15, 0.05, dur);
    o.start(t);
    o.stop(t + dur + 0.2);
  }

  _noiseBuffer(sec) {
    const c = this.ctx;
    const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // 混一点褐噪，更暖
      d[i] = w * 0.6 + last * 3;
    }
    return b;
  }

  _impulse(sec, decay) {
    const c = this.ctx;
    const len = c.sampleRate * sec;
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  suspend() {
    return this.ctx?.suspend();
  }
  resume() {
    return this.ctx?.resume();
  }
}
