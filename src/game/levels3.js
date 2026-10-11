// Three acts that complete the broadcast order: the lakeshore (S1E1), Cooper's dream (S1E3), the holding cell (S2E9).
// Dialogue is paraphrased / original; sets come from Blender when present (public/game/sets/<id>.glb), else code-built.
import * as THREE from 'three';
import { T } from './i18n.js';
import { TEX, mat, slab, cylinder, beam, dust, spot, animateDust, fogCards, animateFog } from './gfx.js';
import { kit } from './levels.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// =====================================================================================
// 0 · THE LAKESHORE — "wrapped in plastic" (tutorial)
// =====================================================================================
export const shore = {
  id: 'shore', set: 'shore', cast: ['pete', 'truman'], name: { zh: '湖岸 · 裹在塑料布里', en: 'The Lakeshore · Wrapped in Plastic' }, ambience: 'shore',
  bounds: [-17, 23], spawn: V(-15, 0, .8), fog: ['#18202a', .028], exposure: 1.35,
  build(ctx) {
    const { scene, world, sound, player } = ctx; const { add: add0, solid: solid0, useSet, npc } = kit(ctx);
    world.defaultSurface = 'wood'; world.zMin = -2.6; world.zMax = 1.7;
    scene.add(new THREE.HemisphereLight('#5a6c84', '#0c0b0a', 1.1));
    const set = ctx.models.sets?.shore;
    if (set) add0(useSet(set, { moss: () => TEX.moss([1.4, 1.4]), bark: () => TEX.bark('#4e4034', [1, 1]), planks: () => TEX.planks('#5a4a3a', [1.2, 1.2]) }));
    const add = set ? (o) => o : add0;
    const solid = set ? (mn, mx, m, o = {}) => world.solid(mn, mx, { noClimb: o.noClimb }) : solid0;
    const pebbles = mat('#ffffff', { map: TEX.plaster('#4c4a44', [10, 3]), rough: .95 });
    const rock = mat('#ffffff', { map: TEX.plaster('#3a3a38', [2, 1]), rough: .9 });
    const wood = mat('#ffffff', { map: TEX.planks('#5a4a3a', [3, 1]), rough: .8 });
    solid([-18, -.6, -7], [25, 0, 10], pebbles, { warp: 0 });
    // the lake: a black mirror at the back, mist lying on it
    add(slab([-40, -.05, -40], [60, .0, -3.2], mat('#0a1218', { rough: .08, metal: .2 }), { warp: 0, cast: false }));
    // far shore: pines as silhouettes
    const pine = mat('#0c1210', { rough: 1 });
    for (let i = 0; i < 26; i++) { const x = -30 + i * 3.4 + Math.sin(i * 7.1) * 1.2, h = 7 + (i * 37 % 5); add(cylinder(x, 0, -26 - (i % 3) * 3, 1.3 + (i % 2) * .4, h, pine, { r2: .02, seg: 7, warp: .05 })); }
    // the near shore: rocks (jump), a driftwood crate (push), an embankment up to the road (climb)
    solid([-6.2, 0, -2.6], [-4.6, .8, 1.7], rock, { warp: .15 });
    solid([-17, 0, -7], [-16.2, 9, 4], rock, { decor: false });
    solid([12, 0, -2.6], [23, 3.3, 1.7], rock, { warp: .08 });                     // embankment (one collider so the ledge is climbable)
    if (!set) add(slab([12, 3.3, -2.6], [23, 3.32, 1.7], wood, { warp: .02 }));     // road planks
    solid([23, 0, -7], [24, 9, 4], rock);
    const crateMesh = add0(slab([-.8, 0, -.7], [.8, 1.5, .7], mat('#ffffff', { map: TEX.planks('#9a8064', [1, 1]), rough: .85 }), { warp: .03 }));
    crateMesh.position.set(6.5, .75, -.4); crateMesh.userData.offset = V(0, .75, 0);
    const crate = world.movable(crateMesh, [1.6, 1.5, 1.4]);
    // grey dawn: a low cold key from the lake side, fog, drizzle
    const dawn = spot('#c8d4e8', 420, V(-4, 12, -14), V(2, 0, 0), { angle: .55, penumbra: .8, distance: 40 }); add0(dawn); add0(dawn.target);
    const fill = new THREE.PointLight('#8ea0b8', 14, 22, 1.2); fill.position.set(2, 6, 4); add0(fill);
    for (const x of [-12, 16]) { const f2 = new THREE.PointLight('#8ea0b8', 10, 18, 1.2); f2.position.set(x, 5, 3); add0(f2); }
    // pale dawn sky laid on the water: a soft streak where the lake catches the light
    const sheen = add0(new THREE.Mesh(new THREE.PlaneGeometry(90, 7), new THREE.MeshBasicMaterial({ color: '#28323e', fog: false })));
    sheen.rotation.x = -Math.PI / 2; sheen.position.set(4, .02, -12);
    const sky = add0(new THREE.Mesh(new THREE.PlaneGeometry(160, 30), new THREE.MeshBasicMaterial({ color: '#2a3442', fog: false })));
    sky.position.set(4, 14, -70);
    const fc = add0(fogCards(12, new THREE.Box3(V(-16, .1, -6), V(22, 1.4, 1)), '#a8b4c0', .12)); world.updaters.push((dt) => animateFog(fc, dt));
    const rain = add0(dust(420, new THREE.Box3(V(-16, 0, -4), V(22, 9, 2)), '#9fb2c4', .025)); rain.material.opacity = .35;
    world.updaters.push((dt) => { const p = rain.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * (5 + (i % 5)); if (y < 0) y = 9; p.setY(i, y); } p.needsUpdate = true; });

    // Laura, as Pete found her: a pale shape in clouded plastic, half in the pebbles
    const body = new THREE.Group(); body.position.set(2.6, 0, -1.9); body.rotation.y = .12; add0(body);
    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .82, 8, 16), mat('#b8b0a8', { rough: .9 })); inner.rotation.z = Math.PI / 2; inner.position.y = .15; inner.scale.set(1, 1, .7); body.add(inner);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 12), mat('#c9a35a', { rough: .8 })); hair.position.set(-.56, .16, 0); hair.scale.set(1, .7, 1); body.add(hair);
    const wrap = new THREE.Mesh(new THREE.CapsuleGeometry(.22, 1.04, 10, 20), new THREE.MeshPhysicalMaterial({ color: '#dfe8ee', roughness: .25, transmission: .6, transparent: true, opacity: .55, thickness: .05, side: THREE.DoubleSide }));
    wrap.rotation.z = Math.PI / 2; wrap.position.y = .17; wrap.scale.set(1, 1, .8); body.add(wrap);
    body.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    world.solid([1.8, 0, -2.2], [3.4, .35, -1.6], { noClimb: true });
    const bodyLight = spot('#e8f0ff', 0, V(2.6, 9, 1), V(2.6, 0, -1.9), { angle: .25, penumbra: .5, distance: 16 }); add0(bodyLight); add0(bodyLight.target);
    const bodyBeam = add0(beam(V(2.6, 8, 0), V(2.6, 0, -1.9), 1.8, '#dfe8ff', 0));

    npc('pete', { name: T('皮特', 'Pete'), pos: V(-9.5, 0, -1.4), rot: .4, talk: async () => {
      await ctx.line(T('皮特', 'Pete'), T('我只是出来钓鱼……然后看见了她。就在那块石头后面。', 'I was only going fishing… and then I saw her. Just past that rock.'), { focus: V(-9.5, 1.2, -1.4) });
      await ctx.line(T('皮特', 'Pete'), T('她死了。裹在塑料布里。', 'She’s dead. Wrapped in plastic.'));
    } });
    npc('truman', { name: T('杜鲁门警长', 'Sheriff Truman'), pos: V(9.6, 0, -1.6), rot: -.3, talk: async () => {
      if (!ctx.story.clues.plastic) { await ctx.line(T('杜鲁门警长', 'Sheriff Truman'), T('你就是 FBI 派来的？先去看看她吧。', 'You’re the one the FBI sent? Go and see her first.'), { focus: V(9.6, 1.2, -1.6) }); return; }
      await ctx.line(T('杜鲁门警长', 'Sheriff Truman'), T('劳拉·帕默。返校节皇后。镇上每个人都认识她。', 'Laura Palmer. Homecoming queen. Everybody in town knew her.'), { focus: V(9.6, 1.2, -1.6) });
      const c = await ctx.choice(T('警长看着湖面，等你开口。', 'The sheriff looks at the water, waiting for you to speak.'), [T('“戴安，记下来：我想我们会在这里待一阵子。”', '“Diane, note this: I think we’ll be here a while.”'), T('“这附近哪里有好咖啡？”', '“Where can a man get a good cup of coffee around here?”')], T('库珀', 'Cooper'));
      await ctx.line(T('杜鲁门警长', 'Sheriff Truman'), c === 0 ? T('……路在上面。车就停在那儿。', '…The road’s up top. The car is parked there.') : T('双 R 餐馆。樱桃派也不错。路在上面。', 'The Double R. The cherry pie is good too. The road’s up top.'));
      ctx.pick('arrival', c === 0 ? 'diane' : 'coffee'); ctx.hint(T('把木箱推到坡下，踩上去，再攀上路面', 'Push the crate to the bank, stand on it and climb up to the road'), 6000);
    } });
    world.interact({ pos: V(2.6, .5, -1.2), label: T('掀开塑料布的一角', 'Lift a corner of the plastic'), radius: 1.6, use: async (it) => {
      it.enabled = false; bodyLight.intensity = 380; bodyBeam.material.uniforms.strength.value = .18; sound.noise({ dur: 1.2, freq: 2400, q: .7, gain: .08 });
      await ctx.talk(async () => {
        await ctx.line('', T('塑料布底下，一张很安静的脸，嘴唇发青。', 'Under the plastic, a very quiet face, the lips gone blue.'), { focus: V(2.6, .3, -1.9), zoom: 2.4 });
        await ctx.line(T('库珀', 'Cooper'), T('戴安，早上十一点半。死者叫劳拉·帕默，十七岁。', 'Diane, 11:30 a.m. The deceased is Laura Palmer, seventeen years old.'));
      });
      ctx.clue('plastic'); bodyLight.intensity = 140; ctx.save();
    } });
    world.trigger([-12, 0, -3], [-8, 2, 2], () => ctx.hint(T('A / D 移动 · Shift 奔跑 · F 手电 · E 交谈', 'A / D move · Shift run · F flashlight · E talk'), 5000));
    world.trigger([-8, 0, -3], [-6.4, 2, 2], () => ctx.hint(T('空格 跳过石头', 'Space to jump over the rock'), 3500));
    world.trigger([5, 0, -3], [8, 2, 2], () => ctx.hint(T('靠近木箱按住 E 抓住，左右拖动', 'Hold E by the crate to grab it, then drag left or right'), 4500));
    world.trigger([21, 2.9, -2.6], [23, 6, 1.7], () => { if (ctx.story.clues.plastic) ctx.next(); else ctx.say(T('还不能走。她还在湖边。', 'Not yet. She is still by the water.'), 2600); }, false);
    ctx.onRestore = () => { if (ctx.story.clues.plastic) bodyLight.intensity = 140; };
    ctx.debug = { crate };
    ctx.intro = async () => {
      await ctx.ready; await ctx.wait(600);
      ctx.say(T('戴安，1989 年 2 月 24 日。我正在进入双峰镇。', 'Diane, February 24th, 1989. I am entering the town of Twin Peaks.'), 4200, T('库珀', 'Cooper'));
      await ctx.wait(4400); ctx.say(T('湖面没有风。有人在岸边等我。', 'There is no wind on the lake. Someone is waiting for me on the shore.'), 3400);
    };
  },
};

