---
name: "双峰 · 小小梦魇"
description: "An interactive Blender miniature Red Room invites the player into a live 3D dark-red theatre."
colors:
  surround: "#090b0c"
  paper: "#e8dcc6"
  dim: "#baaa94"
  title-text: "#eedcc0"
  title-glow: "#27141a"
  title-shadow: "#110c10"
  title-copy: "#cdb298"
  title-subtitle: "#cba47c"
  title-gold: "#dfba8b"
  title-nav: "#ead6b8"
  title-music: "#dfc6a6"
  title-credit: "#c5a582"
  title-light: "#ead6b8"
  action-text: "#ecd4af"
  action-rule: "#947753"
  quiet-text: "#dbc6ac"
  archive-entry-text: "#dbc6ac"
  archive-rule: "#6c5643"
  focus: "#ebc998"
  archive: "#211017"
  music-text: "#d5c5ae"
  music-on: "#682a31"
  touch-background: "#1c141bbd"
  touch-text: "#e9d5b7"
  touch-held: "#76333ee6"
  room-light-off-text: "#cbb9a6"
  title-surround: "#08090a"
  threshold-ink: "#100c10"
  caption-edge: "#100c10cc"
  caption-field: "#100c10ee"
  title-entry: "#f2dfbf"
  title-hint: "#cbb298"
  title-focus: "#b69c77"
  title-hover: "#fff2d4"
  title-leader: "#c9a77b"
  title-leader-dot: "#dfc198"
  title-footer: "#b89b80"
  title-dedication: "#a88d77"
  title-retry-bg: "#1b1117"
  title-retry-border: "#967456"
typography:
  display:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: ".12em"
  title-copy:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "11px"
    lineHeight: 1.7
    letterSpacing: ".08em"
  subtitle:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "clamp(16px, 1.4vw, 21px)"
    lineHeight: 1.7
    letterSpacing: ".04em"
  wordmark:
    fontFamily: "Georgia, serif"
    fontSize: "9px"
    lineHeight: 1.5
    letterSpacing: ".24em"
  title-portrait:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "34px"
    lineHeight: 1.1
    letterSpacing: ".12em"
  title-landscape:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "24px"
    lineHeight: 1.1
    letterSpacing: ".12em"
  scene-entry:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "18px"
    lineHeight: 1.5
    letterSpacing: ".08em"
  scene-entry-portrait:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "17px"
    lineHeight: 1.5
    letterSpacing: ".08em"
  scene-entry-landscape:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "15px"
    lineHeight: 1.5
    letterSpacing: ".08em"
  scene-guide:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "14px"
    lineHeight: 1.5
    letterSpacing: ".04em"
  scene-guide-compact:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "12px"
    lineHeight: 1.5
    letterSpacing: ".04em"
  scene-music:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "13px"
    lineHeight: 1.5
    letterSpacing: ".02em"
  title-hint:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "10px"
    lineHeight: 1.5
    letterSpacing: ".06em"
  title-credit:
    fontFamily: "Georgia, serif"
    fontSize: "9px"
    lineHeight: 1.4
    letterSpacing: ".02em"
  title-subtitle-portrait:
    fontFamily: "Georgia, serif"
    fontSize: "8px"
    lineHeight: 1.5
    letterSpacing: ".24em"
  title-subtitle-landscape:
    fontFamily: "Georgia, serif"
    fontSize: "7px"
    lineHeight: 1.5
    letterSpacing: ".24em"
rounded:
  round-control: "50%"
  hold-control: "28px"
  music-track: "20px"
  room-light: "0"
spacing:
  title-gutter: "36px"
  header-gutter: "36px"
  portrait-gutter: "24px"
  touch-grid-gap: "4px"
  title-header-gap: "24px"
  title-wordmark-gap: "18px"
  title-portrait-copy-gap: "12px"
  title-portrait-subtitle-gap: "8px"
  scene-guide-padding: "10px 12px"
