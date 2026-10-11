// Original procedural set pieces that make each place recognisable. Each factory returns a Group
// positioned at the origin; callers place it. Animated parts are exposed on group.userData.
import * as THREE from 'three';
import { pieTop, marble, feathers, textile, carvedPost, neonText, radial, leafCluster, sycamoreBark } from './textures.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...o });
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: .5, ...o });
function add(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = shadow; parent.add(m); return m;
}
const V = (x, y) => new THREE.Vector2(x, y);

// ---------------------------------------------------------------- Diner
// Cherry pie with one slice cut out, pie dish, a slice on a saucer beside it.
export function cherryPie() {
  const g = new THREE.Group();
  const crust = std('#c98d4a', { roughness: .7 }), filling = phys('#6e0b12', { roughness: .18, clearcoat: .8, clearcoatRoughness: .2 });
  const top = std('#ffffff', { map: pieTop(), roughness: .55 });
  const dish = phys('#e8e1d2', { roughness: .25, clearcoat: .6 });
  add(g, new THREE.LatheGeometry([V(0, 0), V(.27, 0), V(.33, .06), V(.345, .065), V(.34, .07)], 48), dish);
  const cut = .9, start = Math.PI * .15;
  const body = new THREE.CylinderGeometry(.31, .29, .09, 48, 1, false, start + cut, Math.PI * 2 - cut);
  const pie = add(g, body, [crust, top, crust], 0, .1, 0);
  // Cut faces reveal the glossy filling.
  filling.side = THREE.DoubleSide;
  const radialFace = (parent, theta, r, cx = 0, cz = 0, y = .1) => { const f = add(parent, new THREE.PlaneGeometry(r, .085), filling, cx + Math.sin(theta) * r / 2, y, cz + Math.cos(theta) * r / 2); f.rotation.y = theta - Math.PI / 2; return f; };
  radialFace(g, start, .3); radialFace(g, start + cut, .3);
  // A slice on a small plate in front of the dome.
  const slice = new THREE.Group(); slice.position.set(.05, 0, .66); g.add(slice);
  add(slice, new THREE.CylinderGeometry(.2, .15, .015, 40), dish, 0, .008, 0);
  const sr = .22, mid = .3 + cut / 2, tx = -Math.sin(mid) * sr * .55, tz = -Math.cos(mid) * sr * .55;
  add(slice, new THREE.CylinderGeometry(sr, sr, .085, 12, 1, false, .3, cut), [crust, top, crust], tx, .058, tz);
  radialFace(slice, .3, sr, tx, tz, .058); radialFace(slice, .3 + cut, sr, tx, tz, .058);
  const fork = std('#cfd2cc', { metalness: 1, roughness: .2 });
  const fk = add(slice, new THREE.BoxGeometry(.012, .006, .2), fork, .13, .02, .04); fk.rotation.y = .5;
  g.userData.pie = pie;
  return g;
}

// Ceiling fan with brass hub and walnut blades; rotate userData.rotor.
export function ceilingFan(wood) {
  const g = new THREE.Group();
  const brass = phys('#b08d55', { metalness: .9, roughness: .3 });
  add(g, new THREE.CylinderGeometry(.012, .012, .45, 8), brass, 0, -.22, 0);
  add(g, new THREE.CylinderGeometry(.09, .06, .07, 24), brass, 0, -.02, 0);
  const rotor = new THREE.Group(); rotor.position.y = -.5; g.add(rotor);
  add(rotor, new THREE.CylinderGeometry(.13, .16, .14, 24), brass);
  add(rotor, new THREE.SphereGeometry(.07, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), phys('#f3dfb0', { emissive: '#f0c27c', emissiveIntensity: .8 }), 0, -.07, 0);
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group(); arm.rotation.y = i * Math.PI * 2 / 5; rotor.add(arm);
    add(arm, new THREE.BoxGeometry(.2, .015, .04), brass, .2, 0, 0);
    const blade = add(arm, new THREE.BoxGeometry(.62, .012, .15), wood, .6, -.005, 0); blade.rotation.x = .16;
  }
  g.userData.rotor = rotor;
  return g;
}

