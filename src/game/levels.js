// The four rooms. Units: player is 1.25 tall; furniture is built ~2x adult scale so the world towers over him.
// Axes: x = scroll, y = up, z = depth (camera looks from +z). Floor top is y = 0.
import * as THREE from 'three';
import { T, t } from './i18n.js';
import { TEX, mat, slab, cylinder, curtain, beam, dust, spot, animateDust, fogCards, animateFog } from './gfx.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// shared helpers -----------------------------------------------------------
export function kit(ctx) {
  const { scene, world } = ctx;
  const add = (o) => { scene.add(o); return o; };
  const solid = (min, max, m, opts = {}) => { const mesh = add(slab(min, max, m, opts)); if (!opts.decor) world.solid(min, max, { mesh, noClimb: opts.noClimb }); return mesh; };
  const puppet = (gltf, height, anim = 'idle') => {
    const model = cloneSkinned(gltf.scene); const box = new THREE.Box3().setFromObject(model);
    const k = height / (box.max.y - box.min.y); model.scale.setScalar(k); model.position.y = -box.min.y * k;
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); } });
    const g = new THREE.Group(); g.add(model); const mixer = new THREE.AnimationMixer(model); const acts = {};
    for (const c of gltf.animations) acts[c.name] = mixer.clipAction(c);
    let cur = null; const play = (n, f = .25) => { const a = acts[n]; if (!a || a === cur) return; a.reset().fadeIn(f).play(); cur?.fadeOut(f); cur = a; };
    (world.contactSubjects ||= []).push({root:g,width:height*.58,depth:height*.44});
    play(anim); world.updaters.push((dt) => mixer.update(dt));
    return { group: g, model, play, acts, mixer };
  };
  // a room modelled in Blender: TEX:<kind> materials are re-skinned with the game's worn canvas textures
  const useSet = (gltf, texOpts = {}) => {
    const g = gltf.scene.clone(true);
    g.traverse((o) => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
      o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
      const m = o.material; if (!m?.name?.startsWith('TEX:')) return;
      const kind = m.name.slice(4).split('.')[0]; const f = TEX[kind];
      if (f && !m.map) { m.map = (texOpts[kind] || f)(); m.needsUpdate = true; }
    });
    return g;
  };
  // a talking figurine: puppet + small collider + "talk" prompt; talk(p) is an async dialogue script
  const npc = (id, { name, pos, rot = 0, h = 1.25, anim = 'idle', talk, radius = 1.7, solid: isSolid = true, label } = {}) => {
    const gl = ctx.models.cast?.[id]; if (!gl) return null;
    const p = puppet(gl, h, anim); p.group.position.copy(pos); p.group.rotation.y = rot; add(p.group); p.id = id; p.name = name;
    if (isSolid) p.col = world.solid([pos.x - .3, pos.y, pos.z - .28], [pos.x + .3, pos.y + h, pos.z + .28], { noClimb: true });
    if (talk) p.talkItem = world.interact({ pos: pos.clone().add(new THREE.Vector3(0, Math.min(h, 1.4) * .6, .35)), label: label || t('talkTo', { n: name }), radius, use: async (it) => { await ctx.talk(() => talk(p, it)); } });
    return p;
  };
  return { add, solid, puppet, useSet, npc };
}

function lightsBase(scene, hemiSky = '#26324a', hemiGround = '#0d0a08', hemi = .35) {
  scene.add(new THREE.HemisphereLight(hemiSky, hemiGround, hemi));
}

