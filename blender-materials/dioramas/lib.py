# Shared building blocks for the black-box miniature sets (Blender 4.5).
import bpy, bmesh, math, random
from mathutils import Vector

X0, X1, Y0, Y1 = -3.6, 3.6, -2.7, 2.7
FLOOR_Z = .08
WALL_H = 4.15
BACK_Y = 2.48
LEFT_X = -3.38
T = .2

ROOT = None
SET = None


def reset(name):
    global ROOT, SET
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    SET = bpy.context.scene.collection
    ROOT = bpy.data.objects.new('DIORAMA • ' + name, None)
    SET.objects.link(ROOT)
    return ROOT


def mat(name, color, rough=.6, metal=0., **kw):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    for k, v in kw.items():
        p.inputs[k].default_value = v
    m.diffuse_color = (*color, 1)
    return m


def glow(name, color, strength=4.):
    m = mat(name, color, .4)
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Emission Color'].default_value = (*color, 1)
    p.inputs['Emission Strength'].default_value = strength
    return m


def link(o, m=None, smooth=True):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    SET.objects.link(o)
    o.parent = ROOT
    if m is not None and hasattr(o.data, 'materials'):
        o.data.materials.clear()
        o.data.materials.append(m)
    if o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = smooth
    return o


def mesh(name, v, f, m, smooth=True):
    d = bpy.data.meshes.new(name)
    d.from_pydata(v, [], f)
    d.update()
    o = bpy.data.objects.new(name, d)
    SET.objects.link(o)
    return link(o, m, smooth)


