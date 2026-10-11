import { describe, it, expect } from 'vitest';
import { Transitioner, TRANSITIONS } from '../src/fx/transitions.js';
import { SHOT_LIBRARY } from '../src/fx/camera.js';

const fake = (settings) => new Transitioner({ u: {} }, { sfx() {} }, settings);

describe('转场与镜头库', () => {
  it('减少闪烁时，负片与雪花转场降级为淡入淡出', () => {
    const t = fake({ reducedFlashing: true });
    expect(t.resolve('static')[0]).toBe('fade');
    expect(t.resolve('invert')[0]).toBe('fade');
    expect(t.resolve('curtain')[0]).toBe('curtain');
    expect(t.resolve('zigzag')[0]).toBe('zigzag');
  });
  it('默认设置下保留全部转场', () => {
    const t = fake({ reducedFlashing: false });
    for (const k of Object.keys(TRANSITIONS)) expect(t.resolve(k)[0]).toBe(k);
  });
  it('未知转场回落为淡入淡出', () => {
    expect(fake({}).resolve('nope')[1]).toBe(TRANSITIONS.fade);
  });
  it('镜头库至少包含 10 种镜头', () => {
    expect(SHOT_LIBRARY.length).toBeGreaterThanOrEqual(10);
  });
});
