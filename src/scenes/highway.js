import * as THREE from 'three';
import { Space } from './space.js';
import { textTexture, std } from './materials.js';

// 梦境 A · 夜路：车在无尽的公路上前进，三块路牌依次出现。
export class Highway extends Space {
  constructor(game) {
    super(game, 'highway');
    this.background = new THREE.Color(0x000000);
    this.fog = new THREE.Fog(0x000000, 6, 48);
    this.spawn = { pos: new THREE.Vector3(-0.45, 1.25, 0), yaw: 0 };
    this.bounds = { minX: -0.45, maxX: -0.45, minZ: 0, maxZ: 0 };
    this.speed = 14;
    this.markerIndex = 0;
    this.distance = 0;
  }
  build() {
    const r = this.root;
    // 路面：着色器滚动黄色中线
    this.roadU = { uTime: this.time, uOffset: { value: 0 } };
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 120, 1, 1),
      new THREE.ShaderMaterial({
        uniforms: { ...this.roadU, fogColor: { value: new THREE.Color(0) }, fogNear: { value: 6 }, fogFar: { value: 48 } },
        fog: true,
        vertexShader: `varying vec2 vUv; varying float vDepth;
          #include <fog_pars_vertex>
          void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition; vDepth = -mvPosition.z;
          #include <fog_vertex>
          }`,
        fragmentShader: `uniform float uOffset; varying vec2 vUv;
          #include <fog_pars_fragment>
          float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
          void main(){
            float x = vUv.x * 9.0 - 4.5;
            float y = vUv.y * 120.0 + uOffset;
            vec3 asphalt = vec3(0.05) + hash(floor(vec2(x, y) * 40.0)) * 0.025;
            float dash = step(0.5, fract(y / 6.0)) * (1.0 - smoothstep(0.05, 0.09, abs(x)));
            float edge = 1.0 - smoothstep(0.05, 0.08, abs(abs(x) - 3.6));
            vec3 col = mix(asphalt, vec3(0.95, 0.72, 0.1), dash);
            col = mix(col, vec3(0.7), edge * 0.8);
            gl_FragColor = vec4(col, 1.0);
            #include <fog_fragment>
          }`,
      }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = -55;
    r.add(road);
    // 路边的泥土与草
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(80, 120), std(0x0b0a07, { roughness: 1 }));
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(0, -0.02, -55);
    r.add(shoulder);

    // 车头灯
    this.head = new THREE.SpotLight(0xfff2cc, 60, 50, 0.42, 0.5, 1.3);
    this.head.position.set(-0.45, 0.8, 0.5);
    this.head.target.position.set(-0.2, 0, -20);
    r.add(this.head, this.head.target);
    r.add(new THREE.AmbientLight(0x101018, 0.4));
    // 仪表盘的微光
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 0.6), std(0x080808, { roughness: 0.8 }));
    dash.position.set(-0.45, 0.88, -0.7);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.06), new THREE.MeshBasicMaterial({ color: 0x55ff99 }));
    glow.position.set(-0.75, 1.005, -0.55);
    glow.rotation.x = -Math.PI / 2.6;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 1.8), std(0x0d0d10, { metalness: 0.6, roughness: 0.35 }));
    hood.position.set(-0.45, 0.72, -1.8);
    r.add(dash, glow, hood);

    // 电线杆（循环）
    this.poles = [];
    const poleMat = std(0x1a140f, { roughness: 1 });
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 6), poleMat);
      post.position.y = 3.5;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), poleMat);
      bar.position.y = 6.5;
      p.add(post, bar);
      p.position.set(6.5, 0, -i * 12);
      r.add(p);
      this.poles.push(p);
    }
    // 雨丝
    const n = 600;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 16, y = Math.random() * 8, z = -Math.random() * 40;
      pos.set([x, y, z, x, y - 0.35, z + 0.25], i * 6);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.35 }));
    r.add(this.rain);

    // 三块路牌
    const texts = [['M I S S O ·· ·'], ['前方没有出口'], ['· · ·']];
    this.markers = texts.map((t, i) => {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), std(0x777777, { metalness: 0.8 }));
      post.position.y = 1.1;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8), new THREE.MeshStandardMaterial({ map: textTexture(t, { bg: '#1d4a2a', fg: '#f2f2e8', font: 'bold 54px sans-serif' }), roughness: 0.4, emissive: 0x112211 }));
      board.position.y = 2.4;
      board.rotation.y = -0.35;
      g.add(post, board);
      if (i === 2) {
        const tape = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.1), std(0x111111, { roughness: 0.3 }));
        tape.position.set(0, 0.03, 0.4);
        const label = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        label.rotation.x = -Math.PI / 2;
        label.position.set(0, 0.046, 0.4);
        g.add(tape, label);
        this.tape = g;
      }
      g.position.set(4.2, 0, -200);
      g.visible = false;
      r.add(g);
      this.add(board, { id: `marker:${i}`, label: i === 2 ? '路牌下的录像带' : `路牌 ${i + 1}`, use: () => this.game.story.marker(i), enabled: () => this.stopped && this.markerIndex === i, radius: 9, anchor: new THREE.Vector3(0, 0, 0) });
      return g;
    });
  }
  enter() {
    super.enter();
    this.game.camera.bounds = this.bounds;
    this.game.camera.colliders = [];
    this.game.camera.free = false;
    this.game.camera.eyeY = 1.25;
    this.stopped = false;
    this.markerIndex = this.game.state.flags.highwayMarker ?? 0;
    this._spawnMarker();
  }
  exit() {
    super.exit();
    this.game.camera.free = true;
    this.game.camera.eyeY = 1.6;
  }
  _spawnMarker() {
    this.markers.forEach((m, i) => (m.visible = i === this.markerIndex));
    const m = this.markers[this.markerIndex];
    if (m) m.position.z = -46;
  }
  advance() {
    this.markerIndex++;
    this.game.state.flags.highwayMarker = this.markerIndex;
    this.stopped = false;
    if (this.markerIndex < 3) this._spawnMarker();
  }
  startAmbience() {
    const a = this.game.audio;
    a.spatial('engine', null, 0.5, '［引擎低吼，雨刷来回］');
    a.spatial('wind', null, 0.5);
  }
  update(dt, t) {
    super.update(dt, t);
    const m = this.markers[this.markerIndex];
    // 路牌接近到一定距离时自动减速停下
    const brake = m && m.visible && m.position.z > -9;
    if (brake && !this.stopped) {
      this.stopped = true;
      this.game.ui.prompt(this.markerIndex === 2 ? '车停了。［E］捡起录像带' : '车停了。［E］阅读路牌');
    }
    const target = this.stopped ? 0 : this.speed;
    this.cur = (this.cur ?? this.speed) + (target - (this.cur ?? this.speed)) * Math.min(1, dt * 1.5);
    const dz = this.cur * dt;
    this.roadU.uOffset.value += dz;
    for (const p of this.poles) {
      p.position.z += dz;
      if (p.position.z > 6) p.position.z -= 120;
    }
    if (m && m.visible) m.position.z += dz;
    this.rain.position.z = (this.rain.position.z + dz * 0.6) % 20;
    this.rain.position.y = -((t * 9) % 8) + 4;
    this.game.camera.shake = this.game.settings.reducedMotion ? 0 : 0.6 * (this.cur / this.speed);
  }
}
