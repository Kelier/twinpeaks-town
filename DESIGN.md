---
name: "双峰 · 最后一盘录像带"
description: "A quiet, click-led screening room of pine darkness, amber transport and paper memories."
colors:
  ink: "#0b100e"
  paper: "#eee8d9"
  muted: "#bebcad"
  amber: "#e5bc78"
  line: "#ffffff29"
  deck: "#111b16"
  dialog: "#18221b"
  scrapbook: "#d9d1bd"
  scrapbook-ink: "#353d30"
  primary-ink: "#172017"
  primary-hover: "#f2d196"
  curtain: "#19090c"
typography:
  display:
    fontFamily: "TV Serif, Georgia, serif"
    fontSize: "clamp(64px, 6.5vw, 94px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "14px"
  headline:
    fontFamily: "TV Serif, Georgia, serif"
    fontSize: "clamp(26px, 3vw, 42px)"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "4px"
  title:
    fontFamily: "TV Serif, Georgia, serif"
    fontSize: "35px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "3px"
  body:
    fontFamily: "Georgia, 'Noto Serif SC', 'Songti SC', serif"
    fontSize: "16px"
    lineHeight: 1.9
  label:
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "12px"
    letterSpacing: "1px"
spacing:
  page-gutter: "4.5%"
  mobile-gutter: "5%"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.primary-ink}"
    padding: "15px 25px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-quiet:
    textColor: "{colors.muted}"
    padding: "0 9px"
  button-choice:
    padding: "10px 14px"
  button-next:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.primary-ink}"
    padding: "11px 17px"
  dialog:
    backgroundColor: "{colors.dialog}"
    textColor: "{colors.paper}"
    padding: "50px 54px"
    width: "min(900px, 92vw)"
  scrapbook:
    backgroundColor: "{colors.scrapbook}"
    textColor: "{colors.scrapbook-ink}"
    padding: "35px 15px"
---

# Design System: 双峰 · 最后一盘录像带

## Overview

**Creative North Star: "A private videotape screening room"**

A private 1990–91 videotape screening room: forest-black matte, warm amber transport, red-curtain interruptions and cream-paper memories. The inherited serif/pine/velvet world now frames a small physical theater: wooden display plinths, cutaway scenery and stylized characters rendered as real 3D geometry. Deliberate clicks move the camera toward props and characters; the reading band carries the story.

This refresh follows the approved Blender-first system change in `docs/tv-cut/miniature-direction.md`, grounded in `src/ui/tv.css`, `src/tvMain.js` and `src/miniatureStage.js`. It preserves the TV interface and story while replacing the earlier 2.5D scenery. Old roaming-game assets and AI scene plates remain historical material.

**Key Characteristics:**

- Full-width miniature stage, quiet reading band and linear tape transport.
- Large Chinese serif titles, restrained functional labels and amber focus.
- Tactile collected objects on a cream album surface.
- Click-driven camera views, physical stage exchange and pause.

## Colors

The palette combines forest darkness, warm transport light and physical paper. Frontmatter records consumed interface colors; CSS also declares pine and red custom properties that currently have no `var()` consumers. Those declarations are not presented as active component tokens. Pine and velvet persist through image direction, dark green surfaces and curtain cuts.

### Primary
- **Tape amber:** play, next, current timeline stop, progress, selected reflections, counters and focus outlines.

### Secondary
- **Curtain darkness:** the red-room and grove cut surface. The red-room and mirror scenes also darken the transport into a burgundy surface.

### Neutral
- **Forest ink, deck and dialog:** page, transport and modal layers, with subtle light borders.
- **Warm paper and muted paper:** primary and secondary reading text on dark surfaces.
- **Scrapbook paper and scrapbook ink:** the album’s deliberately lighter material, separate from the television frame.

**The State Legibility Rule.** Amber supports visible state; checks, labels, disabled controls and current-step semantics carry the same meaning.

## Typography

Titles, the brand and memorial name use **TV Serif**, a self-hosted Noto Serif SC Regular subset at `public/fonts/tv-serif.ttf`, with Georgia/serif fallback and `font-display: swap`. Font source and SIL Open Font License provenance are recorded in `docs/tv-cut/font-source.txt`; this is subset coverage, not a full CJK font. The terminal heading rule overrides earlier generic serif declarations.

Narrative paragraphs retain the CSS serif stack in frontmatter. They do not automatically receive the self-hosted display subset. Functional text uses system Chinese sans; tape labels and broadcast numerals use monospace. Do not claim identical Chinese body rendering on every platform.

Display is the opening title; headline is the scene title; title is the dialog heading. Body tokens describe the story paragraph, not every text node. Base UI text is 15px; small functional labels range from 9–12px on desktop, with some mobile tape labels at 8px. The mobile scene heading is 22px and story copy is 15px with the same 1.9 line height. Small labels remain a practical reading limitation and are not a type scale to extend into future controls.

## Layout

A 76px broadcast header precedes the opening’s actual lakeshore miniature, left-hand title and amber play action. The opening title leads directly without the former decorative station eyebrow. During play, a full-width picture (`clamp(420px, 59svh, 820px)`) precedes a reading band (maximum 1500px) and tape deck. Default horizontal gutters are recorded in frontmatter. A persistent WebGL canvas occupies the former image position; the camera reframes real geometry for the viewport, with four click-based views rather than character locomotion.

