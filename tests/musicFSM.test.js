import { describe, it, expect } from 'vitest';
import { MusicFSM, STATES } from '../src/audio/musicFSM.js';

describe('动态音乐状态机', () => {
  it('进入空间切到对应基础状态', () => {
    const f = new MusicFSM();
    expect(f.dispatch('enter:redroom').to).toBe('explore');
    expect(f.dispatch('enter:highway').quantize).toBe('now');
    expect(f.state).toBe('dream_highway');
  });
  it('关灯进入不安，开灯回到漫游（按小节量化）', () => {
    const f = new MusicFSM('explore');
    expect(f.dispatch('lamp:off')).toMatchObject({ to: 'tension', quantize: 'beat' });
    expect(f.dispatch('lamp:on')).toMatchObject({ to: 'explore', quantize: 'bar' });
  });
  it('揭示是临时状态：4 小节后回到基础状态', () => {
    const f = new MusicFSM();
    f.dispatch('enter:theater');
    f.dispatch('fragment');
    expect(f.state).toBe('revelation');
    for (let i = 0; i < 3; i++) expect(f.onBar()).toBeNull();
    expect(f.onBar()).toMatchObject({ to: 'dream_theater', reason: 'expire' });
  });
  it('菜单是叠加层：关闭后回到打开前的状态', () => {
    const f = new MusicFSM('explore');
    f.dispatch('menu:open');
    expect(f.state).toBe('menu');
    expect(f.dispatch('menu:close').to).toBe('explore');
  });
  it('菜单期间的基础事件被延后：关闭菜单后生效', () => {
    const f = new MusicFSM('explore');
    f.dispatch('menu:open');
    expect(f.dispatch('lamp:off')).toBeNull();
    expect(f.state).toBe('menu');
    expect(f.dispatch('menu:close').to).toBe('tension');
  });
  it('菜单打开期间发生空间切换，关闭后回到新空间的音乐', () => {
    const f = new MusicFSM('explore');
    f.dispatch('menu:open');
    f.dispatch('enter:radiator');
    expect(f.dispatch('menu:close').to).toBe('dream_radiator');
  });
  it('闲置淡入寂静，玩家活动后恢复', () => {
    const f = new MusicFSM('explore');
    expect(f.dispatch('idle').to).toBe('silence');
    expect(f.dispatch('activity').to).toBe('explore');
  });
  it('重复事件不会重复触发切换（音轨不会重启）', () => {
    const f = new MusicFSM();
    let n = 0;
    f.on(() => n++);
    f.dispatch('enter:redroom');
    f.dispatch('enter:redroom');
    f.dispatch('enter:redroom');
    expect(n).toBe(1);
  });
  it('未知事件被忽略；每个状态都定义了速度', () => {
    expect(new MusicFSM('explore').dispatch('nothing')).toBeNull();
    for (const s of Object.values(STATES)) expect(s.bpm).toBeGreaterThan(0);
  });
});
