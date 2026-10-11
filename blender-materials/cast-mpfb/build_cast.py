# Twin Peaks cast rebuilt on the MakeHuman/MPFB anatomical base mesh (CC0 assets).
# Run: blender -b --python build_cast.py -- --only=dale-cooper [--samples=48]
import bpy, sys, json, math
from pathlib import Path
from mathutils import Vector
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

R = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = next((a.split('=')[1].split(',') for a in ARGS if a.startswith('--only=')), None)
SAMPLES = int(next((a.split('=')[1] for a in ARGS if a.startswith('--samples=')), 48))
DATA = Path(LocationService.get_user_data())
SPECS = json.loads((R / 'cast.json').read_text())
SHOTS = next((a.split('=')[1].split(',') for a in ARGS if a.startswith('--shots=')), ['portrait', 'full'])
OVERRIDE = dict(a[len('--set:'):].split('=', 1) for a in ARGS if a.startswith('--set:'))
SUFFIX = next((a.split('=')[1] for a in ARGS if a.startswith('--suffix=')), '')
from mathutils import Matrix
sys.path.insert(0, str(R))
import hair as hairgen


def asset(kind, name):
    p = DATA / kind / name / f'{name}.mhclo'
    if not p.exists():
        raise FileNotFoundError(p)
    return str(p)


