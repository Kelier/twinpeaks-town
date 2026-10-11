// 设置与可访问性选项，持久化到 localStorage。
const KEY = 'redroom.settings.v1';

export const DEFAULT_SETTINGS = {
  quality: 'auto', // auto | low | medium | high
  masterVolume: 0.8,
  musicVolume: 0.7,
  ambienceVolume: 0.8,
  sfxVolume: 0.8,
  monoAudio: false,
  subtitles: true,
  subtitleSize: 'm', // s | m | l
  muted: false,
  reducedMotion: false, // 关闭镜头晃动、推轨变焦、荷兰角等镜头运动
  reducedFlashing: false, // 关闭灯光闪烁、负片 / 雪花类转场
  showReticle: false, // 文档规范：默认不显示准星
  archiveAll: false,
  highContrast: false,
  invertY: false,
  lookSensitivity: 1,
  grain: true,
};

export function loadSettings(storage = globalThis.localStorage) {
  let s = { ...DEFAULT_SETTINGS };
  try {
    const raw = storage?.getItem(KEY);
    if (raw) s = { ...s, ...JSON.parse(raw) };
  } catch {}
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches && !storage?.getItem(KEY)) {
    s.reducedMotion = true;
    s.reducedFlashing = true;
  }
  return s;
}

export function saveSettings(s, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
  } catch {}
}
