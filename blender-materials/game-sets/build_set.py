# Game rooms modelled in Blender at the game's coordinates (three.js x = Blender x, three.js y = Blender z,
# three.js z = -Blender y). Colliders stay in levels.js; these GLBs carry the look: real geometry, PBR glaze/velvet/leather,
# world-scaled UVs for the canvas textures the game paints (material names "TEX:<kind>"), ambient occlusion baked to vertex colour.
# Run: blender -b --python build_set.py -- --set=redroom [--samples=24] [--preview]
import bpy, bmesh, sys, math, random
from pathlib import Path
from mathutils import Vector, Matrix
R = Path(__file__).resolve().parent
sys.path.insert(0, str(R.parent / 'dioramas'))
import lib
from lib import mat, glow, box, cyl, sphere, lathe, link, mesh

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SET = next(a.split('=')[1] for a in ARGS if a.startswith('--set='))
SAMPLES = int(next((a.split('=')[1] for a in ARGS if a.startswith('--samples=')), 24))
OUT = R.parents[1] / 'public/game/sets'
G = lambda x, y, z: (x, -z, y)          # game (x, y-up, z-depth) -> Blender


def gbox(name, gmin, gmax, m, bevel=0., seg=2, sub=0):
    """box given as game-space min/max corners"""
    (x0, y0, z0), (x1, y1, z1) = gmin, gmax
    return box(name, G((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, z1 - z0, y1 - y0), m, bevel, seg, sub)


def tex(kind, color=(1, 1, 1), rough=.8, **kw):
    """material the game re-skins with its own canvas texture; colour multiplies it"""
    return mat('TEX:' + kind, color, rough, **kw)


def velvet():
    return mat('Velvet • lodge red', (.33, .006, .012), .92, **{'Sheen Weight': .9, 'Sheen Roughness': .45, 'Sheen Tint': (1., .25, .2, 1), 'Specular IOR Level': .1})


def curtain_run(name, gx0, gx1, gz, top, m, seed=1, depth=(.35, .55), width=(.4, .7), cols_per=11, rows=36, bottom=-.02):
    rnd = random.Random(seed); L = abs(gx1 - gx0)
    folds, s = [], 0.
    while s < L + 1:
        w = rnd.uniform(*width); folds.append((s, w, rnd.uniform(*depth), rnd.uniform(0, 6.28))); s += w
    cols = int(L * cols_per)
    v, f = [], []
    for r in range(rows + 1):
        y = top - (top - bottom) * (r / rows) ** 1.05; h = 1 - (y - bottom) / (top - bottom)
        for c in range(cols + 1):
            u = L * c / cols
            fo = folds[0]
            for F in folds:
                if u < F[0] + F[1]:
                    fo = F; break
            uu = u + .05 * math.sin(y * .7 + fo[3]) * (1 - h)
            t = (uu - fo[0]) / fo[1]
            d = fo[2] * abs(math.sin(math.pi * t)) ** .6 * (.75 + .35 * (1 - h)) + .12 * max(0, .5 - y) ** 2
            v.append(G(gx0 + u * (1 if gx1 > gx0 else -1) + .06 * math.sin(t * 6.283), y, gz + d))
    for r in range(rows):
        for c in range(cols):
            a = r * (cols + 1) + c; f.append((a, a + 1, a + cols + 2, a + cols + 1))
    o = mesh(name, v, f, m)
    sol = o.modifiers.new('Thick', 'SOLIDIFY'); sol.thickness = .03; sol.offset = 1
    return o


def club_chair(cx, cz, rot, m_leather, m_band):
    """art-deco club chair after the lodge set: rounded body, banded arms with stepped stripes"""
    parts = []
    W, D = 2.4, 2.0
    parts.append(box('Chair • base', (0, 0, .5), (W - .3, D - .2, .7), m_leather, .12, 4, 1))
    parts.append(box('Chair • cushion', (0, -.12, 1.0), (W - .95, D - .55, .34), m_leather, .14, 4, 2))
    back = box('Chair • back', (0, D / 2 - .28, 1.5), (W - .3, .5, 1.65), m_leather, .2, 4, 2); parts.append(back)
    for s in (-1, 1):
        arm = box('Chair • arm', (s * (W / 2 - .25), -.05, .95), (.5, D - .1, 1.25), m_leather, .2, 4, 2); parts.append(arm)
        for k in range(4):   # stepped bands down the arm front, like the reference chairs
            parts.append(box('Chair • band', (s * (W / 2 - .25), -D / 2 + .02 - k * .0, 1.38 - k * .26), (.54, .08, .11), m_band, .04, 3, 1))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cyl('Chair • foot', (sx * (W / 2 - .3), sy * (D / 2 - .3), 0), (sx * (W / 2 - .3), sy * (D / 2 - .3), .16), .09, m_band, .07, 16))
    g = lib.group('Club chair', parts, G(cx, 0, cz), rot)
    return g


def torchiere(gx, gz, steel, glowm):
    parts = [lathe('Torchiere • base', [(0, 0), (.42, 0), (.4, .08), (.12, .14), (0, .14)], steel, (0, 0, 0)),
             cyl('Torchiere • stem', (0, 0, .1), (0, 0, 4.1), .045, steel, verts=16),
             lathe('Torchiere • trumpet', [(0, 0), (.06, 0), (.1, .35), (.22, .7), (.48, .98), (.52, 1.0), (.47, .99), (.2, .68), (.05, .05), (0, .05)], steel, (0, 0, 4.0)),
             lathe('Torchiere • glow', [(0, 0), (.44, 0), (0, .01)], glowm, (0, 0, 4.95))]
    return lib.group('Torchiere', parts, G(gx, 0, gz))


def saturn_lamp_table(gx, gz, glass, chrome, green, ring):
    parts = [box('Glass table • top', (0, 0, 1.78), (1.6, 1.3, .06), glass, .02, 2)]
    for sx in (-1, 1):   # bent tube sled legs
        pts = [(sx * .72, -.6, 0), (sx * .72, -.6, 1.7), (sx * .72, .6, 1.7), (sx * .72, .6, 0)]
        for a, b in zip(pts[:-1], pts[1:]):
            parts.append(cyl('Glass table • tube', a, b, .035, chrome, verts=12))
        parts.append(cyl('Glass table • runner', (sx * .72, -.62, .03), (sx * .72, .62, .03), .035, chrome, verts=12))
    for k in range(3):
        parts.append(cyl('Glass table • rail', (-.72, -.6 + k * .6, .6), (.72, -.6 + k * .6, .6), .025, chrome, verts=10))
    parts.append(lathe('Saturn • foot', [(0, 0), (.28, 0), (.24, .1), (.08, .16), (0, .16)], chrome, (0, 0, 1.81)))
    parts.append(cyl('Saturn • neck', (0, 0, 1.95), (0, 0, 2.25), .05, chrome, verts=12))
    parts.append(sphere('Saturn • planet', (0, 0, 2.62), (.4, .4, .4), green, 40))
    bpy.ops.mesh.primitive_torus_add(major_radius=.64, minor_radius=.07, major_segments=72, minor_segments=14, location=(0, 0, 2.62))
    r = link(bpy.context.object, ring); r.scale = (1, 1, .25); r.rotation_euler = (math.radians(-22), math.radians(12), 0); parts.append(r)
    return lib.group('Saturn lamp on glass table', parts, G(gx, 0, gz))


