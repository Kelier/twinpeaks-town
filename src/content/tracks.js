// 配乐目录与授权台账。
// 原声曲目是“授权目标”，在所有权利都 cleared 之前，加载器一律拒绝播放，正式构建只播放原创配乐。
// 本模型只用于内部追踪，不构成法律意见；真实权利人与授权范围须由专业人员逐曲核实。

export const RIGHTS = ['pending', 'cleared', 'rejected'];

// 候选原声（授权目标，均未取得授权）
export const CANDIDATE_TRACKS = [
  { id: 'tp-theme', title: 'Twin Peaks Theme', artist: 'Angelo Badalamenti', album: 'Soundtrack from Twin Peaks (1990)', use: '标题画面、首次进入红房间、终章', state: 'explore' },
  { id: 'laura-theme', title: "Laura Palmer's Theme", artist: 'Angelo Badalamenti', album: 'Soundtrack from Twin Peaks (1990)', use: '记忆档案、碎片揭示后的静止镜头', state: 'revelation' },
  { id: 'falling', title: 'Falling', artist: 'Julee Cruise（曲：Badalamenti / 词：Lynch）', album: 'Floating into the Night (1989)', use: '红幕空间、章节入口、结尾回望', state: 'finale' },
  { id: 'audreys-dance', title: "Audrey's Dance", artist: 'Angelo Badalamenti', album: 'Soundtrack from Twin Peaks (1990)', use: '小镇探索（第 3 阶段章节）', state: null },
  { id: 'dream-man', title: 'Dance of the Dream Man', artist: 'Angelo Badalamenti', album: 'Soundtrack from Twin Peaks (1990)', use: '梦境谜题（散热器之室）', state: 'dream_radiator' },
  { id: 'nightingale', title: 'The Nightingale', artist: 'Julee Cruise', album: 'Floating into the Night (1989)', use: '夜路远景中的远方歌声', state: 'dream_highway' },
].map((t) => ({
  ...t,
  origin: 'licensed',
  rights: { compositionLicense: 'pending', masterLicense: 'pending', syncPermission: 'pending', editPermission: 'pending', territories: [], allowedUse: [], expiryDate: null },
  rightsHolders: '待核实（出版商 / 词曲作者 / 唱片公司 / 演出者）',
}));

// 原创配乐：项目内实时合成，权利归本项目所有
const ORIGINAL = (id, title, state, mood) => ({
  id, title, artist: '本项目原创（WebAudio 程序化合成）', origin: 'original', state, use: mood,
  rights: { compositionLicense: 'cleared', masterLicense: 'cleared', syncPermission: 'cleared', editPermission: 'cleared', territories: ['WORLD'], allowedUse: ['game', 'web', 'trailer'], expiryDate: null },
  rightsHolders: '本项目',
});
export const ORIGINAL_TRACKS = [
  ORIGINAL('o-waiting-room', '等候室（Dm9 慢爵士）', 'explore', '红房间漫游'),
  ORIGINAL('o-unease', '不安（低频脉动）', 'tension', '熄灯后'),
  ORIGINAL('o-night-road', '夜路（E 弗里几亚持续音）', 'dream_highway', '梦境 · 夜路'),
  ORIGINAL('o-silent-theater', '寂静剧场（无人演唱的旋律）', 'dream_theater', '梦境 · 剧场'),
  ORIGINAL('o-radiator', '散热器（全音阶金属声）', 'dream_radiator', '梦境 · 散热器'),
  ORIGINAL('o-reveal', '揭示（钟声和弦）', 'revelation', '找回碎片'),
  ORIGINAL('o-echo', '回声（D 大调终章）', 'finale', '终章'),
];

export function isCleared(track) {
  const r = track.rights;
  return ['compositionLicense', 'masterLicense', 'syncPermission', 'editPermission'].every((k) => r[k] === 'cleared')
    && (!r.expiryDate || new Date(r.expiryDate) > new Date());
}

// 加载器的唯一入口：某个音乐状态应播放哪条音轨。
// 授权音轨只有全部 cleared 且地区允许时才会被选中，否则回落到原创配乐。
export function resolveTrack(state, { territory = 'CN', catalog = [...CANDIDATE_TRACKS, ...ORIGINAL_TRACKS] } = {}) {
  const licensed = catalog.find((t) => t.state === state && t.origin === 'licensed' && isCleared(t)
    && (t.rights.territories.includes('WORLD') || t.rights.territories.includes(territory)));
  if (licensed) return licensed;
  return catalog.find((t) => t.state === state && t.origin === 'original') ?? null;
}
