// Procedural surface textures for the eye-level environments.
// Every generator returns tileable CanvasTextures (albedo + roughness + bump where it matters)
// and is cached at module scope so revisiting a place never regenerates pixels.
import * as THREE from 'three';

const cache = new Map();
const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Periodic value noise: tileable as long as every octave period divides the texture.
function noise2(seed) {
  const r = rng(seed), N = 256, g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y, p, q) => g[((y % q + q) % q) * N + ((x % p + p) % p)];
  return (x, y, p, q = p) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi, p, q), b = at(xi + 1, yi, p, q), c = at(xi, yi + 1, p, q), d = at(xi + 1, yi + 1, p, q);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
// fbm over normalised (0..1) coordinates; base = cells across the tile.
function fbmMaker(seed) {
  const n = noise2(seed);
  return (u, v, base = 4, oct = 4, bx = base) => {
    let s = 0, a = .5, f = 1;
    for (let o = 0; o < oct; o++) { const px = Math.max(1, Math.min(256, Math.round(bx * f))), py = Math.max(1, Math.min(256, Math.round(base * f))); s += a * n(u * px, v * py, px, py); a *= .5; f *= 2; }
    return s / (1 - Math.pow(.5, oct));
  };
}

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { srgb = true, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = aniso;
  return t;
}
// Fill three canvases (albedo, roughness, height) from a per-pixel function in one pass.
function field(size, fn, sizeY = size) {
  const ca = canvas(size, sizeY), cr = canvas(size, sizeY), ch = canvas(size, sizeY);
  const ia = ca.getContext('2d').createImageData(size, sizeY), ir = cr.getContext('2d').createImageData(size, sizeY), ih = ch.getContext('2d').createImageData(size, sizeY);
  const out = [0, 0, 0, .5, .5];
  for (let y = 0; y < sizeY; y++) for (let x = 0; x < size; x++) {
    fn(x / size, y / sizeY, out, x, y);
    const i = (y * size + x) * 4;
    ia.data[i] = out[0]; ia.data[i + 1] = out[1]; ia.data[i + 2] = out[2]; ia.data[i + 3] = 255;
    const r = Math.max(0, Math.min(255, out[3] * 255)), h = Math.max(0, Math.min(255, out[4] * 255));
    ir.data[i] = ir.data[i + 1] = ir.data[i + 2] = r; ir.data[i + 3] = 255;
    ih.data[i] = ih.data[i + 1] = ih.data[i + 2] = h; ih.data[i + 3] = 255;
  }
  ca.getContext('2d').putImageData(ia, 0, 0); cr.getContext('2d').putImageData(ir, 0, 0); ch.getContext('2d').putImageData(ih, 0, 0);
  return { ca, cr, ch };
}
function set(maps, repeat) {
  return { map: tex(maps.ca, { repeat }), roughnessMap: tex(maps.cr, { srgb: false, repeat }), bumpMap: tex(maps.ch, { srgb: false, repeat }) };
}
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// Vertical tongue-and-groove boards with figured grain; used for walls, counters, furniture.
export function woodPanel(size = 512, { boards = 6, base = '#6a4330', dark = '#3a2418', light = '#8a5c3e', seed = 11 } = {}) {
  return memo(`wood${size}${boards}${base}${seed}`, () => {
    const f = fbmMaker(seed), g = fbmMaker(seed + 7), r = rng(seed), tint = Array.from({ length: boards }, () => .82 + r() * .3);
    const B = hex(base), D = hex(dark), L = hex(light);
    return field(size, (u, v, o) => {
      const bi = Math.floor(u * boards), bu = u * boards - bi;
      const warp = f(u, v, 3, 3, 6) * 1.6;
      const ring = Math.sin((bu * 5 + warp + bi * 1.7) * Math.PI * 2) * .5 + .5;
      const fine = g(u, v, 4, 3, 256);
      const knot = Math.pow(f(u + .5, v, 8, 2), 6) * 1.6;
      const grain = clamp(.25 + ring * .3 + fine * .45 - knot * .4);
      const groove = Math.min(bu, 1 - bu) * size / boards;
      const gap = groove < 1.6 ? .25 : groove < 3 ? .7 : 1;
      const t = tint[bi];
      for (let k = 0; k < 3; k++) o[k] = clamp((grain < .5 ? mix(D[k], B[k], grain * 2) : mix(B[k], L[k], (grain - .5) * 2)) * t * gap, 0, 255);
      o[3] = .5 + fine * .22 - ring * .08 + (gap < 1 ? .3 : 0);
      o[4] = .55 + grain * .25 - (gap < 1 ? .5 : 0);
    });
  });
}
export function woodSet(opts = {}, repeat = [1, 1]) { const m = woodPanel(opts.size, opts); return set(m, repeat); }

