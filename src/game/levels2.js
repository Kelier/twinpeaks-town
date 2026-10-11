// New scenes: sheriff's station, the Roadhouse, the Log Lady's cabin, the Palmer house.
// Each is a closed, pitch-dark box modelled in Blender (public/game/sets/<id>.glb); colliders, lights, cast and scripts live here.
import * as THREE from 'three';
import { T, t } from './i18n.js';
import { TEX, mat, slab, beam, dust, spot, animateDust, fogCards, animateFog } from './gfx.js';
import { kit } from './levels.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const room = (world, x0, x1, { door = null, h = 9 } = {}) => {
  world.solid([x0 - 2, -.6, -7], [x1 + 2, 0, 10]);                       // floor
  world.solid([x0 - .8, 0, -7], [x0, h, 4]);                              // left wall
  if (door) { world.solid([x1, 0, -7], [x1 + .8, h, door[0]]); world.solid([x1, 0, door[1]], [x1 + .8, h, 4]); world.solid([x1, 4.4, door[0]], [x1 + .8, h, door[1]]); }
  else world.solid([x1, 0, -7], [x1 + .8, h, 4]);
};
const set = (ctx, id, add, useSet, texOpts = {}) => { const g = ctx.models.sets?.[id]; if (g) add(useSet(g, texOpts)); return !!g; };

