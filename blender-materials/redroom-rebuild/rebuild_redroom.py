# Red Room miniature rebuild — cinematic corner box, velvet folds, club chair, Saturn lamp.
# Run: blender -b ../miniature-production/twin-peaks-miniatures.blend --python rebuild_redroom.py [-- --no-render]
import bpy, bmesh, math, random, json, sys
from pathlib import Path
from mathutils import Vector

R = Path(__file__).resolve().parent
PROJECT = R.parents[1]
OUT = PROJECT / 'public/models/twin-peaks'
MASTER = R.parent / 'miniature-production/twin-peaks-miniatures.blend'
RENDER = '--no-render' not in sys.argv
SAMPLES = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--samples=')), 96))
random.seed(1990)

SET = bpy.data.collections['SET • redroom']
ROOT = bpy.data.objects['DIORAMA • redroom']

# Keep the cast instances; clear every piece of old scenery.
cast_inst = {o.instance_collection.name.split('• ')[1]: o for o in SET.objects if o.instance_type == 'COLLECTION'}
for o in list(SET.objects):
    if o is ROOT or o.instance_type == 'COLLECTION':
        continue
    bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.meshes):
    if m.users == 0:
        bpy.data.meshes.remove(m)


# ---------- materials ----------
def principled(name, color, rough=.5, metal=0., **kw):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(p.outputs[0], out.inputs[0])
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    for k, v in kw.items():
        p.inputs[k].default_value = v
    m.diffuse_color = (*color, 1)
    return m


def bump(m, scale, strength, distance=.002, kind='ShaderNodeTexNoise', detail=4.):
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    t = nt.nodes.new(kind)
    if kind == 'ShaderNodeTexNoise':
        t.inputs['Scale'].default_value = scale
        t.inputs['Detail'].default_value = detail
    else:
        t.inputs['Scale'].default_value = scale
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = strength
    b.inputs['Distance'].default_value = distance
    nt.links.new(t.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs[0], p.inputs['Normal'])


velvet = principled('Velvet • lodge curtain', (.24, .004, .009), .95,
                    **{'Sheen Weight': .8, 'Sheen Roughness': .55, 'Sheen Tint': (1., .2, .18, 1),
                       'Specular IOR Level': .08})
bump(velvet, 420, .35, .0015, detail=8.)
lacquer = principled('Lacquer • black box', (.006, .006, .007), .42, **{'Coat Weight': .25, 'Coat Roughness': .3})
frame = principled('Paint • charcoal frame edge', (.018, .018, .02), .7)
tile_w = principled('Floor • ivory enamel', (.82, .8, .74), .3)
tile_k = principled('Floor • black enamel', (.008, .008, .009), .3)
leather = principled('Leather • club chair', (.014, .016, .017), .36, **{'Coat Weight': .35, 'Coat Roughness': .22})
bump(leather, 90, .12, .0015, detail=6.)
oxblood = principled('Leather • oxblood piping', (.16, .012, .014), .34, **{'Coat Weight': .3, 'Coat Roughness': .25})
steel = principled('Metal • brushed pewter', (.40, .41, .42), .38, .85)
tabletop = principled('Lacquer • table top', (.012, .013, .014), .28, **{'Coat Weight': .4, 'Coat Roughness': .15})
mint = principled('Ceramic • Saturn mint', (.36, .55, .27), .45)
mint_dk = principled('Ceramic • Saturn sage band', (.17, .32, .13), .45)
ring_mat = principled('Ceramic • Saturn ring ivory', (.78, .74, .6), .4)
brass = principled('Metal • dim brass', (.32, .2, .07), .38, .8)


# ---------- helpers ----------
def link(o, m=None, smooth=True):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    SET.objects.link(o)
    o.parent = ROOT
    if m:
        o.data.materials.clear()
        o.data.materials.append(m)
    if smooth and o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def mesh(name, v, f, m, smooth=True):
    d = bpy.data.meshes.new(name)
    d.from_pydata(v, [], f)
    d.update()
    o = bpy.data.objects.new(name, d)
    SET.objects.link(o)
    return link(o, m, smooth)


