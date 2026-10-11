// 动态音乐状态机（纯逻辑，不依赖 WebAudio，便于测试）。
// 每个状态定义：速度、各声部层的目标音量、切换的量化方式。
// 事件驱动切换；“临时状态”(revelation / menu) 到期或关闭后回到基础状态。

export const LAYERS = ['pad', 'bass', 'brush', 'keys', 'drone', 'pulse', 'metal', 'lead'];

export const STATES = {
  silence:       { bpm: 60, layers: {}, kind: 'base', label: '寂静' },
  explore:       { bpm: 64, layers: { pad: 0.55, bass: 0.6, brush: 0.35, keys: 0.3 }, kind: 'base', label: '双 R 餐馆 · 暗爵士' },
  tension:       { bpm: 62, layers: { drone: 0.7, pulse: 0.5, pad: 0.2 }, kind: 'base', label: '红房间 · 不安' },
  dream_highway: { bpm: 84, layers: { drone: 0.4, pulse: 0.65, bass: 0.55, metal: 0.15 }, kind: 'base', label: '梦境 · 夜路' },
  dream_theater: { bpm: 60, layers: { pad: 0.4, bass: 0.3, brush: 0.15, keys: 0.35 }, kind: 'base', label: '大北方旅馆 · 黄铜与木头' },
  dream_radiator:{ bpm: 56, layers: { drone: 0.45, metal: 0.12, pad: 0.15 }, kind: 'base', label: '森林 · 低频与风' },
  finale:        { bpm: 58, layers: { pad: 0.6, drone: 0.2, bass: 0.2, keys: 0.2 }, kind: 'base', label: '终章' },
  revelation:    { bpm: 60, layers: { pad: 0.8, keys: 0.6, drone: 0.3 }, kind: 'transient', expireBars: 4, label: '揭示' },
  menu:          { bpm: 60, layers: { pad: 0.35, drone: 0.2 }, kind: 'overlay', label: '菜单', lowpass: 700 },
};

// [从状态(* 表示任意), 事件] -> 切换参数
const T = [
  ['*', 'enter:redroom', { to: 'explore', quantize: 'bar', fade: 3 }],
  ['*', 'enter:highway', { to: 'dream_highway', quantize: 'now', fade: 1.5 }],
  ['*', 'enter:theater', { to: 'dream_theater', quantize: 'now', fade: 2.5 }],
  ['*', 'enter:radiator', { to: 'dream_radiator', quantize: 'now', fade: 2 }],
  ['explore', 'lamp:off', { to: 'tension', quantize: 'beat', fade: 1.2 }],
  ['explore', 'danger', { to: 'tension', quantize: 'beat', fade: 1 }],
  ['tension', 'lamp:on', { to: 'explore', quantize: 'bar', fade: 3 }],
  ['tension', 'calm', { to: 'explore', quantize: 'bar', fade: 4 }],
  ['explore', 'idle', { to: 'silence', quantize: 'bar', fade: 8 }],
  ['silence', 'activity', { to: 'explore', quantize: 'bar', fade: 4 }],
  ['*', 'fragment', { to: 'revelation', quantize: 'beat', fade: 0.6 }],
  ['*', 'finale', { to: 'finale', quantize: 'bar', fade: 5 }],
  ['*', 'menu:open', { to: 'menu', quantize: 'now', fade: 0.4 }],
];

export class MusicFSM {
  constructor(initial = 'silence') {
    this.state = initial;
    this.base = initial; // 最近的基础状态
    this.overlayReturn = null;
    this.barsInState = 0;
    this.listeners = new Set();
  }
  get def() {
    return STATES[this.state];
  }
  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  _go(to, quantize, fade, reason) {
    if (!STATES[to]) throw new Error(`未知音乐状态 ${to}`);
    const from = this.state;
    if (from === to) return null;
    const kind = STATES[to].kind;
    if (kind === 'overlay') this.overlayReturn = from;
    if (kind === 'base') this.base = to;
    this.state = to;
    this.barsInState = 0;
    const tr = { from, to, quantize, fade, reason };
    this.listeners.forEach((fn) => fn(tr));
    return tr;
  }
  dispatch(event) {
    // 菜单打开时，只响应关闭；其余基础切换记录为“返回目标”
    if (this.state === 'menu') {
      if (event === 'menu:close') {
        const back = this.overlayReturn ?? this.base;
        this.overlayReturn = null;
        return this._go(back, 'now', 0.6, event);
      }
      const rule = this._match(this.base, event);
      if (rule && STATES[rule.to].kind === 'base') {
        this.base = rule.to;
        this.overlayReturn = rule.to;
      }
      return null;
    }
    if (event === 'menu:close') return null;
    const rule = this._match(this.state, event);
    if (!rule) return null;
    return this._go(rule.to, rule.quantize, rule.fade, event);
  }
  _match(state, event) {
    const exact = T.find(([s, e]) => s === state && e === event);
    const any = T.find(([s, e]) => s === '*' && e === event);
    return (exact ?? any)?.[2] ?? null;
  }
  // 由调度器每小节调用
  onBar() {
    this.barsInState++;
    const d = this.def;
    if (d.kind === 'transient' && this.barsInState >= d.expireBars) {
      return this._go(this.base, 'bar', 3, 'expire');
    }
    return null;
  }
}
