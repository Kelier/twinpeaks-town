// 人物与主题关联图：节点（人物 / 主题 / 作品）+ 边。作品节点 id 与 works.js 一致。
export const PEOPLE = [
  { id: 'lynch', label: '大卫·林奇', note: '导演、画家、音乐人、冥想者', center: true },
  { id: 'badalamenti', label: '安杰洛·巴达拉曼蒂', note: '作曲家（1937–2022），自《蓝丝绒》起长期合作' },
  { id: 'frost', label: '马克·弗罗斯特', note: '《双峰》联合创作者' },
  { id: 'maclachlan', label: '凯尔·麦克拉克伦', note: '演员，被视为林奇的“银幕替身”之一' },
  { id: 'dern', label: '劳拉·邓恩', note: '演员，多次合作' },
  { id: 'rossellini', label: '伊莎贝拉·罗西里尼', note: '演员' },
  { id: 'nance', label: '杰克·南斯', note: '演员（1943–1996），《橡皮头》主演' },
  { id: 'lee', label: '谢丽尔·李', note: '演员，劳拉·帕尔默的扮演者' },
  { id: 'watts', label: '娜奥米·沃茨', note: '演员' },
  { id: 'splet', label: '艾伦·斯普莱特', note: '音效设计师（1939–1994）' },
  { id: 'elmes', label: '弗雷德里克·埃尔姆斯', note: '摄影指导' },
  { id: 'deming', label: '彼得·德明', note: '摄影指导' },
  { id: 'sweeney', label: '玛丽·斯威尼', note: '剪辑师 / 制片人' },
  { id: 'norris', label: '帕特里夏·诺里斯', note: '服装与美术设计（1931–2015）' },
  { id: 'hurley', label: '迪恩·赫尔利', note: '音乐制作 / 声音' },
];

export const THEMES = [
  { id: 'dream', label: '梦境逻辑' },
  { id: 'duality', label: '双重身份' },
  { id: 'smalltown', label: '小镇表象之下' },
  { id: 'industry', label: '工业与机器' },
  { id: 'sound', label: '噪声与声音设计' },
  { id: 'stage', label: '帷幕与舞台' },
  { id: 'electricity', label: '电流' },
  { id: 'innocence', label: '失落的纯真' },
  { id: 'road', label: '公路' },
  { id: 'loop', label: '循环时间' },
  { id: 'body', label: '身体' },
  { id: 'fire', label: '火' },
  { id: 'coffee', label: '咖啡与日常仪式' },
  { id: 'hollywood', label: '好莱坞' },
  { id: 'family', label: '家庭' },
  { id: 'meditation', label: '冥想' },
];

// 人物 → 作品 的合作边（主题边由 works.js 的 themes 字段自动生成）
export const COLLAB = [
  ['badalamenti', ['blue-velvet', 'twin-peaks', 'wild-at-heart', 'fwwm', 'lost-highway', 'straight-story', 'mulholland', 'the-return']],
  ['frost', ['twin-peaks', 'the-return']],
  ['maclachlan', ['dune', 'blue-velvet', 'twin-peaks', 'fwwm', 'the-return']],
  ['dern', ['blue-velvet', 'wild-at-heart', 'inland-empire', 'the-return']],
  ['rossellini', ['blue-velvet', 'wild-at-heart']],
  ['nance', ['eraserhead', 'dune', 'blue-velvet', 'twin-peaks', 'wild-at-heart', 'lost-highway']],
  ['lee', ['twin-peaks', 'fwwm', 'the-return']],
  ['watts', ['mulholland', 'the-return']],
  ['splet', ['grandmother', 'eraserhead', 'elephant-man', 'dune', 'blue-velvet']],
  ['elmes', ['eraserhead', 'blue-velvet', 'wild-at-heart']],
  ['deming', ['lost-highway', 'mulholland', 'the-return']],
  ['sweeney', ['lost-highway', 'straight-story', 'mulholland']],
  ['norris', ['elephant-man', 'blue-velvet', 'wild-at-heart', 'twin-peaks', 'lost-highway']],
  ['hurley', ['the-return', 'crazy-clown']],
];

export function buildGraph(works) {
  const nodes = [
    ...PEOPLE.map((p) => ({ ...p, type: 'person' })),
    ...THEMES.map((t) => ({ ...t, type: 'theme' })),
    ...works.map((w) => ({ id: w.id, label: w.title, note: `${w.year} · ${w.kind}`, type: 'work' })),
  ];
  const edges = [];
  for (const w of works) {
    edges.push({ source: 'lynch', target: w.id, kind: 'made' });
    for (const t of w.themes) edges.push({ source: w.id, target: t, kind: 'theme' });
  }
  for (const [p, ws] of COLLAB) for (const w of ws) edges.push({ source: p, target: w, kind: 'collab' });
  return { nodes, edges };
}