def box(name, loc, dim, m, bevel=0., seg=3, sub=0, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = dim
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rot is not None:
        o.rotation_euler = rot
    link(o, m, smooth=bool(sub))
    if bevel:
        b = o.modifiers.new('Bevel', 'BEVEL')
        b.width = bevel
        b.segments = seg
        b.limit_method = 'NONE'
    if sub:
        s = o.modifiers.new('Plump', 'SUBSURF')
        s.levels = sub
        s.render_levels = sub
    else:
        o.modifiers.new('Normals', 'WEIGHTED_NORMAL')
    return o


def cyl(name, a, b, r, m, r2=None, verts=32):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r if r2 is None else r2, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return link(o, m)


def lathe(name, profile, m, loc, segs=48):
    """profile: [(radius, z)], bottom to top; closed with caps."""
    v, f = [], []
    for r, z in profile:
        for j in range(segs):
            t = 2 * math.pi * j / segs
            v.append((loc[0] + r * math.cos(t), loc[1] + r * math.sin(t), loc[2] + z))
    for k in range(len(profile) - 1):
        for j in range(segs):
            a = k * segs + j
            b = k * segs + (j + 1) % segs
            f.append((a, b, b + segs, a + segs))
    f.append(tuple(reversed(range(segs))))
    f.append(tuple((len(profile) - 1) * segs + j for j in range(segs)))
    return mesh(name, v, f, m)


# ---------- dimensions ----------
# Stage keeps the shared 7.2 x 5.4 footprint so characters/cameras stay in scale.
X0, X1, Y0, Y1 = -3.6, 3.6, -2.7, 2.7
FLOOR_Z = .08
WALL_H = 4.15
BACK_Y = 2.48     # back wall inner face
LEFT_X = -3.38    # left wall inner face
T = .2            # wall thickness

# ---------- black display box ----------
box('Display box • base', (0, 0, -.19), (X1 - X0, Y1 - Y0, .5), lacquer, .03, 3)
box('Display box • charcoal lip', (0, 0, .035), (X1 - X0 + .02, Y1 - Y0 + .02, .07), frame, .012, 2)
box('Display box • back wall', (0, BACK_Y + T / 2, WALL_H / 2), (X1 - X0, T, WALL_H), lacquer, .02, 2)
box('Display box • left wall', (LEFT_X - T / 2, (Y0 + BACK_Y) / 2, WALL_H / 2), (T, BACK_Y - Y0, WALL_H), lacquer, .02, 2)
# Top cornice rails, the "lid" edges of the box.
box('Cornice • back', (0, BACK_Y - .02, WALL_H + .06), (X1 - X0, .42, .22), frame, .025, 3)
box('Cornice • left', (LEFT_X + .06, (Y0 + BACK_Y) / 2, WALL_H + .06), (.42, BACK_Y - Y0, .22), frame, .025, 3)
box('Front edge post', (LEFT_X - T / 2, Y0 + .05, WALL_H / 2 + .05), (T + .06, .14, WALL_H + .1), frame, .02, 2)
box('Right end post', (X1 - .05, BACK_Y + T / 2, WALL_H / 2 + .05), (.14, T + .06, WALL_H + .1), frame, .02, 2)
bpy.ops.object.text_add(location=(0, Y0 - .002, -.2), rotation=(math.pi / 2, 0, 0))
label = bpy.context.object
label.name = 'Plaque • THE WAITING ROOM'
label.data.body = 'THE WAITING ROOM'
label.data.size = .14
label.data.align_x = 'CENTER'
label.data.extrude = .002
link(label, brass, smooth=False)

# ---------- chevron floor ----------
# Ivory enamel base with black zigzag stripes as convex quads (clean triangulation for glTF).
box('Floor • ivory enamel', (0, 0, FLOOR_Z - .006), (X1 - X0 - .12, Y1 - Y0 - .12, .012), tile_w)
fx0, fx1 = X0 + .06, X1 - .06
fy0, fy1 = Y0 + .06, BACK_Y
PER = .36          # stripe repeat
HALF = .27         # zig half period along x
AMP = .17          # zig amplitude
SUB = 6
zv, zf = [], []
def zig(x):
    u = (x - fx0) / HALF
    k = math.floor(u)
    t = u - k
    return AMP * (t if k % 2 == 0 else 1 - t)
xs = []
n = int(math.ceil((fx1 - fx0) / HALF * SUB))
for i in range(n + 1):
    xs.append(min(fx1, fx0 + i * HALF / SUB))
row = 0
y = fy0 - AMP - PER
while y < fy1 + PER:
    base = len(zv)
    for x in xs:
        lo = min(max(y + zig(x), fy0), fy1)
        hi = min(max(y + zig(x) + PER / 2, fy0), fy1)
        zv.append((x, lo, FLOOR_Z + .001))
        zv.append((x, hi, FLOOR_Z + .001))
    for i in range(len(xs) - 1):
        a = base + 2 * i
        if zv[a + 1][1] - zv[a][1] > 1e-4 or zv[a + 3][1] - zv[a + 2][1] > 1e-4:
            zf.append((a, a + 2, a + 3, a + 1))
    y += PER
floor = mesh('Floor • black chevrons', zv, zf, tile_k, smooth=False)
bm = bmesh.new(); bm.from_mesh(floor.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
bm.to_mesh(floor.data); bm.free()
floor.data.update()


# ---------- velvet curtains ----------
def curtain(name, length, place, cols=340, rows=56, seed=0):
    """Irregular velvet folds. place(u, depth, z) -> world xyz (u along wall, depth away from wall)."""
    rnd = random.Random(seed)
    folds, s = [], 0.
    while s < length + .5:
        w = rnd.uniform(.2, .38)
        folds.append((s, w, rnd.uniform(.2, .3), rnd.uniform(0, 6.28), rnd.uniform(.6, 1.4)))
        s += w
    top, bottom = WALL_H - .02, FLOOR_Z - .015

    def fold_at(u, z):
        # Folds meander gently as they fall, like heavy velvet hung from a track.
        h = (top - z) / (top - bottom)
        for f0, w, d, ph, fr in folds:
            if u < f0 + w:
                break
        wob = .022 * math.sin(z * .9 * fr + ph) * h
        uu = u + wob
        for f0, w, d, ph, fr in folds:
            if uu < f0 + w:
                break
        t = (uu - f0) / w
        prof = abs(math.sin(math.pi * t)) ** .65          # round ridges, narrow dark valleys
        depth = d * (.72 + .42 * h) * prof
        lateral = .05 * math.sin(2 * math.pi * t) * (.4 + .6 * h)  # ridges roll slightly sideways
        return depth, lateral, h

    v, f = [], []
    for r in range(rows + 1):
        z = top - (top - bottom) * (r / rows) ** 1.05
        for c in range(cols + 1):
            u = length * c / cols
            depth, lat, h = fold_at(u, z)
            # Hem rolls forward and kisses the floor.
            hem = max(0., (bottom + .22 - z) / .22)
            depth += .07 * hem ** 2
            v.append(place(u + lat, .03 + depth, z))
    for r in range(rows):
        for c in range(cols):
            a = r * (cols + 1) + c
            f.append((a, a + 1, a + cols + 2, a + cols + 1))
    o = mesh(name, v, f, velvet)
    sol = o.modifiers.new('Cloth thickness', 'SOLIDIFY')
    sol.thickness = .018
    sol.offset = 1
    return o

# Back run: u from left wall to right edge, folds pushed toward the room (-y).
curtain('Velvet curtain • back', X1 - .1 - LEFT_X,
        lambda u, d, z: (LEFT_X + u, BACK_Y - d, z), seed=7)
# Left run: u from back corner to the front edge, folds pushed toward +x.
curtain('Velvet curtain • left', BACK_Y - (Y0 + .12),
        lambda u, d, z: (LEFT_X + d, BACK_Y - .12 - u, z), cols=260, seed=23)


# ---------- club chair ----------
def club_chair(cx, cy, rot):
    piv = bpy.data.objects.new('Club chair', None)
    SET.objects.link(piv); piv.parent = ROOT
    parts = []
    W, D = 1.32, 1.12
    parts.append(box('Chair • plinth', (0, 0, .3), (W - .1, D - .08, .34), leather, .07, 3, 1))
    parts.append(box('Chair • seat cushion', (0, -.07, .55), (W - .5, D - .3, .2), leather, .07, 3, 2))
    back = box('Chair • barrel back', (0, D / 2 - .15, .8), (W - .1, .3, .9), leather, .13, 3, 0)
    bend = back.modifiers.new('Barrel', 'SIMPLE_DEFORM'); bend.deform_method = 'BEND'; bend.angle = math.radians(-38); bend.deform_axis = 'Z'
    sub = back.modifiers.new('Plump', 'SUBSURF'); sub.levels = sub.render_levels = 2
    for poly in back.data.polygons: poly.use_smooth = True
    parts.append(back)
    for s in (-1, 1):
        parts.append(box('Chair • rolled arm', (s * (W / 2 - .14), -.04, .58), (.3, D - .04, .64), leather, .14, 3, 2))
        # Deco oxblood inlay down the arm front, as on the lodge chairs.
        parts.append(box('Chair • oxblood inlay', (s * (W / 2 - .13), -D / 2 + .005, .5), (.09, .05, .5), oxblood, .02, 2, 1))
        parts.append(box('Chair • oxblood side band', (s * (W / 2 + .003), -D / 2 + .18, .48), (.04, .16, .54), oxblood, .015, 2, 1))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cyl('Chair • turned foot', (sx * (W / 2 - .14), sy * (D / 2 - .14), FLOOR_Z), (sx * (W / 2 - .14), sy * (D / 2 - .14), .14), .055, tile_k, .045, 20))
    for p in parts:
        p.parent = piv
    piv.location = (cx, cy, 0)
    piv.rotation_euler = (0, 0, rot)
    return piv


def side_table(cx, cy):
    piv = bpy.data.objects.new('Deco side table', None)
    SET.objects.link(piv); piv.parent = ROOT
    parts = [box('Table • lacquer top', (0, 0, .82), (.66, .66, .05), tabletop, .012, 3)]
    h = .3
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(box('Table • square leg', (sx * h, sy * h, .45), (.035, .035, .72), steel, .004, 1))
    for z in (.14, .5, .76):
        for s in (-1, 1):
            parts.append(box('Table • stretcher', (0, s * h, z), (.6, .03, .03), steel, .004, 1))
            parts.append(box('Table • stretcher', (s * h, 0, z), (.03, .6, .03), steel, .004, 1))
    for s in (-1, 1):
        for k in (-1, 1):
            parts.append(box('Table • grid bar', (k * .1, s * h, .32), (.022, .022, .36), steel, .003, 1))
            parts.append(box('Table • grid bar', (s * h, k * .1, .32), (.022, .022, .36), steel, .003, 1))
    for p in parts:
        p.parent = piv
    piv.location = (cx, cy, 0)
    return piv


def saturn_lamp(cx, cy, cz):
    piv = bpy.data.objects.new('Saturn lamp', None)
    SET.objects.link(piv); piv.parent = ROOT
    parts = [lathe('Saturn • foot', [(0, 0), (.13, 0), (.135, .02), (.11, .045), (0, .05)], mint_dk, (0, 0, 0))]
    z = .045
    for k, r in enumerate([.1, .088, .076, .064, .054]):
        parts.append(lathe('Saturn • stacked rib', [(0, 0), (r * .8, 0), (r, .022), (r, .04), (r * .8, .062), (0, .062)], mint if k % 2 else mint_dk, (0, 0, z)))
        z += .058
    parts.append(cyl('Saturn • neck', (0, 0, z), (0, 0, z + .08), .03, mint_dk, .036))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=.17, location=(0, 0, z + .23))
    globe = link(bpy.context.object, mint); globe.name = 'Saturn • planet'
    parts.append(globe)
    bpy.ops.mesh.primitive_torus_add(major_radius=.28, minor_radius=.075, major_segments=72, minor_segments=16, location=(0, 0, z + .23))
    ring = link(bpy.context.object, ring_mat); ring.name = 'Saturn • ring'
    ring.scale = (1, 1, .16); ring.rotation_euler = (math.radians(-26), math.radians(14), 0)
    parts.append(ring)
    for p in parts:
        p.parent = piv
    piv.location = (cx, cy, cz)
    return piv


