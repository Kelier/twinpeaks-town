import * as THREE from 'three';

// 空间基类：每个可切换的场景（红房间、三个梦境）都继承它。
export class Space {
  constructor(game, id) {
    this.game = game;
    this.id = id;
    this.root = new THREE.Group();
    this.root.name = id;
    this.interactables = [];
    this.colliders = [];
    this.bounds = { minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 };
    this.spawn = { pos: new THREE.Vector3(0, 1.6, 2), yaw: 0 };
    this.fog = null;
    this.background = new THREE.Color(0x000000);
    this.ambient = [];
    this.built = false;
    this.time = { value: 0 };
  }
  ensureBuilt() {
    if (!this.built) {
      this.build();
      this.built = true;
    }
  }
  build() {}
  // 注册可交互物件
  add(obj, { id, label, use, enabled = () => true, radius = 3, anchor }) {
    const it = { id, label, object: obj, use, enabled, radius, anchor: anchor ?? new THREE.Vector3(0, 0.3, 0) };
    obj.traverse((o) => (o.userData.interactable = it));
    this.interactables.push(it);
    return it;
  }
  worldAnchor(it) {
    return it.object.localToWorld(it.anchor.clone());
  }
  enter() {
    this.game.engine.scene.fog = this.fog;
    this.game.engine.scene.background = this.background;
  }
  startAmbience() {}
  exit() {
    this.game.audio.stopAllSpatial(1);
  }
  update(dt, t) {
    this.time.value = t;
  }
  setQuality() {}
  dispose() {
    this.root.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
  }
}
