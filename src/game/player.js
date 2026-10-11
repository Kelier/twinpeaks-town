// Puppet Cooper: 2.5D platform controller (x scroll, z depth lane, y up) with ledge climbing, grabbing and a flashlight.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const H = 1.25, HX = .26, HZ = .22;
const GRAV = 22, JUMP = 7.4, WALK = 2.3, RUN = 4.4, PUSH = 1.25, REACH = 1.95;

export class Player {
  constructor(gltf, sound) {
    this.sound = sound;
    this.root = new THREE.Group();
    const model = cloneSkinned(gltf.scene);
    const box = new THREE.Box3().setFromObject(model); const h = box.max.y - box.min.y;
    const k = H / h; model.scale.setScalar(k); model.position.y = -box.min.y * k; model.userData.baseY = model.position.y;
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.roughness = Math.max(.6, o.material.roughness ?? .7); } } });
    this.model = model; this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const clip of gltf.animations) { const a = this.mixer.clipAction(clip); this.actions[clip.name] = a; }
    for (const n of ['jump', 'push', 'caught']) if (this.actions[n]) { this.actions[n].setLoop(THREE.LoopOnce); this.actions[n].clampWhenFinished = true; }
    this.current = null; this.play('idle');
    // flashlight held at chest height
    this.torch = new THREE.SpotLight('#fff1d6', 0, 18, .38, .55, 1.3);
    this.torch.castShadow = true; this.torch.shadow.mapSize.set(512, 512); this.torch.shadow.bias = -.0005;
    this.torch.position.set(0, .82, 0); this.torch.target.position.set(3, .5, 0);
    this.root.add(this.torch, this.torch.target);
    this.pos = this.root.position; this.vel = new THREE.Vector3();
    this.yaw = Math.PI / 2; this.face = 1; this.onGround = false; this.mode = 'normal';
    this.stepT = 0; this.torchOn = false; this.grabbed = null; this.climb = null; this.airTime = 0;
  }
  play(name, fade = .18) {
    const a = this.actions[name] || this.actions.idle; if (!a || this.current === a) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play(); if (this.current) this.current.fadeOut(fade); this.current = a;
  }
  setTorch(on) { this.torchOn = on; this.sound.click(); }
  aabb(p = this.pos) { return { min: [p.x - HX, p.y, p.z - HZ], max: [p.x + HX, p.y + H, p.z + HZ] }; }

  update(dt, input, world) {
    this.mixer.update(dt);
    this.torch.intensity += ((this.torchOn ? 38 : 0) - this.torch.intensity) * Math.min(1, dt * 12);
    if (this.mode === 'caught' || this.mode === 'locked') { this.vel.set(0, 0, 0); if (this.mode === 'locked') this.play(this.lockAnim || 'idle'); return; }
    if (this.mode === 'climb') return this.updateClimb(dt, world);

    const run = input.run && !this.grabbed;
    let ix = input.x, iz = input.z;
    // grab / release a movable next to us
    if (input.grab && !this.grabbed && this.onGround) {
      const m = world.movableAt(this);
      if (m) { this.grabbed = m; this.grabSide = Math.sign(m.center().x - this.pos.x) || this.face; }
    }
    if (!input.grab && this.grabbed) this.grabbed = null;
    if (this.grabbed) iz = 0;

    const speed = this.grabbed ? PUSH : run ? RUN : WALK;
    const tvx = ix * speed, tvz = iz * speed * .75;
    const acc = this.onGround ? 14 : 5;
    this.vel.x += (tvx - this.vel.x) * Math.min(1, dt * acc);
    this.vel.z += (tvz - this.vel.z) * Math.min(1, dt * acc);
    if (input.jumpPressed && this.onGround && !this.grabbed) { this.vel.y = JUMP; this.onGround = false; this.sound.jump(); this.play('jump', .08); }
    this.vel.y -= GRAV * dt;

    // --- horizontal moves with step-up and ledge grab ---
    const dx = this.vel.x * dt, dz = this.vel.z * dt;
    if (this.grabbed) {
      const moved = world.pushMovable(this.grabbed, dx, this);
      this.moveAxis(0, moved, world);
    } else {
      const hitX = this.moveAxis(0, dx, world);
      if (hitX && Math.abs(ix) > .2) this.tryLedge(hitX, Math.sign(dx) || Math.sign(ix), 0, world, input);
    }
    const hitZ = this.moveAxis(2, dz, world);
    if (hitZ && Math.abs(iz) > .2 && !this.grabbed) this.tryLedge(hitZ, Math.sign(dz) || Math.sign(iz), 2, world, input);
    this.pos.z = Math.max(world.zMin, Math.min(world.zMax, this.pos.z));

    // --- vertical ---
    const wasGround = this.onGround; const vy = this.vel.y;
    this.onGround = false;
    const hitY = this.moveAxis(1, this.vel.y * dt, world);
    if (hitY && vy <= 0) { this.onGround = true; this.vel.y = 0; this.ground = hitY; if (!wasGround && this.airTime > .25) this.sound.land(this.airTime); this.airTime = 0; }
    else if (hitY && vy > 0) this.vel.y = 0;
    if (!this.onGround) this.airTime += dt;

    // facing & animation
    if (Math.abs(ix) > .1) this.face = Math.sign(ix);
    let targetYaw = this.grabbed ? this.grabSide * Math.PI / 2 : this.face * Math.PI / 2;
    if (Math.abs(iz) > .3 && Math.abs(ix) < .3) targetYaw = iz < 0 ? Math.PI : 0;
    let dyaw = targetYaw - this.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.yaw += dyaw * Math.min(1, dt * 10); this.model.rotation.y = this.yaw;
    const torchDir = new THREE.Vector3(Math.sin(this.yaw), -.12, Math.cos(this.yaw));
    this.torch.target.position.copy(this.torch.position).addScaledVector(torchDir, 4);

    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.grabbed) this.play(Math.abs(this.vel.x) > .1 ? 'walk' : 'push');
    else if (!this.onGround && this.airTime > .12) this.play('jump', .12);
    else if (hs > 3.2) this.play('run');
    else if (hs > .4) this.play('walk');
    else this.play('idle', .3);
    if (this.current === this.actions.walk) this.actions.walk.timeScale = Math.max(.6, hs / WALK);
    if (this.current === this.actions.run) this.actions.run.timeScale = Math.max(.7, hs / RUN);

    if (this.onGround && hs > .4) {
      this.stepT -= dt * hs;
      if (this.stepT <= 0) { this.stepT = .62; this.sound.step(world.surfaceAt(this.pos), 0, hs > 3); if (this.grabbed) this.sound.noise({ dur: .3, freq: 300, q: 1, gain: .1 }); }
    }
    if (this.pos.y < world.killY) world.onFall?.();
  }

  moveAxis(axis, d, world) {
    if (!d) return null;
    const key = axis === 0 ? 'x' : axis === 1 ? 'y' : 'z';
    this.pos[key] += d;
    const me = this.aabb(); let hit = null;
    for (const c of world.solids()) {
      if (c === this.grabbed || c.ghost) continue;
      if (me.min[0] < c.max[0] && me.max[0] > c.min[0] && me.min[1] < c.max[1] && me.max[1] > c.min[1] && me.min[2] < c.max[2] && me.max[2] > c.min[2]) {
        // step up onto low edges instead of stopping
        if (axis !== 1 && c.max[1] - this.pos.y <= .32 && this.onGroundish()) {
          const up = c.max[1] - this.pos.y + .001; this.pos.y += up;
          if (!world.overlapsAny(this.aabb(), this.grabbed)) continue; this.pos.y -= up;
        }
        if (d > 0) this.pos[key] = c.min[axis] - (axis === 1 ? H : axis === 0 ? HX : HZ) - 1e-4;
        else this.pos[key] = c.max[axis] + (axis === 1 ? 0 : axis === 0 ? HX : HZ) + 1e-4;
        hit = c; me.min[axis] = this.aabb().min[axis]; me.max[axis] = this.aabb().max[axis];
      }
    }
    return hit;
  }
  onGroundish() { return this.onGround || this.airTime < .1; }

  tryLedge(c, dir, axis, world, input) {
    const top = c.max[1]; const rise = top - this.pos.y;
    if (rise <= .32 || c.noClimb) return;
    const canReach = this.onGround ? rise <= .62 || (input.jumpHeld && rise <= REACH - .4) : (top <= this.pos.y + REACH && this.vel.y < 4);
    if (!canReach) return;
    const dest = this.pos.clone(); dest.y = top + .002;
    if (axis === 0) dest.x = dir > 0 ? Math.max(this.pos.x + .35, c.min[0] + HX + .02) : Math.min(this.pos.x - .35, c.max[0] - HX - .02);
    else dest.z = dir > 0 ? Math.max(this.pos.z + .35, c.min[2] + HZ + .02) : Math.min(this.pos.z - .35, c.max[2] - HZ - .02);
    if (world.overlapsAny(this.aabb(dest))) return;
    this.mode = 'climb'; this.climb = { from: this.pos.clone(), to: dest, t: 0, dur: rise > .7 ? .85 : .4 };
    this.vel.set(0, 0, 0); this.play('climb', .1); this.sound.climb();
  }
  updateClimb(dt) {
    const c = this.climb; c.t += dt / c.dur; const t = Math.min(1, c.t);
    const up = Math.min(1, t / .7), fwd = Math.max(0, (t - .55) / .45);
    this.pos.y = c.from.y + (c.to.y - c.from.y) * (1 - (1 - up) ** 2);
    this.pos.x = c.from.x + (c.to.x - c.from.x) * fwd; this.pos.z = c.from.z + (c.to.z - c.from.z) * fwd;
    if (t >= 1) { this.mode = 'normal'; this.onGround = true; this.vel.set(0, 0, 0); this.play('idle'); }
  }
}