def floor_lamp(cx, cy):
    piv = bpy.data.objects.new('Torchiere floor lamp', None)
    SET.objects.link(piv); piv.parent = ROOT
    H = 3.15
    parts = [lathe('Lamp • weighted base', [(0, 0), (.22, 0), (.23, .02), (.2, .05), (.05, .07), (0, .07)], steel, (0, 0, FLOOR_Z)),
             cyl('Lamp • stem', (0, 0, FLOOR_Z + .06), (0, 0, H - .5), .022, steel, verts=20),
             lathe('Lamp • conical shade', [(0, 0), (.04, 0), (.05, .06), (.25, .42), (.265, .43), (.245, .435), (.04, .08), (0, .08)], steel, (0, 0, H - .43))]
    for p in parts:
        p.parent = piv
    piv.location = (cx, cy, 0)
    return piv


CHAIR = (.45, .95, math.radians(14))
club_chair(*CHAIR)
side_table(-.85, 1.0)
saturn_lamp(-.85, 1.0, .845)
floor_lamp(1.75, 1.85)

# Cast: Laura front-left, Cooper front-right, both clear of the furniture.
CAST = {'Laura Palmer': (-1.95, -.55, .38), 'Dale Cooper': (2.05, -.7, -.42)}
for n, (x, y, a) in CAST.items():
    o = cast_inst[n]
    o.location = (x, y, .08)
    o.rotation_euler[2] = a

