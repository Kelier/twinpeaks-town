// 剧情与关卡逻辑：所有物件交互最终都汇集到这里，负责推进章节、触发镜头/转场/音乐事件、写入存档。
import * as THREE from 'three';
import { LINES, FRAGMENTS, CHAPTERS } from '../content/chapters.js';
import { WORKS } from '../content/works.js';
import { wait } from '../fx/tween.js';

const locked = new Set(Object.values(FRAGMENTS).flatMap((f) => f.archive));
export const INITIAL_ARCHIVE = WORKS.filter((w) => !locked.has(w.id)).map((w) => w.id);

export class Story {
  constructor(game) {
    this.game = game;
  }
  get s() {
    return this.game.state;
  }
  get room() {
    return this.game.spaces.redroom;
  }
  say(lines) {
    return this.game.ui.dialog([].concat(lines));
  }
  async setChapter(id) {
    if (this.s.chapter === id) return;
    this.s.chapter = id;
    const ch = CHAPTERS.find((c) => c.id === id);
    await this.game.ui.chapterCard(ch);
    this.game.autosave();
  }

  // ———————————————— 红房间 ————————————————
  async intro() {
    const g = this.game;
    g.busy = true;
    await g.camera.pushIn(new THREE.Vector3(0.5, 1.0, -1.35), 0.4, 4);
    await this.say(LINES.intro);
    g.busy = false;
    await this.setChapter('ch1');
  }

