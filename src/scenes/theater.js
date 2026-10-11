import * as THREE from 'three';
import { Space } from './space.js';
import { curtainMaterial, curtainWall, std } from './materials.js';

// 梦境 B · 寂静剧场：蓝色调的空剧场，舞台上一支麦克风；歌声没有歌者。
export class Theater extends Space {
  constructor(game) {
    super(game, 'theater');
    this.background = new THREE.Color(0x01020a);
    this.fog = new THREE.FogExp2(0x02040f, 0.05);
    this.spawn = { pos: new THREE.Vector3(0, 1.6, 6), yaw: 0 };
    this.bounds = { minX: -1, maxX: 1, minZ: -1.6, maxZ: 6.5 };
  }
  build() {
    const r = this.root;
    const seg = this.game.engine.q.curtainSeg;
    // 舞台
    const stage = new THREE.Mesh(new THREE.BoxGeometry(10, 0.9, 4), std(0x1a0f0a, { roughness: 0.5 }));
    stage.position.set(0, 0.45, -4);
    stage.receiveShadow = true;
    r.add(stage);
    // 舞台后幕（深红）与两侧蓝色天鹅绒墙
    this.redMat = curtainMaterial(0x5e050a, { time: this.time });
    const back = curtainWall(10, 6, this.redMat, seg);
    back.position.set(0, 0.9, -5.9);
    r.add(back);
    this.blueMat = curtainMaterial(0x0b1a5e, { time: this.time, sheen: 0.9 });
    for (const s of [-1, 1]) {
      const wall = curtainWall(14, 7, this.blueMat, seg * 0.7);
      wall.position.set(s * 5, 0, 1);
      wall.rotation.y = -s * Math.PI / 2;
      r.add(wall);
    }
    // 台口拱
    const arch = std(0x2a1a08, { metalness: 0.6, roughness: 0.4 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.6, 0.4), arch);
    top.position.set(0, 5.4, -2);
    r.add(top);
    for (const s of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.4, 0.4), arch);
      col.position.set(s * 5, 2.7, -2);
      r.add(col);
    }
    // 观众席（实例化座椅）
    const seatGeo = new THREE.BoxGeometry(0.5, 0.9, 0.5);
    const seatMat = std(0x3a0710, { roughness: 0.7 });
    const rows = 7, perSide = 6;
    const inst = new THREE.InstancedMesh(seatGeo, seatMat, rows * perSide * 2);
    const m = new THREE.Matrix4();
    let k = 0;
    for (let row = 0; row < rows; row++) {
      for (let s = 0; s < perSide; s++) {
        for (const side of [-1, 1]) {
          m.makeTranslation(side * (1.5 + s * 0.6), 0.45 + row * 0.12, row * 0.9);
          inst.setMatrixAt(k++, m);
        }
      }
    }
    r.add(inst);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 16), std(0x0c0710, { roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 2;
    r.add(floor);

    // 麦克风
    const mic = new THREE.Group();
    const metal = std(0xb8b8c0, { metalness: 1, roughness: 0.25 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 8), metal);
    pole.position.y = 0.75;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 24), metal);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), std(0x333336, { metalness: 0.8, roughness: 0.5 }));
    head.position.y = 1.52;
    mic.add(pole, base, head);
    mic.position.set(0, 0.9, -3.2);
    r.add(mic);
    this.mic = mic;
    this.add(mic, { id: 'mic', label: '舞台上的麦克风', use: () => this.game.story.theaterMic(), radius: 6, anchor: new THREE.Vector3(0, 1.6, 0) });

    // 蓝色小盒子（麦克风交互后出现在第一排扶手上）
    const box = new THREE.Group();
    const bm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), std(0x1438c8, { roughness: 0.25, metalness: 0.2, emissive: 0x050f40 }));
    const keyMesh = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 16), std(0x6aa0ff, { metalness: 1, roughness: 0.2, emissive: 0x112266 }));
    keyMesh.position.set(0, 0, 0.09);
    box.add(bm, keyMesh);
    box.position.set(1.2, 1.05, 0);
    box.visible = false;
    r.add(box);
    this.box = box;
    this.add(box, { id: 'bluebox', label: '蓝色小盒子', use: () => this.game.story.theaterBox(), enabled: () => box.visible, anchor: new THREE.Vector3(0, 0.2, 0) });

    // 灯光
    r.add(new THREE.HemisphereLight(0x8d9ab4, 0x271620, 1.6));
    const curtainWash = new THREE.PointLight(0xff967d, 38, 13, 1.5);
    curtainWash.position.set(0, 3.2, -3.8);
    const audienceFill = new THREE.PointLight(0x7199e6, 16, 15, 1.3);
    audienceFill.position.set(0, 3.5, 3);
    r.add(curtainWash, audienceFill);
    for (const side of [-1, 1]) {
      for (let row=0; row<7; row++) {
        const guide = new THREE.Mesh(new THREE.BoxGeometry(.035,.035,.48), new THREE.MeshBasicMaterial({color:0x456ca6}));
        guide.position.set(side*1.12,.05,row*.9);r.add(guide);
      }
    }

    this.spot = new THREE.SpotLight(0x8fb0ff, 60, 20, 0.4, 0.6, 1.2);
    this.spot.position.set(0, 7, 2);
    this.spot.target = mic;
    this.spot.castShadow = true;
    r.add(this.spot);
    this.boxLight = new THREE.PointLight(0x4f7aff, 0, 3, 2);
    this.boxLight.position.set(1.2, 1.6, 0.2);
    r.add(this.boxLight);
  }
  enter() {
    super.enter();
    this.game.camera.bounds = this.bounds;
    this.game.camera.colliders = [];
    this.box.visible = !!this.game.state.flags.micDone && !this.game.state.fragments.includes('key');
  }
  startAmbience() {
    const a = this.game.audio;
    a.spatial('roomtone', null, 0.5);
    a.spatial('murmur', new THREE.Vector3(0, 1.4, 4), 0.08, '［空座位间若有若无的人声］');
  }
  update(dt, t) {
    super.update(dt, t);
    this.boxLight.intensity = this.box.visible ? 1.5 + Math.sin(t * 2) * 0.4 : 0;
    if (this.box.visible) this.box.rotation.y += dt * 0.5;
    this.spot.intensity = 60 + (this.game.settings.reducedMotion ? 0 : Math.sin(t * 0.7) * 6);
  }
}