// =====================================================================================
// 1 · GREAT NORTHERN, ROOM 315
// =====================================================================================
export const hotel = {
  id: 'hotel', set: 'hotel', cast: ['giant', 'ben_horne'], name: { zh: '大北方旅馆 · 315 房', en: 'The Great Northern · Room 315' }, ambience: 'hotel', bounds: [-14.5, 15.5], spawn: V(-5.2, 0, .4),
  fog: ['#0e131c', .04], exposure: 1.35,
  build(ctx) {
    const { scene, world, sound, player } = ctx; const { add, solid, useSet } = kit(ctx);
    world.defaultSurface = 'wood'; world.zMin = -1.7; world.zMax = 1.7;
    lightsBase(scene, '#33405c', '#140c08', .9);
    const wood = mat('#ffffff', { map: TEX.planks('#6a4428', [6, 2]), rough: .65 });
    const wainscot = mat('#ffffff', { map: TEX.planks('#2b1a0f', [6, 1]), rough: .6 });
    const paper = mat('#ffffff', { map: TEX.wallpaper('#3a3424', '#7a6a43', [7, 2]), rough: .95 });
    const darkWood = mat('#ffffff', { map: TEX.planks('#24140b', [2, 2]), rough: .55 });
    const linen = mat('#ffffff', { map: TEX.fabric('#b9b09a', [2, 2]), rough: .95 });
    const blanket = mat('#ffffff', { map: TEX.fabric('#4a1d1b', [3, 3]), rough: .95 });
    const set = ctx.models.sets?.hotel;
    if (set) {
      add(useSet(set, { planks: () => TEX.planks('#6a4428', [1.4, 1.4]), damask: () => TEX.damask([1.6, 1.6]), rug: () => { const t = TEX.rug([.31, .83]).clone(); t.offset.set(.5, .66); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t; } }));
      // colliders that match the Blender room
      for (const [mn, mx] of [[[-16, -.6, -6], [17, 0, 10]], [[-15, 0, -6], [-14.2, 9, 4]], [[14.2, 0, -6], [15, 9, -1.4]], [[14.2, 0, .9], [15, 9, 4]], [[14.2, 4.4, -1.4], [15, 9, .9]],
        [[-13.8, 0, -4.2], [-7.6, 1.25, 1.3]], [[-13.7, 1.25, -4.1], [-7.7, 1.55, 1.2]], [[-14.2, 0, -4.2], [-13.8, 3.4, 1.4]], [[-1.1, 0, -2.8], [1.1, 2.45, -.35]]]) world.solid(mn, mx);
      for (const x of [-11, 2.4, 13.2]) { const l = new THREE.PointLight('#ffc98a', 16, 8, 1.5); l.position.set(x, 4.9, -3.6); add(l); }
      const fill = new THREE.PointLight('#9fb0d8', 10, 16, 1.2); fill.position.set(0, 7, 3); add(fill);
    } else {
      solid([-16, -.6, -6], [17, 0, 10], wood, { warp: 0 });                 // floor
      solid([-16, 0, -4.6], [17, 1.7, -4.2], wainscot, { decor: true });     // wainscot
      solid([-16, 1.7, -4.7], [17, 9, -4.3], paper, { decor: true });        // wallpaper
      solid([-15, 0, -6], [-14.2, 9, 4], paper);                              // left wall
      solid([14.2, 0, -6], [15, 9, -1.4], paper);                             // right wall, around door
      solid([14.2, 0, .9], [15, 9, 4], paper);
      solid([14.2, 4.4, -1.4], [15, 9, .9], paper);
      // window with moonlight
      add(slab([-7.5, 2.6, -4.32], [-2.5, 6.2, -4.25], mat('#0d1830', { emissive: '#1c3060', emissiveIntensity: .9 }), { warp: .02, cast: false }));
      for (const x of [-7.5, -5, -2.5]) add(slab([x - .12, 2.5, -4.3], [x + .12, 6.3, -4.1], darkWood, { warp: .02 }));
      add(slab([-7.6, 4.35, -4.3], [-2.4, 4.5, -4.1], darkWood, { warp: .02 }));
      add(beam(V(-5, 6, -4.3), V(-2.2, 0, .8), 2.4, '#7f9cff', .12));
      // bed
      solid([-13.8, 0, -4.2], [-7.6, 1.25, 1.3], darkWood);
      solid([-13.7, 1.25, -4.1], [-7.7, 1.55, 1.2], linen);
      add(slab([-11.5, 1.5, -4.1], [-7.4, 1.72, 1.4], blanket, { warp: .12 }));
      solid([-14.2, 0, -4.2], [-13.8, 3.4, 1.4], darkWood);
      // tall bedside cabinet with lamp + ring
      solid([-1.1, 0, -2.8], [1.1, 2.45, -.35], darkWood);
      add(slab([-.9, .5, -.38], [.9, 1.0, -.3], wainscot, { warp: 0 }));

    }
    // Both the Blender set and fallback scenery share the cutscene moonlight.
    const moon = spot('#9fb6ff', 520, V(-5, 7.5, -7), V(-2.5, 0, .5), { angle: .42, penumbra: .5, distance: 30 }); add(moon); add(moon.target);
    const lampBase = add(cylinder(.1, 2.45, -1.9, .22, .9, mat('#8a6a2a', { metal: .7, rough: .35 }), { r2: .12 }));
    const shadeMat = mat('#c9a56a', { emissive: '#ffb066', emissiveIntensity: 0, rough: .9, side: THREE.DoubleSide });
    add(cylinder(.1, 3.3, -1.9, .75, .7, shadeMat, { r2: .45, warp: .02 }));
    const lamp = new THREE.PointLight('#ffb36b', 0, 14, 1.6); lamp.position.set(.1, 3.4, -1.6); lamp.castShadow = true; lamp.shadow.mapSize.set(512, 512); add(lamp);
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(.13, .035, 12, 32), mat('#e0b050', { metal: 1, rough: .25, emissive: '#5a3a00', emissiveIntensity: .4 })));
    ring.position.set(.7, 2.5, -1.0); ring.rotation.x = Math.PI / 2.3;
    // suitcase (pushable)
    const caseMesh = add(slab([-.75, 0, -.5], [.75, 1.05, .5], mat('#ffffff', { map: TEX.fabric('#5b3a24', [1, 1]), rough: .7 }), { warp: .03 }));
    caseMesh.position.set(6, .525, -1.0); caseMesh.userData.offset = V(0, .525, 0);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(1.52, .1, 1.02), mat('#1d1209')); strap.position.y = .1; caseMesh.add(strap);
    const suitcase = world.movable(caseMesh, [1.5, 1.05, 1.0]);
    if (!set) {
      // decor: armchair silhouette, coat stand, tray
      solid([9, 0, -4.1], [12.6, 1.2, -2.3], mat('#ffffff', { map: TEX.fabric('#3a2a1e'), rough: .9 }), { decor: true });
      add(slab([9, 1.2, -4.1], [12.6, 3.4, -3.5], mat('#ffffff', { map: TEX.fabric('#3a2a1e'), rough: .9 }), { warp: .08 }));
      add(cylinder(4, 0, -3.6, .08, 5.2, darkWood, { seg: 8 }));

    }
    // door (right wall)
    const doorPivot = new THREE.Group(); doorPivot.position.set(14.25, 0, .9); add(doorPivot);
    const leaf = slab([-.12, 0, -2.3], [.12, 4.4, 0], mat('#ffffff', { map: TEX.planks('#5b4632', [1, 2]), rough: .6 }), { warp: .02 }); doorPivot.add(leaf);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), mat('#a07a30', { metal: 1, rough: .3 })); knob.position.set(-.2, 2.1, -1.9); doorPivot.add(knob);
    const doorCol = world.solid([14.1, 0, -1.4], [14.4, 4.4, .9], { noClimb: true });
    const corridor = new THREE.PointLight('#ffd9a0', 0, 12, 1.4); corridor.position.set(16.5, 2.5, -.3); add(corridor);
    add(slab([15, 0, -3], [20, 6, 3], mat('#2a1e14', { emissive: '#3a2410', emissiveIntensity: .0 }), { warp: 0, cast: false }));
    const fcH = add(fogCards(8, new THREE.Box3(V(-14, .2, -4), V(14, 1.0, 1)), '#8fa0c0', .08)); world.updaters.push((dt) => animateFog(fcH, dt));
    // dust in the moonbeam
    const d = add(dust(220, new THREE.Box3(V(-9, 0, -4), V(2, 6.5, 2)))); world.updaters.push((dt, t) => animateDust(d, t));

    // --- story ---
    const flags = ctx.flags;
    ctx.intro = async () => {
      player.mode = 'locked'; player.lockAnim = 'idle';
      const base = player.model.userData.baseY;
      player.model.rotation.set(0, 0, Math.PI / 2); player.model.position.y = base + .3;
      await ctx.ready; await ctx.wait(900); ctx.say(T('……地板很冷。有人开了枪，然后一切都安静了。', '…The floor is cold. Someone fired, and then everything went quiet.'), 4200);
      await ctx.wait(4400);
      const t0 = performance.now();
      await new Promise((res) => { const step = () => { const k = Math.min(1, (performance.now() - t0) / 1400); const e = 1 - (1 - k) ** 3; player.model.rotation.z = Math.PI / 2 * (1 - e); player.model.rotation.y = player.yaw * e; player.model.position.y = base + .3 * (1 - e); if (k < 1) requestAnimationFrame(step); else res(); }; step(); });
      player.model.rotation.set(0, player.yaw, 0); player.model.position.y = base;
      player.mode = 'normal';
      ctx.hint(T('A / D 移动 · Shift 奔跑 · 空格 跳跃 · F 手电', 'A / D move · Shift run · Space jump · F flashlight'), 6000);
    };
    world.trigger([2.2, 0, -2], [5, 2, 2], () => ctx.hint(T('靠近箱子按住 E 抓住，再左右拖动', 'Hold E next to the suitcase to grab it, then drag it left or right'), 5000));
    const lampCord = world.interact({
      pos: V(.1, 3.1, -1.6), label: T('拉灯绳', 'Pull the lamp cord'), radius: 1.5, use: async (it) => {
        if (!it.enabled || flags.giant) return;
        it.enabled = false; player.mode = 'locked'; player.lockAnim = 'idle'; ctx.dropGrab(); sound.click();
        for (let i = 0; i < 5; i++) { lamp.intensity = i % 2 ? 0 : 70; shadeMat.emissiveIntensity = i % 2 ? 0 : 1.4; sound.buzz(.12); await ctx.wait(90 + Math.random() * 160); }
        lamp.intensity = 70; shadeMat.emissiveIntensity = 1.4;
        await ctx.wait(500); await giantScene();
      },
    });
    const giant = new THREE.Group(); giant.visible = false; add(giant);
    const trou = mat('#ffffff', { map: TEX.fabric('#4a4036', [1, 4]), rough: .9 }); const shoe = mat('#2a1a10', { rough: .35, metal: .1 });
    for (const dx of [-1.0, 1.0]) {
      // trouser leg: lathe profile with a cuff and a knee, rising out of frame
      const prof = [[.01, 0], [.92, 0], [.95, .25], [.86, .32], [.8, 2.5], [.72, 5.2], [.78, 7], [.9, 12], [.01, 12]].map(([r, y]) => new THREE.Vector2(r, y));
      const leg = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), trou); leg.position.set(dx, .55, 0); leg.castShadow = leg.receiveShadow = true; giant.add(leg);
      const crease = new THREE.Mesh(new THREE.BoxGeometry(.04, 11.4, .04), mat('#2a241e')); crease.position.set(dx, 6.2, .82); giant.add(crease);
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(.62, 1.5, 8, 16), shoe); foot.rotation.x = Math.PI / 2; foot.scale.set(1.05, 1, .62); foot.position.set(dx, .38, .55); foot.castShadow = true; giant.add(foot);
      const heel = new THREE.Mesh(new THREE.CylinderGeometry(.5, .55, .3, 16), shoe); heel.position.set(dx, .15, -.5); giant.add(heel);
      const lace = new THREE.Mesh(new THREE.BoxGeometry(.5, .06, .7), mat('#120a06')); lace.position.set(dx, .78, .75); lace.rotation.x = -.35; giant.add(lace);
    }
    // the hand that comes down for the ring
    const hand = new THREE.Group(); const skinM = mat('#c9a48a', { rough: .75 });
    const palm = new THREE.Mesh(new THREE.SphereGeometry(.7, 20, 14), skinM); palm.scale.set(1, 1.25, .55); hand.add(palm);
    [-.45, -.15, .15, .45].forEach((x, i) => { const f = new THREE.Mesh(new THREE.CapsuleGeometry(.14, .8 - Math.abs(x) * .4, 6, 10), skinM); f.position.set(x, -1.1 + Math.abs(x) * .2, .05); f.rotation.x = .25; hand.add(f); });
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .6, 6, 10), skinM); thumb.position.set(.75, -.35, .2); thumb.rotation.z = .9; hand.add(thumb);
    const cuffM = mat('#e8e2d2', { rough: .8 }); const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .6, 20), cuffM); cuff.position.y = 1.1; hand.add(cuff);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.75, .7, 12, 20), trou); sleeve.position.y = 7.3; hand.add(sleeve);
    hand.traverse((o) => { if (o.isMesh) { o.castShadow = true; } }); hand.position.set(.9, 16, -1.1); hand.visible = false; add(hand);
    giant.position.set(8.5, 0, -1.8);
    const giantFig = ctx.models.cast?.giant ? kit(ctx).puppet(ctx.models.cast.giant, 4.6, 'idle') : null;
    if (giantFig) { giant.clear(); giant.add(giantFig.group); giantFig.group.rotation.y = -.25; }
    const giantLight = spot('#e8f0ff', 0, V(8.5, 14, 2), V(8.5, 0, -1.8), { angle: .32, penumbra: .35, distance: 30 }); add(giantLight); add(giantLight.target);
    const giantBeam = add(beam(V(8.5, 12, -1), V(8.5, 0, -1.6), 3.2, '#cfe0ff', 0));
    async function giantScene() {
      player.mode = 'locked'; player.lockAnim = 'idle';
      sound.switchOff(); lamp.intensity = 0; shadeMat.emissiveIntensity = 0; moon.intensity = 60; ctx.dim(true);
      await ctx.wait(1300);
      giant.visible = true; giantLight.intensity = 1100; giantBeam.material.uniforms.strength.value = .25; sound.thud(1.2); ctx.focus(V(7, 2.6, 0), 1.6);
      await ctx.wait(1200); sound.giantVoice();
      for (const line of [T('「我会告诉你三件事。」', '“I will tell you three things.”'), T('「有个人在微笑的袋子里。」', '“There is a man in a smiling bag.”'), T('「猫头鹰并非它们看起来的样子。」', '“The owls are not what they seem.”'), T('「没有化学品，他指了指。」', '“Without chemicals, he points.”')]) { ctx.say(line, 3000, T('巨人', 'The Giant')); await ctx.wait(3300); }
      ctx.say(T('「我会拿走你的戒指。等你明白，我会还给你。」', '“I will take your ring. When you understand, I will give it back.”'), 3600, T('巨人', 'The Giant')); await ctx.wait(1200);
      // a giant hand descends out of the dark, pinches the ring, withdraws
      if (!giantFig) hand.visible = true; ctx.focus(V(1.5, 3.4, -1), 1.3); sound.noise({ dur: 2.2, freq: 260, q: 2, gain: .12 });
      for (let k = 0; k <= 60; k++) { hand.position.y = 16 - (16 - 3.9) * (1 - (1 - k / 60) ** 3); await ctx.wait(30); }
      await ctx.wait(500); sound.pickup(); ring.visible = false;
      for (let k = 0; k <= 50; k++) { hand.position.y = 3.9 + 12 * (k / 50) ** 2; await ctx.wait(30); } hand.visible = false;
      await ctx.wait(2400);
      sound.switchOff(); giantLight.intensity = 0; giantBeam.material.uniforms.strength.value = 0; giant.visible = false; ctx.focus(null);
      await ctx.wait(900); lamp.intensity = 60; shadeMat.emissiveIntensity = 1.2; moon.intensity = 520; ctx.dim(false);
      // door opens onto the corridor
      sound.creak(.7); corridor.intensity = 80;
      const t0 = performance.now(); await new Promise((res) => { const step = () => { const k = Math.min(1, (performance.now() - t0) / 2200); doorPivot.rotation.y = -1.3 * (1 - (1 - k) ** 3); if (k < 1) requestAnimationFrame(step); else res(); }; step(); });
      world.remove(doorCol); flags.giant = true; player.mode = 'normal'; ctx.save();
      if (ben) ben.group.visible = true;
      ctx.say(T('门开了一条缝。走廊里有光。', 'The door opens a crack. There is light in the corridor.'), 3000);
    }
    const { npc: npcH } = kit(ctx);
    const ben = npcH('ben_horne', { name: T('本·霍恩', 'Ben Horne'), pos: V(12.6, 0, -.6), rot: -.6, talk: async () => {
      await ctx.line(T('本·霍恩', 'Ben Horne'), T('库珀探员！大北方旅馆为您的不幸深表遗憾。早餐算我的。', 'Agent Cooper! The Great Northern deeply regrets your misfortune. Breakfast is on me.'), { focus: V(12.6, 1.2, -.6) });
      await ctx.line(T('本·霍恩', 'Ben Horne'), T('……您没看见什么不该看见的东西吧？比如，一个很高的人？', '…You didn’t see anything you shouldn’t have? A very tall man, perhaps?'));
    } });
    if (ben) ben.group.visible = false;
    ctx.onRestore = (f) => { lampCord.enabled = !f.giant; if (f.giant && ben) ben.group.visible = true; if (f.giant) { ring.visible = false; lamp.intensity = 60; shadeMat.emissiveIntensity = 1.2; doorPivot.rotation.y = -1.3; world.remove(doorCol); corridor.intensity = 80; } };
    world.trigger([14.6, 0, -1.4], [16, 3, .9], () => ctx.next());
    ctx.debug = { suitcase };
  },
};

