// 贴纸美术：手绘矢量模切贴纸（原创插画，无剧照/无对白引用）。
// 用法：import './stickers.css'; import { stickerHTML } from './stickers.js';
//   el.innerHTML = stickerHTML('coffee', { size: 96, cls: 'holo', label: true });
// 每次渲染的渐变/滤镜/遮罩 id 都带自增后缀，同页多次渲染互不冲突。

const K = '#171416'; // ink
const PL = '#f5f3ed'; // paperLight
const PD = '#d3ccbe'; // paper shade
const R = '#6e101c'; // oxblood
const RB = '#ad3544'; // redBright
const B = '#111113'; // stripe black
const W = '#f0efeb'; // stripe white
const PINE = '#2b443b';
const PINE2 = '#41634f';
const AM = '#e1ac6c'; // amber
const BRASS = '#b6955e';
const BRASS2 = '#e2c88f';
const BL = '#465f68';
const WOOD = '#6b3f24';
const WOOD2 = '#8a5532';
const MONO = "'Courier New',monospace";
const SERIF = 'Georgia,serif';

let uid = 0;

const T = (x, y, size, txt, fill, { font = MONO, weight = 700, anchor = 'middle', ls = 0, extra = '' } = {}) =>
  `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" stroke="none" text-anchor="${anchor}" letter-spacing="${ls}" ${extra}>${txt}</text>`;

// 双线描边：外圈墨线 + 内色，用于把手、蒸汽、茎秆等线状结构
const dbl = (d, color, w = 4, inkW = w + 3.2) =>
  `<path d="${d}" stroke="${K}" stroke-width="${inkW}" fill="none"/><path d="${d}" stroke="${color}" stroke-width="${w}" fill="none"/>`;