// Neon "Double R" script with a dark backing board and tube standoffs.
export function neonSign(text = 'Double R', color = '#ff3a46', w = 2.4) {
  const g = new THREE.Group(), h = w * .31;
  add(g, new THREE.BoxGeometry(w * 1.04, h * 1.05, .04), std('#151213', { roughness: .4, metalness: .2 }), 0, 0, -.03);
  const glow = new THREE.MeshBasicMaterial({ map: neonText(text, { color }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const m = add(g, new THREE.PlaneGeometry(w, h), glow, 0, 0, .01, false);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.8, h * 2.6), new THREE.MeshBasicMaterial({ map: radial([[0, .5], [.4, .18], [1, 0]]), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .45 }));
  halo.position.z = .005; g.add(halo);
  g.userData.glow = [glow, halo.material];
  return g;
}

// ---------------------------------------------------------------- Lodge
// Palmate antler outline extruded; mirrored pair on a moose head mount with a walnut shield.
function antlerShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.bezierCurveTo(.12, .05, .2, .1, .26, .14);
  const tines = 8;
  for (let i = 0; i < tines; i++) { const a = -.15 + i / (tines - 1) * 1.55, r = .46 + Math.sin(i / (tines - 1) * Math.PI) * .08, c = [.2, .12]; s.lineTo(c[0] + Math.cos(a) * r * .74, c[1] + Math.sin(a) * r * .74); s.lineTo(c[0] + Math.cos(a + .07) * r, c[1] + Math.sin(a + .07) * r); s.lineTo(c[0] + Math.cos(a + .14) * r * .74, c[1] + Math.sin(a + .14) * r * .74); }
  s.bezierCurveTo(.1, .4, .06, .2, 0, .08); s.lineTo(0, 0);
  return s;
}
export function mooseMount(wood) {
  const g = new THREE.Group();
  const fur = std('#3e2a1c', { roughness: .95 }), muzzle = std('#5a4330', { roughness: .9 }), bone = phys('#a68b64', { roughness: .6, clearcoat: .15 }), dark = phys('#0b0807', { roughness: .15, clearcoat: 1 });
  const shield = add(g, new THREE.CylinderGeometry(.46, .46, .07, 8), wood, 0, 0, -.03); shield.rotation.x = Math.PI / 2; shield.scale.set(1, 1, 1.25);
  const neck = add(g, new THREE.SphereGeometry(.3, 24, 16), fur, 0, -.05, .08); neck.scale.set(.95, 1.05, .55);
  // Long horse-like face angled down and out, heavy overhanging muzzle, dewlap.
  const face = add(g, new THREE.SphereGeometry(.2, 28, 18), fur, 0, -.06, .42); face.scale.set(1, 1.05, 2.3); face.rotation.x = .25;
  const nose = add(g, new THREE.SphereGeometry(.16, 24, 16), muzzle, 0, -.24, .84); nose.scale.set(1.05, .95, 1.3); nose.rotation.x = .3;
  const lip = add(g, new THREE.SphereGeometry(.1, 16, 10), muzzle, 0, -.35, .86); lip.scale.set(1.2, .6, 1);
  const bell = add(g, new THREE.ConeGeometry(.07, .32, 10), fur, 0, -.42, .3); bell.rotation.x = Math.PI + .25;
  for (const sx of [-1, 1]) {
    add(g, new THREE.SphereGeometry(.035, 10, 8), dark, sx * .065, -.27, 1.0);
    add(g, new THREE.SphereGeometry(.03, 12, 10), dark, sx * .17, .03, .4);
    const ear = add(g, new THREE.ConeGeometry(.065, .24, 10), fur, sx * .27, .12, .16); ear.rotation.z = -sx * 1.25; ear.scale.z = .5;
    const pedicle = add(g, new THREE.CylinderGeometry(.045, .06, .16, 10), bone, sx * .18, .2, .18); pedicle.rotation.z = -sx * .9;
    const geo = new THREE.ExtrudeGeometry(antlerShape(), { depth: .03, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 8 });
    const ant = add(g, geo, bone, sx * .22, .24, .12); ant.scale.set(sx * 1.05, .9, 1); ant.rotation.set(-.6, sx * -.3, sx * .1);
  }
  return g;
}

