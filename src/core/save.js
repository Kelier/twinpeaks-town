// 存档系统：多槽位 + 自动存档 + 版本迁移 + 校验和 + 导入/导出。
// 纯逻辑模块，storage 可注入（测试时用内存实现）。

export const SCHEMA_VERSION = 2;
export const SLOTS = ['auto', '1', '2', '3'];
const PREFIX = 'redroom.save.';

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function defaultState() {
  return {
    schema: SCHEMA_VERSION,
    chapter: 'prologue',
    space: 'redroom',
    fragments: [],
    flags: {},
    archive: [],
    discoveries: [], // 发现记录：{ id, label, space, at }
    playTime: 0,
    position: { x: 0, y: 1.6, z: 3.2 },
    yaw: 0,
  };
}

// 迁移表：key 为源版本，返回下一版本的数据
const MIGRATIONS = {
  1: (d) => {
    const { keys = [], room = 'redroom', ...rest } = d;
    return { ...rest, schema: 2, fragments: keys, space: room, archive: rest.archive ?? [] };
  },
};

export function migrate(data) {
  let d = { ...data };
  let guard = 0;
  while ((d.schema ?? 1) < SCHEMA_VERSION) {
    const v = d.schema ?? 1;
    const fn = MIGRATIONS[v];
    if (!fn || guard++ > 10) throw new Error(`无法从存档版本 ${v} 迁移`);
    d = fn(d);
  }
  if (d.schema > SCHEMA_VERSION) throw new Error(`存档版本 ${d.schema} 高于当前游戏版本`);
  return { ...defaultState(), ...d };
}

export function serialize(state) {
  const data = { ...state, schema: SCHEMA_VERSION };
  const body = JSON.stringify(data);
  return JSON.stringify({ v: SCHEMA_VERSION, sum: fnv1a(body), savedAt: Date.now(), body });
}

export function deserialize(raw) {
  const env = JSON.parse(raw);
  if (typeof env.body !== 'string') throw new Error('存档格式无效');
  if (fnv1a(env.body) !== env.sum) throw new Error('存档校验失败（文件可能被修改或损坏）');
  return { state: migrate(JSON.parse(env.body)), savedAt: env.savedAt };
}

export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

export class SaveManager {
  constructor(storage = globalThis.localStorage ?? memoryStorage()) {
    this.storage = storage;
  }
  save(slot, state) {
    if (!SLOTS.includes(slot)) throw new Error(`未知槽位 ${slot}`);
    try {
      this.storage.setItem(PREFIX + slot, serialize(state));
      return true;
    } catch (e) {
      console.warn('存档写入失败', e);
      return false;
    }
  }
  load(slot) {
    const raw = this.storage.getItem(PREFIX + slot);
    if (!raw) return null;
    return deserialize(raw);
  }
  // 读取时损坏的槽位不会抛出，而是标记 corrupt
  list() {
    return SLOTS.map((slot) => {
      try {
        const r = this.load(slot);
        return r ? { slot, savedAt: r.savedAt, state: r.state } : { slot, empty: true };
      } catch (e) {
        return { slot, corrupt: true, error: e.message };
      }
    });
  }
  remove(slot) {
    this.storage.removeItem(PREFIX + slot);
  }
  latest() {
    return this.list()
      .filter((s) => s.state)
      .sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
  }
  exportSlot(slot) {
    return this.storage.getItem(PREFIX + slot);
  }
  importToSlot(slot, raw) {
    const { state } = deserialize(raw); // 先校验
    return this.save(slot, state);
  }
}
