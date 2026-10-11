// 章节规划与剧情文本。所有台词均为原创，不引用原作对白。
// 叙事原则：不解释、只暗示；每个梦境给出一枚“碎片”和一段档案解锁。

export const CHAPTERS = [
  { id: 'prologue', title: '序 · 入口', goal: '穿过幕布', music: 'silence' },
  { id: 'ch1', title: '第一章 · 等候室', goal: '查看房间里的物件，找到幕布的缝隙', music: 'explore' },
  { id: 'ch2', title: '第二章 · 三扇门', goal: '在三个梦境中各找回一枚碎片', music: 'explore' },
  { id: 'finale', title: '终章 · 回声', goal: '把三枚碎片放回小桌', music: 'finale' },
  { id: 'epilogue', title: '尾声', goal: '档案已全部解锁', music: 'finale' },
];

export const FRAGMENTS = {
  tape: { id: 'tape', name: '录像带', space: 'highway', glyph: '▮', archive: ['lost-highway', 'wild-at-heart', 'straight-story'] },
  key: { id: 'key', name: '蓝色钥匙', space: 'theater', glyph: '◆', archive: ['mulholland', 'inland-empire', 'blue-velvet'] },
  seed: { id: 'seed', name: '种子', space: 'radiator', glyph: '●', archive: ['eraserhead', 'grandmother', 'elephant-man'] },
};

export const SPACES = {
  town: { title: '梦境 · 小镇回声', year: '1990—2017 · 双峰', music: 'enter:theater', desc: '餐馆、旅馆和森林，三个地点里藏着同一段记忆。' },
  redroom: { title: '红房间', year: '1990 · 双峰', music: 'enter:redroom', desc: '红色幕布、黑白 Z 字地板、一把扶手椅。' },
  highway: { title: '梦境 · 夜路', year: '1997 · 妖夜慌踪', music: 'enter:highway', desc: '一条没有尽头的夜路，黄色中线不断涌来。' },
  theater: { title: '梦境 · 寂静剧场', year: '2001 · 穆赫兰道', music: 'enter:theater', desc: '空无一人的蓝色剧场，舞台上立着一支麦克风。' },
  radiator: { title: '梦境 · 散热器之室', year: '1977 · 橡皮头', music: 'enter:radiator', desc: '低矮的工业房间，管道嘶嘶作响。' },
};

// 交互台词：key = 物件 id；可按条件给出不同台词
export const LINES = {
  intro: [
    { who: '', text: '有些房间，需要先听见。' },
  ],
  lampNear: '［L］聆听',
  listenFirst: { who: '', text: '你屏住呼吸。灯泡的嗡鸣退到一边，幕布后面还有别的声音。' },
  tv: [{ who: '电视', text: '屏幕上只有雪花。偶尔有一帧画面闪过：一条走廊，一扇半开的门。' }],
  tvAfter: { who: '电视', text: '雪花变得很安静。屏幕里映出的是这间房间，只是椅子上坐着人。' },
  dreamDone: { who: '', text: '这里已经安静了。想醒来时，按 Esc 选择“醒来”。' },
  exit: { who: '', text: '幕布的另一边是夜色。你可以留下，也可以走出去。' },
  armchair: [
    { who: '扶手椅', text: '皮面还是温的。刚才坐在这里的人，好像只是去隔壁拿杯咖啡。' },
  ],
  armchairSit: { who: '', text: '你坐下。房间安静得能听见灯泡里的电流。' },
  lamp: { on: '［灯亮起］房间又回到原来的样子。至少看上去是。', off: '［灯熄灭］黑暗里，幕布的褶皱换了一种排列方式。' },
  statue: [
    { who: '小桌', text: '桌上立着一尊绿色的小雕像，头顶套着一圈土星环。' },
    { who: '小桌', text: '底座上刻着三个凹槽：一个长方形，一个菱形，一个圆。' },
  ],
  statueReady: { who: '小桌', text: '三个凹槽都等着被填满。' },
  curtainLocked: { who: '', text: '这一处的幕布摸起来像墙。灯太亮了，什么也听不见。' },
  curtainHint: { who: '', text: '关上灯，安静下来。幕布后面有三处声音，循着声音走过去。' },
  curtainDone: { who: '', text: '这扇门已经回答过你了，但它仍然开着。' },
  phonograph: { who: '留声机', text: '唱臂落下。没有音乐，只有一段段被整理好的往事。' },
  // 梦境
  highwayIntro: { who: '', text: '方向盘不在你手里，但车在动。停车后调查路牌。按 Tab 找到它，再按 E 阅读。' },
  highwayMarker: ['第一块标牌：一个地名，被雨水冲掉了一半。', '第二块标牌：“前方没有出口。”', '第三块标牌下面，放着一卷没有标签的录像带。'],
  theaterIntro: { who: '', text: '剧场里没有乐队，可音乐一直在响。舞台上的麦克风等着人去碰。' },
  theaterMic: { who: '麦克风', text: '你凑近麦克风。歌声仍在继续，可没有人在唱。一切都是录好的。' },
  theaterBox: { who: '', text: '包厢的扶手上放着一个蓝色小盒子。盒子是空的，钥匙就挂在锁孔上。' },
  radiatorIntro: { who: '', text: '散热器在唱歌，蒸汽很吵。按正确的顺序拧紧三个阀门，让它安静下来。' },
  radiatorWrong: { who: '', text: '蒸汽更响了。阀门全部回到了原位。' },
  radiatorStage: { who: '', text: '散热器的格栅后面露出一座小舞台。舞台中央放着一粒种子。' },
  finale: [
    { who: '', text: '三枚碎片嵌进底座。地板上的 Z 字纹开始缓慢流动。' },
    { who: '', text: '房间没有给出答案。它只是把梦还给了做梦的人。' },
    { who: '', text: '灯换了颜色，椅子空着。正对面的幕布第一次拉开了一道口子。' },
  ],
};

// 第二章开始后，按碎片数给出的环境提示
export function hintFor(state) {
  const n = state.fragments.length;
  if (state.chapter === 'ch1') return '调查扶手椅和小桌。［Tab］寻找物件；电视通向小镇支线。';
  if (state.chapter === 'epilogue') return '你可以留下，也可以走向出口。';
  if (state.chapter === 'finale') return '回到小桌，把碎片放回去。';
  if (n < 3) return `熄灯，按住［L］聆听，循声找到幕布的缝隙。（已找回 ${n}/3 枚碎片）`;
  return '';
}