// =====================================================================================
// 3b · THE DREAM — twenty-five years later, the red room for the first time
// =====================================================================================
export const dream = {
  id: 'dream', set: 'redroom', cast: ['man_from_another_place', 'laura'], name: { zh: '梦 · 二十五年后', en: 'The Dream · Twenty-Five Years Later' }, ambience: 'dream',
  bounds: [-14, 14], spawn: V(-12, 0, .6), fog: ['#170404', .035], exposure: 1.2,
  build(ctx) {
    const { scene, world, sound, player } = ctx; const { add, useSet, npc } = kit(ctx);
    world.defaultSurface = 'velvet'; world.zMin = -1.6; world.zMax = 1.7;
    scene.add(new THREE.HemisphereLight('#4a1210', '#080202', .6));
    const set = ctx.models.sets?.redroom;
    if (set) add(useSet(set, { chevron: () => TEX.chevron([2.2, 2.2]) }));
    else add(slab([-15, -.6, -7], [15, 0, 10], mat('#ffffff', { map: TEX.chevron([12, 2]), rough: .35 }), { warp: 0 }));
    world.solid([-200, -.6, -7], [200, 0, 10]); world.solid([-15.5, 0, -7], [-14.6, 9, 4]); world.solid([14.6, 0, -7], [15.5, 9, 4]);
    world.solid([5.2, 0, -3.7], [7.6, 1.1, -1.7]); world.solid([-4.2, 0, -3.6], [-1.4, 1.1, -1.6]); world.solid([-7.4, 0, -3.4], [-5.8, 1.8, -2.0]);
    // darker than the finale: one cold key per figure, everything else falls away into red
    const wash = new THREE.PointLight('#ff1e10', 18, 30, 1.3); wash.position.set(0, 6, 2); add(wash);
    const keyA = spot('#e4ecff', 0, V(-6, 13, 3), V(-6.5, 0, -1.4), { angle: .22, penumbra: .4, distance: 26 }); add(keyA); add(keyA.target);
    const keyB = spot('#e4ecff', 0, V(5, 13, 3), V(4.8, 0, -1.8), { angle: .22, penumbra: .4, distance: 26 }); add(keyB); add(keyB.target);
    const beamA = add(beam(V(-6, 11, 1.5), V(-6.5, 0, -1.4), 2.4, '#dfe8ff', 0));
    const beamB = add(beam(V(5, 11, 1.5), V(4.8, 0, -1.8), 2.4, '#dfe8ff', 0));
    for (const tx of [-12.4, 1.0, 13.2]) { const tl = new THREE.PointLight('#ffb070', 14, 10, 1.5); tl.position.set(tx, 5.3, -3.1); add(tl); }
    let mfapTalked = false;
    const mfap = npc('man_from_another_place', { name: T('来自另一个地方的人', 'The Man from Another Place'), pos: V(-6.5, 0, -1.4), h: .95, rot: .3, talk: async () => {
      await ctx.line(T('来自另一个地方的人', 'The Man from Another Place'), T('「你喜欢的那种口香糖，会再流行起来。」', '“That gum you like is going to come back in style.”'), { focus: V(-6.5, .9, -1.4), zoom: 2 });
      await ctx.line(T('来自另一个地方的人', 'The Man from Another Place'), T('「她是我的表妹。可她看起来不就像劳拉·帕默吗？」', '“She’s my cousin. But doesn’t she look almost exactly like Laura Palmer?”'));
      mfapTalked = true; keyB.intensity = 520; beamB.material.uniforms.strength.value = .16; sound.thud(.5);
    } });
    if (mfap) world.updaters.push((dt, t) => { if (!ctx.flags.woke) { mfap.group.rotation.y = .3 + Math.sin(t * 2.2) * .6; mfap.group.position.y = Math.abs(Math.sin(t * 4.4)) * .04; } });
    const laura = npc('laura', { name: T('劳拉', 'Laura'), pos: V(4.8, 0, -1.8), rot: -.2, talk: async () => {
      if (!mfapTalked) { await ctx.line(T('劳拉', 'Laura'), T('（她看着你，什么也不说。在这里，要先有人替她开口。）', '(She looks at you and says nothing. Here, someone else has to speak first.)')); return; }
      await ctx.line(T('劳拉', 'Laura'), T('「我觉得我认识你。可有时候，我的手臂会向后弯。」', '“I feel like I know you. But sometimes my arms bend back.”'), { focus: V(4.8, 1.2, -1.8), zoom: 2 });
      await ctx.line('', T('她站起来，走到你身边，贴着你的耳朵说了一句话。', 'She stands, comes to you, and whispers in your ear.'));
      sound.whisper(.1, 3.2);
      const c = await ctx.choice(T('你知道醒来以后会忘记。', 'You know you will forget when you wake.'), [T('（用力记住那句话）', '(Hold on to the words)'), T('（让它像梦一样散掉）', '(Let it fade like a dream)')], T('库珀', 'Cooper'));
      if (c === 0) { ctx.clue('dream'); ctx.pick('dream', 'remember'); await ctx.line(T('库珀', 'Cooper'), T('我知道是谁杀了劳拉。……我得想起来。', 'I know who killed Laura. …I have to remember.')); }
      else { ctx.pick('dream', 'forget'); await ctx.line('', T('那句话像烟一样从指缝间溜走了。', 'The words slip through your fingers like smoke.')); }
      wake();
    } });
    async function wake() {
      ctx.flags.woke = true; ctx.save(); await ctx.wait(400);
      sound.click(); await ctx.wait(160); sound.click();                         // Cooper snaps his fingers
      sound.switchOff(); ctx.blackout(true); await ctx.wait(1400);
      ctx.say(T('（你在旅馆的床上坐起来，拿起电话。）', '(You sit up in the hotel bed and pick up the phone.)'), 2600);
      await ctx.wait(1800); ctx.next();
    }
    const d = add(dust(160, new THREE.Box3(V(-14, 0, -4), V(14, 8, 2)), '#ffd2c0')); world.updaters.push((dt, t) => animateDust(d, t));
    world.trigger([-9, 0, -3], [-8, 3, 2], () => { keyA.intensity = 520; beamA.material.uniforms.strength.value = .16; sound.thud(.4); });
    ctx.onRestore = (f) => { if (f.woke) setTimeout(() => ctx.next(), 300); };
    ctx.intro = async () => {
      ctx.say(T('你老了二十五岁。手指上的皱纹，不像是你的。', 'You are twenty-five years older. The lines on your fingers are not yours.'), 3800);
      ctx.hint(T('跟着光走', 'Follow the light'), 4000);
    };
  },
};