// =====================================================================================
// 3a · SHERIFF'S STATION — the donut conference room
// =====================================================================================
export const station = {
  id: 'station', set: 'station', cast: ['lucy', 'andy', 'hawk', 'truman', 'gordon', 'albert'], name: { zh: '警长办公室 · 甜甜圈与白板', en: 'The Sheriff’s Station · Donuts and the Board' }, ambience: 'station',
  bounds: [-14.5, 15], spawn: V(-13, 0, .6), fog: ['#0f0d0a', .035], exposure: 1.3,
  build(ctx) {
    const { scene, world, sound, player } = ctx; const { add, useSet, npc } = kit(ctx);
    world.defaultSurface = 'wood'; world.zMin = -4.1; world.zMax = 1.7;
    scene.add(new THREE.HemisphereLight('#3a3228', '#0c0806', .7));
    set(ctx, 'station', add, useSet, { knotty: () => TEX.knotty([1.3, 1.3]), planks: () => TEX.planks('#5a3a22', [1.4, 1.4]) });
    room(world, -14.5, 14.5, { door: [-1.4, .9] });
    world.solid([-12.6, 0, -3.6], [-9.4, 1.5, -2.2]);                     // Lucy's desk
    world.solid([-5, 0, -4.2], [5, 1.6, -2.0]);                           // conference table
    for (const x of [-3.5, -1, 1.5, 4]) world.solid([x - .45, 0, -2.0], [x + .45, .9, -1.2]);   // chairs
    world.solid([6.5, 0, -4.4], [8.5, 2.2, -3.2]);                        // filing cabinet
    const boxMesh = add(slab([-.6, 0, -.45], [.6, .9, .45], mat('#ffffff', { map: TEX.fabric('#8a6a3a'), rough: .9 }), { warp: .03 }));
    boxMesh.position.set(11, .45, -3.6); boxMesh.userData.offset = V(0, .45, 0);
    world.movable(boxMesh, [1.2, .9, .9]);
    // lights: two fluorescent tubes (one flickers), a desk lamp, a cold window
    const tubes = [[-6, 0xdfe8d8], [5, 0xdfe8d8]].map(([x, c]) => { const l = spot(c, 260, V(x, 8.4, -1.5), V(x, 0, -2.2), { angle: .75, penumbra: .8, distance: 16, mapSize: 512 }); add(l); add(l.target); return l; });
    world.updaters.push((dt, t) => { tubes[1].intensity = Math.random() < .03 ? 40 : 260; });
    const desk = new THREE.PointLight('#ffcf8a', 14, 6, 1.6); desk.position.set(-11, 2.4, -2.8); add(desk);
    add(beam(V(-6, 8.4, -1.5), V(-6, 0, -2.2), 2.6, '#e8f0dc', .07));
    const fc = add(fogCards(8, new THREE.Box3(V(-14, .2, -4), V(14, 1, 1)), '#a8a090', .08)); world.updaters.push((dt) => animateFog(fc, dt));

    npc('lucy', { name: T('露西', 'Lucy'), pos: V(-11, 0, -1.6), rot: .3, talk: async () => {
      sound.noise({ dur: .4, freq: 2400, q: 8, gain: .06 });
      await ctx.line(T('露西', 'Lucy'), T('库珀探员，有一通找您的电话……是木头女士。', 'Agent Cooper, there’s a call for you… it’s the Log Lady.'), { focus: V(-11, 1.2, -1.6) });
      await ctx.line(T('露西', 'Lucy'), T('她说，她的木头有话要对您说。我照原话转达。', 'She says her log has something to tell you. I’m repeating it word for word.'));
      const c = await ctx.choice('', [T('“告诉她，我会去见她。”', '“Tell her I’ll come and see her.”'), T('“请她再等一等。”', '“Ask her to wait a little.”')], T('露西', 'Lucy'));
      ctx.pick('lucy', c ? 'wait' : 'go'); await ctx.line(T('露西', 'Lucy'), c ? T('好的……她说她可以一直等。', 'Okay… she says she can wait forever.') : T('我会告诉她。她好像早就知道了。', 'I’ll tell her. She seems to know already.'));
    } });
    npc('andy', { name: T('安迪', 'Andy'), pos: V(-6.6, 0, -1.2), rot: .2, talk: async () => {
      await ctx.line(T('安迪', 'Andy'), T('对不起，我……我一看到劳拉的照片就忍不住。', 'Sorry, I… I can’t help it when I see Laura’s picture.'), { focus: V(-6.6, 1.2, -1.2) });
      await ctx.line(T('安迪', 'Andy'), T('那张画像钉在白板上，太高了。文件柜旁边那箱档案，也许能垫一垫。', 'The sketch is pinned up on the board, too high. That box of files by the cabinet might help.'));
    } });
    npc('hawk', { name: T('霍克', 'Hawk'), pos: V(2.8, 0, -1.4), rot: -.2, talk: async () => {
      await ctx.line(T('霍克', 'Hawk'), T('我的族人说，有一间白色的屋子，也有一间黑色的屋子。', 'My people say there is a White Lodge, and there is a Black Lodge.'), { focus: V(2.8, 1.2, -1.4) });
      await ctx.line(T('霍克', 'Hawk'), T('走进黑屋的人，如果心里有缺口，出来的就不是他自己。', 'Whoever walks into the Black Lodge with imperfect courage — it is not himself who comes out.'));
    } });
    const donuts = world.interact({ pos: V(-1, 2.1, -3), label: T('甜甜圈', 'Donuts'), radius: 1.4, use: async (it) => {
      sound.pickup(); await ctx.talk(async () => { await ctx.line('', T('一整座甜甜圈金字塔。警长办公室的每一场会议，都从这里开始。', 'An entire pyramid of donuts. Every meeting at the station starts here.')); });
    } });
    world.interact({ pos: V(8.4, 3.2, -4.1), label: T('看白板上的画像', 'Look at the sketch on the board'), radius: 1.3, use: async (it) => {
      it.enabled = false; ctx.flags.sketch = true;
      await ctx.talk(async () => {
        await ctx.line('', T('一张铅笔素描：长发，咧开的嘴，盯着画外的人。', 'A pencil sketch: long hair, a grinning mouth, staring out of the paper.'), { focus: V(8.4, 3.2, -4), zoom: 3.2 });
        await ctx.line('', T('下面有人用红笔写了三个字母：B · O · B。', 'Underneath, someone wrote three letters in red: B · O · B.'));
      });
      ctx.clue('sketch');
    } });
    npc('truman', { name: T('杜鲁门警长', 'Sheriff Truman'), pos: V(11.8, 0, -1.4), rot: -.4, talk: async () => {
      await ctx.line(T('杜鲁门警长', 'Sheriff Truman'), ctx.story.clues.sketch ? T('所以他叫 BOB。我在镇上从没见过这张脸。', 'So his name is BOB. I’ve never seen that face in town.') : T('白板上有张画像，你最好先看看。', 'There’s a sketch on the board. You’d better see it first.'), { focus: V(11.8, 1.2, -1.4) });
      const c = await ctx.choice('', [T('“去找木头女士。现在。”', '“Let’s see the Log Lady. Now.”'), T('“再给我一点时间。”', '“Give me a little more time.”')], T('杜鲁门警长', 'Sheriff Truman'));
      if (c === 0) { await ctx.line(T('杜鲁门警长', 'Sheriff Truman'), T('天黑了。先回旅馆睡一觉，明早我开车送你去。', 'It’s dark. Get some sleep at the hotel — I’ll drive you out in the morning.')); setTimeout(() => ctx.next(), 300); }
    } });
    npc('gordon', { name: T('戈登·科尔', 'Gordon Cole'), pos: V(-3.2, 0, .9), rot: .3, talk: async () => {
      await ctx.line(T('戈登·科尔', 'Gordon Cole'), T('库珀！你说什么？大点声！', 'COOPER! WHAT’S THAT? SPEAK UP!'), { focus: V(-3.2, 1.2, .9) });
      await ctx.line(T('戈登·科尔', 'Gordon Cole'), T('我说——这案子比我们想的深。非常深。', 'I SAID — THIS CASE GOES DEEPER THAN WE THOUGHT. MUCH DEEPER.'));
    } });
    npc('albert', { name: T('阿尔伯特', 'Albert'), pos: V(5.8, 0, .8), rot: -.3, talk: async () => {
      await ctx.line(T('阿尔伯特', 'Albert'), T('尸检报告：她的指甲下面有一个很小的字母。我不相信巧合，你也不该信。', 'Autopsy: a tiny letter under her fingernail. I don’t believe in coincidence and neither should you.'), { focus: V(5.8, 1.2, .8) });
    } });
    world.trigger([14.6, 0, -1.4], [16, 3, .9], () => ctx.next());
    ctx.intro = async () => { ctx.say(T('警长办公室。白板、咖啡，还有一盒甜甜圈。', 'The sheriff’s station. A whiteboard, coffee, and a box of donuts.'), 3200); };
  },
};

