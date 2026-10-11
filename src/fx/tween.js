// 极简补间工具：基于 rAF 帧更新（由主循环驱动），返回 Promise。
export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

const active = new Set();

export function tween(duration, onUpdate, easing = ease.inOut) {
  return new Promise((resolve) => {
    if (duration <= 0) {
      onUpdate(1, 1);
      return resolve();
    }
    active.add({ t: 0, duration, onUpdate, easing, resolve });
  });
}

export function updateTweens(dt) {
  for (const tw of active) {
    tw.t = Math.min(tw.duration, tw.t + dt);
    const k = tw.t / tw.duration;
    tw.onUpdate(tw.easing(k), k);
    if (k >= 1) {
      active.delete(tw);
      tw.resolve();
    }
  }
}

export const wait = (s) => tween(s, () => {});