At 760px and below, the header becomes 64px, the wordmark subtitle hides and controls tighten. The final mobile picture rule uses a 16:16 outer frame with a 105px upper matte for captions and camera controls; the canvas and projected hotspots occupy the space below it. The opening miniature occupies the upper 60% and the title receives 230px top padding. Reading and reflection blocks stack. The tape scrolls horizontally with 44px minimum stops; the page itself should not overflow. At 1700px and above, reading-band side padding drops to zero within its maximum width.

The modal is viewport-bounded and scrollable. The album has four columns on desktop and two on mobile; dialogs become 94vw with 35px/22px padding and a 90svh maximum height. This responsive structure is part of the shipped screen, not an abstract grid mandate for every future surface.

## Elevation & Depth

Depth comes from real mesh geometry, perspective, a wooden display base and cast shadows. Ten Blender sets and eight character models are loaded as GLBs; runtime lighting combines a warm directional key, cool fill, hemisphere light and a warm rim. Three.js uses standard PBR materials, ACES filmic tone mapping and soft shadow maps. Blender Cycles previews share the source geometry but include procedural material bump that is not exported to GLB; do not present preview material detail as runtime parity. No photographic image planes supply scenery.

UI gradients, a vignette, faint scanlines and a blurred modal backdrop remain above the stage. The dialog casts `0 30px 100px #000a`; the album uses `inset 0 0 55px #9b896c3d`; toast feedback uses `0 6px 30px #0008`.

The incoming set slides from 11 world units over 1100ms with cubic easing; the outgoing set moves toward −12 over 900ms. Camera position and look target ease with an exponential rate of 4; idle set rotation has a small .008-radian amplitude. The old still-image drift is disabled on miniature hosts, and the old CSS splice is hidden in miniature mode. Application chapter staging still waits 360ms per phase. Hotspot breathing runs 3s, tape fill transitions over 1.2s, buttons use .2s state transitions and collection uses a 720ms Web Animation peel. The runtime schedules at most 24 frames per second using a timer before the next animation frame; this is a scheduling cap, not measured rendering throughput. Values are recorded in the sidecar, outside the frontmatter schema.

Pause and open dialogs stop stage updates and suppress ambient sound. Gentle mode snaps the camera and incoming set into position, freezes character head animation, and skips idle stage drift, peel and chapter waits; system reduced-motion disables CSS animation and transition. The character-animation freeze is verified by an isolated test of the actual production tick (`.impeccable/review/miniature/motion-test.json`); renderer and scheduler are stubbed. The post-correction full browser rerun stopped after shared-VM memory exhaustion, so it is not a full browser pass.

**The Physical Stage Rule.** Scene depth and camera changes must come from geometry and world-space motion; do not substitute photographic plates for miniature sets.

## Shapes

Buttons and panels are square-edged; no generic rounded-card scale is introduced. Circular observation targets have a larger rectangular hit area, while small round tape markers indicate progress. Album objects rotate through −5°, 4°, −2° and 6°; unopened placeholders have dashed, irregularly rounded stamp silhouettes. Shape and material distinguish the collectible album from the playback interface.

## Components

### Playback buttons
Amber primary and next actions have dark text; quiet actions remain muted on dark surfaces. Buttons have a minimum height of 44px. The focus outline is 2px amber with a 4px offset. Hover lightens text or the filled surface; active presses translate down 1px. Disabled next explicitly requests three observations and a reflection before continuing.

### Observation targets and reading links
Each scene has three numbered targets projected from world-space points, with checks for read state, an amber read surface and visible selection. Desktop labels reveal on hover/focus/selection; mobile hides those labels, so all three actions also appear as ordinary reading-band buttons. This duplicate action path makes hover unnecessary.

### Camera views
Four compact controls select full view, left, right and character close-up. A second compact row names the scene’s cast; selecting a name frames that character’s head and upper costume using the actual scene model, with a selected pressed state. At 390px the scene starts below a 150px control matte so the two rows stay tappable. Observation clicks focus the camera on a physical scene point. Camera navigation stays separate from story completion and does not require dragging or movement keys.

### Reflection and collection
Two outlined choices become available after the three beats. A chosen reflection uses a check, amber border/text and tinted fill. The removable SVG sticker is a separate optional action; collection feedback updates the thirteen-item count and album. Reflection alters the journal, not the story’s outcome.

### Tape transport
Ten stops expose the current step, visited access and disabled future stops. Progress fills continuously across a scene’s observations. Mobile preserves target width through horizontal scrolling. There are no movement controls or draggable timeline requirements.

### Album and dialogs
A native modal dialog contains the paper album, saved notes, source/setting panel or author fragment. Collected album objects replay their scene; missing ones provide a hint. Escape and a labeled close button exit; focus returns to a triggering action. Settings include sound and gentle motion; restarting uses a separate confirmation dialog.

## Do's and Don'ts

### Do:
- Do keep miniature scenery dominant and narrative text on a legible reading surface.
- Do preserve the mobile upper matte and duplicate hotspot actions in the reading band.
- Do expose selected, read and locked states with text or symbols as well as color.
- Do extend the licensed display-font subset when adding heading characters.

### Don't:
- Don't describe the stylized basic rigs as actor scans, finished facial animation or full scene acting.
- Don't replace the full-width screening composition with a generic card dashboard.
- Don't require hover, dragging, sound or movement keys to complete the story.
- Don't make choices imply changed canonical fates or claim unread scripts were reviewed.
