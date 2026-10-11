---
name: "双峰 · 小小梦魇"
description: "An interactive Blender miniature Red Room invites the player into a live 3D dark-red theatre."
colors:
  surround: "#090b0c"
  paper: "#e8dcc6"
  dim: "#baaa94"
  title-text: "#ecdfc8"
  action-text: "#e5d7be"
  action-rule: "#947753"
  quiet-text: "#d2bfa8"
  archive-entry-text: "#eedcc6"
  archive-rule: "#6c5643"
  focus: "#ebc998"
  archive: "#211017"
  music-text: "#d5c5ae"
  music-on: "#682a31"
  touch-background: "#1c141bbd"
  touch-text: "#e9d5b7"
  touch-held: "#76333ee6"
  room-light-background: "#151113d9"
  room-light-off-background: "#0e1118e8"
  room-light-off-text: "#c8bba7"
  room-light-border: "#897259"
typography:
  display:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "clamp(68px, 6vw, 96px)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: ".16em"
  title-copy:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "14px"
    lineHeight: 1.7
    letterSpacing: ".18em"
  subtitle:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "clamp(16px, 1.4vw, 21px)"
    lineHeight: 1.7
    letterSpacing: ".04em"
  wordmark:
    fontFamily: "'TV Serif', Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "12px"
    letterSpacing: ".18em"
rounded:
  round-control: "50%"
  hold-control: "28px"
  music-track: "20px"
  room-light: "24px"
spacing:
  title-gutter: "7vw"
  header-gutter: "4vw"
  portrait-gutter: "28px"
  touch-grid-gap: "4px"
components:
  button-primary:
    backgroundColor: "transparent"
    textColor: "{colors.action-text}"
    padding: "13px 32px 13px 0"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.quiet-text}"
    padding: "12px 0"
  archive-entry:
    backgroundColor: "transparent"
    textColor: "{colors.archive-entry-text}"
    padding: "12px 0"
  music-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.music-text}"
    padding: "8px 0"
  room-light:
    backgroundColor: "{colors.room-light-background}"
    textColor: "{colors.paper}"
    rounded: "{rounded.room-light}"
    padding: "8px 14px"
  room-light-off:
    backgroundColor: "{colors.room-light-off-background}"
    textColor: "{colors.room-light-off-text}"
  touch-button:
    backgroundColor: "{colors.touch-background}"
    textColor: "{colors.touch-text}"
    rounded: "{rounded.round-control}"
    padding: "7px"
  touch-hold:
    rounded: "{rounded.hold-control}"
    padding: "10px 16px"
---

# Design System: 双峰 · 小小梦魇

## Overview

**Creative North Star: "An empty miniature Red Room"**

Near-black space surrounds a complete theatrical miniature: burgundy velvet, black leather chair, Saturn lamp, silver torchiere and ivory chevron floor. The absence of a person is the focus. Warm serif lettering and restrained brass action lines occupy the space beside the room; archive and help stay secondary.

The title loads the actual Blender-exported room model in a separate Three.js viewer. Gentle camera motion gives it life; dragging or keyboard rotation changes the view, and the floor lamp changes real scene lighting. Entering disposes the title viewer and opens the existing eleven-act Three.js game. There is one dark-red theatre interpretation: no paper renderer or visual theme switch remains. Background music is a separate explicit choice, off on every visit.

This document covers `index.html` → `src/game/main.js`: the title under `.impeccable/red-room-title-brief.md` and the eleven playable acts under `.impeccable/game-immersion-brief.md`. Gameplay refinement extends the same miniature puppet theatre through coherent support, materials and light; it does not replace the title design. `src/game/immersion.js` owns the shared gameplay treatment, `gfx.js` the rendering and procedural texture kit, and `levels.js`, `levels2.js`, `levels3.js`, `player.js` and `world.js` the authored stages, characters and physical support. `docs/immersion-audit.md` records the implementation scope; this design document does not establish test results or review disposition. It does not replace the retained `tv.html` screening-room experience, whose own pine/amber interface remains in `src/ui/tv.css`, `src/tvMain.js` and `src/miniatureStage.js`.

**Key Characteristics:**

- A complete interactive miniature silhouette on a quiet black surround.
- A clear continue/new-game hierarchy outside the artwork.
- One live 3D game, with keyboard and translucent touch controls.
- Grounded puppets and movable props, tactile materials and distinct chapter lighting.
- Explicit music state, independent from environmental effects.

## Colors

