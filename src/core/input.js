// 输入：键盘（WASD / 方向键）、鼠标拖拽视角、触屏（左半屏移动、右半屏视角）。
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.look = { dx: 0, dy: 0 };
    this.handlers = {};
    this.enabled = true;
    this.dragging = false;
    this.dragMoved = 0;
    this.touchMove = { x: 0, y: 0 };

    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, select, textarea, [role=dialog] button, .menu')) return;
      this.keys.add(e.code);
      this.emit('key', e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      this.dragging = true;
      this.dragMoved = 0;
      this.last = [e.clientX, e.clientY];
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      this.pointer = [e.clientX, e.clientY];
      if (!this.dragging) return;
      const dx = e.clientX - this.last[0];
      const dy = e.clientY - this.last[1];
      this.last = [e.clientX, e.clientY];
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      this.look.dx += dx;
      this.look.dy += dy;
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return;
      this.dragging = false;
      if (this.dragMoved < 6) this.emit('click', e);
    });

    // 触屏
    const touches = new Map();
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        touches.set(t.identifier, { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, left: t.clientX < innerWidth / 2, t0: performance.now() });
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        const s = touches.get(t.identifier);
        if (!s) continue;
        if (s.left) {
          this.touchMove.x = Math.max(-1, Math.min(1, (t.clientX - s.sx) / 60));
          this.touchMove.y = Math.max(-1, Math.min(1, (t.clientY - s.sy) / 60));
        } else {
          this.look.dx += (t.clientX - s.x) * 1.4;
          this.look.dy += (t.clientY - s.y) * 1.4;
        }
        s.x = t.clientX;
        s.y = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        const s = touches.get(t.identifier);
        touches.delete(t.identifier);
        if (s?.left) this.touchMove = { x: 0, y: 0 };
        if (s && Math.hypot(t.clientX - s.sx, t.clientY - s.sy) < 10 && performance.now() - s.t0 < 300) {
          this.emit('click', { clientX: t.clientX, clientY: t.clientY, touch: true });
        }
      }
    });
  }
  on(name, fn) {
    (this.handlers[name] ??= []).push(fn);
  }
  emit(name, e) {
    (this.handlers[name] ?? []).forEach((fn) => fn(e));
  }
  axis() {
    if (!this.enabled) return { x: 0, z: 0, turn: 0, pitch: 0 };
    const k = this.keys;
    const x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.touchMove.x;
    const z = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) + this.touchMove.y;
    const turn = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
    const pitch = (k.has('PageUp') ? 1 : 0) - (k.has('PageDown') ? 1 : 0);
    return { x, z, turn, pitch };
  }
  consumeLook() {
    const l = { ...this.look };
    this.look.dx = this.look.dy = 0;
    return this.enabled ? l : { dx: 0, dy: 0 };
  }
  held(code) {
    return this.enabled && this.keys.has(code);
  }
}
