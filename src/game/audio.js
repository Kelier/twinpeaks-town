// Synthesised soundscape: room tones, footsteps, light switches, whispers, heartbeat, an original lounge loop.
export class Sound {
  constructor() { this.ctx = null; this.loops = []; this.muted = false; this.amb = null; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = .9; this.master.connect(C.destination);
    this.reverb = C.createConvolver(); this.reverb.buffer = this.impulse(3.2, 2.6);
    this.wet = C.createGain(); this.wet.gain.value = .5; this.reverb.connect(this.wet); this.wet.connect(this.master);
    this.dry = C.createGain(); this.dry.connect(this.master); this.dry.connect(this.reverb);
    this.noiseBuf = this.makeNoise(4);
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : .9, this.ctx.currentTime, .2); }
  impulse(sec, decay) {
    const C = this.ctx, len = C.sampleRate * sec, b = C.createBuffer(2, len, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  makeNoise(sec, brown = false) {
    const C = this.ctx, b = C.createBuffer(1, C.sampleRate * sec, C.sampleRate), d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  get t() { return this.ctx.currentTime; }
  out(pan = 0, wet = true) {
    const g = this.ctx.createGain(); const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p); p.connect(wet ? this.dry : this.master); return g;
  }
  noise({ dur = .2, freq = 800, q = 1, type = 'bandpass', gain = .4, attack = .005, pan = 0, when = 0, sweep, buffer } = {}) {
    if (!this.ctx) return; const C = this.ctx, t0 = this.t + when;
    const src = C.createBufferSource(); src.buffer = buffer || this.noiseBuf; src.loop = true;
    const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
    const g = this.out(pan); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    src.connect(f); f.connect(g); src.start(t0, Math.random() * 2); src.stop(t0 + dur + .05);
  }
  tone({ freq = 220, dur = .5, type = 'sine', gain = .2, attack = .01, pan = 0, when = 0, glide, detune = 0 } = {}) {
    if (!this.ctx) return; const C = this.ctx, t0 = this.t + when;
    const o = C.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0); o.detune.value = detune;
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
    const g = this.out(pan); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); o.start(t0); o.stop(t0 + dur + .05);
  }

  // ---------- one-shots ----------
  step(surface = 'wood', pan = 0, run = false) {
    const k = run ? 1.25 : 1;
    if (surface === 'wood') { this.noise({ dur: .09, freq: 380, q: 2, gain: .2 * k, pan }); this.tone({ freq: 90, dur: .08, gain: .12 * k, pan }); }
    else if (surface === 'tile') { this.noise({ dur: .05, freq: 2600, q: 3, gain: .12 * k, pan }); this.tone({ freq: 140, dur: .05, gain: .06, pan }); }
    else if (surface === 'moss') { this.noise({ dur: .14, freq: 900, q: .7, gain: .12 * k, pan }); }
    else if (surface === 'velvet') { this.noise({ dur: .07, freq: 1800, q: 4, gain: .07 * k, pan }); this.tone({ freq: 70, dur: .1, gain: .08, pan }); }
  }
  jump() { this.noise({ dur: .12, freq: 600, q: 1, gain: .12 }); }
  land(h = 1) { this.tone({ freq: 70, dur: .18, gain: .22 * Math.min(1.5, h), glide: 45 }); this.noise({ dur: .12, freq: 300, gain: .18 }); }
  climb() { this.noise({ dur: .3, freq: 500, q: 1.5, gain: .12, sweep: 900 }); this.tone({ freq: 160, dur: .2, gain: .05, type: 'triangle', glide: 120, when: .05 }); }
  click() { this.noise({ dur: .03, freq: 3000, q: 6, gain: .25 }); this.tone({ freq: 1200, dur: .02, gain: .05, type: 'square' }); }
  pickup() { [660, 990, 1320].forEach((f, i) => this.tone({ freq: f, dur: 1.2, gain: .05, when: i * .07 })); }
  creak(pan = 0) { this.tone({ freq: 140, dur: 1.3, type: 'sawtooth', gain: .05, glide: 95, pan }); this.noise({ dur: 1.2, freq: 400, q: 8, gain: .05, sweep: 250, pan }); }
  thud(big = 1) { this.tone({ freq: 55, dur: .9 * big, gain: .45 * big, glide: 30 }); this.noise({ dur: .5, freq: 200, gain: .3 * big, type: 'lowpass' }); }
  glass() { this.noise({ dur: .6, freq: 5000, q: .6, gain: .25, type: 'highpass' }); [2400, 3100, 4200, 5300].forEach((f, i) => this.tone({ freq: f, dur: .6, gain: .04, when: i * .03 + Math.random() * .05 })); }
  buzz(dur = .6) { this.tone({ freq: 60, dur, type: 'sawtooth', gain: .08 }); this.tone({ freq: 120, dur, type: 'square', gain: .025 }); }
  switchOff() { this.click(); this.thud(.7); }
  heartbeat(rate = 1) { this.tone({ freq: 50, dur: .18, gain: .35, glide: 38 }); this.tone({ freq: 46, dur: .2, gain: .25, glide: 35, when: .22 / rate }); }
  growl(pan = 0) { this.tone({ freq: 70, dur: 1.4, type: 'sawtooth', gain: .12, glide: 52, pan }); this.noise({ dur: 1.4, freq: 300, q: 3, gain: .15, pan, sweep: 180 }); }
  scream() { this.noise({ dur: 1.6, freq: 1200, q: 2, gain: .2, sweep: 500 }); this.tone({ freq: 420, dur: 1.4, type: 'sawtooth', gain: .06, glide: 210 }); }
  whisper(pan = 0, dur = 2.2) {
    // vowel-shaped breath with a reversed envelope: rises into silence
    if (!this.ctx) return; const C = this.ctx, t0 = this.t;
    [700, 1150, 2600].forEach((f, i) => {
      const src = C.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9; bp.frequency.setValueAtTime(f, t0); bp.frequency.linearRampToValueAtTime(f * (1.2 - i * .1), t0 + dur);
      const g = this.out(pan); g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.09, t0 + dur * .92); g.gain.linearRampToValueAtTime(0, t0 + dur);
      src.connect(bp); bp.connect(g); src.start(t0); src.stop(t0 + dur + .05);
    });
  }
  giantVoice() { [55, 82.5, 110].forEach((f, i) => this.tone({ freq: f, dur: 2.4, type: 'sawtooth', gain: .06 - i * .015, attack: .4 })); this.noise({ dur: 2.2, freq: 220, q: 6, gain: .08, attack: .4 }); }
  sting() { // title / chapter: low piano-ish strike + shimmer
    [41.2, 82.4, 123.5, 164.8].forEach((f, i) => this.tone({ freq: f, dur: 5, type: i ? 'triangle' : 'sine', gain: .14 / (i + 1), attack: .005 }));
    this.tone({ freq: 659, dur: 4, gain: .02, attack: 1.2 }); this.tone({ freq: 622, dur: 4, gain: .015, attack: 1.4 });
  }
  transition() { this.switchOff(); this.noise({ dur: 2.5, freq: 120, type: 'lowpass', gain: .25, attack: .02 }); }

  // ---------- ambiences ----------
  stopAmbience(fade = 1.2) {
    if (!this.ctx) return; for (const l of this.loops) { try { l.g.gain.setTargetAtTime(0, this.t, fade / 3); setTimeout(() => l.stop(), fade * 1000 + 200); } catch { } }
    this.loops = []; clearInterval(this.seqTimer);
  }
  loopNoise(freq, gain, { type = 'lowpass', q = .7, brown = true, lfo = 0 } = {}) {
    const C = this.ctx; const src = C.createBufferSource(); src.buffer = brown ? (this.brown ||= this.makeNoise(6, true)) : this.noiseBuf; src.loop = true;
    const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = C.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(gain, this.t, 1.2);
    src.connect(f); f.connect(g); g.connect(this.dry); src.start();
    if (lfo) { const o = C.createOscillator(); o.frequency.value = lfo; const og = C.createGain(); og.gain.value = freq * .4; o.connect(og); og.connect(f.frequency); o.start(); }
    const l = { g, stop: () => src.stop() }; this.loops.push(l); return l;
  }
  loopTone(freq, gain, type = 'sine', vib = 0) {
    const C = this.ctx; const o = C.createOscillator(); o.type = type; o.frequency.value = freq;
    if (vib) { const v = C.createOscillator(); v.frequency.value = vib; const vg = C.createGain(); vg.gain.value = freq * .006; v.connect(vg); vg.connect(o.frequency); v.start(); }
    const g = C.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(gain, this.t, 2);
    o.connect(g); g.connect(this.dry); o.start(); const l = { g, stop: () => o.stop() }; this.loops.push(l); return l;
  }
  // noMusic: keep the room tone but drop the synthesized score (a user-supplied OST cue is playing instead)
  ambience(kind, { noMusic = false } = {}) {
    if (!this.ctx) return; this.stopAmbience(.8); this.noMusic = noMusic;
    if (kind === 'hotel') { this.loopNoise(180, .12); this.loopTone(55, .05, 'sine', .1); this.loopTone(82.4, .02, 'triangle', .07); this.clock(); }
    if (kind === 'diner') { this.loopNoise(2400, .05, { type: 'bandpass', q: .4, brown: false }); this.loopNoise(140, .08); this.loopTone(60, .02, 'sawtooth'); this.loopTone(120, .006, 'square'); }
    if (kind === 'forest') { this.loopNoise(420, .16, { lfo: .07 }); this.loopTone(41, .07, 'sine', .05); this.loopTone(61.7, .025, 'triangle', .09); this.owls(); }
    if (kind === 'redroom') { this.loopNoise(260, .05); this.lounge(); }
    if (kind === 'station') { this.loopTone(120, .012, 'sawtooth'); this.loopTone(60, .02, 'sine'); this.loopNoise(300, .06); this.typewriter(); }
    if (kind === 'roadhouse') { this.loopNoise(500, .04); this.ballad(); }
    if (kind === 'cabin') { this.loopNoise(160, .1, { lfo: .05 }); this.crackle(); }
    if (kind === 'palmer') { this.loopNoise(200, .05); this.record(); }
    if (kind === 'shore') { this.loopNoise(700, .09, { lfo: .11 }); this.loopNoise(160, .1, { lfo: .05 }); this.loopTone(49, .04, 'sine', .06); this.lapping(); }
    if (kind === 'dream') { this.loopNoise(220, .05); this.loopTone(36.7, .05, 'sine', .04); this.lounge(true); }
    if (kind === 'cell') { this.loopTone(120, .016, 'sawtooth'); this.loopTone(240, .004, 'square'); this.loopNoise(260, .05); this.drip(); }
    if (kind === 'title') { this.loopNoise(150, .1); this.loopTone(41.2, .07, 'sine', .08); this.loopTone(98, .015, 'triangle', .11); }
  }
  typewriter() { this.seqTimer = setInterval(() => { if (Math.random() < .5) for (let i = 0; i < 3 + Math.random() * 6; i++) this.noise({ dur: .03, freq: 3000, q: 4, gain: .03, when: i * .09, pan: -.6 }); }, 2600); }
  crackle() { this.seqTimer = setInterval(() => { for (let i = 0; i < 3; i++) if (Math.random() < .6) this.noise({ dur: .02 + Math.random() * .04, freq: 1500 + Math.random() * 2500, q: 2, gain: .05 + Math.random() * .05, when: Math.random() * .3, pan: -.3 }); }, 300); }
  ballad() {
    if (this.noMusic) return;
    // an original slow dream-pop ballad: soft pad chords, a distant breathy melody, brushed snare
    const chords = [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]];
    const mel = [659.3, 587.3, 523.3, 587.3, 493.9, 523.3, 440, 493.9, 523.3, 587.3, 659.3, 587.3, 523.3, 493.9, 440, 0];
    let i = 0; const beat = 60 / 54;
    this.seqTimer = setInterval(() => {
      if (!this.ctx) return;
      if (i % 4 === 0) chords[(i / 4) % 4 | 0].forEach((f, k) => this.tone({ freq: f, dur: beat * 4.2, type: 'triangle', gain: .035, attack: .6, pan: k - 1 }));
      const m = mel[i % mel.length]; if (m) { this.tone({ freq: m, dur: beat * 1.6, type: 'sine', gain: .045, attack: .25, pan: .2 }); this.tone({ freq: m * 2, dur: beat * 1.2, type: 'sine', gain: .006, attack: .3 }); }
      if (i % 2 === 1) this.noise({ dur: .5, freq: 5000, q: .4, gain: .025, type: 'highpass', attack: .06 });
      if (i % 4 === 0) this.tone({ freq: chords[(i / 4) % 4 | 0][0] / 2, dur: beat * 2, type: 'sine', gain: .08 });
      i++;
    }, beat * 1000);
  }
  record() {
    if (this.noMusic) return;
    // a crackling old swing record for Leland's dance
    const bass = [98, 123.5, 146.8, 164.8, 146.8, 123.5]; let i = 0; const beat = 60 / 110;
    this.seqTimer = setInterval(() => {
      if (!this.ctx) return;
      this.noise({ dur: .04, freq: 3000, q: 1, gain: .015 });
      this.tone({ freq: bass[i % 6], dur: beat * .8, type: 'triangle', gain: .07 });
      if (i % 2) this.noise({ dur: .1, freq: 4000, q: 1, gain: .03, type: 'highpass' });
      if (i % 4 === 0) [392, 493.9, 587.3].forEach((f) => this.tone({ freq: f, dur: beat * 1.5, type: 'square', gain: .008, attack: .02 }));
      i++;
    }, beat * 1000);
  }
  lapping() { this.seqTimer = setInterval(() => { if (!this.ctx) return; this.noise({ dur: 1.4 + Math.random(), freq: 500 + Math.random() * 300, q: .8, gain: .06, attack: .5, pan: Math.random() - .5 }); if (Math.random() < .2) this.tone({ freq: 880, dur: .3, gain: .006, glide: 700 }); }, 2300); }
  drip() { this.seqTimer = setInterval(() => { if (!this.ctx || Math.random() < .3) return; this.tone({ freq: 1400 + Math.random() * 500, dur: .12, gain: .03, glide: 700, pan: .5 }); }, 1700); }
  clock() { let k = 0; this.seqTimer = setInterval(() => { if (!this.ctx) return; this.noise({ dur: .03, freq: k++ % 2 ? 3400 : 2900, q: 9, gain: .05, pan: .4 }); }, 1000); }
  owls() { this.seqTimer = setInterval(() => { if (Math.random() < .35) { const p = Math.random() * 2 - 1; this.tone({ freq: 392, dur: .5, gain: .025, attack: .1, pan: p, glide: 370 }); this.tone({ freq: 392, dur: .9, gain: .02, attack: .1, pan: p, when: .6, glide: 349 }); } }, 4200); }
  lounge(reversed = false) {
    if (this.noMusic) return;
    // original slow lounge: walking bass, brushed snare, finger snaps, a far-away vibraphone (in A minor)
    const bass = [55, 65.4, 73.4, 82.4, 87.3, 82.4, 73.4, 65.4], vib = [440, 523.3, 659.3, 587.3, 523.3, 493.9];
    let i = 0; const beat = 60 / 64;
    this.seqTimer = setInterval(() => {
      if (!this.ctx) return;
      // in the dream the bass walks backwards and every note swells in (a played-in-reverse feel)
      this.tone({ freq: bass[reversed ? 7 - (i % 8) : i % 8], dur: beat * .9, type: 'triangle', gain: .14, attack: reversed ? beat * .8 : .01 });
      if (i % 2) { this.noise({ dur: .35, freq: 4500, q: .5, gain: .04, type: 'highpass', attack: .02 }); this.noise({ dur: .03, freq: 2200, q: 8, gain: .07, when: .02 }); }
      if (i % 4 === 0 && Math.random() < .7) this.tone({ freq: vib[(i / 4) % vib.length | 0], dur: 2.6, gain: .03, attack: .005, pan: -.3 });
      i++;
    }, beat * 1000);
  }
}