# ---------- export ----------
for o in bpy.context.view_layer.objects:
    o.select_set(False)
SET.hide_viewport = False
SET.hide_render = False
lc = bpy.context.view_layer.layer_collection.children.get(SET.name)
if lc:
    lc.exclude = False
for o in SET.objects:
    if o.instance_type != 'COLLECTION':
        o.select_set(True)
bpy.context.view_layer.objects.active = ROOT
bpy.ops.export_scene.gltf(filepath=str(OUT / 'redroom.glb'), export_format='GLB', use_selection=True,
                          export_animations=False, export_apply=True, export_extras=False)
man_path = OUT / 'manifest.json'
manifest = json.loads(man_path.read_text())
for spec in manifest:
    if spec['id'] == 'redroom':
        for c in spec['cast']:
            x, y, a = CAST[c['name']]
            c['position'] = [x, .08, -y]
            c['rotation'] = a
man_path.write_text(json.dumps(manifest, indent=2))
print('EXPORTED redroom.glb', flush=True)

# ---------- cinematic preview (Cycles) ----------
SET.hide_viewport = True
SET.hide_render = True
s = bpy.context.scene
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(MASTER), compress=True)
if RENDER:
    for c in bpy.data.collections:
        if c.name.startswith('SET • '):
            c.hide_render = c is not SET
    for o in list(s.collection.objects):
        if o.type == 'LIGHT':
            o.hide_render = True
    world = s.world
    world.node_tree.nodes['Background'].inputs[0].default_value = (.004, .004, .005, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 1

    def light(name, kind, loc, target, power, color, size=1., spot=None):
        d = bpy.data.lights.new(name, kind)
        d.energy = power; d.color = color
        if kind == 'AREA':
            d.shape = 'DISK'; d.size = size
        if kind == 'SPOT':
            d.spot_size = spot; d.spot_blend = .6; d.shadow_soft_size = size
        o = bpy.data.objects.new(name, d)
        s.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        return o
    rig = [light('PREVIEW key', 'SPOT', (4.5, -5.5, 8.5), (.2, .3, .3), 7000, (1., .93, .85), 1.2, math.radians(62)),
           light('PREVIEW curtain graze', 'SPOT', (3.3, 1.2, 4.6), (-3.2, 2.2, 1.6), 1300, (1., .85, .8), .4, math.radians(70)),
           light('PREVIEW cool fill', 'AREA', (-4, -8, 3), (0, 0, 1), 160, (.6, .7, 1.), 4)]
    cam_d = bpy.data.cameras.new('PREVIEW lens')
    cam = bpy.data.objects.new('PREVIEW camera', cam_d)
    s.collection.objects.link(cam)
    cam.location = (8.6, -10.2, 5.3)
    cam.rotation_euler = (Vector((-.2, .6, 1.45)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam_d.lens = 46
    cam_d.dof.use_dof = True
    cam_d.dof.focus_distance = (Vector(CHAIR[:2] + (.7,)) - cam.location).length
    cam_d.dof.aperture_fstop = 2.2
    s.camera = cam
    s.render.engine = 'CYCLES'
    s.cycles.samples = SAMPLES
    s.cycles.use_denoising = True
    s.cycles.max_bounces = 6
    s.render.resolution_x = 1200
    s.render.resolution_y = 1200
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Medium High Contrast'
    prev = R / 'previews'
    prev.mkdir(exist_ok=True)
    s.render.filepath = str(prev / 'redroom-wide.png')
    bpy.ops.render.render(write_still=True)
    # Close-up on the chair corner, echoing the reference composition.
    cam.location = (4.4, -4.6, 2.3)
    cam.rotation_euler = (Vector((-.3, 1.2, 1.15)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam_d.lens = 42
    cam_d.dof.focus_distance = (Vector((.2, 1.0, .8)) - cam.location).length
    for n, o in cast_inst.items():
        o.hide_render = True
    s.render.filepath = str(prev / 'redroom-corner.png')
    bpy.ops.render.render(write_still=True)
print('COMPLETE', flush=True)
