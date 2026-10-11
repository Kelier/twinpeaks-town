import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PostShader } from '../fx/postShader.js';

export const QUALITY = {
  low: { dpr: 0.5, shadows: false, bloom: false, curtainSeg: 80, label: '低' },
  medium: { dpr: 1, shadows: false, bloom: true, curtainSeg: 160, label: '中' },
  high: { dpr: 2, shadows: true, bloom: true, curtainSeg: 260, label: '高' },
};
const ORDER = ['low', 'medium', 'high'];

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 200);
    this.scene = new THREE.Scene();
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.6, 0.82);
    this.post = new ShaderPass(PostShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.post);
    this.composer.addPass(new OutputPass());
    this.u = this.post.uniforms;

    this.clock = new THREE.Timer();
    this.clock.connect?.(document);
    this.perf = { frames: 0, acc: 0, fps: 0, avgMs: 0, worstMs: 0, samples: [], changes: 0, calls: 0, tris: 0 };
    this.autoQuality = true;
    this.setQuality('medium');
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  setQuality(name, manual = false) {
    if (name === 'auto') {
      this.autoQuality = true;
      name = this.qualityName ?? 'medium';
    } else if (manual) this.autoQuality = false;
    this.qualityName = name;
    this.q = QUALITY[name];
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.bloom.enabled = this.q.bloom;
    this.scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
    });
    this.resize();
    this.onQualityChange?.(name);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.q.dpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * dpr * 0.5, h * dpr * 0.5);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.u.uRes.value = [w * dpr, h * dpr];
  }

  // 自适应画质：按 3 秒窗口的平均帧时间升降档，带迟滞与次数上限
  _adapt(ms) {
    const p = this.perf;
    p.samples.push(ms);
    if (p.samples.length < 180) return;
    const avg = p.samples.reduce((a, b) => a + b, 0) / p.samples.length;
    p.samples.length = 0;
    if (!this.autoQuality || p.changes >= 4) return;
    const i = ORDER.indexOf(this.qualityName);
    if (avg > 24 && i > 0) {
      p.changes++;
      this.setQuality(ORDER[i - 1]);
    } else if (avg < 11 && i < ORDER.length - 1 && !this._upgradedOnce) {
      this._upgradedOnce = true;
      p.changes++;
      this.setQuality(ORDER[i + 1]);
    }
  }

  frame(update) {
    this.clock.update();
    const elapsedDelta = this.clock.getDelta();
    const dt = Math.min(elapsedDelta, 0.1);
    this.elapsed = this.clock.getElapsed();
    const t0 = performance.now();
    this.renderer.info.reset();
    update(dt, this.elapsed);
    this.u.uTime.value = this.elapsed;
    this.composer.render(dt);
    const ms = elapsedDelta * 1000;
    const p = this.perf;
    p.frames++;
    p.acc += elapsedDelta;
    p.worstMs = Math.max(p.worstMs, ms);
    p.cpuMs = performance.now() - t0;
    if (p.acc >= 1) {
      p.fps = p.frames / p.acc;
      p.avgMs = (p.acc / p.frames) * 1000;
      p.frames = 0;
      p.acc = 0;
      p.calls = this.renderer.info.render.calls;
      p.tris = this.renderer.info.render.triangles;
      p.lastWorst = p.worstMs;
      p.worstMs = 0;
    }
    this._adapt(ms);
  }
}
