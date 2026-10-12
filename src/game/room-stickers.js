// Small cut-paper emblems, kept as vectors so they stay crisp beside the GLB.
const marks={
 entry:'<path d="M10 30 22 11l12 19H10Zm20 0 11-15 12 15H30Z" fill="#7f2835"/><path d="m17 19 5-8 5 8-5-2-5 2Zm18 4 6-8 6 8-6-2-6 2Z" fill="#ead9b7"/><path d="M12 35h39m-35 5h31" stroke="#48352d"/>',
 archive:'<path d="M15 16 24 20 32 17l8 3 9-4-3 22-14 9-14-9-3-22Z" fill="#6c5540"/><path d="M20 26q6-8 12 1 6-9 12-1v8q-6 6-12-1-6 7-12-1Z" fill="#ead9b7"/><circle cx="26" cy="29" r="2" fill="#27171a"/><circle cx="38" cy="29" r="2" fill="#27171a"/><path d="m29 35 3 5 3-5" fill="#a8673f"/>',
 help:'<path d="M30 30q0-15 14-18M30 30q-7-14-17-12" fill="none" stroke="#65754a" stroke-width="3"/><path d="M33 20q8-11 17-6-7 10-17 6Z" fill="#65754a"/><circle cx="23" cy="37" r="10" fill="#952a3c"/><circle cx="42" cy="36" r="10" fill="#7c2234"/><path d="m18 32 3-2m16 2 3-2" stroke="#e3b88d" stroke-width="2"/>',
 music:'<path d="M16 23h28v13q0 9-14 9T16 36V23Z" fill="#7f2835"/><path d="M44 26h5q10 10-5 13" fill="none" stroke="#7f2835" stroke-width="4"/><ellipse cx="30" cy="23" rx="14" ry="4" fill="#3b2523"/><path d="M12 47h39M24 17q-4-4 0-8m10 8q-4-4 0-8" fill="none" stroke="#786246" stroke-width="2"/>',
 light:'<circle cx="32" cy="28" r="12" fill="#a6ad88"/><ellipse cx="32" cy="28" rx="25" ry="6" transform="rotate(-24 32 28)" fill="none" stroke="#7f2835" stroke-width="4"/><path d="M29 42h6v7h-6Z" fill="#65754a"/>'
};
export function roomSticker(role){return `<svg class="room-sticker" viewBox="0 0 64 64" aria-hidden="true"><path class="sticker-paper" d="M11 7 28 5l9 3 16 1 5 17-4 11 1 17-18 5-13-3-15 1-4-17 3-12-2-13Z" fill="#ead9b7"/>${marks[role]||marks.entry}</svg>`;}