components:
  button-primary:
    backgroundColor: "transparent"
    textColor: "{colors.action-text}"
    padding: "8px 0 8px 24px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.quiet-text}"
    padding: "10px 0"
  archive-entry:
    backgroundColor: "transparent"
    textColor: "{colors.archive-entry-text}"
    padding: "10px 0"
  music-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.music-text}"
    padding: "8px 0"
  title-music-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.title-music}"
    padding: "0"
  room-light:
    backgroundColor: "transparent"
    textColor: "{colors.title-light}"
    rounded: "{rounded.room-light}"
    padding: "4px 8px"
  room-light-off:
    backgroundColor: "transparent"
    textColor: "{colors.room-light-off-text}"
  touch-button:
    backgroundColor: "{colors.touch-background}"
    textColor: "{colors.touch-text}"
    rounded: "{rounded.round-control}"
    padding: "7px"
  touch-hold:
    rounded: "{rounded.hold-control}"
    padding: "10px 16px"
  scene-entry:
    backgroundColor: "linear-gradient(90deg,#100c10cc,#100c10ee 25%,#100c10ee 75%,#100c10cc)"
    textColor: "{colors.title-entry}"
    typography: "{typography.scene-entry}"
    rounded: "0"
    padding: "4px 12px"
  scene-archive:
    backgroundColor: "linear-gradient(90deg,#100c10cc,#100c10ee 25%,#100c10ee 75%,#100c10cc)"
    textColor: "{colors.title-entry}"
    padding: "10px 12px"
    rounded: "0"
  scene-help:
    backgroundColor: "transparent"
    textColor: "{colors.title-nav}"
    padding: "10px 12px"
  scene-music:
    backgroundColor: "transparent"
    textColor: "{colors.title-music}"
    padding: "0 8px"
  scene-light:
    backgroundColor: "transparent"
    textColor: "{colors.title-light}"
    padding: "8px 10px"
    rounded: "0"
---

# Design System: 双峰 · 小小梦魇

## Overview

**Creative North Star: "An empty miniature Red Room"**

Near-black space surrounds a compact centered theatrical miniature: burgundy velvet, black leather chair, Saturn lamp, silver torchiere and ivory chevron floor. Warm serif lettering stays at its upper edge. The miniature itself guides navigation: chair for entry, closed folio for archive, Saturn for music, torchiere for lighting and paper programme for help. Glowing projected dots and cut-paper emblems (mountains, owl, cherries, coffee and Saturn) connect these real objects to accessible, compact DOM actions.

Actual geometry arrives from darkness, its camera settles and baked illumination emerges. A dedicated OffscreenCanvas worker renders the Blender room while DOM navigation remains responsive. Entering follows a short camera dolly and fade into the existing eleven-act game. Falling begins enabled on every visit; browser-blocked playback waits for the first gesture and remains independent of environmental effects.

This system covers the title under `.impeccable/title-atmosphere-brief.md` and the existing gameplay under `.impeccable/game-immersion-brief.md`. Gameplay retains its shared treatment in `src/game/immersion.js`, rendering/textures in `gfx.js` and authored stage/support in level, player and world modules. `docs/immersion-audit.md` records gameplay implementation scope. `PRODUCT.md` describes the separate retained `tv.html` screening experience and is not current title acceptance criteria. Design documentation establishes visual guidance, not test success or whole-game approval.

**Key Characteristics:**

- A compact centered miniature that acts as navigation.
- Accessible labels connected to actual raycast objects.
- Geometry-first arrival, baked light and a short entry dolly.
- One live 3D game with keyboard and translucent touch controls.
- Grounded gameplay props, tactile materials and distinct chapter lighting.
- Explicit music state independent from environmental effects.

## Colors

The title uses an oxblood-to-black surround, warm ivory captions and amber object leaders. `title-glow`, `title-shadow` and `title-surround` belong to the title; gameplay retains `surround`, `paper`, `dim` and its existing controls. The closely related title shades are intentional atmosphere and hierarchy, not accidental palette drift. `caption-edge` and `caption-field` provide quiet near-black rectangular backing under entry and archive over the chevrons. Help, music and light remain transparent.

**The Object Caption Rule.** Keep text readable against the actual room in both lighting states; entry/archive backing must remain quiet and attached to their object leaders.

