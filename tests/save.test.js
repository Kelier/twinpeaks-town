import { describe, it, expect } from 'vitest';
import { SaveManager, memoryStorage, serialize, deserialize, migrate, defaultState, SCHEMA_VERSION } from '../src/core/save.js';

describe('存档系统', () => {
  it('写入后可以原样读回', () => {
    const m = new SaveManager(memoryStorage());
    const s = { ...defaultState(), fragments: ['tape'], flags: { lampOff: true }, discoveries: [{ id: 'lamp', label: '落地灯', space: 'redroom', at: 12 }] };
    expect(m.save('1', s)).toBe(true);
    const r = m.load('1');
    expect(r.state.fragments).toEqual(['tape']);
    expect(r.state.flags.lampOff).toBe(true);
    expect(r.state.discoveries[0].id).toBe('lamp');
    expect(r.state.schema).toBe(SCHEMA_VERSION);
  });
  it('篡改内容会被校验和识别', () => {
    const raw = JSON.parse(serialize(defaultState()));
    raw.body = raw.body.replace('"playTime":0', '"playTime":999');
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/校验失败/);
  });
  it('v1 存档自动迁移到当前版本', () => {
    const v1 = { schema: 1, keys: ['seed'], room: 'radiator', chapter: 'ch2', flags: {} };
    const d = migrate(v1);
    expect(d.schema).toBe(2);
    expect(d.fragments).toEqual(['seed']);
    expect(d.space).toBe('radiator');
    expect(d.discoveries).toEqual([]);
  });
  it('拒绝来自更高版本游戏的存档', () => {
    expect(() => migrate({ schema: 99 })).toThrow(/高于当前/);
  });
  it('列表中损坏的槽位被标记而不是抛出', () => {
    const st = memoryStorage();
    const m = new SaveManager(st);
    st.setItem('redroom.save.2', '{not json');
    const list = m.list();
    expect(list.find((s) => s.slot === '2').corrupt).toBe(true);
    expect(list.find((s) => s.slot === '1').empty).toBe(true);
  });
  it('导入时先校验，坏文件不会覆盖槽位', () => {
    const m = new SaveManager(memoryStorage());
    m.save('3', { ...defaultState(), fragments: ['key'] });
    expect(() => m.importToSlot('3', '{"v":2,"sum":"00000000","body":"{}"}')).toThrow();
    expect(m.load('3').state.fragments).toEqual(['key']);
  });
  it('latest() 返回最近一次存档', async () => {
    const m = new SaveManager(memoryStorage());
    m.save('1', defaultState());
    await new Promise((r) => setTimeout(r, 5));
    m.save('auto', { ...defaultState(), chapter: 'ch2' });
    expect(m.latest().slot).toBe('auto');
  });
  it('未知槽位报错', () => {
    expect(() => new SaveManager(memoryStorage()).save('9', defaultState())).toThrow();
  });
});
