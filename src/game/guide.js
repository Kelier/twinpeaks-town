// 导览 · Crayon scrapbook guides (David Lynch / Fire Walk with Me).
// Self-contained: a procedural crayon drawing kit on <canvas>, page scenes, and a full-screen
// sticker-book overlay. API: openGuide(id, { onClose }) -> close()
import './guide.css';
import { T, getLang, onLang, setLang, LANGS } from './i18n.js';
import { GUIDES, GUIDE_SOURCES } from './guide-data.js';

/* ───────────────────────── crayon kit ───────────────────────── */

const C = {
  red: '#d7262b', dred: '#8e1b20', black: '#221d1e', yellow: '#ffc61a', orange: '#f5841f',
  blue: '#2a5bd0', sky: '#7cc3f2', navy: '#1c2760', green: '#3b9d3e', dgreen: '#1d5e35',
  brown: '#7a4a28', tan: '#dcae6e', pink: '#f59bbb', purple: '#7650b4', white: '#fffef8',
  gray: '#8b8782', lgray: '#c9c4bb', gold: '#e9a91c', skin: '#f7c9a0', cream: '#fff1c2',
  teal: '#2aa7a0', blond: '#f3cf55',
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const D2R = Math.PI / 180;

let grainCanvas = null;
function grainTile() {
  if (grainCanvas) return grainCanvas;
  const g = document.createElement('canvas'); g.width = g.height = 192;
  const x = g.getContext('2d'); const img = x.createImageData(192, 192); const r = mulberry32(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r();
    img.data[i + 3] = v < 0.16 ? 140 + r() * 115 : v < 0.3 ? r() * 70 : 0;
  }
  x.putImageData(img, 0, 0);
  // a few short horizontal "paper tooth" streaks
  x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(0,0,0,.6)';
  for (let i = 0; i < 160; i++) x.fillRect(r() * 192, r() * 192, 1 + r() * 4, 1);
  grainCanvas = g; return g;
}

class Kit {
  constructor(ctx, seed) { this.c = ctx; this.r = mulberry32(seed); }
  rr(a, b) { return a + (b - a) * this.r(); }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }

  // densify a polyline and wobble it (low-frequency wave + a little jitter)
  wob(pts, amt = 2.5, step = 9) {
    const out = []; const ph = this.r() * 10, f = this.rr(0.02, 0.05); let dist = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const L = Math.hypot(x1 - x0, y1 - y0) || 1; const n = Math.max(1, Math.ceil(L / step));
      const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      for (let j = 0; j < n; j++) {
        const t = j / n, d = dist + L * t;
        const o = Math.sin(d * f + ph) * amt * 0.7 + (this.r() - 0.5) * amt * 0.6;
        out.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]);
      }
      dist += L;
    }
    const l = pts[pts.length - 1]; out.push([l[0] + (this.r() - 0.5) * amt * 0.4, l[1] + (this.r() - 0.5) * amt * 0.4]);
    return out;
  }
  path(pts) {
    const c = this.c; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1]; c.lineTo(l[0], l[1]);
  }
  /** crayon stroke along a polyline */
  line(pts, color = C.black, w = 5, o = {}) {
    if (pts.length < 2) return;
    const c = this.c; const passes = o.passes ?? 2; const a = o.alpha ?? 1; const wb = o.wob ?? w * 0.35 + 1.3;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = color;
    for (let p = 0; p < passes; p++) {
      c.globalAlpha = a * this.rr(0.62, 0.9); c.lineWidth = w * this.rr(0.75, 1.1);
      this.path(this.wob(pts, wb)); c.stroke();
    }
    c.globalAlpha = a * 0.3; c.lineWidth = Math.max(1, w * 0.3); this.path(this.wob(pts, wb * 1.5)); c.stroke();
    c.restore();
  }
  /** crayon fill: clipped hatching, slightly spilling over the outline like a kid's colouring */
  hatch(pts, color, o = {}) {
    const c = this.c; let cx = 0, cy = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { cx += x; cy += y; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    cx /= pts.length; cy /= pts.length;
    const sc = o.spill ?? 1.015;
    const cp = this.wob([...pts, pts[0]].map(([x, y]) => [cx + (x - cx) * sc, cy + (y - cy) * sc]), 2.2, 12);
    c.save(); this.path(cp); c.closePath(); c.clip();
    c.strokeStyle = color; c.lineCap = 'round';
    const bx = (x0 + x1) / 2, by = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 12;
    const gap = o.gap ?? Math.max(4, Math.min(7, Math.sqrt((x1 - x0) * (y1 - y0)) / 22));
    const A = o.alpha ?? 0.88; const ang = o.angle ?? this.rr(-0.95, -0.55);
    const pass = (a, alpha, g, wmin, wmax) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let d = -R; d <= R; d += g * this.rr(0.65, 1.25)) {
        const px = bx - sa * d, py = by + ca * d;
        const p1 = [px - ca * R, py - sa * R], p2 = [px + ca * R, py + sa * R];
        c.globalAlpha = alpha * this.rr(0.55, 1); c.lineWidth = this.rr(wmin, wmax);
        c.beginPath(); c.moveTo(p1[0], p1[1]);
        c.quadraticCurveTo((p1[0] + p2[0]) / 2 + this.rr(-4, 4), (p1[1] + p2[1]) / 2 + this.rr(-4, 4), p2[0], p2[1]); c.stroke();
      }
    };
    pass(ang, A, gap, gap * 0.8, gap * 1.45);
    pass(ang + this.rr(0.5, 0.9), A * 0.5, gap * 1.7, gap * 0.4, gap * 0.95);
    c.restore();
  }
  /** polygon with optional crayon fill + wobbly outline that overshoots its start, like a kid's */
  poly(pts, o = {}) {
    if (o.fill) this.hatch(pts, o.fill, o);
    if (o.stroke !== false) {
      const p = [...pts, pts[0]]; if (o.open) p.pop();
      else if (pts.length > 2) { const [a, b] = [pts[0], pts[1]]; p.push([a[0] + (b[0] - a[0]) * 0.25, a[1] + (b[1] - a[1]) * 0.25]); }
      this.line(p, o.stroke ?? C.black, o.w ?? 4.5, { alpha: o.lineAlpha ?? 1, passes: o.passes });
    }
  }
  ellipsePts(cx, cy, rx, ry, n = 30, rot = 0) {
    const pts = []; const ph = this.r() * 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rot; const j = 1 + Math.sin(a * 2 + ph) * 0.03 + (this.r() - 0.5) * 0.02;
      pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
    }
    return pts;
  }
  polar(cx, cy, rx, ry, fn, n = 60, rot = 0) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rot; const m = fn(a); pts.push([cx + Math.cos(a) * rx * m, cy + Math.sin(a) * ry * m]); }
    return pts;
  }
  circle(cx, cy, r, o = {}) { this.poly(this.ellipsePts(cx, cy, r, r, Math.max(14, Math.round(r / 3)), this.r() * 6), o); }
  ellipse(cx, cy, rx, ry, o = {}) { this.poly(this.ellipsePts(cx, cy, rx, ry, Math.max(14, Math.round(Math.max(rx, ry) / 3))), o); }
  rect(x, y, w, h, o = {}) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o); }
  dot(x, y, r, color = C.black, a = 0.92) {
    const c = this.c; c.save(); c.globalAlpha = a; c.fillStyle = color; c.beginPath();
    c.ellipse(x, y, r * this.rr(0.85, 1.1), r * this.rr(0.85, 1.1), this.r() * 3, 0, Math.PI * 2); c.fill(); c.restore();
  }
  starPts(cx, cy, r, n = 5, inner = 0.45, rot = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const rad = i % 2 ? r * inner : r; const a = rot + (i / (n * 2)) * Math.PI * 2; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
    return pts;
  }
  star(cx, cy, r, fill = C.yellow, stroke = C.orange) { this.poly(this.starPts(cx, cy, r, 5, 0.45, -Math.PI / 2 + this.rr(-0.2, 0.2)), { fill, stroke, w: Math.max(2.5, r / 9) }); }
  twinkle(x, y, s, color = C.yellow) { this.line([[x - s, y], [x + s, y]], color, 3); this.line([[x, y - s], [x, y + s]], color, 3); }
  text(str, x, y, o = {}) {
    const c = this.c; const size = o.size ?? 40;
    c.save(); c.translate(x, y); c.rotate((o.rot ?? this.rr(-3, 3)) * D2R);
    c.font = `${size}px 'Kid EN','Kid ZH',sans-serif`; c.textAlign = o.align ?? 'center'; c.textBaseline = 'middle';
    c.fillStyle = o.color ?? C.black;
    for (let i = 0; i < 2; i++) { c.globalAlpha = 0.75; c.fillText(str, this.rr(-1, 1), this.rr(-1, 1)); }
    c.restore();
  }
  spiral(cx, cy, r, turns = 3, color = C.black, w = 3) {
    const pts = []; const n = turns * 24;
    for (let i = 0; i <= n; i++) { const t = i / n; const a = t * turns * Math.PI * 2; pts.push([cx + Math.cos(a) * r * t, cy + Math.sin(a) * r * t]); }
    this.line(pts, color, w, { wob: 1 });
  }
  /** apply waxy grain: knock out random specks so the paper shows through */
  grain(w, h, strength = 0.55) {
    const c = this.c; c.save(); c.globalCompositeOperation = 'destination-out'; c.globalAlpha = strength;
    const pat = c.createPattern(grainTile(), 'repeat'); c.fillStyle = pat;
    c.translate(this.rr(0, 190), this.rr(0, 190)); c.fillRect(-200, -200, w + 400, h + 400); c.restore();
  }
  /** run a drawing in a translated/rotated frame */
  at(x, y, rot, fn) { const c = this.c; c.save(); c.translate(x, y); c.rotate(rot * D2R); fn(); c.restore(); }

  /* ── backgrounds ── */
  sky(color, y0 = 0, y1 = 360, o = {}) { this.rect(-10, y0, 1020, y1 - y0, { fill: color, stroke: false, angle: this.rr(-0.25, -0.1), alpha: o.alpha ?? 0.6, gap: o.gap ?? 8, spill: 1 }); }
  ground(color, y0, y1 = 710, o = {}) {
    const pts = [[-10, y1], [-10, y0]]; for (let x = 0; x <= 1010; x += 100) pts.push([x, y0 + Math.sin(x * 0.01 + 1) * (o.hill ?? 10)]); pts.push([1010, y1]);
    this.poly(pts, { fill: color, stroke: false, alpha: o.alpha ?? 0.7, gap: o.gap ?? 8, spill: 1 });
    if (o.edge !== false) this.line(pts.slice(1, -1), o.edge ?? color, 4);
  }

  /* ── things ── */
  sun(x, y, r, face = true) {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + this.rr(-0.1, 0.1); this.line([[x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2], [x + Math.cos(a) * r * 1.65, y + Math.sin(a) * r * 1.65]], C.orange, 5); }
    this.circle(x, y, r, { fill: C.yellow, stroke: C.orange, w: 5 });
    if (face) { this.dot(x - r * 0.3, y - r * 0.15, r * 0.08); this.dot(x + r * 0.3, y - r * 0.15, r * 0.08); this.smile(x, y + r * 0.12, r * 0.4); }
  }
  smile(x, y, w, color = C.black, sad = false) {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([x - w / 2 + w * t, y + Math.sin(t * Math.PI) * w * 0.32 * (sad ? -1 : 1)]); }
    this.line(pts, color, Math.max(2.5, w / 12), { wob: 0.8 });
  }
  moon(x, y, r) {
    const pts = []; for (let a = -1.75; a <= 1.75; a += 0.15) pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    for (let a = 1.75; a >= -1.75; a -= 0.15) pts.push([x - r * 0.25 + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.98]);
    this.poly(pts, { fill: C.cream, stroke: C.yellow, w: 4 });
  }
  cloud(x, y, s, fill = C.white, stroke = C.sky) { this.poly(this.polar(x, y, s, s * 0.55, (a) => 1 + 0.2 * Math.abs(Math.sin(a * 3.5)), 48), { fill, stroke, w: 4 }); }
  mountain(x, base, hw, h, color, snow = true) {
    const pts = [[x - hw, base], [x - hw * 0.15, base - h * 0.96], [x, base - h], [x + hw * 0.12, base - h * 0.95], [x + hw, base]];
    this.poly(pts, { fill: color, stroke: C.black, w: 4 });
    if (snow) this.poly([[x - hw * 0.15 * 1.9, base - h * 0.72], [x - hw * 0.15, base - h * 0.96], [x, base - h], [x + hw * 0.12, base - h * 0.95], [x + hw * 0.26, base - h * 0.74], [x + hw * 0.1, base - h * 0.78], [x - hw * 0.05, base - h * 0.7], [x - hw * 0.15, base - h * 0.78]], { fill: C.white, stroke: C.black, w: 3 });
  }
  pine(x, base, h, color = C.dgreen) {
    this.rect(x - h * 0.05, base - h * 0.16, h * 0.1, h * 0.16, { fill: C.brown, w: 3 });
    const tiers = 3; for (let i = 0; i < tiers; i++) {
      const tb = base - h * 0.12 - i * h * 0.24, hw = h * (0.3 - i * 0.07);
      this.poly([[x - hw, tb], [x, tb - h * 0.42], [x + hw, tb]], { fill: color, stroke: C.dgreen, w: 3.5 });
    }
  }
  tree(x, base, h) {
    this.rect(x - h * 0.07, base - h * 0.45, h * 0.14, h * 0.45, { fill: C.brown, w: 3.5 });
    this.poly(this.polar(x, base - h * 0.68, h * 0.38, h * 0.32, (a) => 1 + 0.12 * Math.abs(Math.sin(a * 4)), 40), { fill: C.green, stroke: C.dgreen, w: 4 });
  }
  house(x, base, w, h, wall = C.red, roof = C.brown) {
    this.rect(x - w / 2, base - h, w, h, { fill: wall, w: 4.5 });
    this.poly([[x - w * 0.62, base - h], [x, base - h - h * 0.7], [x + w * 0.62, base - h]], { fill: roof, w: 4.5 });
    this.rect(x - w * 0.12, base - h * 0.55, w * 0.24, h * 0.55, { fill: C.brown, w: 3.5 });
    this.rect(x + w * 0.2, base - h * 0.8, w * 0.22, w * 0.2, { fill: C.yellow, w: 3 });
    this.line([[x + w * 0.31, base - h * 0.8], [x + w * 0.31, base - h * 0.8 + w * 0.2]], C.black, 2.5);
    this.rect(x - w * 0.42, base - h * 1.35, w * 0.12, h * 0.4, { fill: C.gray, w: 3 });
    this.spiral(x - w * 0.36, base - h * 1.55, 18, 2, C.gray, 3);
  }
  grass(x0, x1, y, color = C.green) {
    for (let x = x0; x < x1; x += this.rr(10, 22)) this.line([[x, y], [x + this.rr(-4, 4), y - this.rr(10, 22)]], color, 3, { passes: 1 });
  }
  flower(x, y, color = C.red, s = 1) {
    this.line([[x, y], [x + 2, y - 50 * s]], C.green, 4);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; this.circle(x + 2 + Math.cos(a) * 11 * s, y - 50 * s + Math.sin(a) * 11 * s, 9 * s, { fill: color, stroke: false }); }
    this.circle(x + 2, y - 50 * s, 7 * s, { fill: C.yellow, stroke: C.orange, w: 2.5 });
  }
  rose(x, y, s = 1, color = C.blue) {
    this.line([[x, y], [x - 4 * s, y - 40 * s], [x, y - 80 * s]], C.dgreen, 5 * s);
    this.poly([[x - 3 * s, y - 40 * s], [x - 30 * s, y - 52 * s], [x - 8 * s, y - 30 * s]], { fill: C.green, stroke: C.dgreen, w: 3 });
    this.circle(x, y - 98 * s, 24 * s, { fill: color, stroke: C.navy, w: 4 });
    this.spiral(x, y - 98 * s, 18 * s, 2.2, C.navy, 3);
  }
  figure(x, y, s, o = {}) {
    const hr = s * 0.13; const pose = o.pose ?? 'stand';
    const hipY = pose === 'cross' ? y - s * 0.07 : pose === 'sit' ? y - s * 0.17 : y - s * 0.36;
    const top = hipY - s * 0.64; const hx = x, hy = top + hr; const neckY = hy + hr * 0.95; const sh = hr * 1.25;
    const body = o.body ?? 'shirt'; const col = o.color ?? (body === 'suit' ? C.black : C.blue);
    const hairC = o.hairColor ?? C.brown;
    // long hair behind
    if (o.hair === 'long') this.poly([[hx - hr * 1.3, hy + hr * 2.1], [hx - hr * 1.35, hy - hr * 0.2], [hx - hr * 0.8, hy - hr * 1.2], [hx, hy - hr * 1.3], [hx + hr * 0.8, hy - hr * 1.2], [hx + hr * 1.35, hy - hr * 0.2], [hx + hr * 1.3, hy + hr * 2.1]], { fill: hairC, stroke: o.hairLine ?? C.brown, w: 3.5 });
    // legs
    const legC = o.legs ?? (body === 'suit' ? col : body === 'dress' ? C.skin : C.navy);
    if (pose === 'cross') {
      this.ellipse(hx, hipY + s * 0.02, sh * 2.1, s * 0.07, { fill: legC === C.skin ? C.navy : legC, w: 4 });
      this.ellipse(hx - sh * 1.6, hipY + s * 0.05, hr * 0.4, hr * 0.22, { fill: C.black, stroke: false });
      this.ellipse(hx + sh * 1.6, hipY + s * 0.05, hr * 0.4, hr * 0.22, { fill: C.black, stroke: false });
    } else {
      const lw = Math.max(5, s * 0.04);
      this.line([[hx - hr * 0.45, hipY], [hx - hr * 0.6, y - 4]], legC === C.skin ? C.tan : legC, lw);
      this.line([[hx + hr * 0.45, hipY], [hx + hr * 0.6, y - 4]], legC === C.skin ? C.tan : legC, lw);
      this.ellipse(hx - hr * 0.8, y - 4, hr * 0.42, hr * 0.2, { fill: C.black, w: 2.5 });
      this.ellipse(hx + hr * 0.8, y - 4, hr * 0.42, hr * 0.2, { fill: C.black, w: 2.5 });
    }
    // torso
    if (body === 'dress') this.poly([[hx - sh * 0.75, neckY], [hx + sh * 0.75, neckY], [hx + sh * 1.6, hipY + s * 0.09], [hx - sh * 1.6, hipY + s * 0.09]], { fill: col, w: 4 });
    else this.poly([[hx - sh, neckY + 2], [hx + sh, neckY + 2], [hx + sh * 0.92, hipY + 4], [hx - sh * 0.92, hipY + 4]], { fill: col, w: 4 });
    if (body === 'suit') {
      this.poly([[hx - hr * 0.4, neckY + 1], [hx + hr * 0.4, neckY + 1], [hx, neckY + hr * 1.4]], { fill: o.shirt ?? C.white, w: 3 });
      this.dot(hx, neckY + hr * 0.25, hr * 0.09);
    }
    if (o.rose) this.circle(hx - sh * 0.45, neckY + hr * 0.7, hr * 0.32, { fill: C.blue, stroke: C.navy, w: 3 });
    // arms
    const arms = o.arms ?? [20, 20]; const len = s * 0.3; const sy = neckY + hr * 0.35; const aw = Math.max(5, s * 0.035);
    const armC = o.sleeve ?? (body === 'dress' ? C.tan : col);
    const hands = {};
    [[-1, arms[0], 'l'], [1, arms[1], 'r']].forEach(([side, a, k]) => {
      if (a === null || a === undefined) return;
      const sx = hx + side * sh * 0.9; const ex = sx + side * Math.sin(a * D2R) * len, ey = sy + Math.cos(a * D2R) * len;
      const mx = (sx + ex) / 2 + side * 6, my = (sy + ey) / 2;
      this.line([[sx, sy], [mx, my], [ex, ey]], armC, aw);
      this.circle(ex, ey, hr * 0.22, { fill: C.skin, w: 2.5 });
      hands[k] = [ex, ey];
    });
    // head
    this.circle(hx, hy, hr, { fill: o.skin ?? C.skin, stroke: C.brown, w: 3.5 });
    this.hair(hx, hy, hr, o.hair, hairC);
    if (o.hearing) { this.ellipse(hx + hr * 1.05, hy + hr * 0.1, hr * 0.3, hr * 0.45, { fill: C.tan, w: 3 }); this.line([[hx + hr * 1.1, hy + hr * 0.5], [hx + hr * 1.2, hy + hr * 1.1]], C.gray, 3); }
    this.face(hx, hy, hr, o);
    return { hands, head: [hx, hy, hr], hipY, neckY };
  }
  hair(hx, hy, hr, kind, col) {
    const P = (pts) => pts.map(([a, b]) => [hx + a * hr, hy + b * hr]);
    const line = col === C.black || col === '#2d1d18' || col === '#2c2627' ? C.black : (col === '#cfc9bd' || col === '#c8c3bd' || col === '#bdb7ae') ? C.gray : C.brown;
    if (kind === 'lynch') {
      // a big forward-swooping pompadour
      this.poly(P([[-1.0, 0.1], [-1.12, -0.7], [-0.95, -1.3], [-0.5, -1.75], [0.2, -2.05], [0.85, -2.15], [1.45, -1.95], [1.62, -1.55], [1.35, -1.3], [1.05, -1.42], [1.15, -1.0], [1.02, -0.35], [0.7, -0.72], [0.1, -0.8], [-0.5, -0.62], [-0.82, -0.2]]), { fill: col, stroke: line, w: 3.5 });
      for (const [a, b, c] of [[[-0.8, -0.5], [-0.6, -1.4], [0.6, -1.95]], [[-0.3, -0.75], [0.0, -1.45], [1.1, -1.85]], [[0.3, -0.8], [0.55, -1.3], [1.4, -1.6]]]) this.line(P([a, b, c]), line, 2.5, { alpha: 0.65 });
    } else if (kind === 'tall') {
      this.poly(P([[-0.95, -0.2], [-1.1, -1.4], [-0.95, -2.7], [-0.3, -3.05], [0.35, -3.0], [1.0, -2.6], [1.1, -1.4], [0.95, -0.2], [0.5, -0.8], [-0.4, -0.8]]), { fill: col, stroke: C.black, w: 3.5 });
      for (let i = 0; i < 6; i++) { const xx = -0.7 + i * 0.28; this.line(P([[xx, -1.0], [xx + 0.05, -2.6]]), C.black, 2.5, { alpha: 0.5 }); }
    } else if (kind === 'bob' || kind === 'long' || kind === 'short' || kind === 'bun') {
      const k = kind === 'short' ? 0.15 : 0.45;
      this.poly(P([[-1.08, k], [-1.15, -0.55], [-0.6, -1.2], [0.4, -1.25], [1.15, -0.6], [1.08, k], [0.85, -0.4], [0.2, -0.55], [-0.5, -0.45], [-0.85, -0.3]]), { fill: col, stroke: line, w: 3.5 });
      if (kind === 'bun') this.circle(hx, hy - hr * 1.35, hr * 0.42, { fill: col, stroke: line, w: 3 });
    } else if (kind === 'cap') {
      this.poly(P([[-0.95, -0.55], [-0.75, -1.25], [0.75, -1.25], [0.95, -0.55]]), { fill: C.dgreen, w: 3.5 });
      this.ellipse(hx, hy - hr * 0.55, hr * 1.45, hr * 0.22, { fill: C.dgreen, w: 3.5 });
    } else if (kind === 'hat') {
      this.rect(hx - hr * 0.75, hy - hr * 2.0, hr * 1.5, hr * 1.25, { fill: C.black, w: 3.5 });
      this.ellipse(hx, hy - hr * 0.75, hr * 1.4, hr * 0.2, { fill: C.black, w: 3 });
    }
  }
  face(hx, hy, hr, o) {
    const e = o.eyes ?? 'dot';
    if (e === 'closed') { this.smile(hx - hr * 0.35, hy - hr * 0.08, hr * 0.32); this.smile(hx + hr * 0.35, hy - hr * 0.08, hr * 0.32); }
    else { this.dot(hx - hr * 0.35, hy - hr * 0.12, hr * 0.1); this.dot(hx + hr * 0.35, hy - hr * 0.12, hr * 0.1); }
    if (o.glasses) { this.circle(hx - hr * 0.37, hy - hr * 0.12, hr * 0.27, { stroke: C.black, w: 2.5 }); this.circle(hx + hr * 0.37, hy - hr * 0.12, hr * 0.27, { stroke: C.black, w: 2.5 }); }
    this.circle(hx - hr * 0.6, hy + hr * 0.25, hr * 0.15, { fill: C.pink, stroke: false, alpha: 0.6 });
    this.circle(hx + hr * 0.6, hy + hr * 0.25, hr * 0.15, { fill: C.pink, stroke: false, alpha: 0.6 });
    const f = o.face ?? 'smile';
    if (f === 'smile') this.smile(hx, hy + hr * 0.38, hr * 0.6, C.dred);
    else if (f === 'sad') this.smile(hx, hy + hr * 0.5, hr * 0.5, C.dred, true);
    else if (f === 'flat') this.line([[hx - hr * 0.25, hy + hr * 0.45], [hx + hr * 0.25, hy + hr * 0.45]], C.dred, 3);
    else if (f === 'o') this.circle(hx, hy + hr * 0.45, hr * 0.15, { stroke: C.dred, w: 3 });
    else if (f === 'shout') this.ellipse(hx, hy + hr * 0.45, hr * 0.28, hr * 0.22, { fill: C.dred, w: 3 });
    if (o.tears) { this.ellipse(hx - hr * 0.42, hy + hr * 0.25, hr * 0.08, hr * 0.15, { fill: C.sky, stroke: C.blue, w: 2 }); this.ellipse(hx + hr * 0.45, hy + hr * 0.35, hr * 0.08, hr * 0.15, { fill: C.sky, stroke: C.blue, w: 2 }); }
  }
  cup(x, y, s = 60) {
    for (let i = -1; i <= 1; i++) { const pts = []; for (let t = 0; t <= 1; t += 0.12) pts.push([x + i * s * 0.25 + Math.sin(t * 9 + i) * s * 0.08, y - s * 0.6 - t * s * 0.7]); this.line(pts, C.lgray, 3); }
    this.poly([[x - s * 0.45, y - s * 0.45], [x + s * 0.45, y - s * 0.45], [x + s * 0.36, y + s * 0.42], [x - s * 0.36, y + s * 0.42]], { fill: C.white, w: 4 });
    this.ellipse(x, y - s * 0.45, s * 0.43, s * 0.1, { fill: C.brown, w: 3 });
    this.ellipse(x + s * 0.55, y - s * 0.05, s * 0.18, s * 0.22, { stroke: C.black, w: 4 });
    this.line([[x - s * 0.4, y - s * 0.1], [x + s * 0.4, y - s * 0.1]], C.red, 4);
  }
  pie(x, y, s = 90) {
    this.poly([[x - s, y + s * 0.2], [x + s * 0.9, y + s * 0.3], [x + s * 0.5, y - s * 0.35], [x - s * 0.7, y - s * 0.45]], { fill: C.tan, stroke: C.brown, w: 4 });
    for (let i = 0; i < 4; i++) this.line([[x - s * 0.75 + i * s * 0.4, y - s * 0.4], [x - s * 0.55 + i * s * 0.4, y + s * 0.2]], C.brown, 3.5);
    for (let i = 0; i < 7; i++) this.circle(x + this.rr(-s * 0.6, s * 0.5), y + this.rr(-s * 0.3, s * 0.15), s * 0.08, { fill: C.red, stroke: C.dred, w: 2 });
  }
  owl(x, y, s = 100) {
    this.poly([[x - s * 0.42, y - s * 0.55], [x - s * 0.3, y - s * 0.35], [x + s * 0.3, y - s * 0.35], [x + s * 0.42, y - s * 0.55], [x + s * 0.45, y + s * 0.1], [x + s * 0.3, y + s * 0.5], [x, y + s * 0.6], [x - s * 0.3, y + s * 0.5], [x - s * 0.45, y + s * 0.1]], { fill: C.brown, w: 4 });
    this.ellipse(x, y + s * 0.25, s * 0.25, s * 0.28, { fill: C.tan, stroke: false });
    for (const d of [-1, 1]) { this.circle(x + d * s * 0.18, y - s * 0.12, s * 0.16, { fill: C.yellow, stroke: C.black, w: 3 }); this.dot(x + d * s * 0.18, y - s * 0.12, s * 0.06); }
    this.poly([[x - s * 0.06, y + s * 0.02], [x + s * 0.06, y + s * 0.02], [x, y + s * 0.14]], { fill: C.orange, w: 2.5 });
    for (let i = 0; i < 3; i++) this.smile(x, y + s * 0.18 + i * s * 0.1, s * 0.16, C.brown);
  }
  log(x, y, s = 110) {
    this.poly([[x - s, y - s * 0.28], [x + s * 0.7, y - s * 0.3], [x + s * 0.72, y + s * 0.3], [x - s, y + s * 0.28]], { fill: C.brown, w: 4 });
    this.ellipse(x + s * 0.72, y, s * 0.2, s * 0.3, { fill: C.tan, w: 4 });
    this.spiral(x + s * 0.72, y, s * 0.15, 2.5, C.brown, 2.5);
    for (let i = 0; i < 4; i++) this.line([[x - s * 0.8 + i * s * 0.35, y - s * 0.1], [x - s * 0.5 + i * s * 0.35, y - s * 0.12]], C.black, 2.5, { alpha: 0.6 });
  }
  ring(x, y, s = 60) {
    this.ellipse(x, y + s * 0.3, s * 0.7, s * 0.5, { stroke: C.gold, w: Math.max(6, s * 0.16) });
    this.ellipse(x, y - s * 0.3, s * 0.42, s * 0.34, { fill: C.green, stroke: C.dgreen, w: 4 });
    // simple owl-cave glyph: two dots and a little caret like ears/beak
    this.dot(x - s * 0.13, y - s * 0.33, s * 0.05, C.black); this.dot(x + s * 0.13, y - s * 0.33, s * 0.05, C.black);
    this.line([[x - s * 0.2, y - s * 0.15], [x, y - s * 0.03], [x + s * 0.2, y - s * 0.15]], C.black, 3, { wob: 0.6 });
    this.line([[x - s * 0.22, y - s * 0.5], [x - s * 0.12, y - s * 0.44]], C.black, 2.5, { wob: 0.4 });
    this.line([[x + s * 0.22, y - s * 0.5], [x + s * 0.12, y - s * 0.44]], C.black, 2.5, { wob: 0.4 });
  }
  curtain(x0, y0, x1, y1, side = 'L') {
    const pts = side === 'L'
      ? [[x0, y0], [x1, y0], [x1 - (x1 - x0) * 0.1, (y0 + y1) * 0.5], [x1 - (x1 - x0) * 0.35, y1], [x0, y1]]
      : [[x0, y0], [x1, y0], [x1, y1], [x0 + (x1 - x0) * 0.35, y1], [x0 + (x1 - x0) * 0.1, (y0 + y1) * 0.5]];
    this.poly(pts, { fill: C.red, stroke: C.dred, w: 5, angle: -1.45, alpha: 0.95 });
    const n = Math.max(3, Math.round((x1 - x0) / 40));
    for (let i = 1; i < n; i++) {
      const t = i / n; const xa = x0 + (x1 - x0) * t; const xb = side === 'L' ? x0 + (x1 - (x1 - x0) * 0.35 - x0) * t : x0 + (x1 - x0) * 0.35 + (x1 - x0) * 0.65 * t;
      this.line([[xa, y0 + 10], [xa + (xb - xa) * 0.5 + this.rr(-6, 6), (y0 + y1) / 2], [xb, y1 - 4]], C.dred, 5, { alpha: 0.8 });
    }
  }
  curtainWall(x0, y0, x1, y1) {
    this.rect(x0, y0, x1 - x0, y1 - y0, { fill: C.red, stroke: false, angle: -1.5, alpha: 0.92 });
    for (let x = x0 + 30; x < x1; x += this.rr(42, 62)) this.line([[x, y0], [x + this.rr(-12, 12), (y0 + y1) / 2], [x + this.rr(-8, 8), y1]], C.dred, 6, { alpha: 0.75 });
  }
  valance(x0, x1, y, h = 60) {
    const pts = [[x0, 0], [x1, 0], [x1, y + h * 0.4]]; const n = Math.round((x1 - x0) / 90);
    for (let i = n; i >= 0; i--) { const xx = x0 + (x1 - x0) * (i / n); pts.push([xx, y + h * 0.4]); if (i) pts.push([xx - (x1 - x0) / n / 2, y + h]); }
    this.poly(pts, { fill: C.red, stroke: C.dred, w: 5 });
  }
  chevron(x0, y0, x1, y1) {
    this.rect(x0, y0, x1 - x0, y1 - y0, { fill: C.white, stroke: false, alpha: 0.5 });
    const band = 34, amp = 26, step = 52;
    for (let y = y0 + 6; y < y1 + band; y += band * 2) {
      const top = [], bot = [];
      for (let x = x0 - step; x <= x1 + step; x += step) { const up = Math.round((x - x0) / step) % 2 === 0; top.push([x, y + (up ? 0 : amp)]); bot.push([x, y + band + (up ? 0 : amp)]); }
      this.poly([...top, ...bot.reverse()], { fill: C.black, stroke: false, alpha: 0.95, gap: 4 });
    }
    this.line([[x0, y0], [x1, y0]], C.black, 5);
  }
  flames(cx, base, w, h) {
    const mk = (sc, n, ph) => {
      const pts = []; const W = w * sc, H = h * sc; const lean = this.rr(-0.12, 0.12);
      for (let i = 0; i <= 64; i++) {
        const t = i / 64; const env = Math.pow(Math.sin(Math.PI * t), 0.6);
        const tongue = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (n * t + ph)), 1.6);
        const y = base - H * env * (0.22 + 0.78 * tongue) * (0.85 + 0.15 * Math.sin(t * 9 + ph * 7));
        pts.push([cx - W / 2 + W * t + (base - y) * lean, y]);
      }
      return pts;
    };
    this.poly(mk(1, 3.5, 0.5), { fill: C.red, stroke: C.dred, w: 5 });
    this.poly(mk(0.72, 2.5, 0.5), { fill: C.orange, stroke: false });
    this.poly(mk(0.42, 1.5, 0.5), { fill: C.yellow, stroke: false });
  }
  road(vx, vy, x0, x1, yb, color = '#4a4646') {
    this.poly([[vx - 14, vy], [vx + 14, vy], [x1, yb], [x0, yb]], { fill: color, stroke: C.black, w: 4 });
    for (let t = 0.05; t < 1; t += 0.16) { const t2 = t + 0.07; const ya = vy + (yb - vy) * t * t, yb2 = vy + (yb - vy) * t2 * t2; this.poly([[vx - 2 - 8 * t, ya], [vx + 2 + 8 * t, ya], [vx + 2 + 8 * t2, yb2], [vx - 2 - 8 * t2, yb2]], { fill: C.yellow, stroke: C.yellow, w: 2 }); }
  }
  radiator(x, y, w, h) {
    this.rect(x, y, w, h, { fill: C.lgray, w: 4.5 });
    for (let i = 1; i < 8; i++) this.line([[x + (w * i) / 8, y + 8], [x + (w * i) / 8, y + h - 8]], C.gray, 4);
    this.rect(x + w * 0.05, y + h, w * 0.08, 20, { fill: C.gray, w: 3 }); this.rect(x + w * 0.87, y + h, w * 0.08, 20, { fill: C.gray, w: 3 });
  }
  lamp(x, base, s = 1, glow = true) {
    if (glow) this.circle(x, base - 190 * s, 130 * s, { fill: C.yellow, stroke: false, alpha: 0.35 });
    this.line([[x, base - 20 * s], [x, base - 160 * s]], C.black, 6 * s);
    this.ellipse(x, base - 10 * s, 50 * s, 14 * s, { fill: C.black, w: 3 });
    this.poly([[x - 45 * s, base - 160 * s], [x + 45 * s, base - 160 * s], [x + 25 * s, base - 240 * s], [x - 25 * s, base - 240 * s]], { fill: C.cream, stroke: C.orange, w: 4 });
  }
  tv(x, y, w, h, screen) {
    this.line([[x + w * 0.4, y], [x + w * 0.25, y - h * 0.3]], C.black, 4); this.line([[x + w * 0.6, y], [x + w * 0.78, y - h * 0.32]], C.black, 4);
    this.rect(x, y, w, h, { fill: C.brown, w: 5 });
    this.rect(x + w * 0.08, y + h * 0.1, w * 0.64, h * 0.78, { fill: '#5d7a8c', w: 4 });
    this.circle(x + w * 0.86, y + h * 0.3, w * 0.05, { fill: C.tan, w: 3 }); this.circle(x + w * 0.86, y + h * 0.55, w * 0.05, { fill: C.tan, w: 3 });
    this.rect(x + w * 0.1, y + h, w * 0.08, h * 0.12, { fill: C.black, w: 3 }); this.rect(x + w * 0.82, y + h, w * 0.08, h * 0.12, { fill: C.black, w: 3 });
    if (screen) screen(x + w * 0.08, y + h * 0.1, w * 0.64, h * 0.78);
  }
  camera(x, y, s = 1) {
    for (const d of [-1, 1]) this.line([[x, y + 50 * s], [x + d * 70 * s, y + 230 * s]], C.brown, 6);
    this.line([[x, y + 50 * s], [x, y + 225 * s]], C.brown, 6);
    this.circle(x - 40 * s, y - 70 * s, 42 * s, { fill: C.black, w: 4 }); this.circle(x + 40 * s, y - 75 * s, 42 * s, { fill: C.black, w: 4 });
    this.circle(x - 40 * s, y - 70 * s, 10 * s, { fill: C.lgray, w: 2 }); this.circle(x + 40 * s, y - 75 * s, 10 * s, { fill: C.lgray, w: 2 });
    this.rect(x - 70 * s, y - 30 * s, 140 * s, 85 * s, { fill: C.black, w: 4 });
    this.poly([[x - 70 * s, y], [x - 120 * s, y - 25 * s], [x - 120 * s, y + 45 * s], [x - 70 * s, y + 25 * s]], { fill: C.gray, w: 4 });
    this.circle(x + 30 * s, y + 10 * s, 10 * s, { fill: C.red, stroke: false });
  }
  pole(x, top, base, label) {
    this.rect(x - 12, top, 24, base - top, { fill: C.brown, w: 4 });
    this.rect(x - 90, top + 40, 180, 16, { fill: C.brown, w: 4 });
    for (const dx of [-75, -25, 25, 75]) this.circle(x + dx, top + 34, 7, { fill: C.lgray, w: 2 });
    this.line([[x - 75, top + 30], [x - 260, top + 90]], C.black, 3); this.line([[x + 75, top + 30], [x + 400, top + 70]], C.black, 3); this.line([[x + 25, top + 30], [x + 400, top + 10]], C.black, 3);
    if (label) { this.rect(x - 20, top + 130, 40, 46, { fill: C.cream, w: 3 }); this.text(label, x, top + 154, { size: 34, rot: 0 }); }
  }
  bolt(x, y, s = 1, color = C.yellow) { this.poly([[x, y], [x + 40 * s, y], [x + 18 * s, y + 50 * s], [x + 45 * s, y + 50 * s], [x - 5 * s, y + 120 * s], [x + 8 * s, y + 68 * s], [x - 18 * s, y + 68 * s]], { fill: color, stroke: C.orange, w: 3.5 }); }
  zap(x, y, len, color = C.yellow) { const pts = [[x, y]]; for (let i = 1; i <= 6; i++) pts.push([x + (len * i) / 6, y + (i % 2 ? -14 : 14)]); this.line(pts, color, 4); }
  angel(x, y, s = 1, glow = true) {
    if (glow) { for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; this.line([[x + Math.cos(a) * 110 * s, y + Math.sin(a) * 120 * s], [x + Math.cos(a) * 160 * s, y + Math.sin(a) * 170 * s]], C.yellow, 4, { alpha: 0.8 }); } this.circle(x, y, 120 * s, { fill: C.cream, stroke: false, alpha: 0.6 }); }
    for (const d of [-1, 1]) this.poly(this.polar(x + d * 62 * s, y - 5 * s, 55 * s, 34 * s, (a) => 1 + 0.12 * Math.abs(Math.sin(a * 3)), 30, d * 0.5), { fill: C.white, stroke: C.lgray, w: 3.5 });
    this.poly([[x - 20 * s, y - 25 * s], [x + 20 * s, y - 25 * s], [x + 50 * s, y + 95 * s], [x - 50 * s, y + 95 * s]], { fill: C.white, stroke: C.sky, w: 3.5 });
    this.circle(x, y - 48 * s, 24 * s, { fill: C.skin, stroke: C.brown, w: 3 });
    this.hair(x, y - 48 * s, 24 * s, 'short', C.blond);
    this.dot(x - 8 * s, y - 50 * s, 2.5 * s); this.dot(x + 8 * s, y - 50 * s, 2.5 * s); this.smile(x, y - 40 * s, 12 * s, C.dred);
    this.ellipse(x, y - 88 * s, 26 * s, 7 * s, { stroke: C.gold, w: 5 });
  }
  ear(x, y, s = 1) {
    this.poly([[x - 20 * s, y + 40 * s], [x - 35 * s, y - 5 * s], [x - 20 * s, y - 45 * s], [x + 15 * s, y - 55 * s], [x + 38 * s, y - 25 * s], [x + 30 * s, y + 10 * s], [x + 5 * s, y + 25 * s], [x - 5 * s, y + 50 * s]], { fill: C.skin, stroke: C.brown, w: 4 });
    this.line([[x - 10 * s, y + 10 * s], [x - 15 * s, y - 25 * s], [x + 10 * s, y - 35 * s], [x + 20 * s, y - 15 * s]], C.brown, 3);
  }
  key(x, y, s = 1, color = C.blue) {
    this.circle(x, y, 22 * s, { fill: color, stroke: C.navy, w: 4 }); this.circle(x, y, 7 * s, { fill: C.white, stroke: C.navy, w: 2 });
    this.line([[x + 20 * s, y], [x + 100 * s, y]], C.navy, 7 * s);
    this.line([[x + 80 * s, y], [x + 80 * s, y + 18 * s]], C.navy, 6 * s); this.line([[x + 95 * s, y], [x + 95 * s, y + 14 * s]], C.navy, 6 * s);
  }
  fish(x, y, s = 1, color = C.orange, dir = 1) {
    this.poly([[x - 50 * s * dir, y], [x - 20 * s * dir, y - 25 * s], [x + 30 * s * dir, y - 18 * s], [x + 50 * s * dir, y], [x + 30 * s * dir, y + 18 * s], [x - 20 * s * dir, y + 25 * s]], { fill: color, w: 3.5 });
    this.poly([[x - 48 * s * dir, y], [x - 80 * s * dir, y - 25 * s], [x - 75 * s * dir, y + 25 * s]], { fill: color, w: 3.5 });
    this.dot(x + 28 * s * dir, y - 5 * s, 4 * s);
  }
  notes(x, y, s = 1, color = C.blue) {
    this.ellipse(x, y, 14 * s, 10 * s, { fill: color, stroke: color, w: 3 }); this.line([[x + 12 * s, y], [x + 12 * s, y - 55 * s], [x + 32 * s, y - 40 * s]], color, 4);
  }
  easel(x, y, w, h) {
    this.line([[x + w / 2, y - 40], [x - 30, y + h + 220]], C.brown, 9); this.line([[x + w / 2, y - 40], [x + w + 30, y + h + 220]], C.brown, 9);
    this.line([[x + w / 2, y - 40], [x + w / 2, y + h + 200]], C.brown, 7);
    this.rect(x - 10, y + h, w + 20, 14, { fill: C.brown, w: 3 });
    this.rect(x, y, w, h, { fill: C.cream, w: 5 });
  }
  car(x, y, s = 1, color = C.blue, dir = 1) {
    this.poly([[x - 110 * s, y - 15 * s], [x - 105 * s, y - 50 * s], [x - 50 * s * dir, y - 55 * s], [x - 30 * s * dir, y - 95 * s], [x + 50 * s * dir, y - 95 * s], [x + 75 * s * dir, y - 55 * s], [x + 110 * s, y - 50 * s], [x + 112 * s, y - 15 * s]], { fill: color, w: 4.5 });
    this.poly([[x - 22 * s * dir, y - 58 * s], [x - 15 * s * dir, y - 86 * s], [x + 10 * s * dir, y - 86 * s], [x + 10 * s * dir, y - 58 * s]], { fill: C.sky, w: 3 });
    this.poly([[x + 20 * s * dir, y - 58 * s], [x + 20 * s * dir, y - 86 * s], [x + 45 * s * dir, y - 86 * s], [x + 62 * s * dir, y - 58 * s]], { fill: C.sky, w: 3 });
    this.circle(x - 65 * s, y - 10 * s, 24 * s, { fill: C.black, w: 3 }); this.circle(x + 65 * s, y - 10 * s, 24 * s, { fill: C.black, w: 3 });
    this.circle(x - 65 * s, y - 10 * s, 8 * s, { fill: C.lgray, stroke: false }); this.circle(x + 65 * s, y - 10 * s, 8 * s, { fill: C.lgray, stroke: false });
    this.circle(x + 108 * s * dir, y - 38 * s, 8 * s, { fill: C.yellow, w: 2 });
  }
  trailer(x, y, w, h, color = C.cream) {
    this.rect(x, y, w, h, { fill: color, w: 4 });
    this.line([[x, y + h * 0.65], [x + w, y + h * 0.65]], C.teal, 7);
    this.rect(x + w * 0.1, y + h * 0.18, w * 0.2, h * 0.3, { fill: C.sky, w: 3 }); this.rect(x + w * 0.62, y + h * 0.18, w * 0.2, h * 0.3, { fill: C.sky, w: 3 });
    this.rect(x + w * 0.38, y + h * 0.2, w * 0.15, h * 0.8, { fill: C.tan, w: 3 });
    this.rect(x + w * 0.05, y + h, w * 0.08, h * 0.15, { fill: C.gray, w: 2.5 }); this.rect(x + w * 0.85, y + h, w * 0.08, h * 0.15, { fill: C.gray, w: 2.5 });
  }
  sign(x, y, w, h, lines, o = {}) {
    this.rect(x + w * 0.15, y + h, 14, o.post ?? 120, { fill: C.brown, w: 3 }); this.rect(x + w * 0.8, y + h, 14, o.post ?? 120, { fill: C.brown, w: 3 });
    this.rect(x, y, w, h, { fill: o.color ?? C.brown, w: 5 });
    lines.forEach((s, i) => this.text(s, x + w / 2, y + (h * (i + 0.5)) / lines.length, { size: o.size ?? 34, color: o.ink ?? C.cream }));
  }
  clock(x, y, r, hh, mm) {
    this.circle(x, y, r, { fill: C.white, w: 5 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; this.dot(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, 2.5); }
    const ha = ((hh % 12) / 12 + mm / 720) * Math.PI * 2 - Math.PI / 2, ma = (mm / 60) * Math.PI * 2 - Math.PI / 2;
    this.line([[x, y], [x + Math.cos(ha) * r * 0.5, y + Math.sin(ha) * r * 0.5]], C.black, 5); this.line([[x, y], [x + Math.cos(ma) * r * 0.75, y + Math.sin(ma) * r * 0.75]], C.black, 4);
  }
  book(x, y, w, h, color = C.red) {
    this.poly([[x - w / 2, y - h * 0.1], [x, y], [x, y + h], [x - w / 2, y + h * 0.9]], { fill: C.white, w: 4 });
    this.poly([[x + w / 2, y - h * 0.1], [x, y], [x, y + h], [x + w / 2, y + h * 0.9]], { fill: C.white, w: 4 });
    for (let i = 1; i < 5; i++) { this.line([[x - w * 0.42, y + h * 0.15 * i], [x - w * 0.08, y + h * 0.15 * i + 6]], C.gray, 2.5, { passes: 1 }); this.line([[x + w * 0.08, y + h * 0.15 * i + 6], [x + w * 0.42, y + h * 0.15 * i]], C.gray, 2.5, { passes: 1 }); }
    this.line([[x - w / 2 - 6, y + h * 0.95], [x, y + h + 10], [x + w / 2 + 6, y + h * 0.95]], color, 8);
  }
  heart(x, y, s = 1, color = C.red) {
    const p = [];
    for (let i = 0; i < 40; i++) { const t = (i / 40) * Math.PI * 2; p.push([x + 16 * Math.pow(Math.sin(t), 3) * 2.2 * s, y - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 2.2 * s]); }
    this.poly(p, { fill: color, stroke: C.dred, w: 4 });
  }
  factory(x, base, w, h, color = '#7d6a5d') {
    this.rect(x, base - h, w, h, { fill: color, w: 4 });
    this.rect(x + w * 0.65, base - h * 1.9, w * 0.16, h * 0.9, { fill: color, w: 4 });
    for (let i = 0; i < 3; i++) this.rect(x + w * (0.1 + i * 0.18), base - h * 0.7, w * 0.1, h * 0.2, { fill: C.yellow, w: 2.5 });
    const sx = x + w * 0.73, sy = base - h * 1.95;
    this.poly(this.polar(sx + 30, sy - 40, 40, 26, (a) => 1 + 0.2 * Math.abs(Math.sin(a * 3)), 30), { fill: C.lgray, stroke: C.gray, w: 3 });
    this.poly(this.polar(sx + 80, sy - 85, 30, 20, (a) => 1 + 0.2 * Math.abs(Math.sin(a * 3)), 30), { fill: C.lgray, stroke: C.gray, w: 3 });
  }
  filmstrip(cx, cy, len, rot, frames) {
    this.at(cx, cy, rot, () => {
      const h = 110; this.rect(-len / 2, -h / 2, len, h, { fill: C.black, w: 3, gap: 4 });
      for (let x = -len / 2 + 12; x < len / 2 - 10; x += 26) { this.rect(x, -h / 2 + 8, 12, 10, { fill: C.white, stroke: false, alpha: 1, gap: 3 }); this.rect(x, h / 2 - 18, 12, 10, { fill: C.white, stroke: false, alpha: 1, gap: 3 }); }
      const n = frames.length; const fw = (len - 40) / n;
      frames.forEach((fn, i) => { const fx = -len / 2 + 20 + i * fw; this.rect(fx + 4, -h / 2 + 26, fw - 8, h - 52, { fill: C.cream, w: 2.5 }); fn(fx + fw / 2, 0, Math.min(fw, h - 52)); });
    });
  }
  frame(x, y, w, h, fill = C.sky) { this.rect(x - 14, y - 14, w + 28, h + 28, { fill: C.gold, stroke: C.brown, w: 5 }); this.rect(x, y, w, h, { fill, w: 3 }); }
  stars(n, x0, y0, x1, y1, color = C.yellow) { for (let i = 0; i < n; i++) { const x = this.rr(x0, x1), y = this.rr(y0, y1); if (this.r() < 0.35) this.star(x, y, this.rr(9, 15), color, C.orange); else this.twinkle(x, y, this.rr(5, 9), color); } }
}

