# Title atmosphere finish review

Disposition: **ship** — all material findings resolved in the supplied viewport/state evidence. Fresh source/screenshot review, no inherited implementation history and no browser run by reviewer.

## persistence
The brief records Experience mode, pinned Twin Peaks miniature identity, the rejected incumbent screenshot, a code-led refinement, the intended viewport hierarchy and signature lamp interaction. `title.css` is the visual authority; existing `DESIGN.md` describes the older title and needs the intended documenter update. No approved comp exists. The original screenshot is rejection evidence, not a fidelity target.

## fidelity
Desktop now gives the live miniature the dominant middle/right region, with quiet serif title and compact thematic entries at left. Navigation recedes to two understandable actions; the former long menu rules and clipped lamp pill are gone. Warm local halation stays attached to the actual lamp; the chair and curtain remain crisp. On/off screenshots show actual lighting changes, and drag captures show changed viewpoints rather than a poster substitution.

The first portrait evidence clipped the miniature and overlaid the room hint onto the primary entry. The 14:22 confirmation resolves both: whole plinth and curtain frame are visible, hint and entry occupy separate bands, and mobile drag remains inside the frame. The portrait composition retains the requested title → room → entrance sequence. Short landscape remains readable with clear control separation.

## ceiling
The pinned miniature direction is coherent and specific enough to ship; no rebuild or additional aesthetic iteration is warranted. Screenshot evidence covers desktop 1440×900, portrait 390×844, and landscape 844×390 in on/off/drag states. The capture script uses the production renderer with on-demand draws after state changes to stabilize SwiftShader; this proves composition and interaction state, not phone FPS. Static images cannot prove startup smoothness. Source inspection supports staged download/preparation/async compile/first-render reveal, bounded DPR, cached shadows, hidden-tab skipping, reduced-motion idle stopping, and renderer disposal on entry. The supplied tests establish actual GLB loading, switch/raycast interaction and drag, with no recorded page errors. Keyboard/error/early-entry behavior still depends on the separate functional verification evidence, not these screenshots.

## material_fixes
| Finding | Status | Required result |
|---|---|---|
| Portrait hint overlaps entry; miniature clips at sides | Resolved | Corrected mobile on/off/drag captures have distinct bands and complete silhouette. |
| Short-landscape actions reduced below 44px | Resolved in CSS | New min-height rules restore 44px actions; composition has space. |
| Model resource ownership begins after asynchronous yield | Resolved in source | Model is attached before first await, so early dispose traverses it. |
| Mobile floor has dark doubled-chevron artifacts | Resolved | Final mobile on/off/drag captures (14:26:53 onward) remove the former jagged duplicate pattern while preserving floor contrast, chair/table contact, lamp halation and complete framing. Source applies targeted chevron polygon offset and narrows camera depth range to 1–80. The implementation diagnosis was depth conflict between floor layers 1 mm apart; disabling floor shadow casting alone did not resolve it. |

Final verdict pass: independently inspected all three refreshed mobile images and the depth calibration source. The on-demand SwiftShader capture limitations above still apply. The supplied targeted touch test completed with no recorded page errors. No new material issue was opened.

## keep
Keep the restrained serif/ivory/oxblood palette, genuine miniature geometry and plinth, compact thematic verbs, explicit music opt-in, direct lamp switch plus raycast, keyboard rotation/light/reset, warm local halo, reduced-motion behavior and failure poster. Preserve the corrected complete-model fitting and separated portrait bands. No theme selector or photographic overhaul is needed.
