# Lineup render of rebuilt cast for review. Run: blender -b --python lineup.py -- --samples=48
import bpy, sys, math
from pathlib import Path
from mathutils import Vector
R = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(next((a.split('=')[1] for a in ARGS if a.startswith('--samples=')), 48))
CAST = [('laura-palmer', -.75, .25), ('dale-cooper', 0, 0), ('audrey-horne', .75, -.25)]
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
s = bpy.context.scene
ONE = next((a.split('=')[1] for a in ARGS if a.startswith('--one=')), None)
for slug, x, rot in [c for c in CAST if c[0] == ONE]:
    with bpy.data.libraries.load(str(R / f'{slug}.blend')) as (src, dst):
        dst.objects = list(src.objects)
    for o in dst.objects:
        if o is None:
            continue
        s.collection.objects.link(o)
        if o.type == 'ARMATURE':
            o.location.x += x; o.rotation_euler[2] = rot
s.render.engine = 'CYCLES'; s.cycles.samples = SAMPLES; s.cycles.use_denoising = True
s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Medium High Contrast'
w = bpy.data.worlds.new('W'); s.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (.02, .018, .02, 1)
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
floor = bpy.context.object; m = bpy.data.materials.new('Floor'); m.use_nodes = True
m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.03, .028, .03, 1)
m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .5
floor.data.materials.append(m)
def light(n, loc, power, col, size, tgt=(0, 0, 1.2)):
    d = bpy.data.lights.new(n, 'AREA'); d.energy = power; d.color = col; d.size = size
    o = bpy.data.objects.new(n, d); s.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
light('Key', (-2.2, -3.2, 3.2), 900, (1, .9, .8), 2.5)
light('Fill', (3, -2.5, 1.6), 250, (.75, .85, 1), 3)
light('Rim', (0, 2.5, 3), 800, (1, .55, .4), 2)
cd = bpy.data.cameras.new('Cam'); cam = bpy.data.objects.new('Cam', cd); s.collection.objects.link(cam); s.camera = cam
cam.location = (0, -5.4, 1.25); cam.rotation_euler = (Vector((0, 0, .98)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cd.lens = 48
s.render.resolution_x = 1280; s.render.resolution_y = 880; s.cycles.use_auto_tile = True; s.cycles.tile_size = 256
s.render.film_transparent = True
floor.is_shadow_catcher = True
s.render.filepath = str(R / 'work' / f'lineup-{ONE}.png')
bpy.ops.render.render(write_still=True)
