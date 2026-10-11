import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Space } from './space.js';
import { curtainMaterial, curtainWall, chevronTexture, std } from './materials.js';
import { LINES } from '../content/chapters.js';

const FRAG_OF = { highway: 'tape', theater: 'key', radiator: 'seed' };

const W = 6, D = 6, H = 3.4;

export class RedRoom extends Space {
  constructor(game) {
    super(game, 'redroom');
    this.bounds = { minX: -2.55, maxX: 2.55, minZ: -2.55, maxZ: 2.55 };
    this.spawn = { pos: new THREE.Vector3(0, 1.6, 2.2), yaw: 0 };
    this.background = new THREE.Color(0x050000);
    this.fog = new THREE.FogExp2(0x0a0101, 0.06);
    this.lampOn = true;
    this.flow = 0;
    this.finaleActive = false;
  }

  build() {
    const r = this.root;
    const seg = this.game.engine.q.curtainSeg;
    // 幕布（四面）
    this.curtainMat = curtainMaterial(0x7a080c, { time: this.time });
    const walls = [
      [0, -D / 2 + 0.05, 0],
      [-W / 2 + 0.05, 0, Math.PI / 2],
      [W / 2 - 0.05, 0, -Math.PI / 2],
      [0, D / 2 - 0.05, Math.PI],
    ];
    for (const [x, z, ry] of walls) {
      const c = curtainWall(W, H, this.curtainMat, seg);
      c.position.set(x, 0, z);
      c.rotation.y = ry;
      r.add(c);
    }
    // 地板
    this.floorTex = chevronTexture(512, 8);
    this.floorTex.repeat.set(1.5, 1.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0xffffff, { map: this.floorTex, roughness: 0.35 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    r.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0x0a0606, { roughness: 1 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = H;
    r.add(ceil);

    this._buildChair();
    this._buildLamp();
    this._buildTable();
    this._buildPhonograph();
    this._buildPortals();
    this._buildTV();
    this._buildExit();

    // 灯光（全部预先创建，仅改变强度，避免着色器重编译）
    this.hemi = new THREE.HemisphereLight(0x5a1010, 0x050505, 0.35);
    r.add(this.hemi);
    this.key = new THREE.SpotLight(0xffe2c0, 18, 12, 0.55, 0.6, 1.6);
    this.key.position.set(0.4, H - 0.1, 1.2);
    this.key.target.position.set(0, 0.4, -1.2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0008;
    r.add(this.key, this.key.target);
    const rim = new THREE.PointLight(0xc7d0ce, 2.5, 7, 2);
    rim.position.set(2.1, 2.7, -0.1);
    r.add(rim);
  }

  _buildChair() {
    const leather = std(0x1b1e1c, { roughness: 0.42, metalness: 0.05 });
    const trim = std(0x5a0c0c, { roughness: 0.5 });
    const g = new THREE.Group();
    const box = (w, h, d, x, y, z, m = leather) => {
      const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.3), m);
      b.position.set(x, y, z);
      b.castShadow = b.receiveShadow = true;
      g.add(b);
      return b;
    };
    box(1.0, 0.42, 0.85, 0, 0.27, 0);
    box(0.62, 0.16, 0.66, 0, 0.55, 0.05);
    box(1.0, 0.8, 0.26, 0, 0.82, -0.32);
    box(0.22, 0.6, 0.88, -0.44, 0.47, 0.01);
    box(0.22, 0.6, 0.88, 0.44, 0.47, 0.01);
    box(0.03, 0.42, 0.04, -0.555, 0.4, 0.43, trim);
    box(0.03, 0.42, 0.04, 0.555, 0.4, 0.43, trim);
    g.position.set(0.5, 0, -1.35);
    this.root.add(g);
    this.chair = g;
    this.colliders.push({ x: 0.5, z: -1.35, r: 0.55 });
    this.add(g, { id: 'armchair', label: '扶手椅', use: () => this.game.story.armchair(), anchor: new THREE.Vector3(0, 1.35, 0) });
  }

  _buildLamp() {
    const metal = std(0x9a9a9a, { metalness: 0.9, roughness: 0.25 });
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 32), metal);
    base.position.y = 0.02;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.1, 12), metal);
    pole.position.y = 1.07;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.36, 32, 1, true), std(0xd8d8d0, { side: THREE.DoubleSide, metalness: 0.6, roughness: 0.3 }));
    shade.rotation.x = Math.PI;
    shade.position.y = 2.2;
    this.bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), this.bulbMat);
    bulb.position.y = 2.25;
    for (const m of [base, pole, shade]) m.castShadow = true;
    g.add(base, pole, shade, bulb);
    this.lampLight = new THREE.PointLight(0xffd9a0, 6, 9, 1.4);
    this.lampLight.position.y = 2.32;
    g.add(this.lampLight);
    g.position.set(1.75, 0, -2.2);
    this.root.add(g);
    this.lamp = g;
    this.colliders.push({ x: 1.75, z: -2.2, r: 0.2 });
    this.add(g, { id: 'lamp', label: this.lampOn ? '落地灯（关灯）' : '落地灯（开灯）', use: () => this.game.story.toggleLamp(), anchor: new THREE.Vector3(0, 1.4, 0) });
  }

  _buildTable() {
    const chrome = std(0xcfcfcf, { metalness: 1, roughness: 0.18 });
    const g = new THREE.Group();
    for (const [x, z] of [[-0.24, -0.2], [0.24, -0.2], [-0.24, 0.2], [0.24, 0.2]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.58, 8), chrome);
      leg.position.set(x, 0.29, z);
      g.add(leg);
    }
    for (const y of [0.12, 0.3]) {
      for (const z of [-0.2, 0.2]) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.48, 6), chrome);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, y, z);
        g.add(bar);
      }
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.48), new THREE.MeshPhysicalMaterial({ color: 0xbfd8d0, transmission: 0.6, roughness: 0.05, thickness: 0.02, transparent: true, opacity: 0.7 }));
    top.position.y = 0.59;
    g.add(top);
    // 戴土星环的绿色小雕像
    const green = std(0x7fae6a, { roughness: 0.45 });
    const dark = std(0x2f4a2a, { roughness: 0.5 });
    const statue = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.055 - i * 0.004, 0.06 - i * 0.004, 0.045, 20), i % 2 ? dark : green);
      s.position.y = 0.03 + i * 0.045;
      statue.add(s);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), green);
    head.position.y = 0.33;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 8, 48), std(0xc9d7a9, { roughness: 0.4 }));
    ring.position.y = 0.33;
    ring.rotation.x = Math.PI / 2 - 0.35;
    statue.add(head, ring);
    statue.position.y = 0.6;
    statue.traverse((o) => (o.castShadow = true));
    g.add(statue);
    this.statue = statue;
    // 三个凹槽（碎片放置点）
    this.slots = ['tape', 'key', 'seed'].map((id, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.06), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000 }));
      m.position.set(-0.17 + i * 0.17, 0.61, 0.17);
      m.userData.fragment = id;
      g.add(m);
      return m;
    });
    g.position.set(-0.65, 0, -1.25);
    this.root.add(g);
    this.table = g;
    this.colliders.push({ x: -0.65, z: -1.25, r: 0.35 });
    this.add(g, { id: 'statue', label: '小桌与雕像', use: () => this.game.story.statue(), anchor: new THREE.Vector3(0, 1.15, 0) });
  }

  _buildPhonograph() {
    const wood = std(0x2a160d, { roughness: 0.55 });
    const brass = std(0xb08a3c, { metalness: 0.9, roughness: 0.3 });
    const g = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 0.45), wood);
    stand.position.y = 0.4;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.4), wood);
    box.position.y = 0.87;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 32), std(0x080808, { roughness: 0.2 }));
    disc.position.y = 0.945;
    this.disc = disc;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 32, 1, true), std(0xb08a3c, { metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
    horn.position.set(0.1, 1.25, -0.05);
    horn.rotation.z = -0.9;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 8), brass);
    neck.position.set(-0.05, 1.05, -0.05);
    neck.rotation.z = -0.9;
    g.add(stand, box, disc, horn, neck);
    g.traverse((o) => (o.castShadow = true));
    g.position.set(-2.15, 0, 1.4);
    g.rotation.y = Math.PI / 3;
    this.root.add(g);
    this.colliders.push({ x: -2.15, z: 1.4, r: 0.35 });
    this.add(g, { id: 'phonograph', label: '留声机（档案）', use: () => this.game.story.phonograph(), anchor: new THREE.Vector3(0, 1.6, 0) });
  }

  _buildPortals() {
    this.portals = {};
    const defs = [
      ['highway', '幕布缝隙 · 夜路', new THREE.Vector3(-W / 2 + 0.2, 0, -0.6), Math.PI / 2],
      ['theater', '幕布缝隙 · 剧场', new THREE.Vector3(-1.6, 0, -D / 2 + 0.2), 0],
      ['radiator', '幕布缝隙 · 散热器', new THREE.Vector3(W / 2 - 0.2, 0, 0.4), -Math.PI / 2],
    ];
    for (const [id, label, pos, ry] of defs) {
      const g = new THREE.Group();
      g.position.copy(pos);
      g.rotation.y = ry;
      const mat = new THREE.MeshBasicMaterial({ color: 0xfff0d8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 2.8), mat);
      glow.position.y = 1.4;
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3), new THREE.MeshBasicMaterial({ color: 0xff7a4a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.position.set(0, 1.45, -0.01);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 0.2), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1.3;
      const light = new THREE.PointLight(0xffb48a, 0, 3, 2);
      light.position.set(0, 1.5, 0.3);
      g.add(glow, halo, hit, light);
      this.root.add(g);
      this.portals[id] = { g, mat, halo: halo.material, light, open: 0 };
      this.add(g, { id: `portal:${id}`, label, use: () => this.game.story.portal(id), anchor: new THREE.Vector3(0, 1.5, 0.3) });
    }
  }

  _buildTV() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.44, 0.44, 2, 0.04), std(0x2a1d14, { roughness: 0.6 }));
    body.position.y = 0.22;
    this.tvU = { uTime: this.time, uCalm: { value: 0 } };
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.3),
      new THREE.ShaderMaterial({
        uniforms: this.tvU,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uTime; uniform float uCalm; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
          void main(){
            vec2 c = vUv - 0.5;
            float n = h(floor(vUv * vec2(160.0, 120.0)) + floor(uTime * 24.0));
            float roll = 0.85 + 0.15 * sin(vUv.y * 300.0 + uTime * 30.0);
            vec3 col = vec3(n * roll * mix(0.75, 0.25, uCalm));
            col += uCalm * vec3(0.35, 0.05, 0.05) * smoothstep(0.5, 0.0, length(c));
            col *= smoothstep(0.62, 0.35, length(c * vec2(1.0, 1.3)));
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    screen.position.set(0, 0.24, 0.221);
    this.tvLight = new THREE.PointLight(0xaab8ff, 0.6, 2.2, 2);
    this.tvLight.position.set(0, 0.3, 0.45);
    g.add(body, screen, this.tvLight);
    g.position.set(2.05, 0, 1.95);
    g.rotation.y = -Math.PI * 0.75;
    body.castShadow = true;
    this.root.add(g);
    this.colliders.push({ x: 2.05, z: 1.95, r: 0.35 });
    this.add(g, { id: 'tv', label: '电视 · 进入小镇回声', use: () => this.game.story.tv(), anchor: new THREE.Vector3(0, 0.7, 0) });
  }

  _buildExit() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0, depthWrite: false });
    const gap = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.7), mat);
    gap.position.y = 1.35;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1, 2.6, 0.2), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.3;
    this.exitLight = new THREE.PointLight(0x9fb4ff, 0, 4, 2);
    this.exitLight.position.set(0, 1.6, -0.4);
    g.add(gap, hit, this.exitLight);
    g.position.set(0, 0, D / 2 - 0.12);
    g.rotation.y = Math.PI;
    this.exitMat = mat;
    this.exitDoor = g;
    this.root.add(g);
    this.add(g, { id: 'exit', label: '幕布的开口（出口）', use: () => this.game.story.leave(), enabled: () => this.game.state.chapter === 'epilogue', anchor: new THREE.Vector3(0, 1.5, 0) });
  }

  setLamp(on) {
    this.lampOn = on;
    const it = this.interactables.find((i) => i.id === 'lamp');
    if (it) it.label = on ? '落地灯（关灯）' : '落地灯（开灯）';
  }

  enter() {
    super.enter();
    this.game.camera.bounds = this.bounds;
    this.game.camera.colliders = this.colliders;
  }

  startAmbience() {
    const a = this.game.audio;
    this.hum = a.spatial('hum', new THREE.Vector3(1.75, 2.2, -2.2), 0.7, '［灯泡低声嗡鸣］');
    a.spatial('roomtone', null, 0.6);
    a.spatial('rustle', null, 0.8);
    a.spatial('murmur', new THREE.Vector3(0, 1.6, -3.6), 0.06);
    this.portalSounds = {};
  }

  // 熄灯后，每道缝隙发出不同的声音；玩家需要循声找到它们
  _portalAudio() {
    const st = this.game.state;
    const a = this.game.audio;
    if (!a.ready || !this.portalSounds) return;
    const defs = {
      highway: ['engine', 0.55, '［左侧幕布后：引擎的低吼］'],
      theater: ['murmur', 0.6, '［正前方幕布后：空剧场里的人声］'],
      radiator: ['hiss', 1.0, '［右侧幕布后：蒸汽嘶嘶作响］'],
    };
    for (const [id, [type, gain, cap]] of Object.entries(defs)) {
      const done = st.fragments.includes(FRAG_OF[id]);
      const want = !this.lampOn && st.chapter !== 'ch1' && !done && this.game.mode !== 'title';
      const h = this.portalSounds[id];
      if (want && !h) this.portalSounds[id] = a.spatial(type, this.portals[id].g.position.clone().setY(1.5), gain, cap);
      else if (!want && h) {
        h.stop(0.8);
        delete this.portalSounds[id];
      }
    }
  }

  update(dt, t) {
    super.update(dt, t);
    const st = this.game.state;
    const rm = this.game.settings.reducedMotion;
    this.curtainMat.userData.uSway.value = rm ? 0.3 : 1;
    // 灯：开启时偶尔轻微闪烁（亮度只下降 40%，且每秒不超过 3 次）
    const cam = this.game.engine.camera.position;
    const nearLamp = Math.hypot(cam.x - 1.75, cam.z + 2.2) < 1.5;
    if (nearLamp && !st.flags.lampNear && this.game.mode === 'play') {
      st.flags.lampNear = true;
      this.game.ui.subtitle(LINES.lampNear, 'speech', 5000);
    }
    let target = this.lampOn ? (nearLamp ? 7.5 : 6) : 0;
    if (this.lampOn && !this.game.settings.reducedFlashing) {
      this._flickT = (this._flickT ?? 4) - dt;
      if (this._flickT < 0) {
        this._flickT = 6 + Math.random() * 10;
        this._flickUntil = t + 0.6;
        this.game.audio.sfx('flicker');
      }
      if (t < (this._flickUntil ?? 0)) target *= 0.6 + 0.4 * (Math.sin(t * 18) > 0 ? 1 : 0.2);
    }
    this.lampLight.intensity += (target - this.lampLight.intensity) * Math.min(1, dt * 12);
    this.bulbMat.color.setScalar(0.15 + this.lampLight.intensity / 7);
    this.key.intensity += ((this.lampOn ? 18 : 3) - this.key.intensity) * Math.min(1, dt * 4);
    this.hemi.intensity += ((this.lampOn ? 0.35 : 0.12) - this.hemi.intensity) * Math.min(1, dt * 4);
    this.hum?.setGain?.(this.lampOn ? 0.7 : 0.05);

    // 幕布缝隙：熄灯后显现；已完成的梦境保持暗淡
    this._portalAudio();
    const listening = this.game.audio.listening;
    for (const [id, p] of Object.entries(this.portals)) {
      const done = st.fragments.includes(FRAG_OF[id]);
      const d = Math.hypot(cam.x - p.g.position.x, cam.z - p.g.position.z);
      let near = THREE.MathUtils.clamp((3.0 - d) / 1.8, 0, 1);
      if (listening) near = Math.max(near, THREE.MathUtils.clamp((5.5 - d) / 3, 0, 1));
      const dark = !this.lampOn && st.chapter !== 'ch1';
      const visible = !dark ? 0 : done ? 0.25 : Math.max(0.08, near);
      p.open += (visible - p.open) * Math.min(1, dt * 2);
      const pulse = 0.85 + 0.15 * Math.sin(t * 2 + id.length);
      p.mat.opacity = p.open * pulse;
      p.halo.opacity = p.open * 0.25 * pulse;
      p.light.intensity = p.open * 1.5;
    }
    // 留声机唱片旋转
    this.disc.rotation.y += dt * 0.6;
    // 碎片凹槽发光
    for (const s of this.slots) {
      const placed = st.flags[`placed:${s.userData.fragment}`];
      s.material.emissive.setHex(placed ? 0xffc890 : st.fragments.includes(s.userData.fragment) ? 0x331a08 : 0x000000);
    }
    // 电视
    this.tvU.uCalm.value += ((st.fragments.length === 3 ? 1 : 0) - this.tvU.uCalm.value) * Math.min(1, dt);
    this.tvLight.intensity = 0.5 + Math.sin(t * 13) * 0.08;
    // 尾声：房间发生变化——灯色变冷、幕布几乎静止、椅子转向出口、正对面的幕布拉开
    const epi = st.chapter === 'epilogue' ? 1 : 0;
    this.epi = (this.epi ?? 0) + (epi - (this.epi ?? 0)) * Math.min(1, dt * 0.5);
    this.lampLight.color.setRGB(1 - this.epi * 0.35, 0.85 - this.epi * 0.1, 0.63 + this.epi * 0.37);
    this.curtainMat.userData.uSway.value *= 1 - this.epi * 0.8;
    this.chair.rotation.y = this.epi * 0.35;
    this.exitMat.opacity = this.epi * (0.75 + 0.1 * Math.sin(t * 0.8));
    this.exitLight.intensity = this.epi * 2.2;
    // 终章：Z 字地板流动
    if (this.finaleActive) {
      this.flow += dt * (rm ? 0.02 : 0.08);
      this.floorTex.offset.set(0, this.flow);
    }
  }
}
