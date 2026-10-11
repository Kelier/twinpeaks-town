// 镜头导演：第一人称控制器 + 镜头库。
// 镜头库（均返回 Promise，执行期间锁定玩家输入）：
//   pushIn 缓慢推近 · pullBack 拉远 · dolly 横移 · orbit 环绕 · overhead 俯拍 · dutch 荷兰角
//   crashZoom 急推(变焦) · handheld 手持晃动 · lookAt 转头注视 · vertigo 推轨变焦(希区柯克式)
import * as THREE from 'three';
import { tween, ease } from './tween.js';

const v = new THREE.Vector3();

export class CameraDirector {
  constructor(camera, input, settings) {
    this.cam = camera;
    this.input = input;
    this.settings = settings;
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.pos = new THREE.Vector3(0, 1.6, 3);
    this.vel = new THREE.Vector3();
    this.bounds = { minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 };
    this.colliders = [];
    this.locked = false; // 镜头运动期间
    this.free = true; // 是否允许移动
    this.shake = 0;
    this.baseFov = 62;
    this.bob = 0;
  }

  place(p, yaw = 0, pitch = 0) {
    this.pos.copy(p);
    this.yaw = yaw;
    this.pitch = pitch;
    this.roll = 0;
    this.cam.fov = this.baseFov;
    this.cam.updateProjectionMatrix();
    this.apply();
  }

  apply() {
    this.cam.position.copy(this.pos);
    if (this.shake > 0 && !this.settings.reducedMotion) {
      const t = performance.now() / 1000;
      this.cam.position.x += Math.sin(t * 7.3) * 0.01 * this.shake;
      this.cam.position.y += Math.sin(t * 9.1) * 0.008 * this.shake;
    }
    this.cam.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }

