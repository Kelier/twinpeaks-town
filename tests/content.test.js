import { describe, it, expect } from 'vitest';
import { WORKS, mediumOf, MEDIA } from '../src/content/works.js';
import { TIMELINE, TAGS } from '../src/content/timeline.js';
import { SOURCES } from '../src/content/sources.js';
import { buildGraph, PEOPLE, THEMES, COLLAB } from '../src/content/graph.js';
import { FRAGMENTS, CHAPTERS, LINES, SPACES } from '../src/content/chapters.js';
import { INITIAL_ARCHIVE } from '../src/core/story.js';

describe('内容完整性', () => {
  it('作品：id 唯一、来源存在、母题存在、媒介可识别', () => {
    const ids = new Set();
    const themes = new Set(THEMES.map((t) => t.id));
    for (const w of WORKS) {
      expect(ids.has(w.id), w.id).toBe(false);
      ids.add(w.id);
      expect(w.sources.length, w.id).toBeGreaterThan(0);
      for (const s of w.sources) expect(SOURCES[s], `${w.id}:${s}`).toBeTruthy();
      for (const t of w.themes) expect(themes.has(t), `${w.id}:${t}`).toBe(true);
      expect(MEDIA[mediumOf(w)]).toBeTruthy();
      expect(w.summary.length).toBeGreaterThan(10);
    }
  });
  it('作品覆盖长片之外的媒介（电视、短片、音乐、艺术、书籍）', () => {
    const m = new Set(WORKS.map(mediumOf));
    for (const k of Object.keys(MEDIA)) expect(m.has(k), k).toBe(true);
  });
  it('时间线：按日期排序，每条都有来源与核对状态', () => {
    for (let i = 1; i < TIMELINE.length; i++) expect(TIMELINE[i].date >= TIMELINE[i - 1].date, TIMELINE[i].date).toBe(true);
    for (const t of TIMELINE) {
      expect(['checked', 'pending']).toContain(t.verified);
      expect(TAGS[t.tag]).toBeTruthy();
      for (const s of t.sources) expect(SOURCES[s], s).toBeTruthy();
      if (t.work) expect(WORKS.some((w) => w.id === t.work), t.work).toBe(true);
    }
    expect(TIMELINE[0].date).toBe('1946-01-20');
    expect(TIMELINE.at(-1).date).toBe('2025-01-16');
  });
  it('关系图：所有边都连到存在的节点', () => {
    const g = buildGraph(WORKS);
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.source), e.source).toBe(true);
      expect(ids.has(e.target), e.target).toBe(true);
    }
    for (const [p, ws] of COLLAB) {
      expect(PEOPLE.some((x) => x.id === p)).toBe(true);
      for (const w of ws) expect(WORKS.some((x) => x.id === w), w).toBe(true);
    }
  });
  it('碎片解锁的作品存在；初始档案不含被锁定作品', () => {
    const locked = Object.values(FRAGMENTS).flatMap((f) => f.archive);
    for (const id of locked) expect(WORKS.some((w) => w.id === id), id).toBe(true);
    for (const id of INITIAL_ARCHIVE) expect(locked).not.toContain(id);
    expect(INITIAL_ARCHIVE.length + locked.length).toBe(WORKS.length);
  });
  it('章节与空间文本齐全', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['prologue', 'ch1', 'ch2', 'finale', 'epilogue']);
    for (const s of Object.values(SPACES)) expect(s.title && s.year && s.music).toBeTruthy();
    expect(LINES.intro[0].text).toBe('有些房间，需要先听见。');
  });
});