/* ───────────────────────── scenes (1000 × 700) ───────────────────────── */

const SCENES = {
  lynchCover(k) {
    k.rect(150, 40, 700, 490, { fill: C.black, stroke: false, alpha: 0.42, gap: 9 });
    k.stars(10, 240, 110, 760, 260);
    k.ellipse(500, 590, 250, 60, { fill: C.yellow, stroke: false, alpha: 0.45 });
    k.chevron(0, 520, 1000, 700);
    k.curtain(0, 0, 210, 600, 'L'); k.curtain(790, 0, 1000, 600, 'R'); k.valance(0, 1000, 40, 70);
    const f = k.figure(500, 640, 420, { hair: 'lynch', hairColor: '#cfc9bd', body: 'suit', arms: [25, 125] });
    k.cup(f.hands.r[0] + 30, f.hands.r[1] - 26, 62);
  },
  montana(k) {
    k.sky(C.sky, 0, 380);
    k.sun(130, 110, 58); k.cloud(430, 90, 80); k.cloud(800, 70, 58);
    k.mountain(260, 400, 260, 230, '#8e86c2'); k.mountain(560, 400, 230, 280, '#7b8fc7'); k.mountain(860, 400, 220, 200, '#8e86c2');
    k.ground(C.green, 380, 710);
    for (const [x, h] of [[60, 150], [140, 190], [370, 140], [450, 170], [960, 160]]) k.pine(x, 470 + (h - 150) * 0.2, h);
    k.house(640, 540, 150, 120, C.red, C.brown);
    const path = [[640, 560], [560, 600], [430, 585], [300, 630], [170, 610], [60, 660]];
    k.line(path, C.tan, 16); k.line(path, C.brown, 3, { alpha: 0.5 });
    ['MT', 'ID', 'WA', 'VA'].forEach((s, i) => { const [x, y] = path[[1, 2, 3, 5][i]]; k.circle(x, y, 18, { fill: C.yellow, stroke: C.red, w: 4 }); k.text(s, x, y - 38, { size: 28, color: C.black }); });
    const f = k.figure(860, 660, 220, { hair: 'cap', body: 'shirt', color: C.tan, arms: [20, 140] });
    k.circle(f.hands.r[0] + 5, f.hands.r[1] - 40, 38, { fill: C.dgreen, stroke: C.gold, w: 5 });
    k.star(f.hands.r[0] + 5, f.hands.r[1] - 40, 22, C.gold, C.yellow);
  },
  painter(k) {
    k.sky(C.cream, 0, 400, { alpha: 0.7 }); k.sky(C.orange, 0, 160, { alpha: 0.3 });
    k.factory(20, 400, 200, 130); k.factory(600, 400, 180, 110, '#8b7363'); k.factory(820, 400, 170, 150);
    k.ground(C.tan, 400, 710, { hill: 2, edge: C.brown });
    k.easel(110, 150, 340, 250);
    for (let i = 0; i < 6; i++) {
      const x = 170 + (i % 3) * 110, y = 210 + Math.floor(i / 3) * 120;
      k.circle(x, y, 30, { fill: C.skin, stroke: C.brown, w: 3 }); k.dot(x - 10, y - 5, 3); k.dot(x + 10, y - 5, 3);
      k.ellipse(x, y + 15, 9, 7, { fill: C.dred, w: 2 });
      k.line([[x - 25, y + 35], [x - 15, y + 65], [x - 8, y + 50]], k.pick([C.green, C.red, C.yellow]), 5);
      k.spiral(x + 18, y + 48, 12, 2, C.red, 2.5);
    }
    const f = k.figure(640, 660, 330, { hair: 'lynch', hairColor: '#5a3b27', body: 'shirt', color: C.white, arms: [105, 30] });
    k.line([f.hands.l, [f.hands.l[0] - 70, f.hands.l[1] - 30]], C.brown, 6); k.circle(f.hands.l[0] - 75, f.hands.l[1] - 32, 9, { fill: C.red, stroke: false });
    for (const [x, y, c] of [[615, 470, C.red], [660, 500, C.blue], [640, 440, C.yellow]]) k.dot(x, y, 7, c);
    k.poly(k.polar(850, 610, 110, 60, (a) => 1 + 0.08 * Math.sin(a * 3), 40), { fill: C.tan, stroke: C.brown, w: 4 });
    k.circle(900, 625, 14, { fill: C.white, w: 3 });
    for (const [dx, dy, c] of [[-70, -10, C.red], [-30, -30, C.yellow], [15, -32, C.blue], [55, -10, C.green], [-40, 25, C.white]]) k.circle(850 + dx, 610 + dy, 15, { fill: c, stroke: false });
  },
  grandmother(k) {
    k.rect(-10, -10, 1020, 500, { fill: '#3b3436', stroke: false, alpha: 0.55, gap: 9 });
    k.ground(C.brown, 490, 710, { hill: 0, alpha: 0.6 });
    k.rect(150, 300, 36, 260, { fill: C.brown, w: 4 }); k.rect(560, 380, 36, 180, { fill: C.brown, w: 4 });
    k.rect(170, 430, 410, 60, { fill: C.white, w: 4 }); k.rect(250, 445, 330, 70, { fill: C.pink, w: 4 });
    k.poly([[280, 440], [320, 395], [400, 380], [460, 400], [500, 440]], { fill: C.brown, w: 4 });
    k.line([[390, 390], [370, 300], [400, 230]], C.green, 9);
    k.poly([[380, 330], [320, 300], [300, 320], [370, 345]], { fill: C.green, stroke: C.dgreen, w: 3 });
    k.poly([[392, 280], [460, 250], [470, 275], [400, 295]], { fill: C.green, stroke: C.dgreen, w: 3 });
    k.poly(k.polar(400, 160, 112, 112, (a) => 1 + 0.18 * Math.abs(Math.sin(a * 4)), 56), { fill: C.yellow, stroke: C.orange, w: 4 });
    k.circle(400, 160, 64, { fill: C.skin, stroke: C.brown, w: 4 });
    k.hair(400, 160, 64, 'bun', '#c8c3bd');
    k.face(400, 160, 64, { face: 'smile', glasses: true });
    k.figure(700, 640, 240, { hair: 'bob', hairColor: '#4a3122', body: 'shirt', color: C.blue, arms: [130, 20] });
    k.camera(880, 400, 0.9);
  },
  eraserhead(k) {
    k.sky('#5f5b5c', 0, 420, { alpha: 0.55 });
    k.factory(0, 420, 210, 150, '#4b4646'); k.factory(560, 420, 200, 120, '#575252'); k.factory(790, 420, 210, 170, '#4b4646');
    k.ground('#3c3a3a', 420, 710, { hill: 4, alpha: 0.6, edge: C.black });
    k.line([[200, -10], [200, 120]], C.black, 4); k.circle(200, 140, 22, { fill: C.cream, w: 3 });
    k.zap(150, 130, 40); k.zap(225, 120, 50);
    const f = k.figure(400, 660, 420, { hair: 'tall', hairColor: '#2c2627', body: 'suit', face: 'flat', arms: [15, 35], shirt: C.white });
    k.rect(f.hands.r[0] - 20, f.hands.r[1] - 10, 60, 70, { fill: C.tan, w: 3.5 });
    k.radiator(600, 430, 280, 190);
    k.rect(680, 455, 120, 120, { fill: C.black, w: 3, alpha: 0.9 });
    k.curtain(680, 455, 710, 575, 'L'); k.curtain(770, 455, 800, 575, 'R');
    k.figure(740, 568, 100, { hair: 'bob', hairColor: '#f2e6d0', body: 'dress', color: C.white, arms: [40, 40], skin: '#fbe3e0' });
    k.circle(728, 528, 7, { fill: C.pink, stroke: false }); k.circle(752, 528, 7, { fill: C.pink, stroke: false });
  },
  elephant(k) {
    k.sky(C.purple, 0, 470, { alpha: 0.45 }); k.sky(C.navy, 0, 200, { alpha: 0.3 });
    k.ground(C.brown, 480, 710, { hill: 0 });
    // cathedral model
    k.rect(330, 300, 340, 180, { fill: C.cream, w: 4.5 });
    k.rect(345, 210, 70, 90, { fill: C.cream, w: 4 }); k.rect(585, 210, 70, 90, { fill: C.cream, w: 4 });
    k.poly([[340, 210], [380, 140], [420, 210]], { fill: C.lgray, w: 4 }); k.poly([[580, 210], [620, 140], [660, 210]], { fill: C.lgray, w: 4 });
    k.rect(455, 220, 90, 80, { fill: C.cream, w: 4 }); k.poly([[450, 222], [500, 120], [550, 222]], { fill: C.lgray, w: 4 });
    k.poly([[480, 120], [500, 40], [520, 120]], { fill: C.lgray, w: 4 });
    for (const x of [370, 430, 560, 620]) { k.poly([[x - 14, 440], [x - 14, 380], [x, 362], [x + 14, 380], [x + 14, 440]], { fill: C.sky, w: 3 }); }
    k.poly([[470, 480], [470, 400], [500, 375], [530, 400], [530, 480]], { fill: C.brown, w: 3.5 });
    k.circle(500, 330, 24, { fill: C.pink, w: 3 }); k.spiral(500, 330, 18, 2, C.purple, 2.5);
    for (let i = 0; i < 8; i++) { const a = (195 + i * (150 / 7)) * D2R; k.star(500 + Math.cos(a) * 400, 450 + Math.sin(a) * 380 * 1.0, 30, C.gold, C.orange); }
    // gas lamp
    k.line([[100, 650], [100, 330]], C.black, 9); k.poly([[70, 330], [130, 330], [120, 270], [80, 270]], { fill: C.yellow, w: 4 }); k.poly([[70, 270], [130, 270], [100, 245]], { fill: C.black, w: 3 });
    k.circle(100, 300, 70, { fill: C.yellow, stroke: false, alpha: 0.3 });
    k.hair(860, 600, 70, 'hat', C.black);
  },
  velvet(k) {
    k.rect(-10, -10, 470, 380, { fill: C.orange, stroke: false, alpha: 0.55, gap: 8 });
    k.sun(360, 90, 40, false);
    k.poly([[-10, 330], [120, 290], [260, 340], [460, 300], [460, 710], [-10, 710]], { fill: C.tan, stroke: C.brown, w: 4 });
    k.poly([[-10, 470], [150, 420], [320, 470], [460, 440], [460, 710], [-10, 710]], { fill: C.yellow, stroke: C.orange, w: 4 });
    k.poly([[120, 600], [100, 420], [150, 260], [230, 210], [300, 240], [260, 290], [210, 320], [190, 440], [210, 600]], { fill: C.brown, stroke: C.black, w: 4.5 });
    for (let i = 0; i < 5; i++) k.smile(170 - i * 4, 560 - i * 60, 70, C.black, false);
    k.ellipse(265, 262, 42, 34, { fill: C.dred, stroke: C.black, w: 4 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.line([[265 + Math.cos(a) * 38, 262 + Math.sin(a) * 30], [265 + Math.cos(a) * 22, 262 + Math.sin(a) * 18]], C.white, 4); }
    k.line([[465, -10], [455, 350], [470, 710]], C.black, 8);
    k.rect(480, -10, 530, 400, { fill: C.sky, stroke: false, alpha: 0.6, gap: 8, angle: -0.2 });
    k.ground(C.green, 470, 710, { hill: 6 });
    for (let x = 500; x < 1000; x += 55) k.poly([[x, 480], [x, 330], [x + 18, 305], [x + 36, 330], [x + 36, 480]], { fill: C.white, stroke: C.gray, w: 3 });
    k.line([[480, 360], [1010, 360]], C.gray, 8); k.line([[480, 440], [1010, 440]], C.gray, 8);
    for (const x of [520, 620, 760, 940]) k.flower(x, 520, C.red, 1.3);
    k.ear(700, 600, 1.1);
    k.grass(480, 1000, 690);
    // robin on the fence
    k.ellipse(870, 275, 48, 30, { fill: C.brown, w: 4 }); k.ellipse(860, 288, 26, 18, { fill: C.orange, stroke: false });
    k.circle(905, 255, 20, { fill: C.brown, w: 3.5 }); k.dot(910, 250, 3.5); k.poly([[922, 255], [945, 262], [922, 266]], { fill: C.yellow, w: 2.5 });
    k.line([[860, 303], [858, 320]], C.black, 3); k.line([[880, 303], [880, 320]], C.black, 3);
    k.notes(560, 120, 1); k.notes(650, 80, 0.8); k.notes(720, 150, 1.1, C.navy);
  },
  twinpeaks(k) {
    k.sky(C.sky, 0, 380);
    k.cloud(860, 90, 70);
    k.mountain(320, 400, 280, 290, '#6f86b3'); k.mountain(660, 400, 270, 300, '#7b8ebc');
    k.ground(C.green, 390, 710, { hill: 4 });
    for (let x = -10; x < 1030; x += 52) k.pine(x + k.rr(-8, 8), 450 + k.rr(-6, 10), k.rr(130, 170), C.dgreen);
    k.sign(40, 470, 360, 110, [T('欢迎来到', 'WELCOME TO'), T('双峰镇', 'TWIN PEAKS')], { post: 90, size: 40 });
    k.rect(430, 610, 600, 110, { fill: C.brown, w: 5 });
    k.cup(530, 560, 76); k.pie(720, 575, 72);
    k.line([[760, 170], [1010, 150]], C.brown, 12);
    k.owl(800, 115, 110);
    k.log(900, 590, 70);
  },
  wildheart(k) {
    k.rect(-10, -10, 1020, 440, { fill: C.navy, stroke: false, alpha: 0.85, gap: 7, angle: -0.2 });
    k.stars(14, 20, 20, 980, 330);
    k.ground('#1f3324', 420, 710, { hill: 0, alpha: 0.85 });
    k.road(470, 420, 120, 860, 710);
    k.flames(830, 430, 260, 240);
    // golden palm
    k.line([[200, 260], [230, 160], [280, 70]], C.gold, 7);
    for (let i = 0; i < 7; i++) { const t = i / 7; const x = 205 + t * 72, y = 250 - t * 175; k.line([[x, y], [x - 50 + t * 10, y - 22]], C.gold, 5); k.line([[x, y], [x + 40 - t * 5, y - 35]], C.gold, 5); }
    k.poly([[150, 270], [260, 270], [240, 300], [170, 300]], { fill: C.gold, stroke: C.orange, w: 3 });
    k.poly([[430, 640], [330, 710], [560, 710]], { fill: C.yellow, stroke: false, alpha: 0.4 });
    k.car(470, 650, 0.9, C.red);
  },
  highway(k) {
    k.rect(-10, -10, 1020, 380, { fill: C.navy, stroke: false, alpha: 0.88, gap: 7 });
    k.stars(8, 20, 20, 980, 120);
    k.road(500, 150, 160, 840, 360, '#3a3838');
    k.circle(330, 330, 40, { fill: C.yellow, stroke: false, alpha: 0.5 }); k.circle(670, 330, 40, { fill: C.yellow, stroke: false, alpha: 0.5 });
    k.line([[-10, 368], [500, 360], [1010, 370]], C.black, 8);
    k.rect(-10, 375, 1020, 100, { fill: C.sky, stroke: false, alpha: 0.6 });
    k.sun(900, 430, 32, true);
    k.ground(C.green, 470, 710, { hill: 6 });
    for (let i = 0; i < 6; i++) k.line([[-10, 500 + i * 34], [1010, 490 + i * 36]], C.yellow, 4, { alpha: 0.55, passes: 1 });
    k.rect(560, 560, 120, 80, { fill: C.brown, w: 4 }); k.line([[560, 610], [520, 610]], C.black, 4);
    k.circle(580, 650, 20, { fill: C.black, w: 3 }); k.circle(660, 650, 20, { fill: C.black, w: 3 });
    k.rect(320, 560, 200, 70, { fill: C.green, stroke: C.dgreen, w: 4 });
    k.circle(340, 640, 30, { fill: C.black, w: 3 }); k.circle(500, 645, 24, { fill: C.black, w: 3 });
    k.figure(420, 590, 230, { pose: 'sit', hair: 'cap', body: 'shirt', color: C.blue, arms: [60, 80] });
    k.line([[310, 560], [250, 500]], C.black, 5);
  },
  mulholland(k) {
    k.rect(-10, -10, 1020, 520, { fill: C.purple, stroke: false, alpha: 0.6, gap: 8 });
    k.rect(-10, -10, 1020, 200, { fill: C.navy, stroke: false, alpha: 0.5, gap: 9 });
    k.stars(10, 30, 20, 970, 220); k.moon(860, 90, 50);
    k.poly([[-10, 430], [150, 360], [320, 410], [520, 340], [740, 400], [1010, 350], [1010, 710], [-10, 710]], { fill: '#3b2a3c', stroke: C.black, w: 4 });
    for (let i = 0; i < 40; i++) k.dot(k.rr(20, 980), k.rr(560, 690), k.rr(3, 6), k.pick([C.yellow, C.orange, C.cream]));
    // palm tree
    k.line([[110, 600], [125, 420], [150, 260]], C.brown, 14);
    for (const a of [-160, -120, -60, -20, 20]) k.line([[150, 260], [150 + Math.cos(a * D2R) * 110, 260 + Math.sin(a * D2R) * 70 + 40]], C.green, 9);
    k.sign(240, 200, 270, 70, [T('穆赫兰道', 'MULHOLLAND DR.')], { color: C.green, ink: C.white, post: 230, size: 34 });
    k.circle(700, 330, 70, { fill: C.skin, stroke: C.brown, w: 4 }); k.hair(700, 330, 70, 'long', C.blond); k.face(700, 330, 70, { face: 'smile' });
    k.circle(850, 350, 70, { fill: C.skin, stroke: C.brown, w: 4 }); k.hair(850, 350, 70, 'bob', '#2d1d18'); k.face(850, 350, 70, { face: 'o' });
    k.poly([[540, 560], [620, 540], [660, 570], [660, 640], [580, 665], [540, 630]], { fill: C.blue, stroke: C.navy, w: 4 });
    k.line([[540, 560], [580, 590], [660, 570]], C.navy, 3.5); k.line([[580, 590], [580, 665]], C.navy, 3.5);
    k.key(720, 600, 0.9);
  },
  meditate(k) {
    k.sky(C.sky, 0, 360, { alpha: 0.45 });
    k.sun(860, 100, 55);
    k.ground(C.green, 340, 710, { hill: 4 });
    k.cloud(480, 330, 170, C.white, C.lgray);
    k.figure(480, 345, 290, { pose: 'cross', hair: 'lynch', hairColor: '#cfc9bd', body: 'suit', eyes: 'closed', arms: [40, 40], legs: C.black });
    for (const [x, y, r] of [[590, 120, 9], [620, 90, 13], [660, 60, 18]]) k.circle(x, y, r, { fill: C.white, w: 3 });
    k.poly(k.polar(740, 70, 70, 48, (a) => 1 + 0.15 * Math.abs(Math.sin(a * 4)), 40), { fill: C.white, w: 3.5 });
    k.star(740, 70, 26, C.yellow, C.orange);
    k.ellipse(500, 585, 400, 115, { fill: C.blue, stroke: C.navy, w: 5 });
    for (let i = 0; i < 4; i++) k.line([[200 + i * 170, 520], [260 + i * 170, 515]], C.sky, 4, { passes: 1 });
    k.fish(260, 535, 0.5, C.orange, 1); k.fish(420, 525, 0.45, C.orange, -1); k.fish(760, 540, 0.5, C.red, -1);
    k.fish(540, 625, 1.25, C.gold, 1);
    k.cup(120, 470, 80);
    k.grass(0, 1000, 700);
  },
  inland(k) {
    k.rect(-10, -10, 1020, 480, { fill: C.dred, stroke: false, alpha: 0.55, gap: 8, angle: -1.5 });
    k.ground(C.brown, 470, 710, { hill: 0 });
    // lion
    k.poly(k.polar(230, 330, 150, 140, (a) => 1 + 0.18 * Math.abs(Math.sin(a * 7)), 70), { fill: C.orange, stroke: C.brown, w: 4 });
    k.circle(230, 335, 95, { fill: C.gold, stroke: C.brown, w: 4 });
    k.dot(195, 310, 8); k.dot(265, 310, 8);
    k.poly([[215, 345], [245, 345], [230, 362]], { fill: C.brown, w: 3 });
    k.smile(230, 380, 40, C.brown);
    for (const d of [-1, 1]) for (let i = 0; i < 3; i++) k.line([[230 + d * 30, 360 + i * 8], [230 + d * 85, 350 + i * 14]], C.brown, 2.5, { passes: 1 });
    k.ellipse(230, 545, 120, 70, { fill: C.gold, stroke: C.brown, w: 4 });
    k.line([[340, 560], [400, 520], [420, 470]], C.gold, 8); k.circle(420, 465, 16, { fill: C.orange, stroke: C.brown, w: 3 });
    // lamp on table
    k.rect(420, 560, 170, 18, { fill: C.brown, w: 4 }); k.line([[440, 578], [440, 690]], C.brown, 8); k.line([[570, 578], [570, 690]], C.brown, 8);
    k.lamp(505, 560, 0.95);
    // record
    k.circle(800, 330, 140, { fill: C.black, w: 4 });
    for (const r of [110, 85, 60]) k.circle(800, 330, r, { stroke: '#555', w: 2.5 });
    k.circle(800, 330, 40, { fill: C.red, w: 3 }); k.dot(800, 330, 6, C.white);
    k.notes(700, 140, 1.1, C.yellow); k.notes(860, 120, 0.9, C.yellow); k.notes(950, 210, 1.2, C.yellow);
  },
  thereturn(k) {
    k.rect(-10, -10, 1020, 470, { fill: C.navy, stroke: false, alpha: 0.85, gap: 7 });
    k.stars(10, 300, 20, 980, 200); k.moon(900, 80, 40);
    k.ground(C.dgreen, 450, 710, { hill: 4 });
    k.pole(170, 80, 640, '6');
    k.zap(70, 150, 70); k.zap(220, 105, 60); k.bolt(250, 140, 0.6);
    k.tv(380, 250, 400, 300, (x, y, w, h) => {
      k.rect(x, y, w, h, { fill: C.black, stroke: false, alpha: 0.7 });
      k.chevron(x + 6, y + h * 0.62, x + w - 6, y + h - 6);
      k.curtain(x + 4, y + 4, x + w * 0.22, y + h * 0.62, 'L'); k.curtain(x + w * 0.78, y + 4, x + w - 4, y + h * 0.62, 'R');
      k.bolt(x + w * 0.45, y + h * 0.08, 0.9);
    });
    k.book(820, 590, 200, 90, C.red);
    k.text('18', 880, 470, { size: 60, color: C.yellow, rot: -8 });
    k.circle(880, 470, 48, { stroke: C.yellow, w: 4 });
  },
  farewell(k) {
    k.rect(-10, -10, 1020, 580, { fill: C.navy, stroke: false, alpha: 0.85, gap: 7 });
    k.stars(18, 240, 90, 760, 330); k.moon(500, 120, 45);
    k.chevron(0, 560, 1000, 700);
    k.frame(410, 220, 180, 120, C.sky); k.ground(C.green, 310, 340, { hill: 1, edge: C.dgreen }); k.line([[410, 310], [590, 312]], C.dgreen, 4);
    // Oscar statuette
    k.rect(280, 520, 110, 50, { fill: C.black, w: 4 }); k.rect(295, 495, 80, 28, { fill: C.gold, w: 3 });
    k.poly([[320, 495], [322, 400], [312, 340], [335, 320], [358, 340], [348, 400], [350, 495]], { fill: C.gold, stroke: C.orange, w: 4 });
    k.circle(335, 305, 18, { fill: C.gold, stroke: C.orange, w: 4 });
    k.camera(650, 420, 0.75);
    k.heart(500, 470, 1.1);
    k.curtain(0, 0, 250, 640, 'L'); k.curtain(750, 0, 1000, 640, 'R'); k.valance(0, 1000, 30, 60);
  },
  sources(k) {
    k.rect(140, 480, 720, 40, { fill: C.brown, w: 4 });
    k.rect(220, 400, 300, 80, { fill: C.red, w: 4 }); k.rect(240, 330, 270, 70, { fill: C.blue, w: 4 }); k.rect(210, 260, 290, 70, { fill: C.green, w: 4 }); k.rect(250, 200, 240, 60, { fill: C.yellow, w: 4 });
    for (const y of [440, 365, 295, 230]) k.line([[260, y], [460, y]], C.white, 3, { passes: 1, alpha: 0.7 });
    k.cup(680, 430, 90);
    k.at(760, 250, 35, () => { k.rect(-140, -15, 260, 30, { fill: C.yellow, w: 3.5 }); k.poly([[120, -15], [165, 0], [120, 15]], { fill: C.tan, w: 3 }); k.dot(160, 0, 5); k.rect(-170, -15, 30, 30, { fill: C.pink, w: 3 }); });
    k.star(130, 140, 30); k.star(880, 120, 24, C.red, C.dred); k.twinkle(600, 120, 14, C.blue);
    k.rose(860, 560, 0.8);
  },
  /* ── Fire Walk with Me ── */
  fireCover(k) {
    k.rect(150, 40, 700, 490, { fill: C.black, stroke: false, alpha: 0.5, gap: 8 });
    k.chevron(0, 520, 1000, 700);
    k.ellipse(500, 560, 220, 45, { fill: C.orange, stroke: false, alpha: 0.4 });
    k.flames(500, 560, 330, 420);
    k.curtain(0, 0, 220, 600, 'L'); k.curtain(780, 0, 1000, 600, 'R'); k.valance(0, 1000, 40, 70);
    k.ring(870, 640, 50);
  },
  cannes(k) {
    k.curtain(130, 20, 230, 340, 'L'); k.curtain(770, 20, 870, 340, 'R');
    k.rect(220, 40, 560, 280, { fill: C.white, w: 6 });
    k.flames(500, 300, 160, 190);
    // storm
    k.cloud(130, 400, 95, C.lgray, C.gray); k.bolt(110, 430, 0.8);
    for (let i = 0; i < 6; i++) k.line([[70 + i * 22, 450], [60 + i * 22, 490]], C.blue, 3, { passes: 1 });
    k.sun(880, 400, 46);
    for (const x of [820, 870, 920, 960]) k.flower(x, 520, k.pick([C.pink, C.red, C.yellow]), 0.9);
    k.rect(-10, 520, 1020, 200, { fill: C.dred, stroke: false, alpha: 0.65 });
    for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
      const x = 70 + i * 108 + row * 50, y = 560 + row * 80; if (x > 980) continue;
      k.circle(x, y, 32, { fill: C.skin, stroke: C.brown, w: 3 });
      k.hair(x, y, 32, k.pick(['bob', 'short', 'lynch']), k.pick([C.black, C.brown, C.blond, '#c8c3bd']));
      const sad = i < 4; k.dot(x - 10, y - 4, 3); k.dot(x + 10, y - 4, 3); k.smile(x, y + 12, 18, C.dred, sad);
    }
  },
  deermeadow(k) {
    k.sky(C.yellow, 0, 360, { alpha: 0.4 }); k.sky(C.orange, 0, 120, { alpha: 0.25 });
    k.ground(C.tan, 350, 710, { hill: 3, edge: C.brown });
    k.trailer(560, 250, 220, 120); k.trailer(800, 270, 190, 110, C.pink);
    k.sign(40, 120, 330, 110, [T('胖鳟鱼', 'FAT TROUT'), T('拖车营地', 'TRAILER PARK')], { post: 140, color: C.cream, ink: C.brown, size: 34 });
    k.fish(340, 95, 0.5, C.sky, -1);
    k.figure(150, 660, 300, { hair: 'lynch', hairColor: '#2d1d18', body: 'suit', face: 'flat', arms: [15, 15] });
    const s = k.figure(320, 660, 270, { hair: 'short', hairColor: C.brown, body: 'suit', glasses: true, face: 'o', arms: [15, 20] });
    k.rect(s.hands.r[0] - 10, s.hands.r[1], 60, 44, { fill: C.gray, w: 3 });
    k.figure(560, 660, 290, { hair: 'bob', hairColor: '#c2501f', body: 'dress', color: C.red, face: 'sad', rose: true, arms: [10, 160] });
    k.figure(820, 660, 300, { hair: 'lynch', hairColor: '#c8c3bd', body: 'suit', hearing: true, face: 'shout', arms: [140, 20] });
  },
  jeffries(k) {
    k.sky(C.purple, 0, 700, { alpha: 0.25 });
    k.rect(-10, -10, 450, 300, { fill: C.navy, stroke: false, alpha: 0.6, gap: 8 });
    k.ground(C.tan, 290, 710, { hill: 0, alpha: 0.6 });
    k.trailer(40, 170, 360, 150);
    k.rect(50, 330, 340, 70, { fill: C.black, stroke: false, alpha: 0.55 });
    k.circle(220, 470, 75, { fill: C.green, stroke: false, alpha: 0.3 });
    k.ring(220, 470, 55);
    k.text('?', 360, 560, { size: 120, color: C.black, rot: 10 });
    for (let i = 0; i < 4; i++) k.ellipse(80 + i * 45, 640 - (i % 2) * 20, 12, 18, { fill: C.brown, stroke: false, alpha: 0.7 - i * 0.15 });
    k.line([[450, -10], [440, 360], [455, 710]], C.black, 8);
    k.rect(460, -10, 560, 720, { fill: '#cfe3c4', stroke: false, alpha: 0.7, gap: 8 });
    k.clock(560, 110, 55, 10, 10);
    k.line([[850, 30], [850, 60]], C.black, 4); k.tv(770, 60, 170, 120, (x, y, w, h) => { k.figure(x + w / 2, y + h - 4, h * 0.95, { body: 'suit', color: C.white, hair: 'short', hairColor: C.blond, arms: [15, 15] }); });
    k.rect(800, 300, 190, 360, { fill: C.lgray, w: 5 }); k.line([[895, 305], [895, 655]], C.gray, 5);
    k.circle(895, 280, 12, { fill: C.yellow, w: 3 });
    k.figure(895, 660, 290, { body: 'suit', color: C.white, hair: 'short', hairColor: C.blond, arms: [20, 30], face: 'o' });
    k.figure(610, 660, 310, { body: 'suit', hair: 'short', hairColor: C.black, arms: [15, 150], face: 'o' });
  },
  sevendays(k) {
    k.sky(C.sky, 0, 400);
    for (let i = 0; i < 4; i++) k.line([[60 + i * 30, 40], [64 + i * 30, 140]], C.black, 6);
    k.line([[40, 120], [180, 55]], C.red, 6);
    k.line([[220, 40], [224, 140]], C.black, 6); k.line([[250, 40], [254, 140]], C.black, 6); k.line([[280, 40], [284, 140]], C.black, 6);
    k.sun(900, 80, 45);
    k.ground(C.green, 420, 710, { hill: 5 });
    k.rect(500, 180, 440, 260, { fill: C.red, w: 5 });
    k.poly([[480, 185], [720, 90], [960, 185]], { fill: C.brown, w: 5 });
    k.clock(720, 140, 28, 9, 0);
    for (let i = 0; i < 4; i++) k.rect(530 + i * 100, 220, 60, 60, { fill: C.sky, w: 3 });
    k.rect(685, 330, 70, 110, { fill: C.brown, w: 4 });
    k.line([[920, 180], [920, 40]], C.black, 4); k.poly([[920, 40], [980, 55], [920, 75]], { fill: C.yellow, w: 3 });
    k.tree(120, 450, 200);
    k.figure(300, 660, 300, { hair: 'long', hairColor: C.blond, hairLine: C.orange, body: 'dress', color: C.blue, arms: [20, 45] });
    k.figure(430, 660, 290, { hair: 'long', hairColor: '#4a2e1f', body: 'dress', color: C.pink, arms: [45, 20] });
    k.at(700, 580, -10, () => { k.rect(-60, -45, 120, 90, { fill: C.pink, w: 4 }); k.rect(48, -10, 20, 20, { fill: C.gold, w: 3 }); k.heart(0, -5, 0.6, C.red); });
    k.line([[810, 560], [850, 600], [890, 560]], C.gold, 3);
    k.poly([[850, 600], [850, 650], [820, 630], [810, 610], [825, 598]], { fill: C.gold, stroke: C.orange, w: 3.5 });
  },
  angelpainting(k) {
    k.rect(-10, -10, 1020, 560, { fill: C.pink, stroke: false, alpha: 0.4, gap: 9 });
    for (let x = 40; x < 1000; x += 80) k.line([[x, 0], [x + 3, 540]], C.white, 6, { alpha: 0.6, passes: 1 });
    k.ground(C.brown, 540, 710, { hill: 0 });
    k.line([[500, -10], [500, 30]], C.black, 5); k.ellipse(500, 38, 30, 12, { fill: C.gray, w: 3 });
    k.ellipse(400, 42, 100, 12, { fill: C.brown, w: 3 }); k.ellipse(600, 42, 100, 12, { fill: C.brown, w: 3 });
    k.frame(320, 150, 360, 280, C.sky);
    k.rect(320, 330, 360, 100, { fill: C.tan, stroke: false });
    k.angel(410, 255, 0.62, false);
    k.rect(490, 320, 170, 20, { fill: C.brown, w: 3 });
    for (const [x, c] of [[530, C.red], [600, C.green]]) k.figure(x, 420, 110, { hair: 'bob', hairColor: k.pick([C.brown, C.blond]), body: 'shirt', color: c, arms: [100, 60] });
    k.ellipse(460, 330, 30, 14, { fill: C.tan, stroke: C.brown, w: 3 });
    k.rect(40, 180, 200, 230, { fill: C.navy, w: 5 }); k.line([[140, 180], [140, 410]], C.white, 5); k.line([[40, 295], [240, 295]], C.white, 5); k.moon(95, 230, 26);
    k.rect(700, 520, 300, 80, { fill: C.white, w: 4 }); k.rect(750, 540, 260, 110, { fill: C.purple, w: 4 }); k.ellipse(760, 515, 50, 25, { fill: C.white, w: 3 });
  },
  onearmed(k) {
    k.sky(C.orange, 0, 430, { alpha: 0.4 }); k.sky(C.pink, 0, 200, { alpha: 0.3 });
    k.ground('#55524f', 420, 710, { hill: 0, alpha: 0.8, edge: C.black });
    for (let x = 0; x < 1000; x += 120) k.rect(x, 600, 70, 12, { fill: C.yellow, stroke: false, alpha: 1 });
    k.line([[910, 450], [910, 160]], C.black, 9);
    k.rect(880, 90, 60, 160, { fill: C.black, w: 4 });
    k.circle(910, 120, 20, { fill: C.red, w: 3 }); k.circle(910, 170, 20, { fill: C.gray, w: 3 }); k.circle(910, 220, 20, { fill: C.gray, w: 3 });
    k.line([[120, 450], [120, 290]], C.gray, 7);
    k.poly(k.ellipsePts(120, 240, 62, 62, 8, Math.PI / 8).map(([x, y]) => [x, y]), { fill: C.red, stroke: C.white, w: 5 });
    k.text('STOP', 120, 242, { size: 34, color: C.white, rot: 0 });
    k.car(280, 580, 1.15, C.blue);
    k.circle(260, 435, 22, { fill: C.skin, stroke: C.brown, w: 3 }); k.hair(260, 435, 22, 'short', '#cfc9bd');
    k.circle(320, 440, 20, { fill: C.skin, stroke: C.brown, w: 3 }); k.hair(320, 440, 20, 'long', C.blond); k.dot(314, 437, 2.5); k.dot(326, 437, 2.5); k.smile(320, 448, 10, C.dred, true);
    // pickup with the one-armed man
    k.poly([[540, 560], [540, 470], [640, 470], [670, 400], [780, 400], [800, 470], [820, 470], [820, 560]], { fill: C.green, stroke: C.dgreen, w: 4.5 });
    k.rect(680, 410, 90, 55, { fill: C.sky, w: 3 });
    k.circle(600, 570, 30, { fill: C.black, w: 3 }); k.circle(770, 570, 30, { fill: C.black, w: 3 });
    k.circle(725, 440, 30, { fill: C.skin, stroke: C.brown, w: 3 }); k.hair(725, 440, 30, 'short', '#bdb7ae'); k.face(725, 440, 30, { face: 'shout' });
    k.line([[700, 465], [640, 400], [610, 330]], C.brown, 9); k.circle(610, 325, 9, { fill: C.skin, w: 2 });
    k.ring(605, 280, 36);
    for (let i = 0; i < 3; i++) k.line([[520 - i * 6, 300 + i * 30], [480 - i * 6, 290 + i * 30]], C.black, 4);
    k.text('!', 790, 330, { size: 90, color: C.red, rot: 8 }); k.text('!', 830, 340, { size: 70, color: C.red, rot: 14 });
  },
  roadhouse(k) {
    k.curtainWall(-10, -10, 1010, 470);
    k.valance(-10, 1010, 20, 60);
    k.text(T('小酒馆', 'ROADHOUSE'), 500, 50, { size: 44, color: C.yellow, rot: -2 });
    k.poly([[400, 90], [600, 90], [760, 520], [240, 520]], { fill: C.sky, stroke: false, alpha: 0.35 });
    k.rect(-10, 450, 1020, 90, { fill: C.brown, w: 5 });
    k.figure(470, 500, 360, { hair: 'long', hairColor: C.blond, hairLine: C.orange, body: 'dress', color: '#cfe3f5', arms: [140, 25], eyes: 'closed', face: 'o' });
    k.line([[570, 500], [570, 250]], C.black, 5); k.ellipse(570, 238, 14, 22, { fill: C.gray, w: 3 }); k.line([[540, 500], [600, 500]], C.black, 5);
    k.notes(700, 220, 1.1, C.yellow); k.notes(780, 160, 0.9, C.cream); k.notes(250, 200, 1, C.yellow); k.notes(180, 290, 0.8, C.cream);
    k.rect(-10, 540, 1020, 180, { fill: C.black, stroke: false, alpha: 0.7 });
    for (let i = 0; i < 8; i++) { const x = 60 + i * 125; k.circle(x, 620, 34, { fill: '#2a2223', stroke: C.black, w: 3 }); k.ellipse(x, 668, 50, 30, { fill: '#2a2223', stroke: false }); }
    k.lamp(260, 700, 0.35); k.lamp(760, 700, 0.35);
  },
  redroomEnd(k) {
    k.curtainWall(-10, -10, 1010, 470);
    k.chevron(0, 450, 1000, 700);
    k.angel(500, 160, 0.95);
    k.rect(300, 400, 220, 200, { fill: C.dred, stroke: C.black, w: 5 });
    k.rect(280, 470, 50, 140, { fill: C.dred, stroke: C.black, w: 4 }); k.rect(490, 470, 50, 140, { fill: C.dred, stroke: C.black, w: 4 });
    k.figure(410, 640, 320, { pose: 'sit', hair: 'long', hairColor: C.blond, hairLine: C.orange, body: 'dress', color: C.white, arms: [30, 30], face: 'smile', tears: true });
    k.figure(660, 660, 380, { hair: 'short', hairColor: C.black, body: 'suit', arms: [70, 15], face: 'smile' });
  },
  missing(k) {
    k.text('2014', 500, 90, { size: 90, color: C.red, rot: -4 });
    const doodles = [
      (x, y, s) => k.star(x, y, s * 0.3, C.yellow, C.orange),
      (x, y, s) => k.circle(x, y, s * 0.28, { fill: C.blue, w: 2.5 }),
      (x, y, s) => k.zap(x - s * 0.3, y, s * 0.6, C.red),
      (x, y, s) => k.heart(x, y + 5, s * 0.012, C.red),
      (x, y, s) => k.fish(x + 6, y, s * 0.009, C.orange),
    ];
    k.filmstrip(330, 260, 520, -8, [doodles[0], doodles[1], doodles[2], doodles[3]]);
    k.filmstrip(640, 400, 560, 6, [doodles[1], doodles[4], doodles[0], doodles[2]]);
    k.filmstrip(380, 560, 480, -3, [doodles[3], doodles[2], doodles[1]]);
    k.at(860, 600, -30, () => { k.line([[0, 0], [120, -10]], C.gray, 8); k.line([[0, 0], [115, 30]], C.gray, 8); k.circle(-20, -15, 22, { stroke: C.red, w: 7 }); k.circle(-20, 30, 22, { stroke: C.red, w: 7 }); });
    k.rose(120, 690, 0.9);
    k.line([[800, 200], [880, 230], [840, 270], [900, 300]], C.black, 3, { alpha: 0.5 });
  },
};

