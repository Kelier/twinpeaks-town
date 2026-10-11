"""Check authored GLB floor tops against the game's y=0 support plane."""
import json, struct
from pathlib import Path
root=Path(__file__).resolve().parents[1]
records=[]
for file in sorted((root/'public/game/sets').glob('*.glb')):
    blob=file.read_bytes()
    gltf=json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]])
    for node in gltf['nodes']:
        if node.get('name') not in {'Floor','Floor • chevron','Beach','Ground • east','Ground • west'}:continue
        # These exported set surfaces are unparented, axis-aligned mesh nodes.
        assert not node.get('rotation') and not node.get('matrix'), node['name']
        y=node.get('translation',[0,0,0])[1]
        scale=node.get('scale',[1,1,1])[1]
        top=max(gltf['accessors'][p['attributes']['POSITION']]['max'][1]*scale+y for p in gltf['meshes'][node['mesh']]['primitives'])
        assert abs(top)<.025,(file.name,node['name'],top)
        records.append({'set':file.stem,'surface':node['name'],'top':top})
assert len({r['set'] for r in records})==10
print(json.dumps(records,ensure_ascii=False,indent=2))
print('PASS: all 10 set assets (11 acts) meet the gameplay support plane.')
