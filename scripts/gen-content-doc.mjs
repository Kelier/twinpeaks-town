// 从游戏内容数据生成《内容档案与来源记录》文档，保证文档与游戏内数据完全一致。
import fs from 'node:fs';
import { WORKS, MEDIA, mediumOf } from '../src/content/works.js';
import { TIMELINE, TAGS } from '../src/content/timeline.js';
import { SOURCES } from '../src/content/sources.js';
import { PEOPLE, THEMES, COLLAB, buildGraph } from '../src/content/graph.js';
import { FRAGMENTS } from '../src/content/chapters.js';
import { CANDIDATE_TRACKS, ORIGINAL_TRACKS } from '../src/content/tracks.js';

const themeLabel = Object.fromEntries(THEMES.map((t) => [t.id, t.label]));
const lockBy = {};
for (const f of Object.values(FRAGMENTS)) for (const w of f.archive) lockBy[w] = f.name;
const g = buildGraph(WORKS);
const checked = TIMELINE.filter((t) => t.verified === 'checked').length;
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');

let md = `# 05 · 内容档案与来源记录

> 本文件由 \`scripts/gen-content-doc.mjs\` 根据 \`src/content/*\` 自动生成，请勿手工修改。生成时间：${new Date().toISOString().slice(0, 10)}。

## 1. 概览

| 项目 | 数量 |
|---|---|
| 作品档案 | ${WORKS.length} 部（${Object.entries(MEDIA).map(([k, v]) => `${v} ${WORKS.filter((w) => mediumOf(w) === k).length}`).join(' · ')}） |
| 人物 | ${PEOPLE.length} 位 |
| 母题 | ${THEMES.length} 个 |
| 关系图 | ${g.nodes.length} 个节点 · ${g.edges.length} 条边 |
| 生涯时间线 | ${TIMELINE.length} 条（已核对 ${checked} 条 · 待复核 ${TIMELINE.length - checked} 条） |
| 来源 | ${Object.keys(SOURCES).length} 个 |

**审核状态说明**：\`已核对\` = 2026-10-09 已对照 S1 等来源核对日期与事实；\`待复核\` = 编辑整理，公开发布前必须对照原始来源复核。所有作品简介均为原创撰写的概述，不含剧照、原片素材或原作对白。

## 2. 作品档案

| 年份 | 作品 | 原名 | 媒介 | 林奇职务 | 母题 | 游戏内解锁 | 来源 |
|---|---|---|---|---|---|---|---|
${WORKS.slice().sort((a, b) => a.year - b.year).map((w) => `| ${w.year} | ${esc(w.title)}${w.warning ? ' ⚠' : ''} | *${esc(w.original)}* | ${MEDIA[mediumOf(w)]} | ${esc(w.role)} | ${w.themes.map((t) => themeLabel[t]).join('、')} | ${lockBy[w.id] ? `碎片「${lockBy[w.id]}」` : '初始可见'} | ${w.sources.join(' ')} |`).join('\n')}

⚠ = 带内容提示。

### 2.1 作品简介（无剧透）

${WORKS.slice().sort((a, b) => a.year - b.year).map((w) => `- **${w.title}**（${w.year}）：${w.summary}${w.warning ? `\n  - ${w.warning}` : ''}`).join('\n')}

### 2.2 作品内容模板与完成度

| 模块 | 必填要求 | 当前状态 |
|---|---|---|
| 基本资料 | 原名、中文名、年份、类型、职务 | ✅ ${WORKS.length}/${WORKS.length} |
| 无剧透介绍 | 100–200 字 | ✅ 已有简介（多数短于 100 字，第 3 阶段扩写） |
| 完整剧情回顾 | 起因、冲突、转折、结局 | ⏳ 0/${WORKS.filter((w) => mediumOf(w) === 'film').length} 部长片（第 3 阶段；界面已有剧透开关与占位） |
| 人物关系 | 核心人物与合作者 | ✅ 合作者已建模；虚构角色关系待第 3 阶段 |
| 母题解读 | 主题、重复意象 | ✅ 母题标签已关联 |
| 创作背景 | 可核实的制作历程 | ⏳ 部分写入简介 |
| 互动体验 | 场景入口、调查对象 | ✅ 《橡皮头》《妖夜慌踪》《穆赫兰道》各有梦境空间；《双峰》为红房间 |
| 声音设计 | 音乐候选、授权状态 | ✅ 见 04 音频文档 |
| 参考资料 | 来源、审核状态 | ✅ 每部作品至少一个来源 |

## 3. 人物与主题关联图

### 3.1 人物

| 人物 | 说明 | 合作作品 |
|---|---|---|
${PEOPLE.map((p) => `| ${p.label} | ${esc(p.note)} | ${p.center ? '全部' : (COLLAB.find(([id]) => id === p.id)?.[1] ?? []).map((id) => WORKS.find((w) => w.id === id)?.title).join('、')} |`).join('\n')}

### 3.2 母题 → 作品

| 母题 | 关联作品 |
|---|---|
${THEMES.map((t) => `| ${t.label} | ${WORKS.filter((w) => w.themes.includes(t.id)).map((w) => w.title).join('、') || '—'} |`).join('\n')}

## 4. 完整生涯时间线

| 日期 | 事件 | 说明 | 类别 | 来源 | 状态 |
|---|---|---|---|---|---|
${TIMELINE.map((t) => `| ${t.date} | ${esc(t.title)} | ${esc(t.detail)} | ${TAGS[t.tag]} | ${t.sources.join(' ')} | ${t.verified === 'checked' ? '已核对' : '待复核'} |`).join('\n')}

## 5. 来源台账

| 编号 | 来源 | 类型 | 链接 |
|---|---|---|---|
${Object.entries(SOURCES).map(([k, s]) => `| ${k} | ${esc(s.title)} | ${s.type} | ${s.url} |`).join('\n')}

## 6. 配乐目录（摘要，详见 04 音频文档）

- 候选原声 ${CANDIDATE_TRACKS.length} 首：全部为 **pending（未授权）**，正式构建中不会播放。
- 原创配乐 ${ORIGINAL_TRACKS.length} 段：本项目程序化合成，权利归本项目。

## 7. 编辑规则

1. 每条事实陈述必须带来源编号；无法找到来源的内容不得发布。
2. 区分事实与解读：作品“解读”只描述可观察的叙事和视觉线索，不把任何一种解读标为导演唯一认可的答案。
3. 涉及创伤、暴力内容的作品必须带内容提示（目前：《双峰：与火同行》）。
4. 剧情回顾与可玩内容分开；完整剧情默认折叠，需玩家主动展开。
5. 不使用剧照、原片截图、原声录音与原作对白；人物与作品名称仅在评论与介绍语境中使用。
`;
fs.writeFileSync('docs/05-content-archive.md', md);
console.log('docs/05-content-archive.md', md.length, 'chars');