// Hanging blanket with gentle drape and fringe; sheen reads as wool under firelight.
export function hangingTextile(variant = 0, w = 1.5, h = 2.05) {
  const geo = new THREE.PlaneGeometry(w, h, 24, 6), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 9) * .012 + (1 - (y + h / 2) / h) * .02 * Math.sin(x * 4 + 1)); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: textile(variant), roughness: .92, sheen: .6, sheenRoughness: .6, sheenColor: new THREE.Color('#d8b88a'), alphaTest: .4, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m);
  add(g, new THREE.CylinderGeometry(.02, .02, w + .24, 10), std('#2b1c12'), 0, h / 2 + .03, .02).rotation.z = Math.PI / 2;
  return g;
}

// Carved, painted post sleeve with relief bands; wings at the crown. Fits around an existing column.
export function carvedPostSleeve(height = 2.6, radius = .34) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40, y = t * height; const bulge = .03 * Math.sin(t * Math.PI * 8) + (t % .25 < .02 ? .04 : 0); pts.push(V(radius + bulge, y)); }
  const mat = std('#ffffff', { map: carvedPost(), roughness: .75, bumpMap: carvedPost(), bumpScale: .03 });
  add(g, new THREE.LatheGeometry(pts, 40), mat);
  const paint = std('#7d2620', { roughness: .7 });
  for (const sx of [-1, 1]) {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(.5, .1, .7, .45); shape.lineTo(.55, .32); shape.lineTo(.5, .4); shape.lineTo(.38, .24); shape.lineTo(.3, .3); shape.quadraticCurveTo(.15, .12, 0, .12);
    const wing = add(g, new THREE.ExtrudeGeometry(shape, { depth: .06, bevelEnabled: false }), paint, sx * radius * .9, height - .45, -.03);
    wing.scale.x = sx;
  }
  const beak = add(g, new THREE.ConeGeometry(.08, .3, 4), std('#d9c9a2', { roughness: .6 }), 0, height - .3, radius + .08); beak.rotation.x = Math.PI / 2;
  return g;
}

