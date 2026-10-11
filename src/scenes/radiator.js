import * as THREE from 'three';
import { Space } from './space.js';
import { textTexture, curtainMaterial, curtainWall, std } from './materials.js';

// 梦境 C · 散热器之室：低矮的工业房间。按“先低后高”的顺序拧紧三个阀门，散热器后会露出一座小舞台。
export class RadiatorRoom extends Space {
  constructor(game) {
    super(game, 'radiator');
    this.background = new THREE.Color(0x020202);
    this.fog = new THREE.FogExp2(0x0b0b09, 0.12);
    this.spawn = { pos: new THREE.Vector3(0, 1.6, 2), yaw: 0 };
    this.bounds = { minX: -1.8, maxX: 1.8, minZ: -0.9, maxZ: 2.2 };
    this.order = [];
    this.SOLUTION = [0, 2, 1]; // 阀门编号按左→右；高度：0 低、2 中、1 高
  }
  build() {
    const r = this.root;
    const concrete = std(0x3a3833, { roughness: 0.95 });
    const W = 4.4, D = 4, H = 2.5;
    const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 1, side: THREE.BackSide }));
    box.position.set(0, H / 2, 0.5);
    box.receiveShadow = true;
    r.add(box);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0x1a1916, { roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.001, 0.5);
    r.add(floor);

    // 管道
    const pipeMat = std(0x4b3d2c, { metalness: 0.7, roughness: 0.55 });
    const pipe = (len, x, y, z, rx = 0, rz = 0, rad = 0.05) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 10), pipeMat);
      p.position.set(x, y, z);
      p.rotation.set(rx, 0, rz);
      p.castShadow = true;
      r.add(p);
    };
    pipe(W, 0, 2.25, -1.35, 0, Math.PI / 2, 0.07);
    pipe(W, 0, 2.05, -1.38, 0, Math.PI / 2, 0.04);
    pipe(2.3, -2.05, 1.15, -1.3);
    pipe(2.3, 2.05, 1.15, -0.6);
    pipe(D, 1.95, 2.3, 0.5, Math.PI / 2, 0, 0.05);

    // 散热器（实例化格栅）
    const fins = 14;
    const finMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.8, 0.16), std(0x8c8a80, { metalness: 0.6, roughness: 0.45 }), fins);
    const m = new THREE.Matrix4();
    for (let i = 0; i < fins; i++) {
      m.makeTranslation(-0.6 + i * 0.092, 0.55, -1.3);
      finMesh.setMatrixAt(i, m);
    }
    finMesh.castShadow = true;
    this.fins = finMesh;
    r.add(finMesh);
    // 散热器后的小舞台
    const stage = new THREE.Group();
    const floorS = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.35), std(0xd8d8d0));
    floorS.position.y = 0.2;
    this.miniCurtain = curtainMaterial(0x7a080c, { time: this.time });
    const cur = curtainWall(1.1, 0.7, this.miniCurtain, 60);
    cur.scale.z = 0.2;
    cur.position.set(0, 0.22, -0.15);
    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), std(0xe8dcb0, { emissive: 0x3a2a10, roughness: 0.4 }));
    seed.position.set(0, 0.26, 0.02);
    this.seed = seed;
    this.stageLight = new THREE.PointLight(0xfff0c8, 0, 1.5, 2);
    this.stageLight.position.set(0, 0.7, 0.2);
    stage.add(floorS, cur, seed, this.stageLight);
    stage.position.set(0, 0, -1.42);
    r.add(stage);
    this.stage = stage;
    this.add(seed, { id: 'seed', label: '小舞台上的种子', use: () => this.game.story.radiatorSeed(), enabled: () => this.game.state.flags.radiatorSolved && !this.game.state.fragments.includes('seed'), anchor: new THREE.Vector3(0, 0.1, 0) });

    // 三个阀门：高度分别为 低 / 高 / 中
    const heights = [0.6, 1.9, 1.25];
    const colors = [0x8a2a1a, 0x2a5a8a, 0x8a7a2a];
    this.valves = heights.map((h, i) => {
      const g = new THREE.Group();
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 24), std(colors[i], { metalness: 0.5, roughness: 0.4 }));
      const spoke1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.02), std(colors[i]));
      const spoke2 = spoke1.clone();
      spoke2.rotation.z = Math.PI / 2;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8), pipeMat);
      stem.rotation.x = Math.PI / 2;
      stem.position.z = -0.075;
      g.add(wheel, spoke1, spoke2, stem);
      g.position.set(-1.4 + i * 1.4 + (i === 1 ? 0.0 : 0), h, -1.3);
      if (i === 1) g.position.x = 1.45;
      if (i === 2) g.position.x = 0.95;
      if (i === 0) g.position.x = -1.3;
      r.add(g);
      this.add(g, { id: `valve:${i}`, label: `阀门（${['红', '蓝', '黄'][i]}）`, use: () => this.game.story.valve(i), enabled: () => !this.game.state.flags.radiatorSolved, anchor: new THREE.Vector3(0, 0.2, 0.1) });
      return g;
    });
    // 墙上的粉笔字提示
    const chalk = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: textTexture(['蒸汽往上走，', '你从下面开始。'], { bg: null, fg: '#d8d4c4', font: '40px serif' }), transparent: true, opacity: 0.75 }));
    chalk.position.set(-2.18, 1.5, 0.6);
    chalk.rotation.y = Math.PI / 2;
    r.add(chalk);
    this.add(chalk, { id: 'chalk', label: '墙上的粉笔字', use: () => this.game.story.say({ who: '粉笔字', text: '“蒸汽往上走，你从下面开始。”' }), anchor: new THREE.Vector3(0, 0.4, 0) });

    // 蒸汽粒子
    const n = 220;
    const pg = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    this.steamSeeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() - 0.5) * 1.3, Math.random() * 1.8, -1.2 + Math.random() * 0.3], i * 3);
      this.steamSeeds[i] = Math.random();
    }
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const steamMat = new THREE.PointsMaterial({ color: 0xcfcfc8, size: 0.22, transparent: true, opacity: 0.18, depthWrite: false });
    steamMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_particle_fragment>', `
        #include <map_particle_fragment>
        float steamRadius = length(gl_PointCoord - vec2(0.5));
        diffuseColor.a *= 1.0 - smoothstep(0.05, 0.5, steamRadius);
      `);
    };
    this.steam = new THREE.Points(pg, steamMat);
    r.add(this.steam);

    // 裸灯泡
    this.bulb = new THREE.PointLight(0xffe0a8, 5, 7, 1.6);
    this.bulb.position.set(0, 2.2, 0.6);
    this.bulb.castShadow = true;
    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0d0 }));
    bulbMesh.position.copy(this.bulb.position);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.28, 4), std(0x111111));
    cord.position.set(0, 2.38, 0.6);
    r.add(this.bulb, bulbMesh, cord, new THREE.AmbientLight(0x2a2620, 0.5));
  }
  enter() {
    super.enter();
    this.game.camera.bounds = this.bounds;
    this.game.camera.colliders = [];
    this.order = [];
    this._applySolved(!!this.game.state.flags.radiatorSolved, true);
  }
  _applySolved(solved, instant) {
    this.solved = solved;
    this.fins.visible = !solved;
    this.seed.visible = !this.game.state.fragments.includes('seed');
    if (instant) this.stageLight.intensity = solved ? 1.2 : 0;
  }
  turnValve(i) {
    this.valves[i].userData.turn = (this.valves[i].userData.turn ?? 0) + Math.PI;
    this.order.push(i);
    const ok = this.SOLUTION.slice(0, this.order.length).every((v, k) => v === this.order[k]);
    if (!ok) {
      this.order = [];
      this.valves.forEach((v) => (v.userData.turn = 0));
      return 'wrong';
    }
    if (this.order.length === 3) {
      this._applySolved(true);
      return 'solved';
    }
    return 'progress';
  }
  startAmbience() {
    const a = this.game.audio;
    this.hiss = a.spatial('hiss', new THREE.Vector3(0, 0.8, -1.3), 1, '［散热器嘶嘶作响］');
    a.spatial('drip', new THREE.Vector3(2, 2, 1), 0.6, '［水滴落在铁皮上］');
    a.spatial('roomtone', null, 0.5);
  }
  update(dt, t) {
    super.update(dt, t);
    for (const v of this.valves) v.rotation.z += ((v.userData.turn ?? 0) - v.rotation.z) * Math.min(1, dt * 6);
    const p = this.steam.geometry.attributes.position;
    const intensity = this.solved ? 0.15 : 1;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (0.3 + this.steamSeeds[i] * 0.4) * intensity;
      if (y > 2.2) y = 0.2;
      p.setY(i, y);
    }
    p.needsUpdate = true;
    this.steam.material.opacity = 0.05 + 0.13 * intensity;
    this.hiss?.setGain(this.solved ? 0.08 : 1);
    if (this.solved) this.stageLight.intensity += (1.2 - this.stageLight.intensity) * Math.min(1, dt * 2);
    if (!this.game.settings.reducedFlashing) this.bulb.intensity = 5 + Math.sin(t * 1.3) * 0.4 + (Math.random() < 0.01 ? -1.5 : 0);
  }
}
