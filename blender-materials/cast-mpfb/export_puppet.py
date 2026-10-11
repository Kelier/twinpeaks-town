# Turn a stylised MPFB character .blend into a game-ready puppet GLB:
# bake shape keys + caricature pose into a new rest pose, skin the hair to the head,
# author idle / walk / run / jump / push / caught clips with world-axis rotations, export.
# Run: blender -b dale-cooper.blend --python export_puppet.py -- --out=/path/puppet-cooper.glb
import bpy, sys, math
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = next(a.split('=', 1)[1] for a in ARGS if a.startswith('--out='))
DECIMATE = float(next((a.split('=')[1] for a in ARGS if a.startswith('--decimate=')), 1.0))
HAIR_DEC = float(next((a.split('=')[1] for a in ARGS if a.startswith('--hair-decimate=')), 1.0))

rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.context.view_layer.objects.active = rig

# 1) hair / bone-parented props become skinned to the head bone.
#    Their world-space (posed) vertices are mapped back into rest space, so the armature
#    modifier puts them exactly where they are now instead of transforming them twice.
bpy.context.view_layer.update()
for o in meshes:
    if o.parent == rig and o.parent_type == 'BONE':
        bone = o.parent_bone or 'head'
        pb = rig.pose.bones[bone]
        deform = rig.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted() @ rig.matrix_world.inverted()
        to_rest = deform.inverted()
        mw = o.matrix_world.copy()
        o.parent = None; o.matrix_world = Matrix.Identity(4)
        for m in [m for m in o.modifiers]:
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
            try: bpy.ops.object.modifier_apply(modifier=m.name)
            except RuntimeError: o.modifiers.remove(m)
        for v in o.data.vertices:
            v.co = to_rest @ (mw @ v.co)
        vg = o.vertex_groups.new(name=bone)
        vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
        mod = o.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
        o.parent = rig; o.matrix_parent_inverse = rig.matrix_world.inverted()

# 2) freeze shape keys and every modifier (incl. armature) into the posed shape
for o in meshes:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    if o.data.shape_keys:
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for m in list(o.modifiers):
        if m.type == 'SUBSURF':
            o.modifiers.remove(m); continue
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except RuntimeError as e:
            print('MODFAIL', o.name, m.name, e); o.modifiers.remove(m)
    if HAIR_DEC < 1 and 'hair' in o.name.lower():
        d = o.modifiers.new('HairDec', 'DECIMATE'); d.ratio = HAIR_DEC
        bpy.ops.object.modifier_apply(modifier='HairDec')
    elif DECIMATE < 1 and len(o.data.polygons) > 4000:
        d = o.modifiers.new('Dec', 'DECIMATE'); d.ratio = DECIMATE
        bpy.ops.object.modifier_apply(modifier='Dec')

# 3) current pose becomes the rest pose
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.pose.transforms_clear()
bpy.ops.object.mode_set(mode='OBJECT')
# rig object transform (feet drop) baked into the meshes/rig
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in meshes:
    o.parent = rig
    mod = next((m for m in o.modifiers if m.type == 'ARMATURE'), None) or o.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig

# 4) clips. Character faces -Y; walking is along -Y so limb swing is about world X.
P = rig.pose.bones


def rot(name, deg, axis='X'):
    pb = P.get(name)
    if not pb:
        return
    bpy.context.view_layer.update()
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-h) @ pb.matrix


def key_all(f):
    for pb in P:
        pb.keyframe_insert('rotation_quaternion', frame=f) if pb.rotation_mode == 'QUATERNION' else pb.keyframe_insert('rotation_euler', frame=f)
        pb.keyframe_insert('location', frame=f)


def clip(name, frames, fn):
    rig.animation_data_create()
    act = bpy.data.actions.new(name); rig.animation_data.action = act
    for f in frames:
        bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT'); bpy.ops.pose.transforms_clear()
        bpy.ops.object.mode_set(mode='OBJECT')
        fn(f); key_all(f)
    act.use_fake_user = True
    tr = rig.animation_data.nla_tracks.new(); tr.name = name
    tr.strips.new(name, int(frames[0]), act)
    rig.animation_data.action = None
    return act


def walk(amp, bob, lean, f, n):
    t = 2 * math.pi * f / n
    s = math.sin(t)
    for side, sg in (('l', 1), ('r', -1)):
        sw = sg * s
        rot(f'thigh_{side}', -amp * sw)                       # positive = leg forward
        rot(f'calf_{side}', amp * .9 * max(0, -math.cos(t + (0 if sg > 0 else math.pi))) + 6)
        rot(f'foot_{side}', -amp * .3 * sw)
        rot(f'upperarm_{side}', amp * .65 * sw)
        rot(f'lowerarm_{side}', -14 - amp * .25 * max(0, sw))
    rot('spine_01', -lean)
    rot('spine_03', 3 * math.sin(2 * t), 'Z')
    rot('head', 4 * math.sin(2 * t + .6))
    if P.get('pelvis'):
        P['pelvis'].location.y += bob * abs(math.cos(t))  # local y ~ up for pelvis in MPFB rigs


clip('idle', range(1, 49, 4), lambda f: (rot('spine_03', 2.5 * math.sin(f / 48 * 2 * math.pi)), rot('head', 3 * math.sin(f / 48 * 2 * math.pi + 1)),
                                           rot('upperarm_l', 2 * math.sin(f / 48 * 6.28)), rot('upperarm_r', -2 * math.sin(f / 48 * 6.28))))
clip('walk', range(1, 26, 2), lambda f: walk(26, .015, 4, f - 1, 24))
clip('run', range(1, 18, 2), lambda f: walk(42, .03, 14, f - 1, 16))


def jump_pose(f):
    for side in 'lr':
        rot(f'thigh_{side}', -38); rot(f'calf_{side}', 55); rot(f'upperarm_{side}', 70 if side == 'l' else 70, 'X'); rot(f'lowerarm_{side}', -30)
    rot('spine_01', -10)
clip('jump', [1, 9], jump_pose)


def push_pose(f):
    for side in 'lr':
        rot(f'upperarm_{side}', 75); rot(f'lowerarm_{side}', -10)
        rot(f'thigh_{side}', -20 if side == 'l' else 15); rot(f'calf_{side}', 20)
    rot('spine_01', -22)
clip('push', [1, 9], push_pose)


def climb_pose(f):
    t = f / 16 * 2 * math.pi
    for side, sg in (('l', 1), ('r', -1)):
        rot(f'upperarm_{side}', 150 + 15 * sg * math.sin(t)); rot(f'lowerarm_{side}', -20)
        rot(f'thigh_{side}', -45 + 25 * sg * math.sin(t)); rot(f'calf_{side}', 60)
clip('climb', range(1, 18, 4), climb_pose)


def caught_pose(f):
    for side in 'lr':
        rot(f'upperarm_{side}', 120 + 8 * math.sin(f), 'X'); rot(f'lowerarm_{side}', -60)
    rot('head', -18); rot('spine_01', 12)
clip('caught', [1, 5, 9], caught_pose)

bpy.context.scene.frame_set(1)
# web budget: textures at most 1024px
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=False,
                          export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True,
                          export_image_format='JPEG', export_jpeg_quality=80, export_morph=False, export_extras=False)
print('PUPPET_DONE', OUT, flush=True)