// Horizontal plank floor for the lodge.
export function plankFloor(repeat = [3, 3]) {
  const m = memo('plank', () => {
    const f = fbmMaker(31), g = fbmMaker(37), r = rng(5), rows = 8, offs = Array.from({ length: rows * 4 }, () => r()), tint = Array.from({ length: rows * 4 }, () => .78 + r() * .35);
    return field(512, (u, v, o) => {
      const ri = Math.floor(v * rows), rv = v * rows - ri;
      const pu = u * 2 + offs[ri], pi = Math.floor(pu) + ri * 4, pv = pu - Math.floor(pu);
      const grain = clamp(Math.sin((rv * 2.5 + f(u, v, 2, 3, 2) * 2.5) * Math.PI * 3) * .3 + .5 + (g(u, v, 4, 3, 64) - .5) * .9);
      const edge = Math.min(rv, 1 - rv) * 64, joint = Math.min(pv, 1 - pv) * 256;
      const gap = edge < 1.4 || joint < 1.2 ? .3 : 1;
      const t = tint[pi % tint.length];
      o[0] = clamp(mix(70, 140, grain) * t * gap, 0, 255); o[1] = clamp(mix(42, 92, grain) * t * gap, 0, 255); o[2] = clamp(mix(26, 58, grain) * t * gap, 0, 255);
      o[3] = .42 + (1 - grain) * .2 + (gap < 1 ? .35 : 0) + f(u, v, 6, 3) * .15;
      o[4] = .6 + grain * .2 - (gap < 1 ? .55 : 0);
    });
  });
  return set(m, repeat);
}

