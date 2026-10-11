import { describe, it, expect } from 'vitest';
import { CANDIDATE_TRACKS, ORIGINAL_TRACKS, resolveTrack, isCleared } from '../src/content/tracks.js';
import { STATES } from '../src/audio/musicFSM.js';

const clear = (t, extra = {}) => ({ ...t, rights: { ...t.rights, compositionLicense: 'cleared', masterLicense: 'cleared', syncPermission: 'cleared', editPermission: 'cleared', territories: ['WORLD'], ...extra } });

describe('配乐授权门控', () => {
  it('所有候选原声当前均为未授权', () => {
    expect(CANDIDATE_TRACKS).toHaveLength(6);
    for (const t of CANDIDATE_TRACKS) expect(isCleared(t)).toBe(false);
  });
  it('每个有声音乐状态都有原创配乐兜底', () => {
    for (const [k, s] of Object.entries(STATES)) {
      if (k === 'silence' || k === 'menu') continue;
      expect(resolveTrack(k)?.origin, k).toBe('original');
    }
  });
  it('只有全部权利 cleared 才会选中授权音轨', () => {
    const tp = CANDIDATE_TRACKS.find((t) => t.id === 'tp-theme');
    const partial = { ...tp, rights: { ...tp.rights, compositionLicense: 'cleared', masterLicense: 'cleared' } };
    expect(resolveTrack('explore', { catalog: [partial, ...ORIGINAL_TRACKS] }).origin).toBe('original');
    expect(resolveTrack('explore', { catalog: [clear(tp), ...ORIGINAL_TRACKS] }).id).toBe('tp-theme');
  });
  it('地区不在授权范围内时回落原创', () => {
    const tp = clear(CANDIDATE_TRACKS[0], { territories: ['US'] });
    expect(resolveTrack('explore', { territory: 'CN', catalog: [tp, ...ORIGINAL_TRACKS] }).origin).toBe('original');
    expect(resolveTrack('explore', { territory: 'US', catalog: [tp, ...ORIGINAL_TRACKS] }).origin).toBe('licensed');
  });
  it('授权过期后回落原创', () => {
    const tp = clear(CANDIDATE_TRACKS[0], { expiryDate: '2020-01-01' });
    expect(resolveTrack('explore', { catalog: [tp, ...ORIGINAL_TRACKS] }).origin).toBe('original');
  });
});