// =====================================================================================
// 3b · THE ROADHOUSE — the song, and the Giant on stage
// =====================================================================================
export const roadhouse = {
  id: 'roadhouse', set: 'roadhouse', cast: ['julee', 'james', 'donna', 'bobby', 'giant', 'josie'], name: { zh: '公路酒吧 · 又发生了', en: 'The Roadhouse · It Is Happening Again' }, ambience: 'roadhouse',
  bounds: [-16.5, 18.5], spawn: V(-15, 0, .6), fog: ['#0a0c18', .04], exposure: 1.3,
  build(ctx) {
    const { scene, world, sound, player } = ctx; const { add, useSet, npc, puppet } = kit(ctx);
    world.defaultSurface = 'wood'; world.zMin = -4.0; world.zMax = 1.7;
    scene.add(new THREE.HemisphereLight('#1c2448', '#080406', .6));
    set(ctx, 'roadhouse', add, useSet, { planks: () => TEX.planks('#3a2418', [1.4, 1.4]) });
    room(world, -16.5, 18.2, { door: [-1.6, .9] });
    world.solid([-15, 0, -4.2], [-9, 1.7, -2.4]);                         // bar counter
    for (const x of [-14, -12.5, -11, -9.5]) world.solid([x - .4, 0, -2.3], [x + .4, .9, -1.5]);
    world.solid([-3, 0, -4.6], [7, .85, -2.2]);                           // stage
    world.solid([10, 0, -4.2], [16, .9, -2.8]); world.solid([10.5, 0, -2.8], [15.5, 1.5, -1.9]);   // booth + table
    // stage light, blue wash, table lamps
    const stage = spot('#ffd9c8', 600, V(2, 9, 1.5), V(2, .9, -3.3), { angle: .28, penumbra: .45, distance: 22 }); add(stage); add(stage.target);
    const stageBeam = add(beam(V(2, 8.5, 1), V(2, .9, -3.2), 1.8, '#ffd9c8', .16));
    const blue = new THREE.PointLight('#3a5cff', 30, 26, 1.3); blue.position.set(2, 6, -1); add(blue);
    for (const x of [-12, 13]) { const l = new THREE.PointLight('#ff9a50', 14, 7, 1.6); l.position.set(x, 2.6, -2.2); add(l); }
    const fc = add(fogCards(14, new THREE.Box3(V(-16, .2, -4.5), V(18, 2.6, 1)), '#7a86c0', .14)); world.updaters.push((dt) => animateFog(fc, dt));
    const d = add(dust(200, new THREE.Box3(V(-2, 0, -4), V(6, 8, 1)), '#ffe0d0', .03)); world.updaters.push((dt, t) => animateDust(d, t));

    const julee = npc('julee', { name: T('歌手', 'The Singer'), pos: V(2, .85, -3.4), h: 1.3, solid: false });
    if (julee) world.updaters.push((dt, t) => { julee.group.rotation.y = Math.sin(t * .6) * .25; });
    npc('bobby', { name: T('鲍比', 'Bobby'), pos: V(-10.6, 0, -1.2), rot: .5, talk: async () => {
      await ctx.line(T('鲍比', 'Bobby'), T('探员也来听歌？这里可不是你们 FBI 的地盘。', 'The G-man came for the music? This isn’t FBI territory.'), { focus: V(-10.6, 1.2, -1.2) });
      const c = await ctx.choice('', [T('“劳拉最后一晚，你在哪？”', '“Where were you on Laura’s last night?”'), T('（只是点了一杯啤酒）', '(Just order a beer)')], T('鲍比', 'Bobby'));
      await ctx.line(T('鲍比', 'Bobby'), c === 0 ? T('……我在等她。她没来。她总是不来。', '…I was waiting for her. She didn’t come. She never came.') : T('算你识相。', 'Smart choice.'));
    } });
    npc('josie', { name: T('乔西', 'Josie'), pos: V(-7.6, 0, -1.6), rot: .2, talk: async () => {
      await ctx.line(T('乔西', 'Josie'), T('锯木厂的账本，不该由一个外人来翻。', 'The mill’s ledgers are not for an outsider to read.'), { focus: V(-7.6, 1.2, -1.6) });
    } });
    npc('donna', { name: T('唐娜', 'Donna'), pos: V(13.4, 0, -1.2), rot: -.3, talk: async () => {
      await ctx.line(T('唐娜', 'Donna'), T('这首歌……劳拉说过，像是从很远的地方唱过来的。', 'This song… Laura said it sounds like it’s sung from very far away.'), { focus: V(13.4, 1.2, -1.2) });
      await ctx.line(T('唐娜', 'Donna'), T('詹姆斯不肯说话。他一直在看舞台。', 'James won’t talk. He keeps staring at the stage.'));
    } });
    npc('james', { name: T('詹姆斯', 'James'), pos: V(11.6, 0, -1.2), rot: -.2, talk: async () => {
      await ctx.line(T('詹姆斯', 'James'), T('你看见了吗？刚才灯闪了一下。台上……好像站着别人。', 'Did you see that? The lights flickered. Someone else was on the stage…'), { focus: V(11.6, 1.2, -1.2) });
    } });
    // the vision: walk up to the stage
    const giant = ctx.models.cast?.giant ? puppet(ctx.models.cast.giant, 4.2, 'idle') : null;
    if (giant) { giant.group.position.set(2, .85, -3.4); giant.group.visible = false; add(giant.group); }
    let seen = false;
    world.trigger([-.5, 0, -2.2], [4.5, 3, 1.7], async () => {
      if (seen) return; seen = true;
      player.mode = 'locked'; sound.switchOff(); ctx.blackout(true, .2); sound.stopAmbience(.3);
      await ctx.wait(900);
      if (julee) julee.group.visible = false; if (giant) giant.group.visible = true;
      stage.color.set('#e8eeff'); blue.intensity = 0; ctx.blackout(false, .03); sound.giantVoice(); ctx.shake(.2);
      await ctx.talk(async () => {
        await ctx.line(T('巨人', 'The Giant'), T('「又发生了。」', '“It is happening again.”'), { focus: V(2, 3, -3), zoom: 1.6 });
        await ctx.line(T('巨人', 'The Giant'), T('「又发生了。」', '“It is happening again.”'));
        const c = await ctx.choice(T('全场没有人看见他。', 'No one else in the room can see him.'), [T('“谁？告诉我是谁。”', '“Who? Tell me who.”'), T('（不出声，记住他的脸）', '(Say nothing; remember his face)')], '');
        await ctx.line(T('巨人', 'The Giant'), c === 0 ? T('「……一个你已经见过、却还没认出来的人。」', '“…Someone you have already seen, and not yet recognised.”') : T('他点了点头，像是满意你的沉默。', 'He nods, as if pleased with your silence.'));
      });
      ctx.clue('vision');
      sound.switchOff(); ctx.blackout(true, .2); await ctx.wait(800);
      if (giant) giant.group.visible = false; if (julee) julee.group.visible = true;
      stage.color.set('#ffd9c8'); blue.intensity = 30; ctx.blackout(false, .05); sound.ambience('roadhouse');
      ctx.say(T('灯又亮了。歌还没唱完。', 'The lights come back. The song isn’t over.'), 2600);
    }, true);
    world.trigger([18.3, 0, -1.6], [20, 3, .9], () => ctx.next());
    ctx.onRestore = () => { seen = !!ctx.story.clues.vision; };
    ctx.intro = async () => { ctx.say(T('公路酒吧。台上有人在唱一首很慢的歌。', 'The Roadhouse. Someone on stage is singing a very slow song.'), 3200); };
  },
};