  update(dt) {
    if (!this.locked) {
      const look = this.input.consumeLook();
      const ax = this.input.axis();
      const sens = (this.design?.turnSensitivity ?? 0.0032) * this.settings.lookSensitivity;
      this.yaw -= look.dx * sens + ax.turn * dt * 1.8;
      this.pitch -= (look.dy * sens * (this.settings.invertY ? -1 : 1)) - ax.pitch * dt * 1.2;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.2, 1.2);
      if (this.free) {
        const speed = this.input.held('ShiftLeft') ? 2.6 : (this.design?.walkSpeed ?? 1.5);
        v.set(ax.x, 0, ax.z);
        if (v.lengthSq() > 1) v.normalize();
        v.applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw).multiplyScalar(speed);
        this.vel.lerp(v, 1 - Math.exp(-dt * 10));
        this.pos.addScaledVector(this.vel, dt);
        this._collide();
        const moving = this.vel.length();
        if (!this.settings.reducedMotion) {
          this.bob += dt * moving * 6;
          this.pos.y = this.eyeY + Math.sin(this.bob) * (this.design?.headBob ?? 0.012) * Math.min(1, moving);
        } else this.pos.y = this.eyeY;
      }
      if (this.focusTarget) this._turnToward(this.focusTarget, dt);
    } else this.input.consumeLook();
    this.apply();
  }

  get eyeY() {
    return this._eye ?? 1.6;
  }
  set eyeY(y) {
    this._eye = y;
  }

  _collide() {
    const b = this.bounds;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, b.minX, b.maxX);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, b.minZ, b.maxZ);
    for (const c of this.colliders) {
      const dx = this.pos.x - c.x;
      const dz = this.pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const r = c.r + 0.25;
      if (d < r && d > 1e-4) {
        this.pos.x = c.x + (dx / d) * r;
        this.pos.z = c.z + (dz / d) * r;
      }
    }
  }

  // Tab 聚焦时平滑转向目标
  _turnToward(p, dt) {
    v.copy(p).sub(this.pos);
    const targetYaw = Math.atan2(-v.x, -v.z);
    const targetPitch = Math.atan2(v.y, Math.hypot(v.x, v.z));
    let dy = targetYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const k = 1 - Math.exp(-dt * 6);
    this.yaw += dy * k;
    this.pitch += (targetPitch - this.pitch) * k;
    if (Math.abs(dy) < 0.01) this.focusTarget = null;
  }

  // ———————————————— 镜头库 ————————————————
  _anglesTo(from, to) {
    v.copy(to).sub(from);
    return { yaw: Math.atan2(-v.x, -v.z), pitch: Math.atan2(v.y, Math.hypot(v.x, v.z)) };
  }

  async _move({ to, lookAt, duration = 2, fov, roll = 0, easing = ease.inOut, keepLock = false }) {
    this.locked = true;
    const p0 = this.pos.clone();
    const y0 = this.yaw;
    const pi0 = this.pitch;
    const r0 = this.roll;
    const f0 = this.cam.fov;
    const p1 = to ? to.clone() : p0.clone();
    const a = lookAt ? this._anglesTo(p1, lookAt) : { yaw: y0, pitch: pi0 };
    let dyaw = Math.atan2(Math.sin(a.yaw - y0), Math.cos(a.yaw - y0));
    const rm = this.settings.reducedMotion;
    await tween(rm ? Math.min(duration, 0.6) : duration, (k) => {
      this.pos.lerpVectors(p0, p1, k);
      this.yaw = y0 + dyaw * k;
      this.pitch = pi0 + (a.pitch - pi0) * k;
      this.roll = rm ? 0 : r0 + (roll - r0) * k;
      if (fov) {
        this.cam.fov = f0 + (fov - f0) * k;
        this.cam.updateProjectionMatrix();
      }
    }, easing);
    if (!keepLock) this.locked = false;
  }

  release() {
    this.locked = false;
    this.roll = 0;
    this.cam.fov = this.baseFov;
    this.cam.updateProjectionMatrix();
    this.vel.set(0, 0, 0);
  }

  lookAt(target, duration = 1.2) {
    return this._move({ lookAt: target, duration });
  }
  pushIn(target, distance = 0.8, duration = 3, keepLock) {
    const dir = target.clone().sub(this.pos).normalize();
    return this._move({ to: this.pos.clone().addScaledVector(dir, distance), lookAt: target, duration, easing: ease.inOutSine, keepLock });
  }
  pullBack(target, distance = 1, duration = 2.5, keepLock) {
    const dir = target.clone().sub(this.pos).normalize();
    return this._move({ to: this.pos.clone().addScaledVector(dir, -distance), lookAt: target, duration, keepLock });
  }
  dolly(offset, lookAt, duration = 3, keepLock) {
    return this._move({ to: this.pos.clone().add(offset), lookAt, duration, easing: ease.inOutSine, keepLock });
  }
  async orbit(center, radius = 2, height = 1.6, arc = Math.PI / 2, duration = 5, keepLock) {
    this.locked = true;
    const start = Math.atan2(this.pos.x - center.x, this.pos.z - center.z);
    const rm = this.settings.reducedMotion;
    await tween(rm ? 0.8 : duration, (k) => {
      const a = start + arc * k;
      this.pos.set(center.x + Math.sin(a) * radius, height, center.z + Math.cos(a) * radius);
      const ang = this._anglesTo(this.pos, center);
      this.yaw = ang.yaw;
      this.pitch = ang.pitch;
    }, ease.inOutSine);
    if (!keepLock) this.locked = false;
  }
  overhead(center, height = 4.5, duration = 3, keepLock) {
    return this._move({ to: new THREE.Vector3(center.x, height, center.z + 0.01), lookAt: center, duration, keepLock });
  }
  dutch(angle = 0.25, duration = 1.5, keepLock = true) {
    return this._move({ duration, roll: angle, keepLock });
  }
  crashZoom(target, fov = 28, duration = 0.35, keepLock = true) {
    if (this.settings.reducedMotion) return this._move({ lookAt: target, duration: 0.5, keepLock });
    return this._move({ lookAt: target, fov, duration, easing: ease.in, keepLock });
  }
  // 推轨变焦：机位后退同时收窄视角，主体大小不变而背景膨胀
  async vertigo(target, distance = 1.2, duration = 3, keepLock = true) {
    if (this.settings.reducedMotion) return this.lookAt(target, 0.6);
    const d0 = this.pos.distanceTo(target);
    const f0 = this.cam.fov;
    const w = 2 * d0 * Math.tan(THREE.MathUtils.degToRad(f0 / 2));
    const dir = target.clone().sub(this.pos).normalize();
    const p0 = this.pos.clone();
    this.locked = true;
    await tween(duration, (k) => {
      const d = d0 + distance * k;
      this.pos.copy(p0).addScaledVector(dir, -distance * k);
      this.cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(w / (2 * d)));
      this.cam.updateProjectionMatrix();
    }, ease.inOutSine);
    if (!keepLock) this.release();
  }
  async handheld(seconds = 2, amount = 1) {
    if (this.settings.reducedMotion) return;
    this.shake = amount;
    await tween(seconds, () => {});
    this.shake = 0;
  }
}

export const SHOT_LIBRARY = [
  ['pushIn', '缓慢推近', '揭示物件细节、进入思考状态'],
  ['pullBack', '拉远', '离开物件、回到全局'],
  ['dolly', '横移', '沿幕布平移，展示空间'],
  ['orbit', '环绕', '围绕关键物件，强调其中心地位'],
  ['overhead', '俯拍', '终章：俯视 Z 字地板'],
  ['dutch', '荷兰角', '不安、梦境失衡'],
  ['crashZoom', '急推变焦', '惊吓与突然的注意（减少动态时降级为转头）'],
  ['handheld', '手持晃动', '紧张段落（减少动态时关闭）'],
  ['lookAt', '转头注视', '引导视线、Tab 聚焦'],
  ['vertigo', '推轨变焦', '进入梦境的眩晕（减少动态时关闭）'],
];
