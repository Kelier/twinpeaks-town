// 主要作品档案。所有简介为原创撰写的概述，不含剧照与原片素材。
export const WORKS = [
  { id: 'six-men', year: 1967, title: '六个人生病（六次）', original: 'Six Men Getting Sick (Six Times)', kind: '实验动画', role: '导演', themes: ['body', 'loop'], summary: '在费城宾夕法尼亚美术学院时期完成的“会动的绘画”，循环播放的身体与警报声，是林奇“从绘画走向电影”的起点。', sources: ['S1', 'S7'] },
  { id: 'grandmother', year: 1970, title: '祖母', original: 'The Grandmother', kind: '短片', role: '导演/编剧', themes: ['family', 'dream', 'sound'], summary: '一个被冷落的男孩种出了自己的祖母。获美国电影学院资助，并首次与音效设计师艾伦·斯普莱特合作。', sources: ['S1', 'S9'] },
  { id: 'eraserhead', year: 1977, title: '橡皮头', original: 'Eraserhead', kind: '长片', role: '导演/编剧/剪辑/音效', themes: ['industry', 'sound', 'body', 'stage'], summary: '在美国电影学院历时数年拍成的黑白噩梦：工业噪声、散热器里唱歌的女人、一个无法安抚的婴儿。午夜场经典。', sources: ['S1', 'S2', 'S9'] },
  { id: 'elephant-man', year: 1980, title: '象人', original: 'The Elephant Man', kind: '长片', role: '导演/联合编剧', themes: ['body', 'innocence', 'industry'], summary: '维多利亚时代伦敦，一个畸形男子的尊严。获奥斯卡八项提名，包括最佳导演。', sources: ['S1', 'S4'] },
  { id: 'dune', year: 1984, title: '沙丘', original: 'Dune', kind: '长片', role: '导演/编剧', themes: ['dream', 'industry'], summary: '大制作科幻改编。林奇事后多次表示对最终剪辑缺乏控制。', sources: ['S1', 'S7'] },
  { id: 'blue-velvet', year: 1986, title: '蓝丝绒', original: 'Blue Velvet', kind: '长片', role: '导演/编剧', themes: ['smalltown', 'duality', 'innocence'], summary: '草坪上的一只断耳，揭开美国小镇表面之下的暴力。与作曲家安杰洛·巴达拉曼蒂的合作由此开始。获奥斯卡最佳导演提名。', sources: ['S1', 'S4'] },
  { id: 'wild-at-heart', year: 1990, title: '我心狂野', original: 'Wild at Heart', kind: '长片', role: '导演/编剧', themes: ['road', 'fire', 'innocence'], summary: '一对亡命恋人沿公路逃亡，处处是《绿野仙踪》的影子。获 1990 年戛纳电影节金棕榈。', sources: ['S1', 'S3'] },
  { id: 'twin-peaks', year: 1990, title: '双峰', original: 'Twin Peaks', kind: '电视剧（ABC，1990–1991）', role: '联合创作（与马克·弗罗斯特）/导演', themes: ['smalltown', 'duality', 'stage', 'dream', 'coffee', 'electricity'], summary: '“谁杀了劳拉·帕尔默？”一部改变美国电视的连续剧。红房间、Z 字地板与倒放的语言从这里进入流行文化。', sources: ['S1'] },
  { id: 'fwwm', year: 1992, title: '双峰：与火同行', original: 'Twin Peaks: Fire Walk with Me', kind: '长片', role: '导演/联合编剧', themes: ['duality', 'innocence', 'fire', 'electricity'], summary: '回到劳拉生命的最后七天。上映时争议很大，此后被重新评价。', warning: '内容提示：涉及家庭暴力、性侵与自我伤害等创伤题材。', sources: ['S1', 'S10'] },
  { id: 'lost-highway', year: 1997, title: '妖夜慌踪', original: 'Lost Highway', kind: '长片', role: '导演/联合编剧', themes: ['road', 'duality', 'loop'], summary: '一卷匿名录像带、一次身份断裂，黄色中线在夜色里无尽延伸。林奇称之为“心因性神游”。', sources: ['S1', 'S7'] },
  { id: 'straight-story', year: 1999, title: '史崔特先生的故事', original: 'The Straight Story', kind: '长片', role: '导演', themes: ['road', 'innocence', 'family'], summary: '一位老人骑着割草机横穿两个州去见他的哥哥。林奇最温柔的电影，由真人真事改编。', sources: ['S1'] },
  { id: 'mulholland', year: 2001, title: '穆赫兰道', original: 'Mulholland Drive', kind: '长片', role: '导演/编剧', themes: ['dream', 'duality', 'stage', 'hollywood'], summary: '好莱坞梦的两面。获 2001 年戛纳最佳导演（与乔尔·科恩并列）及奥斯卡最佳导演提名。剧中的“寂静俱乐部”一场常被引用。', sources: ['S1', 'S3', 'S4'] },
  { id: 'inland-empire', year: 2006, title: '内陆帝国', original: 'Inland Empire', kind: '长片', role: '导演/编剧/摄影', themes: ['dream', 'loop', 'hollywood', 'stage'], summary: '用标清数字摄像机拍摄的近三小时迷宫。迄今为止林奇的最后一部长片。', sources: ['S1'] },
  { id: 'crazy-clown', year: 2011, title: '疯狂小丑时间', original: 'Crazy Clown Time', kind: '音乐专辑', role: '词曲/演唱', themes: ['sound', 'electricity'], summary: '林奇的首张个人录音室专辑，布鲁斯与电子噪声交织。', sources: ['S8'] },
  { id: 'the-return', year: 2017, title: '双峰：回归', original: 'Twin Peaks: The Return', kind: '限定剧（Showtime，18 集）', role: '联合创作/导演全部集数', themes: ['duality', 'loop', 'electricity', 'stage', 'dream'], summary: '时隔二十五年的回归，整体被视为一部 18 小时的电影。第 8 集是电视史上最激进的一小时之一。', sources: ['S1'] },
  { id: 'room-to-dream', year: 2018, title: '梦之空间', original: 'Room to Dream', kind: '书籍', role: '合著（与克里斯汀·麦肯纳）', themes: ['dream', 'meditation'], summary: '传记与回忆录交错的写法：一章由麦肯纳的采访写成，下一章由林奇本人回应。', sources: ['S2'] },
  { id: 'what-did-jack-do', year: 2017, title: '杰克做了什么？', original: 'What Did Jack Do?', kind: '短片', role: '导演/编剧/主演', themes: ['loop', 'stage', 'coffee'], summary: '火车站咖啡馆里，侦探审问一只猴子。黑白短片，2020 年在 Netflix 上线。', sources: ['S1'] },
  // —— 实验室 / 其他创作 ——
  { id: 'alphabet', year: 1968, title: '字母', original: 'The Alphabet', kind: '短片', role: '导演', themes: ['body', 'dream'], summary: '真人与动画结合的约四分钟短片，源自一场关于“学习字母”的噩梦。', sources: ['S1', 'S7'] },
  { id: 'industrial-symphony', year: 1989, title: '工业交响曲 1 号', original: 'Industrial Symphony No. 1', kind: '舞台演出 / 影像', role: '导演（与巴达拉曼蒂合作）', themes: ['stage', 'industry', 'sound'], summary: '1989 年在布鲁克林音乐学院上演的舞台作品，主唱为朱莉·克鲁斯，1990 年发行为影像。', sources: ['S1'] },
  { id: 'on-the-air', year: 1992, title: '直播中', original: 'On the Air', kind: '电视喜剧（ABC）', role: '联合创作（与马克·弗罗斯特）', themes: ['stage', 'electricity'], summary: '1950 年代电视直播节目幕后的荒诞喜剧，仅播出数集。', sources: ['S1'] },
  { id: 'hotel-room', year: 1993, title: '旅馆房间', original: 'Hotel Room', kind: '电视选集剧（HBO）', role: '联合创作 / 导演部分集', themes: ['loop', 'stage'], summary: '同一间纽约旅馆客房在不同年代发生的三个故事。', sources: ['S1'] },
  { id: 'rabbits', year: 2002, title: '兔子', original: 'Rabbits', kind: '网络短片系列', role: '导演 / 编剧', themes: ['loop', 'stage', 'dream'], summary: '三只人形兔子在客厅里说着前后错位的台词，伴随罐头笑声。部分片段后来进入《内陆帝国》。', sources: ['S1'] },
  { id: 'dumbland', year: 2002, title: '笨土地', original: 'Dumbland', kind: '网络动画系列', role: '导演 / 配音 / 动画', themes: ['body', 'family'], summary: '粗粝的线条动画，在林奇的个人网站上发布。', sources: ['S1'] },
  { id: 'air-on-fire', year: 2007, title: '空气着火了', original: 'The Air Is on Fire', kind: '艺术展（巴黎卡地亚基金会）', role: '画家 / 摄影 / 装置', themes: ['body', 'fire', 'dream'], summary: '林奇首次大型个展，集中展示数十年的绘画、素描、摄影与影像。', sources: ['S1'] },
  { id: 'factory-photos', year: 2014, title: '工厂摄影', original: 'The Factory Photographs', kind: '摄影集', role: '摄影', themes: ['industry'], summary: '林奇多年来在欧美各地拍摄的废弃工厂黑白照片。', sources: ['S1'] },
  { id: 'big-dream', year: 2013, title: '大梦', original: 'The Big Dream', kind: '音乐专辑', role: '词曲 / 演唱', themes: ['sound', 'dream'], summary: '第二张个人录音室专辑，以慢速“现代布鲁斯”为基调。', sources: ['S8'] },
  { id: 'cellophane', year: 2024, title: '玻璃纸记忆', original: 'Cellophane Memories', kind: '音乐专辑', role: '合作（与 Chrystabell）', themes: ['sound', 'dream'], summary: '与歌手 Chrystabell 合作的专辑，发行于林奇生前最后一年。', sources: ['S8'] },
];

// 媒介分类：内容系统允许不同媒介并存，而不是只有电影年表
export const MEDIA = { film: '长片', tv: '电视', short: '短片与网络影像', music: '音乐', art: '绘画 · 摄影 · 舞台', book: '书籍' };
export function mediumOf(w) {
  const k = w.kind;
  if (k === '长片') return 'film';
  if (/电视|限定剧/.test(k)) return 'tv';
  if (/短片|动画|网络/.test(k)) return 'short';
  if (/音乐/.test(k)) return 'music';
  if (/书籍/.test(k)) return 'book';
  return 'art';
}
