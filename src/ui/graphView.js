// 人物与主题关联图：简单力导向布局（Canvas 2D），支持拖拽、悬停、点击聚焦，键盘可在侧栏列表中浏览。
const COLORS = { person: '#e9c46a', theme: '#7fb3d5', work: '#d9473f' };

export class GraphView {
  constructor(canvas, graph, onSelect) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect;
    const W = 1000, H = 700;
    this.nodes = graph.nodes.map((n, i) => ({
      ...n,
      x: n.center ? W / 2 : W / 2 + Math.cos(i * 2.4) * (200 + (i % 7) * 30),
      y: n.center ? H / 2 : H / 2 + Math.sin(i * 2.4) * (160 + (i % 5) * 30),
      vx: 0, vy: 0,
      r: n.center ? 14 : n.type === 'work' ? 7 : n.type === 'theme' ? 6 : 5,
    }));
    this.byId = Object.fromEntries(this.nodes.map((n) => [n.id, n]));
    this.edges = graph.edges.map((e) => ({ ...e, a: this.byId[e.source], b: this.byId[e.target] })).filter((e) => e.a && e.b);
    this.view = { x: 0, y: 0, k: 0.85 };
    this.selected = null;
    this.hover = null;
    this.alpha = 1;
    this._bind();
    this._resize();
    this.raf = requestAnimationFrame(() => this._loop());
  }
  _resize() {
    const r = this.c.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.c.width = r.width * dpr;
    this.c.height = r.height * dpr;
    this.dpr = dpr;
    this.view.x = r.width / 2 - 500 * this.view.k;
    this.view.y = r.height / 2 - 350 * this.view.k;
  }
  _toWorld(px, py) {
    return [(px - this.view.x) / this.view.k, (py - this.view.y) / this.view.k];
  }
  _pick(px, py) {
    const [x, y] = this._toWorld(px, py);
    return this.nodes.find((n) => Math.hypot(n.x - x, n.y - y) < n.r + 5);
  }
  _bind() {
    const c = this.c;
    let drag = null, pan = null;
    c.addEventListener('pointerdown', (e) => {
      const r = c.getBoundingClientRect();
      const n = this._pick(e.clientX - r.left, e.clientY - r.top);
      if (n) drag = n;
      else pan = [e.clientX, e.clientY, this.view.x, this.view.y];
      c.setPointerCapture(e.pointerId);
      this._down = [e.clientX, e.clientY];
    });
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      if (drag) {
        [drag.x, drag.y] = this._toWorld(e.clientX - r.left, e.clientY - r.top);
        drag.vx = drag.vy = 0;
        this.alpha = Math.max(this.alpha, 0.3);
      } else if (pan) {
        this.view.x = pan[2] + e.clientX - pan[0];
        this.view.y = pan[3] + e.clientY - pan[1];
      } else this.hover = this._pick(e.clientX - r.left, e.clientY - r.top);
    });
    c.addEventListener('pointerup', (e) => {
      const moved = Math.hypot(e.clientX - this._down[0], e.clientY - this._down[1]);
      if (moved < 5) {
        const r = c.getBoundingClientRect();
        const n = this._pick(e.clientX - r.left, e.clientY - r.top);
        this.select(n?.id ?? null);
      }
      drag = pan = null;
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const k = Math.min(3, Math.max(0.3, this.view.k * (e.deltaY < 0 ? 1.1 : 0.9)));
      this.view.x = px - ((px - this.view.x) / this.view.k) * k;
      this.view.y = py - ((py - this.view.y) / this.view.k) * k;
      this.view.k = k;
    }, { passive: false });
  }
  select(id) {
    this.selected = id ? this.byId[id] : null;
    this.onSelect?.(this.selected, this.neighbors(id));
  }
  neighbors(id) {
    if (!id) return [];
    return this.edges.filter((e) => e.a.id === id || e.b.id === id).map((e) => (e.a.id === id ? e.b : e.a));
  }
  _step() {
    if (this.alpha < 0.005) return;
    const N = this.nodes;
    for (let i = 0; i < N.length; i++) {
      for (let j = i + 1; j < N.length; j++) {
        const a = N[i], b = N[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy + 0.01;
        const f = (1400 / d2) * this.alpha;
        dx *= f; dy *= f;
        a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
      }
    }
    for (const e of this.edges) {
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
      const d = Math.hypot(dx, dy) || 1;
      const L = e.kind === 'made' ? 170 : 90;
      const f = ((d - L) / d) * 0.02 * this.alpha;
      e.a.vx += dx * f; e.a.vy += dy * f; e.b.vx -= dx * f; e.b.vy -= dy * f;
    }
    for (const n of N) {
      if (n.center) { n.x = 500; n.y = 350; continue; }
      n.vx += (500 - n.x) * 0.0015 * this.alpha;
      n.vy += (350 - n.y) * 0.0015 * this.alpha;
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += n.vx; n.y += n.vy;
    }
    this.alpha *= 0.992;
  }
  _draw() {
    const { ctx, dpr, view } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.c.width, this.c.height);
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);
    const focus = this.selected ?? this.hover;
    const nb = new Set(focus ? this.neighbors(focus.id).map((n) => n.id).concat(focus.id) : []);
    for (const e of this.edges) {
      const on = focus && (e.a === focus || e.b === focus);
      ctx.strokeStyle = on ? 'rgba(233,196,106,.85)' : e.kind === 'theme' ? 'rgba(127,179,213,.12)' : e.kind === 'collab' ? 'rgba(233,196,106,.12)' : 'rgba(217,71,63,.18)';
      ctx.lineWidth = on ? 1.6 : 0.8;
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
    }
    for (const n of this.nodes) {
      const dim = focus && !nb.has(n.id);
      ctx.globalAlpha = dim ? 0.2 : 1;
      ctx.fillStyle = n.center ? '#efe7d6' : COLORS[n.type];
      ctx.beginPath();
      if (n.type === 'theme') {
        ctx.rect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
      } else ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
      if (n === focus) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.fillStyle = '#efe7d6';
      ctx.font = `${n.center ? 15 : 11}px "Noto Sans SC", sans-serif`;
      ctx.textAlign = 'center';
      if (!dim || n.center) ctx.fillText(n.label, n.x, n.y - n.r - 5);
    }
    ctx.globalAlpha = 1;
  }
  _loop() {
    this._step();
    this._draw();
    this.raf = requestAnimationFrame(() => this._loop());
  }
  destroy() {
    cancelAnimationFrame(this.raf);
  }
}