  async armchair() {
    const g = this.game;
    g.busy = true;
    if (!this.s.flags.armchair) await this.say(LINES.armchair);
    // 坐下：机位移到椅子上，然后望向幕布
    const back = g.camera.pos.clone();
    const yaw = g.camera.yaw;
    await g.camera._move({ to: new THREE.Vector3(0.5, 1.15, -1.25), lookAt: new THREE.Vector3(0.5, 1.2, 2.5), duration: 2.4, keepLock: true });
    await this.say(LINES.armchairSit);
    if (!g.settings.reducedMotion) await g.camera.dutch(0.12, 2.5);
    await g.camera._move({ to: back, lookAt: back.clone().add(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))), duration: 1.8 });
    g.camera.release();
    this.s.flags.armchair = true;
    g.busy = false;
    await this._checkCh1();
  }

  async toggleLamp() {
    const g = this.game;
    const on = !this.room.lampOn;
    this.room.setLamp(on);
    g.audio.sfx(on ? 'click' : 'thunk');
    g.audio.event(on ? 'lamp:on' : 'lamp:off');
    g.ui.subtitle(on ? LINES.lamp.on : LINES.lamp.off);
    this.s.flags.lampOff = !on;
    g.ui.updateHud();
    if (!on && this.s.chapter === 'ch2' && !this.s.flags.seenPortals) {
      this.s.flags.seenPortals = true;
      await wait(1.2);
      g.busy = true;
      await g.camera.lookAt(new THREE.Vector3(-2.8, 1.5, -0.6), 1.6);
      await wait(0.6);
      await g.camera.lookAt(new THREE.Vector3(-1.6, 1.5, -2.8), 1.4);
      await wait(0.6);
      await g.camera.lookAt(new THREE.Vector3(2.8, 1.5, 0.4), 1.8);
      g.busy = false;
    }
  }

  async statue() {
    const g = this.game;
    const s = this.s;
    if (s.chapter === 'finale' && s.fragments.length === 3) return this.finale();
    g.busy = true;
    await g.camera.pushIn(new THREE.Vector3(-0.65, 0.95, -1.25), 0.5, 2, true);
    await this.say(s.fragments.length ? [LINES.statueReady] : LINES.statue);
    await g.camera.pullBack(new THREE.Vector3(-0.65, 0.95, -1.25), 0.5, 1.4);
    g.camera.release();
    s.flags.statue = true;
    g.busy = false;
    await this._checkCh1();
  }

  async _checkCh1() {
    if (this.s.chapter !== 'ch1' || !this.s.flags.armchair || !this.s.flags.statue) return;
    this.game.busy = true;
    await this.setChapter('ch2');
    await this.say(LINES.curtainHint);
    this.game.busy = false;
  }

  async portal(id) {
    const s = this.s;
    const frag = { highway: 'tape', theater: 'key', radiator: 'seed' }[id];
    if (s.fragments.includes(frag)) await this.say(LINES.curtainDone);
    else if (this.room.lampOn || s.chapter === 'ch1') {
      this.game.audio.sfx('deny');
      return this.say(LINES.curtainLocked);
    }
    const tr = { highway: 'static', theater: 'curtain', radiator: 'zigzag' }[id];
    const shot = id === 'theater' ? 'vertigo' : 'crash';
    await this.game.goto(id, tr, shot);
  }

  async tv() {
    this.game.audio.sfx('static');
    await this.say(this.s.fragments.length === 3 ? [LINES.tvAfter] : LINES.tv);
    await this.game.goto('town', 'static');
    if (!this.s.flags.townVisited) {
      this.s.flags.townVisited = true;
      await this.say({ who: '小镇回声', text: '荧幕另一侧，小镇还没睡。去餐馆、旅馆和森林寻找三条线索。林间红幕通向来时的房间。' });
    }
  }

  async phonograph() {
    this.game.audio.sfx('reverse');
    await this.say(LINES.phonograph);
    this.game.ui.open('archive');
  }

  // ———————————————— 梦境：夜路 ————————————————
  async marker(i) {
    const hw = this.game.spaces.highway;
    if (this.s.fragments.includes('tape')) return;
    this.game.busy = true;
    await this.say({ who: '路牌', text: LINES.highwayMarker[i] });
    this.game.busy = false;
    if (i < 2) hw.advance();
    else await this.collect('tape');
  }

  // ———————————————— 梦境：寂静剧场 ————————————————
  async theaterMic() {
    const g = this.game;
    const th = g.spaces.theater;
    g.busy = true;
    await g.camera.pushIn(new THREE.Vector3(0, 2.4, -3.2), 1.2, 3, true);
    await this.say(LINES.theaterMic);
    if (!g.settings.reducedMotion) {
      g.engine.u.uWarp.value = 1;
      await g.camera.handheld(1.2, 0.8);
    }
    g.engine.u.uWarp.value = 0.25;
    if (this.s.fragments.includes('key')) {
      g.camera.release();
      g.busy = false;
      return;
    }
    await g.camera.lookAt(new THREE.Vector3(1.2, 1.05, 0), 1.5);
    g.camera.release();
    this.s.flags.micDone = true;
    g.ui.updateHud();
    th.box.visible = true;
    g.busy = false;
    await this.say(LINES.theaterBox);
  }
  async theaterBox() {
    this.game.spaces.theater.box.visible = false;
    await this.collect('key');
  }

  // ———————————————— 梦境：散热器之室 ————————————————
  async valve(i) {
    const g = this.game;
    const r = g.spaces.radiator;
    g.audio.sfx('valve');
    const res = r.turnValve(i);
    if (res === 'wrong') {
      g.audio.sfx('deny');
      await g.camera.handheld(0.5, 1.5);
      await this.say(LINES.radiatorWrong);
    } else if (res === 'solved') {
      this.s.flags.radiatorSolved = true;
      g.ui.updateHud();
      g.audio.sfx('thunk');
      g.busy = true;
      await g.camera._move({ to: new THREE.Vector3(0, 0.75, -0.3), lookAt: new THREE.Vector3(0, 0.3, -1.42), duration: 2.5, keepLock: true });
      await this.say(LINES.radiatorStage);
      g.camera.release();
      g.busy = false;
    }
  }
  async radiatorSeed() {
    await this.collect('seed');
  }

  // ———————————————— 碎片与返回 ————————————————
  async collect(id) {
    const g = this.game;
    const f = FRAGMENTS[id];
    if (this.s.fragments.includes(id)) return;
    this.s.fragments.push(id);
    for (const w of f.archive) if (!this.s.archive.includes(w)) this.s.archive.push(w);
    g.audio.sfx('pickup');
    g.audio.event('fragment');
    g.ui.updateHud();
    await this.say({ who: '', text: `你拿到了「${f.name}」。档案中解锁了 ${f.archive.length} 部作品。` });
    g.autosave();
    await wait(0.8);
    await this.returnToRoom();
  }

  async returnToRoom() {
    if (this.game.space?.id === 'redroom') return;
    this.game.engine.u.uWarp.value = 0;
    await this.game.goto('redroom', 'invert');
    if (this.s.fragments.length === 3 && this.s.chapter !== 'finale' && this.s.chapter !== 'epilogue') {
      this.room.setLamp(true);
      this.s.flags.lampOff = false;
      this.game.audio.event('lamp:on');
      await this.setChapter('finale');
      this.game.camera.focusTarget = new THREE.Vector3(-0.65, 1, -1.25);
    }
  }

  async finale() {
    const g = this.game;
    g.busy = true;
    for (const id of ['tape', 'key', 'seed']) {
      this.s.flags[`placed:${id}`] = true;
      g.audio.sfx('click');
      await wait(0.5);
    }
    g.audio.event('finale');
    this.room.finaleActive = true;
    await g.camera.overhead(new THREE.Vector3(0, 0, -0.6), 3.2, 4, true);
    await this.say(LINES.finale.slice(0, 2));
    await g.camera.orbit(new THREE.Vector3(0, 0.8, -1.3), 2.6, 1.7, Math.PI * 0.6, 7, true);
    // 不弹出名单：房间本身发生变化，玩家可以留下，也可以自己走向出口
    this.s.chapter = 'epilogue';
    this.s.archive = WORKS.map((w) => w.id);
    await this.say(LINES.finale.slice(2));
    await g.camera._move({ to: new THREE.Vector3(0, 1.6, 0.6), lookAt: new THREE.Vector3(0, 1.4, 3), duration: 3 });
    g.camera.release();
    g.ui.updateHud();
    g.autosave();
    g.busy = false;
  }

  // 尾声：走出幕布
  async leave() {
    const g = this.game;
    g.busy = true;
    await this.say(LINES.exit);
    await g.camera.pushIn(new THREE.Vector3(0, 1.5, 3), 1.2, 3, true);
    await g.transitions.out('fade', 2.5);
    g.camera.release();
    g.busy = false;
    await g.ui.endCard();
    g.toTitle();
    await g.transitions.in('fade', 2);
  }
}
