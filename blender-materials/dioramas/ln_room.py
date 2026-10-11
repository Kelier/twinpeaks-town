# Little-Nightmares-style test render of the red room: crooked hand-made set, grime, haze, tiny puppet Cooper.
# Run: blender -b --python ln_room.py -- [--samples=64] [--set=redroom]
import bpy, sys, math
from pathlib import Path
from mathutils import Vector, noise
R = Path(__file__).resolve().parent
sys.path.insert(0, str(R))
import lib
from sets import SETS
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(next((a.split('=')[1] for a in ARGS if a.startswith('--samples=')), 64))
SID = next((a.split('=')[1] for a in ARGS if a.startswith('--set=')), 'redroom')
CAST_SCALE = .62

lib.reset(SID)
info = SETS[SID]()
bpy.ops.object.select_all(action='DESELECT')
objs = [o for o in bpy.context.scene.objects if o.type in ('MESH', 'FONT')]
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.convert(target='MESH')


def warp(p):
    """Hand-built crookedness: low-frequency wobble plus a slight lean that grows with height."""
    n = noise.noise_vector(p * .32 + Vector((3.1, 7.7, 1.3)))
    h = min(1., max(0., (p.z - .2) / .6))
    return p + Vector((n.x * .07 * h + .018 * p.z, n.y * .05 * h, n.z * .025 * h))


for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    mw = o.matrix_world; inv = mw.inverted()
    for v in o.data.vertices:
        v.co = inv @ warp(mw @ v.co)

# Grime: every material gets mottled darkening plus soot towards the floor and the top.
for m in bpy.data.materials:
    if not m.use_nodes or 'Glow' in m.name:
        continue
    nt = m.node_tree; p = nt.nodes.get('Principled BSDF')
    if not p or p.inputs['Base Color'].is_linked:
        continue
    base = tuple(p.inputs['Base Color'].default_value)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.2; nz.inputs['Detail'].default_value = 9; nz.inputs['Roughness'].default_value = .65
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .35; ramp.color_ramp.elements[0].color = (.55, .5, .45, 1)
    ramp.color_ramp.elements[1].position = .7; ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(nz.outputs['Fac'], ramp.inputs[0])
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); geo = nt.nodes.new('ShaderNodeNewGeometry')
    nt.links.new(geo.outputs['Position'], sep.inputs[0])
    soot = nt.nodes.new('ShaderNodeMapRange'); soot.inputs['From Min'].default_value = 0; soot.inputs['From Max'].default_value = .8
    soot.inputs['To Min'].default_value = .55; soot.inputs['To Max'].default_value = 1
    nt.links.new(sep.outputs['Z'], soot.inputs['Value'])
    mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
    mul.inputs[6].default_value = base; nt.links.new(ramp.outputs[0], mul.inputs[7])
    mul2 = nt.nodes.new('ShaderNodeMix'); mul2.data_type = 'RGBA'; mul2.blend_type = 'MULTIPLY'
    nt.links.new(soot.outputs[0], mul2.inputs['Factor']); mul2.inputs[7].default_value = (.5, .45, .4, 1)
    nt.links.new(mul.outputs[2], mul2.inputs[6])
    mul2.inputs['Factor'].default_value = 1
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1
    nt.links.new(soot.outputs[0], inv.inputs[1]); nt.links.new(inv.outputs[0], mul2.inputs['Factor'])
    nt.links.new(mul2.outputs[2], p.inputs['Base Color'])
    rr = nt.nodes.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value = min(1, p.inputs['Roughness'].default_value + .25); rr.inputs['To Max'].default_value = p.inputs['Roughness'].default_value
    nt.links.new(nz.outputs['Fac'], rr.inputs['Value']); nt.links.new(rr.outputs[0], p.inputs['Roughness'])

# Cast: append the puppet Cooper and shrink him so the room towers over him.
s = bpy.context.scene
for name, x, y, a, extra in info['cast']:
    slug = name.lower().replace(' ', '-')
    path = R.parent / 'cast-mpfb' / f'{slug}.blend'
    if not path.exists() or slug != 'dale-cooper':
        continue
    with bpy.data.libraries.load(str(path)) as (src, dst):
        dst.objects = list(src.objects)
    for o in dst.objects:
        if o is None:
            continue
        s.collection.objects.link(o)
        if o.type == 'ARMATURE':
            o.location = (x * .55 + .4, y * .55 - .1, lib.FLOOR_Z + o.location.z * CAST_SCALE)
            o.rotation_euler[2] = a + .3
            o.scale = (CAST_SCALE,) * 3

# Lighting: the torchiere throws a warm pool up the curtain; a hard cold spot cuts down onto the chair; haze everywhere.
s.render.engine = 'CYCLES'; s.cycles.samples = SAMPLES; s.cycles.use_denoising = True
s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - High Contrast'
s.world = bpy.data.worlds.new('W'); s.world.use_nodes = True
s.world.node_tree.nodes['Background'].inputs[0].default_value = (.002, .002, .003, 1)


def light(n, kind, loc, tgt, power, col, size=.2, spot=None):
    d = bpy.data.lights.new(n, kind); d.energy = power; d.color = col
    if kind == 'SPOT':
        d.spot_size = spot; d.spot_blend = .35; d.shadow_soft_size = size
    elif kind == 'AREA':
        d.size = size
    else:
        d.shadow_soft_size = size
    o = bpy.data.objects.new(n, d); s.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
light('Hard spot', 'SPOT', (1.6, -1.8, 7.5), (.4, .7, .3), 5200, (.86, .92, 1.), .25, math.radians(26))
light('Torchiere glow', 'POINT', (1.75, 1.8, 3.05), (0, 0, 0), 420, (1., .62, .32), .12)
light('Floor bounce', 'AREA', (0, -3.5, .6), (0, 0, 1), 60, (1., .55, .35), 3)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 2.2)); fog = bpy.context.object; fog.scale = (7.4, 5.6, 4.6)
vm = bpy.data.materials.new('Haze'); vm.use_nodes = True; vn = vm.node_tree
vn.nodes.remove(vn.nodes['Principled BSDF']); vs = vn.nodes.new('ShaderNodeVolumePrincipled'); vs.inputs['Density'].default_value = .035
vs.inputs['Color'].default_value = (.9, .85, .8, 1)
vn.links.new(vs.outputs[0], vn.nodes['Material Output'].inputs['Volume']); fog.data.materials.append(vm)

cd = bpy.data.cameras.new('C'); cam = bpy.data.objects.new('C', cd); s.collection.objects.link(cam); s.camera = cam
cam.location = (3.4, -8.6, 1.9); cam.rotation_euler = (Vector((-.2, .6, 1.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cd.lens = 32; cd.dof.use_dof = True; cd.dof.focus_distance = (Vector((.6, .2, .8)) - cam.location).length; cd.dof.aperture_fstop = 1.4
s.render.resolution_x = 1280; s.render.resolution_y = 760
s.cycles.use_auto_tile = True; s.cycles.tile_size = 256
s.render.filepath = str(R / 'previews' / f'ln-{SID}.png')
bpy.ops.render.render(write_still=True)
