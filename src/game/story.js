// Story graph in broadcast order (Season 1 → Season 2). Choices and clues branch the outcome; endings depend on them.
// Paraphrased, original dialogue throughout; episode labels follow the 1990–91 ABC run (pilot counted as S1E1).
import { T } from './i18n.js';

export const ORDER = ['shore', 'diner', 'station', 'dream', 'cabin', 'palmer', 'hotel', 'roadhouse', 'cell', 'forest', 'redroom'];

export const EPISODES = {
  shore: 'S1 · E1', diner: 'S1 · E2', station: 'S1 · E3', dream: 'S1 · E3', cabin: 'S1 · E4', palmer: 'S1 · E5',
  hotel: 'S1 · E8 → S2 · E1', roadhouse: 'S2 · E7', cell: 'S2 · E9', forest: 'S2 · E22', redroom: 'S2 · E22',
};

// straight broadcast order; a crossroads can still offer a detour (the act chosen first is played, the other follows)
export const NEXT = Object.fromEntries(ORDER.slice(0, -1).map((id, i) => [id, ORDER[i + 1]]));
export const CROSSROADS = {};

export const CLUES = {
  plastic: () => T('裹在塑料布里（湖岸）', 'Wrapped in plastic (the lakeshore)'),
  audrey: () => T('奥黛丽的信任（双 R 餐馆）', 'Audrey’s trust (the Double R)'),
  sketch: () => T('BOB 的画像（警长办公室）', 'The sketch of BOB (the station)'),
  dream: () => T('记住了梦里的低语（红房间之梦）', 'You remembered the whisper (the dream)'),
  owl: () => T('猫头鹰并非它们看起来的样子（木头女士）', 'The owls are not what they seem (the Log Lady)'),
  record: () => T('利兰停不下来的那首歌（帕默家）', 'The song Leland cannot stop (the Palmer house)'),
  fan: () => T('天花板上的吊扇（帕默家）', 'The ceiling fan (the Palmer house)'),
  vision: () => T('“又发生了。”（巨人在酒吧现身）', '“It is happening again.” (the Giant at the Roadhouse)'),
  light: () => T('你陪他走向了光（拘留室）', 'You walked him into the light (the cell)'),
};

export function newStory() { return { visited: [], clues: {}, picks: {} }; }
export const insight = (story) => Object.keys(story.clues).length;

export function endingFor(story, { chosenRight }) {
  const n = insight(story);
  if (chosenRight && n >= 7) return 'twentyfive';
  if (chosenRight && story.clues.audrey && n >= 4) return 'wake';
  return 'annie';
}

export const ENDINGS = {
  annie: {
    title: () => T('安妮还好吗？', 'How’s Annie?'),
    lines: () => [T('帘幕后面，是另一间一模一样的红房间。', 'Behind the curtain is another red room, exactly the same.'), T('镜子里的人，用你的脸笑了。', 'The man in the mirror smiles with your face.'), T('「安妮还好吗？」', '“How’s Annie?”')],
    note: () => T('结局一 · 镜中人 —— 线索太少，你走出了红房间，但出来的不是你。', 'Ending I · The Mirror — too few pieces; someone walked out of the red room, but it was not you.'),
  },
  wake: {
    title: () => T('梦醒', 'Waking'),
    lines: () => [T('你听见有人敲门。', 'Someone knocks at the door.'), T('晨光里，奥黛丽站在 315 房门口，手里端着一杯咖啡。', 'In the morning light Audrey stands at room 315 with a cup of coffee.'), T('「你在梦里说话了。」', '“You were talking in your sleep.”')],
    note: () => T('结局二 · 晨光 —— 有人记得你，所以你醒得过来。', 'Ending II · Daylight — someone remembered you, so you could wake.'),
  },
  twentyfive: {
    title: () => T('二十五年后见', 'See You in 25 Years'),
    lines: () => [T('劳拉靠近你，低声说了一句话。这一次，你听清了。', 'Laura leans close and whispers. This time you hear it.'), T('「我会在二十五年后再见到你。」', '“I’ll see you again in twenty-five years.”'), T('巨人把戒指放回你的掌心。', 'The Giant places the ring back in your palm.')],
    note: () => T('结局三 · 低语 —— 你收集到了足够多的碎片，梦把答案还给了你。', 'Ending III · The Whisper — you gathered enough pieces, and the dream gave the answer back.'),
  },
};
