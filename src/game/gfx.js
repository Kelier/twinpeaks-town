// Rendering kit: renderer + cinematic post, procedural worn textures, warped set geometry, light beams, dust.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createRenderer(canvasHost) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasHost.append(renderer.domElement);
  return renderer;
}

// Film finish: tilt-shift blur bands, chromatic fringe, grade, vignette, grain, fade to black, letterbox.
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, fade: { value: 1 }, flash: { value: 0 },
    res: { value: new THREE.Vector2(1, 1) }, red: { value: 0 }, bars: { value: .0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, fade, flash, red, bars; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    vec3 tap(vec2 uv, float k){
      vec2 d = (uv-.5); float ca = .0004 + .001*dot(d,d);
      return vec3(texture2D(tDiffuse, uv + d*ca*k).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d*ca*k).b);
    }
    void main(){
      vec2 uv = vUv;
      // tilt-shift: blur grows towards top and bottom of frame
      float band = smoothstep(.18, .5, abs(uv.y-.52)*1.35);
      vec2 px = 1./res; vec3 c = tap(uv,1.);
      if (band > .01){
        vec3 acc = c; float r = band*1.6;
        for(int i=0;i<8;i++){ float a = float(i)*.785398; acc += tap(uv + vec2(cos(a),sin(a))*px*r*(1.+float(i/4)), 1.); }
        c = mix(c, acc/9., band);
      }
      // glow: bright pixels bleed softly (cheap ring-sampled bloom)
      vec3 glow = vec3(0.);
      for(int i=0;i<12;i++){ float a=float(i)*.5236; vec2 o=vec2(cos(a),sin(a))*px;
        glow += max(texture2D(tDiffuse, uv+o*7.).rgb-.62,0.) + max(texture2D(tDiffuse, uv+o*18.).rgb-.62,0.)*.7; }
      c += glow*.16;
      // grade: crushed blacks slightly cold, highlights warm, desaturated mids
      float l = dot(c, vec3(.299,.587,.114));
      c = mix(vec3(l), c, .82);
      c += vec3(-.006,.0,.012)*(1.-smoothstep(0.,.25,l));
      c *= mix(vec3(1.), vec3(1.05,1.,.92), smoothstep(.35,1.,l));
      c = mix(c, c*vec3(1.25,.55,.5), red);
      // vignette + grain + gentle flicker
      vec2 v = uv-.5; v.x *= res.x/res.y*.8;
      c *= mix(.25, 1., smoothstep(1.0, .3, length(v)));
      float g = h(uv*res + fract(time)*91.7) - .5; c += g*.024;
      c *= .998 + .002*sin(time*1.7);
      c = c*fade + vec3(flash);
      float lb = step(uv.y, bars) + step(1.-bars, uv.y); c = mix(c, vec3(0.), lb);
      gl_FragColor = vec4(max(c, 0.), 1.);
    }`,
};

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());
  const bloom = null;
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);
  return { composer, bloom, finish };
}

// ---------- noise & canvas textures ----------
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function valueNoise(seed) {
  const r = rng(seed), P = new Float32Array(256 * 256); for (let i = 0; i < P.length; i++) P[i] = r();
  const at = (x, y) => P[((y & 255) << 8) | (x & 255)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
}
function fbm(n, x, y, oct = 5) { let a = 0, f = 1, w = .5, s = 0; for (let i = 0; i < oct; i++) { a += n(x * f, y * f) * w; s += w; f *= 2; w *= .5; } return a / s; }

const texCache = new Map();
/** paint(ctx, size, helpers) draws the base; a grime pass (stains, soot towards the bottom) is added on top. */
export function canvasTexture(key, paint, { size = 512, grime = .5, repeat = [1, 1], soot = .35 } = {}) {
  const ck = key + repeat.join(',');
  if (texCache.has(ck)) return texCache.get(ck);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const n = valueNoise(key.length * 977 + 13);
  paint(ctx, size, { n, fbm: (x, y, o) => fbm(n, x, y, o), rnd: rng(key.length * 31 + 7) });
  if (grime > 0) {
    const img = ctx.getImageData(0, 0, size, size), d = img.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const st = fbm(n, x / size * 6, y / size * 6, 5);
      const spot = Math.max(0, fbm(n, x / size * 14 + 40, y / size * 14, 3) - .55) * 2.2;
      const k = 1 - grime * (Math.max(0, st - .42) * 1.4 + spot * .5) - soot * Math.pow(y / size, 3);
      d[i] *= k; d[i + 1] *= k * .98; d[i + 2] *= k * .95;
    }
    ctx.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.anisotropy = 4;
  texCache.set(ck, t);
  return t;
}

const hex = (c) => '#' + new THREE.Color(c).getHexString();

export const TEX = {
  plaster: (base = '#3a2f28', rep) => canvasTexture('plaster' + base, (c, s, { fbm }) => {
    const col = new THREE.Color(base).convertLinearToSRGB(); const img = c.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = .82 + fbm(x / s * 9, y / s * 9, 4) * .3; const i = (y * s + x) * 4;
      img.data[i] = col.r * 255 * v; img.data[i + 1] = col.g * 255 * v; img.data[i + 2] = col.b * 255 * v; img.data[i + 3] = 255;
    } c.putImageData(img, 0, 0);
  }, { repeat: rep || [3, 2], grime: .7 }),
  wallpaper: (bg, fg, rep) => canvasTexture('wp' + bg + fg, (c, s, { fbm }) => {
    c.fillStyle = bg; c.fillRect(0, 0, s, s);
    c.strokeStyle = fg; c.lineWidth = s / 90; c.globalAlpha = .55;
    for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) {
      const cx = (k + .5 + (j % 2) * .5) * s / 4, cy = (j + .5) * s / 4;
      c.beginPath(); c.ellipse(cx, cy, s / 14, s / 9, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(cx, cy - s / 9); c.quadraticCurveTo(cx + s / 16, cy, cx, cy + s / 9); c.stroke();
    }
    c.globalAlpha = 1;
    for (let x = 0; x < s; x += s / 8) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, 0, 2, s); }
  }, { repeat: rep || [4, 2], grime: .85, soot: .5 }),
  planks: (base = '#3b2516', rep) => canvasTexture('planks' + base, (c, s, { fbm, rnd }) => {
    const col = new THREE.Color(base).convertLinearToSRGB(); const img = c.createImageData(s, s); const rows = 8;
    const shade = Array.from({ length: rows }, () => .75 + rnd() * .4);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const r = Math.floor(y / s * rows), gy = (y / s * rows) % 1;
      const grain = .9 + .055 * Math.sin((y / s * 220 + fbm(x / s * 3, y / s * 18 + r, 3) * 4) * 2.2) + (fbm(x / s * 2, y / s * 70, 3) - .5) * .16;
      const seam = gy < .04 || gy > .97 ? .35 : 1;
      const v = shade[r] * grain * seam; const i = (y * s + x) * 4;
      img.data[i] = col.r * 255 * v; img.data[i + 1] = col.g * 255 * v; img.data[i + 2] = col.b * 255 * v; img.data[i + 3] = 255;
    } c.putImageData(img, 0, 0);
  }, { repeat: rep || [4, 4], grime: .6, soot: 0 }),
  damask: (rep) => canvasTexture('damask', (c, s) => {
    c.fillStyle = '#3c5a2c'; c.fillRect(0, 0, s, s);
    const motif = (cx, cy, k) => {
      c.save(); c.translate(cx, cy); c.scale(k, k); c.fillStyle = '#5f8240'; c.strokeStyle = '#26401a'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, -60); c.bezierCurveTo(30, -40, 40, -5, 0, 30); c.bezierCurveTo(-40, -5, -30, -40, 0, -60); c.fill(); c.stroke();
      for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(0, 30); c.bezierCurveTo(sx * 40, 40, sx * 55, 0, sx * 40, -25); c.bezierCurveTo(sx * 30, 0, sx * 20, 15, 0, 30); c.fill(); c.stroke(); }
      c.beginPath(); c.ellipse(0, 50, 10, 18, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
    };
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) motif((i + (j % 2) * .5) * s / 2.5 + s / 6, j * s / 2.5 + s / 6, s / 512 * .9);
  }, { repeat: rep || [1, 1], grime: .6, soot: .3 }),
  rug: (rep) => canvasTexture('rug', (c, s) => {
    c.fillStyle = '#6b1a17'; c.fillRect(0, 0, s, s);
    c.strokeStyle = '#d9c7a0'; c.lineWidth = s / 40; c.strokeRect(s * .06, s * .06, s * .88, s * .88);
    c.strokeStyle = '#1d2a44'; c.lineWidth = s / 60; c.strokeRect(s * .12, s * .12, s * .76, s * .76);
    c.save(); c.translate(s / 2, s / 2);
    for (const [r, col] of [[s * .3, '#d9c7a0'], [s * .22, '#1d2a44'], [s * .14, '#a83226'], [s * .06, '#d9c7a0']]) { c.fillStyle = col; c.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, rr = k % 2 ? r * .72 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * .7); } c.fill(); }
    c.restore(); c.fillStyle = '#d9c7a0';
    for (let k = 0; k < 24; k++) { c.beginPath(); c.arc(s * .09 + k * s * .036, s * .09, s * .008, 0, 7); c.arc(s * .09 + k * s * .036, s * .91, s * .008, 0, 7); c.fill(); }
  }, { repeat: rep || [1, 1], grime: .55, soot: 0 }),
  velvetFold: () => canvasTexture('velvetFold', (c, s, { fbm }) => {
    const img = c.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const f = Math.pow(Math.abs(Math.sin(x / s * Math.PI * 9 + fbm(x / s * 3, y / s * 2, 3) * 2)), .6);
      const v = .25 + .75 * f; const i = (y * s + x) * 4;
      img.data[i] = 150 * v; img.data[i + 1] = 18 * v; img.data[i + 2] = 22 * v; img.data[i + 3] = 255;
    } c.putImageData(img, 0, 0);
  }, { repeat: [1, 1], grime: .2, soot: 0 }),
  knotty: (rep) => canvasTexture('knotty', (c, s, { fbm, rnd }) => {
    const img = c.createImageData(s, s); const cols = 6;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const col = Math.floor(x / s * cols), gx = (x / s * cols) % 1;
      const g = .88 + .08 * Math.sin((y / s * 18 + fbm(x / s * 6, y / s * 2 + col, 3) * 6) * 2) + (fbm(x / s * 3, y / s * 9, 3) - .5) * .2;
      const knot = Math.max(0, 1 - Math.hypot((gx - .5) * 3, ((y / s * 5 + col * .37) % 1 - .5) * 2) * 2) * .5;
      const v = g * (gx < .03 ? .5 : 1) * (1 - knot); const i = (y * s + x) * 4;
      img.data[i] = 170 * v; img.data[i + 1] = 105 * v; img.data[i + 2] = 55 * v; img.data[i + 3] = 255;
    } c.putImageData(img, 0, 0);
  }, { repeat: rep || [1, 1], grime: .4, soot: .2 }),
  logs: (rep) => canvasTexture('logs', (c, s, { fbm }) => {
    const img = c.createImageData(s, s); const rows = 5;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const gy = (y / s * rows) % 1; const round = Math.sin(gy * Math.PI);
      const v = (.35 + .65 * round) * (.85 + .15 * Math.sin(x / s * 60 + fbm(x / s * 4, y / s * 9, 3) * 6)); const i = (y * s + x) * 4;
      img.data[i] = 120 * v; img.data[i + 1] = 72 * v; img.data[i + 2] = 40 * v; img.data[i + 3] = 255;
    } c.putImageData(img, 0, 0);
  }, { repeat: rep || [1, 1], grime: .5, soot: .3 }),
  floral: (rep) => canvasTexture('floral', (c, s, { rnd }) => {
    c.fillStyle = '#6b5a3a'; c.fillRect(0, 0, s, s);
    for (let k = 0; k < 40; k++) { const x = rnd() * s, y = rnd() * s, r = 8 + rnd() * 10; c.fillStyle = ['#8a3a2a', '#a8854a', '#4f6a3a'][k % 3];
      for (let p = 0; p < 5; p++) { const a = p / 5 * 6.283; c.beginPath(); c.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * .6, r * .35, a, 0, 7); c.fill(); } }
  }, { repeat: rep || [1, 1], grime: .7, soot: .4 }),
  checker: (a, b, rep) => canvasTexture('chk' + a + b, (c, s) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? a : b; c.fillRect(x * s / 4, y * s / 4, s / 4, s / 4); }
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 3; for (let k = 0; k <= 4; k++) { c.beginPath(); c.moveTo(k * s / 4, 0); c.lineTo(k * s / 4, s); c.moveTo(0, k * s / 4); c.lineTo(s, k * s / 4); c.stroke(); }
  }, { repeat: rep || [8, 3], grime: .55, soot: 0 }),
  chevron: (rep) => canvasTexture('chevron', (c, s) => {
    c.fillStyle = '#d9d2c2'; c.fillRect(0, 0, s, s); c.fillStyle = '#0b0a0a';
    const per = s / 4, half = s / 4, amp = s / 8;
    for (let y = -per; y < s + per; y += per) {
      c.beginPath();
      for (let x = 0; x <= s; x += half) c.lineTo(x, y + ((x / half) % 2 ? amp : 0));
      for (let x = s; x >= 0; x -= half) c.lineTo(x, y + per / 2 + ((x / half) % 2 ? amp : 0));
      c.closePath(); c.fill();
    }
  }, { repeat: rep || [6, 2], grime: .45, soot: 0 }),
  moss: (rep) => canvasTexture('moss', (c, s, { fbm }) => {
    const img = c.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = fbm(x / s * 8, y / s * 8, 6), w = fbm(x / s * 30 + 9, y / s * 30, 3); const i = (y * s + x) * 4;
      img.data[i] = 18 + v * 30 + w * 8; img.data[i + 1] = 26 + v * 40 + w * 10; img.data[i + 2] = 18 + v * 22; img.data[i + 3] = 255;
    } c.putImageData(img, 0, 0);
  }, { repeat: rep || [6, 2], grime: .3, soot: 0 }),
  bark: (base = '#2a211a', rep) => canvasTexture('bark' + base, (c, s, { fbm }) => {
    const col = new THREE.Color(base).convertLinearToSRGB(); const img = c.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = .55 + .7 * Math.abs(Math.sin(x / s * 38 + fbm(x / s * 4, y / s * 2, 4) * 6)) * fbm(x / s * 10, y / s * 3, 3); const i = (y * s + x) * 4;
      img.data[i] = col.r * 255 * v; img.data[i + 1] = col.g * 255 * v; img.data[i + 2] = col.b * 255 * v; img.data[i + 3] = 255;
    } c.putImageData(img, 0, 0);
  }, { repeat: rep || [2, 3], grime: .2, soot: 0 }),
  fabric: (base, rep) => canvasTexture('fab' + base, (c, s, { fbm }) => {
    const col = new THREE.Color(base).convertLinearToSRGB(); const img = c.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = .8 + .12 * Math.sin(x * .9) * Math.sin(y * .9) + fbm(x / s * 12, y / s * 12, 3) * .25; const i = (y * s + x) * 4;
      img.data[i] = col.r * 255 * v; img.data[i + 1] = col.g * 255 * v; img.data[i + 2] = col.b * 255 * v; img.data[i + 3] = 255;
    } c.putImageData(img, 0, 0);
  }, { repeat: rep || [2, 2], grime: .55 }),
};

export function mat(color, { map, rough = .85, metal = 0, emissive, emissiveIntensity = 1, sheen, transparent, opacity = 1, side } = {}) {
  const P = sheen ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const o = { color, roughness: rough, metalness: metal, opacity, side: side ?? THREE.FrontSide }; if (map) o.map = map; if (transparent) o.transparent = true;
  const m = new P(o);
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity; }
  if (sheen) { m.sheen = 1; m.sheenColor = new THREE.Color(sheen); m.sheenRoughness = .5; }
  return m;
}

// ---------- hand-made crookedness ----------
const warpN = valueNoise(4242);
export function warpGeometry(geo, amount = .06, lean = .012, origin = new THREE.Vector3()) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).add(origin);
    const h = Math.max(0, Math.min(1, (v.y - .1) / 1.2));
    const nx = warpN(v.x * .23 + 7, v.y * .23) - .5, nz = warpN(v.z * .23 + 3, v.y * .23 + 11) - .5, ny = warpN(v.x * .3, v.z * .3 + 5) - .5;
    v.x += (nx * amount * 2 + lean * v.y) * h; v.z += nz * amount * 1.4 * h; v.y += ny * amount * .5 * h;
    v.sub(origin); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Box from min/max corners, subdivided + warped, receiving/casting shadows. */
export function slab(min, max, material, { warp = .05, seg = null, uvScale = 1, cast = true } = {}) {
  const sx = max[0] - min[0], sy = max[1] - min[1], sz = max[2] - min[2];
  const s = seg || [Math.max(1, Math.ceil(sx / .8)), Math.max(1, Math.ceil(sy / .8)), Math.max(1, Math.ceil(sz / .8))];
  const geo = new THREE.BoxGeometry(sx, sy, sz, ...s);
  // world-scaled UVs so textures keep their size on long walls
  const uv = geo.attributes.uv, pos = geo.attributes.position, nrm = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i) + sx / 2, y = pos.getY(i) + sy / 2, z = pos.getZ(i) + sz / 2, ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i));
    if (ax > .5) uv.setXY(i, z / 4 * uvScale, y / 4 * uvScale); else if (ay > .5) uv.setXY(i, x / 4 * uvScale, z / 4 * uvScale); else uv.setXY(i, x / 4 * uvScale, y / 4 * uvScale);
  }
  const center = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  if (warp) warpGeometry(geo, warp, warp * .2, center);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(center); mesh.castShadow = cast; mesh.receiveShadow = true;
  return mesh;
}

export function cylinder(x, y0, z, r, h, material, { r2, seg = 24, warp = .03, cast = true } = {}) {
  const geo = new THREE.CylinderGeometry(r2 ?? r, r, h, seg, Math.max(1, Math.ceil(h / .6)));
  if (warp) warpGeometry(geo, warp, 0, new THREE.Vector3(x, y0 + h / 2, z));
  const m = new THREE.Mesh(geo, material); m.position.set(x, y0 + h / 2, z); m.castShadow = cast; m.receiveShadow = true;
  return m;
}

/** Heavy velvet curtain run: folds along x (or z) hanging from height top. */
export function curtain(x0, x1, z, top, material, { seed = 1, depth = .5, along = 'x', bottom = 0 } = {}) {
  const r = rng(seed); const L = Math.abs(x1 - x0); const cols = Math.ceil(L * 14), rows = 26;
  const folds = []; let s = 0; while (s < L + 1) { const w = .5 + r() * .6; folds.push([s, w, depth * (.6 + r() * .5), r() * 6.3]); s += w; }
  const geo = new THREE.PlaneGeometry(L, top - bottom, cols, rows); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + L / 2, yy = p.getY(i) + (top - bottom) / 2 + bottom; const hgt = 1 - (yy - bottom) / (top - bottom);
    let f = folds[0]; for (const F of folds) { if (u < F[0] + F[1]) { f = F; break; } }
    const t = (u - f[0]) / f[1]; const d = f[2] * Math.pow(Math.abs(Math.sin(Math.PI * t)), .65) * (.7 + .4 * hgt) + .1 * Math.max(0, .5 - (yy - bottom)) ** 2;
    p.setXYZ(i, x0 + u * Math.sign(x1 - x0) + .08 * Math.sin(t * 6.28) * hgt, yy, d);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material); m.receiveShadow = true; m.castShadow = true;
  if (along === 'x') m.position.z = z; else { m.rotation.y = Math.PI / 2; m.position.x = z; }
  return m;
}

// ---------- light beams & dust ----------
const beamMat = (color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { color: { value: new THREE.Color(color) }, strength: { value: .22 }, time: { value: 0 } },
  vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV; void main(){ vH=uv.y; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform vec3 color; uniform float strength, time; varying float vH; varying vec3 vN; varying vec3 vV;
    void main(){ float edge=pow(abs(dot(vN,vV)),1.6); float fall=pow(vH,1.4); float fl=.9+.1*sin(time*3.+vH*9.);
      gl_FragColor=vec4(color*strength*edge*fall*fl,1.); }`,
});
export function beam(from, to, radius, color, strength = .22) {
  const dir = new THREE.Vector3().subVectors(to, from); const len = dir.length();
  const geo = new THREE.CylinderGeometry(.04, radius, len, 32, 1, true);
  const m = new THREE.Mesh(geo, beamMat(color)); m.material.uniforms.strength.value = strength;
  m.position.copy(from).addScaledVector(dir, .5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
  m.renderOrder = 10; m.userData.beam = true;
  return m;
}

export function dust(count, box, color = '#e8dcc8', size = .035) {
  const g = new THREE.BufferGeometry(); const p = new Float32Array(count * 3); const r = rng(9);
  for (let i = 0; i < count; i++) { p[i * 3] = box.min.x + r() * (box.max.x - box.min.x); p[i * 3 + 1] = box.min.y + r() * (box.max.y - box.min.y); p[i * 3 + 2] = box.min.z + r() * (box.max.z - box.min.z); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const pts = new THREE.Points(g, m); pts.userData.dust = { box, base: p.slice() };
  return pts;
}
export function animateDust(pts, t) {
  const p = pts.geometry.attributes.position, b = pts.userData.dust.base, box = pts.userData.dust.box;
  for (let i = 0; i < p.count; i++) {
    const y = box.min.y + ((b[i * 3 + 1] - box.min.y + t * .05 * (1 + (i % 5) * .2)) % (box.max.y - box.min.y));
    p.setXYZ(i, b[i * 3] + Math.sin(t * .3 + i) * .15, y, b[i * 3 + 2] + Math.cos(t * .25 + i * 1.7) * .15);
  }
  p.needsUpdate = true;
}

export function spot(color, intensity, pos, target, { angle = .5, penumbra = .6, distance = 40, decay = 1.4, shadow = true, mapSize = 1024 } = {}) {
  const l = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);
  l.position.copy(pos); l.target.position.copy(target);
  if (shadow) { l.castShadow = true; l.shadow.mapSize.set(mapSize, mapSize); l.shadow.bias = -.0004; l.shadow.normalBias = .03; l.shadow.radius = 4; }
  return l;
}
export { hex };

// Low drifting fog cards: soft noise sprites layered in depth (Little Nightmares-style atmosphere)
let fogTex = null;
export function fogCards(count, box, color = '#9fb0c8', opacity = .18) {
  if (!fogTex) fogTex = canvasTexture('fogcard', (c, s, { fbm }) => {
    const img = c.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = x / s - .5, dy = y / s - .5; const r = Math.max(0, 1 - Math.hypot(dx * 1.4, dy * 3.2) * 2);
      const v = fbm(x / s * 4, y / s * 4, 4); const i = (y * s + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.max(0, Math.min(255, (v - .35) * 2.2 * r * 255));
    } c.putImageData(img, 0, 0);
  }, { grime: 0, size: 256 });
  const g = new THREE.Group(); const r = rng(77);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: fogTex, color, transparent: true, opacity: opacity * (.3 + r() * .35), depthWrite: false, fog: false }));
    m.position.set(box.min.x + r() * (box.max.x - box.min.x), box.min.y + r() * (box.max.y - box.min.y), Math.min(-2.9, box.min.z + r() * (box.max.z - box.min.z)));
    m.userData.drift = (r() - .5) * .3; m.renderOrder = 5; g.add(m);
  }
  g.userData.box = box;
  return g;
}
export function animateFog(g, dt) {
  const b = g.userData.box;
  for (const m of g.children) { m.position.x += m.userData.drift * dt; if (m.position.x > b.max.x) m.position.x = b.min.x; if (m.position.x < b.min.x) m.position.x = b.max.x; }
}