/* ───────────────────────── rendering helpers ───────────────────────── */

const LOGICAL_W = 1000, LOGICAL_H = 700;
function drawScene(canvas, sceneName, seed) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(200, Math.round(rect.width * dpr)), h = Math.round((w * LOGICAL_H) / LOGICAL_W);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.setTransform(w / LOGICAL_W, 0, 0, h / LOGICAL_H, 0, 0);
  const k = new Kit(ctx, seed);
  try { (SCENES[sceneName] || SCENES.sources)(k); } catch (e) { console.warn('[guide] scene failed', sceneName, e); }
  k.grain(LOGICAL_W, LOGICAL_H, 0.5);
}

function drawIcon(canvas, kind, seed) {
  const s = 64; const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = s * dpr; canvas.height = s * dpr;
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = new Kit(ctx, seed);
  if (kind === 'next' || kind === 'prev') {
    const d = kind === 'next' ? 1 : -1; const cx = 32;
    k.line([[cx - 20 * d, 32], [cx + 18 * d, 31]], C.black, 6, { wob: 1.2 });
    k.poly([[cx + 22 * d, 32], [cx + 4 * d, 16], [cx + 4 * d, 48]], { fill: C.red, stroke: C.black, w: 3.5, wob: 1 });
  } else if (kind === 'close') {
    k.line([[16, 16], [48, 48]], C.red, 7, { wob: 1.2 }); k.line([[48, 16], [16, 48]], C.red, 7, { wob: 1.2 });
  }
  k.grain(s, s, 0.4);
}