def tint(obj, rgb, rough=None):
    """Recolour an MPFB material by multiplying its diffuse output."""
    for slot in obj.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        for p in [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED']:
            src = p.inputs['Base Color'].links[0].from_socket if p.inputs['Base Color'].is_linked else None
            mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1
            mix.inputs[7].default_value = (*rgb, 1)
            if src:
                nt.links.new(src, mix.inputs[6])
            else:
                mix.inputs[6].default_value = (1, 1, 1, 1)
            nt.links.new(mix.outputs[2], p.inputs['Base Color'])
            if rough is not None:
                p.inputs['Roughness'].default_value = rough


def kill_saturated(obj, sat=.18, rgb=(.02, .02, .022)):
    """Turn saturated texture regions (e.g. a striped tie) into a solid colour."""
    for slot in obj.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        for p in [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED']:
            if not p.inputs['Base Color'].is_linked:
                continue
            src = p.inputs['Base Color'].links[0].from_socket
            hsv = nt.nodes.new('ShaderNodeSeparateColor'); hsv.mode = 'HSV'
            nt.links.new(src, hsv.inputs[0])
            ramp = nt.nodes.new('ShaderNodeMapRange')
            ramp.inputs['From Min'].default_value = sat * .7; ramp.inputs['From Max'].default_value = sat
            nt.links.new(hsv.outputs[1], ramp.inputs['Value'])
            mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
            nt.links.new(ramp.outputs[0], mix.inputs['Factor'])
            nt.links.new(src, mix.inputs[6]); mix.inputs[7].default_value = (*rgb, 1)
            nt.links.new(mix.outputs[2], p.inputs['Base Color'])


def pose(body, spec):
    """Relaxed stance from MPFB's A-pose: arms lowered (world Y axis), forearms bent forward (world X axis)."""
    rig = body.parent if body.parent and body.parent.type == 'ARMATURE' else next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    for bone, target in spec.get('aim', {}).items():
        for side, sx in (('l', 1), ('r', -1)):
            pb = rig.pose.bones.get(f'{bone}_{side}')
            if not pb:
                continue
            bpy.context.view_layer.update()
            cur = (pb.tail - pb.head).normalized()
            want = Vector((target[0] * sx * (1 if pb.head.x > 0 else -1) * sx, target[1], target[2])).normalized()
            q = cur.rotation_difference(want)
            head = pb.head.copy()
            pb.matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ pb.matrix
            bpy.context.view_layer.update()
    for bone, deg, axis, goal in spec.get('pose', [['upperarm', 58, 'Y', 'down'], ['lowerarm', 12, 'X', 'forward'], ['hand', 8, 'X', 'forward']]):
        for side in ('l', 'r'):
            pb = rig.pose.bones.get(f'{bone}_{side}')
            if not pb:
                continue
            bpy.context.view_layer.update()
            head = pb.head.copy()
            best = None
            for sg in (1, -1):
                R_ = Matrix.Translation(head) @ Matrix.Rotation(math.radians(deg) * sg, 4, axis) @ Matrix.Translation(-head)
                tail = (R_ @ pb.matrix @ Matrix.Translation((0, pb.length, 0))).translation
                score = tail.z if goal == 'down' else tail.y
                if best is None or score < best[0]:
                    best = (score, R_)
            pb.matrix = best[1] @ pb.matrix
            bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')


def build(slug, spec):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    macro = TargetService.get_default_macro_info_dict()
    macro.update({k: v for k, v in spec['macro'].items()})
    macro['race'] = {'caucasian': 1.0, 'asian': 0.0, 'african': 0.0}
    body = HumanService.create_human(macro_detail_dict=macro)
    body.name = spec['name'] + ' • body'
    for target, w in spec.get('targets', {}).items():
        path = TargetService.target_full_path(target)
        if path is None:
            print('MISSING TARGET', target); continue
        TargetService.load_target(body, path, weight=w)
    HumanService.add_builtin_rig(body, 'game_engine')
    skin = DATA / 'skins' / spec['skin'] / f"{spec['skin']}.mhmat"
    HumanService.set_character_skin(str(skin), body, skin_type='ENHANCED_SSS')
    if 'skin_tint' in spec:
        tint(body, spec['skin_tint'])
    parts = {}
    for kind, typ in [('eyes', 'Eyes'), ('eyebrows', 'Eyebrows'), ('eyelashes', 'Eyelashes'), ('hair', 'Hair')]:
        name = spec.get(kind)
        if not name:
            continue
        parts[kind] = HumanService.add_mhclo_asset(asset(kind, name), body, asset_type=typ, subdiv_levels=1, material_type='MAKESKIN')
    for cl in spec['clothes']:
        o = HumanService.add_mhclo_asset(asset('clothes', cl['asset']), body, asset_type='Clothes', subdiv_levels=1, material_type='MAKESKIN')
        if 'texture' in cl:
            for slot in o.material_slots:
                for nd in slot.material.node_tree.nodes:
                    if nd.type == 'TEX_IMAGE' and 'diffuse' in (nd.image.name if nd.image else '').lower():
                        nd.image = bpy.data.images.load(str(R / cl['texture']))
        if 'tint' in cl:
            tint(o, cl['tint'], cl.get('rough'))
        if 'flat' in cl:
            for slot in o.material_slots:
                for nd in slot.material.node_tree.nodes:
                    if nd.type == 'BSDF_PRINCIPLED':
                        for l in list(nd.inputs['Base Color'].links):
                            slot.material.node_tree.links.remove(l)
                        nd.inputs['Base Color'].default_value = (*cl['flat'], 1)
                        nd.inputs['Roughness'].default_value = cl.get('rough', .8)
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        if any(c['asset'] in o.name.lower() and c.get('solid_saturated') for c in spec['clothes']):
            kill_saturated(o)
    pose(body, spec)
    if 'hair_style' in spec:
        rig = body.parent
        st = spec['hair_style']
        objs = []
        mass = None
        if 'shell' in st:
            mass = hairgen.shell(body, st, hairgen.hair_material(spec['name'], st), name=spec['name'] + ' • hair mass')
            objs.append(mass)
        if st.get('method') == 'part_fall':
            objs.append(hairgen.part_fall(body, st, hairgen.hair_material(spec['name'] + ' strands', st), name=spec['name'] + ' • hair strands'))
        elif st.get('method') == 'comb_back':
            objs.append(hairgen.comb_back(body, st, hairgen.hair_material(spec['name'] + ' strands', st), name=spec['name'] + ' • hair strands'))
        elif st.get('clumps'):
            objs += list(hairgen.grow(body, st, name=spec['name'] + ' • hair strands', over=mass if st.get('over_shell') else None))[:1]
        if mass:
            sol = mass.modifiers.new('Hair thickness', 'SOLIDIFY'); sol.thickness = .003; sol.offset = -1
        hairgen.bind_to_head(objs, rig)
    if 'hair_tint' in spec:
        if 'hair' in parts:
            tint(parts['hair'], spec['hair_tint'])
        tint(parts['eyebrows'], spec['hair_tint'])
    if 'ln' in spec:
        stylize(body, spec['ln'])
    return body


def stylize(body, ln):
    """Little-Nightmares-like puppet: caricature bone proportions, softened clay face, bead eyes, matte skin."""
    rig = body.parent
    for bone, sc in ln.get('bones', {}).items():
        for name in ([bone] if bone in rig.pose.bones else [f'{bone}_l', f'{bone}_r']):
            pb = rig.pose.bones.get(name)
            if pb:
                pb.scale = sc if isinstance(sc, list) else (sc, sc, sc)
    # shorter legs lift the feet: drop the rig so soles touch the floor again
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); me = body.evaluated_get(dg).to_mesh()
    low = min((body.matrix_world @ v.co).z for v in me.vertices); body.evaluated_get(dg).to_mesh_clear()
    rig.location.z -= low
    sm = body.modifiers.new('Clay face', 'SMOOTH')
    sm.factor = ln.get('smooth', .6); sm.iterations = ln.get('smooth_iter', 8); sm.vertex_group = 'head'
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        if 'high-poly' in o.name:
            bead = bpy.data.materials.new('Bead eye')
            bead.use_nodes = True
            pb = bead.node_tree.nodes['Principled BSDF']
            pb.inputs['Base Color'].default_value = (*ln.get('eye', (.008, .006, .005)), 1)
            pb.inputs['Roughness'].default_value = .15; pb.inputs['Coat Weight'].default_value = 1.
            o.data.materials.clear(); o.data.materials.append(bead)
            o.scale = (ln.get('eye_scale', .85),) * 3
        for slot in o.material_slots:
            if not slot.material or not slot.material.use_nodes:
                continue
            for nd in slot.material.node_tree.nodes:
                if nd.type == 'BSDF_PRINCIPLED':
                    nd.inputs['Roughness'].default_value = max(nd.inputs['Roughness'].default_value, ln.get('rough', .72))
                    nd.inputs['Specular IOR Level'].default_value = .3


def studio_ln(body, slug):
    """Moody test lighting: one warm hard key from above, haze, black void."""
    s = bpy.context.scene
    s.render.engine = 'CYCLES'; s.cycles.samples = SAMPLES; s.cycles.use_denoising = True
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - High Contrast'
    w = s.world or bpy.data.worlds.new('W'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (.004, .004, .005, 1)
    top = max((body.matrix_world @ Vector(c)).z for c in body.bound_box)
    d = bpy.data.lights.new('Key', 'SPOT'); d.energy = 900; d.spot_size = math.radians(40); d.spot_blend = .5; d.shadow_soft_size = .15; d.color = (1, .82, .6)
    k = bpy.data.objects.new('Key', d); s.collection.objects.link(k); k.location = (-1.0, -1.6, 3.8)
    k.rotation_euler = (Vector((0, 0, 1.2)) - k.location).to_track_quat('-Z', 'Y').to_euler()
    d = bpy.data.lights.new('Rim', 'AREA'); d.energy = 60; d.size = 1.; d.color = (.55, .7, 1.)
    r = bpy.data.objects.new('Rim', d); s.collection.objects.link(r); r.location = (1.2, 1.6, 2.2)
    r.rotation_euler = (Vector((0, 0, 1.4)) - r.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=8); fl = bpy.context.object
    fm = bpy.data.materials.new('Worn floor'); fm.use_nodes = True
    nt = fm.node_tree; pb = nt.nodes['Principled BSDF']; pb.inputs['Roughness'].default_value = .8
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 6
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (.025, .02, .016, 1); ramp.color_ramp.elements[1].color = (.07, .055, .04, 1)
    nt.links.new(nz.outputs['Fac'], ramp.inputs[0]); nt.links.new(ramp.outputs[0], pb.inputs['Base Color'])
    fl.data.materials.append(fm)
    bpy.ops.mesh.primitive_cube_add(size=7, location=(0, 0, 3.4)); fog = bpy.context.object
    vm = bpy.data.materials.new('Haze'); vm.use_nodes = True; vn = vm.node_tree
    vn.nodes.remove(vn.nodes['Principled BSDF']); vs = vn.nodes.new('ShaderNodeVolumePrincipled'); vs.inputs['Density'].default_value = .018
    vn.links.new(vs.outputs[0], vn.nodes['Material Output'].inputs['Volume']); fog.data.materials.append(vm)
    cd = bpy.data.cameras.new('Cam'); cam = bpy.data.objects.new('Cam', cd); s.collection.objects.link(cam); s.camera = cam
    out = R / 'previews'; out.mkdir(exist_ok=True)
    shots = [('portrait', Vector((.55, -1.5, top - .05)), Vector((0, 0, top - .2)), 70, 900, 1100),
             ('full', Vector((1.6, -4.2, 1.0)), Vector((0, 0, top * .5)), 45, 800, 1100)]
    for name, loc, tgt, lens, rx, ry in [x for x in shots if x[0] in SHOTS]:
        cam.location = loc; cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler(); cd.lens = lens
        s.render.resolution_x = rx; s.render.resolution_y = ry
        s.render.filepath = str(out / f'{slug}{SUFFIX}-ln-{name}.png')
        bpy.ops.render.render(write_still=True)


def studio(body, slug):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'; s.cycles.samples = SAMPLES; s.cycles.use_denoising = True
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Medium High Contrast'
    w = s.world or bpy.data.worlds.new('W'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (.035, .03, .032, 1)
    top = max((body.matrix_world @ Vector(c)).z for c in body.bound_box)
    eye = Vector((0, 0, top - .12))

    def light(n, loc, power, col, size):
        d = bpy.data.lights.new(n, 'AREA'); d.energy = power; d.color = col; d.size = size
        o = bpy.data.objects.new(n, d); s.collection.objects.link(o); o.location = loc
        o.rotation_euler = (eye - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    light('Key', (-1.4, -1.8, eye.z + .9), 150, (1, .9, .8), 1.2)
    light('Fill', (1.8, -1.2, eye.z), 70, (.75, .85, 1), 2)
    light('Rim', (.6, 1.6, eye.z + .6), 220, (1, .6, .45), .8)
    cd = bpy.data.cameras.new('Cam'); cam = bpy.data.objects.new('Cam', cd); s.collection.objects.link(cam); s.camera = cam
    out = R / 'previews'; out.mkdir(exist_ok=True)
    shots = [('portrait', Vector((.32, -1.15, eye.z + .02)), eye + Vector((0, 0, -.04)), 85, 900, 1100),
             ('full', Vector((1.2, -4.6, top * .62)), Vector((0, 0, top * .5)), 50, 800, 1200)]
    for name, loc, tgt, lens, rx, ry in [x for x in shots if x[0] in SHOTS]:
        cam.location = loc; cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler(); cd.lens = lens
        s.render.resolution_x = rx; s.render.resolution_y = ry
        s.render.filepath = str(out / f'{slug}{SUFFIX}-{name}.png')
        bpy.ops.render.render(write_still=True)


for slug, spec in SPECS.items():
    if ONLY and slug not in ONLY:
        continue
    for k, v in OVERRIDE.items():
        spec[k] = json.loads(v) if v[:1] in '[{0123456789' else v
    body = build(slug, spec)
    if not SUFFIX:
        bpy.ops.wm.save_as_mainfile(filepath=str(R / f'{slug}.blend'), compress=True)
    (studio_ln if 'ln' in spec else studio)(body, slug)
    print('CHARACTER_DONE', slug, flush=True)