// =====================================================================================
// 2 · DOUBLE R DINER
// =====================================================================================
export const diner = {
  id: 'diner', set: 'diner', cast: ['norma', 'shelly', 'audrey', 'pete', 'nadine'], name: { zh: '双 R 餐馆 · 打烊之后', en: 'The Double R · After Closing' }, ambience: 'diner', bounds: [-16, 18.5], spawn: V(-12, 0, .6),
  fog: ['#0c1616', .032], exposure: 1.4,
  build(ctx) {
    const { scene, world, sound, player } = ctx; const { add, solid: solid0, useSet } = kit(ctx);
    const set = ctx.models.sets?.diner;
    if (set) add(useSet(set, { checker: () => TEX.checker('#bfb39a', '#121212', [1, 1]), planks: () => TEX.planks('#7a4a26', [1.2, 1.2]) }));
    const solid = set ? (mn, mx, m, o = {}) => (o.decor ? null : world.solid(mn, mx, { noClimb: o.noClimb })) : solid0;
    const A = set ? (o) => o : add;
    world.defaultSurface = 'tile'; world.zMin = -4.3; world.zMax = 1.7;
    lightsBase(scene, '#2c4a50', '#140c08', .9);
    const tiles = mat('#ffffff', { map: TEX.checker('#bfb39a', '#121212', [9, 3]), rough: .5 });
    const teal = mat('#ffffff', { map: TEX.plaster('#1b4a44', [6, 2]), rough: .9 });
    const cream = mat('#ffffff', { map: TEX.plaster('#a8977a', [5, 1]), rough: .8 });
    const formica = mat('#ffffff', { map: TEX.plaster('#2f6b62', [6, 1]), rough: .35 });
    const red = mat('#ffffff', { map: TEX.fabric('#6d0f12', [2, 2]), rough: .45 });
    const chrome = mat('#9aa1a3', { metal: 1, rough: .25 });
    solid([-17, -.6, -6], [19, 0, 10], tiles, { warp: 0 });
    solid([-17, 0, -5.4], [19, 9, -4.6], teal, { decor: true });
    solid([-17.6, 0, -6], [-16.6, 9, 4], teal);
    solid([18.2, 0, -6], [19.2, 9, -2.8], teal); solid([18.2, 4.5, -2.8], [19.2, 9, -.3], teal); solid([18.2, 0, -.3], [19.2, 9, 4], teal);
    // rainy window band
    A(slab([-13, 2.9, -4.62], [11, 5.6, -4.58], mat('#0a1420', { emissive: '#0d2236', emissiveIntensity: .8 }), { warp: .02, cast: false }));
    const rain = add(dust(500, new THREE.Box3(V(-13, 2.9, -4.75), V(11, 5.6, -4.7)), '#8fb3c9', .03)); rain.material.opacity = .4;
    world.updaters.push((dt, t) => { const p = rain.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * (3 + (i % 7)); if (y < 2.9) y = 5.6; p.setY(i, y); } p.needsUpdate = true; });
    // neon
    const neonCv = document.createElement('canvas'); neonCv.width = 512; neonCv.height = 128; const nc = neonCv.getContext('2d');
    nc.font = '700 92px Georgia, serif'; nc.textAlign = 'center'; nc.fillStyle = '#ff3d2e'; nc.shadowColor = '#ff2010'; nc.shadowBlur = 24; nc.fillText('DOUBLE R', 256, 98);
    const neonTex = new THREE.CanvasTexture(neonCv); neonTex.colorSpace = THREE.SRGBColorSpace;
    const neon = add(new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, color: '#ffffff' })));
    neon.position.set(-1, 4.25, -4.5); neon.material.color.multiplyScalar(2.2);
    const neonLight = new THREE.PointLight('#ff3020', 30, 12, 1.5); neonLight.position.set(-1, 4.2, -3.4); add(neonLight);
    world.updaters.push((dt, t) => { const f = Math.random() < .01 ? .2 : 1; neonLight.intensity = 30 * f; neon.material.opacity = f; });
    for (const x of [-12, -3, 6, 14]) { const f = new THREE.PointLight('#ffb27a', 9, 9, 1.6); f.position.set(x, 3.2, 0); add(f); }
    const fcD = add(fogCards(10, new THREE.Box3(V(-16, .2, -4), V(18, 1.2, 1)), '#9fb8b0', .1)); world.updaters.push((dt) => animateFog(fcD, dt));
    // counter at the back, stools in front
    solid([-6, 0, -4.5], [13, 1.95, -2.1], cream);
    solid([-6.2, 1.95, -4.55], [13.2, 2.15, -1.95], formica);
    const stools = [-3.6, -.6, 2.4, 5.4, 8.4];
    for (const x of stools) {
      A(cylinder(x, 0, -1.25, .09, .8, chrome, { seg: 10 }));
      A(cylinder(x, .8, -1.25, .6, .17, red, { seg: 28, warp: .02 }));
      world.solid([x - .52, 0, -1.8], [x + .52, .97, -.7]);
    }
    // booths (left)
    solid([-16.3, 0, -4.5], [-10.5, .9, -2.4], red); A(slab([-16.3, .9, -4.5], [-10.5, 2.4, -3.9], red, { warp: .05 }));
    solid([-12.6, 0, -2.4], [-11.6, 1.75, -1.2], mat('#2a1a10'), { decor: false });
    A(slab([-14.6, 1.75, -2.6], [-9.6, 1.92, -.9], formica, { warp: .02 }));
    // pendant lamps
    for (const x of [-1, 7]) {
      A(cylinder(x, 6, -3, .03, 6, chrome, { seg: 6, warp: 0 }));
      const shade = A(cylinder(x, 5.4, -3, 1.0, .6, mat('#d8cfb8', { emissive: '#ffcf8a', emissiveIntensity: .6, side: THREE.DoubleSide }), { r2: .25, warp: .02 }));
      const l = spot('#ffcf8a', 300, V(x, 5.3, -3), V(x, 0, -2.4), { angle: .7, penumbra: .7, distance: 14, mapSize: 512 }); add(l); add(l.target);
      add(beam(V(x, 5.3, -3), V(x, 0, -2), 2.6, '#ffcf8a', .08));
    }
    // jukebox
    const juke = (ctx.models.sets?.diner ? (o) => o : add)(slab([-9.2, 0, -4.3], [-7.4, 2.6, -3.1], mat('#4a2412', { rough: .4 }), { warp: .04 }));
    const jukeGlow = add(slab([-9, .8, -3.12], [-7.6, 2.2, -3.05], mat('#ffb050', { emissive: '#ff8a30', emissiveIntensity: .2 }), { warp: .02, cast: false }));
    const jukeLight = new THREE.PointLight('#ff9a40', 0, 8, 1.4); jukeLight.position.set(-8.3, 1.6, -2.3); add(jukeLight);
    world.solid([-9.2, 0, -4.3], [-7.4, 2.6, -3.1]);
    world.interact({ pos: V(-8.3, 1.5, -2.6), label: T('投一枚硬币', 'Drop a coin in'), radius: 1.6, use: (it) => {
      it.enabled = false; sound.click(); jukeGlow.material.emissiveIntensity = 2.2; jukeLight.intensity = 40; ctx.flags.music = true;
      sound.lounge(); ctx.say(T('唱片转起来。有人曾在这里，闭着眼睛，慢慢地跳舞。', 'The record starts to turn. Someone once danced here, slowly, eyes closed.'), 4200);
    } });
    // the cup and the dome
    const cupMesh = add(cylinder(0, -.45, 0, .5, .9, mat('#e6e0d2', { rough: .3 }), { r2: .56, warp: .01 }));
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(.5, 24), mat('#1a0b03', { rough: .1 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = .4; cupMesh.add(coffee);
    cupMesh.position.set(1.5, 2.15 + .45, -3.2); cupMesh.userData.offset = V(0, .45, 0);
    const cup = world.movable(cupMesh, [1.1, .9, 1.1]);
    const domeGroup = new THREE.Group(); domeGroup.position.set(10, 2.15, -3.2); add(domeGroup);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .08, 32), chrome); plate.position.y = .04; domeGroup.add(plate);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#d8e8ee', roughness: .05, transmission: .9, thickness: .1, transparent: true, opacity: .45 }));
    dome.position.y = .08; domeGroup.add(dome);
    const key = new THREE.Mesh(new THREE.TorusGeometry(.14, .04, 8, 20), mat('#d4a640', { metal: 1, rough: .3, emissive: '#6a4a00', emissiveIntensity: .6 }));
    const keyShaft = new THREE.Mesh(new THREE.BoxGeometry(.45, .06, .06), key.material); keyShaft.position.x = .3; key.add(keyShaft);
    key.position.set(0, .35, 0); domeGroup.add(key);
    const domeCol = world.solid([9, 2.15, -4.2], [11, 3.2, -2.2], { noClimb: true });
    let domeDown = false;
    cup.onMove = (m) => {
      if (domeDown || m.max[0] < 8.85) return;
      domeDown = true; m.locked = true; ctx.dropGrab(); ctx.flags.domeDown = true;
      (async () => {
        sound.noise({ dur: .4, freq: 900, gain: .2 });
        const t0 = performance.now(); await new Promise((res) => { const s = () => { const k = Math.min(1, (performance.now() - t0) / 700); domeGroup.rotation.z = -k * 1.4; domeGroup.position.x = 10 + k * 1.2; domeGroup.position.y = 2.15 - k * k * 2.2; domeGroup.position.z = -3.2 + k * 1.6; if (k < 1) requestAnimationFrame(s); else res(); }; s(); });
        sound.glass(); domeGroup.visible = false; world.remove(domeCol);
        scene.add(key); key.position.set(10.6, .1, -.6); key.rotation.x = Math.PI / 2; const kl = new THREE.PointLight('#ffcc66', 3, 2.5); kl.position.set(10.6, .5, -.4); scene.add(kl);
        keyItem.enabled = true; ctx.save(); ctx.say(T('玻璃罩摔碎了。有什么东西在地上发亮。', 'The glass dome shatters. Something glints on the floor.'), 3200);
      })();
    };
    const keyItem = world.interact({ pos: V(10.6, .3, -.6), label: T('捡起钥匙', 'Pick up the key'), radius: 1.3, enabled: false, use: (it) => { it.enabled = false; key.visible = false; ctx.flags.key = true; ctx.flags.domeDown = true; doorItem.label = T('用钥匙打开后门', 'Unlock the back door'); ctx.save(); sound.pickup(); ctx.say(T('拿到后门钥匙「315」。往右走，到尽头靠里侧的后门。', 'Back-door key “315” acquired. Head right to the door in the back lane.'), 5500); ctx.hint(T('后门在最右侧 · W / ↑ 向里走，E / 互动开门', 'Back door: far right · W / ↑ toward the back, E / Use to unlock'), 9000); } });
    // back door
    const door = add(slab([18.05, 0, -2.8], [18.3, 4.5, -.3], mat('#ffffff', { map: TEX.planks('#3f3a30', [1, 2]) }), { warp: .02 }));
    const doorCol = world.solid([17.9, 0, -2.8], [18.3, 4.5, -.3], { noClimb: true });
    const outside = new THREE.PointLight('#6f8cff', 0, 10, 1.5); outside.position.set(20, 2, -1.5); add(outside);
    const doorItem = world.interact({ pos: V(17.6, 1.4, -1.5), label: T('查看后门', 'Check the back door'), radius: 1.6, use: async (it) => {
      if (!ctx.flags.key) { sound.noise({ dur: .2, freq: 700, gain: .2 }); ctx.say(T('锁着。', 'Locked.'), 1500); return; }
      it.enabled = false; sound.click(); sound.creak(.8); outside.intensity = 60;
      const t0 = performance.now(); await new Promise((res) => { const s = () => { const k = Math.min(1, (performance.now() - t0) / 1600); door.position.z = -1.55 - k * 2.4; if (k < 1) requestAnimationFrame(s); else res(); }; s(); });
      world.remove(doorCol); ctx.flags.doorOpen = true; ctx.save(); ctx.say(T('门外是树林。雨停了。', 'Outside are the woods. The rain has stopped.'), 2800);
    } });
    ctx.onRestore = (f) => {
      if (f.music) { jukeGlow.material.emissiveIntensity = 2.2; jukeLight.intensity = 40; sound.lounge(); }
      // Puzzle flags are authoritative: old/interrupted saves may contain stale
      // disabled interaction bits, or a key without the earlier dome flag.
      if (f.doorOpen) f.key = true;
      if (f.key) f.domeDown = true;
      keyItem.enabled = !!f.domeDown && !f.key;
      key.visible = !f.key;
      doorItem.enabled = !f.doorOpen;
      doorItem.label = f.key ? T('用钥匙打开后门', 'Unlock the back door') : T('查看后门', 'Check the back door');
      if (f.domeDown) { domeDown = true; cup.locked = true; domeGroup.visible = false; world.remove(domeCol); if (!f.key) { scene.add(key); key.position.set(10.6, .1, -.6); key.rotation.x = Math.PI / 2; } }
      if (f.doorOpen) { door.position.z = -3.95; world.remove(doorCol); outside.intensity = 60; }
    };
    const { npc } = kit(ctx);
    npc('norma', { name: T('诺玛', 'Norma'), pos: V(15.2, 0, -1.2), rot: -.4, talk: async () => {
      await ctx.line(T('诺玛', 'Norma'), T('咖啡还热着。樱桃派是今天最后一块。', 'The coffee’s still hot. That’s the last slice of cherry pie today.'), { focus: V(15.2, 1.2, -1.2) });
      await ctx.line(T('诺玛', 'Norma'), ctx.flags.key ? T('你已经有钥匙了。沿柜台往右走，最右侧靠里的后门就能打开。', 'You have the key. Follow the counter right; the back door is at the far end, toward the rear.') : T('后门锁着，钥匙一直放在派罩里——别问我为什么。', 'The back door’s locked. The key lives under the pie dome — don’t ask me why.'));
    } });
    npc('shelly', { name: T('雪莉', 'Shelly'), pos: V(-6.4, 0, -.9), rot: .5, talk: async () => {
      await ctx.line(T('雪莉', 'Shelly'), T('你也是来问劳拉的吗？', 'Are you here to ask about Laura too?'), { focus: V(-6.4, 1.2, -.9) });
      const c = await ctx.choice('', [T('“我只想听你说。”', '“I just want to hear you.”'), T('“我只想要一杯咖啡。”', '“I just want a cup of coffee.”')], T('雪莉', 'Shelly'));
      await ctx.line(T('雪莉', 'Shelly'), c === 0 ? T('……她最后一次来这里，坐在那个卡座，一直在看窗外的路。', '…The last time she came in, she sat in that booth and watched the road the whole time.') : T('咖啡在柜台。小心别踩到地上的玻璃。', 'Coffee’s on the counter. Mind the glass on the floor.'));
    } });
    const audrey = npc('audrey', { name: T('奥黛丽', 'Audrey'), pos: V(-10.6, 0, -1.4), rot: .3, talk: async (p) => {
      await ctx.line(T('奥黛丽', 'Audrey'), T('探员。你知道吗，有些音乐会让人想起一些事。', 'Agent. Do you know some music makes you remember things?'), { focus: V(-10.6, 1.2, -1.4) });
      const c = await ctx.choice(T('她把手指放在唇边，像要说一个秘密。', 'She puts a finger to her lips, as if about to tell a secret.'), [T('“告诉我。我会替你保守。”', '“Tell me. I’ll keep it.”'), T('“我在办案，奥黛丽。”', '“I’m working, Audrey.”')], T('奥黛丽', 'Audrey'));
      if (c === 0) { await ctx.line(T('奥黛丽', 'Audrey'), T('大北方旅馆里藏着我父亲不想让人知道的东西。我会帮你——只帮你。', 'The Great Northern hides things my father doesn’t want anyone to know. I’ll help you — only you.')); ctx.clue('audrey'); ctx.pick('audrey', 'trust'); }
      else { await ctx.line(T('奥黛丽', 'Audrey'), T('……那你就慢慢办吧。', '…Then take your time.')); ctx.pick('audrey', 'cold'); }
    } });
    npc('pete', { name: T('皮特', 'Pete'), pos: V(.9, 0, .9), rot: .2, talk: async () => {
      await ctx.line(T('皮特', 'Pete'), T('是我发现她的。在湖边，裹在塑料布里。', 'I’m the one who found her. By the lake, wrapped in plastic.'), { focus: V(.9, 1.2, .9) });
      await ctx.line(T('皮特', 'Pete'), T('我那天本来只是去钓鱼。……要来块派吗？', 'I was only going fishing that day. …Want some pie?'));
    } });
    npc('nadine', { name: T('娜丁', 'Nadine'), pos: V(-14.2, 0, -1.0), rot: .4, talk: async () => {
      await ctx.line(T('娜丁', 'Nadine'), T('静音窗帘滑轨！总有一天，全世界的窗帘都会安静下来。', 'Silent drape runners! Someday every curtain in the world will be quiet.'), { focus: V(-14.2, 1.2, -1) });
    } });
    world.updaters.push((dt, t) => { if (audrey && ctx.flags.music) audrey.group.rotation.y = .3 + Math.sin(t * 1.4) * .5; });
    world.trigger([18.3, 0, -2.8], [20, 3, -.3], () => ctx.next());
    world.trigger([-7, 0, -4.3], [-4, 3, 1.7], () => ctx.hint(T('踩上凳子，就能爬上柜台。W / S 前后移动', 'Step on a stool to climb onto the counter. W / S moves in depth'), 5000));
    world.trigger([4, 2, -4.3], [8, 4, -2], () => ctx.hint(T('抓住杯子（按住 E），往右推', 'Grab the cup (hold E) and push it right'), 4000));
    const d = add(dust(160, new THREE.Box3(V(-4, 0, -4), V(10, 5.4, 0)))); world.updaters.push((dt, t) => animateDust(d, t));
    ctx.intro = async () => { ctx.say(T('餐馆已经打烊。咖啡还是热的。', 'The diner is closed. The coffee is still hot.'), 3200); };
  },
};

