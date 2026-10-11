// 生涯时间线。每条记录都带来源编号与核对状态。
// verified: 'checked' = 2026-10-09 已对照 S1 核对；'pending' = 编辑整理，发布前需对照原始来源复核。
export const TIMELINE = [
  { date: '1946-01-20', title: '出生于蒙大拿州米苏拉', detail: '父亲是美国农业部的研究科学家，童年随家人多次搬迁（爱达荷州、华盛顿州、弗吉尼亚州等）。', sources: ['S1', 'S2'], verified: 'checked', tag: 'life' },
  { date: '1964', title: '先后就读科科伦艺术学院与波士顿美术馆学院', detail: '在波士顿学习约一年后退学，随后短暂旅居欧洲。', sources: ['S1', 'S2'], verified: 'checked', tag: 'life' },
  { date: '1966', title: '进入宾夕法尼亚美术学院（费城）', detail: '林奇日后多次把费城描述为对他影响最深的城市之一。', sources: ['S1', 'S7'], verified: 'pending', tag: 'art' },
  { date: '1967', title: '《六个人生病（六次）》', detail: '一幅“会动的绘画”，在学院展览中循环放映。', sources: ['S1', 'S7'], verified: 'pending', tag: 'film', work: 'six-men' },
  { date: '1968', title: '短片《字母》', detail: '真人与动画结合的短片。', sources: ['S1'], verified: 'pending', tag: 'film' },
  { date: '1970', title: '《祖母》；进入美国电影学院（AFI）', detail: '凭《祖母》获得 AFI 资助，同年开始在 AFI 高级电影研究中心学习。', sources: ['S1', 'S9'], verified: 'checked', tag: 'film', work: 'grandmother' },
  { date: '1977', title: '《橡皮头》首映', detail: '拍摄断断续续进行了约五年，后来成为午夜场经典。', sources: ['S1', 'S9'], verified: 'checked', tag: 'film', work: 'eraserhead' },
  { date: '1980', title: '《象人》', detail: '获奥斯卡八项提名，林奇首次获得最佳导演提名。', sources: ['S1', 'S4'], verified: 'checked', tag: 'award', work: 'elephant-man' },
  { date: '1984', title: '《沙丘》', detail: '林奇后来与该片的最终剪辑保持距离。', sources: ['S1'], verified: 'checked', tag: 'film', work: 'dune' },
  { date: '1986', title: '《蓝丝绒》', detail: '与安杰洛·巴达拉曼蒂开始长期合作；第二次获得奥斯卡最佳导演提名。', sources: ['S1', 'S4'], verified: 'checked', tag: 'film', work: 'blue-velvet' },
  { date: '1990-04', title: '《双峰》在 ABC 首播', detail: '与马克·弗罗斯特联合创作，共播出两季（1990–1991）。', sources: ['S1'], verified: 'checked', tag: 'tv', work: 'twin-peaks' },
  { date: '1990-05', title: '《我心狂野》获戛纳金棕榈', detail: '第 43 届戛纳电影节。', sources: ['S1', 'S3'], verified: 'checked', tag: 'award', work: 'wild-at-heart' },
  { date: '1992', title: '《双峰：与火同行》', detail: '剧集的前传电影，在戛纳首映。', sources: ['S1'], verified: 'pending', tag: 'film', work: 'fwwm' },
  { date: '1997', title: '《妖夜慌踪》', detail: '与巴里·吉福德合写剧本。', sources: ['S1', 'S7'], verified: 'pending', tag: 'film', work: 'lost-highway' },
  { date: '1999', title: '《史崔特先生的故事》', detail: '林奇唯一一部完全没有参与编剧的长片，由真实事件改编（编剧：约翰·罗奇、玛丽·斯威尼）。', sources: ['S1'], verified: 'checked', tag: 'film', work: 'straight-story' },
  { date: '2001-05', title: '《穆赫兰道》获戛纳最佳导演', detail: '与乔尔·科恩（《缺席的人》）并列；同片后获奥斯卡最佳导演提名。', sources: ['S1', 'S3', 'S4'], verified: 'checked', tag: 'award', work: 'mulholland' },
  { date: '2005', title: '成立大卫·林奇基金会', detail: '推广超觉静坐（Transcendental Meditation）教育。林奇自 1973 年起每日冥想。', sources: ['S6', 'S2'], verified: 'pending', tag: 'life' },
  { date: '2006', title: '《内陆帝国》；威尼斯终身成就金狮奖', detail: '《内陆帝国》在威尼斯电影节首映，林奇同届获颁终身成就金狮奖。', sources: ['S1', 'S5'], verified: 'pending', tag: 'award', work: 'inland-empire' },
  { date: '2011', title: '首张个人专辑《疯狂小丑时间》', detail: '由 Sacred Bones Records 发行。', sources: ['S8'], verified: 'pending', tag: 'music', work: 'crazy-clown' },
  { date: '2013', title: '第二张专辑《大梦》（The Big Dream）', detail: '', sources: ['S8'], verified: 'pending', tag: 'music' },
  { date: '2017', title: '短片《杰克做了什么？》', detail: '2020 年 1 月在 Netflix 上线。', sources: ['S1'], verified: 'pending', tag: 'film', work: 'what-did-jack-do' },
  { date: '2017-05-21', title: '《双峰：回归》在 Showtime 首播', detail: '共 18 集，全部由林奇执导。', sources: ['S1'], verified: 'checked', tag: 'tv', work: 'the-return' },
  { date: '2018', title: '出版《梦之空间》', detail: '与克里斯汀·麦肯纳合著。', sources: ['S1', 'S2'], verified: 'checked', tag: 'art', work: 'room-to-dream' },
  { date: '2019-10-27', title: '获奥斯卡荣誉奖', detail: '在第 11 届理事会奖（Governors Awards）颁发。', sources: ['S4'], verified: 'pending', tag: 'award' },
  { date: '2022', title: '在《造梦之家》中客串约翰·福特', detail: '史蒂文·斯皮尔伯格执导。', sources: ['S1'], verified: 'checked', tag: 'film' },
  { date: '2024-08', title: '公开肺气肿诊断', detail: '在接受《视与听》采访时提及；同年与 Chrystabell 合作发行专辑《Cellophane Memories》。', sources: ['S11', 'S8'], verified: 'pending', tag: 'life' },
  { date: '2025-01-16', title: '于洛杉矶去世', detail: '享年 78 岁，距 79 岁生日四天。', sources: ['S1', 'S12'], verified: 'checked', tag: 'life' },
];

export const TAGS = {
  life: '人生', art: '艺术', film: '电影', tv: '电视', award: '荣誉', music: '音乐',
};