// ---------------------------------------------------------------- 插画
const ART = {
  coffee: () => `
    <ellipse cx="58" cy="100" rx="44" ry="9.5" fill="${PL}"/>
    <ellipse cx="58" cy="98.5" rx="27" ry="4.6" fill="${PD}" stroke="none"/>
    ${dbl('M81 59c18-4 21 27 -1 30', PL, 6.5, 13)}
    <path d="M28 46h57l-4.4 46.5q-.7 6.5-7.4 6.5H40q-6.6 0-7.4-6.5z" fill="${PL}"/>
    <path d="M72.5 48h11l-3.9 44.2q-.6 5.6-5.6 6.3H67q5.2-2 5.6-8.5z" fill="${PD}" stroke="none"/>
    <path d="M29.3 60.5h54.4l-1.1 14H30.4z" fill="${R}"/>
    ${T(56.5, 70.3, 7.6, 'DAMN GOOD', PL, { ls: 0.4 })}
    <ellipse cx="56.5" cy="46" rx="28.5" ry="6.4" fill="${PL}"/>
    <ellipse cx="56.5" cy="46.6" rx="23.5" ry="4" fill="#3d2216" stroke="none"/>
    <path d="M41 47.4q9-2.6 19-1.4" stroke="#8a5534" stroke-width="1.6"/>
    ${dbl('M44 36c-6-6 4-9 0-15s3-9 1-12', PL, 2.6, 6.4)}
    ${dbl('M57 37c-6-7 5-10 0-18s4-10 1-14', PL, 2.6, 6.4)}
    ${dbl('M70 36c-5-5 4-8 0-13s3-8 1-10', PL, 2.6, 6.4)}`,

  pie: (u) => `
    <defs><clipPath id="pc${u}"><path d="M14 79L74 35L106 61z"/></clipPath></defs>
    <ellipse cx="60" cy="93" rx="50" ry="13" fill="${PL}"/>
    <ellipse cx="60" cy="91" rx="38" ry="7.5" fill="none" stroke="${PD}" stroke-width="2"/>
    <path d="M14 79L106 61v16q0 4-4.5 5L19 97q-5 .8-5-4z" fill="${AM}"/>
    <path d="M15 81.5L105 64v6.5q-5 4-9 1.2q-4 4.5-9 2q-4 5-9 2.6q-5 4.6-10 3q-4 5-9.5 3.4q-5 4.6-10 3.6q-5 4.4-10 3.5q-5 4-9 2.6q-4 3-6 2.4z" fill="${RB}" stroke="none"/>
    <path d="M18 96.4L102 81" stroke="#b9824a" stroke-width="1.6"/>
    <path d="M14 79L74 35L106 61z" fill="${R}"/>
    <g clip-path="url(#pc${u})">
      <circle cx="56" cy="58" r="4" fill="${RB}" stroke="none"/><circle cx="76" cy="54" r="3.6" fill="${RB}" stroke="none"/>
      <circle cx="40" cy="72" r="3.6" fill="${RB}" stroke="none"/><circle cx="84" cy="64" r="3.2" fill="${RB}" stroke="none"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => dbl(`M${8 + i * 17} 34l26 60`, AM, 5.5, 8.5)).join('')}
      ${[0, 1, 2, 3].map((i) => dbl(`M10 ${62 + i * 13}l100 -24`, AM, 5.5, 8.5)).join('')}
    </g>
    <path d="M14 79L74 35L106 61z" fill="none"/>
    ${dbl('M73 35.5L105.5 61', AM, 9, 14)}
    <path d="M75 34.6L104 58" stroke="#f3cf98" stroke-width="2"/>
    ${[0, 1, 2, 3].map((i) => `<path d="M${79 + i * 7} ${42 + i * 5.6}l-2.2 3" stroke="#a96f3c" stroke-width="1.6"/>`).join('')}`,

  donut: () => {
    const d = (cx, cy, dough, frost, drips, extra = '', hole = false) => `
      <path d="M${cx - 36} ${cy}v7a36 13 0 0 0 72 0v-7" fill="${dough}"/>
      <ellipse cx="${cx}" cy="${cy}" rx="36" ry="13" fill="${dough}"/>
      <ellipse cx="${cx}" cy="${cy - 0.6}" rx="31.5" ry="10.6" fill="${frost}"/>
      ${drips.map(([dx, h]) => `<path d="M${cx + dx - 3.4} ${cy + 6}v${h}a3.4 3.4 0 0 0 6.8 0v-${h}" fill="${frost}"/>`).join('')}
      <ellipse cx="${cx}" cy="${cy - 0.8}" rx="30.3" ry="9.5" fill="${frost}" stroke="none"/>
      <path d="M${cx - 22} ${cy - 5}q8-4 18-4.6" stroke="${PL}" stroke-width="2" opacity=".55"/>
      ${hole ? `<ellipse cx="${cx}" cy="${cy}" rx="10" ry="3.8" fill="${K}"/>` : ''}${extra}`;
    const spr = [[-20, -2, 30, AM], [-10, -6, -20, PL], [12, -6, 40, BL], [20, 1, -35, PINE2], [-16, 4, 60, PL], [6, 5, 10, AM], [24, -4, 80, PL], [-26, 1, -60, BL]]
      .map(([x, y, a, c]) => `<rect x="${57 + x - 2.6}" y="${46 + y - 1}" width="5.2" height="2" rx="1" fill="${c}" stroke="none" transform="rotate(${a} ${57 + x} ${46 + y})"/>`).join('');
    return `
      <ellipse cx="60" cy="98" rx="48" ry="10" fill="${PL}"/>
      ${d(60, 84, '#c98a4b', '#ecc98f', [[-18, 3], [8, 5], [24, 2]])}
      ${d(62, 66, '#b97b40', '#4a2a1c', [[-24, 2], [-4, 5], [18, 3]])}
      ${d(57, 47, '#c98a4b', '#e3a3a2', [[-20, 4], [2, 3], [22, 5]], spr, true)}`;
  },

  receipt: () => {
    let zz = '';
    for (let i = 0; i < 6; i++) zz += 'l-5 6l-5-6';
    return `<g transform="rotate(-7 60 60)">
      <path d="M31 10h60v88${zz}z" fill="${PL}"/>
      <path d="M78 10h13v88l-5 6l-5-6l-3 3.6z" fill="${PD}" stroke="none"/>
      ${T(60, 23.5, 8.4, 'DOUBLE R', R, { font: SERIF, ls: 0.4 })}
      <path d="M38 30h46" stroke="${K}" stroke-width="1.4" stroke-dasharray="2.4 2.4"/>
      <path d="M38 37h26M70 37h12M38 43h20M70 43h12" stroke="#8b8375" stroke-width="2.2"/>
      ${T(61, 60, 15, '06:18', K)}
      <path d="M38 66h46" stroke="${K}" stroke-width="1.4" stroke-dasharray="2.4 2.4"/>
      <g transform="rotate(-10 61 82)">
        <rect x="41" y="71" width="40" height="22" rx="3" fill="none" stroke="${RB}" stroke-width="2.4"/>
        ${T(61, 89.5, 19, '315', RB, { font: SERIF })}
      </g>
      <circle cx="80" cy="50" r="13" fill="none" stroke="#a2703a" stroke-width="2.4" opacity=".45" stroke-dasharray="40 6 18 4"/>
    </g>`;
  },

  key: () => `
    ${dbl('M42 36a11 11 0 1 1 22 0a11 11 0 1 1 -22 0', BRASS, 3.6, 7.4)}
    <g transform="rotate(16 36 50)">
      <path d="M31.5 58h9v46h-9z" fill="${BRASS}"/>
      <path d="M40.5 80h8v5h-4v4h5v6h-5v4h-4z" fill="${BRASS}"/>
      <path d="M34 61v40" stroke="${BRASS2}" stroke-width="1.8"/>
      <circle cx="36" cy="46" r="15" fill="${BRASS}"/>
      <circle cx="36" cy="46" r="10" fill="none" stroke="#8f7040" stroke-width="1.6"/>
      <circle cx="36" cy="42" r="4.4" fill="${PL}"/>
      <path d="M26 41a11 11 0 0 1 7-7" stroke="${BRASS2}" stroke-width="2.2"/>
    </g>
    <g transform="rotate(-14 80 70)">
      <path d="M80 30q22 4 22 42q0 34-22 38q-22-4-22-38q0-38 22-42z" fill="${R}"/>
      <path d="M80 35q17 4 17 37q0 29-17 33q-17-4-17-33q0-33 17-37z" fill="none" stroke="${AM}" stroke-width="1.3"/>
      <circle cx="80" cy="42" r="4.4" fill="${BRASS}"/><circle cx="80" cy="42" r="1.8" fill="${K}" stroke="none"/>
      ${T(80, 57, 5.4, 'GREAT', AM, { ls: 0.6 })}${T(80, 63.5, 5.4, 'NORTHERN', AM, { ls: 0.2 })}
      ${T(80, 87, 21, '315', PL, { font: SERIF })}
      <path d="M70 94h20" stroke="${AM}" stroke-width="1.2"/>
    </g>
    ${dbl('M62 34q10 1 16 6', BRASS, 2.4, 5.6)}`,

  tape: () => `<g transform="rotate(-8 60 62)">
      <rect x="12" y="26" width="96" height="70" rx="8" fill="#2c292b"/>
      <rect x="15" y="29" width="90" height="64" rx="6" fill="none" stroke="#4a4547" stroke-width="1.4"/>
      <rect x="21" y="33" width="78" height="32" rx="3" fill="${PL}"/>
      <path d="M21 41.5h78" stroke="none"/><rect x="21" y="33" width="78" height="8" rx="3" fill="${R}"/>
      <path d="M21 41h78" stroke="${K}" stroke-width="1.4"/>
      ${T(26, 39.6, 5, 'MC-60 · SIDE A', PL, { anchor: 'start', ls: 0.4 })}
      ${T(60, 58, 15, 'Diane', K, { font: SERIF, weight: 400, extra: 'font-style="italic"' })}
      <path d="M30 61q30 3 60-1" stroke="${RB}" stroke-width="1.4"/>
      <rect x="31" y="68" width="58" height="17" rx="8.5" fill="#5a3b2c"/>
      <circle cx="44" cy="76.5" r="6.4" fill="${PL}"/><circle cx="76" cy="76.5" r="6.4" fill="${PL}"/>
      ${[44, 76].map((x) => `<circle cx="${x}" cy="76.5" r="2.4" fill="${K}" stroke="none"/><path d="M${x} 71v3M${x} 79v3M${x - 5.4} 76.5h3M${x + 2.4} 76.5h3" stroke="${K}" stroke-width="1.3"/>`).join('')}
      <path d="M38 96l5-6h34l5 6" fill="#4a4547"/>
      <circle cx="18.5" cy="32" r="1.8" fill="#6b6466" stroke="none"/><circle cx="101.5" cy="32" r="1.8" fill="#6b6466" stroke="none"/>
      <circle cx="18.5" cy="89" r="1.8" fill="#6b6466" stroke="none"/><circle cx="101.5" cy="89" r="1.8" fill="#6b6466" stroke="none"/>
    </g>`,

  radio: () => `
    <path d="M91 18q9 6 10 16M97 11q14 9 15 24" stroke="${RB}" stroke-width="3.2"/>
    <path d="M22 104V58Q22 16 60 16Q98 16 98 58V104z" fill="${WOOD2}"/>
    <path d="M30 98V60Q30 25 60 25Q90 25 90 60V98z" fill="${WOOD}"/>
    <path d="M37 64V60Q37 33 60 33Q83 33 83 60V64z" fill="#d6b07a"/>
    ${[44, 52, 60, 68, 76].map((x) => `<path d="M${x} ${x === 60 ? 34 : x === 52 || x === 68 ? 36 : 42}V64" stroke="${WOOD}" stroke-width="3.4"/>`).join('')}
    <path d="M37 64h46" stroke="${K}" stroke-width="2.6"/>
    <path d="M46 84a14 14 0 0 1 28 0z" fill="${AM}"/>
    <path d="M50 80.5l2 1.4M54.4 75.6l1.4 2M60 73.5v2.4M65.6 75.6l-1.4 2M70 80.5l-2 1.4" stroke="${K}" stroke-width="1.2"/>
    <path d="M60 84l7-10" stroke="${RB}" stroke-width="2"/>
    <circle cx="40" cy="91" r="5.6" fill="#2a2426"/><circle cx="80" cy="91" r="5.6" fill="#2a2426"/>
    <path d="M38 89l2 2M78 89l2 2" stroke="${PL}" stroke-width="1.4"/>
    <path d="M25 58Q25 21 58 19" stroke="#b07444" stroke-width="2"/>
    <rect x="18" y="102" width="84" height="8" rx="3" fill="#3e2416"/>`,

  log: () => `<g transform="rotate(-11 60 64)">
      <path d="M95 68q-2 -18 -10 -22l-3 -8q5 -1 8 4z" fill="${WOOD}" stroke="none"/>
      ${dbl('M66 43q2-12 10-18', WOOD, 3.6, 7)}
      <path d="M76 25q-9-6-14 1q8 4 14-1zM76 25q3-10 12-9q-2 9-12 9z" fill="${PINE2}"/>
      <path d="M30 40H92q14 0 14 24t-14 24H30z" fill="#5b3b26"/>
      <path d="M40 50q14-3 28 0t26-1M38 62q16 3 30-1t32 2M40 75q12-3 26 1t30-2M44 82q10 2 18-1" stroke="#3a2416" stroke-width="2"/>
      <ellipse cx="88" cy="56" rx="5" ry="3.4" fill="#3a2416"/>
      <ellipse cx="30" cy="64" rx="15" ry="24" fill="#dcb47e"/>
      <ellipse cx="30" cy="64" rx="11" ry="18" fill="none" stroke="#a87a48" stroke-width="1.5"/>
      <ellipse cx="30" cy="64" rx="7" ry="11.5" fill="none" stroke="#a87a48" stroke-width="1.5"/>
      <ellipse cx="30" cy="64" rx="3" ry="5" fill="#a87a48" stroke="none"/>
      <path d="M30 64l-6 17" stroke="#7a5532" stroke-width="1.6"/>
    </g>`,

  owl: () => `
    ${dbl('M14 92q46-8 92 2', WOOD, 6, 10)}
    <path d="M33 30L38 12L51 25Q60 21 69 25L82 12L87 30Q97 48 93 70Q89 92 60 94Q31 92 27 70Q23 48 33 30z" fill="#6b4a33"/>
    <path d="M30 56q-6 22 10 34q-8-16-4-34zM90 56q6 22-10 34q8-16 4-34z" fill="#4a3123"/>
    <ellipse cx="60" cy="74" rx="19" ry="17" fill="#c9a374"/>
    ${[[52, 68], [60, 66], [68, 68], [48, 77], [56, 76], [64, 76], [72, 77], [52, 85], [60, 84], [68, 85]].map(([x, y]) => `<path d="M${x - 3} ${y}l3 3l3-3" stroke="#6b4a33" stroke-width="1.6"/>`).join('')}
    <circle cx="47" cy="50" r="17" fill="#e2cfa8"/><circle cx="73" cy="50" r="16.6" fill="#e2cfa8"/>
    <circle cx="47" cy="50" r="17" fill="#e2cfa8" stroke="none"/><circle cx="73" cy="50" r="16.6" fill="#e2cfa8" stroke="none"/>
    <circle cx="47" cy="50" r="11" fill="${AM}"/><circle cx="73" cy="50" r="11" fill="${AM}"/>
    <circle cx="48" cy="51" r="6" fill="${K}"/><circle cx="72" cy="51" r="6" fill="${K}"/>
    <circle cx="45.6" cy="48" r="2" fill="${PL}" stroke="none"/><circle cx="69.6" cy="48" r="2" fill="${PL}" stroke="none"/>
    <path d="M56 58l4 8l4-8q-4-2-8 0z" fill="#d59a4e"/>
    <path d="M47 92v4M53 93v4M67 93v4M73 92v4" stroke="${K}" stroke-width="3"/>
    <path d="M14 98l8-4h76l8 4l-8 12h-76z" fill="${R}"/>
    <path d="M22 94l-8 4l8 3zM98 94l8 4l-8 3z" fill="#4a0a14"/>
    ${T(60, 105.4, 7, 'NOT WHAT THEY SEEM', PL, { ls: 0.3 })}`,

  fir: () => {
    let s = '';
    for (let i = 5; i >= 0; i--) {
      const t = 10 + i * 11.6, b = t + 22, w = 9 + i * 7.2;
      const n = 3 + i;
      let teeth = '';
      for (let k = 1; k <= n * 2; k++) {
        const x = 60 - w + (2 * w * k) / (n * 2);
        teeth += `L${x.toFixed(1)} ${(k % 2 ? b - 4.5 : b).toFixed(1)}`;
      }
      s += `<path d="M60 ${t}Q${60 - w * 0.4} ${t + 13} ${60 - w} ${b}${teeth}Q${60 + w * 0.4} ${t + 13} 60 ${t}z" fill="${PINE}"/>`;
      s += `<path d="M59 ${t + 4}Q${60 - w * 0.34} ${t + 13} ${60 - w + 5} ${b - 3}L58 ${b - 6}z" fill="${PINE2}" stroke="none"/>`;
    }
    return `
      <circle cx="92" cy="30" r="13" fill="${AM}"/>
      <path d="M86 22a9 9 0 0 0 4 15" stroke="#f3cf98" stroke-width="2"/>
      <path d="M22 106q38-8 76 0z" fill="#22362f"/>
      <rect x="55" y="88" width="10" height="16" fill="${WOOD}"/>${s}`;
  },

  trafficlight: (u) => `
    <defs>
      <radialGradient id="tg${u}"><stop offset="0" stop-color="#ff5a4e" stop-opacity=".75"/><stop offset=".45" stop-color="${RB}" stop-opacity=".35"/><stop offset="1" stop-color="${RB}" stop-opacity="0"/></radialGradient>
      <radialGradient id="tl${u}" cx=".4" cy=".38"><stop offset="0" stop-color="#ffd3c4"/><stop offset=".35" stop-color="#ff5a4e"/><stop offset="1" stop-color="${RB}"/></radialGradient>
      <clipPath id="tc${u}"><circle cx="60" cy="62" r="47"/></clipPath>
    </defs>
    <circle cx="60" cy="62" r="47" fill="#1a2329"/>
    <g clip-path="url(#tc${u})" stroke="none">
      <path d="M22 30l-6 14M36 80l-6 14M88 70l-6 14M96 36l-6 14M30 56l-4 9M84 98l-4 9" stroke="#6f838a" stroke-width="1.4" opacity=".7"/>
      <path d="M10 100q50-14 100 0V112H10z" fill="#0f1518"/>
      <path d="M14 100l5-12l5 12zM92 98l6-16l6 16z" fill="#0f1518"/>
      <circle cx="60" cy="48" r="34" fill="url(#tg${u})"/>
    </g>
    <path d="M8 22Q60 34 112 20" stroke="${K}" stroke-width="2.6"/>
    <g transform="rotate(7 60 28)">
      <path d="M57 28h6v6h-6z" fill="${K}"/>
      <rect x="44" y="33" width="32" height="70" rx="6" fill="#c08a30"/>
      <path d="M71 35h1q2 0 2 4v58q0 4-2 4h-1z" fill="#8f6420" stroke="none"/>
      <circle cx="60" cy="48" r="9" fill="url(#tl${u})"/>
      <circle cx="60" cy="68" r="9" fill="#3d2f1f"/>
      <circle cx="60" cy="88" r="9" fill="#24302a"/>
      ${[48, 68, 88].map((y) => `<path d="M49 ${y - 3}q2-9 11-9.6q9 .6 11 9.6" fill="${K}"/>`).join('')}
      <circle cx="57" cy="45" r="2.2" fill="#fff4ec" stroke="none"/>
    </g>`,

  sign: () => `
    <rect x="30" y="84" width="9" height="24" fill="${WOOD}"/><rect x="81" y="84" width="9" height="24" fill="${WOOD}"/>
    <path d="M10 88V54L36 22L50 38L66 18L110 54V88z" fill="${PINE}"/>
    <path d="M36 22L50 38L58 28L66 18L94 41H14z" fill="#6f8a86" stroke="none"/>
    <path d="M36 22L28 32l4 3l4-3l4 4l3-3zM66 18L57 29l4 3l5-4l4 4l5-2z" fill="${PL}"/>
    <path d="M36 22L50 38L66 18" fill="none" stroke="${K}" stroke-width="2.6"/>
    <path d="M14 46q20-8 30 0t32-2q18-6 30 4v6H14z" fill="${PINE2}" stroke="none"/>
    <path d="M10 54h100" stroke="${K}" stroke-width="2.6"/>
    <path d="M14 58h92v26H14z" fill="#24382f" stroke="none"/>
    ${T(60, 64.5, 6, 'WELCOME TO', AM, { ls: 1.4 })}
    ${T(60, 77, 13.5, 'TWIN PEAKS', PL, { font: SERIF, ls: 0.4 })}
    ${T(60, 84.6, 5.6, 'pop. 51,201', AM, { weight: 400, ls: 0.6 })}`,

  badge: (u) => {
    const pts = [], inner = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * 60 - 90) * Math.PI / 180, b = ((i * 60 + 30) - 90) * Math.PI / 180;
      pts.push([60 + 47 * Math.cos(a), 60 + 47 * Math.sin(a)]);
      inner.push([60 + 25 * Math.cos(b), 60 + 25 * Math.sin(b)]);
    }
    const f = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    let star = 'M';
    for (let i = 0; i < 6; i++) star += `${f(pts[i])}L${f(inner[i])}L`;
    star = star.slice(0, -1) + 'z';
    let facets = '';
    for (let i = 0; i < 6; i++) {
      const prev = inner[(i + 5) % 6];
      facets += `<path d="M60 60L${f(prev)}L${f(pts[i])}z" fill="${BRASS2}" stroke="none"/>`;
      facets += `<path d="M60 60L${f(pts[i])}L${f(inner[i])}z" fill="#a5834d" stroke="none"/>`;
    }
    return `
      <defs><radialGradient id="bg${u}" cx=".4" cy=".35"><stop offset="0" stop-color="#f1dcaa"/><stop offset="1" stop-color="${BRASS}"/></radialGradient></defs>
      <path d="${star}" fill="${BRASS}"/>${facets}<path d="${star}" fill="none"/>
      ${pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5.4" fill="url(#bg${u})"/>`).join('')}
      <circle cx="60" cy="60" r="21" fill="url(#bg${u})"/>
      <circle cx="60" cy="60" r="17" fill="none" stroke="#8f7040" stroke-width="1.3"/>
      ${T(60, 58.6, 7.6, 'SHERIFF', K, { ls: 0.3 })}
      <path d="M48 62h24" stroke="#8f7040" stroke-width="1"/>
      ${T(60, 68.4, 4.8, 'TWIN PEAKS', K, { ls: 0.3 })}
      <path d="M60 41.5l1.2 2.6l2.8.3l-2.1 1.9l.6 2.8l-2.5-1.4l-2.5 1.4l.6-2.8l-2.1-1.9l2.8-.3z" fill="${K}" stroke="none"/>`;
  },

  curtain: (u) => {
    let folds = '';
    for (let i = 0; i < 8; i++) {
      const x = 14 + i * 11.5;
      folds += `<path d="M${x} 10h11.5v74q-5.75 4-11.5 0z" fill="url(#cf${u})" stroke="none"/>`;
    }
    let zz = '';
    for (let r = 0; r < 4; r++) {
      let d = `M8 ${86 + r * 8}`;
      for (let k = 0; k < 24; k++) d += `l4.6 ${k % 2 ? 4 : -4}`;
      zz += `<path d="${d}" stroke="${B}" stroke-width="4" fill="none" stroke-linejoin="miter" stroke-linecap="butt"/>`;
    }
    return `
      <defs>
        <linearGradient id="cf${u}" x1="0" x2="1"><stop offset="0" stop-color="#4a0a14"/><stop offset=".45" stop-color="${RB}"/><stop offset=".6" stop-color="#c24a57"/><stop offset="1" stop-color="${R}"/></linearGradient>
        <clipPath id="cc${u}"><rect x="14" y="12" width="92" height="96" rx="10"/></clipPath>
      </defs>
      <rect x="14" y="12" width="92" height="96" rx="10" fill="${R}"/>
      <g clip-path="url(#cc${u})">
        <rect x="0" y="80" width="120" height="40" fill="${W}" stroke="none"/>${zz}
        ${folds}
        <path d="M14 84q5.75 4 11.5 0t11.5 0t11.5 0t11.5 0t11.5 0t11.5 0t11.5 0t11.5 0" stroke="${K}" stroke-width="2" fill="none"/>
        <path d="M10 10h100v10q-6 6-12.5 0q-6 6-12.5 0q-6 6-12.5 0q-6 6-12.5 0q-6 6-12.5 0q-6 6-12.5 0q-6 6-12.5 0q-6 6-12.5 0z" fill="#4a0a14"/>
      </g>
      <rect x="14" y="12" width="92" height="96" rx="10" fill="none" stroke-width="3"/>`;
  },

  chevron: (u) => {
    let zz = '';
    for (let r = 0; r < 8; r++) {
      let d = `M6 ${8 + r * 16}`;
      for (let k = 0; k < 10; k++) d += `l12 ${k % 2 ? 8 : -8}`;
      zz += `<path d="${d}" stroke="${B}" stroke-width="8" fill="none" stroke-linejoin="miter" stroke-linecap="butt"/>`;
    }
    const dots = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = i * Math.PI / 4 + Math.PI / 8;
      return `<circle cx="${(60 + 45 * Math.cos(a)).toFixed(1)}" cy="${(60 + 45 * Math.sin(a)).toFixed(1)}" r="1.6" fill="${AM}" stroke="none"/>`;
    }).join('');
    return `
      <defs><clipPath id="zc${u}"><circle cx="60" cy="60" r="40"/></clipPath></defs>
      <circle cx="60" cy="60" r="50" fill="${R}"/>
      <circle cx="60" cy="60" r="40" fill="${W}"/>
      <g clip-path="url(#zc${u})">${zz}</g>
      <circle cx="60" cy="60" r="40" fill="none"/>${dots}`;
  },

  ring: (u) => `
    <defs><radialGradient id="rg${u}" cx=".35" cy=".3"><stop offset="0" stop-color="#9fd1a4"/><stop offset=".45" stop-color="#3f8a58"/><stop offset="1" stop-color="#1d4a33"/></radialGradient></defs>
    <path d="M26 74a34 22 0 0 1 68 0" stroke="${K}" stroke-width="12" fill="none"/>
    <path d="M26 74a34 22 0 0 1 68 0" stroke="#a5834d" stroke-width="7" fill="none"/>
    <path d="M26 74a34 22 0 0 0 68 0" stroke="${K}" stroke-width="14" fill="none"/>
    <path d="M26 74a34 22 0 0 0 68 0" stroke="${BRASS}" stroke-width="9" fill="none"/>
    <path d="M32 84q28 16 56 0" stroke="${BRASS2}" stroke-width="2.6" fill="none"/>
    <path d="M38 50q-4 8 4 14h36q8-6 4-14q-8-10-22-10t-22 10z" fill="${BRASS}"/>
    <ellipse cx="60" cy="49" rx="21" ry="14" fill="${BRASS2}"/>
    <ellipse cx="60" cy="48.5" rx="15.5" ry="10" fill="url(#rg${u})"/>
    <path d="M52 50q8-8 16 0M60 43v12M55 55h10" stroke="#16351f" stroke-width="1.5" opacity=".8"/>
    <path d="M50 44q4-4 9-4.4" stroke="#e6f6e0" stroke-width="1.8"/>
    <path d="M94 24l2 6l6 2l-6 2l-2 6l-2-6l-6-2l6-2z" fill="${PL}" stroke-width="1.8"/>
    <path d="M24 30l1.4 4l4 1.4l-4 1.4l-1.4 4l-1.4-4l-4-1.4l4-1.4z" fill="${AM}" stroke-width="1.6"/>`,

  photo: (u) => `
    <defs>
      <linearGradient id="ph${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ea2a3"/><stop offset="1" stop-color="#cfd3c9"/></linearGradient>
      <clipPath id="pk${u}"><rect x="31" y="23" width="58" height="72"/></clipPath>
    </defs>
    <rect x="17" y="9" width="86" height="100" rx="4" fill="${BRASS}"/>
    <rect x="22" y="14" width="76" height="90" rx="2" fill="none" stroke="#8f7040" stroke-width="1.4"/>
    ${[[17, 9], [103, 9], [17, 109], [103, 109]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${BRASS2}"/>`).join('')}
    <rect x="27" y="19" width="66" height="80" fill="${PL}"/>
    <rect x="31" y="23" width="58" height="72" fill="url(#ph${u})"/>
    <g clip-path="url(#pk${u})">
      <path d="M36 52q-4-26 24-28q28 2 24 28q4 22 2 34q-14 10-26 8q-12 2-26-8q-2-12 2-34z" fill="#e3be6f" stroke="none"/>
      <path d="M31 98q4-20 29-22q25 2 29 22z" fill="#efd8c4"/>
      <path d="M36 98q6-12 24-12q18 0 24 12z" fill="${BL}"/>
      <rect x="55" y="62" width="10" height="12" fill="#efd8c4" stroke="none"/>
      <ellipse cx="60" cy="54" rx="13" ry="16" fill="#efd8c4"/>
      <path d="M47 50q2-16 13-16q11 0 13 16q-6-9-13-9q-7 0-13 9z" fill="#e3be6f"/>
      <path d="M52 55q2.4 2 4.8 0M63.2 55q2.4 2 4.8 0M56 63q4 2.6 8 0" stroke="#9b6b5a" stroke-width="1.3"/>
      <path d="M49 37l3-6l3 4l5-7l5 7l3-4l3 6" fill="${PL}" stroke-width="1.6"/>
      <circle cx="60" cy="29.6" r="1.6" fill="${RB}" stroke="none"/>
    </g>
    <rect x="31" y="23" width="58" height="72" fill="none" stroke-width="1.6"/>
    <path d="M78 109l25-25v8l-17 17z" fill="${K}" stroke="none"/>`,

  match: () => `
    <g transform="rotate(-9 46 86)">
      <rect x="14" y="66" width="66" height="40" rx="3" fill="${R}"/>
      <path d="M14 74h66" stroke="${K}" stroke-width="2"/>
      <rect x="14" y="66" width="66" height="8" rx="2" fill="#4a0a14"/>
      ${T(47, 90, 9.6, 'FIRE WALK', PL, { ls: 0.8 })}
      <path d="M22 96h50" stroke="${AM}" stroke-width="1.2"/>
      ${T(47, 102.2, 4.6, '— WITH ME —', AM, { ls: 0.8 })}
    </g>
    ${dbl('M44 70L78 34', '#e3c08a', 4.4, 7.8)}
    <ellipse cx="80" cy="32" rx="6" ry="4.6" fill="#4a0a14" transform="rotate(-47 80 32)"/>
    <path d="M82 27q-14-6-8-20q2 8 7 6q-2-8 5-12q-2 8 6 14q8 8-2 14q-3 1-8-2z" fill="${RB}"/>
    <path d="M83 26q-7-5-3-13q2 5 5 5q1 6 4 4q3 4-1 6q-2 1-5-2z" fill="${AM}" stroke="none"/>
    <path d="M84 25q-3-3-1-7q2 3 4 3q1 3-3 4z" fill="#fff1d6" stroke="none"/>`,

  rose: () => `
    ${dbl('M60 66q-6 22 0 42', PINE2, 4, 7.4)}
    <path d="M58.4 82l-5-2l4.4-2M61.6 96l5 1l-4.6 2.4" fill="${PINE2}" stroke-width="1.4"/>
    <path d="M58 88q-20-2-26 10q16 4 26-10z" fill="${PINE2}"/><path d="M57 88.6q-12 2-22 8.6" stroke="#22362f" stroke-width="1.3"/>
    <path d="M61 76q18-8 28 0q-14 10-28 0z" fill="${PINE}"/><path d="M62 76q12-2 24 0" stroke="#7fa08c" stroke-width="1.2"/>
    <path d="M46 62l14 6l14-6l-6 8h-16z" fill="${PINE}"/>
    <path d="M28 38Q24 14 50 14q8-4 18 0q26 0 22 24q2 20-10 26q-10 6-20 4q-10 2-20-4q-12-6-12-26z" fill="#22394a"/>
    <path d="M30 34q0 26 30 30q30-4 30-30q-10 10-30 10t-30-10z" fill="${BL}"/>
    <path d="M30 34q2 22 22 28q-10-10-8-24z" fill="#7b98a6"/>
    <path d="M90 34q-2 22-22 28q10-10 8-24z" fill="#5f7c89"/>
    <path d="M40 30q4-12 20-12q16 0 20 12q-6 10-20 10t-20-10z" fill="#5f7c89"/>
    <path d="M48 30q2-8 12-8q10 0 12 8q-5 5-12 5t-12-5z" fill="#86a3b0"/>
    <path d="M54 29q1-4 6-4.4q5 .4 5.4 4q-2 3-5 2.4q-3-.6-2.4-3" fill="none" stroke-width="2"/>
    <path d="M34 40q4 10 14 16" stroke="#a9c2cc" stroke-width="1.8"/>`,

  falls: (u) => `
    <defs>
      <linearGradient id="fs${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9b77a"/><stop offset=".55" stop-color="#c98a7a"/><stop offset="1" stop-color="#6f6a7a"/></linearGradient>
      <clipPath id="fc${u}"><circle cx="60" cy="60" r="48"/></clipPath>
    </defs>
    <circle cx="60" cy="60" r="48" fill="url(#fs${u})"/>
    <g clip-path="url(#fc${u})">
      <path d="M8 46l10-8l8 6l10-10l8 8v80H8z" fill="#5b6f6c" stroke="none"/>
      <path d="M10 48l5-13l5 13zM18 44l6-16l6 16zM28 42l5-12l5 12z" fill="${PINE}" stroke-width="1.6"/>
      <path d="M8 50h44v70H8z" fill="#2f2b29"/>
      <path d="M68 46h56v74H68z" fill="#2f2b29"/>
      <path d="M14 66l12-4M20 86l14-6M76 70l14 4M84 92l16-4" stroke="#55504b" stroke-width="2"/>
      <path d="M52 48h16v62H52z" fill="${PL}"/>
      <path d="M56 52v50M61 50v56M65 54v46" stroke="#8fb0bb" stroke-width="1.8"/>
      <path d="M8 102q8-8 16-2q6-8 14-2q8-8 16 0q8-8 16 0q8-6 14 2q8-6 16 2q6-2 12 2v20H8z" fill="${PL}"/>
      <path d="M70 46V34l14-10l14 10v12z" fill="${WOOD}"/>
      <path d="M66 35l18-14l18 14" fill="none" stroke-width="3.4"/>
      <path d="M98 30h12v16H98z" fill="#4a2c1c"/>
      ${[74, 80, 86, 92].map((x) => `<rect x="${x}" y="37" width="3.6" height="4" fill="${AM}" stroke="none"/>`).join('')}
      <rect x="101" y="36" width="3.6" height="4" fill="${AM}" stroke="none"/><rect x="105" y="36" width="3.6" height="4" fill="${AM}" stroke="none"/>
      <circle cx="30" cy="22" r="1.2" fill="${PL}" stroke="none"/><circle cx="46" cy="16" r="1" fill="${PL}" stroke="none"/>
    </g>
    <circle cx="60" cy="60" r="48" fill="none" stroke-width="3"/>`,
};

// ---------------------------------------------------------------- 数据
export const STICKERS = {
  coffee: { id: 'coffee', name: '咖啡', en: 'Damn Good Coffee', caption: '黑得像午夜，热得刚好。', tone: 'diner' },
  pie: { id: 'pie', name: '樱桃派', en: 'Cherry Pie', caption: '格子底下，藏着一整个夏天。', tone: 'diner' },
  donut: { id: 'donut', name: '甜甜圈', en: 'Station Donuts', caption: '警局清晨，盒子总是先空。', tone: 'diner' },
  receipt: { id: 'receipt', name: '账单', en: 'Diner Receipt', caption: '六点十八分，有人记下了房号。', tone: 'case' },
  key: { id: 'key', name: '房间钥匙', en: 'Room Key 315', caption: '三一五号的门，从里面也锁着。', tone: 'case' },
  tape: { id: 'tape', name: '微型磁带', en: 'Micro-cassette', caption: '黛安，磁带还在转。', tone: 'case' },
  radio: { id: 'radio', name: '收音机', en: 'Radio', caption: '调频的缝隙里，有人在唱歌。', tone: 'diner' },
  log: { id: 'log', name: '木头', en: 'The Log', caption: '它看见了，只是不肯说完。', tone: 'woods' },
  owl: { id: 'owl', name: '猫头鹰', en: 'Owl', caption: '眼睛睁得太圆，夜就藏不住。', tone: 'woods' },
  fir: { id: 'fir', name: '花旗松', en: 'Douglas Fir', caption: '风穿过松针，说着另一种语言。', tone: 'woods' },
  trafficlight: { id: 'trafficlight', name: '红灯', en: 'Traffic Light', caption: '空无一人的路口，红灯照旧亮着。', tone: 'night' },
  sign: { id: 'sign', name: '小镇路牌', en: 'Welcome Sign', caption: '五万一千二百零一人，外加一位访客。', tone: 'woods' },
  badge: { id: 'badge', name: '警徽', en: 'Sheriff Badge', caption: '黄铜的星，比夜更重。', tone: 'case' },
  curtain: { id: 'curtain', name: '红幕', en: 'Red Curtains', caption: '帘子背后，时间倒着走。', tone: 'redroom' },
  chevron: { id: 'chevron', name: '锯齿地板', en: 'Chevron Floor', caption: '黑白之间，没有一步是直的。', tone: 'redroom' },
  ring: { id: 'ring', name: '绿石戒指', en: 'Owl Cave Ring', caption: '石头冰凉，戴上就回不来。', tone: 'redroom' },
  photo: { id: 'photo', name: '返校照', en: 'Homecoming Portrait', caption: '笑容停在相框里，比谁都久。', tone: 'memory' },
  match: { id: 'match', name: '火柴', en: 'Matchbook', caption: '一根火柴，照不亮整片树林。', tone: 'redroom' },
  rose: { id: 'rose', name: '蓝玫瑰', en: 'Blue Rose', caption: '不属于任何季节的花。', tone: 'case' },
  falls: { id: 'falls', name: '瀑布旅馆', en: 'The Falls Lodge', caption: '水声盖住了楼上的脚步。', tone: 'lodge' },
};

export const STICKER_IDS = Object.keys(STICKERS);
export const CASE_STICKERS = ['receipt', 'key', 'tape'];
export const PLACE_STICKERS = { diner: 'coffee', lodge: 'key', woods: 'owl', redroom: 'curtain' };

// ---------------------------------------------------------------- 渲染
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// 稳定的伪随机倾角（同一 id 每次一致），范围约 ±6°
const tiltOf = (id) => {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ((h % 1300) / 100 - 6.5).toFixed(1);
};

/**
 * 内联 SVG 字符串。模切白边由 SVG 滤镜（dilate + 平滑阈值）生成。
 * size 省略时 width/height 为 100%，由容器控制尺寸。
 */
export function stickerSVG(id, { size, title } = {}) {
  const art = ART[id];
  if (!art) return '';
  const u = `${++uid}`;
  const dim = size ? `width="${size}" height="${size}"` : 'width="100%" height="100%"';
  const label = title ?? STICKERS[id]?.name ?? id;
  return `<svg class="tps-svg" viewBox="0 0 120 120" ${dim} role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" overflow="visible">
<defs>
<filter id="tpd${u}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
<feMorphology in="SourceAlpha" operator="dilate" radius="4.6" result="d"/>
<feGaussianBlur in="d" stdDeviation="1.8"/>
<feComponentTransfer result="o"><feFuncA type="linear" slope="14" intercept="-4.5"/></feComponentTransfer>
<feMorphology in="o" operator="dilate" radius="0.9" result="o2"/>
<feFlood flood-color="#b3aa9a"/><feComposite in2="o2" operator="in" result="edge"/>
<feFlood flood-color="#fbf9f3"/><feComposite in2="o" operator="in" result="w"/>
<feMerge><feMergeNode in="edge"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="tpm${u}" x="-25%" y="-25%" width="150%" height="150%">
<feMorphology in="SourceAlpha" operator="dilate" radius="4.6"/><feGaussianBlur stdDeviation="1.8"/>
<feComponentTransfer><feFuncA type="linear" slope="14" intercept="-4.5"/></feComponentTransfer>
</filter>
<mask id="tph${u}" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="-20" y="-20" width="160" height="160"><use href="#tpa${u}" filter="url(#tpm${u})"/></mask>
<linearGradient id="tpg${u}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64" spreadMethod="repeat">
<stop offset="0" stop-color="#ff9ec4"/><stop offset=".2" stop-color="#ffe59a"/><stop offset=".4" stop-color="#9dffd8"/><stop offset=".6" stop-color="#9cc9ff"/><stop offset=".8" stop-color="#d6a2ff"/><stop offset="1" stop-color="#ff9ec4"/>
</linearGradient>
</defs>
<g filter="url(#tpd${u})"><g id="tpa${u}" class="tps-art" fill="none" stroke="${K}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">${art(u)}</g></g>
<g class="tps-holo" mask="url(#tph${u})"><rect class="tps-sheen" x="-128" y="-128" width="384" height="384" fill="url(#tpg${u})"/></g>
</svg>`;
}

/**
 * 贴纸包裹元素（<span class="tp-sticker">）。
 * cls：额外类名，如 'holo' / 'locked' / 'placed' / 'slot'；label：true 用中文名，字符串则自定义。
 * tilt：覆盖默认的稳定随机倾角（度）。
 */
export function stickerHTML(id, { size = 96, cls = '', peel = true, label, tilt } = {}) {
  const s = STICKERS[id];
  if (!s) return '';
  const locked = /\blocked\b/.test(cls);
  const t = tilt ?? tiltOf(id);
  const lab = label === true ? s.name : label;
  const aria = locked ? '未获得的贴纸' : `${s.name} · ${s.en}`;
  return `<span class="tp-sticker${peel ? ' peel' : ''}${cls ? ' ' + cls : ''}" data-sticker="${id}" role="img" aria-label="${esc(aria)}" style="--size:${typeof size === 'number' ? size + 'px' : size};--tilt:${t}deg">`
    + stickerSVG(id).replace('role="img"', 'aria-hidden="true" focusable="false"')
    + (lab ? `<span class="tp-sticker-label">${esc(locked ? '？？？' : lab)}</span>` : '')
    + '</span>';
}

/** 空槽位：虚线目标框，可放入 hint 的淡影（可选）。拖拽悬停时加 .over。 */
export function slotHTML({ size = 96, hint, label } = {}) {
  return `<span class="tp-sticker slot" ${hint ? `data-sticker="${hint}"` : ''} style="--size:${typeof size === 'number' ? size + 'px' : size};--tilt:0deg" aria-label="${esc(label ?? '贴纸槽位')}">`
    + (hint ? stickerSVG(hint).replace('role="img"', 'aria-hidden="true"') : '')
    + (label ? `<span class="tp-sticker-label">${esc(label)}</span>` : '')
    + '</span>';
}

/** 指针跟随倾斜（事件委托）。返回解绑函数。 */
export function bindStickerTilt(root = document) {
  let cur = null;
  const reset = (el) => { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); el.style.removeProperty('--mx'); el.style.removeProperty('--my'); };
  const move = (e) => {
    const el = e.target.closest?.('.tp-sticker:not(.locked):not(.slot)');
    if (cur && cur !== el) { reset(cur); cur = null; }
    if (!el) return;
    cur = el;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(x * 22).toFixed(1)}deg`);
    el.style.setProperty('--ry', `${(-y * 22).toFixed(1)}deg`);
    el.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(0)}%`);
    el.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(0)}%`);
  };
  const leave = (e) => { if (cur && !cur.contains(e.relatedTarget)) { reset(cur); cur = null; } };
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerout', leave);
  return () => { root.removeEventListener('pointermove', move); root.removeEventListener('pointerout', leave); };
}

const runAnim = (el, cls, ms) => new Promise((res) => {
  if (!el) return res(el);
  el.classList.remove('peeling', 'placed');
  void el.offsetWidth;
  el.classList.add(cls);
  const done = () => { clearTimeout(t); el.removeEventListener('animationend', onEnd); res(el); };
  const onEnd = (e) => { if (e.target === el) done(); };
  const t = setTimeout(done, ms + 80);
  el.addEventListener('animationend', onEnd);
});

/** 撕下贴纸（.peeling），动画结束后 resolve；元素保持不可见，由调用方移除。 */
export const peelSticker = (el) => runAnim(el, 'peeling', 900);
/** 拍下贴纸（.placed）。 */
export const placeSticker = (el) => runAnim(el, 'placed', 560).then((e) => { e.classList.remove('placed'); return e; });