// =====================================================================================
// 3 · GHOSTWOOD → GLASTONBURY GROVE
// =====================================================================================
export const forest = {
  id: 'forest', set: 'forest', cast: ['bob', 'mike'], name: { zh: '幽林 · 格拉斯顿伯里林地', en: 'Ghostwood · Glastonbury Grove' }, ambience: 'forest', bounds: [-24, 44], spawn: V(-22, 0, .8),
  fog: ['#0f1722', .05], exposure: 1.15, checkpoints: [V(-22, 0, .8), V(21.5, 0, .5)],
  build(ctx) {
    const { scene, world, sound, player } = ctx; const { add: add0, solid: solid0, puppet, useSet } = kit(ctx);
    const set = ctx.models.sets?.forest;
    if (set) add0(useSet(set, { moss: () => TEX.moss([1.4, 1.4]), bark: () => TEX.bark('#5a4636', [1, 1]) }));
    const add = set ? (o) => o : add0;   // in Blender-set mode the code-built scenery is skipped
    const solid = set ? (mn, mx, m, o = {}) => (o.decor ? null : world.solid(mn, mx, { noClimb: o.noClimb })) : solid0;
    world.defaultSurface = 'moss'; world.zMin = -1.8; world.zMax = 1.8; world.killY = -2.5;
    lightsBase(scene, '#22314c', '#070907', .55);
    const moss = mat('#ffffff', { map: TEX.moss([10, 2]), rough: .95 });
    const bark = mat('#ffffff', { map: TEX.bark('#4d3f31', [1, 4]), rough: .95 });
    const pale = mat('#ffffff', { map: TEX.bark('#a39a86', [1, 4]), rough: .9 });
    const needles = mat('#0b1a12', { rough: .95 });
    // ground with a ditch
    const DX0 = 15.5, DX1 = 19.4;
    solid([-26, -1.2, -9], [DX0, 0, 10], moss, { warp: 0 }); solid([DX1, -1.2, -9], [46, 0, 10], moss, { warp: 0 });
    add(slab([DX0, -8, -9], [DX1, -7.6, 10], mat('#020303'), { warp: 0 }));
    add(slab([DX0 - .02, -7.6, -9], [DX0, 0, 10], mat('#0c120c'), { warp: 0 }));
    add(slab([DX1, -7.6, -9], [DX1 + .02, 0, 10], mat('#0c120c'), { warp: 0 }));
    world.surfaces.push({ x0: DX0, x1: DX1, kind: 'wood', y0: -.5 });
    // fir trunks: background (decor) and lane trunks that block and hide
    const trunk = (x, z, r, solidLane = false) => {
      add(cylinder(x, -.2, z, r, 22, bark, { r2: r * .7, seg: 18, warp: .12 }));
      for (let k = 0; k < 4; k++) { const y = 9 + k * 2.6; const c = new THREE.Mesh(new THREE.ConeGeometry(r * 3.4 - k * .4, 4.2, 10), needles); c.position.set(x, y, z); c.castShadow = true; add(c); }
      if (solidLane) world.solid([x - r * .8, 0, z - r * .8], [x + r * .8, 20, z + r * .8], { noClimb: true, trunk: { x, z, r } });
    };
    const laneTrunks = [[-15, -.9, .8], [-7, -.6, .9], [1, -.9, .85], [6.2, -.7, .8]];
    for (const [x, z, r] of laneTrunks) trunk(x, z, r, true);
    for (let x = -26; x < 46; x += 3.2) trunk(x + Math.sin(x) * 1.2, -5.5 - Math.abs(Math.cos(x * .7)) * 2.5, .9 + Math.abs(Math.sin(x * 1.3)) * .5);
    // ferns
    const fern = mat('#0c1a10', { rough: .95, side: THREE.DoubleSide });
    for (let i = 0; i < 46; i++) {
      const x = -24 + i * 1.5 + Math.sin(i * 7) * .6, z = -3 + Math.sin(i * 3.1) * .9; if (x > DX0 - .5 && x < DX1 + .5) continue;
      for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(.35, 1.0, 1, 3), fern); f.geometry.translate(0, .5, 0); f.position.set(x, 0, z); f.rotation.set(-.7 + Math.sin(k) * .2, k * 1.05, 0); add(f); }
    }
    // moonlight
    const moon = new THREE.DirectionalLight('#8aa0d8', 2.6); moon.position.set(-8, 30, 10); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, { left: -40, right: 40, top: 30, bottom: -10 }); moon.target.position.set(10, 0, 0); add0(moon); add0(moon.target);
    const fcF = add0(fogCards(26, new THREE.Box3(V(-26, .1, -7), V(46, 1.6, 1.5)), '#8796b0', .16)); world.updaters.push((dt) => animateFog(fcF, dt));
    const beams = [[-19, .4], [-10, .45], [-2, .35], [4, .4], [12, .35], [24, .4], [34, .5]];
    for (const [x, s] of beams) { add0(beam(V(x - 3, 20, -2), V(x, 0, .3), 2.2, '#9db4ff', s * .6)); const sp = spot('#9db4ff', 90, V(x - 3, 20, -2), V(x, 0, .3), { angle: .12, penumbra: .6, distance: 40, shadow: false }); add0(sp); add0(sp.target); }
    const d = add0(dust(300, new THREE.Box3(V(-24, 0, -4), V(44, 8, 2)), '#c8d4ff', .03)); world.updaters.push((dt, t) => animateDust(d, t));
    // owl
    const owlEyes = new THREE.Group(); for (const dx of [-.12, .12]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffd050' })); e.position.x = dx; owlEyes.add(e); }
    owlEyes.position.set(20, 7.5, -2.5); add0(owlEyes);
    world.updaters.push((dt, t) => { owlEyes.visible = Math.sin(t * .7) > -.85; });
    // pushable log next to the ditch
    const logMesh = add0(cylinder(0, -2.15, 0, .32, 4.3, mat('#ffffff', { map: TEX.bark('#3a2c20') }), { seg: 14, warp: .02 }));
    logMesh.rotation.z = Math.PI / 2; const logG = new THREE.Group(); logG.add(logMesh); logMesh.position.set(0, .3, 0); logMesh.rotation.z = Math.PI / 2;
    add0(logG); logG.position.set(11.6, .0, .2); logG.userData.offset = V(0, 0, 0);
    const log = world.movable(logG, [4.3, .6, 1.2]);
    log.onMove = (m) => {
      if (m.locked || m.max[0] < DX1 + .1) return;
      // the log drops across the ditch and becomes a bridge
      m.locked = true; ctx.dropGrab(); logG.position.x = (DX0 + DX1) / 2; logG.position.y = -.15; m.sync(); sound.thud(.9); ctx.shake(.15); ctx.flags.bridge = true; ctx.save();
      ctx.say(T('木头横在沟上了。', 'The log lies across the ditch.'), 2200);
    };
    world.trigger([12, 0, -2], [14, 2, 2], () => ctx.hint(T('沟太宽了。也许能把木头推过去。', 'The ditch is too wide. Maybe the log can be pushed across.'), 4000));
    // oil pool + grove
    const ring = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const x = 34 + Math.cos(a) * 6, z = -1.4 + Math.sin(a) * 3; if (z > 1) continue; ring.push(add(cylinder(x, -.2, z, .45, 14, pale, { r2: .3, warp: .1 }))); }
    const oil = add0(new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshPhysicalMaterial({ color: '#010101', roughness: .02, clearcoat: 1, metalness: .2 })));
    oil.rotation.x = -Math.PI / 2; oil.position.set(34, .02, -1.2); oil.scale.set(1, .6, 1);
    const groveLight = spot('#dfe6ff', 500, V(34, 16, 2), V(34, 0, -1.2), { angle: .3, penumbra: .5, distance: 30 }); add0(groveLight); add0(groveLight.target);
    const curtainMat = mat('#5a0306', { sheen: '#ff4030', rough: .85 });
    const groveCurtains = new THREE.Group(); add0(groveCurtains);
    groveCurtains.add(curtain(30.5, 37.5, -3.6, 7, curtainMat, { seed: 3, depth: .45 }));
    groveCurtains.position.y = -8; groveCurtains.visible = false;
    const redGlow = new THREE.PointLight('#ff2a1a', 0, 14, 1.5); redGlow.position.set(34, 2.5, -1); add0(redGlow);
    // BOB
    const bob = puppet(ctx.models.bob, 2.6, 'walk'); add0(bob.group); bob.group.position.set(-6, 0, -3.1);
    const lantern = new THREE.PointLight('#ffa050', 40, 10, 1.4); lantern.position.set(.6, 1.6, .3); lantern.castShadow = true; lantern.shadow.mapSize.set(512, 512); bob.group.add(lantern);
    const lanternMesh = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffc070' })); lanternMesh.position.copy(lantern.position); bob.group.add(lanternMesh);
    const B = { state: 'off', x: -6, z: -3.1, dir: 1, a: -11, b: 7, spot: 0, lost: 0, speed: 1.3 };
    bob.group.visible = false;
    const seen = () => {
      const px = player.pos.x, pz = player.pos.z, dx = px - B.x, dz = pz - B.z, dist = Math.hypot(dx, dz);
      const torch = player.torchOn ? 1 : 0; const inBeam = beams.some(([x]) => Math.abs(px - x) < 1.3);
      const range = 7 + torch * 6 + (inBeam ? 3 : 0);
      if (dist > range) return false;
      if (B.state === 'patrol' && Math.sign(dx) !== B.dir && dist > 2.2 && !torch) return false;
      // tucked in front of a trunk (between it and the camera) = hidden, unless the torch gives you away
      if (!torch && dist > 1.6) for (const [x, z, r] of laneTrunks) if (Math.abs(px - x) < r + .25 && pz > z && B.z < z) return false;
      for (const [x, z, r] of laneTrunks) { // trunk between us?
        const t = Math.max(0, Math.min(1, ((x - B.x) * dx + (z - B.z) * dz) / (dist * dist))); const cx = B.x + dx * t, cz = B.z + dz * t;
        if (Math.hypot(cx - x, cz - z) < r * .95 && t > .05 && t < .95) return false;
      }
      return true;
    };
    let hb = 0;
    world.updaters.push((dt, t) => {
      if (B.state === 'off') return;
      const vis = seen();
      if (B.state === 'patrol') {
        B.x += B.dir * B.speed * dt; if (B.x > B.b) B.dir = -1; if (B.x < B.a) B.dir = 1; B.z += (-3.1 - B.z) * dt;
        B.spot = vis ? B.spot + dt * (player.torchOn ? 2.2 : 1.4) : Math.max(0, B.spot - dt * .8);
        if (B.spot > 1) { B.state = 'chase'; sound.growl(); ctx.say('……', 800); }
        bob.play('walk');
      } else if (B.state === 'chase' || B.state === 'hunt') {
        const dx = player.pos.x - B.x, dz = player.pos.z - B.z, dist = Math.hypot(dx, dz);
        const sp = B.state === 'hunt' ? 4.0 : 3.7;
        B.x += dx / dist * sp * dt; B.z += dz / dist * sp * dt * .8; B.dir = Math.sign(dx);
        // trunks block BOB too
        for (const [x, z, r] of laneTrunks) { const ddx = B.x - x, ddz = B.z - z, dd = Math.hypot(ddx, ddz); if (dd < r + .4) { B.x = x + ddx / dd * (r + .4); B.z = z + ddz / dd * (r + .4); } }
        bob.play('run');
        if (B.state === 'chase') { B.lost = vis ? 0 : B.lost + dt; if (B.lost > 2.6) { B.state = 'return'; B.spot = 0; ctx.say(T('它停下来，在黑暗里嗅了嗅。', 'It stops, and sniffs the dark.'), 2000); } }
        if (dist < .9 && player.mode !== 'caught') { B.state = 'gotcha'; bob.play('caught'); ctx.caught('bob'); }
      } else if (B.state === 'return') {
        const tx = Math.max(B.a, Math.min(B.b, B.x)); const dx = tx - B.x, dz = -3.1 - B.z; const d = Math.hypot(dx, dz);
        if (d < .2) B.state = 'patrol'; else { B.x += dx / d * 1.5 * dt; B.z += dz / d * 1.5 * dt; B.dir = Math.sign(dx) || B.dir; }
        if (vis) { B.spot += dt * 1.5; if (B.spot > 1) B.state = 'chase'; }
        bob.play('walk');
      }
      bob.group.position.set(B.x, 0, B.z);
      const yaw = B.state === 'chase' || B.state === 'hunt' ? Math.atan2(player.pos.x - B.x, player.pos.z - B.z) : B.dir * Math.PI / 2;
      bob.group.rotation.y += (yaw - bob.group.rotation.y) * Math.min(1, dt * 6);
      lantern.intensity = 40 + Math.sin(t * 13) * 6;
      // dread: heartbeat and red edge when BOB is close or alerted
      const near = Math.max(0, 1 - Math.hypot(player.pos.x - B.x, player.pos.z - B.z) / 9);
      const alert = B.state === 'chase' || B.state === 'hunt' ? 1 : B.spot;
      ctx.setDread(Math.max(near * .6, alert));
      hb -= dt; if (alert > .2 && hb <= 0) { sound.heartbeat(1 + alert); hb = 1.1 - alert * .55; }
    });
    world.trigger([-17, 0, -2], [-15.5, 3, 2], async () => {
      ctx.hint(T('别让它看见你。躲在树干后面；手电会把它引过来。', 'Don’t let it see you. Hide behind the trunks; the flashlight draws it in.'), 6000);
      bob.group.visible = true; B.state = 'patrol'; B.x = -11; sound.growl(-.6);
    });
    world.trigger([DX1 + 1, 0, -2], [DX1 + 2, 3, 2], () => { ctx.checkpoint(1); ctx.save(); });
    kit(ctx).npc('mike', { name: T('独臂人', 'The One-Armed Man'), pos: V(23, 0, -1.4), rot: -.3, talk: async () => {
      await ctx.line(T('独臂人', 'The One-Armed Man'), T('「在下一个世界的黑暗里，火与我同行。」', '“Through the darkness of future past… fire walk with me.”'), { focus: V(23, 1.2, -1.4) });
      await ctx.line(T('独臂人', 'The One-Armed Man'), T('我曾经和他一起。我砍掉了那只手臂……可他还在。往前走，别停。', 'I was with him once. I took off the arm… but he is still here. Keep walking. Don’t stop.'));
    } });
    ctx.onRestore = () => { if (player.pos.x > -16.5) { bob.group.visible = true; B.state = 'patrol'; B.x = player.pos.x > DX1 ? 6 : -11; } if (player.pos.x > 27) player.pos.x = 26; };
    let groveOn = false;
    world.trigger([27, 0, -2], [28, 3, 2], async () => {
      if (groveOn) return; groveOn = true;
      ctx.say(T('十二棵梧桐围成一圈。中间是一池黑油。', 'Twelve sycamores stand in a ring. In the middle, a pool of black oil.'), 3200);
      await ctx.wait(2600);
      // BOB comes for you
      B.state = 'hunt'; B.x = Math.min(player.pos.x - 13, DX1 + 1); B.z = 0; bob.group.visible = true; sound.growl(-.8); sound.scream();
      ctx.say(T('跑！', 'Run!'), 1400);
      groveCurtains.visible = true; redGlow.intensity = 0;
      const t0 = performance.now(); const rise = () => { const k = Math.min(1, (performance.now() - t0) / 3000); groveCurtains.position.y = -8 + k * 8; redGlow.intensity = k * 80; if (k < 1) requestAnimationFrame(rise); }; rise();
    });
    world.trigger([32.5, 0, -2], [35.5, 2, -.3], () => { B.state = 'off'; bob.group.visible = false; ctx.setDread(0); ctx.next(); }, true);
    ctx.onRespawn = (cp) => { if (B.state !== 'off') { B.state = groveOn ? 'off' : 'patrol'; B.x = cp === 1 ? 6 : -11; B.z = -3.1; B.spot = 0; bob.group.visible = !groveOn; } if (groveOn) { groveOn = false; groveCurtains.position.y = -8; redGlow.intensity = 0; world.triggers.forEach((tr) => { if (tr.min[0] === 27) tr.done = false; }); } };
    ctx.intro = async () => { ctx.say(T('树林在夜里比白天更大。', 'The woods are bigger at night than in the day.'), 3000); };
  },
};