// =====================================================================================
// 4 · THE LOG LADY'S CABIN
// =====================================================================================
export const cabin = {
  id: 'cabin', set: 'cabin', cast: ['log_lady'], name: { zh: '木头女士的小屋', en: 'The Log Lady’s Cabin' }, ambience: 'cabin',
  bounds: [-11, 13], spawn: V(-9.6, 0, .6), fog: ['#0c0805', .04], exposure: 1.35,
  build(ctx) {
    const { scene, world, sound, player } = ctx; const { add, useSet, npc } = kit(ctx);
    world.defaultSurface = 'wood'; world.zMin = -3.6; world.zMax = 1.7;
    scene.add(new THREE.HemisphereLight('#3a2c20', '#0a0604', .6));
    set(ctx, 'cabin', add, useSet, { logs: () => TEX.logs([1.2, 1.2]), planks: () => TEX.planks('#4a2e1a', [1.4, 1.4]) });
    room(world, -11, 12.8, { door: [-1.4, .9] });
    world.solid([-5.2, 0, -4.2], [-2.8, 1.8, -3.0]);                      // stove
    world.solid([5.8, 0, -3.8], [9.2, 1.5, -2.4]);                        // table
    world.solid([-10, 0, -3.6], [-7.4, .9, -1.8]);                        // log pile
    const stove = new THREE.PointLight('#ff7a30', 16, 7, 1.6); stove.position.set(-4, 1.2, -2.6); add(stove);
    world.updaters.push((dt, t) => { stove.intensity = 14 + Math.sin(t * 9) * 2 + Math.random() * 2; });
    const lamp = new THREE.PointLight('#ffc070', 0, 10, 1.4); lamp.position.set(7.5, 2.3, -2.9); lamp.castShadow = true; lamp.shadow.mapSize.set(512, 512); add(lamp);
    const lampGlass = add(new THREE.Mesh(new THREE.SphereGeometry(.18, 16, 12), mat('#ffd9a0', { emissive: '#ffb050', emissiveIntensity: 0 }))); lampGlass.position.set(7.5, 1.9, -2.9);
    const moon = spot('#8aa0d8', 320, V(8.5, 6, -9), V(6, 0, -1), { angle: .35, penumbra: .6, distance: 20 }); add(moon); add(moon.target);
    world.interact({ pos: V(7.5, 1.7, -2.6), label: T('点亮煤油灯', 'Light the oil lamp'), radius: 1.4, use: (it) => {
      it.enabled = false; sound.click(); lamp.intensity = 34; lampGlass.material.emissiveIntensity = 2.5; ctx.flags.lamp = true; ctx.say(T('火苗亮起来。房间里一直有人。', 'The flame catches. Someone has been in the room all along.'), 2600); ctx.save();
    } });
    const lady = npc('log_lady', { name: T('木头女士', 'The Log Lady'), pos: V(2.2, 0, -2.2), rot: .1, talk: async () => {
      if (!ctx.flags.lamp) { await ctx.line(T('木头女士', 'The Log Lady'), T('……先点灯。黑暗里，木头不爱说话。', '…Light the lamp first. In the dark, the log doesn’t like to talk.')); return; }
      await ctx.line(T('木头女士', 'The Log Lady'), T('我的木头看见了一些事。那一晚，它在林子里。', 'My log saw something. That night, it was in the woods.'), { focus: V(2.2, 1.2, -2.2) });
      const c = await ctx.choice(T('她把木头往前递了一点。', 'She holds the log out a little.'), [T('（把耳朵贴近木头）', '(Put your ear to the log)'), T('“木头不会说话，女士。”', '“Logs don’t talk, ma’am.”')], T('木头女士', 'The Log Lady'));
      if (c === 0) {
        sound.whisper(.2, 2.6); await ctx.line('', T('树皮里有很轻的风声。风声里，像有人在说：', 'There is a faint wind inside the bark. In the wind, someone seems to say:'));
        await ctx.line(T('木头', 'The Log'), T('「猫头鹰并非它们看起来的样子。」', '“The owls are not what they seem.”')); ctx.clue('owl'); ctx.pick('log', 'listened');
      } else { await ctx.line(T('木头女士', 'The Log Lady'), T('那么今晚，你会很冷。', 'Then tonight, you will be cold.')); ctx.pick('log', 'refused'); }
      await ctx.line(T('木头女士', 'The Log Lady'), T('去林子吧。它们在等你。往梧桐树走，别回头看灯。', 'Go to the woods. They are waiting. Walk toward the sycamores, and don’t look back at the light.'));
    } });
    world.trigger([12.9, 0, -1.4], [14.5, 3, .9], () => ctx.next());
    ctx.onRestore = (f) => { if (f.lamp) { lamp.intensity = 34; lampGlass.material.emissiveIntensity = 2.5; } };
    ctx.intro = async () => { ctx.say(T('小屋里只有炉火的光。', 'The only light in the cabin is the stove.'), 2800); ctx.hint(T('屋里太暗。也许桌上有灯。', 'Too dark in here. Maybe there’s a lamp on the table.'), 5000); };
  },
};