`src/game/title.css` follows `theme.css` and owns scoped title values. Existing `button-primary`, `button-quiet`, archive and music primitives remain available to gameplay/panels; `scene-*` variants describe the effective title cascade. Focus and explicit on/off text supplement color. Gameplay preserves its authored palette, sRGB base textures and restrained reflections: interior intensity `.18`, shore/forest `.045`. Those are scene settings, not new CSS color tokens.

## Typography

The game uses the self-hosted `TV Serif` with Georgia, Noto Serif SC, Songti SC and generic serif fallbacks. `public/fonts/tv-serif.ttf` is the existing licensed Noto Serif SC subset; provenance is in `docs/tv-cut/font-source.txt`. New uncovered characters may use system fallbacks.

The title heading is regular weight, shadow-free and deliberately modest: desktop 38px, portrait 34px, short landscape 24px. English wordmark uses Georgia at 9/8/7px respectively, with `.24em` tracking. Copy is 11/10/9px; entry is 18/17/15px. Guides are 14px desktop and 12px compact; music is 13/12/11px. Hint is 10px, reduced to 8px in short landscape; track credit is 9px desktop and 8px portrait, hidden in short landscape. Footer uses 9px desktop and 8px compact. Secondary saved/new labels use 11/10/9px; chapter detail 9px desktop, 8px portrait and hidden in short landscape. These small credit and metadata steps are intentional, not primary reading sizes. Gameplay subtitles retain 16px mobile type and 1.7 line height.

**The Quiet Heading Rule.** The title identifies the room; it must not reintroduce a large separated hero column.

## Layout

The title occupies `100dvh` with a 460px minimum height. Desktop header and miniature share a centered 1060px maximum width. Header begins at 24px with 36px gutters; heading/copy form a compact horizontal line. The scene host is inset 74px above and 58px below. Footer sits at 17px with 36px gutters. Object guides track projected mesh anchors and stay within the host with 10px edge protection; their hit areas retain a 44px minimum height.

Portrait at width ≤760px forms one title → room/navigation → hint group. Header top is `max(28px, (100dvh - 610px)/2)` with 24px gutters. Scene top is `max(108px, (100dvh - 610px)/2 + 80px)` and height `min(106vw, 440px)`; minimum page height is 560px. The helper follows the greater of the projected geometry bottom or entry-caption bottom, plus 14px. This keeps the group compact as camera framing changes. Footer stays separate at 18px and hides its secondary dedication line.

Landscape at height ≤520px uses an 800px centered width, 10px header top, 32px gutters, scene insets 42px/36px and a 320px minimum title height. Chapter detail and track credit are hidden; guide hit areas remain 44px. Camera fit projects all eight room bounds corners onto current camera axes to retain the complete miniature and plinth under bounded rotation. Wheel zoom is bounded, not an unrestricted inspection camera.

Coarse pointers or widths up to 760px expose gameplay touch controls. Directions use 44px cells and 4px gaps; actions use 7px gaps. Safe-area insets protect edges, subtitles sit above controls, dialogue scrolls within 55dvh, and 380px layouts tighten gutters to 10px. Touch emulation does not establish physical-phone GPU performance.

## Elevation & Depth

Actual shared-atlas geometry owns title depth. The 65-mesh full room has 223,144 triangles; its same-room opening LOD has 35,537. `public/themes/red-room-opening.glb` appears first, followed by `red-room-baked.glb` with three 2048px light/AO/tangent-normal atlases. Blender 4.5.10 Cycles bakes direct and indirect diffuse illumination at 16 samples and four bounces, contact AO and portable surface normals. Editable source is `blender-materials/title-redroom/title-baked.blend` with `bake_title.py`; `public/themes/room-bake.json` records settings. The opening/full swap preserves camera and object-action state.

`title-room.js` owns DOM, sizing and input; `title-worker.js` runs `title-scene.js` for parsing, compilation, uploads and WebGL drawing. No raster placeholder is used during loading or failure. Before geometry arrives, DOM entry/archive/help/music remain usable. Failure shows an honest status and fresh-worker retry, preserving page and saves. Requests for GLB/textures have 20s deadlines; optional precomputed cubeUV HDR has 4s and completes or falls back before full quality compilation. Compilation is isolated in the worker; the independent main-thread 30s watchdog bounds stuck preparation. The former 8s compile claim is obsolete.