// =====================================================================================
// 4 · THE RED ROOM
// =====================================================================================
export const redroom = {
  id: 'redroom', set: 'redroom', cast: ['laura', 'man_from_another_place', 'bob', 'windom'], name: { zh: '红房间', en: 'The Red Room' }, ambience: 'redroom', bounds: [-1e9, 1e9], spawn: V(-12.5, 0, .6),
  fog: ['#1a0505', .03], exposure: 1.3, loop: 30,
  build(ctx) {
    const { scene, world, sound, player } = ctx; const { add, puppet, useSet } = kit(ctx);
    world.defaultSurface = 'velvet'; world.zMin = -1.6; world.zMax = 1.7;
    lightsBase(scene, '#5a1a18', '#100404', .9);
    const vel = mat('#4a0204', { sheen: '#ff3a28', rough: .9, side: THREE.DoubleSide });
    const floorMat = mat('#ffffff', { map: TEX.chevron([12, 2]), rough: .35 });
    const room = new THREE.Group();
    const W = 30;
    const alcoves = [-10, 0, 10];
    const set = ctx.models.sets?.redroom;
    let planet;
    if (set) {
      room.add(useSet(set, { chevron: () => TEX.chevron([2.2, 2.2]) }));
      room.traverse((o) => { if (o.name.includes('planet')) planet = o; });
    } else {
      const r1 = slab([-15, -.6, -7], [15, 0, 10], floorMat, { warp: 0 }); room.add(r1);
      // back curtain with three alcoves at x = -10, 0, 10
      let x = -15; for (const a of alcoves) { room.add(curtain(x, a - 1.1, -3.9, 9.5, vel, { seed: Math.abs(a) + 2, depth: .55 })); x = a + 1.1; }
      room.add(curtain(x, 15, -3.9, 9.5, vel, { seed: 21, depth: .55 }));
      for (const a of alcoves) {
        const back = curtain(a - 1.6, a + 1.6, -6.6, 9.5, vel, { seed: a + 40, depth: .4 }); room.add(back);
        const sideL = slab([a - 1.2, 0, -6.6], [a - 1.1, 9.5, -3.9], vel, { warp: .05 }); room.add(sideL);
        const sideR = slab([a + 1.1, 0, -6.6], [a + 1.2, 9.5, -3.9], vel, { warp: .05 }); room.add(sideR);
      }
      // chair, saturn lamp, torchiere
      const leather = mat('#0d0f10', { rough: .35 });
      room.add(slab([-4.2, 0, -3.6], [-1.4, 1.1, -1.6], leather, { warp: .08 }));
      room.add(slab([-4.2, 1.1, -3.6], [-1.4, 3.0, -3.0], leather, { warp: .1 }));
      for (const s of [-4.2, -1.9]) room.add(slab([s, 1.1, -3.6], [s + .5, 2.0, -1.6], leather, { warp: .1 }));
      room.add(slab([-7.4, 0, -3.4], [-5.8, 1.8, -2.0], mat('#121314', { rough: .3 }), { warp: .04 }));
      const mint = mat('#6a9a52', { rough: .5 });
      room.add(cylinder(-6.6, 1.8, -2.7, .3, .8, mint, { r2: .14 }));
      planet = new THREE.Mesh(new THREE.SphereGeometry(.42, 24, 16), mint); planet.position.set(-6.6, 3.0, -2.7); room.add(planet);
      const ringM = new THREE.Mesh(new THREE.TorusGeometry(.72, .09, 8, 48), mat('#d8cfb4')); ringM.scale.set(1, 1, .3); ringM.rotation.set(1.2, .3, 0); ringM.position.copy(planet.position); room.add(ringM);
      const steel = mat('#8a8c8e', { metal: .8, rough: .4 });
      room.add(cylinder(6, 0, -3.1, .06, 6.2, steel, { seg: 10, warp: .02 }));
      const tor = new THREE.Mesh(new THREE.ConeGeometry(.9, 1.1, 24, 1, true), mat('#9a9c9e', { metal: .7, rough: .4, side: THREE.DoubleSide })); tor.rotation.x = Math.PI; tor.position.set(6, 6.6, -3.1); room.add(tor);
    }
    room.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = true; } });
    add(room);
    for (const off of [-W, W]) { const c = room.clone(); c.position.x = off; add(c); } // seamless loop copies
    world.solid([-200, -.6, -7], [200, 0, 10]);
    world.solid([5.2, 0, -3.7], [7.6, 1.1, -1.7]); world.solid([8.0, 0, -3.9], [9.2, 4.2, -2.7], { noClimb: true });
    world.solid([-4.2, 0, -3.6], [-1.4, 1.1, -1.6]); world.solid([-7.4, 0, -3.4], [-5.8, 1.8, -2.0]);
    // light: one hard cold key over the chair, torchiere glow, red wash
    const key = spot('#dfe8ff', 200, V(-2, 13, 3), V(-2.5, 0, -2), { angle: .34, penumbra: .45, distance: 30 }); add(key); add(key.target);
    const keyBeam = add(beam(V(-2, 11, 1.5), V(-2.5, 0, -2), 3.4, '#dfe8ff', .14));
    for (const tx of [-12.4, 1.0, 13.2]) { const tl = new THREE.PointLight('#ffb070', 40, 12, 1.4); tl.position.set(tx, 5.3, -3.1); add(tl); }
    const sat = new THREE.PointLight('#5dff8a', 12, 6, 1.6); sat.position.set(-6.6, 2.7, -2.4); add(sat);
    const wash = new THREE.PointLight('#ff1e10', 30, 34, 1.2); wash.position.set(0, 6, 2); add(wash);
    // Laura
    const laura = puppet(ctx.models.laura, 1.35, 'idle'); add(laura.group); laura.group.position.set(3, 0, -2.2); laura.group.rotation.y = -.3;
    world.solid([2.6, 0, -2.6], [3.4, 1.4, -1.8], { noClimb: true });
    // whisper source
    let correct = alcoves[Math.floor(Math.random() * 3)]; let talked = false, wt = 0, tries = 0, ending = false;
    const { npc } = kit(ctx);
    const man = npc('man_from_another_place', { name: T('来自另一个地方的人', 'The Man from Another Place'), pos: V(-1.2, 0, -.6), rot: .4, h: .95, talk: async () => {
      await ctx.line(T('来自另一个地方的人', 'The Man from Another Place'), T('「我来自另一个地方……这里的音乐，总是在空中。」', '“Where we’re from… the music is always in the air.”'), { focus: V(-1.2, .9, -.6), zoom: 3 });
      const n = Object.keys(ctx.story.clues).length;
      if (n >= 3 && talked) { const k = [T('左边', 'left'), T('中间', 'middle'), T('右边', 'right')][alcoves.indexOf(correct)]; await ctx.line(T('来自另一个地方的人', 'The Man from Another Place'), T(`他倒着说话，手指却清清楚楚地指向${k}那道帘幕。`, `He speaks backwards, but his finger points plainly at the ${k} curtain.`)); }
      else await ctx.line(T('来自另一个地方的人', 'The Man from Another Place'), n >= 3 ? T('「先去听她说。」', '“Listen to her first.”') : T('「你带来的碎片太少了，探员。」', '“You brought too few pieces, Agent.”'));
    } });
    if (man) world.updaters.push((dt, t) => { man.group.rotation.y = .4 + Math.sin(t * 2.2) * .6; man.group.position.y = Math.abs(Math.sin(t * 4.4)) * .06; });
    const alcoveGlow = alcoves.map((a) => { const l = new THREE.PointLight('#ff3020', 0, 8, 1.5); l.position.set(a, 2, -5.5); add(l); return l; });
    world.interact({ pos: V(3, 1.0, -1.6), label: T('走近劳拉', 'Approach Laura'), radius: 1.8, use: async (it) => {
      it.enabled = false; player.mode = 'locked'; player.lockAnim = 'idle'; ctx.focus(V(3, 1.1, -1.8), 1.2);
      laura.play('walk'); await ctx.wait(400); laura.play('idle');
      sound.whisper(0, 2.4); ctx.say(T('（她靠近你的耳边，说了一句倒过来的话。）', '(She leans to your ear and says something backwards.)'), 3000); await ctx.wait(3200);
      ctx.say(T('「……听。」', '“…Listen.”'), 2200, T('劳拉', 'Laura')); await ctx.wait(2400);
      ctx.focus(null); player.mode = 'normal'; talked = true; ctx.flags.talked = true; ctx.save(); ctx.hint(T('跟着低语声走进对的帘幕。', 'Follow the whisper into the right curtain.'), 5000);
    } });
    world.updaters.push((dt, t) => {
      // loop the corridor
      if (player.pos.x > W / 2) { player.pos.x -= W; ctx.camJump(-W); }
      if (player.pos.x < -W / 2) { player.pos.x += W; ctx.camJump(W); }
      if (!talked || ending) return;
      wt -= dt; if (wt <= 0) { wt = 3.4; const rel = ((correct - player.pos.x + W * 1.5) % W) - W / 2; sound.whisper(Math.max(-1, Math.min(1, rel / 9)), 2); }
      alcoveGlow.forEach((l, i) => { l.intensity = alcoves[i] === correct ? 6 + Math.sin(t * 3) * 4 : 0; });
      if (planet) planet.rotation.y += dt * .4;
    });
    ctx.onRestore = (f) => { if (f.talked) talked = true; };
    for (const a of alcoves) {
      world.trigger([a - 1, 0, -6.5], [a + 1, 3, -4.0], () => choose(a), false);
    }
    world.zMin = -1.6;
    // let the player step into alcoves: widen the lane only in front of them
    world.updaters.push(() => { const xx = ((player.pos.x + W * 1.5) % W) - W / 2; world.zMin = alcoves.some((a) => Math.abs(xx - a) < .9) && talked ? -6.2 : -1.6; });
    async function choose(a) {
      if (ending || !talked || player.mode !== 'normal') return;
      ending = true; player.mode = 'locked'; player.lockAnim = 'idle';
      if (a !== correct) {
        tries++; sound.switchOff(); ctx.blackout(true);
        // BOB grins out of the wrong alcove
        const who = tries === 2 && ctx.models.cast?.windom ? ctx.models.cast.windom : ctx.models.bob;
        const bob = puppet(who, 2.6, 'idle'); bob.group.position.set(a, 0, -5.4); add(bob.group);
        const red = new THREE.PointLight('#ff2010', 30, 6, 1.4); red.position.set(a, 3, -3.5); add(red);
        await ctx.wait(500); ctx.blackout(false, .02); sound.scream(); ctx.shake(.6);
        await ctx.wait(700); ctx.blackout(true); scene.remove(bob.group); scene.remove(red);
        await ctx.wait(900); player.pos.set(-12.5, 0, .6); ctx.camJump(0, true);
        correct = alcoves.filter((x) => x !== a)[Math.floor(Math.random() * 2)];
        if (tries >= 3) { ctx.ending({ chosenRight: false }); return; }
        ctx.blackout(false); ctx.say(tries > 1 ? T('「不是这里。闭上眼睛听。」', '“Not here. Close your eyes and listen.”') : T('「不是这里。」', '“Not here.”'), 2600, T('劳拉', 'Laura')); player.mode = 'normal'; ending = false;
        return;
      }
      // the right curtain
      ctx.focus(V(a, 1.4, -5), 2);
      sound.stopAmbience(2); await ctx.wait(1200);
      ctx.say(T('帘幕后面，是另一间一模一样的红房间。', 'Behind the curtain is another red room, exactly the same.'), 3000); await ctx.wait(3200);
      sound.switchOff(); ctx.blackout(true); await ctx.wait(1500);
      ctx.ending({ chosenRight: true });
    }
    const d = add(dust(220, new THREE.Box3(V(-15, 0, -4), V(15, 8, 2)), '#ffd2c0')); world.updaters.push((dt, t) => animateDust(d, t));
    ctx.intro = async () => { ctx.say(T('这里没有窗，也没有时间。', 'There are no windows here, and no time.'), 3000); };
  },
};

import { station, roadhouse, cabin, palmer } from './levels2.js';
import { shore, dream, cell } from './levels3.js';
export const LEVELS = { shore, diner, station, dream, cabin, palmer, hotel, roadhouse, cell, forest, redroom };