// ---------------------------------------------------------------- Woods
// Pale mottled sycamore: forked trunk, a few limbs and broad-leaf cluster cards.
export function sycamore(seed = 0, height = 9) {
  const g = new THREE.Group(), r = (() => { let s = seed * 9301 + 49297; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const bk = sycamoreBark([5, 1.5]); const bark = std('#c4bfae', { ...bk, bumpScale: 1, roughness: .9 });
  const lean = (r() - .5) * .25;
  const limbs = [];
  const limb = (from, dir, len, rad, depth) => {
    const pts = [from.clone()]; let p = from.clone(), d = dir.clone();
    for (let i = 1; i <= 4; i++) { d.x += (r() - .5) * .25; d.z += (r() - .5) * .25; d.normalize(); p = p.clone().addScaledVector(d, len / 4); pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(curve, 10, rad, 8, false);
    const pa = geo.attributes.position, c = new THREE.Vector3(); // taper toward the tip
    for (let i = 0; i < pa.count; i++) { const seg = Math.min(10, Math.floor(i / 9)) / 10; curve.getPointAt(seg, c); const k = 1 - seg * .65; pa.setXYZ(i, c.x + (pa.getX(i) - c.x) * k, c.y + (pa.getY(i) - c.y) * k, c.z + (pa.getZ(i) - c.z) * k); }
    geo.computeVertexNormals();
    add(g, geo, bark); limbs.push(pts);
    if (depth > 0) { for (let k = 0; k < 2; k++) { const nd = d.clone().add(new THREE.Vector3((r() - .5) * 1.4, .35 + r() * .3, (r() - .5) * 1.4)).normalize(); limb(p.clone(), nd, len * .62, rad * .58, depth - 1); } }
  };
  limb(new THREE.Vector3(0, -.2, 0), new THREE.Vector3(lean, 1, lean * .5).normalize(), height * .45, .26, 2);
  const leafMat = new THREE.MeshStandardMaterial({ map: leafCluster(), alphaTest: .45, side: THREE.DoubleSide, roughness: .85, color: '#9fae8a' });
  const tips = limbs.filter((_, i) => i > 0).map((pts) => pts[4]).concat(limbs.slice(1).map((pts) => pts[2]));
  const count = tips.length * 10, leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), leafMat, count), d = new THREE.Object3D();
  let n = 0;
  for (const t of tips) for (let k = 0; k < 10; k++) { d.position.set(t.x + (r() - .5) * 1.2, t.y + (r() - .5) * .8, t.z + (r() - .5) * 1.2); d.rotation.set(r() * 3, r() * 3, r() * 3); d.scale.setScalar(.9 + r() * .9); d.updateMatrix(); leaves.setMatrixAt(n++, d.matrix); }
  leaves.count = n; g.add(leaves);
  g.userData.leaves = leaves; g.userData.limbs = limbs;
  return g;
}

// Great horned owl silhouette. userData.eyes are MeshBasic materials for the glow pulse.
export function owl() {
  const g = new THREE.Group();
  const plume = std('#ffffff', { map: feathers(), roughness: .9 }), face = std('#8a7258', { roughness: .9 }), beakM = std('#2a241c', { roughness: .4 });
  const body = add(g, new THREE.SphereGeometry(.16, 20, 16), plume, 0, .2, 0); body.scale.set(1, 1.45, .9);
  const head = add(g, new THREE.SphereGeometry(.13, 20, 16), plume, 0, .45, .02); head.scale.set(1.12, .95, .95);
  const disc = add(g, new THREE.CircleGeometry(.11, 24), face, 0, .45, .12); disc.scale.set(1.25, .9, 1);
  for (const sx of [-1, 1]) {
    const tuft = add(g, new THREE.ConeGeometry(.035, .14, 8), plume, sx * .085, .58, .0); tuft.rotation.z = -sx * .35;
    const wing = add(g, new THREE.SphereGeometry(.12, 14, 10), plume, sx * .11, .17, -.02); wing.scale.set(.45, 1.35, .9);
    add(g, new THREE.CircleGeometry(.035, 18), new THREE.MeshBasicMaterial({ color: '#1a1408' }), sx * .055, .465, .135);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffb52e', toneMapped: false });
  for (const sx of [-1, 1]) add(g, new THREE.CircleGeometry(.022, 16), eyeMat, sx * .055, .465, .138, false);
  const pupil = new THREE.MeshBasicMaterial({ color: '#000000' });
  for (const sx of [-1, 1]) add(g, new THREE.CircleGeometry(.011, 12), pupil, sx * .055, .465, .14, false);
  const halo = new THREE.MeshBasicMaterial({ map: radial([[0, .9], [.3, .25], [1, 0]]), color: '#ffb52e', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  for (const sx of [-1, 1]) add(g, new THREE.PlaneGeometry(.16, .16), halo, sx * .055, .465, .145, false);
  const beak = add(g, new THREE.ConeGeometry(.018, .05, 6), beakM, 0, .43, .14); beak.rotation.x = Math.PI;
  for (const sx of [-1, 1]) add(g, new THREE.CylinderGeometry(.012, .008, .05, 6), beakM, sx * .05, -.02, .06);
  g.userData.eyes = eyeMat; g.userData.halo = halo; g.userData.head = head;
  return g;
}

// Traffic signal hung from a span wire; userData.pivot swings, userData.red glows.
export function trafficLight(span = 9) {
  const g = new THREE.Group();
  const pole = std('#3d3a33', { roughness: .7, metalness: .3 }), body = std('#a88a2c', { roughness: .55, metalness: .2 }), visor = std('#14140f', { roughness: .6 });
  for (const sx of [-1, 1]) add(g, new THREE.CylinderGeometry(.09, .12, 6.5, 10), pole, sx * span / 2, 3.25, 0);
  const sag = new THREE.CatmullRomCurve3([new THREE.Vector3(-span / 2, 6.2, 0), new THREE.Vector3(-span / 4, 5.9, 0), new THREE.Vector3(0, 5.75, 0), new THREE.Vector3(span / 4, 5.9, 0), new THREE.Vector3(span / 2, 6.2, 0)]);
  add(g, new THREE.TubeGeometry(sag, 40, .012, 5, false), visor, 0, 0, 0, false);
  const pivot = new THREE.Group(); pivot.position.set(0, 5.75, 0); g.add(pivot);
  add(pivot, new THREE.CylinderGeometry(.01, .01, .3, 5), visor, 0, -.15, 0, false);
  add(pivot, new THREE.BoxGeometry(.36, 1.05, .3), body, 0, -.82, 0);
  const lamps = [];
  ['#ff2a1c', '#ffb21e', '#2cff9a'].forEach((c, i) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(.08), toneMapped: false });
    for (const sz of [1, -1]) {
      const lens = add(pivot, new THREE.CircleGeometry(.1, 20), m, 0, -.5 - i * .32, sz * .152, false); if (sz < 0) lens.rotation.y = Math.PI;
      add(pivot, new THREE.BoxGeometry(.26, .02, .13), visor, 0, -.39 - i * .32, sz * .21, false);
    }
    lamps.push({ mat: m, color: new THREE.Color(c) });
  });
  const halo = new THREE.MeshBasicMaterial({ map: radial([[0, .8], [.25, .25], [1, 0]]), color: '#ff2a1c', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .8 });
  const hp = add(pivot, new THREE.PlaneGeometry(1.2, 1.2), halo, 0, -.5, .2, false);
  g.userData.pivot = pivot; g.userData.lamps = lamps; g.userData.halo = halo; g.userData.haloMesh = hp;
  return g;
}

// ---------------------------------------------------------------- Red room
// Armless classical goddess (original sculpt): lathe torso with contrapposto, draped skirt, head
// with a bun, on a turned marble plinth. ~2.1 m overall.
export function venusStatue() {
  const g = new THREE.Group();
  const mm = marble();
  const stoneMat = new THREE.MeshPhysicalMaterial({ color: '#f6f1e8', map: mm.map, roughnessMap: mm.roughnessMap, bumpMap: mm.bumpMap, bumpScale: .01, roughness: .5, clearcoat: .35, clearcoatRoughness: .35, sheen: .25, sheenColor: new THREE.Color('#ffe8d8') });
  const plinth = std('#1a1617', { roughness: .25, metalness: .1 });
  add(g, new THREE.BoxGeometry(.62, .1, .62), plinth, 0, .05, 0);
  add(g, new THREE.LatheGeometry([V(.0, 0), V(.24, 0), V(.24, .05), V(.19, .1), V(.17, .5), V(.15, .62), V(.2, .68), V(.25, .72), V(.25, .76), V(0, .76)], 40), plinth, 0, .1, 0);
  const fig = new THREE.Group(); fig.position.y = .86; g.add(fig);
  // Draped lower body: heavy folds hanging from the hips, gathered at the feet.
  const skirt = new THREE.LatheGeometry([V(.17, 0), V(.215, .05), V(.225, .25), V(.205, .5), V(.19, .66), V(.2, .74), V(.17, .79)], 56); const sp = skirt.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), a = Math.atan2(z, x); const knee = .22 * Math.exp(-((a - 1.35) ** 2) / .12) * Math.exp(-((y - .42) ** 2) / .03); const k = 1 + .08 * Math.sin(a * 7 + y * 5) * (1 - y / .85) + .035 * Math.sin(a * 15 + 1) + knee; sp.setXYZ(i, x * k * 1.18, y, z * k * .8); }
  skirt.computeVertexNormals(); add(fig, skirt, stoneMat).rotation.y = .4;
  const roll = add(fig, new THREE.TorusGeometry(.17, .045, 14, 48), stoneMat, .01, .78, 0); roll.rotation.set(Math.PI / 2 + .18, .1, 0); roll.scale.set(1.05, .8, 1);
  // Bare torso in one smooth profile: hip, waist, ribcage, chest, shoulder line, neck.
  const torso = new THREE.LatheGeometry([V(.16, 0), V(.14, .08), V(.122, .16), V(.13, .25), V(.148, .33), V(.155, .4), V(.17, .46), V(.15, .5), V(.08, .54), V(.058, .57), V(.055, .64), V(0, .65)], 48);
  // Sculpt: wide pelvis, narrow waist, broad sloping shoulders, softer back, belly and chest forward.
  const tp = torso.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
    const wx = 1.28 - .3 * Math.exp(-((y - .16) ** 2) / .006) + .45 * Math.exp(-((y - .47) ** 2) / .0025) - .1 * Math.exp(-((y - .3) ** 2) / .01);
    const wz = (.66 + (z > 0 ? .06 * Math.exp(-((y - .08) ** 2) / .004) : 0)) * (1 - .25 * Math.exp(-((y - .47) ** 2) / .003));
    tp.setXYZ(i, x * wx + Math.sin(y * 4) * .012, y, z * wz);
  }
  torso.computeVertexNormals();
  const tr = add(fig, torso, stoneMat, .015, .78, 0); tr.rotation.set(.04, -.25, -.07);
  for (const sx of [-1, 1]) { const b = add(fig, new THREE.SphereGeometry(.058, 24, 16), stoneMat, sx * .062 + .01, 1.13, .07); b.scale.set(1, .92, .78); }
  // Broken-off arms: rounded shoulder stumps.
  for (const sx of [-1, 1]) { const st = add(fig, new THREE.SphereGeometry(.062, 20, 14), stoneMat, sx * .175 + .005, 1.24, -.005); st.scale.set(.95, 1.25, .85); }
  const head = add(fig, new THREE.SphereGeometry(.1, 28, 20), stoneMat, -.005, 1.5, .025); head.scale.set(.85, 1.1, 1);
  const hair = add(fig, new THREE.SphereGeometry(.104, 28, 20, 0, Math.PI * 2, 0, Math.PI * .55), stoneMat, -.005, 1.515, .012); hair.scale.set(.9, 1.08, 1.04); hair.rotation.x = -.35;
  add(fig, new THREE.SphereGeometry(.06, 20, 14), stoneMat, -.01, 1.53, -.085).scale.set(1, .85, .9);
  const nose = add(fig, new THREE.ConeGeometry(.014, .045, 6), stoneMat, -.005, 1.49, .122); nose.rotation.x = Math.PI / 2 + .25;
  const chin = add(fig, new THREE.SphereGeometry(.035, 14, 10), stoneMat, -.005, 1.425, .07); chin.scale.set(1, .8, .9);
  fig.rotation.set(0, -.12, .02);
  g.userData.material = stoneMat;
  return g;
}

// Soft radial contact shadow (multiply-like dark blob) sitting on the floor.
export function contactBlob(w, d, opacity = .55) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: radial([[0, 1], [.45, .6], [1, 0]]), color: '#000000', transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1; m.userData.atmosphere = true;
  return m;
}