/** jagged torn-paper clip-path, deterministic */
function tornClip(seed, amt = 5, n = 18) {
  const r = mulberry32(seed); const pts = [];
  const j = () => (r() * amt).toFixed(1);
  for (let i = 0; i <= n; i++) pts.push(`${((i / n) * 100).toFixed(2)}% ${j()}px`);
  for (let i = 0; i <= n; i++) pts.push(`calc(100% - ${j()}px) ${((i / n) * 100).toFixed(2)}%`);
  for (let i = n; i >= 0; i--) pts.push(`${((i / n) * 100).toFixed(2)}% calc(100% - ${j()}px)`);
  for (let i = n; i >= 0; i--) pts.push(`${j()}px ${((i / n) * 100).toFixed(2)}%`);
  return `polygon(${pts.join(',')})`;
}

const tx = (o) => (o && typeof o === 'object' ? T(o.zh, o.en) : o ?? '');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = (tag, cls, attrs = {}) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, v); return e; };
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let fontsReady = null;
function loadFonts() {
  if (!fontsReady) fontsReady = Promise.all([
    document.fonts?.load("32px 'Kid EN'"), document.fonts?.load("32px 'Kid ZH'", '双峰林奇'),
  ]).catch(() => { });
  return fontsReady;
}

/* ───────────────────────── overlay ───────────────────────── */

