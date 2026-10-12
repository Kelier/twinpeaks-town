# Title/homepage finish review

## 1. Disposition: fix

Scope: the new title/homepage miniature navigation only. This is a fresh full review against the user's latest rejection and `.impeccable/title-atmosphere-brief.md`; it does not inherit approval of the earlier loading work. Code-led: no approved comp exists.

The miniature now does real navigation: projected leaders connect labels to the chair, folio, Saturn, programme and lamp; the actual GLB receives raycasts; the first visible geometry is a lower LOD of the same room rather than a raster poster. This materially addresses the separated image/model and navigation complaints. The chair, chevrons, charcoal upholstery, red curtains and warm lamp preserve the pinned world. The source also contains a coherent arrival, lighting emergence and entry dolly/fade rather than disconnected hover effects.

Two material refinements remain. The portrait composition still leaves the miniature isolated between large empty vertical bands, and important scene labels lose clarity on the chevron floor. Neither calls for replacing the world or rebuilding the model wholesale.

## 2. Required capture validity and viewport findings

I opened every required screenshot and the user's rejection image. All six required captures show the named, settled title surface and loaded geometry; none is blank, a wrong section or an apparent intermediate loading state. The dark captures show a deliberate lights-off state and remain readable. They are valid evidence, so this is not a recapture disposition.

| Capture | Finding |
| --- | --- |
| `desktop.png`, 1440 × 900 | Single centered stage; large separated left title column is gone. All five controls are findable. Entry and archive are positioned over patterned flooring, with weaker local contrast than help/music/light. |
| `user-2048.png`, 2048 × 1013 | The user's rejected split composition is replaced by a centered miniature with object-linked navigation. The stage is about 760px wide; the title is quiet. Software-rendered edges and curtain grain limit any assertion of close-up finish. |
| `mobile.png`, 390 × 844 | No clipping or page overflow. Header occupies roughly y30–110; miniature occupies y315–592; helper text is at roughly y785. The two approximately 200px quiet bands leave the page visibly scattered instead of compact. The archive label is particularly weak against the patterned floor. |
| `landscape.png`, 844 × 390 | Fits within the short viewport; all actions are exposed without scrolling. The entry label again crosses the busy floor. Geometry is understandably small; touch sizing is better supported by the recorded 44px controls than by apparent text size. |
| `desktop-dark.png` | Lamp illumination is visibly removed; control says 开灯. Scene does not disappear and guides remain available. Same floor-label issue. |
| `mobile-dark.png` | Lights-off state is valid and navigable; same portrait spacing and floor-label issues. |

At review time the mobile/landscape evidence establishes viewport layout and desktop-pointer actions at those sizes. The parent reports genuine mobile/touch emulation is being run separately; these existing captures do not establish touch behavior or phone performance.

## 3. Material fixes, ranked

1. **Compact the portrait guide into one deliberate vertical group.** This directly follows “排版紧凑些” and the contract's title “at its upper edge.” In `src/game/title.css`, `.title-art` stretches between fixed viewport insets, while camera fitting centers a width-constrained miniature inside that tall region. Move the title, scene and helper into a composition governed by the miniature's actual visible extent: bring the scene upward toward the title and the helper immediately below the stage, keeping the quiet footer separate. Do not compensate by enlarging the model until it clips. Resolution evidence: both 390 × 844 lights states read as title → room/navigation → hint within one compact group, without the current two ~200px internal voids; desktop and short landscape keep their working framing.

2. **Give entry and archive stable contrast over the floor in every required size.** The light 17–18px entry and 12–14px archive lettering lie on alternating black/ivory chevrons. A black text shadow improves dark edges but does not create a consistently readable text field, especially for the mobile archive. Keep the leaders connected to their objects, but move these labels to a quiet region of the miniature's immediate surroundings or provide a subtle local dark backing that fits this world. Retain 44px hit areas and entry priority. Resolution evidence: entry/archive are readable at native screenshot scale in desktop, user width, portrait, short landscape and both lights states, while leaders still identify the chair and folio and saved/new choices remain unobstructed.

## 4. Nonblocking polish

- The warm serif labels and delicate leaders are coherent with this room. Preserve their restraint while solving contrast; a conventional button stack or large hero heading would reintroduce the rejected separation.
- The practical light bloom is localized and the lights-off comparison demonstrates a real lighting change. The supplementary bounded-zoom `detail.png` is valid and retains rounded upholstery and the same spatial lighting; curtain texture remains somewhat noisy in this software capture. This is a remaining material-finish limitation when presenting the result, rather than evidence that the bake is absent.
- Detector findings are advisory palette/type documentation drift. Pass the intentional title palette and size steps to the documenter. They are not mechanical failures and do not justify a second detector run.

## 5. Evidence and limitations

Inspected: required screenshots listed above; user rejection image; surface brief; `src/game/title.css`, `src/game/title-room.js`, `src/game/title-scene.js`, the relevant `src/main.js` initialization/behavior; `blender-materials/title-redroom/bake_title.py`; `public/themes/room-bake.json`; assets/checks/detector JSON and unit/build/test logs in this review directory.

Asset evidence records 65 meshes, 223,144 full-model triangles, 35,537 opening-model triangles, shared atlas UVs, and three 2048 × 2048 light/AO/normal maps. The durable Cycles source bakes direct and indirect diffuse illumination and contact AO with 16 samples and four bounces. The runtime installs those maps, uses authored surface normals on chair/velvet, changes baked illumination intensity with the lamp and preserves the actual mesh through opening/full load. This supports “actual UV-baked interactive geometry”; it does not by itself prove aesthetically finished material at every magnification.

`checks.json` records ready/present geometry, no errors, no scroll and exposed controls for all four widths. `test.log` records all four viewport actions passed. `unit.log` records 36 passing tests; `build.log` records a successful production build. Software renderer is true in all recorded viewport checks, with a 420,000-pixel budget; desktop DPR is about .72 and user-width DPR about .67. Hardware cap/adaptation code exists, but these captures cannot substantiate real-phone FPS or hardware sharpness.

Arrival and entry motion are supported by source inspection; still images cannot grade their timing or continuity. Supplementary `detail.png` was opened and is a valid bounded closer view. `interactions.json` and `interactions.log` record actual programme/folio/Saturn/chair raycasts, explicit Falling playback/pause, pointer drag, keyboard reset, bounded zoom, worker disposal upon entry and usable help before geometry download with no image placeholder. These support the interactive landscape mechanism. Genuine mobile/touch evidence remains pending. No browser was started by this reviewer. The two material findings above are visual observations from valid supplied evidence.