// =====================================================================================
// 6 · THE PALMER HOUSE — the record, the ceiling fan, the stairs
// =====================================================================================
export const palmer = {
  id: 'palmer', set: 'palmer', cast: ['leland', 'sarah', 'bob'], name: { zh: '帕默家 · 吊扇', en: 'The Palmer House · The Ceiling Fan' }, ambience: 'palmer',
  bounds: [-14.5, 17], spawn: V(-13, 0, .6), fog: ['#0b0807', .04], exposure: 1.3,
  build(ctx) {
    const { scene, world, sound, player } = ctx; const { add, useSet, npc, puppet } = kit(ctx);
    world.defaultSurface = 'velvet'; world.zMin = -3.4; world.zMax = 1.7;
    scene.add(new THREE.HemisphereLight('#2c2420', '#0a0605', .45));
    set(ctx, 'palmer', add, useSet, { floral: () => TEX.floral([1.3, 1.3]), planks: () => TEX.planks('#4a2c18', [1.4, 1.4]) });
    room(world, -14.5, 16.8);
    world.solid([-9.2, 0, -4.2], [-4.8, .9, -2.6]); world.solid([-9.2, .9, -4.2], [-4.8, 2.0, -3.7]);   // sofa
    world.solid([-1, 0, -4.2], [1, 1.3, -3.0]);                                                             // record cabinet
    // staircase up to the landing on the right (each step auto-climbs)
    for (let k = 0; k < 8; k++) world.solid([7.6 + k * .55, 0, -4.2], [8.15 + k * .55, .42 * (k + 1), -1.2]);
    world.solid([12, 0, -4.2], [16.8, 3.36, -1.2]);                                                         // landing
    const lampL = new THREE.PointLight('#ffc98a', 18, 9, 1.6); lampL.position.set(-10.5, 3, -3); add(lampL);
    const tv = new THREE.PointLight('#8fb0ff', 10, 6, 1.6); tv.position.set(-2.5, 1.4, -2.2); add(tv);
    world.updaters.push((dt, t) => { tv.intensity = 7 + Math.random() * 6; });
    const hall = new THREE.PointLight('#ffd0a0', 16, 10, 1.5); hall.position.set(10.5, 6.2, -2.4); add(hall);
    const top = spot('#d8dcff', 520, V(14, 9.5, 1), V(14, 3.4, -2.6), { angle: .35, penumbra: .5, distance: 18 }); add(top); add(top.target);
    // the ceiling fan above the landing (spins; its whirr is the scene's dread)
    const fan = new THREE.Group(); fan.position.set(14, 7.6, -2.6); add(fan);
    const fanMat = mat('#2a1e14', { rough: .5 });
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, .05, .32), fanMat); b.position.x = 1.1; const arm = new THREE.Group(); arm.rotation.y = k * Math.PI / 2; arm.add(b); fan.add(arm); }
    fan.add(new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, .35, 16), mat('#8a7a5a', { metal: .6, rough: .4 })));
    let fanSpeed = 6, fanT = 0;
    world.updaters.push((dt) => {
      fan.rotation.y += fanSpeed * dt; fanT -= dt;
      const near = Math.max(0, 1 - Math.hypot(player.pos.x - 14, player.pos.y - 3.4) / 9);
      if (fanT <= 0 && near > 0) { fanT = .16; sound.noise({ dur: .15, freq: 220 + near * 80, q: 2, gain: .05 + near * .12 }); }
    });
    // Leland dances to the record; Sarah sits rigid
    const leland = npc('leland', { name: T('利兰', 'Leland'), pos: V(3.2, 0, -1.6), talk: async () => {
      if (ctx.flags.recordOff) { await ctx.line(T('利兰', 'Leland'), T('……我刚才在跳舞吗？', '…Was I dancing just now?'), { focus: V(3.2, 1.2, -1.6) }); return; }
      await ctx.line(T('利兰', 'Leland'), T('劳拉最喜欢这首歌。我们以前一起跳——跳到天亮。', 'This was Laura’s favourite song. We used to dance — till morning.'), { focus: V(3.2, 1.2, -1.6) });
      const c = await ctx.choice(T('他抱着女儿的照片，一圈一圈地转。', 'He holds his daughter’s photograph and turns, and turns.'), [T('（去把唱片停下）', '(Go and stop the record)'), T('“陪他跳一会儿。”', '“Dance with him a little.”')], T('利兰', 'Leland'));
      if (c === 1) { await ctx.line(T('利兰', 'Leland'), T('你也听见了吗？音乐，总在空中。', 'Do you hear it too? The music is always in the air.')); }
      else stopRecord();
    } });
    if (leland) world.updaters.push((dt, t) => { if (!ctx.flags.recordOff) { leland.group.rotation.y = t * 1.6; leland.group.position.y = Math.abs(Math.sin(t * 3.2)) * .05; } });
    npc('sarah', { name: T('萨拉', 'Sarah'), pos: V(-4.2, 0, -2.2), rot: .5, talk: async () => {
      await ctx.line(T('萨拉', 'Sarah'), T('我看见过……楼梯上，一个人蹲在那里。长头发。', 'I saw… someone crouched on the stairs. Long hair.'), { focus: V(-4.2, 1.2, -2.2) });
      await ctx.line(T('萨拉', 'Sarah'), T('吊扇一直在转。利兰说那是为了让屋子不那么闷。我不让任何人关掉它。', 'The fan is always turning. Leland says it keeps the house from getting stuffy. I won’t let anyone turn it off.'));
    } });
    function stopRecord() {
      if (ctx.flags.recordOff) return; ctx.flags.recordOff = true; sound.stopAmbience(.2); sound.noise({ dur: .6, freq: 900, q: 1, gain: .2, sweep: 200 });
      ctx.say(T('唱针划过唱片。屋子一下子安静了，只剩吊扇。', 'The needle scrapes across the record. The house goes silent, except for the fan.'), 3000); ctx.clue('record');
      if (leland) leland.group.rotation.y = 0; ctx.save();
    }
    world.interact({ pos: V(0, 1.6, -3.2), label: T('抬起唱针', 'Lift the needle'), radius: 1.4, use: (it) => { it.enabled = false; stopRecord(); } });
    // the fan: look up from the landing → BOB downstairs, Sarah screams
    const bob = ctx.models.cast?.bob ? puppet(ctx.models.cast.bob, 2.2, 'idle') : null;
    if (bob) { bob.group.position.set(-7, .9, -3.2); bob.group.visible = false; add(bob.group); }
    world.interact({ pos: V(14, 4.6, -2.4), label: T('抬头看吊扇', 'Look up at the ceiling fan'), radius: 1.6, use: async (it) => {
      it.enabled = false; ctx.clue('fan');
      await ctx.talk(async () => {
        await ctx.line('', T('吊扇转得很慢，叶片的影子扫过你的脸。', 'The fan turns slowly; the shadows of its blades sweep across your face.'), { focus: V(14, 6.5, -2.6), zoom: 2.2 });
        await ctx.line('', T('楼下，沙发背后，有什么东西慢慢抬起了头。', 'Downstairs, behind the sofa, something slowly raises its head.'));
      });
      if (bob) { bob.group.visible = true; sound.growl(-.6); sound.scream(); ctx.shake(.4); ctx.setDread(1); }
      await ctx.wait(2200); if (bob) bob.group.visible = false; ctx.setDread(0);
      ctx.say(T('楼梯尽头的门开着。门后，是红色的。', 'The door at the top of the stairs is open. Beyond it, everything is red.'), 3200);
    } });
    const doorGlow = new THREE.PointLight('#ff2010', 0, 6, 1.4); doorGlow.position.set(16.2, 5, -2.6); add(doorGlow);
    world.updaters.push(() => { if (ctx.story.clues.fan) doorGlow.intensity = 20; });
    world.trigger([15.8, 3.3, -4], [17, 6, -1.2], () => { if (ctx.story.clues.fan) ctx.next(); }, false);
    ctx.onRestore = (f) => { if (f.recordOff) { sound.stopAmbience(.1); } };
    ctx.intro = async () => { ctx.say(T('帕默家。客厅的唱机在转，吊扇在转，利兰也在转。', 'The Palmer house. The record turns, the fan turns, and Leland turns.'), 3600); };
  },
};