// Worn diner linoleum: cream and bottle-green checks, grout seams, scuffs, wax sheen variation.
export function linoleum(repeat = [4, 5]) {
  const m = memo('lino', () => {
    const f = fbmMaker(91), g = fbmMaker(97), n = 8;
    const A = [214, 202, 176], Bc = [28, 40, 34];
    const maps = field(1024, (u, v, o) => {
      const cx = Math.floor(u * n), cy = Math.floor(v * n), dark = (cx + cy) % 2 === 1;
      const lu = u * n - cx, lv = v * n - cy, seam = Math.min(lu, 1 - lu, lv, 1 - lv) * 128;
      const grime = f(u, v, 6, 4), speck = g(u, v, 128, 2);
      const wear = clamp((f(u + .3, v, 3, 3) - .45) * 2.2);
      const c = dark ? Bc : A;
      const edgeDirt = seam < 2 ? .45 : seam < 6 ? .8 + seam * .02 : 1;
      const s = (1 - grime * .22 - (speck > .82 ? .12 : 0)) * edgeDirt;
      for (let k = 0; k < 3; k++) o[k] = clamp(c[k] * s * (dark ? 1 + wear * .45 : 1 - wear * .1), 0, 255);
      o[3] = .2 + grime * .22 + wear * .3 + (seam < 2 ? .4 : 0);
      o[4] = seam < 2 ? .1 : .6 + speck * .08;
    });
    // Scuff marks from chair feet and shoes.
    const ctx = maps.ca.getContext('2d'), rc = maps.cr.getContext('2d'), r = rng(4);
    for (let i = 0; i < 260; i++) {
      const x = r() * 1024, y = r() * 1024, a = r() * Math.PI, l = 8 + r() * 40;
      ctx.strokeStyle = `rgba(20,16,12,${.05 + r() * .12})`; rc.strokeStyle = `rgba(200,200,200,${.2 + r() * .3})`;
      for (const c of [ctx, rc]) { c.lineWidth = .6 + r() * 1.6; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * .5 + r() * 6, y + Math.sin(a) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    }
    return maps;
  });
  return set(m, repeat);
}

// Acoustic ceiling tiles with T-bar grid and a couple of old water stains.
export function ceilingTiles(repeat = [4, 5]) {
  const m = memo('ceil', () => {
    const f = fbmMaker(55), g = fbmMaker(57), n = 4;
    const maps = field(512, (u, v, o) => {
      const lu = u * n % 1, lv = v * n % 1, bar = Math.min(lu, 1 - lu, lv, 1 - lv) * 128;
      const pit = g(u, v, 128, 1) > .72 ? .78 : 1, mott = f(u, v, 4, 4);
      const base = bar < 2.5 ? 150 : 178 * pit * (.88 + mott * .2);
      o[0] = base; o[1] = base * .96; o[2] = base * .86;
      o[3] = bar < 2.5 ? .45 : .92; o[4] = bar < 2.5 ? .9 : .6 * pit;
    });
    const ctx = maps.ca.getContext('2d'), r = rng(8);
    for (let i = 0; i < 3; i++) {
      const x = r() * 512, y = r() * 512, rad = 20 + r() * 40;
      for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(110,74,34,${.18 - k * .04})`; ctx.lineWidth = 2 + k * 2; ctx.beginPath(); ctx.ellipse(x, y, rad - k * 6, rad * .8 - k * 5, r(), 0, Math.PI * 2); ctx.stroke(); }
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(120,90,50,.12)'); gr.addColorStop(1, 'rgba(120,90,50,0)'); ctx.fillStyle = gr; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    return maps;
  });
  return set(m, repeat);
}

// Forest floor: soil, moss pads, needle litter; wet areas carry lower roughness.
export function forestFloor(repeat = [9, 10]) {
  const m = memo('forest', () => {
    const f = fbmMaker(71), g = fbmMaker(73), h = fbmMaker(79);
    const maps = field(1024, (u, v, o) => {
      const moss = clamp((f(u, v, 4, 5) - .48) * 3.5), soil = g(u, v, 16, 4), wet = clamp((h(u, v, 3, 3) - .55) * 4);
      const sr = mix(34, 58, soil), sg = mix(30, 48, soil), sb = mix(24, 36, soil);
      const mr = mix(38, 70, soil), mg = mix(56, 92, soil), mb = mix(34, 52, soil);
      const d = 1 - wet * .35;
      o[0] = mix(sr, mr, moss) * d; o[1] = mix(sg, mg, moss) * d; o[2] = mix(sb, mb, moss) * d;
      o[3] = .95 - wet * .6; o[4] = .4 + moss * .3 + soil * .2;
    });
    const ctx = maps.ca.getContext('2d'), hc = maps.ch.getContext('2d'), r = rng(19);
    for (let i = 0; i < 4200; i++) {
      const x = r() * 1024, y = r() * 1024, a = r() * Math.PI * 2, l = 5 + r() * 12;
      const tone = r();
      ctx.strokeStyle = tone > .6 ? `rgba(120,84,48,${.35 + r() * .3})` : tone > .3 ? `rgba(84,62,38,.45)` : `rgba(150,128,90,.3)`;
      ctx.lineWidth = .7 + r() * .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      if (i % 3 === 0) { hc.strokeStyle = 'rgba(230,230,230,.5)'; hc.lineWidth = 1; hc.beginPath(); hc.moveTo(x, y); hc.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); hc.stroke(); }
    }
    for (let i = 0; i < 160; i++) { const x = r() * 1024, y = r() * 1024; ctx.fillStyle = `rgba(${90 + r() * 40},${86 + r() * 30},${76 + r() * 20},.7)`; ctx.beginPath(); ctx.ellipse(x, y, 2 + r() * 5, 1.5 + r() * 3, r() * 3, 0, Math.PI * 2); ctx.fill(); }
    return maps;
  });
  return set(m, repeat);
}

// Mottled plane-tree / sycamore bark: pale patches flaking over olive-grey bark.
export function sycamoreBark(repeat = [2, 3]) {
  const m = memo('syc', () => {
    const f = fbmMaker(41), g = fbmMaker(43);
    return field(512, (u, v, o) => {
      const p = f(u, v * .5, 5, 4, 3), q = g(u, v, 32, 3);
      const patch = p > .56 ? 2 : p > .47 ? 1 : 0;
      const col = patch === 2 ? [206, 202, 180] : patch === 1 ? [150, 146, 118] : [96, 94, 78];
      const s = .82 + q * .3;
      o[0] = col[0] * s; o[1] = col[1] * s; o[2] = col[2] * s;
      o[3] = .7 + q * .25; o[4] = patch * .2 + q * .3 + .2;
    });
  });
  return set(m, repeat);
}

// Polished veined marble for the statue and plinths.
export function marble(repeat = [1, 1]) {
  const m = memo('marble', () => {
    const f = fbmMaker(13), g = fbmMaker(17);
    return field(512, (u, v, o) => {
      const w = f(u, v, 3, 5);
      const vein = Math.pow(1 - Math.abs(Math.sin((u * 2 + v * 3 + w * 3.2) * Math.PI)), 28);
      const cloud = g(u, v, 6, 4);
      const b = 240 - cloud * 18 - vein * 34;
      o[0] = b; o[1] = b * .985; o[2] = b * .97;
      o[3] = .22 + cloud * .15 + vein * .2; o[4] = .5 + cloud * .1 - vein * .15;
    });
  });
  return set(m, repeat);
}

// Fieldstone / river rock tone breakup for the hearth.
export function stone(repeat = [1, 1]) {
  const m = memo('stone', () => {
    const f = fbmMaker(61), g = fbmMaker(67);
    return field(256, (u, v, o) => {
      const a = f(u, v, 4, 5), b = g(u, v, 32, 2);
      const s = 150 + (a - .5) * 90 + (b > .8 ? -30 : 0);
      o[0] = s; o[1] = s * .96; o[2] = s * .9; o[3] = .82 + b * .15; o[4] = a * .7 + b * .3;
    });
  });
  return set(m, repeat);
}

// Repeating geometric blanket pattern (original stepped-diamond design) for lodge textiles.
export function textile(variant = 0) {
  return memo('textile' + variant, () => {
    const c = canvas(512, 704), x = c.getContext('2d');
    const pal = variant ? ['#e3d6b8', '#7a1f22', '#1d2a2a', '#c48a3a', '#3f6a68'] : ['#2a1c18', '#b2452f', '#e8d8b5', '#d39a3f', '#2f5452'];
    x.fillStyle = pal[0]; x.fillRect(0, 0, 512, 704);
    const band = (y, h, col) => { x.fillStyle = col; x.fillRect(0, y, 512, h); };
    band(30, 26, pal[1]); band(62, 8, pal[3]); band(634, 8, pal[3]); band(648, 26, pal[1]);
    // Stepped diamonds.
    const diamond = (cx, cy, r, cols) => { cols.forEach((col, k) => { const rr = r - k * 18; if (rr <= 0) return; x.fillStyle = col; x.beginPath(); for (let s = 0; s <= 8; s++) { const step = rr / 8 * s; x.lineTo(cx - rr + step, cy - step); } for (let s = 0; s <= 8; s++) { const step = rr / 8 * s; x.lineTo(cx + step, cy - rr + step); } for (let s = 0; s <= 8; s++) { const step = rr / 8 * s; x.lineTo(cx + rr - step, cy + step); } for (let s = 0; s <= 8; s++) { const step = rr / 8 * s; x.lineTo(cx - step, cy + rr - step); } x.fill(); }); };
    diamond(256, 352, 150, [pal[2], pal[1], pal[4], pal[3], pal[2]]);
    for (const cy of [160, 544]) for (const cx of [90, 422]) diamond(cx, cy, 60, [pal[4], pal[2], pal[1]]);
    // Zigzag borders.
    x.strokeStyle = pal[2]; x.lineWidth = 7;
    for (const y of [110, 594]) { x.beginPath(); for (let i = 0; i <= 32; i++) x.lineTo(i * 16, y + (i % 2 ? -12 : 12)); x.stroke(); }
    // Woven texture & wear.
    const r = rng(3 + variant);
    for (let y = 0; y < 704; y += 3) { x.fillStyle = `rgba(0,0,0,${.05 + r() * .05})`; x.fillRect(0, y, 512, 1); }
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() > .5 ? '255,240,210' : '0,0,0'},${r() * .07})`; x.fillRect(r() * 512, r() * 704, 2, 1); }
    // Fringe (alpha) along the bottom.
    x.clearRect(0, 690, 512, 14);
    for (let i = 0; i < 512; i += 5) { x.fillStyle = pal[2]; x.fillRect(i, 688, 2, 10 + r() * 6); }
    const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

// Carved & painted post texture: ovoid eyes, U-forms and bands (original, generic carving language).
export function carvedPost() {
  return memo('post', () => {
    const c = canvas(512, 1024), x = c.getContext('2d'), r = rng(23);
    x.fillStyle = '#6b4a32'; x.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 2600; i++) { x.strokeStyle = `rgba(${r() > .5 ? '30,18,10' : '150,110,70'},${r() * .2})`; x.lineWidth = 1; const xx = r() * 512, yy = r() * 1024; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + r() * 4 - 2, yy + 20 + r() * 40); x.stroke(); }
    const faces = 4;
    for (let k = 0; k < faces; k++) {
      const y0 = k * 256;
      x.fillStyle = k % 2 ? '#1c2321' : '#7d2620'; x.fillRect(0, y0, 512, 14); x.fillRect(0, y0 + 242, 512, 14);
      for (const cx of [128, 384]) {
        x.fillStyle = '#121414'; x.beginPath(); x.ellipse(cx - 46, y0 + 96, 40, 26, 0, 0, Math.PI * 2); x.ellipse(cx + 46, y0 + 96, 40, 26, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#d9c9a2'; x.beginPath(); x.ellipse(cx - 46, y0 + 96, 18, 12, 0, 0, Math.PI * 2); x.ellipse(cx + 46, y0 + 96, 18, 12, 0, 0, Math.PI * 2); x.fill();
        x.strokeStyle = k % 2 ? '#7d2620' : '#2f5452'; x.lineWidth = 12; x.beginPath(); x.moveTo(cx - 70, y0 + 150); x.quadraticCurveTo(cx, y0 + 220, cx + 70, y0 + 150); x.stroke();
        x.strokeStyle = '#121414'; x.lineWidth = 8; x.beginPath(); x.moveTo(cx - 92, y0 + 60); x.quadraticCurveTo(cx - 46, y0 + 40, cx, y0 + 66); x.quadraticCurveTo(cx + 46, y0 + 40, cx + 92, y0 + 60); x.stroke();
      }
    }
    const t = tex(c); t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

// Lattice-top cherry pie (top cap) with golden strips over glossy red filling.
export function pieTop() {
  return memo('pie', () => {
    const c = canvas(512), x = c.getContext('2d'), r = rng(77);
    x.fillStyle = '#5e0c12'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 70; i++) { const gx = r() * 512, gy = r() * 512, rad = 10 + r() * 16; const gr = x.createRadialGradient(gx - 3, gy - 3, 1, gx, gy, rad); gr.addColorStop(0, '#d23a3e'); gr.addColorStop(.5, '#8c1219'); gr.addColorStop(1, 'rgba(70,6,10,0)'); x.fillStyle = gr; x.beginPath(); x.arc(gx, gy, rad, 0, Math.PI * 2); x.fill(); }
    const strip = (horizontal, p) => { const g = horizontal ? x.createLinearGradient(0, p - 20, 0, p + 20) : x.createLinearGradient(p - 20, 0, p + 20, 0); g.addColorStop(0, '#7a4a1e'); g.addColorStop(.3, '#d9a25a'); g.addColorStop(.55, '#f0c27e'); g.addColorStop(1, '#8d5523'); x.fillStyle = g; if (horizontal) x.fillRect(0, p - 20, 512, 40); else x.fillRect(p - 20, 0, 40, 512); };
    for (let i = 1; i < 7; i++) strip(true, i * 73);
    for (let i = 1; i < 7; i++) { strip(false, i * 73); for (let j = 1; j < 7; j += 2) { const g = x.createLinearGradient(0, j * 73 - 20, 0, j * 73 + 20); g.addColorStop(0, '#7a4a1e'); g.addColorStop(.4, '#e6b46c'); g.addColorStop(1, '#8d5523'); x.fillStyle = g; x.fillRect(i * 73 - 20, ((i % 2) ? j : j + 1) * 73 - 20, 40, 40); } }
    for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${r() > .5 ? '255,230,180' : '90,50,20'},${r() * .25})`; x.fillRect(r() * 512, r() * 512, 2, 2); }
    // Fluted rim.
    x.lineWidth = 46; x.strokeStyle = '#c98d4a'; x.beginPath(); x.arc(256, 256, 236, 0, Math.PI * 2); x.stroke();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) { x.fillStyle = '#e8b878'; x.beginPath(); x.ellipse(256 + Math.cos(a) * 236, 256 + Math.sin(a) * 236, 14, 22, a, 0, Math.PI * 2); x.fill(); }
    return tex(c);
  });
}

// Neon tube lettering with a soft glow halo; drawn once, used additive.
export function neonText(text, { color = '#ff3a46', w = 1024, h = 320, font = 'italic 700 170px Georgia, serif' } = {}) {
  return memo('neon' + text + color, () => {
    const c = canvas(w, h), x = c.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font; x.lineJoin = 'round';
    for (const [blur, alpha, lw] of [[60, .55, 18], [28, .7, 12], [10, .9, 9]]) { x.shadowColor = color; x.shadowBlur = blur; x.strokeStyle = color; x.globalAlpha = alpha; x.lineWidth = lw; x.strokeText(text, w / 2, h / 2 + 6); }
    x.shadowBlur = 0; x.globalAlpha = 1; x.strokeStyle = '#ffe2df'; x.lineWidth = 3.5; x.strokeText(text, w / 2, h / 2 + 6);
    const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

// Linear 0..1 gradient (alpha) for wall–floor contact darkening.
export function gradientStrip() {
  return memo('strip', () => {
    const c = canvas(4, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(.6, 'rgba(255,255,255,.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 4, 128);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}
// Soft radial blob for grounding objects / glow halos.
export function radial(stops = [[0, 1], [.5, .45], [1, 0]]) {
  return memo('rad' + JSON.stringify(stops), () => {
    const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [s, a] of stops) g.addColorStop(s, `rgba(255,255,255,${a})`);
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); return t;
  });
}

// Broad-leaf cluster (alpha) for the grove's sycamores.
export function leafCluster() {
  return memo('leaf', () => {
    const c = canvas(256), x = c.getContext('2d'), r = rng(29);
    for (let i = 0; i < 26; i++) {
      const cx = 40 + r() * 176, cy = 40 + r() * 176, s = 14 + r() * 16, a = r() * Math.PI * 2;
      x.save(); x.translate(cx, cy); x.rotate(a);
      x.fillStyle = ['#3f5634', '#4d6640', '#344a2e', '#5e7046'][i % 4];
      x.beginPath(); for (let k = 0; k <= 10; k++) { const ang = k / 10 * Math.PI * 2, rr = s * (k % 2 ? .55 : 1); x.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } x.fill();
      x.strokeStyle = 'rgba(160,170,120,.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(s, 0); x.stroke();
      x.restore();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
}

// Owl plumage: layered V-shaped feather marks over warm brown.
export function feathers() {
  return memo('feath', () => {
    const c = canvas(256), x = c.getContext('2d'), r = rng(33);
    x.fillStyle = '#5a4532'; x.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 9) for (let xx = (y / 9 % 2) * 7; xx < 256; xx += 14) {
      x.strokeStyle = r() > .5 ? 'rgba(210,190,150,.55)' : 'rgba(30,20,14,.6)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(xx - 5, y - 3); x.lineTo(xx, y + 3); x.lineTo(xx + 5, y - 3); x.stroke();
    }
    return tex(c);
  });
}