AgX exposure is `.95`, camera near/far `.2 / 90`. Baked illumination and AO replace title runtime shadow maps. Light-map intensity varies `.035 + lightLevel * .9`, AO is `.72` and chair/velvet normals use `.55` scale. A local additive lamp sprite and real scene light intensities follow the light switch. Optional reflections and runtime shading interpret the Cycles source; they do not guarantee identical appearance or finished material quality at every magnification.

Hardware rendering is capped at 2,400,000 pixels with DPR at most 1.75 desktop / 1.5 coarse pointer. Detected software renderers start at 420,000 pixels; slow normal-motion frames reduce the budget toward that minimum. Rendering schedules up to 30fps and skips hidden tabs; reduced-motion settled views skip unchanged frames. These are settings rather than measured device throughput.

Arrival uses a 1.7s light emergence and damped camera settle; canvas opacity reveals over `.8s`. Idle yaw is `sin(time * .00025) * .014` radians; camera damping is 6 and light damping 5. Entry takes 850ms, reduces camera distance by up to 34%, fades guides over `.4s` and title over `.85s cubic-bezier(.22,1,.36,1)`, then disposes the worker/canvas. Reduced motion settles camera/light immediately and enters without the delay; explicit input remains available. Game renderer/composer allocate on entry.

**The Geometry First Rule.** Loading and recovery never substitute a rendered room image for the interactive miniature.

**The Honest Depth Rule.** Baked light, AO and surface normals support actual geometry; retain editable bake source and state measured limits separately from visual intent.

Gameplay uses soft shadow maps plus support-aware contact patches beneath the player, registered cast members and movable props. Each patch follows the highest eligible solid collider below the subject, sits `.008` world units above that surface, expands and fades with height, and disappears when there is no support or the gap reaches 3 world units. These are soft planar contact approximations, not screen-space ambient occlusion or ray-traced shadows; they do not fix mismatched mesh/collider geometry by themselves. Shared shadow calibration uses depth bias `−.00008` and normal bias `.008` world units.

Material detail is restrained and selective. Existing mapped standard materials gain shallow bump (`.008`) when none is authored. Unmapped leather, fabric, stone, rock, wood and bark receive deterministic micro height/roughness; coarse stone, rock and bark use `.025` bump, other selected materials `.007`. Cloth remains rough, leather avoids a plastic gloss, and the lake uses low metalness and weak environment reflection. Shore water gains slow normal motion; curtain/velvet geometry gains a small vertex displacement. Reduced-motion freezes these two shared shader animations, without implying that all gameplay animation is disabled.

Floor depth and contact stay readable through the raised normal gameplay camera, fog cards behind the playable lane and restrained film blur, chromatic fringe, grain and flicker. Shore water extends behind the far bank and uses longer atmospheric depth. Preserve the authored chapter lighting cues, including the hotel blackout and cell interrogation, rather than applying one bright environment treatment everywhere. Chapter material instances are separate; scene materials and shadow targets are disposed on transitions while shared texture and environment caches remain available. The live game interprets its existing miniature assets; it is not a scanned photorealistic set.

Touch controls retain a small `0 3px 10px #0003` shadow. Existing subtitle shadows preserve readability above gameplay. Reduced-motion title rules do not disable all game camera, character or chapter animation.

## Shapes

Entry uses a square-edged near-black caption field. All five object guides carry ivory cut-paper vector emblems, compact serif labels, faint amber leaders and glowing endpoint dots. Emblems are 38px desktop / 32px mobile inside at least 44px actions. The owl archive and cherry help marks are vertically separated; reduced motion stops the 3.5s beacon pulse. The scene itself supplies the chevrons and curtain folds. Gameplay movement/pause controls remain circular translucent surfaces; use/hold retains its wider 28px capsule and music its rounded track/thumb.

## Components

### Scene stickers

Mountain peaks mark entry, an owl marks archives, cherries mark instructions, coffee marks Falling, and Saturn marks the lamp. Labels name the action rather than requiring symbol knowledge. Hover/focus tips the emblem slightly and brings up warm glow; keyboard focus remains visible. The entry emblem continues a saved game or starts a new one.

### Start and continue