def venus(gx, gz, marble):
    """a classical armless statue (after the Venus in the lodge): sculpted from primitives, fused by voxel remesh"""
    objs = []
    def e(c, s, rot=None):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=16, location=c); o = bpy.context.object; o.scale = s
        if rot: o.rotation_euler = rot
        objs.append(o); return o
    def cn(a, b, r1, r2):
        a, b = Vector(a), Vector(b); d = b - a
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r1, radius2=r2, depth=d.length, location=(a + b) / 2)
        o = bpy.context.object; o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); objs.append(o); return o
    # draped lower body with folds
    cn((0, 0, .5), (.04, 0, 2.3), .5, .32)
    for k in range(9):
        a = k / 9 * 6.283; cn((.42 * math.cos(a), .38 * math.sin(a), .5), (.26 * math.cos(a) + .05, .24 * math.sin(a), 2.25), .07, .04)
    e((.06, 0, 2.35), (.36, .26, .2), (0, .25, 0))              # drape knot at the hips
    e((.06, 0, 2.95), (.33, .24, .55), (0, -.08, 0))            # torso
    for sx in (-1, 1):
        e((sx * .15 + .05, -.17, 3.18), (.13, .12, .13))        # chest
        e((sx * .3 + .06, 0, 3.38), (.13, .13, .12))            # shoulder stumps
    cn((.06, 0, 3.4), (.04, -.02, 3.62), .1, .085)              # neck
    e((.03, -.03, 3.83), (.18, .2, .23), (.2, 0, -.2))           # head turned
    e((.0, .12, 3.95), (.13, .12, .1))                           # hair bun
    e((.03, -.2, 3.8), (.03, .04, .05))                          # nose
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
    st = bpy.context.object; st.name = 'Venus statue'
    rm = st.modifiers.new('Fuse', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = .02
    sm = st.modifiers.new('Soft', 'SMOOTH'); sm.factor = .6; sm.iterations = 6
    bpy.ops.object.modifier_apply(modifier='Fuse'); bpy.ops.object.modifier_apply(modifier='Soft')
    link(st, marble)
    plinth = box('Venus plinth', (0, 0, .25), (1.2, 1.2, .5), marble, .04, 3)
    return lib.group('Venus', [st, plinth], G(gx, 0, gz), .35)


def redroom():
    vel = velvet()
    leather = mat('Leather • lodge brown', (.085, .035, .016), .4, **{'Coat Weight': .45, 'Coat Roughness': .3})
    band = mat('Leather • lodge band', (.22, .1, .045), .36, **{'Coat Weight': .5, 'Coat Roughness': .25})
    steel = mat('Metal • brushed nickel', (.62, .62, .6), .28, 1.)
    glowm = glow('Glow • torchiere', (1., .8, .55), 6.)
    glass = mat('Glass • table top', (.85, .9, .9), .02, **{'Transmission Weight': 1., 'IOR': 1.45})
    chrome = mat('Metal • chrome', (.8, .8, .8), .12, 1.)
    green = glow('Glow • saturn green', (.08, .7, .2), .9)
    ring = mat('Ceramic • saturn ring', (.12, .25, .14), .3)
    marble = mat('Marble • statue', (.88, .86, .82), .35, **{'Subsurface Weight': .25, 'Coat Weight': .2})
    floor = tex('chevron', (1, 1, 1), .32)
    # floor (the game draws the chevrons on it), back + side curtains, three alcoves at x = -10, 0, 10
    gbox('Floor • chevron', (-15, -.6, -7), (15, 0, 10), floor)
    x = -15
    for a in (-10, 0, 10):
        curtain_run(f'Curtain • back {a}', x, a - 1.1, -3.9, 9.5, vel, seed=a + 30); x = a + 1.1
        curtain_run(f'Curtain • alcove {a}', a - 1.6, a + 1.6, -6.6, 9.5, vel, seed=a + 50, cols_per=14)
        for s in (-1, 1):
            gbox('Alcove jamb', (a + s * 1.15 - .06, 0, -6.6), (a + s * 1.15 + .06, 9.5, -3.9), vel, .02)
    curtain_run('Curtain • back end', x, 15, -3.9, 9.5, vel, seed=91)
    # furniture after the reference: chairs, statue, torchieres, glass table with the glowing saturn
    club_chair(-2.8, -2.6, math.radians(8), leather, band)       # collider in levels.js: x -4.2..-1.4, z -3.6..-1.6
    club_chair(6.4, -2.7, math.radians(-10), leather, band)
    saturn_lamp_table(-6.6, -2.7, glass, chrome, green, ring)    # collider: x -7.4..-5.8, z -3.4..-2.0
    torchiere(-12.4, -3.1, steel, glowm); torchiere(1.0, -3.2, steel, glowm); torchiere(13.2, -3.1, steel, glowm)
    venus(8.6, -3.3, marble)



def frame_picture(name, gx, gy, gz, w, h, gold, canvas):
    parts = [gbox(name + ' frame', (gx - w / 2 - .12, gy - h / 2 - .12, gz), (gx + w / 2 + .12, gy + h / 2 + .12, gz + .1), gold, .03, 2),
             gbox(name + ' canvas', (gx - w / 2, gy - h / 2, gz + .1), (gx + w / 2, gy + h / 2, gz + .12), canvas)]
    return parts


def sconce(gx, gy, gz, brass, shade):
    parts = [gbox('Sconce plate', (gx - .12, gy - .2, gz), (gx + .12, gy + .2, gz + .05), brass, .02, 2),
             cyl('Sconce arm', G(gx, gy, gz + .05), G(gx, gy + .15, gz + .45), .03, brass, verts=10)]
    tulip = lathe('Sconce tulip', [(0, 0), (.06, 0), (.16, .12), (.22, .3), (.2, .32), (.05, .04), (0, .04)], shade, G(gx, gy + .12, gz + .45))
    return parts + [tulip]


def hotel():
    damask = tex('damask', (1, 1, 1), .9)
    wood = mat('Wood • mahogany', (.16, .05, .02), .35, **{'Coat Weight': .5, 'Coat Roughness': .15})
    wood_dark = mat('Wood • mahogany dark', (.08, .025, .01), .4, **{'Coat Weight': .4, 'Coat Roughness': .2})
    floor = tex('planks', (1, 1, 1), .45, **{'Coat Weight': .3, 'Coat Roughness': .25})
    rug = tex('rug', (1, 1, 1), .95)
    gold = mat('Metal • gilt frame', (.62, .42, .14), .32, .9)
    brass = mat('Metal • brass', (.7, .5, .2), .3, 1.)
    shade = glow('Glow • tulip shade', (1., .78, .5), 1.4)
    red = mat('Velvet • wingback red', (.32, .02, .02), .7, **{'Sheen Weight': .6, 'Sheen Tint': (1, .4, .3, 1)})
    drape = mat('Velvet • drape red', (.28, .015, .02), .85, **{'Sheen Weight': .7})
    linen = mat('Linen • bed', (.7, .66, .58), .9)
    blanket = mat('Wool • blanket', (.25, .05, .04), .95)
    stone = mat('Stone • hearth', (.32, .3, .28), .7)
    soot = mat('Soot • firebox', (.02, .018, .016), .95)
    canvas1, canvas2 = mat('Paint • still life', (.38, .3, .18), .8), mat('Paint • portrait', (.22, .2, .16), .8)
    glassw = glow('Glow • window night', (.05, .1, .26), .45)
    # shell: floor, back wall (wainscot below, damask above), left wall, right wall around the door
    gbox('Floor', (-16, -.6, -6), (17, 0, 10), floor)
    gbox('Wall • back damask', (-16, 1.9, -4.75), (17, 9, -4.3), damask)
    gbox('Wall • left damask', (-15.1, 1.9, -6), (-14.2, 9, 4), damask)
    gbox('Wall • right damask a', (14.2, 1.9, -6), (15.1, 9, -1.4), damask); gbox('Wall • right damask b', (14.2, 1.9, .9), (15.1, 9, 4), damask)
    gbox('Wall • over door', (14.2, 4.4, -1.4), (15.1, 9, .9), damask)
    # wainscot: rail, raised panels, skirting
    gbox('Wainscot', (-16, 0, -4.6), (17, 1.9, -4.25), wood_dark)
    gbox('Wainscot rail', (-16, 1.85, -4.32), (17, 2.05, -4.15), wood, .03)
    gbox('Skirting', (-16, 0, -4.3), (17, .35, -4.16), wood, .02)
    x = -14
    while x < 14:
        gbox('Wainscot panel', (x + .15, .55, -4.26), (x + 1.65, 1.6, -4.18), wood, .05, 3); x += 2
    gbox('Wainscot • left', (-15.1, 0, -6), (-14.12, 1.9, 4), wood_dark); gbox('Wainscot • left rail', (-14.2, 1.85, -6), (-14.05, 2.05, 4), wood, .03)
    # crown moulding and corner posts
    gbox('Crown moulding', (-16, 8.4, -4.4), (17, 9, -3.95), wood, .08, 3)
    for px in (-14.25, 14.1):
        gbox('Corner post', (px - .2, 0, -4.4), (px + .2, 9, -4.0), wood, .05, 3)
    # window with drapes and a pelmet
    gbox('Window • night', (-7.5, 2.6, -4.32), (-2.5, 6.2, -4.28), glassw)
    for wx in (-7.5, -5, -2.5):
        gbox('Window • mullion', (wx - .1, 2.5, -4.3), (wx + .1, 6.3, -4.12), wood, .02)
    for wy in (2.5, 4.4, 6.25):
        gbox('Window • transom', (-7.6, wy - .07, -4.3), (-2.4, wy + .07, -4.12), wood, .02)
    curtain_run('Drape • left', -9.2, -7.3, -4.15, 7.4, drape, seed=4, depth=(.15, .28), width=(.25, .4), cols_per=16, rows=28)
    curtain_run('Drape • right', -2.7, -.8, -4.15, 7.4, drape, seed=5, depth=(.15, .28), width=(.25, .4), cols_per=16, rows=28)
    gbox('Pelmet', (-9.4, 7.2, -4.2), (-.6, 7.9, -3.85), drape, .06, 3)
    # pictures + sconces on the damask
    frame_picture('Painting • still life', 5.2, 5.0, -4.3, 2.4, 1.8, gold, canvas1)
    frame_picture('Painting • portrait', 10.8, 5.3, -4.3, 1.0, 1.3, gold, canvas2)
    frame_picture('Painting • small', 12.4, 4.6, -4.3, .7, .9, gold, canvas1)
    for sx in (-11, 2.4, 13.2):
        sconce(sx, 4.6, -4.3, brass, shade)
    # fireplace with mantel clock
    gbox('Fireplace • surround', (4.2, 0, -4.3), (7.8, 3.0, -3.6), wood, .04, 3)
    gbox('Fireplace • mantel', (3.9, 3.0, -4.35), (8.1, 3.25, -3.4), wood, .05, 3)
    gbox('Fireplace • hearth', (4.0, 0, -3.6), (8.0, .14, -2.9), stone, .03, 2)
    gbox('Fireplace • opening', (4.9, .14, -3.62), (7.1, 2.1, -3.5), soot)
    gbox('Mantel clock', (5.7, 3.25, -4.0), (6.3, 4.05, -3.6), wood_dark, .08, 3)
    cyl('Clock face', G(6.0, 3.7, -3.59), G(6.0, 3.7, -3.55), .2, mat('Enamel • clock face', (.85, .8, .68), .3), verts=24)
    # gramophone on a little cabinet (left of the bedside cabinet)
    gbox('Gramophone cabinet', (-4.4, 0, -4.1), (-3.0, 1.6, -2.9), wood, .04, 3)
    gbox('Gramophone box', (-4.25, 1.6, -3.95), (-3.15, 1.95, -3.05), wood_dark, .03, 2)
    lathe('Gramophone horn', [(0, 0), (.05, 0), (.08, .4), (.2, .75), (.55, 1.0), (.6, 1.02), (.5, 1.0), (.17, .74), (.04, .02), (0, .02)], brass, G(-3.7, 1.95, -3.5))
    # bed: carved headboard, linen, blanket, pillows (collider: x -13.8..-7.6, top 1.55)
    gbox('Bed • frame', (-13.8, .25, -4.2), (-7.6, 1.25, 1.3), wood, .08, 3)
    for bx in (-13.7, -7.75):
        for bz in (-4.1, 1.15):
            gbox('Bed • leg', (bx - .12, 0, bz - .12), (bx + .12, .3, bz + .12), wood_dark, .03)
    gbox('Bed • mattress', (-13.7, 1.25, -4.1), (-7.7, 1.55, 1.2), linen, .12, 3, 1)
    gbox('Bed • blanket', (-11.6, 1.5, -4.15), (-7.55, 1.72, 1.35), blanket, .1, 3, 1)
    for pz in (-3.2, -.2):
        gbox('Bed • pillow', (-13.6, 1.5, pz - 1.1), (-12.6, 1.95, pz + 1.1), linen, .2, 3, 2)
    gbox('Bed • headboard', (-14.2, 0, -4.2), (-13.8, 3.4, 1.4), wood, .06, 3)
    gbox('Bed • headboard crest', (-14.25, 3.2, -3.4), (-13.75, 3.8, .6), wood, .2, 4, 1)
    # tall bedside cabinet with drawers (collider: x -1.1..1.1, z -2.8..-.35, h 2.45)
    gbox('Cabinet', (-1.1, 0, -2.8), (1.1, 2.45, -.35), wood, .05, 3)
    for dy in (.35, 1.05, 1.75):
        gbox('Cabinet • drawer', (-.95, dy, -.38), (.95, dy + .55, -.3), wood_dark, .03, 2)
        sphere('Cabinet • knob', G(0, dy + .27, -.27), (.06, .06, .06), brass, 12)
    # rug, wingback chair + tea table, floor lamp, coat stand
    gbox('Rug', (-6.5, 0, -3.2), (6.5, .03, 1.6), rug, .01)
    gbox('Wingback • seat', (9.2, 0, -4.0), (12.4, 1.15, -2.3), red, .15, 3, 1)
    gbox('Wingback • back', (9.2, 1.0, -4.15), (12.4, 3.6, -3.55), red, .25, 3, 2)
    for wx in (9.0, 12.2):
        gbox('Wingback • wing', (wx, 1.0, -4.1), (wx + .45, 2.9, -2.4), red, .2, 3, 2)
    lathe('Tea table', [(0, 0), (.4, 0), (.1, .1), (.08, 1.0), (.75, 1.05), (.75, 1.12), (0, 1.12)], wood, G(7.4, 0, -2.0))
    cyl('Coat stand', G(4, 0, -3.6), G(4, 5.2, -3.6), .08, wood_dark, verts=12)
    for a in range(4):
        cyl('Coat hook', G(4, 4.9, -3.6), G(4 + .4 * math.cos(a * 1.57), 5.15, -3.6 + .4 * math.sin(a * 1.57)), .03, brass, verts=8)



def stool(gx, gz, chrome, vinyl):
    parts = [lathe('Stool • foot', [(0, 0), (.42, 0), (.38, .06), (.08, .1), (0, .1)], chrome, (0, 0, 0)),
             cyl('Stool • post', (0, 0, .08), (0, 0, .78), .07, chrome, verts=16),
             lathe('Stool • ring', [(0, .78), (.52, .78), (.56, .82), (.56, .84), (0, .84)], chrome, (0, 0, 0)),
             box('Stool • seat', (0, 0, .91), (1.04, 1.04, .14), vinyl, .07, 4, 2)]
    for k in range(6):   # tufting buttons
        a = k / 6 * 6.283; parts.append(sphere('Stool • button', (.25 * math.cos(a), .25 * math.sin(a), .985), (.025, .025, .015), vinyl, 8))
    return lib.group('Stool', parts, G(gx, 0, gz))


def diner():
    tiles = tex('checker', (1, 1, 1), .35, **{'Coat Weight': .4, 'Coat Roughness': .2})
    teal = mat('Paint • diner teal', (.05, .2, .18), .55)
    cream = mat('Paint • cream', (.62, .55, .42), .6)
    pine = tex('planks', (1, 1, 1), .45, **{'Coat Weight': .3})
    formica = mat('Formica • teal', (.07, .26, .22), .25, **{'Coat Weight': .5, 'Coat Roughness': .1})
    chrome = mat('Metal • chrome', (.8, .8, .8), .12, 1.)
    vinyl = mat('Vinyl • cherry', (.42, .02, .03), .35, **{'Coat Weight': .6, 'Coat Roughness': .2})
    night = glow('Glow • rainy night', (.03, .08, .14), .5)
    blind = mat('Blinds • ivory', (.7, .66, .56), .6)
    black = mat('Enamel • black', (.02, .02, .02), .3)
    glassd = mat('Glass • pie case', (.9, .95, .95), .02, **{'Transmission Weight': 1.})
    pie = mat('Pastry • crust', (.55, .32, .12), .7); cherry = mat('Cherry filling', (.45, .02, .03), .3)
    menu = mat('Menu • board', (.04, .05, .04), .8); letters = glow('Menu • letters', (.9, .85, .7), .6)
    lampshade = mat('Enamel • pendant cream', (.8, .75, .62), .4)
    gbox('Floor', (-17, -.6, -6), (19, 0, 10), tiles)
    gbox('Wall • back lower', (-17, 0, -5.4), (19, 2.6, -4.6), pine)
    gbox('Wall • back rail', (-17, 2.55, -4.65), (19, 2.75, -4.5), chrome, .02)
    gbox('Wall • back upper', (-17, 2.7, -5.4), (19, 9, -4.65), teal)
    gbox('Wall • left', (-17.6, 0, -6), (-16.6, 9, 4), teal)
    gbox('Wall • right a', (18.2, 0, -6), (19.2, 9, -2.8), teal); gbox('Wall • right b', (18.2, 4.5, -2.8), (19.2, 9, -.3), teal); gbox('Wall • right c', (18.2, 0, -.3), (19.2, 9, 4), teal)
    # rainy window band with venetian blinds half drawn
    gbox('Window • night', (-13, 2.9, -4.64), (11, 5.6, -4.6), night)
    for k in range(14):
        y = 5.55 - k * .1
        if y < 4.3:
            break
        gbox('Blind slat', (-13, y - .03, -4.58), (11, y + .03, -4.5), blind, .01)
    for wx in range(-13, 12, 4):
        gbox('Window • mullion', (wx - .08, 2.85, -4.6), (wx + .08, 5.65, -4.48), cream, .02)
    gbox('Window • sill', (-13.2, 2.75, -4.62), (11.2, 2.9, -4.3), cream, .03)
    # counter: panelled wood front, chrome kick + trim, formica top (collider x -6..13, h 1.95 / top 2.15)
    gbox('Counter • body', (-6, 0, -4.5), (13, 1.95, -2.1), pine, .03)
    gbox('Counter • kick', (-6, 0, -2.2), (13, .22, -2.05), chrome, .02)
    x = -5.6
    while x < 12.6:
        gbox('Counter • panel', (x, .45, -2.12), (x + 1.2, 1.7, -2.05), cream, .04, 3); x += 1.45
    gbox('Counter • top', (-6.2, 1.95, -4.55), (13.2, 2.15, -1.95), formica, .02)
    gbox('Counter • edge', (-6.2, 1.95, -2.0), (13.2, 2.15, -1.92), chrome, .02)
    for sx in (-3.6, -.6, 2.4, 5.4, 8.4):
        stool(sx, -1.25, chrome, vinyl)
    # booths + table (colliders in levels.js)
    gbox('Booth • seat', (-16.3, 0, -4.5), (-10.5, .9, -2.4), vinyl, .12, 3, 1)
    gbox('Booth • back', (-16.3, .9, -4.5), (-10.5, 2.4, -3.9), vinyl, .18, 3, 1)
    for k in range(5):
        gbox('Booth • tuft line', (-16.2 + k * 1.2, .95, -3.92), (-16.15 + k * 1.2, 2.35, -3.86), mat('Vinyl • seam', (.25, .01, .02), .4))
    gbox('Booth • chrome trim', (-16.3, 2.35, -4.5), (-10.5, 2.48, -3.85), chrome, .03)
    gbox('Booth table • top', (-14.6, 1.75, -2.6), (-9.6, 1.92, -.9), formica, .03)
    gbox('Booth table • edge', (-14.62, 1.74, -.92), (-9.58, 1.93, -.86), chrome, .01)
    gbox('Booth table • pedestal', (-12.6, 0, -2.4), (-11.6, 1.75, -1.2), chrome, .1, 3)
    # on the counter, away from the cup's path: coffee machine, pie case, napkins, sugar
    gbox('Coffee machine', (-5.6, 2.15, -4.4), (-3.8, 3.6, -3.3), chrome, .12, 3)
    for k in range(2):
        cyl('Coffee urn', G(-5.2 + k * .9, 3.6, -3.85), G(-5.2 + k * .9, 4.3, -3.85), .3, chrome, verts=24)
        cyl('Coffee pot', G(-5.2 + k * .9, 2.2, -3.25), G(-5.2 + k * .9, 2.6, -3.25), .2, glassd, .14, 20)
    gbox('Pie case • base', (11.4, 2.15, -4.4), (13.0, 2.3, -3.2), chrome, .03)
    lathe('Pie case • dome', [(0, 0), (.75, 0), (.74, .35), (.6, .7), (.3, .9), (0, .95)], glassd, G(12.2, 2.3, -3.8))
    lathe('Cherry pie', [(0, 0), (.5, 0), (.55, .12), (.45, .16), (0, .16)], pie, G(12.2, 2.32, -3.8))
    lathe('Cherry pie • top', [(0, 0), (.42, 0), (0, .02)], cherry, G(12.2, 2.47, -3.8))
    for nx in (-.4, 4.1):
        gbox('Napkin dispenser', (nx, 2.15, -4.35), (nx + .35, 2.6, -4.05), chrome, .04)
    # menu board + clock on the wall
    gbox('Menu board', (-6.2, 5.9, -4.62), (-2.0, 7.6, -4.5), menu, .04)
    for k, w in enumerate((3.2, 2.6, 2.9, 2.2)):
        gbox('Menu line', (-5.8, 7.25 - k * .38, -4.5), (-5.8 + w, 7.33 - k * .38, -4.47), letters)
    cyl('Wall clock', G(14.5, 6.6, -4.62), G(14.5, 6.6, -4.5), .55, mat('Enamel • clock', (.85, .82, .7), .3), verts=32)
    # pendant lamps (the game hangs its spotlights here)
    for px in (-1, 7):
        cyl('Pendant cord', G(px, 9, -3), G(px, 5.95, -3), .02, black, verts=8)
        lathe('Pendant shade', [(0, 0), (.12, 0), (.7, -.45), (.95, -.62), (.9, -.64), (.1, -.06), (0, -.06)], lampshade, G(px, 5.98, -3))
    # jukebox body (glow + light are animated by the game)
    gbox('Jukebox • body', (-9.2, 0, -4.3), (-7.4, 2.1, -3.1), mat('Wood • jukebox', (.25, .09, .03), .3, **{'Coat Weight': .6}), .1, 3)
    lathe('Jukebox • crown', [(0, 0), (.9, 0), (.88, .3), (.6, .55), (0, .62)], chrome, G(-8.3, 2.1, -3.7))



def fir(gx, gz, r, h, bark, needles, rnd, low=9.):
    """tall fir: flared roots, tapering trunk, broken stubs, jagged needle tiers from `low` up"""
    parts = [lathe('Fir trunk', [(0, -.3), (r * 1.55, -.3), (r * 1.25, .2), (r * 1.02, .8), (r * .9, h * .5), (r * .55, h), (0, h)], bark, G(gx, 0, gz), segs=20)]
    for k in range(5):   # root flares
        a = k / 5 * 6.283 + rnd.random()
        parts.append(cyl('Fir root', G(gx + math.cos(a) * r * .6, .5, gz + math.sin(a) * r * .6), G(gx + math.cos(a) * r * 1.8, -.05, gz + math.sin(a) * r * 1.8), r * .32, bark, r * .12, 10))
    for k in range(3):   # dead branch stubs low on the trunk
        a = rnd.random() * 6.283; y = 2.5 + rnd.random() * 5
        parts.append(cyl('Fir stub', G(gx + math.cos(a) * r * .8, y, gz + math.sin(a) * r * .8), G(gx + math.cos(a) * (r + 1.1), y - .4, gz + math.sin(a) * (r + 1.1)), .08, bark, .02, 8))
    y = low
    while y < h - 1:
        rr = (h - y) * .42 + .6
        prof = [(0, 0)] + [(rr * (1 - j / 10) * (1 + .18 * ((j % 2) * 2 - 1)), j / 10 * 2.2) for j in range(11)] + [(0, 2.2)]
        parts.append(lathe('Fir tier', prof, needles, G(gx, y, gz), segs=14)); y += 1.6
    return parts


def fern(gx, gz, m, rnd):
    parts = []
    for k in range(7):
        a = k / 7 * 6.283 + rnd.random() * .5; L = .9 + rnd.random() * .5
        pts = [G(gx, .05, gz), G(gx + math.cos(a) * L * .5, .55, gz + math.sin(a) * L * .5), G(gx + math.cos(a) * L, .25, gz + math.sin(a) * L)]
        for p0, p1 in zip(pts[:-1], pts[1:]):
            parts.append(cyl('Fern frond', p0, p1, .07, m, .03, 6))
    return parts


def forest():
    moss = tex('moss', (1, 1, 1), .95)
    bark = tex('bark', (1, 1, 1), .95)
    pale = mat('Bark • sycamore', (.62, .6, .52), .85)
    needles = mat('Needles • fir', (.02, .055, .035), .9)
    fernm = mat('Fern • frond', (.05, .13, .06), .8)
    rock = mat('Rock • mossy granite', (.22, .24, .22), .9)
    soil = mat('Soil • ditch', (.05, .04, .03), .95)
    rnd = random.Random(3)
    DX0, DX1 = 15.5, 19.4
    gbox('Ground • west', (-26, -1.2, -9), (DX0, 0, 10), moss); gbox('Ground • east', (DX1, -1.2, -9), (46, 0, 10), moss)
    gbox('Ditch • wall w', (DX0 - .05, -7.6, -9), (DX0, 0, 10), soil); gbox('Ditch • wall e', (DX1, -7.6, -9), (DX1 + .05, 0, 10), soil)
    gbox('Ditch • floor', (DX0, -8, -9), (DX1, -7.6, 10), soil)
    for k in range(10):   # roots poking from the ditch walls
        z = -8 + k * 1.8
        cyl('Ditch root', G(DX0, -.4 - rnd.random(), z), G(DX0 + .6 + rnd.random() * .5, -1.2 - rnd.random(), z + .3), .06, soil, .02, 8)
    # the four hiding trunks (colliders in levels.js) and the background forest
    for x, z, r in ((-15, -.9, .8), (-7, -.6, .9), (1, -.9, .85), (6.2, -.7, .8)):
        fir(x, z, r, 24, bark, needles, rnd)
    x = -26
    while x < 46:
        z = -5.5 - abs(math.cos(x * .7)) * 2.5; r = .9 + abs(math.sin(x * 1.3)) * .5
        if not (DX0 - 1 < x < DX1 + 1):
            fir(x + math.sin(x) * 1.2, z, r, 22 + rnd.random() * 6, bark, needles, rnd, low=7 + rnd.random() * 3)
        x += 3.2
    for i in range(46):
        fx = -24 + i * 1.5 + math.sin(i * 7) * .6; fz = -3 + math.sin(i * 3.1) * .9
        if DX0 - .8 < fx < DX1 + .8 or 27 < fx < 41:
            continue
        fern(fx, fz, fernm, rnd)
    for i in range(18):   # mossy rocks and fallen branches
        rx = -25 + rnd.random() * 70
        if DX0 - 1 < rx < DX1 + 1:
            continue
        rz = -4.5 + rnd.random() * 2.5
        sphere('Rock', G(rx, .1, rz), (.4 + rnd.random() * .5, .3 + rnd.random() * .4, .25 + rnd.random() * .3), rock, 14)
        if i % 3 == 0:
            cyl('Fallen branch', G(rx + .5, .1, rz + .4), G(rx + 2.5, .15, rz - .3), .1, bark, .05, 8)
    # Glastonbury Grove: twelve pale sycamores in a ring around the oil pool
    for i in range(12):
        a = i / 12 * 6.283; x, z = 34 + math.cos(a) * 6, -1.4 + math.sin(a) * 3
        if z > 1:
            continue
        lathe('Sycamore', [(0, -.2), (.6, -.2), (.45, .5), (.38, 6), (.24, 14), (0, 14)], pale, G(x, 0, z), segs=16)
        for k in range(2):
            b = a + (k - .5) * 1.2
            cyl('Sycamore bough', G(x, 8 + k * 2, z), G(x + math.cos(b) * 2.5, 12 + k * 2, z + math.sin(b) * 1.5), .16, pale, .06, 10)



def shell(x0, x1, wall, floor, ceil, door=None, h=9., back=-4.6):
    """closed theatre box: floor, back wall, side walls (door gap on the right), ceiling with beams"""
    gbox('Floor', (x0 - 2, -.6, -7), (x1 + 2, 0, 10), floor)
    gbox('Wall • back', (x0 - 1, 0, back - .5), (x1 + 1, h, back), wall)
    gbox('Wall • left', (x0 - .8, 0, -7), (x0, h, 4), wall)
    if door:
        gbox('Wall • right a', (x1, 0, -7), (x1 + .8, h, door[0]), wall); gbox('Wall • right b', (x1, 0, door[1]), (x1 + .8, h, 4), wall)
        gbox('Wall • over door', (x1, 4.4, door[0]), (x1 + .8, h, door[1]), wall)
        frame = mat('Wood • door frame', (.12, .07, .04), .5)
        gbox('Door frame', (x1 - .08, 0, door[0] - .15), (x1 + .1, 4.6, door[0]), frame, .02); gbox('Door frame', (x1 - .08, 0, door[1]), (x1 + .1, 4.6, door[1] + .15), frame, .02)
        gbox('Door frame top', (x1 - .08, 4.4, door[0] - .15), (x1 + .1, 4.6, door[1] + .15), frame, .02)
    else:
        gbox('Wall • right', (x1, 0, -7), (x1 + .8, h, 4), wall)
    gbox('Ceiling', (x0 - 1, h, -7), (x1 + 1, h + .4, 4), ceil)
    x = x0
    while x < x1:
        gbox('Ceiling beam', (x, h - .45, -6.5), (x + .35, h, 3.5), ceil, .03); x += 3.2


def chair_wood(gx, gz, wood, seat=.9, rot=0):
    parts = [box('Chair • seat', (0, 0, seat - .05), (.9, .9, .1), wood, .03, 2), box('Chair • back', (0, .4, seat + .55), (.9, .08, 1.0), wood, .03, 2)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(box('Chair • leg', (sx * .38, sy * .38, (seat - .1) / 2), (.07, .07, seat - .1), wood, .01))
    return lib.group('Chair', parts, G(gx, 0, gz), rot)


def station():
    pine = tex('knotty', (1, 1, 1), .6, **{'Coat Weight': .25})
    floor = tex('planks', (1, 1, 1), .5)
    ceil = mat('Paint • ceiling', (.08, .07, .06), .9)
    wood = mat('Wood • oak table', (.26, .14, .07), .4, **{'Coat Weight': .4})
    metal = mat('Metal • filing grey', (.32, .34, .32), .45, .6)
    cork = mat('Cork • board', (.5, .34, .18), .95)
    paper = mat('Paper • white', (.86, .84, .78), .9)
    pink = mat('Card • donut box pink', (.86, .45, .58), .7)
    donut = mat('Pastry • glazed donut', (.72, .45, .2), .35, **{'Coat Weight': .6})
    choc = mat('Pastry • chocolate', (.15, .07, .03), .35, **{'Coat Weight': .6})
    phone = mat('Bakelite • phone', (.03, .03, .03), .3)
    tube = glow('Glow • fluorescent', (.85, .95, .85), 3.)
    night = glow('Glow • window night', (.05, .1, .26), .45)
    shell(-14.5, 14.5, pine, floor, ceil, door=(-1.4, .9))
    # Lucy's desk
    gbox('Desk', (-12.6, 0, -3.6), (-9.4, 1.5, -2.2), wood, .04, 3)
    gbox('Desk • phone', (-12.2, 1.5, -3.3), (-11.6, 1.75, -2.9), phone, .05, 3)
    cyl('Desk • lamp', G(-10.2, 1.5, -3.3), G(-10.2, 2.3, -3.3), .04, metal, verts=10)
    lathe('Desk • lamp shade', [(0, 0), (.12, 0), (.35, -.3), (.05, -.05), (0, -.05)], mat('Enamel • green shade', (.05, .25, .12), .3), G(-10.2, 2.45, -3.0))
    for k in range(4):
        gbox('Desk • papers', (-11.2 + k * .08, 1.5 + k * .01, -3.2), (-10.6 + k * .08, 1.51 + k * .01, -2.7), paper)
    # conference table, chairs, donut pyramid, mugs
    gbox('Table • top', (-5, 1.45, -4.2), (5, 1.6, -2.0), wood, .04, 3)
    for tx in (-4.6, 4.6):
        for tz in (-3.9, -2.3):
            gbox('Table • leg', (tx - .12, 0, tz - .12), (tx + .12, 1.45, tz + .12), wood, .02)
    for x in (-3.5, -1, 1.5, 4):
        chair_wood(x, -1.6, wood, rot=math.pi)
    gbox('Donut box', (-1.8, 1.6, -3.6), (-.2, 1.72, -2.4), pink, .02)
    for lvl, n in ((0, 4), (1, 3), (2, 2), (3, 1)):
        for k in range(n):
            x = -1 - (n - 1) * .17 + k * .34
            bpy.ops.mesh.primitive_torus_add(major_radius=.12, minor_radius=.06, location=G(x, 1.78 + lvl * .12, -3.0))
            link(bpy.context.object, choc if (k + lvl) % 2 else donut)
    for mx in (-3.4, 2.2, 3.6):
        lathe('Coffee mug', [(0, 0), (.13, 0), (.14, .28), (.12, .28), (.11, .03), (0, .03)], paper, G(mx, 1.6, -2.6))
    # corkboard with photos and the sketch; filing cabinet
    gbox('Corkboard', (6.2, 2.0, -4.55), (10.2, 4.4, -4.45), cork, .03)
    gbox('Corkboard frame', (6.1, 1.9, -4.6), (10.3, 4.5, -4.5), wood, .03)
    for px, py, w, h2 in ((6.8, 3.6, .55, .7), (7.5, 2.6, .6, .45), (9.4, 3.7, .5, .6), (9.6, 2.5, .6, .5)):
        gbox('Pinned photo', (px - w / 2, py - h2 / 2, -4.45), (px + w / 2, py + h2 / 2, -4.42), paper)
    gbox('Sketch card', (8.0, 2.75, -4.45), (8.8, 3.7, -4.41), mat('Paper • sketch', (.92, .9, .85), .9))
    gbox('Filing cabinet', (6.5, 0, -4.4), (8.5, 2.2, -3.2), metal, .03, 2)
    for dy in (.3, 1.0, 1.7):
        gbox('Drawer handle', (7.3, dy, -3.22), (7.7, dy + .08, -3.15), mat('Metal • chrome', (.8, .8, .8), .12, 1.))
    # fluorescent fixtures, window, deer head, clock, coat rack
    for fx in (-6, 5):
        gbox('Fixture', (fx - 2, 8.3, -2.2), (fx + 2, 8.55, -.8), metal, .02); gbox('Tube', (fx - 1.9, 8.25, -1.7), (fx + 1.9, 8.32, -1.3), tube)
    gbox('Window • night', (0, 3.2, -4.6), (4, 6, -4.56), night)
    for k in range(10):
        gbox('Blind slat', (0, 6 - k * .14 - .04, -4.54), (4, 6 - k * .14, -4.48), paper, .005)
    gbox('Deer plaque', (-8.6, 5.4, -4.6), (-7.4, 6.6, -4.48), wood, .06, 3)
    sphere('Deer head', G(-8, 5.9, -4.2), (.35, .45, .35), mat('Fur • deer', (.35, .22, .12), .9), 16)
    for sx in (-1, 1):
        cyl('Antler', G(-8 + sx * .15, 6.25, -4.2), G(-8 + sx * .7, 7.2, -4.1), .05, mat('Bone • antler', (.75, .68, .55), .6), .02, 8)
    cyl('Wall clock', G(12, 6.5, -4.6), G(12, 6.5, -4.48), .5, paper, verts=32)
    cyl('Coat rack', G(-13.6, 0, -3.8), G(-13.6, 5, -3.8), .07, wood, verts=10)


def roadhouse():
    floor = tex('planks', (1, 1, 1), .4, **{'Coat Weight': .3})
    wall = mat('Paint • roadhouse blue', (.03, .04, .1), .8)
    ceil = mat('Paint • ceiling black', (.02, .02, .025), .9)
    wood = mat('Wood • bar', (.16, .07, .03), .35, **{'Coat Weight': .5})
    brass = mat('Metal • brass', (.7, .5, .2), .3, 1.)
    vinyl = mat('Vinyl • booth red', (.38, .02, .03), .35, **{'Coat Weight': .5})
    stage = mat('Wood • stage black', (.025, .02, .018), .45)
    chrome = mat('Metal • chrome', (.8, .8, .8), .12, 1.)
    bulb = glow('Glow • footlight', (1., .8, .55), 4.)
    lamp = glow('Glow • table lamp red', (1., .3, .15), 2.)
    bottles = [glow('Glow • bottle amber', (.9, .45, .1), .5), glow('Glow • bottle green', (.15, .5, .2), .5), mat('Glass • bottle clear', (.8, .85, .85), .05, **{'Transmission Weight': .9})]
    vel = velvet()
    shell(-16.5, 18.2, wall, floor, ceil, door=(-1.6, .9))
    gbox('Wainscot', (-17.5, 0, -4.6), (19, 1.6, -4.45), wood, .02)
    # bar + back shelf with bottles
    gbox('Bar • body', (-15, 0, -4.2), (-9, 1.55, -2.4), wood, .04, 3)
    gbox('Bar • top', (-15.1, 1.55, -4.25), (-8.9, 1.7, -2.3), wood, .03)
    gbox('Bar • rail', (-15, .25, -2.38), (-9, .32, -2.3), brass)
    for sx in (-14, -12.5, -11, -9.5):
        lathe('Bar stool', [(0, 0), (.3, 0), (.06, .1), (.06, .8), (.42, .82), (.42, .92), (0, .92)], chrome, G(sx, 0, -1.9))
        lathe('Bar stool seat', [(0, 0), (.42, 0), (.42, .08), (0, .1)], vinyl, G(sx, .84, -1.9))
    for k, sy in enumerate((2.6, 3.6)):
        gbox('Back shelf', (-15, sy, -4.55), (-9, sy + .08, -4.15), wood)
        for b in range(14):
            bx = -14.7 + b * .42
            cyl('Bottle', G(bx, sy + .08, -4.35), G(bx, sy + .62 + (b % 3) * .08, -4.35), .09, bottles[(b + k) % 3], .05, 10)
    # stage with velvet backdrop, footlights, mic stand
    gbox('Stage', (-3, 0, -4.6), (7, .85, -2.2), stage, .02)
    gbox('Stage lip', (-3.05, .7, -2.25), (7.05, .9, -2.1), brass, .01)
    curtain_run('Stage curtain', -3, 7, -4.5, 8.4, vel, seed=12, depth=(.25, .45))
    for k in range(9):
        sphere('Footlight', G(-2.5 + k * 1.15, .92, -2.3), (.07, .07, .07), bulb, 10)
    cyl('Mic stand', G(2, .85, -2.8), G(2, 2.5, -2.8), .02, chrome, verts=8)
    lathe('Mic stand base', [(0, 0), (.25, 0), (.2, .04), (0, .05)], chrome, G(2, .85, -2.8))
    sphere('Microphone', G(2, 2.55, -2.82), (.06, .06, .09), chrome, 12)
    # booths + table, small round tables with red lamps
    gbox('Booth seat', (10, 0, -4.2), (16, .9, -2.8), vinyl, .1, 3, 1)
    gbox('Booth back', (10, .9, -4.2), (16, 2.4, -3.7), vinyl, .15, 3, 1)
    gbox('Booth table', (10.5, 1.35, -2.8), (15.5, 1.5, -1.9), wood, .03)
    gbox('Booth table leg', (12.8, 0, -2.5), (13.2, 1.35, -2.1), chrome)
    for tx in (-6.2, 8.4):
        lathe('Round table', [(0, 0), (.4, 0), (.08, .1), (.08, 1.2), (.75, 1.22), (.75, 1.32), (0, 1.32)], wood, G(tx, 0, -3.6))
        lathe('Table lamp', [(0, 0), (.1, 0), (.07, .25), (.16, .3), (.16, .45), (0, .5)], lamp, G(tx, 1.32, -3.6))


def cabin():
    logs = tex('logs', (1, 1, 1), .85)
    floor = tex('planks', (1, 1, 1), .6)
    ceil = mat('Wood • rafters', (.09, .05, .03), .8)
    iron = mat('Iron • stove', (.04, .04, .045), .5, .6)
    fire = glow('Glow • firebox', (1., .4, .1), 3.)
    wood = mat('Wood • pine furniture', (.3, .17, .08), .55)
    bark = mat('Bark • firewood', (.2, .12, .07), .9); cut = mat('Wood • cut end', (.62, .45, .26), .8)
    jar = mat('Glass • jar', (.6, .7, .55), .05, **{'Transmission Weight': .7})
    rug = mat('Wool • braided rug', (.35, .12, .08), .95)
    night = glow('Glow • window night', (.05, .1, .26), .45)
    curtainm = mat('Cotton • gingham', (.6, .5, .38), .9)
    shell(-11, 12.8, logs, floor, ceil, door=(-1.4, .9))
    # stove with pipe and glowing firebox
    gbox('Stove', (-5.2, .3, -4.2), (-2.8, 1.8, -3.0), iron, .06, 3)
    for sx in (-5, -3):
        gbox('Stove leg', (sx - .1, 0, -4.0), (sx + .1, .3, -3.2), iron)
    gbox('Firebox glow', (-4.6, .6, -3.02), (-3.4, 1.2, -2.98), fire)
    cyl('Stove pipe', G(-4, 1.8, -3.9), G(-4, 9, -3.9), .22, iron, verts=16)
    # log pile, table, rocking chair, shelves, window
    for row in range(3):
        for k in range(4 - row):
            x = -9.6 + k * .62 + row * .31
            cyl('Firewood', G(x, .3 + row * .52, -3.6), G(x, .3 + row * .52, -1.8), .28, bark, verts=12)
            for z in (-3.6, -1.8):
                cyl('Firewood end', G(x, .3 + row * .52, z - .01), G(x, .3 + row * .52, z + .01), .27, cut, verts=12)
    gbox('Table', (5.8, 1.35, -3.8), (9.2, 1.5, -2.4), wood, .03)
    for tx in (6.1, 8.9):
        for tz in (-3.6, -2.6):
            gbox('Table leg', (tx - .08, 0, tz - .08), (tx + .08, 1.35, tz + .08), wood)
    lathe('Oil lamp base', [(0, 0), (.22, 0), (.18, .1), (.08, .2), (.12, .3), (0, .32)], mat('Metal • tin', (.5, .48, .44), .4, .7), G(7.5, 1.5, -2.9))
    for k in range(3):
        lathe('Mug', [(0, 0), (.12, 0), (.13, .25), (0, .25)], cut, G(6.3 + k * .35, 1.5, -3.5))
    rock = []
    for sx in (-1, 1):
        rock.append(cyl('Rocker', (sx * .4, -.6, .05), (sx * .4, .6, .05), .04, wood, verts=8))
        rock.append(cyl('Rocker post', (sx * .4, .45, .1), (sx * .4, .5, 1.9), .05, wood, verts=8))
    rock.append(box('Rocker seat', (0, 0, .85), (.9, .9, .08), wood, .02))
    rock.append(box('Rocker back', (0, .48, 1.5), (.9, .08, .9), wood, .02))
    lib.group('Rocking chair', rock, G(4.2, 0, -3.6), .3)
    gbox('Shelf', (-1.5, 3.2, -4.6), (2.5, 3.3, -4.2), wood)
    for k in range(6):
        cyl('Jar', G(-1.2 + k * .65, 3.3, -4.4), G(-1.2 + k * .65, 3.75, -4.4), .14, jar, verts=12)
    sphere('Owl figurine', G(2.2, 3.5, -4.4), (.16, .14, .22), mat('Ceramic • owl', (.45, .35, .25), .4, **{'Coat Weight': .6}), 16)
    for sx in (-1, 1):
        sphere('Owl eye', G(2.2 + sx * .06, 3.62, -4.27), (.04, .02, .04), mat('Ceramic • owl eye', (.9, .7, .1), .2), 8)
    gbox('Window • night', (7, 3.2, -4.6), (10, 5.6, -4.56), night)
    curtain_run('Gingham • l', 6.6, 7.6, -4.5, 5.9, curtainm, seed=3, depth=(.08, .15), width=(.18, .3), cols_per=18, rows=16, bottom=3.0)
    curtain_run('Gingham • r', 9.4, 10.4, -4.5, 5.9, curtainm, seed=4, depth=(.08, .15), width=(.18, .3), cols_per=18, rows=16, bottom=3.0)
    gbox('Rug', (-3, 0, -2.6), (4, .03, 1.2), rug, .2, 3)


def palmer():
    floral = tex('floral', (1, 1, 1), .9)
    floor = mat('Carpet • brown', (.16, .1, .07), .95)
    ceil = mat('Paint • ceiling cream', (.25, .22, .18), .9)
    wood = mat('Wood • walnut', (.15, .07, .03), .4, **{'Coat Weight': .4})
    sofa = mat('Fabric • sofa green', (.18, .22, .14), .85)
    shade = glow('Glow • lamp shade', (1., .8, .55), 1.2)
    screen = glow('Glow • tv screen', (.35, .45, .7), 1.2)
    vinyl = mat('Vinyl • record', (.02, .02, .02), .2)
    paper = mat('Paper • photo', (.85, .82, .75), .7)
    gold = mat('Metal • gilt frame', (.62, .42, .14), .32, .9)
    shell(-14.5, 16.8, floral, floor, ceil)
    gbox('Skirting', (-15, 0, -4.6), (17, .4, -4.45), wood)
    gbox('Picture rail', (-15, 6.4, -4.6), (17, 6.5, -4.45), wood)
    # sofa + armchair + lamp table
    gbox('Sofa seat', (-9.2, 0, -4.2), (-4.8, .9, -2.6), sofa, .15, 3, 1)
    gbox('Sofa back', (-9.2, .9, -4.2), (-4.8, 2.0, -3.7), sofa, .2, 3, 1)
    for sx in (-9.2, -5.3):
        gbox('Sofa arm', (sx, .9, -4.2), (sx + .5, 1.45, -2.6), sofa, .2, 3, 1)
    gbox('Lamp table', (-11.2, 0, -4), (-10, 1.4, -3), wood, .03)
    cyl('Lamp stem', G(-10.6, 1.4, -3.5), G(-10.6, 2.4, -3.5), .05, gold, verts=10)
    lathe('Lamp shade', [(0, 0), (.45, 0), (.3, .55), (0, .55)], shade, G(-10.6, 2.3, -3.5))
    # TV + record cabinet with turntable
    gbox('TV cabinet', (-3.4, 0, -4.1), (-1.6, 1.0, -3.1), wood, .04, 3)
    gbox('TV', (-3.3, 1.0, -4.0), (-1.7, 2.1, -3.2), mat('Wood • tv case', (.22, .12, .06), .5), .1, 3)
    gbox('TV screen', (-3.1, 1.15, -3.21), (-1.9, 1.95, -3.17), screen, .06)
    gbox('Record cabinet', (-1, 0, -4.2), (1, 1.3, -3.0), wood, .04, 3)
    cyl('Turntable platter', G(0, 1.3, -3.6), G(0, 1.36, -3.6), .42, wood, verts=32)
    cyl('Record', G(0, 1.36, -3.6), G(0, 1.38, -3.6), .4, vinyl, verts=32)
    cyl('Tone arm', G(.35, 1.45, -3.9), G(.1, 1.42, -3.5), .02, gold, verts=8)
    # Laura's homecoming photo on the wall
    gbox('Photo frame', (4.2, 2.6, -4.6), (5.8, 4.6, -4.5), gold, .04, 3)
    gbox('Photo', (4.4, 2.8, -4.5), (5.6, 4.4, -4.48), paper)
    # staircase, banister, landing, upstairs door (light handled by the game)
    for k in range(8):
        gbox('Stair', (7.6 + k * .55, 0, -4.2), (8.15 + k * .55, .42 * (k + 1), -1.2), wood, .02)
    gbox('Landing', (12, 0, -4.2), (16.8, 3.36, -1.2), wood, .02)
    for k in range(9):
        x = 7.8 + k * .55; y = .42 * (k + 1)
        cyl('Baluster', G(x, min(y, 3.36), -1.3), G(x, min(y, 3.36) + 1.1, -1.3), .03, wood, verts=8)
    cyl('Handrail', G(7.6, 1.5, -1.3), G(12, 4.46, -1.3), .05, wood, verts=10)
    cyl('Handrail landing', G(12, 4.46, -1.3), G(16.6, 4.46, -1.3), .05, wood, verts=10)
    gbox('Upstairs door frame', (16.2, 3.36, -3.6), (16.8, 7.6, -1.6), wood, .03)
    gbox('Upstairs dark', (16.75, 3.36, -3.4), (16.85, 7.4, -1.8), mat('Void • red dark', (.08, .005, .005), .9))


def shore():
    """S1E1 lakeshore at grey dawn: pebble beach, black lake, far firs, a boulder, an embankment up to the road"""
    peb = tex('plaster', (.55, .55, .52), .95)
    stone = mat('Rock • wet granite', (.12, .13, .13), .55)
    lake = mat('Water • black lake', (.004, .008, .012), .04, **{'Coat Weight': 1.})
    bark = tex('bark', (1, 1, 1), .95)
    needles = mat('Needles • fir', (.02, .045, .035), .9)
    planks = tex('planks', (1, 1, 1), .8)
    drift = mat('Wood • driftwood', (.42, .38, .32), .9)
    reed = mat('Reed • dry', (.32, .28, .18), .9)
    rnd = random.Random(7)
    gbox('Beach', (-18, -.6, -3.4), (25, 0, 10), peb)
    gbox('Lake', (-60, -.6, -50), (80, -.05, -3.4), lake)
    for i in range(70):   # pebbles and stones along the waterline
        x = -17 + rnd.random() * 29; z = -3.3 + rnd.random() * 1.2
        sphere('Pebble', G(x, 0, z), (.12 + rnd.random() * .25, .1 + rnd.random() * .2, .06 + rnd.random() * .1), stone, 10)
    sphere('Boulder', G(-5.4, .2, -.4), (.95, 1.6, .8), stone, 20)
    sphere('Boulder small', G(-6.6, 0, -2.4), (.6, .5, .4), stone, 16)
    for k in range(4):   # driftwood on the beach
        x = -14 + k * 4.7 + rnd.random(); z = -2.6 + rnd.random() * .8
        cyl('Driftwood', G(x, .12, z), G(x + 1.6 + rnd.random(), .14, z + rnd.random() * .5 - .25), .1 + rnd.random() * .06, drift, .04, 10)
    for i in range(30):   # reeds at the water's edge
        x = -16 + rnd.random() * 26; z = -3.5 - rnd.random() * .6
        cyl('Reed', G(x, -.1, z), G(x + rnd.random() * .3 - .15, 1.2 + rnd.random() * .9, z), .015, reed, .005, 5)
    gbox('Cliff • left', (-17, 0, -7), (-16.2, 9, 4), stone, .3, 3)
    # embankment: rough stone face, plank road on top, a guard rail
    gbox('Embankment', (12, 0, -3.4), (23, 3.1, 1.7), stone, .25, 3)
    gbox('Road planks', (12, 3.1, -3.4), (23, 3.3, 1.7), planks, .02)
    for x in (13, 15.5, 18, 20.5, 22.6):
        gbox('Rail post', (x - .08, 3.3, -3.2), (x + .08, 4.4, -3.04), drift)
    gbox('Rail', (12.6, 4.2, -3.2), (23, 4.32, -3.04), drift)
    gbox('Cliff • right', (23, 0, -7), (24, 9, 4), stone)
    # the far shore: a wall of firs and the mountain behind, swallowed by fog in the game
    x = -40
    while x < 70:
        z = -24 - rnd.random() * 8; h = 14 + rnd.random() * 9
        fir(x, z, .5 + rnd.random() * .3, h, bark, needles, rnd, low=3 + rnd.random() * 2)
        x += 2.2 + rnd.random() * 1.8
    lathe('Mountain', [(0, 0), (60, 0), (40, 12), (18, 26), (6, 30), (0, 31)], mat('Rock • far mountain', (.02, .025, .03), .95), G(10, -.5, -80), segs=10)
    # a lone fir on the near bank, left
    fir(-13.5, -4.6, .7, 20, bark, needles, rnd, low=5)


def cell():
    """S2E9 sheriff's holding cell: tile floor, green institutional paint, barred cell, cot, desk, fluorescent fittings"""
    wall = tex('plaster', (1, 1, 1), .9)
    floor = tex('checker', (1, 1, 1), .45, **{'Coat Weight': .3})
    ceil = mat('Paint • ceiling grey', (.1, .11, .1), .9)
    iron = mat('Iron • cell bars', (.04, .045, .045), .4, .7)
    steel = mat('Steel • cot frame', (.2, .21, .2), .45, .6)
    blanket = mat('Wool • grey blanket', (.12, .12, .11), .95)
    wood = mat('Wood • desk', (.16, .09, .05), .45, **{'Coat Weight': .4})
    tube = glow('Glow • fluorescent', (.85, 1., .95), 1.6)
    housing = mat('Metal • fitting', (.3, .3, .28), .5, .5)
    drain = mat('Iron • drain', (.03, .03, .03), .5, .6)
    shell(-13.4, 14.6, wall, floor, ceil, door=(-1.4, .9), h=8.4, back=-5.4)
    gbox('Wainscot', (-14, 0, -5.4), (15.4, 2.2, -5.3), mat('Paint • gloss green', (.06, .14, .1), .35))
    # cell: bars, top rail, back cot, sink, drain
    x = .2
    while x <= 8.01:
        cyl('Cell bar', G(x, 0, -1.6), G(x, 6, -1.6), .045, iron, verts=10); x += .5
    gbox('Cell rail top', (0, 5.8, -1.7), (8.2, 6.1, -1.5), iron, .02)
    gbox('Cell rail low', (0, .1, -1.7), (8.2, .25, -1.5), iron, .02)
    gbox('Cell wall l', (-.2, 0, -5.3), (0, 8.4, -1.6), wall); gbox('Cell wall r', (8.2, 0, -5.3), (8.4, 8.4, -1.6), wall)
    gbox('Cot', (3, .55, -5.2), (7, .75, -3.6), steel, .03); gbox('Cot blanket', (3.1, .75, -5.1), (6.9, .9, -3.7), blanket, .06, 3)
    for cx in (3.1, 6.9):
        for cz in (-5.1, -3.7):
            gbox('Cot leg', (cx - .05, 0, cz - .05), (cx + .05, .55, cz + .05), steel)
    lathe('Sink', [(0, 0), (.3, 0), (.38, .25), (0, .25)], mat('Ceramic • sink', (.7, .7, .66), .2), G(1.2, 1.6, -4.8))
    cyl('Drain', G(4.4, 0, -2.6), G(4.4, .01, -2.6), .2, drain, verts=16)
    # desk, chair silhouette, key hook board, filing cabinet
    gbox('Desk top', (-10, 1.5, -4.4), (-6.4, 1.6, -2.8), wood, .02)
    gbox('Desk pedestal', (-10, 0, -4.4), (-8.8, 1.5, -2.8), wood, .02); gbox('Desk pedestal', (-7.6, 0, -4.4), (-6.4, 1.5, -2.8), wood, .02)
    gbox('Desk lamp', (-7.4, 1.6, -4.1), (-7, 2.2, -3.8), housing, .05, 3)
    gbox('Ledger', (-9.4, 1.6, -3.8), (-8.4, 1.66, -3.1), mat('Paper • ledger', (.6, .55, .45), .8))
    gbox('Key board', (-2.3, 3.0, -5.3), (-.9, 4.3, -5.2), wood, .02)
    gbox('Filing cabinet', (-12.8, 0, -5.2), (-11.4, 3.2, -4.0), steel, .03, 3)
    for k in range(4):
        gbox('Drawer pull', (-12.3, .5 + k * .75, -3.99), (-11.9, .58 + k * .75, -3.95), housing)
    # fluorescent fittings (the game supplies the light and the flicker)
    for fx in (-8, 4, 11):
        gbox('Fitting', (fx - 1.7, 7.75, -2.3), (fx + 1.7, 7.9, -1.8), housing, .02)
        cyl('Fitting chain', G(fx, 7.9, -2.05), G(fx, 8.4, -2.05), .015, housing, verts=6)
    # sprinkler heads along the ceiling
    for sx in (-10, -4, 2, 8, 13):
        cyl('Sprinkler', G(sx, 8.4, -.5), G(sx, 8.1, -.5), .05, mat('Metal • brass', (.6, .45, .2), .35, .9), verts=10)
    # the corridor door frame glows faintly from the night outside (light handled in game)
    gbox('Exit sign', (13.6, 5.4, -.4), (14.4, 5.8, -.3), glow('Glow • exit sign', (1., .15, .08), 2.))


def finalize_and_bake():
    for o in bpy.context.selected_objects:
        o.select_set(False)
    objs = [o for o in bpy.context.scene.objects if o.type in ('MESH', 'FONT')]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target='MESH')
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    # world-scaled box UVs (4 m per tile) so the game's repeating canvas textures keep their size
    for o in meshes:
        me = o.data
        if not me.uv_layers:
            me.uv_layers.new(name='UVMap')
        uv = me.uv_layers.active.data; mw = o.matrix_world; nm = mw.to_3x3()
        for p in me.polygons:
            n = (nm @ p.normal); ax = max(range(3), key=lambda i: abs(n[i]))
            for li in p.loop_indices:
                w = mw @ me.vertices[me.loops[li].vertex_index].co
                u, v = [(w.y, w.z), (w.x, w.z), (w.x, -w.y)][ax]
                uv[li].uv = (u / 4, v / 4)
        if 'AO' not in me.color_attributes:
            me.color_attributes.new('AO', 'BYTE_COLOR', 'POINT')
        me.color_attributes.active_color = me.color_attributes['AO']
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
    s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.samples = SAMPLES
    s.world = s.world or bpy.data.worlds.new('W'); s.world.light_settings.distance = 1.6
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    for o in meshes:   # lamps and glass must not be darkened
        if any(ms.material and ('Glow' in ms.material.name or 'Glass' in ms.material.name) for ms in o.material_slots):
            for d in o.data.color_attributes['AO'].data:
                d.color = (1, 1, 1, 1)


lib.reset(SET)
globals()[SET]()
finalize_and_bake()
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT / f'{SET}.glb'), export_format='GLB', use_selection=False, export_apply=True,
                          export_vertex_color='ACTIVE', export_extras=False, export_lights=False, export_cameras=False)
print('SET_DONE', SET, flush=True)
