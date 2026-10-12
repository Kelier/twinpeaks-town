# Dot and sticker guidance update

The miniature remains the actual baked GLB scene. Five crisp cut-paper vector emblems mark the chair, archive, instructions, music and lamp, with faint leaders and glowing dots at the projected mesh targets. The mountain emblem is a functional entry control; existing real-object raycasts remain in place. The guide uses 38px desktop / 32px mobile art in at least 44px actions, visible text and focus. Reduced motion stops beacon breathing.

Opened final desktop, portrait and landscape captures. Corrected the help/archive overlap on desktop and short landscape in one spacing batch; the final checks assert non-overlap. Four viewport runs pass with no page errors or horizontal overflow, actual touch emulation for portrait/landscape, help/archive panels, light changes and keyboard rotation. The final short-landscape run clicks the entry emblem and verifies title disposal / entry into the game.

BGM defaults enabled. The browser-blocked initial state truthfully says touch to begin. Tests verify actual audio playback on first ordinary interaction, pause on explicit music off, no restart on another navigation action, then explicit re-enable. No renderer or audio mock is used. Native autoplay policy remains browser controlled. Physical phone frame rate has not been measured.

36 unit tests pass and the production build passes. Historical title-landscape review is retained as prior evidence; this report and title-dots/checks.json describe the current marker/music update.
