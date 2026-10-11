# Ten Twin Peaks miniature sets in one visual language: black display box, flat colour blocks,
# few bevelled forms, everything shaped to be lit by a single hard key. Coordinates are Blender (Z up).
import math, random
from lib import *

P = {}  # palette cache


def m(name, c, r=.6, metal=0., **kw):
    return mat(name, c, r, metal, **kw)


# Each builder returns: cast [(name, x, y, rot, extra)], hotspots [3 xyz], practicals [{pos, color, power}], key {pos, target}
def redroom():
    display_box('THE WAITING ROOM')
    chevron_floor(m('Floor • ivory enamel', (.82, .8, .74), .3), m('Floor • black enamel', (.008, .008, .009), .3))
    vel = velvet()
    curtain('Velvet curtain • back', X1 - .1 - LEFT_X, lambda u, d, z: (LEFT_X + u, BACK_Y - d, z), vel, seed=7)
    curtain('Velvet curtain • left', BACK_Y - (Y0 + .12), lambda u, d, z: (LEFT_X + d, BACK_Y - .12 - u, z), vel, cols=230, seed=23)
    leather = m('Leather • club chair', (.014, .016, .017), .36, **{'Coat Weight': .35, 'Coat Roughness': .22})
    oxblood = m('Leather • oxblood piping', (.16, .012, .014), .34)
    steel = m('Metal • brushed pewter', (.40, .41, .42), .38, .85)
    blk = m('Lacquer • table top', (.012, .013, .014), .28)
    W, D = 1.32, 1.12
    parts = [box('Chair • plinth', (0, 0, .3), (W - .1, D - .08, .34), leather, .07, 3, 1),
             box('Chair • seat cushion', (0, -.07, .55), (W - .5, D - .3, .2), leather, .07, 3, 2)]
    back = box('Chair • barrel back', (0, D / 2 - .15, .8), (W - .1, .3, .9), leather, .13, 3, 0)
    bend = back.modifiers.new('Barrel', 'SIMPLE_DEFORM'); bend.deform_method = 'BEND'; bend.angle = math.radians(-38); bend.deform_axis = 'Z'
    sub = back.modifiers.new('Plump', 'SUBSURF'); sub.levels = sub.render_levels = 2
    for poly in back.data.polygons: poly.use_smooth = True
    parts.append(back)
    for s in (-1, 1):
        parts.append(box('Chair • rolled arm', (s * (W / 2 - .14), -.04, .58), (.3, D - .04, .64), leather, .14, 3, 2))
        parts.append(box('Chair • oxblood inlay', (s * (W / 2 - .13), -D / 2 + .005, .5), (.09, .05, .5), oxblood, .02, 2, 1))
    group('Club chair', parts, (.45, .95, 0), math.radians(14))
    t = [box('Table • top', (0, 0, .82), (.66, .66, .05), blk, .012, 3)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            t.append(box('Table • leg', (sx * .3, sy * .3, .45), (.035, .035, .72), steel, .004, 1))
    for z in (.14, .5):
        for s in (-1, 1):
            t.append(box('Table • stretcher', (0, s * .3, z), (.6, .03, .03), steel, .004, 1))
            t.append(box('Table • stretcher', (s * .3, 0, z), (.03, .6, .03), steel, .004, 1))
    group('Deco side table', t, (-.85, 1.0, 0))
    mint, sage, ivory = m('Ceramic • Saturn mint', (.36, .55, .27), .45), m('Ceramic • sage', (.17, .32, .13), .45), m('Ceramic • ring', (.78, .74, .6), .4)
    lp = [lathe('Saturn • foot', [(0, 0), (.13, 0), (.11, .045), (0, .05)], sage, (0, 0, 0))]
    z = .045
    for k, r in enumerate([.1, .088, .076, .064, .054]):
        lp.append(lathe('Saturn • rib', [(0, 0), (r * .8, 0), (r, .022), (r, .04), (r * .8, .062), (0, .062)], mint if k % 2 else sage, (0, 0, z))); z += .058
    lp.append(sphere('Saturn • planet', (0, 0, z + .23), (.17, .17, .17), mint))
    bpy.ops.mesh.primitive_torus_add(major_radius=.28, minor_radius=.075, major_segments=64, minor_segments=12, location=(0, 0, z + .23))
    ring = link(bpy.context.object, ivory); ring.scale = (1, 1, .16); ring.rotation_euler = (math.radians(-26), math.radians(14), 0); lp.append(ring)
    group('Saturn lamp', lp, (-.85, 1.0, .845))
    fl = [lathe('Lamp • base', [(0, 0), (.22, 0), (.2, .05), (.05, .07), (0, .07)], steel, (0, 0, FLOOR_Z)),
          cyl('Lamp • stem', (0, 0, FLOOR_Z + .06), (0, 0, 2.72), .022, steel, verts=16),
          lathe('Lamp • shade', [(0, 0), (.04, 0), (.25, .42), (.265, .43), (.04, .08), (0, .08)], steel, (0, 0, 2.72))]
    group('Torchiere', fl, (1.75, 1.85, 0))
    return dict(cast=[('Laura Palmer', -1.95, -.55, .38, {}), ('Dale Cooper', 2.05, -.7, -.42, {})],
                hotspots=[(-1.95, -.55, 1.6), (0, -.6, .1), (2.05, -.7, 1.65)],
                practicals=[{'pos': (1.75, 1.85, 3.0), 'color': '#ffe2c0', 'power': 6}],
                key={'pos': (4.5, -5.5, 8.5), 'target': (.2, .3, .3), 'color': '#fff0e0'})


def shore():
    display_box('THE LAKESHORE', side_wall=False, floor=m('Ground • wet slate', (.035, .045, .05), .85))
    water = m('Water • black lake', (.004, .008, .01), .04, **{'Specular IOR Level': .8})
    box('Lake', (1.1, -.6, FLOOR_Z + .01), (4.7, 3.6, .02), water, .3, 4)
    shingle = m('Rock • shingle', (.09, .1, .1), .9)
    rnd = random.Random(2)
    for i in range(26):
        x = -1.35 + rnd.gauss(0, .12); y = -2.3 + i * .17
        sphere('Shore stone', (x, y, FLOOR_Z + .02), (rnd.uniform(.07, .16), rnd.uniform(.06, .12), .04), shingle, 12)
    wood = m('Wood • weathered grey', (.16, .15, .13), .8)
    for j in range(10):
        box('Pier plank', (.2 + j * .3, -1.4, .3), (.27, .9, .05), wood, .008, 1)
    for x in (.2, 1.4, 2.8):
        for y in (-1.8, -1.0):
            cyl('Piling', (x, y, FLOOR_Z), (x, y, .36), .05, wood, verts=10)
    dark, light, trunk = m('Fir • black green', (.012, .03, .022), .9), m('Fir • deep green', (.02, .05, .035), .9), m('Bark', (.04, .03, .025), .9)
    for x, y, h in [(-3.0, 1.9, 3.7), (-2.2, 2.1, 3.1), (-1.2, 2.0, 3.9), (-.1, 2.2, 3.3), (1.0, 2.0, 3.6), (2.1, 2.2, 3.0), (3.1, 1.9, 3.8), (-3.1, .6, 2.6), (3.2, .5, 2.8)]:
        pine(x, y, h, dark, light, trunk)
    mill = m('Paint • mill rust', (.17, .05, .03), .8)
    box('Sawmill shed', (-2.5, 1.0, .75), (1.3, .9, 1.35), mill, .02)
    box('Sawmill roof', (-2.5, 1.0, 1.5), (1.5, 1.05, .1), m('Tin • roof', (.08, .08, .08), .5, .6), .02)
    # Laura's homecoming portrait on an easel: the image is a blank silver frame.
    frame = m('Metal • frame silver', (.6, .6, .58), .3, .9)
    group('Homecoming frame', [box('Frame', (0, 0, 1.05), (.5, .04, .62), frame, .01),
                               box('Frame glass', (0, -.025, 1.05), (.42, .01, .54), m('Glass • photo', (.7, .68, .62), .2), .002),
                               cyl('Easel leg', (-.2, .1, FLOOR_Z), (-.12, 0, 1.3), .015, wood, verts=8),
                               cyl('Easel leg', (.2, .1, FLOOR_Z), (.12, 0, 1.3), .015, wood, verts=8)], (-2.5, -1.4, 0), .5)
    # Telephone post by the mill.
    group('Phone post', [cyl('Post', (0, 0, FLOOR_Z), (0, 0, 1.7), .05, wood, verts=10),
                         box('Phone box', (0, -.08, 1.2), (.22, .1, .34), m('Paint • phone black', (.01, .01, .01), .4), .02)], (-1.5, .7, 0))
    return dict(cast=[('Pete Martell', -.9, -.6, .5, {})],
                hotspots=[(.6, -.4, .2), (-2.5, -1.4, 1.1), (-1.5, .62, 1.25)],
                practicals=[], fog='#0b1214',
                key={'pos': (-5, -3, 7), 'target': (0, 0, 0), 'color': '#cfe2ee'})


def diner():
    teal = m('Paint • diner teal', (.03, .11, .1), .7)
    display_box('DOUBLE R DINER', wall=teal)
    cream, black = m('Tile • cream', (.66, .6, .48), .4), m('Tile • black', (.012, .012, .012), .35)
    for r in range(11):
        for c in range(14):
            box('Checker tile', (X0 + .3 + c * .5, Y0 + .3 + r * .48, FLOOR_Z), (.49, .47, .016), cream if (r + c) % 2 else black, .004, 1)
    counter, top, red, chrome = m('Paint • counter cream', (.55, .48, .36), .6), m('Formica • teal top', (.05, .16, .14), .3), m('Vinyl • cherry red', (.3, .015, .02), .45), m('Metal • chrome', (.6, .6, .6), .2, 1.)
    box('Counter body', (-1.9, .3, .6), (1.0, 3.6, 1.0), counter, .05)
    box('Counter top', (-1.9, .3, 1.14), (1.25, 3.8, .09), top, .03)
    for y in (-1.0, -.1, .8, 1.7):
        cyl('Stool stem', (-1.1, y, FLOOR_Z), (-1.1, y, .7), .035, chrome, verts=12)
        cyl('Stool seat', (-1.1, y, .7), (-1.1, y, .82), .23, red, verts=28)
    for y, sgn in ((.55, -1), (2.05, 1)):
        box('Booth seat', (2.4, y, .5), (1.9, .62, .28), red, .06, 2, 1)
        box('Booth back', (2.4, y + .3 * sgn, .95), (1.9, .18, .95), red, .06, 2, 1)
    box('Booth table', (2.4, 1.3, 1.0), (1.7, .7, .07), top, .02)
    cyl('Table stem', (2.4, 1.3, FLOOR_Z), (2.4, 1.3, 1.0), .05, chrome, verts=12)
    white = m('Ceramic • white cup', (.8, .78, .72), .3)
    coffee = m('Coffee • black', (.02, .008, .004), .1)
    for x, y, z in [(-1.75, -.6, 1.19), (2.2, 1.25, 1.04)]:
        cyl('Cup', (x, y, z), (x, y, z + .16), .07, white, .08, 24)
        cyl('Coffee', (x, y, z + .14), (x, y, z + .155), .066, coffee, verts=24)
    lathe('Pie', [(0, 0), (.26, 0), (.28, .07), (.24, .1), (0, .1)], m('Pastry • cherry pie', (.35, .1, .04), .7), (-1.95, .7, 1.19))
    box('Jukebox', (2.9, -1.6, .7), (.7, .55, 1.25), m('Wood • jukebox walnut', (.12, .05, .02), .5), .1, 3)
    box('Jukebox glow', (2.9, -1.88, .8), (.5, .02, .55), glow('Glow • jukebox amber', (1., .45, .12), 3.), .05)
    text('DOUBLE R', (0, BACK_Y - .02, 3.3), .32, glow('Glow • neon red', (1., .08, .05), 6.), extrude=.01)
    for x in (-1.6, 1.4):
        cyl('Pendant cord', (x, .8, WALL_H), (x, .8, 3.0), .01, black, verts=6)
        lathe('Pendant shade', [(0, 0), (.05, 0), (.3, -.25), (.05, -.02)], cream, (x, .8, 3.0))
    return dict(cast=[('Dale Cooper', -.2, -.7, -.3, {}), ('Audrey Horne', 1.0, .2, .3, {})],
                hotspots=[(-1.75, -.6, 1.35), (1.0, .2, 1.55), (2.9, -1.6, 1.1)],
                practicals=[{'pos': (-1.6, .8, 2.8), 'color': '#ffcf8a', 'power': 5}, {'pos': (1.4, .8, 2.8), 'color': '#ffcf8a', 'power': 5}, {'pos': (2.9, -1.95, .9), 'color': '#ff8a33', 'power': 3}],
                key={'pos': (4, -6, 7.5), 'target': (0, 0, .5), 'color': '#ffe6c8'})


def stones():
    display_box('THE TIBETAN METHOD', side_wall=False, floor=m('Ground • moss black', (.02, .035, .025), .95))
    dark, light, trunk = m('Fir • black green', (.012, .03, .022), .9), m('Fir • deep green', (.02, .05, .035), .9), m('Bark', (.04, .03, .025), .9)
    for x, y, h in [(-3.0, 2.0, 3.9), (-1.8, 2.2, 3.4), (-.6, 2.1, 4.0), (.7, 2.2, 3.5), (1.9, 2.0, 3.9), (3.1, 2.1, 3.3), (-3.2, .2, 3.0), (3.2, .4, 3.1), (-3.2, -1.5, 2.4)]:
        pine(x, y, h, dark, light, trunk)
    wood = m('Wood • raw stump', (.12, .08, .05), .8)
    cyl('Stump', (-1.4, .8, FLOOR_Z), (-1.4, .8, .62), .28, wood, .3, 20)
    lathe('Glass bottle', [(0, 0), (.06, 0), (.065, .18), (.03, .26), (.022, .34), (0, .34)], m('Glass • green bottle', (.05, .2, .1), .05, **{'Transmission Weight': .8}), (-1.4, .8, .62))
    board = m('Paint • chalkboard', (.02, .03, .028), .9)
    group('Chalkboard', [box('Board', (0, 0, 1.4), (1.6, .06, 1.0), board, .02),
                         box('Board frame', (0, .02, 1.4), (1.7, .05, 1.1), wood, .02),
                         cyl('Leg', (-.7, .2, FLOOR_Z), (-.7, 0, 1.9), .03, wood, verts=8), cyl('Leg', (.7, .2, FLOOR_Z), (.7, 0, 1.9), .03, wood, verts=8)], (.6, 1.4, 0), -.1)
    text('BOB?', (.6, 1.36, 1.62), .14, m('Chalk', (.8, .8, .76), .9), rot=(math.pi / 2, 0, -.1))
    text('J · L · ...', (.6, 1.36, 1.32), .11, m('Chalk', (.8, .8, .76), .9), rot=(math.pi / 2, 0, -.1))
    pail = m('Metal • tin pail', (.3, .3, .29), .4, .8)
    lathe('Bucket', [(0, 0), (.2, 0), (.24, .38), (.22, .38), (.18, .03), (0, .03)], pail, (.2, -.9, FLOOR_Z))
    rock = m('Rock • river stone', (.13, .14, .14), .7)
    rnd = random.Random(6)
    for i in range(8):
        sphere('River stone', (.2 + rnd.gauss(0, .06), -.9 + rnd.gauss(0, .06), .38 + rnd.random() * .05), (.06, .05, .04), rock, 12)
    return dict(cast=[('Dale Cooper', -.3, -.5, -.25, {}), ('Harry Truman', 1.6, -.3, -.4, {})],
                hotspots=[(.2, -.9, .5), (-1.4, .8, .9), (1.6, -.3, 1.7)],
                practicals=[], fog='#07100b',
                key={'pos': (3, -4, 9), 'target': (0, 0, 0), 'color': '#e8f0d8'})


def hotel():
    wood = m('Wood • knotty pine panel', (.22, .11, .05), .6)
    display_box('THE GREAT NORTHERN', wall=wood)
    plank_floor(m('Wood • floor dark', (.07, .035, .02), .5), m('Wood • floor darker', (.05, .025, .015), .5))
    rug = m('Wool • rug burgundy', (.18, .03, .03), .95)
    box('Rug', (.3, -.2, FLOOR_Z + .015), (3.2, 2.2, .012), rug, .01)
    bed, linen = m('Wood • bed walnut', (.09, .04, .02), .5), m('Linen • white', (.75, .72, .66), .85)
    box('Bed frame', (1.9, 1.3, .35), (1.8, 2.2, .45), bed, .04)
    box('Mattress', (1.9, 1.25, .66), (1.7, 2.0, .2), linen, .06, 2, 1)
    box('Headboard', (1.9, 2.35, 1.0), (1.9, .12, 1.3), bed, .04)
    box('Nightstand', (.65, 2.0, .38), (.5, .45, .6), bed, .03)
    gold = m('Metal • gold ring', (.9, .6, .2), .2, 1.)
    bpy.ops.mesh.primitive_torus_add(major_radius=.05, minor_radius=.012, location=(.65, 1.95, .7))
    link(bpy.context.object, gold).rotation_euler = (math.radians(70), 0, 0)
    lathe('Lamp base', [(0, 0), (.09, 0), (.05, .3), (0, .3)], gold, (.75, 2.1, .68))
    lathe('Lamp shade', [(0, 0), (.2, 0), (.13, .22), (0, .22)], m('Paper • lamp shade', (.8, .7, .5), .9), (.75, 2.1, .95))
    # door frame in the left wall, slightly ajar onto a lit corridor
    door = m('Paint • door cream', (.6, .55, .45), .6)
    box('Door frame', (LEFT_X + .05, .2, 1.35), (.12, 1.2, 2.6), door, .02)
    box('Door gap light', (LEFT_X + .02, .2, 1.3), (.04, .95, 2.45), glow('Glow • corridor', (1., .8, .55), 2.5))
    box('Door leaf', (LEFT_X + .35, -.35, 1.3), (.06, .9, 2.4), door, .02, rot=(0, 0, math.radians(-40)))
    return dict(cast=[('Dale Cooper', -.6, -.6, 1.2, {'lying': True}), ('The Giant', 1.0, .1, -.2, {})],
                hotspots=[(1.0, .1, 2.6), (.65, 1.95, .75), (LEFT_X + .1, .2, 1.4)],
                practicals=[{'pos': (.75, 2.1, 1.05), 'color': '#ffc27a', 'power': 4}, {'pos': (LEFT_X + .3, .2, 1.4), 'color': '#ffd9a0', 'power': 6}],
                key={'pos': (1.2, -1.2, 7.5), 'target': (1.0, .1, 1.0), 'color': '#f4f0ff'})


def roadhouse():
    blue = m('Paint • roadhouse midnight', (.012, .016, .04), .8)
    display_box('THE ROADHOUSE', wall=blue)
    plank_floor(m('Wood • dance floor', (.06, .04, .03), .45), m('Wood • dance floor dark', (.045, .03, .022), .45))
    vel = velvet()
    curtain('Stage curtain', 4.8, lambda u, d, z: (-2.4 + u, BACK_Y - d, z), vel, cols=200, rows=40, seed=31, bottom=.62, top=3.6)
    stage = m('Wood • stage black', (.02, .015, .012), .5)
    box('Stage', (0, 1.6, .35), (5.2, 1.7, .55), stage, .02)
    chrome = m('Metal • chrome', (.6, .6, .6), .2, 1.)
    cyl('Mic stand', (0, 1.2, .62), (0, 1.2, 1.9), .012, chrome, verts=8)
    sphere('Mic', (0, 1.17, 1.93), (.04, .04, .06), chrome, 16)
    table, red = m('Formica • table black', (.02, .02, .02), .3), m('Vinyl • booth red', (.25, .02, .02), .5)
    shade = glow('Glow • table lamp', (1., .5, .25), 2.)
    for x, y in [(-2.1, -1.2), (-.2, -1.6), (1.8, -1.0)]:
        cyl('Round table', (x, y, .9), (x, y, .96), .45, table, verts=32)
        cyl('Table stem', (x, y, FLOOR_Z), (x, y, .9), .04, chrome, verts=10)
        lathe('Table lamp', [(0, 0), (.06, 0), (.04, .16), (0, .16)], shade, (x, y, .96))
    lathe('Beer glass', [(0, 0), (.04, 0), (.05, .18), (0, .18)], m('Glass • amber beer', (.4, .2, .05), .05, **{'Transmission Weight': .6}), (-2.0, -1.35, .96))
    return dict(cast=[('The Giant', 0, 1.6, 0, {'z': .62}), ('Dale Cooper', 1.4, -1.6, .35, {})],
                hotspots=[(0, 1.6, 2.9), (1.4, -1.6, 1.7), (-2.1, -1.2, 1.15)],
                practicals=[{'pos': (-2.1, -1.2, 1.15), 'color': '#ff9a55', 'power': 2.5}, {'pos': (-.2, -1.6, 1.15), 'color': '#ff9a55', 'power': 2.5}, {'pos': (1.8, -1.0, 1.15), 'color': '#ff9a55', 'power': 2.5}],
                key={'pos': (0, -1.5, 8), 'target': (0, 1.6, .6), 'color': '#c9d6ff'})


def cell():
    concrete = m('Concrete • cold grey', (.09, .1, .11), .9)
    display_box('THE LAST CONFESSION', wall=concrete, floor=m('Concrete • wet floor', (.03, .035, .04), .15))
    bars = m('Metal • cell bars', (.03, .03, .03), .45, .8)
    for i in range(16):
        x = -3.2 + i * .3
        if -.15 < x < .45:
            continue
        cyl('Cell bar', (x, -.6, FLOOR_Z), (x, -.6, 3.4), .025, bars, verts=10)
    box('Bar rail', (0, -.6, 3.4), (6.6, .06, .08), bars, .01)
    box('Bar rail', (0, -.6, .3), (6.6, .06, .06), bars, .01)
    box('Cot', (-1.6, 1.8, .45), (2.0, .75, .12), m('Metal • cot', (.12, .13, .13), .6, .5), .02)
    box('Cot blanket', (-1.6, 1.8, .53), (1.9, .7, .06), m('Wool • grey blanket', (.15, .15, .16), .95), .02)
    cyl('Sprinkler pipe', (-3.3, 1.0, 3.6), (3.4, 1.0, 3.6), .04, bars, verts=10)
    cyl('Sprinkler head', (.9, 1.0, 3.6), (.9, 1.0, 3.45), .05, bars, .08, 12)
    rain = m('Water • falling', (.6, .7, .75), .05, **{'Transmission Weight': .9})
    rnd = random.Random(12)
    for i in range(40):
        x = .9 + rnd.gauss(0, .35); y = 1.0 + rnd.gauss(0, .3)
        top = rnd.uniform(2.0, 3.4)
        cyl('Water streak', (x, y, top - rnd.uniform(.3, .9)), (x, y, top), .004, rain, verts=4)
    return dict(cast=[('Leland Palmer', .9, 1.0, -.2, {}), ('Dale Cooper', .3, -.15, -.5, {})],
                hotspots=[(.9, 1.0, 1.7), (.3, -.15, 1.65), (-1.6, 1.8, .6)],
                practicals=[], fog='#0a0d10',
                key={'pos': (.9, 1.0, 7.5), 'target': (.9, 1.0, 0), 'color': '#dfe9ff'})


def cave():
    rock = m('Rock • umber cave', (.07, .045, .03), .95)
    display_box('OWL CAVE', wall=m('Rock • cave wall', (.05, .033, .022), .95), floor=m('Rock • cave floor', (.04, .028, .02), .95))
    rnd = random.Random(8)
    for i in range(40):
        a = rnd.random() * math.pi; r = rnd.uniform(2.6, 3.3)
        x = -r * math.cos(a) * 1.1; y = 2.3 - abs(math.sin(a)) * rnd.uniform(.0, .5)
        sphere('Cave boulder', (x, y, rnd.uniform(.3, 3.6)), (rnd.uniform(.4, .8), rnd.uniform(.3, .5), rnd.uniform(.4, .9)), rock, 14)
    slab = m('Rock • petroglyph slab', (.11, .075, .05), .9)
    box('Petroglyph slab', (0, 2.1, 1.8), (2.6, .35, 2.8), slab, .15, 3)
    carve = glow('Glow • carved lines', (1., .55, .25), 1.6)
    pts = lambda L: [(x, 1.91, z) for x, z in L]
    for path in [[(-.9, 2.8), (-.4, 2.4), (0, 2.6), (.4, 2.4), (.9, 2.8)], [(0, 2.55), (0, 1.0), (-.4, .7)], [(-.6, 2.0), (-.3, 1.7), (-.5, 1.2)], [(.6, 2.0), (.3, 1.7), (.5, 1.2)], [(-.8, 1.0), (.8, 1.0)]]:
        P_ = pts(path)
        for a, b in zip(P_[:-1], P_[1:]):
            cyl('Carved line', a, b, .022, carve, verts=8)
    for x, z in ((-.35, 2.45), (.35, 2.45)):
        bpy.ops.mesh.primitive_torus_add(major_radius=.12, minor_radius=.02, location=(x, 1.91, z), rotation=(math.pi / 2, 0, 0))
        link(bpy.context.object, carve)
    lantern = glow('Glow • lantern', (1., .6, .3), 3.)
    lathe('Lantern', [(0, 0), (.1, 0), (.1, .05), (.07, .25), (.03, .3), (0, .3)], m('Metal • lantern', (.1, .09, .08), .5, .7), (-1.6, -.6, FLOOR_Z))
    sphere('Lantern flame', (-1.6, -.6, FLOOR_Z + .16), (.05, .05, .07), lantern, 12)
    box('Chess piece', (2.2, .8, .25), (.08, .08, .3), m('Ivory • chess', (.8, .76, .66), .4), .03, 2, 1)
    return dict(cast=[('Dale Cooper', -.2, .3, -.1, {}), ('Harry Truman', 1.4, -.2, .2, {})],
                hotspots=[(0, 1.9, 1.9), (1.4, -.2, 1.7), (2.2, .8, .45)],
                practicals=[{'pos': (-1.6, -.6, .4), 'color': '#ffa050', 'power': 5}],
                key={'pos': (-3, -4, 6), 'target': (0, 1.8, 1.4), 'color': '#ffd7a8'})


def grove():
    display_box('GLASTONBURY GROVE', side_wall=False, floor=m('Ground • night moss', (.015, .022, .016), .95))
    bark = m('Bark • sycamore pale', (.55, .52, .44), .85)
    for i in range(12):
        a = i / 12 * 2 * math.pi
        x, y = 2.0 * math.cos(a) * 1.25, .4 + 1.6 * math.sin(a)
        cyl('Sycamore', (x, y, FLOOR_Z), (x + .1 * math.cos(a), y, 3.9), .14, bark, .08, 12)
        cyl('Sycamore bough', (x, y, 3.2), (x + .5 * math.cos(a), y + .4 * math.sin(a), 3.9), .05, bark, .02, 8)
    oil = m('Oil • black pool', (.002, .002, .002), .02, **{'Specular IOR Level': 1.})
    sphere('Oil pool', (0, .4, FLOOR_Z), (1.0, .7, .03), oil, 48)
    vel = velvet()
    curtain('Grove curtain', 3.2, lambda u, d, z: (-1.6 + u + 0 * d, 1.75 + d * .6 - .3 * math.sin(u / 3.2 * math.pi), z), vel, cols=140, rows=36, seed=5, top=3.4)
    return dict(cast=[('Dale Cooper', .2, -.65, math.pi, {}), ('Harry Truman', 2.4, -1.5, .5, {})],
                hotspots=[(0, .4, .15), (.2, -.65, 1.65), (2.4, -1.5, 1.7)],
                practicals=[], fog='#05080a',
                key={'pos': (0, -2.5, 8), 'target': (0, .6, 0), 'color': '#e8eeff'})


def mirror():
    tile = m('Tile • sick green', (.32, .38, .3), .3)
    display_box('WHO CAME BACK?', wall=tile, floor=m('Tile • floor grey', (.2, .2, .19), .35))
    for z in [k * .3 + .3 for k in range(12)]:
        box('Grout line', (0, BACK_Y - .005, z), (X1 - X0, .01, .015), m('Grout', (.08, .09, .08), .9))
    porcelain = m('Porcelain • basin', (.75, .74, .7), .2)
    box('Basin', (-.35, 2.15, .95), (1.3, .6, .22), porcelain, .08, 3, 1)
    cyl('Basin pedestal', (-.35, 2.2, FLOOR_Z), (-.35, 2.2, .85), .14, porcelain, .1, 20)
    chrome = m('Metal • chrome', (.6, .6, .6), .2, 1.)
    cyl('Faucet', (-.35, 2.35, 1.06), (-.35, 2.2, 1.2), .02, chrome, verts=10)
    # The mirror is an opening into a darker, reversed room where BOB waits.
    box('Mirror frame top', (-.35, BACK_Y - .02, 2.85), (1.5, .08, .08), chrome, .01)
    box('Mirror frame bottom', (-.35, BACK_Y - .02, 1.2), (1.5, .08, .08), chrome, .01)
    for x in (-1.1, .4):
        box('Mirror frame side', (x, BACK_Y - .02, 2.02), (.08, .08, 1.73), chrome, .01)
    box('Mirror glass', (-.35, BACK_Y, 2.02), (1.42, .01, 1.62), m('Glass • mirror haze', (.4, .45, .45), .05, **{'Transmission Weight': .92}))
    box('Reverse room', (-.35, BACK_Y + 1.1, 1.8), (2.4, 2.0, 3.0), m('Paint • void', (.008, .01, .01), .9))
    box('Medicine shelf', (1.4, 2.3, 1.7), (.8, .2, .05), porcelain, .01)
    box('VHS cassette', (1.25, 2.28, 1.78), (.24, .14, .05), m('Plastic • tape black', (.01, .01, .01), .4), .005)
    box('Note card', (1.6, 2.28, 1.83), (.18, .02, .12), m('Paper • note', (.8, .78, .7), .9), .003)
    cyl('Bare bulb cord', (-.35, 1.2, WALL_H), (-.35, 1.2, 3.5), .01, chrome, verts=6)
    sphere('Bare bulb', (-.35, 1.2, 3.45), (.06, .06, .08), glow('Glow • bare bulb', (1., .9, .7), 5.), 16)
    return dict(cast=[('Dale Cooper', -.35, 1.3, math.pi, {}), ('BOB', -.35, BACK_Y + .8, math.pi, {})],
                hotspots=[(-.35, BACK_Y, 2.1), (1.6, 2.25, 1.85), (1.25, 2.25, 1.8)],
                practicals=[{'pos': (-.35, 1.2, 3.4), 'color': '#fff1d0', 'power': 8}],
                key={'pos': (2.5, -4, 6), 'target': (-.35, 1.6, 1.5), 'color': '#e9ffe8'})


SETS = {'shore': shore, 'diner': diner, 'stones': stones, 'redroom': redroom, 'hotel': hotel,
        'roadhouse': roadhouse, 'cell': cell, 'cave': cave, 'grove': grove, 'mirror': mirror}
