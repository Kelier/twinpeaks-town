// Level runtime: colliders (AABB), pushable movables, interaction points and trigger zones.
import * as THREE from 'three';
import { HX, HZ, H } from './player.js';

const overlap = (a, b) => a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[1] < b.max[1] && a.max[1] > b.min[1] && a.min[2] < b.max[2] && a.max[2] > b.min[2];

export class World {
  constructor(scene) {
    this.scene = scene; this.statics = []; this.movables = []; this.interactables = []; this.triggers = [];
    this.zMin = -1.5; this.zMax = 1.6; this.killY = -6; this.surfaces = [];
    this.updaters = [];
  }
  solids() { return this._s || (this._s = [...this.statics, ...this.movables]); }
  dirty() { this._s = null; }
  /** register a static collider; returns it */
  solid(min, max, opts = {}) { const c = { min: [...min], max: [...max], ...opts }; this.statics.push(c); this.dirty(); return c; }
  remove(c) { this.statics = this.statics.filter((s) => s !== c); this.movables = this.movables.filter((s) => s !== c); this.dirty(); }
  movable(mesh, size, opts = {}) {
    const p = mesh.position; const c = {
      mesh, size: new THREE.Vector3(...size), min: [0, 0, 0], max: [0, 0, 0], ...opts,
      center() { return new THREE.Vector3((this.min[0] + this.max[0]) / 2, this.min[1], (this.min[2] + this.max[2]) / 2); },
      sync() { const o = mesh.userData.offset || new THREE.Vector3(); this.min = [p.x - this.size.x / 2, p.y - o.y, p.z - this.size.z / 2]; this.max = [p.x + this.size.x / 2, p.y - o.y + this.size.y, p.z + this.size.z / 2]; },
    };
    c.sync(); this.movables.push(c); this.dirty(); return c;
  }
  overlapsAny(box, ignore) { for (const c of this.solids()) if (c !== ignore && !c.ghost && overlap(box, c)) return c; return null; }
  movableAt(player) {
    const p = player.pos; let best = null, bd = .5;
    for (const m of this.movables) {
      if (m.locked) continue;
      if (p.y + .2 < m.min[1] || p.y > m.max[1] - .2) continue;
      if (p.z + HZ < m.min[2] - .1 || p.z - HZ > m.max[2] + .1) continue;
      const gap = Math.min(Math.abs(p.x + HX - m.min[0]), Math.abs(m.max[0] - (p.x - HX)));
      if (gap < bd) { bd = gap; best = m; }
    }
    return best;
  }
  /** move a grabbed movable along x; returns how far the player may follow */
  pushMovable(m, dx, player) {
    if (!dx) return 0;
    const p = m.mesh.position; p.x += dx; m.sync();
    const hit = this.overlapsAny(m, m);
    const pbox = player.aabb(); const pushingInto = Math.sign(m.center().x - player.pos.x) === Math.sign(dx);
    if (hit || (!pushingInto && overlap(m, pbox))) { p.x -= dx; m.sync(); return pushingInto ? 0 : dx; }
    m.onMove?.(m);
    // falls if unsupported
    this.settle(m);
    return dx;
  }
  settle(m) {
    const p = m.mesh.position; const test = { min: [m.min[0] + .05, m.min[1] - .05, m.min[2] + .05], max: [m.max[0] - .05, m.min[1], m.max[2] - .05] };
    if (!this.overlapsAny(test, m) && m.min[1] > this.floorAt(m)) m.falling = true;
  }
  floorAt() { return -100; }
  surfaceAt(p) { for (const s of this.surfaces) if (p.x >= s.x0 && p.x <= s.x1 && p.y >= (s.y0 ?? -10) && p.y <= (s.y1 ?? 100)) return s.kind; return this.defaultSurface || 'wood'; }
  interact(o) { this.interactables.push({ radius: 1.1, enabled: true, ...o }); return this.interactables.at(-1); }
  trigger(min, max, fn, once = true) { this.triggers.push({ min, max, fn, once, done: false }); }
  nearestInteractable(p) {
    let best = null, bd = Infinity;
    for (const it of this.interactables) {
      if (!it.enabled) continue; const d = Math.hypot(p.x - it.pos.x, (p.y + .6 - it.pos.y) * .7, (p.z - it.pos.z) * .8);
      if (d < it.radius && d < bd) { bd = d; best = it; }
    }
    return best;
  }
  update(dt, t, player) {
    for (const m of this.movables) {
      if (!m.falling) continue;
      m.vy = (m.vy || 0) - 22 * dt; m.mesh.position.y += m.vy * dt; m.sync();
      const hit = this.overlapsAny(m, m) || (player && overlap(m, player.aabb()) ? null : null);
      if (hit) { m.mesh.position.y = hit.max[1] + (m.mesh.userData.offset?.y || 0); m.sync(); m.falling = false; m.vy = 0; m.onLand?.(m); }
      if (m.mesh.position.y < this.killY - 4) { m.falling = false; }
    }
    const box = player.aabb();
    for (const tr of this.triggers) {
      if (tr.done) continue;
      if (overlap(box, tr)) { tr.fn(); if (tr.once) tr.done = true; }
    }
    for (const u of this.updaters) u(dt, t);
  }
}