// =====================================================================================
// 8b · THE HOLDING CELL — Leland's confession, the sprinklers, the light
// =====================================================================================
export const cell = {
  id: 'cell', set: 'cell', cast: ['leland', 'truman', 'albert', 'bob'], name: { zh: '拘留室 · 洒水器', en: 'The Holding Cell · The Sprinklers' }, ambience: 'cell',
  bounds: [-13, 15], spawn: V(-11.5, 0, .6), fog: ['#0b0d0e', .04], exposure: 1.3,
  build(ctx) {
    const { scene, world, sound, player } = ctx; const { add: add0, solid: solid0, useSet, npc, puppet } = kit(ctx);
    world.defaultSurface = 'tile'; world.zMin = -1.2; world.zMax = 1.7;
    scene.add(new THREE.HemisphereLight('#4a585c', '#0a0a0a', 1.0));
    const fillC = new THREE.PointLight('#c8dcd8', 12, 20, 1.2); fillC.position.set(0, 5, 5); add0(fillC);
    const set = ctx.models.sets?.cell;
    if (set) add0(useSet(set, { plaster: () => TEX.plaster('#5a5e52', [1.4, 1.4]), checker: () => TEX.checker('#7a7a6e', '#2a2a26', [1, 1]) }));
    const add = set ? (o) => o : add0;
    const solid = set ? (mn, mx, m, o = {}) => world.solid(mn, mx, { noClimb: o.noClimb }) : solid0;
    const floor = mat('#ffffff', { map: TEX.checker('#7a7a6e', '#2a2a26', [12, 3]), rough: .6 });
    const wall = mat('#ffffff', { map: TEX.plaster('#5a5e52', [6, 2]), rough: .9 });
    const iron = mat('#2a2c2c', { metal: .7, rough: .45 });
    solid([-14, -.6, -7], [16, 0, 10], floor, { warp: 0 });
    solid([-14, 0, -6], [16, 9, -5.4], wall, { decor: true });
    solid([-14.6, 0, -7], [-13.4, 9, 4], wall);
    solid([14.6, 0, -7], [15.6, 9, -1.4], wall); solid([14.6, 0, .9], [15.6, 9, 4], wall); solid([14.6, 4.4, -1.4], [15.6, 9, .9], wall);
    // the cell: bars from floor to ceiling between z = -1.6 and the back wall, x 0 .. 8
    for (let x = .2; x <= 8; x += .5) add(cylinder(x, 0, -1.6, .045, 6, iron, { seg: 8, warp: 0 }));
    add(slab([0, 5.8, -1.7], [8.2, 6.1, -1.5], iron, { warp: 0 }));
    world.solid([0, 0, -1.75], [8.2, 6, -1.45], { noClimb: true });
    solid([3, 0, -5.2], [7, .9, -3.6], mat('#3a3a34'), {});                    // the cot
    // desk and key hook on the left; a chair that can be pushed under the hook
    solid([-10, 0, -4.4], [-6.4, 1.6, -2.8], mat('#ffffff', { map: TEX.planks('#3a2a1a', [2, 1]) }));
    const chairMesh = add0(slab([-.55, 0, -.55], [.55, 1.3, .55], mat('#ffffff', { map: TEX.planks('#4a3420', [1, 1]) }), { warp: .03 }));
    chairMesh.position.set(-4.5, .65, -.3); chairMesh.userData.offset = V(0, .65, 0);
    const chair = world.movable(chairMesh, [1.1, 1.3, 1.1]);
    const keys = new THREE.Mesh(new THREE.TorusGeometry(.18, .04, 8, 20), mat('#c8a040', { metal: 1, rough: .3, emissive: '#5a4000', emissiveIntensity: .5 }));
    keys.position.set(-1.6, 3.6, -1.2); add0(keys);
    // fluorescent tubes: one flickers over the cell
    const tubes = [];
    for (const x of [-8, 4, 11]) {
      const tube = add0(slab([x - 1.6, 7.6, -2.2], [x + 1.6, 7.75, -1.9], mat('#e8f4f0', { emissive: '#d8fff0', emissiveIntensity: 1.2 }), { warp: 0, cast: false }));
      const l = new THREE.PointLight('#d8f0e8', 40, 14, 1.3); l.position.set(x, 7.2, -1); add0(l); tubes.push({ tube, l });
    }
    world.updaters.push((dt, t) => { if (Math.random() < .03) { const k = Math.random() < .5 ? .15 : 1; tubes[1].l.intensity = 40 * k; tubes[1].tube.material.emissiveIntensity = 1.2 * k; if (k < 1) sound.buzz(.05); } });
    const fc = add0(fogCards(6, new THREE.Box3(V(-12, .1, -4), V(14, 1, 1)), '#a0b0b0', .06)); world.updaters.push((dt) => animateFog(fc, dt));
    // sprinkler rain (off until the confession)
    const spray = add0(dust(700, new THREE.Box3(V(-12, 0, -5), V(14, 7.4, 2)), '#cfe4ff', .03)); spray.visible = false; spray.material.opacity = .5;
    world.updaters.push((dt) => { if (!spray.visible) return; const p = spray.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * (6 + (i % 6)); if (y < 0) y = 7.4; p.setY(i, y); } p.needsUpdate = true; });
    const lightFromAbove = spot('#fff6e0', 0, V(4, 14, -2), V(4, 0, -3.6), { angle: .3, penumbra: .6, distance: 30 }); add0(lightFromAbove); add0(lightFromAbove.target);
    const holy = add0(beam(V(4, 12, -2.6), V(4, 0, -3.8), 3, '#fff2d0', 0));

    // cast
    const leland = npc('leland', { name: T('利兰', 'Leland'), pos: V(5, 0, -3.2), rot: Math.PI - .2, solid: false, radius: 2.4, label: T('隔着栏杆和利兰说话', 'Talk to Leland through the bars'), talk: async () => {
      if (!ctx.flags.open) { await ctx.line(T('利兰', 'Leland'), T('（他背对着你，在哼一首歌。哼到一半，又从头哼起。）', '(His back is to you. He hums a song, stops halfway, begins again.)'), { focus: V(5, 1.2, -3.2) }); return; }
      await confession();
    } });
    npc('truman', { name: T('杜鲁门警长', 'Sheriff Truman'), pos: V(-8.4, 0, -1.0), rot: .4, talk: async () => {
      await ctx.line(T('杜鲁门警长', 'Sheriff Truman'), T('他自己承认的。可他说话的声音……不像利兰。', 'He confessed himself. But the voice he talks in… isn’t Leland’s.'), { focus: V(-8.4, 1.2, -1) });
      if (!ctx.flags.open) await ctx.line(T('杜鲁门警长', 'Sheriff Truman'), T('钥匙挂在那边钩子上。太高了，得踩点什么。', 'The keys are on the hook over there. Too high — you’ll need something to stand on.'));
    } });
    const albert = npc('albert', { name: T('阿尔伯特', 'Albert'), pos: V(10.4, 0, -1.0), rot: -.4, talk: async () => {
      if (!ctx.flags.leland) { await ctx.line(T('阿尔伯特', 'Albert'), T('我在这里只是为了写报告。别指望我同情谁。', 'I’m here to write the report. Don’t expect sympathy from me.'), { focus: V(10.4, 1.2, -1) }); return; }
      await ctx.line(T('阿尔伯特', 'Albert'), T('也许那就是 BOB——人心里做出来的那些恶。叫什么名字都一样。', 'Maybe that’s all BOB is — the evil that men do. Whatever we call it.'), { focus: V(10.4, 1.2, -1) });
      await ctx.line(T('库珀', 'Cooper'), T('林子里还有东西。我得去格拉斯顿伯里林地。', 'There is something still in the woods. I have to go to Glastonbury Grove.'));
    } });
    const bobFig = ctx.models.cast?.bob ? puppet(ctx.models.cast.bob, 1.3, 'idle') : null;
    if (bobFig) { bobFig.group.position.set(5, 0, -4.4); bobFig.group.visible = false; add0(bobFig.group); }

    world.interact({ pos: V(-1.6, 3.0, -1.2), label: T('取下钥匙', 'Take the keys'), radius: 1.6, use: (it) => {
      it.enabled = false; keys.visible = false; sound.pickup(); ctx.flags.open = true; ctx.save();
      ctx.say(T('钥匙很凉。牢门开了一条缝。', 'The keys are cold. The cell door swings open a crack.'), 3000);
    } });
    async function confession() {
      ctx.flags.open = 'talked';
      await ctx.line(T('利兰', 'Leland'), T('（他转过身来。笑容太宽了，宽得不像他的脸。）', '(He turns around. The smile is too wide — too wide for his face.)'), { focus: V(5, 1.2, -3.2), zoom: 2 });
      if (leland) leland.group.rotation.y = -.2;
      if (bobFig) { bobFig.group.visible = true; tubes[1].l.intensity = 2; sound.growl(.2); }
      await ctx.line(T('BOB', 'BOB'), T('「我用了他很久。他小时候，我就进来了。」', '“I’ve used him a long time. I came in when he was a boy.”'));
      if (bobFig) bobFig.group.visible = false; tubes[1].l.intensity = 40;
      await ctx.line('', T('他把头撞向铁门。洒水器突然打开。', 'He drives his head against the cell door. The sprinklers burst on.'));
      sound.thud(1); ctx.shake(.5); spray.visible = true; sound.ambience('cell'); sound.loopNoise(3000, .07, { type: 'highpass', brown: false });
      await ctx.wait(800);
      await ctx.line(T('利兰', 'Leland'), T('……我是利兰。我又是我自己了。劳拉……我做了什么？', '…It’s Leland. I’m myself again. Laura… what have I done?'));
      const c = await ctx.choice(T('他躺在水里，抓着你的袖子。', 'He lies in the water, clutching your sleeve.'), [T('“往光里走，利兰。她在那里等你。”', '“Look for the light, Leland. She’s there waiting for you.”'), T('（握住他的手，什么也不说）', '(Hold his hand and say nothing)')], T('库珀', 'Cooper'));
      lightFromAbove.intensity = 900; holy.material.uniforms.strength.value = .3; sound.pickup();
      if (c === 0) { ctx.clue('light'); ctx.pick('leland', 'light'); await ctx.line(T('利兰', 'Leland'), T('「我看见她了……她很美。」', '“I see her… she’s beautiful.”')); }
      else { ctx.pick('leland', 'silence'); await ctx.line('', T('他的手松开了。水还在下。', 'His hand goes slack. The water keeps falling.')); }
      await ctx.wait(800); lightFromAbove.intensity = 0; holy.material.uniforms.strength.value = 0; spray.visible = false; sound.ambience('cell');
      if (leland) { leland.group.rotation.z = Math.PI / 2; leland.group.position.y = .3; }
      ctx.flags.leland = true; ctx.save();
      ctx.say(T('门外的走廊通向夜里。', 'The corridor outside leads into the night.'), 3000);
    }
    world.trigger([-6, 0, -2], [-2, 2, 2], () => ctx.hint(T('推椅子到钥匙下面，站上去', 'Push the chair under the keys and stand on it'), 4500));
    world.trigger([14.7, 0, -1.4], [16, 3, .9], () => { if (ctx.flags.leland) ctx.next(); else ctx.say(T('还有人在等你说话。', 'Someone is still waiting for you to speak.'), 2600); }, false);
    ctx.onRestore = (f) => {
      if (f.open) keys.visible = false;
      if (f.open === 'talked' && !f.leland) f.open = true;
      if (f.open === true && leland) leland.group.rotation.y = -.2;
      if (f.leland && leland) { leland.group.rotation.z = Math.PI / 2; leland.group.position.y = .3; }
    };
    ctx.debug = { chair };
    ctx.intro = async () => { ctx.say(T('拘留室。荧光灯在嗡嗡响，有一根一直在闪。', 'The holding cell. The fluorescent tubes hum; one keeps flickering.'), 3400); };
  },
};