def box(name, loc, dim, m, bevel=0., seg=2, sub=0, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = dim
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rot is not None:
        o.rotation_euler = rot
    link(o, m, smooth=bool(sub))
    if bevel:
        b = o.modifiers.new('Bevel', 'BEVEL'); b.width = bevel; b.segments = seg; b.limit_method = 'NONE'
    if sub:
        s = o.modifiers.new('Plump', 'SUBSURF'); s.levels = s.render_levels = sub
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


def sphere(name, loc, scale, m, segs=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=segs // 2, radius=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    return link(o, m)


def lathe(name, profile, m, loc, segs=48):
    v, f = [], []
    for r, z in profile:
        for j in range(segs):
            t = 2 * math.pi * j / segs
            v.append((loc[0] + r * math.cos(t), loc[1] + r * math.sin(t), loc[2] + z))
    for k in range(len(profile) - 1):
        for j in range(segs):
            a = k * segs + j; b = k * segs + (j + 1) % segs
            f.append((a, b, b + segs, a + segs))
    f.append(tuple(reversed(range(segs))))
    f.append(tuple((len(profile) - 1) * segs + j for j in range(segs)))
    return mesh(name, v, f, m)


def text(body, loc, size, m, rot=(math.pi / 2, 0, 0), extrude=.002, align='CENTER'):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.data.body = body; o.data.size = size; o.data.align_x = align; o.data.extrude = extrude
    o.name = 'Text • ' + body
    return link(o, m, smooth=False)


def group(name, parts, loc=(0, 0, 0), rot=0.):
    piv = bpy.data.objects.new(name, None)
    SET.objects.link(piv); piv.parent = ROOT
    for p in parts:
        p.parent = piv
    piv.location = loc
    piv.rotation_euler = (0, 0, rot)
    return piv


# ---------- the black display box shared by every set ----------
def display_box(title, wall=None, side_wall=True, floor=None, wall_h=WALL_H):
    lacquer = mat('Lacquer • black box', (.006, .006, .007), .42, **{'Coat Weight': .25, 'Coat Roughness': .3})
    frame = mat('Paint • charcoal frame edge', (.018, .018, .02), .7)
    brass = mat('Metal • dim brass', (.32, .2, .07), .38, .8)
    box('Display box • base', (0, 0, -.19), (X1 - X0, Y1 - Y0, .5), lacquer, .03, 3)
    box('Display box • charcoal lip', (0, 0, .035), (X1 - X0 + .02, Y1 - Y0 + .02, .07), frame, .012, 2)
    box('Display box • back wall', (0, BACK_Y + T / 2, wall_h / 2), (X1 - X0, T, wall_h), wall or lacquer, .02, 2)
    if side_wall:
        box('Display box • left wall', (LEFT_X - T / 2, (Y0 + BACK_Y) / 2, wall_h / 2), (T, BACK_Y - Y0, wall_h), wall or lacquer, .02, 2)
        box('Cornice • left', (LEFT_X + .06, (Y0 + BACK_Y) / 2, wall_h + .06), (.42, BACK_Y - Y0, .22), frame, .025, 3)
        box('Front edge post', (LEFT_X - T / 2, Y0 + .05, wall_h / 2 + .05), (T + .06, .14, wall_h + .1), frame, .02, 2)
    box('Cornice • back', (0, BACK_Y - .02, wall_h + .06), (X1 - X0, .42, .22), frame, .025, 3)
    box('Right end post', (X1 - .05, BACK_Y + T / 2, wall_h / 2 + .05), (.14, T + .06, wall_h + .1), frame, .02, 2)
    text(title, (0, Y0 - .002, -.2), .14, brass)
    if floor is not None:
        box('Floor', (0, 0, FLOOR_Z - .006), (X1 - X0 - .12, Y1 - Y0 - .12, .012), floor)


def chevron_floor(white, black, per=.36, half=.27, amp=.17, y_max=BACK_Y):
    box('Floor • ivory enamel', (0, 0, FLOOR_Z - .006), (X1 - X0 - .12, Y1 - Y0 - .12, .012), white)
    fx0, fx1, fy0, fy1 = X0 + .06, X1 - .06, Y0 + .06, y_max
    sub = 6
    zv, zf = [], []

    def zig(x):
        u = (x - fx0) / half; k = math.floor(u); t = u - k
        return amp * (t if k % 2 == 0 else 1 - t)
    xs = [min(fx1, fx0 + i * half / sub) for i in range(int(math.ceil((fx1 - fx0) / half * sub)) + 1)]
    y = fy0 - amp - per
    while y < fy1 + per:
        base = len(zv)
        for x in xs:
            zv.append((x, min(max(y + zig(x), fy0), fy1), FLOOR_Z + .001))
            zv.append((x, min(max(y + zig(x) + per / 2, fy0), fy1), FLOOR_Z + .001))
        for i in range(len(xs) - 1):
            a = base + 2 * i
            if zv[a + 1][1] - zv[a][1] > 1e-4 or zv[a + 3][1] - zv[a + 2][1] > 1e-4:
                zf.append((a, a + 2, a + 3, a + 1))
        y += per
    o = mesh('Floor • black chevrons', zv, zf, black, smooth=False)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
    bm.to_mesh(o.data); bm.free()
    return o


def curtain(name, length, place, m, cols=300, rows=50, seed=0, top=WALL_H - .02, bottom=FLOOR_Z - .015, depth=(.2, .3), width=(.2, .38)):
    """Irregular velvet folds. place(u, depth, z) -> xyz (u along the run, depth away from the wall)."""
    rnd = random.Random(seed)
    folds, s = [], 0.
    while s < length + .5:
        w = rnd.uniform(*width)
        folds.append((s, w, rnd.uniform(*depth), rnd.uniform(0, 6.28), rnd.uniform(.6, 1.4)))
        s += w

    def fold_at(u, z):
        h = (top - z) / (top - bottom)
        for f0, w, d, ph, fr in folds:
            if u < f0 + w:
                break
        uu = u + .022 * math.sin(z * .9 * fr + ph) * h
        for f0, w, d, ph, fr in folds:
            if uu < f0 + w:
                break
        t = (uu - f0) / w
        prof = abs(math.sin(math.pi * t)) ** .65
        return d * (.72 + .42 * h) * prof, .05 * math.sin(2 * math.pi * t) * (.4 + .6 * h)
    v, f = [], []
    for r in range(rows + 1):
        z = top - (top - bottom) * (r / rows) ** 1.05
        for c in range(cols + 1):
            u = length * c / cols
            dpt, lat = fold_at(u, z)
            hem = max(0., (bottom + .22 - z) / .22)
            v.append(place(u + lat, .03 + dpt + .07 * hem ** 2, z))
    for r in range(rows):
        for c in range(cols):
            a = r * (cols + 1) + c
            f.append((a, a + 1, a + cols + 2, a + cols + 1))
    o = mesh(name, v, f, m)
    sol = o.modifiers.new('Cloth thickness', 'SOLIDIFY'); sol.thickness = .018; sol.offset = 1
    return o


def velvet():
    m = mat('Velvet • lodge curtain', (.24, .004, .009), .95,
            **{'Sheen Weight': .8, 'Sheen Roughness': .55, 'Sheen Tint': (1., .2, .18, 1), 'Specular IOR Level': .08})
    return m


def pine(x, y, h, m_dark, m_light, trunk):
    parts = [cyl('Fir trunk', (x, y, FLOOR_Z), (x, y, h * .3), .07, trunk, .05, 12)]
    tiers = 6
    for j in range(tiers):
        z = h * (.18 + .8 * j / tiers)
        r = (h - z) * .34 + .1
        parts.append(cyl('Fir tier', (x, y, z), (x, y, z + h * .24), r, m_dark if j % 2 else m_light, .02, 14))
    return parts


def plank_floor(m1, m2, y0=Y0 + .06, y1=BACK_Y, w=.28, x0=X0 + .06, x1=X1 - .06, z=FLOOR_Z, along='x'):
    rnd = random.Random(4)
    y = y0; k = 0
    while y < y1 - 1e-3:
        h = min(w, y1 - y)
        x = x0
        while x < x1 - 1e-3:
            L = min(rnd.uniform(1.0, 2.2), x1 - x)
            box('Plank', (x + L / 2, y + h / 2, z - .004), (L - .012, h - .012, .02), m1 if (k + int(x * 3)) % 3 else m2, .004, 1)
            x += L
        y += h; k += 1