export function openGuide(id, { onClose } = {}) {
  const guide = GUIDES[id] || GUIDES.lynch;
  const pages = guide.pages; const N = pages.length;
  let idx = 0; let closed = false; let busy = false;
  const prevFocus = document.activeElement;

  const root = el('div', 'gd-root', { role: 'dialog', 'aria-modal': 'true' });
  root.innerHTML = `
    <div class="gd-sheet">
      <header class="gd-head">
        <div class="gd-title"><span class="gd-kicker"></span><h2 class="gd-h"></h2></div>
        <div class="gd-tools">
          <button type="button" class="gd-btn gd-lang"></button>
          <button type="button" class="gd-btn gd-close"><canvas aria-hidden="true"></canvas><span class="gd-sr"></span></button>
        </div>
      </header>
      <main class="gd-stage" aria-live="polite"></main>
      <footer class="gd-foot">
        <button type="button" class="gd-btn gd-arrow gd-prev"><canvas aria-hidden="true"></canvas><span class="gd-sr"></span></button>
        <div class="gd-count"></div>
        <button type="button" class="gd-btn gd-arrow gd-next"><canvas aria-hidden="true"></canvas><span class="gd-sr"></span></button>
        <nav class="gd-toc"></nav>
      </footer>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const stage = $('.gd-stage'), toc = $('.gd-toc');
  const sheetSeed = hash(guide.id);
  $('.gd-sheet').style.clipPath = tornClip(sheetSeed, 6, 26);
  document.body.appendChild(root);
  drawIcon($('.gd-prev canvas'), 'prev', 11); drawIcon($('.gd-next canvas'), 'next', 12); drawIcon($('.gd-close canvas'), 'close', 13);

  const pageTitle = (p) => (p.type === 'sources' ? T('资料来源', 'Sources') : tx(p.stickers?.[0]?.t));

  function stickerHTML(s, i, seed) {
    const r = mulberry32(seed + i * 97); const rot = (r() * 8 - 4).toFixed(2);
    const src = s.src?.length ? `<footer class="gd-src">${esc(T('来源', 'Sources'))} ${s.src.map(esc).join(' · ')}${s.v ? ` · <span class="gd-v gd-v-${s.v}">${esc(s.v === 'checked' ? T('已核对', 'checked') : T('待复核', 'to re‑check'))}</span>` : ''}</footer>` : '';
    return `<article class="gd-sticker gd-tone-${s.tone || 'white'}" style="--rot:${rot}deg;--i:${i}">
      ${s.tape ? `<span class="gd-tape" style="--tr:${(r() * 10 - 5).toFixed(1)}deg;--tx:${(r() * 40 - 20).toFixed(0)}%"></span>` : ''}
      <h3>${esc(tx(s.t))}</h3><p>${esc(tx(s.b))}</p>${src}</article>`;
  }
  function sourcesHTML(p, seed) {
    const list = p.sources.map((sid) => { const s = GUIDE_SOURCES[sid]; return s ? `<li><span class="gd-sid">${esc(sid)}</span> <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(tx(s.t))}</a></li>` : ''; }).join('');
    let h = `<article class="gd-sticker gd-tone-white gd-sources" style="--rot:-1.2deg;--i:0"><span class="gd-tape" style="--tr:-3deg;--tx:0%"></span>
      <h3>${esc(T('资料来源', 'Sources'))}</h3><ul>${list}</ul></article>`;
    if (p.listen) h += stickerHTML({ t: L2('听原声', 'Listen to the score'), b: p.listen, tone: 'blue' }, 1, seed);
    h += stickerHTML({ t: L2('非官方粉丝导览', 'Unofficial fan guide'), b: p.note, tone: 'yellow' }, 2, seed);
    return h;
  }

  function buildSpread(i) {
    const p = pages[i]; const seed = hash(guide.id + ':' + i);
    const sp = el('section', 'gd-spread' + (p.type === 'sources' ? ' gd-spread-sources' : ''), { 'aria-label': `${i + 1} / ${N} · ${pageTitle(p)}` });
    const r = mulberry32(seed);
    sp.innerHTML = `
      <figure class="gd-art" style="--rot:${(r() * 3 - 1.5).toFixed(2)}deg">
        <div class="gd-art-paper"><canvas role="img"></canvas></div>
        <span class="gd-tape gd-tape-tl"></span><span class="gd-tape gd-tape-br"></span>
        ${p.stamp ? `<div class="gd-stamp" style="--rot:${(r() * 20 - 14).toFixed(1)}deg"><span>${esc(p.stamp)}</span></div>` : ''}
        <figcaption class="gd-pageno">${i + 1}</figcaption>
      </figure>
      <div class="gd-stickers">${p.type === 'sources' ? sourcesHTML(p, seed) : p.stickers.map((s, j) => stickerHTML(s, j, seed)).join('')}</div>`;
    sp.querySelector('.gd-art-paper').style.clipPath = tornClip(seed, 4, 14);
    const cv = sp.querySelector('canvas'); cv.setAttribute('aria-label', tx(p.alt));
    sp._draw = () => drawScene(cv, p.scene, seed);
    return sp;
  }

  function renderChrome() {
    root.setAttribute('aria-label', tx(guide.title)); root.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
    $('.gd-kicker').textContent = T('导览', 'Guide');
    $('.gd-h').textContent = tx(guide.title);
    const other = getLang() === 'zh' ? 'en' : 'zh';
    const lb = $('.gd-lang'); lb.textContent = other === 'en' ? 'EN' : '中文';
    lb.setAttribute('aria-label', T('切换语言：', 'Switch language: ') + (LANGS[other] || other)); lb.lang = other === 'en' ? 'en' : 'zh-CN';
    $('.gd-close .gd-sr').textContent = T('合上导览（Esc）', 'Close guide (Esc)');
    $('.gd-prev .gd-sr').textContent = T('上一页', 'Previous page');
    $('.gd-next .gd-sr').textContent = T('下一页', 'Next page');
    $('.gd-prev').disabled = idx === 0; $('.gd-next').disabled = idx === N - 1;
    $('.gd-count').innerHTML = `<span>${esc(T('第', 'Page'))}</span> <b>${idx + 1}</b> <span>/ ${N}${esc(T(' 页', ''))}</span>`;
    toc.setAttribute('aria-label', T('目录', 'Contents'));
    toc.innerHTML = pages.map((p, j) => `<button type="button" class="gd-btn gd-chip${j === idx ? ' is-on' : ''}" data-i="${j}" style="--rot:${((((j * 37) % 9) - 4) * 0.8).toFixed(1)}deg" aria-label="${esc(`${j + 1}. ${pageTitle(p)}`)}" ${j === idx ? 'aria-current="page"' : ''}>${j + 1}</button>`).join('');
    toc.querySelector('.is-on')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }

  let current = null;
  function show(i, dir = 0) {
    i = Math.max(0, Math.min(N - 1, i));
    if (current && i === idx && dir) return;
    idx = i;
    const next = buildSpread(i);
    const old = current; current = next;
    const anim = dir && !reduceMotion() && old;
    if (anim) next.classList.add(dir > 0 ? 'gd-in-next' : 'gd-in-prev');
    stage.appendChild(next);
    next._draw();
    stage.scrollTop = 0;
    if (old) {
      if (anim) {
        busy = true; old.classList.add(dir > 0 ? 'gd-out-next' : 'gd-out-prev');
        const done = () => { old.remove(); next.classList.remove('gd-in-next', 'gd-in-prev'); busy = false; };
        setTimeout(done, 560);
      } else old.remove();
    }
    renderChrome();
  }
  const go = (d) => { if (!busy) show(idx + d, d); };

  // events
  $('.gd-prev').addEventListener('click', () => go(-1));
  $('.gd-next').addEventListener('click', () => go(1));
  $('.gd-close').addEventListener('click', () => close());
  $('.gd-lang').addEventListener('click', () => setLang(getLang() === 'zh' ? 'en' : 'zh'));
  toc.addEventListener('click', (e) => { const b = e.target.closest('.gd-chip'); if (b) { const j = +b.dataset.i; if (j !== idx) show(j, j > idx ? 1 : -1); } });

  const onKey = (e) => {
    if (closed) return;
    e.stopPropagation(); // the guide owns the keyboard while open
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    else if (e.key === 'Home') { e.preventDefault(); show(0, -1); }
    else if (e.key === 'End') { e.preventDefault(); show(N - 1, 1); }
    else if (e.key === 'Tab') {
      const f = [...root.querySelectorAll('button:not([disabled]), a[href]')].filter((x) => x.offsetParent !== null && !x.closest('.gd-out-next,.gd-out-prev'));
      if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      else if (!root.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
    }
  };
  window.addEventListener('keydown', onKey, true);

  // swipe
  let sx = 0, sy = 0, st = 0, tracking = false;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; tracking = true; sx = e.clientX; sy = e.clientY; st = performance.now(); });
  stage.addEventListener('pointerup', (e) => {
    if (!tracking) return; tracking = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 55 && Math.abs(dy) < Math.abs(dx) * 0.7 && performance.now() - st < 900) go(dx < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', () => { tracking = false; });

  // redraw on resize
  let rt = 0;
  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => current?._draw(), 120); });
  ro.observe(stage);

  const offLang = onLang(() => { if (!closed) show(idx, 0); });

  show(0, 0);
  loadFonts().then(() => { if (!closed) current?._draw(); });
  requestAnimationFrame(() => root.classList.add('is-open'));
  setTimeout(() => $('.gd-close')?.focus({ preventScroll: true }), 30);

  function close() {
    if (closed) return; closed = true;
    window.removeEventListener('keydown', onKey, true);
    offLang(); ro.disconnect(); clearTimeout(rt);
    root.classList.remove('is-open'); root.classList.add('is-closing');
    setTimeout(() => root.remove(), reduceMotion() ? 0 : 260);
    try { prevFocus?.focus?.({ preventScroll: true }); } catch { }
    onClose?.();
  }
  return close;
}

const L2 = (zh, en) => ({ zh, en });
export const GUIDE_IDS = Object.keys(GUIDES);
