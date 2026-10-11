// 交互系统：准星射线 / 鼠标点击 / Tab 键循环聚焦，三种方式选中物件；E / Enter / 空格 使用。
import * as THREE from 'three';
import { focusMarker } from '../scenes/materials.js';

const ray = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

export class Interaction {
  constructor(game) {
    this.game = game;
    this.focused = null;
    this.tabIndex = -1;
    this.marker = focusMarker();
    this.marker.visible = false;
    game.engine.scene.add(this.marker);
    this.lastAnnounced = null;
  }
  get space() {
    return this.game.space;
  }
  candidates() {
    if (!this.space) return [];
    return this.space.interactables.filter((it) => it.enabled() && it.object.visible !== false);
  }
  _hit(ndc) {
    const cam = this.game.engine.camera;
    ray.setFromCamera(ndc, cam);
    const list = this.candidates();
    const objs = list.map((i) => i.object);
    const hits = ray.intersectObjects(objs, true);
    for (const h of hits) {
      const it = h.object.userData.interactable;
      if (it && list.includes(it) && h.distance <= it.radius) return it;
    }
    return null;
  }
  // 每帧：没有 Tab 聚焦时，用准星选中
  update() {
    if (this.game.mode !== 'play') {
      this.marker.visible = false;
      return;
    }
    if (this.tabFocus && !this.candidates().includes(this.tabFocus)) this.tabFocus = null;
    const it = this.tabFocus ?? this._hit(center);
    this.setFocus(it);
    if (it) {
      const p = this.space.worldAnchor(it);
      this.marker.position.copy(p);
      this.marker.visible = true;
      const s = 0.1 + Math.sin(performance.now() / 300) * 0.015;
      this.marker.scale.setScalar(s);
    } else this.marker.visible = false;
  }
  setFocus(it) {
    if (it === this.focused) return;
    this.focused = it;
    this.game.ui.prompt(it ? `［E］${it.label}` : '');
    if (it && it !== this.lastAnnounced) {
      this.game.ui.announce(`可交互：${it.label}`);
      this.lastAnnounced = it;
    }
  }
  cycle(dir = 1) {
    const list = this.candidates();
    if (!list.length) return;
    const cam = this.game.engine.camera.position;
    // 按距离排序，Tab 从近到远
    list.sort((a, b) => this.space.worldAnchor(a).distanceTo(cam) - this.space.worldAnchor(b).distanceTo(cam));
    const i = list.indexOf(this.tabFocus);
    const next = list[(i + dir + list.length) % list.length];
    this.tabFocus = next;
    this.setFocus(next);
    this.game.camera.focusTarget = this.space.worldAnchor(next);
  }
  clickAt(clientX, clientY) {
    const ndc = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    const it = this._hit(ndc);
    if (it) this.use(it);
  }
  use(it = this.focused) {
    if (!it || this.game.busy) return;
    this.game.audio.sfx('click');
    // Keep keyboard selection stable so repeated use targets the same object.
    this.game.discover(it);
    it.use();
  }
  clearTab() {
    this.tabFocus = null;
  }
}