The chair is the entry target. Projected DOM captions provide immediate keyboard/touch alternatives; the primary action is 44px high inside the quiet caption field. A save puts Return to the dream first with chapter detail; new game becomes secondary. Both open the same existing game/save system. Actual chair raycast invokes the current primary action. Entry follows the camera dolly/fade and disposes the title viewer.

### Interactive miniature

Drag with mouse or touch to turn the same real geometry, using pointer capture; wheel zoom is bounded. Focused canvas arrow keys rotate, **L** changes lighting and **Home** resets. Accessible labels, visible focus and grab/grabbing states accompany the canvas. Short taps raycast chair, closed folio, Saturn, programme and lamp; dragging is separated from tapping. Projected SVG leaders connect accessible DOM actions to these actual targets and follow camera changes.

The torchiere raycast and 44px flat DOM light action control real lights, baked-light intensity and local glow. `aria-pressed` reflects lit state; the light action is unavailable until preparation completes. Loading uses the opening geometry; unsupported worker/context failure offers status and a fresh-worker retry without images. Entry, archive, help and music remain usable.

### Music control

Title and pause share a labeled button for **Julee Cruise — Falling**, sourced from the user-supplied `/audio/falling.mp3`. Each visit begins enabled. Native autoplay is attempted; when the browser requires user activation, the first pointer or keyboard gesture starts playback. The control truthfully indicates this waiting state; the track loops at volume `.42`. The loading state disables the button and sets `aria-busy`; failures expose a retry label. Off pauses playback. Hidden tabs pause the track, and visible tabs resume only when it was enabled. The current play position is retained when paused.

Environmental sound has its own pause-menu control and keyboard mute key. The game requests ambient sound without its prior synthesized music layer. Pausing the game suspends environmental audio; it does not automatically turn off the independently enabled Falling track.

### Archive and pause

The closed folio opens archive and the paper programme opens help. Their projected DOM guides retain 44px minimum hit areas; archive uses the near-black caption backing and help remains transparent. Its panel gathers guide books, soundtrack access, language choices and expandable controls. Back returns focus to the archive trigger. Pause contains the story tree, clues, music toggle, effects toggle and resume actions. These are application sections, not native modal dialogs; do not claim focus trapping.

### Touch controls

Directions, run, light, jump and use/hold send the same inputs as keyboard play. Pointer capture supports holds; release, cancellation and window blur clear held input. Use plus direction permits object dragging. A circular 46px pause button occupies the safe top-right corner. Touch controls appear during play, while dialogue uses clickable text advance and choices.

### Grounded gameplay props

A movable prop's rendered mesh and collider must travel together, including any authored mesh-origin offset. Contact patches describe the support under crates, luggage, chairs and other movable geometry; they are not collision surfaces. Keep puzzle supports aligned with the visible top faces and preserve readable seams and material edges. Physical support and actual geometry take priority over stronger fog or bloom when correcting apparent floating or clipping.

### Dialogue and feedback

Dialogue, chapter titles, clues and subtitles remain HTML above the live stage. Interaction prompts project from the world. Buttons and summaries use a 2px warm focus outline offset by 5px. Selected states and labels must remain legible without relying on atmosphere, sound or color alone.

## Do's and Don'ts

### Do:
- Do preserve the whole miniature and its display plinth across title layouts and bounded camera views.
- Do preserve mouse, touch and keyboard paths for room rotation and lighting.
- Do connect entry, archive, music, help and lighting labels to their real object anchors.
- Do preserve the music off switch and independent environmental effects.
- Do preserve keyboard and touch input, focus outlines and visible held states.
- Do retain editable Blender source, shared UV atlas and bake provenance.
- Do align visible feet, prop bases and collider support before adjusting atmospheric effects.
- Do preserve distinct chapter light cues and material differences across all eleven acts.

### Don't:
- Don't reintroduce a paper mode or theme picker.
- Don't use a raster room placeholder during loading or failure.
- Don't promise Cycles material parity in either live title rendering or gameplay.
- Don't use darker grading, thicker fog or stronger bloom to conceal contact or geometry errors.
- Don't describe planar contact patches as ray tracing or global ambient occlusion.
- Don't autoplay Falling or silently persist its enabled state.
- Don't treat browser emulation as physical-device testing or this refresh as removal of TV mode.