The interface pairs warm ivory type with a near-black surround and restrained brass rules. Burgundy lives principally in the room's velvet and game imagery, plus selected music and held-touch states. The title's archive entry is transparent with a thin underline; the archive panel itself is opaque burgundy.

Tokens record the effective CSS cascade, not superseded declarations earlier in `theme.css`. Text and focus outlines remain distinct from the richly shaded scene. Music uses explicit on/off text and `aria-pressed`, so its state is not conveyed by red alone.

Gameplay retains its authored chapter light colors and material palette. Shared environment reflections stay restrained: interiors use intensity `.18`, shore and forest `.045`. These are Three.js scene settings, not new interface color tokens. Existing procedural color textures encode their painted colors in sRGB; material roughness and bump add surface detail without replacing the authored base colors.

## Typography

The game uses the self-hosted `TV Serif` with Georgia, Noto Serif SC, Songti SC and generic serif fallbacks. `public/fonts/tv-serif.ttf` is the existing Noto Serif SC subset; its source/license record is `docs/tv-cut/font-source.txt`. It is not complete CJK coverage and new characters may use system fallbacks.

The regular-weight Chinese title is widely spaced and shadow-free. On portrait mobile it becomes 52px with `.15em` tracking and the small English title sits beside it. Short landscape also uses a 52px title but hides the English subtitle. Portrait title copy is 12px; gameplay subtitles are 16px with 1.7 line height on the mobile layout. Track credit uses 10px Georgia, reduced to 9px in short landscape. Those credit/footer sizes are not appropriate for primary reading content.

## Layout

The stage fills the viewport. Desktop title content occupies a 32% column, capped at 440px and offset by 7vw. The miniature container begins at 29% of viewport width; the live camera fits the room to its aspect ratio, while the loading/error poster uses `object-fit: contain`; the entry action is at most 320px wide. Header controls use 4vw gutters. Artwork and interface are separate, with no text laid across the chair or floor.

At maximum 760px in portrait, the miniature sits above the title in a region `clamp(250px, 43dvh, 390px)` tall, starting below the header. The title and actions use 28px gutters; the music switch and track credit share a compact row. The title may scroll on short screens. In landscape at maximum 520px height, the title stays left at 34% width and the artwork begins at 38%; the live viewer is inset by 48px above and below, while the fallback poster retains `max-height: calc(100dvh - 30px)`. Desktop viewers above 760px width and 520px height have 60px top and 64px bottom insets. A short interaction hint and a light button sit within the artwork area, with compact placements on portrait and landscape screens.

Coarse pointers or widths up to 760px expose touch controls during play. Their direction pad uses 44px cells and 4px gaps, while the action cluster has 7px gaps. Safe-area insets protect the edges. Subtitles sit above controls; dialogue is capped at 55dvh and can scroll. At 380px, touch gutters tighten to 10px. Browser-emulated viewport checks do not establish physical-phone compatibility or performance across mobile GPUs.

## Elevation & Depth

The title viewer in `src/game/title-room.js` loads `public/themes/red-room-interactive.glb`, exported from the editable `blender-materials/title-redroom/title-redroom.blend` by `export_title.py`. The title now renders real geometry, soft shadows, environment reflections, lamp emission and changing light intensities in Three.js. AgX tone mapping and runtime materials interpret the Blender source; they do not reproduce every Cycles detail.

`public/themes/red-room-miniature.webp` remains only the loading/error fallback, derived from the original offline Cycles render through `render_title.py`. Its CSS brightness, saturation, shadow and entrance animation apply to that poster, not the live canvas. Preserve its provenance record when exporting the fallback.

The viewer has restrained sinusoidal idle yaw and pointer-follow motion, plus bounded user rotation. Camera and light changes are damped at rate 7. Reduced-motion disables automatic idle/pointer motion, the poster entrance and canvas crossfade, while explicit rotation and light interaction remain available with damping. Rendering skips hidden tabs and is scheduled at up to 30fps, with pixel ratio capped at 1.5; this is not a measured device frame-rate guarantee. Gameplay entry disposes the viewer, model resources and its separate WebGL context. Live gameplay continues in the existing renderer with chapter models, lighting and postprocessing.

Gameplay uses soft shadow maps plus support-aware contact patches beneath the player, registered cast members and movable props. Each patch follows the highest eligible solid collider below the subject, sits `.008` world units above that surface, expands and fades with height, and disappears when there is no support or the gap reaches 3 world units. These are soft planar contact approximations, not screen-space ambient occlusion or ray-traced shadows; they do not fix mismatched mesh/collider geometry by themselves. Shared shadow calibration uses depth bias `−.00008` and normal bias `.008` world units.

