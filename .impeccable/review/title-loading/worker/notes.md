# Title loading isolation — 2026-10-11

The user's rejected screenshot shows the poster during preparation. Reproduced at2048×1187: artwork host1495×938 but grid image1495×1495. Absolute containment now keeps image and host identical without changing gameplay.

The first repair reduced driver first-draw blocking but still left a1.484s preparation longtask. This was rejected by the fresh reviewer. The final repair moves GLB parsing, material compilation, texture upload, shadow warmup and rendering to an OffscreenCanvas dedicated Worker. DOM controls, sizing, input dispatch and the30s recovery timer remain on the main thread. Game WebGL renderer/composer are only allocated at entry. Renderer resolution is capped at720,000pixels; true GLB geometry, lamp raycast, camera drag, reduced motion and the existing halo remain.

Network bounds:20s GLB request,4s optional environment map;8s shader readiness;30s main-thread worker deadline also recovers from a worker that cannot service its own timers. HDR failure proceeds with direct scene lights. Worker failure leaves complete poster + menu + retry. Retry starts a fresh worker without reloading saves. Entering the game terminates the title worker and removes its canvas.

Comparable cold Chromium/SwiftShader diagnostics at1100×760: prior title-atmosphere/after.json ready12.67s, main task5.492s; intermediate performance.json ready6.61s with1.484s preparation task; final worker/performance.json ready5.51s with only934ms initial module evaluation and no later longtasks from title preparation. These are software-renderer development-server measurements, not physical-phone FPS or a universal timing guarantee.

The fault-injection test creates a worker that loops forever; the main UI is then clicked and its independent deadline checked. Pending image captures intentionally show loading, while normal on/off/drag screenshots show the rendered GLB. No renderer mocking is used in the worker test.
