# Gameplay immersion audit

Scope: `index.html` live eleven-act 3D game, October 11, 2026. Existing miniature puppet identity, story, music, title viewer and saved-game format are preserved.

## Diagnosis and changes

- Feet and shore floor were at the same world height. The perceived hovering came primarily from missing local contact occlusion, stretched cast shadows, a shallow camera angle, and mist cards intersecting the playable depth lane. Added support-aware contact shadows to the player, cast and movable props. Contacts expand/fade while airborne and follow raised collision surfaces.
- Calibrated shadow normal bias to .008 world units and depth bias to -.00008. Raised the normal gameplay camera to expose floor depth; close-up dialogue framing is unchanged.
- Canvas textures previously wrote linear RGB values into sRGB image bytes. Corrected the affected colour textures and reduced the exaggerated sinusoidal wood-grain contrast.
- Added restrained shared environment reflections, separate interior/exterior intensity, material-specific micro height/roughness for leather, fabric, stone and timber, and subtle bump from existing colour maps. Preserve authored light colours and cues, including hotel blackout and cell interrogation effects.
- Fog cards are behind the playable lane with reduced overlap. Reduced chromatic fringe, blur, grain and frame-wide flicker so geometry and contact remain readable.
- Shore: removed the opaque artificial water-highlight strip; subtle live water normal motion, dark low-reflection lake material, longer atmospheric depth, real crate battens/seams; boulder top collider adjusted to the imported mesh height.
- Velvet has a restrained vertex motion, disabled with reduced-motion preference. Existing rain, dust and story effects remain.
- Reduced only the Roadhouse singer spotlight and final Red Room key to retain costume, upholstery and curtain detail in highlights, preserving scripted light colours.
- Clone imported materials per instance and dispose scene materials/shadow targets on chapter changes. Shared texture and environment caches remain alive.

## Skill use

Installed via `npx skills` from `leonxlnx/taste-skill`: `design-taste-frontend`, `redesign-existing-projects`, `high-end-visual-design`. Applied the existing-project audit and contextual preservation guidance to this game; marketing-page font/layout prescriptions do not override the supplied Twin Peaks art direction.

## Verification evidence

- `tests/game-spatial.test.js`: grounding, solid-wall blocking, pushed mesh/collider alignment, and traversal of the corrected one-metre shore boulder.
- `scripts/check-set-grounding.py`: all ten GLB set floor tops (eleven acts) align to y=0 within the asserted 2.5 cm tolerance.
- `scripts/immersion-check.mjs`: all eleven scenes, real production shaders rendered on demand at full capture resolution, portrait and landscape touch layouts. On-demand SwiftShader capture is visual/loading evidence, not hardware performance measurement.
- `scripts/game-hotel-regression.mjs`: lamp interaction, save recovery, restored completed state and actual physics exit to the next act.
- `scripts/redroom-touch-test.mjs`: two-finger push/grab, jump and cancellation.

The work improves the existing authored miniature assets. It does not replace them with scanned photorealistic sets, add ray tracing, or certify physical-phone frame rates. Final checks and review disposition are recorded in the release note.
