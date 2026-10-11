# Build, AO-bake (into vertex colour) and export the ten miniature sets.
# Run: blender -b --python build_sets.py -- [--only=redroom,diner] [--preview] [--bake-samples=48]
import bpy, sys, json, math
from pathlib import Path
from mathutils import Vector
R = Path(__file__).resolve().parent
sys.path.insert(0, str(R))
import lib
from sets import SETS

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = next((a.split('=')[1].split(',') for a in ARGS if a.startswith('--only=')), None)
PREVIEW = '--preview' in ARGS
NOBAKE = '--no-bake' in ARGS
BAKE_SAMPLES = int(next((a.split('=')[1] for a in ARGS if a.startswith('--bake-samples=')), 48))
OUT = R.parents[1] / 'public/models/twin-peaks'
STAGES = OUT / 'stages.json'


def finalize_meshes():
    """Apply modifiers, convert text, subdivide large flats so baked AO has resolution."""
    bpy.ops.object.select_all(action='DESELECT')
    objs = [o for o in bpy.context.scene.objects if o.type in ('MESH', 'FONT')]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target='MESH')
    import bmesh
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        bm = bmesh.new(); bm.from_mesh(o.data)
        for _ in range(4):
            long = [e for e in bm.edges if (o.matrix_world.to_3x3() @ (e.verts[0].co - e.verts[1].co)).length > .45]
            if not long:
                break
            bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        bm.to_mesh(o.data); bm.free()


def bake_ao():
    s = bpy.context.scene
    s.render.engine = 'CYCLES'; s.cycles.samples = BAKE_SAMPLES; s.cycles.device = 'CPU'
    s.world = s.world or bpy.data.worlds.new('W')
    s.world.light_settings.distance = .9
    meshes = [o for o in s.objects if o.type == 'MESH']
    for o in meshes:
        if 'AO' not in o.data.color_attributes:
            o.data.color_attributes.new('AO', 'BYTE_COLOR', 'POINT')
        o.data.color_attributes.active_color = o.data.color_attributes['AO']
        o.data.color_attributes.render_color_index = o.data.color_attributes.active_color_index
    # Emissive / glass materials must not darken
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    for o in meshes:
        names = ' '.join(ms.material.name for ms in o.material_slots if ms.material)
        if 'Glow' in names or 'Glass' in names or 'Water •' in names:
            ca = o.data.color_attributes['AO']
            for d in ca.data:
                d.color = (1, 1, 1, 1)


def preview(sid, info):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'; s.cycles.samples = 24; s.cycles.use_denoising = True
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Medium High Contrast'
    s.world.use_nodes = True; s.world.node_tree.nodes['Background'].inputs[0].default_value = (.003, .003, .004, 1)
    k = info['key']
    d = bpy.data.lights.new('Key', 'SPOT'); d.energy = 7000; d.spot_size = math.radians(60); d.spot_blend = .6; d.shadow_soft_size = 1.
    d.color = tuple(int(k['color'][i:i + 2], 16) / 255 for i in (1, 3, 5))
    o = bpy.data.objects.new('Key', d); s.collection.objects.link(o); o.location = k['pos']
    o.rotation_euler = (Vector(k['target']) - Vector(k['pos'])).to_track_quat('-Z', 'Y').to_euler()
    for i, p in enumerate(info['practicals']):
        d = bpy.data.lights.new(f'P{i}', 'POINT'); d.energy = p['power'] * 25; d.shadow_soft_size = .1
        d.color = tuple(int(p['color'][j:j + 2], 16) / 255 for j in (1, 3, 5))
        o = bpy.data.objects.new(f'P{i}', d); s.collection.objects.link(o); o.location = p['pos']
    cd = bpy.data.cameras.new('C'); cam = bpy.data.objects.new('C', cd); s.collection.objects.link(cam); s.camera = cam
    cam.location = (8.6, -10.2, 5.3); cam.rotation_euler = (Vector((-.2, .6, 1.45)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cd.lens = 46
    s.render.resolution_x = 960; s.render.resolution_y = 720
    s.render.filepath = str(R / 'previews' / f'{sid}.png')
    bpy.ops.render.render(write_still=True)


stages = json.loads(STAGES.read_text()) if STAGES.exists() else {}
for sid, fn in SETS.items():
    if ONLY and sid not in ONLY:
        continue
    lib.reset(sid)
    info = fn()
    finalize_meshes()
    if not NOBAKE:
        bake_ao()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT / f'{sid}.glb'), export_format='GLB', use_selection=False,
                              export_animations=False, export_apply=True, export_extras=False,
                              export_vertex_color='ACTIVE', export_lights=False, export_cameras=False)
    # web coordinates: x, z-up -> y-up, y -> -z
    w = lambda p: [round(p[0], 3), round(p[2], 3), round(-p[1], 3)]
    stages[sid] = {
        'environment': f'{sid}.glb',
        'cast': [{'name': n, 'asset': n.lower().replace(' ', '-') + '.glb', 'position': [x, .08 + e.get('z', 0) - (0 if not e.get('lying') else -.12), -y],
                  'rotation': a, 'lying': bool(e.get('lying'))} for n, x, y, a, e in info['cast']],
        'hotspots': [w(p) for p in info['hotspots']],
        'practicals': [{'position': w(p['pos']), 'color': p['color'], 'power': p['power']} for p in info['practicals']],
        'key': {'position': w(info['key']['pos']), 'target': w(info['key']['target']), 'color': info['key']['color']},
        'fog': info.get('fog'),
    }
    STAGES.write_text(json.dumps(stages, indent=1, ensure_ascii=False))
    print('SET_DONE', sid, flush=True)
    if PREVIEW:
        preview(sid, info)
