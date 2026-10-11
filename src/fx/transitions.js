// 转场动画库：作用于后期着色器 uniforms 与 DOM 遮罩。
// 每个转场有 out（遮住画面）与 in（揭开画面）两半，切换空间时：await out → 换场景 → await in。
import { tween, ease, wait } from './tween.js';

export const TRANSITIONS = {
  fade: { label: '淡入淡出', uniform: 'uFade', duration: 1.2, safe: true },
  curtain: { label: '红幕合拢', uniform: 'uCurtain', duration: 1.6, safe: true, sfx: 'curtain' },
  zigzag: { label: 'Z 字擦除', uniform: 'uZig', duration: 1.4, safe: true, sfx: 'whoosh' },
  static: { label: '电视雪花', uniform: 'uStatic', duration: 0.9, safe: false, sfx: 'static' },
  iris: { label: '光圈收缩', uniform: 'uIris', duration: 1.3, safe: true },
  invert: { label: '负片闪烁', uniform: 'uInvert', duration: 0.5, safe: false, sfx: 'reverse' },
};

export class Transitioner {
  constructor(engine, audio, settings) {
    this.u = engine.u;
    this.audio = audio;
    this.settings = settings;
    this.busy = false;
  }
  // “减少闪烁”开启时，负片 / 雪花类转场替换为淡入淡出（WCAG 2.3.1：任何情况下都不做每秒超过 3 次的闪烁）
  resolve(name) {
    const t = TRANSITIONS[name] ?? TRANSITIONS.fade;
    if (this.settings.reducedFlashing && !t.safe) return ['fade', TRANSITIONS.fade];
    return [name, t];
  }
  async out(name = 'fade', duration) {
    const [, t] = this.resolve(name);
    if (t.sfx) this.audio.sfx(t.sfx);
    const d = duration ?? t.duration;
    if (t.uniform === 'uInvert') {
      await tween(d, (k) => (this.u.uInvert.value = Math.sin(k * Math.PI)), ease.linear);
      await tween(0.4, (k) => (this.u.uFade.value = k));
      this._cover = 'uFade';
      return;
    }
    await tween(d, (k) => (this.u[t.uniform].value = k), ease.inOut);
    if (t.uniform === 'uStatic') {
      await tween(0.25, (k) => (this.u.uFade.value = k));
      this._cover = 'uFade';
      this.u.uStatic.value = 0;
      return;
    }
    this._cover = t.uniform;
  }
  async in(name, duration) {
    const [, t] = this.resolve(name ?? 'fade');
    const uni = this._cover ?? t.uniform;
    const d = duration ?? t.duration;
    await tween(d, (k) => (this.u[uni].value = 1 - k), ease.inOut);
    this._cover = null;
  }
  async play(name, mid, durationOut, durationIn) {
    this.busy = true;
    await this.out(name, durationOut);
    await mid?.();
    await wait(0.15);
    await this.in(name, durationIn);
    this.busy = false;
  }
  reset() {
    for (const k of ['uFade', 'uCurtain', 'uZig', 'uStatic', 'uIris', 'uInvert']) this.u[k].value = 0;
  }
}