Material detail is restrained and selective. Existing mapped standard materials gain shallow bump (`.008`) when none is authored. Unmapped leather, fabric, stone, rock, wood and bark receive deterministic micro height/roughness; coarse stone, rock and bark use `.025` bump, other selected materials `.007`. Cloth remains rough, leather avoids a plastic gloss, and the lake uses low metalness and weak environment reflection. Shore water gains slow normal motion; curtain/velvet geometry gains a small vertex displacement. Reduced-motion freezes these two shared shader animations, without implying that all gameplay animation is disabled.

Floor depth and contact stay readable through the raised normal gameplay camera, fog cards behind the playable lane and restrained film blur, chromatic fringe, grain and flicker. Shore water extends behind the far bank and uses longer atmospheric depth. Preserve the authored chapter lighting cues, including the hotel blackout and cell interrogation, rather than applying one bright environment treatment everywhere. Chapter material instances are separate; scene materials and shadow targets are disposed on transitions while shared texture and environment caches remain available. The live game interprets its existing miniature assets; it is not a scanned photorealistic set.

Touch controls retain a small `0 3px 10px #0003` shadow. Existing subtitle shadows preserve readability above gameplay. Reduced-motion title rules do not disable all game camera, character or chapter animation.

## Shapes

The title's fine rules and square-edged text actions leave the miniature dominant. The drawn arrow ends the leading action. Gameplay movement and pause controls are circular translucent surfaces; use/hold is a wider 28px-radius capsule. The music indicator uses a small rounded track and circular thumb. Chevron flooring and vertical curtain folds belong to the room, not every text panel.

## Components

### Start and continue

The leading action has a brass bottom rule, arrow and minimum 48px height on desktop. Continue moves first when a save exists and displays its chapter; new game becomes secondary. Short landscape actions have a 44px minimum height. Both lead into the same live 3D game and existing save system.

### Interactive miniature

Drag with mouse or touch to rotate within a bounded corner view; pointer capture supports the drag. When the canvas is focused, arrow keys rotate, **L** toggles lights and **Home** resets the view. Yaw targets are limited to −.05…1.18 radians and pitch to .22….85 radians. The canvas has an accessible instruction label, visible focus outline and grab/grabbing cursors. Interaction does not start gameplay.

Clicking or tapping a raycast floor-lamp mesh toggles the same lighting as the explicit `.room-light` button. The button uses a 44px minimum height, rounded dark surface, icon, action label and `aria-pressed` reflecting whether the lights are on. Both on and off states change real light intensities and shade emission. It is disabled during loading. Load/context failure exposes the poster and an unavailable/retry message; initial renderer failure gives a simpler unavailable message. The hint labels the supported interaction without hiding the entry action.

### Music control

Title and pause share a labeled button for **Julee Cruise — Falling**, sourced from the user-supplied `/audio/falling.mp3`. Each visit begins off, without a remembered opt-in. An explicit click starts playback; the track loops at volume `.42`. The loading state disables the button and sets `aria-busy`; failures expose a retry label. Off pauses playback. Hidden tabs pause the track, and visible tabs resume only when it was enabled. The current play position is retained when paused.

Environmental sound has its own pause-menu control and keyboard mute key. The game requests ambient sound without its prior synthesized music layer. Pausing the game suspends environmental audio; it does not automatically turn off the independently enabled Falling track.

### Archive and pause

The quiet archive entry uses a thin brass rule and 44px minimum height. Its panel gathers guide books, soundtrack access, language choices and expandable controls. Back returns focus to the archive trigger. Pause contains the story tree, clues, music toggle, effects toggle and resume actions. These are application sections, not native modal dialogs; do not claim focus trapping.

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
- Do keep entry actions, archive and music understandable without covering the room.
- Do preserve explicit music opt-in and independent environmental effects.
- Do preserve keyboard and touch input, focus outlines and visible held states.
- Do retain the editable Blender source and raster provenance.
- Do align visible feet, prop bases and collider support before adjusting atmospheric effects.
- Do preserve distinct chapter light cues and material differences across all eleven acts.

### Don't:
- Don't reintroduce a paper mode or theme picker.
- Don't replace the live title viewer with its static poster except during loading or failure.
- Don't promise Cycles material parity in either live title rendering or gameplay.
- Don't use darker grading, thicker fog or stronger bloom to conceal contact or geometry errors.
- Don't describe planar contact patches as ray tracing or global ambient occlusion.
- Don't autoplay Falling or silently persist its enabled state.
- Don't treat browser emulation as physical-device testing or this refresh as removal of TV mode.
