"""Export the current game and its editable title scene, without dependencies/cache."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
prefix='twin-peaks-little-nightmare-game/'
paths=set()
if (root/'twin-peaks-little-nightmare-game.zip').is_file():
    with ZipFile(root/'twin-peaks-little-nightmare-game.zip') as old:
        for name in old.namelist():
            rel=name.removeprefix(prefix)
            if (root/rel).is_file():paths.add(rel)
else:
    for p in root.glob('*'):
        if p.is_file() and p.suffix in {'.html','.json','.js','.md'}:paths.add(p.name)
    for p in (root/'public').rglob('*'):
        if p.is_file():paths.add(str(p.relative_to(root)))
for directory in ['src','tests','scripts','public/game','public/themes']:
    for p in (root/directory).rglob('*'):
        if p.is_file() and '__pycache__' not in str(p):paths.add(str(p.relative_to(root)))
for rel in ['public/audio/falling.mp3','blender-materials/title-redroom/render_title.py','blender-materials/title-redroom/bake_title.py','blender-materials/title-redroom/title-baked.blend','blender-materials/title-redroom/export_title.py','blender-materials/title-redroom/title-redroom.blend','blender-materials/miniature-production/twin-peaks-miniatures.blend','blender-materials/redroom-rebuild/rebuild_redroom.py','DESIGN.md','.impeccable/design.json','docs/redroom-release.md','docs/immersion-audit.md','skills-lock.json','.impeccable/game-immersion-brief.md','.impeccable/review/immersion/checks.json','.impeccable/review/immersion/asset-grounding.txt','.impeccable/review/immersion/hotel.log','.impeccable/review/immersion/touch.log','.impeccable/review/immersion/unit.log','.impeccable/review/immersion/review.md']:
    if (root/rel).is_file():paths.add(rel)
for rel in ['.impeccable/title-atmosphere-brief.md','.impeccable/review/title-atmosphere/review.md','.impeccable/review/title-atmosphere/checks.json','.impeccable/review/title-atmosphere/states.json','.impeccable/review/title-atmosphere/before.json','.impeccable/review/title-atmosphere/after.json']:
    if (root/rel).is_file():paths.add(rel)
for p in (root/'.impeccable/review/title-loading').rglob('*'):
    if p.is_file() and p.suffix in {'.json','.md'}:paths.add(str(p.relative_to(root)))
for p in (root/'.impeccable/review/title-dots').rglob('*'):
    if p.is_file() and p.suffix in {'.json','.md'}:paths.add(str(p.relative_to(root)))
for p in (root/'.impeccable/review/title-landscape').rglob('*'):
    if p.is_file() and p.suffix in {'.json','.md'}:paths.add(str(p.relative_to(root)))
# These have been removed, even when an older source snapshot still names one.
for rel in ['src/game/sticker-stage.js','src/game/theme-ui.js','scripts/theme-review.mjs','scripts/theme-touch-test.mjs','public/themes/paper-room-cover.png','public/themes/red-room-cover.png','public/themes/red-room-miniature.png','public/themes/red-room-miniature.webp','public/themes/red-room-miniature.webp.json']:
    paths.discard(rel)
with ZipFile(root/'lynch-redroom-source.zip','w',ZIP_DEFLATED,compresslevel=6) as out:
    for rel in sorted(paths):out.write(root/rel,prefix+rel)
print(f'Packed {len(paths)} files: {(root/"lynch-redroom-source.zip").stat().st_size:,} bytes')
