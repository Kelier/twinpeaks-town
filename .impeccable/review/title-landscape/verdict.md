# Title/homepage material-fix verdict

## Disposition: ship

Scope: verdict on the two material fixes in `review.md` only. Both are resolved. This does not represent a new whole-surface audit or a claim about real-phone performance or all possible close-up material quality.

## Capture validity

Opened the latest `desktop.png` (1440 × 900), `user-2048.png` (2048 × 1013), `mobile.png` (390 × 844), `landscape.png` (844 × 390), `desktop-dark.png` and `mobile-dark.png`. All six show the intended settled title surface, loaded geometry and their named viewport/light state. No invalid, blank, wrong-section or apparent half-loaded capture. The dark captures remain usable.

## Fix scores

| Material fix | Score | Evidence |
| --- | --- | --- |
| Compact portrait title, miniature and helper into one vertical guide group | resolved | On both portrait captures the heading/copy now lead into the stage with roughly 75px of separation, and the helper follows the true stage bottom by roughly 30px. The former two ~200px internal empty bands are removed. The composition reads title → interactive room → hint. The miniature is retained at a useful scale without clipping. Desktop and short landscape retain their working framing. |
| Stabilize entry/archive contrast over chevrons across the required sizes | resolved | Both labels now have restrained near-black caption fields. At native viewing scale the ivory lettering is readable on desktop, user width, portrait and short landscape, including both lights-off captures. Leaders continue to identify chair/folio and entry remains visually primary. The fields remain attached to the landscape rather than becoming a remote menu stack. |

## Supporting checks

Read latest `title.css`, the `geometryBounds` calculation in `title-scene.js` and its hint placement in `title-room.js`. The portrait canvas is now width-proportioned and helper placement follows projected room bounds and the entry caption bottom. Caption changes preserve the existing 44px action dimensions.

Latest `checks.json` reports `touch: true` for mobile and landscape, `touch: false` for desktop/user width, no errors and no scrolling for all four. `test.log` records all four viewport passes. This updates the original review's width-only mobile limitation to genuine touch-emulation evidence; it is still not physical-phone performance evidence. Existing supplementary interaction results support unchanged object-action mapping. No second detector was run.

## Limitations

This pass scored the named fix list and did not reopen unrelated defects. Supplementary normal-motion/saved-choice/retry tests are outside the required evidence for these two scores. No production files or browser state were changed by the reviewer. The initial review's software-rendering/material-finish limitations remain applicable.
