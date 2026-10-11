# Glazed ceramic figurines (Twin Peaks), after the "Twin Peaks figurine set" look:
# big round head, closed painted eyes, rosy cheeks, chunky glossy clothes.
# Parts are modelled as rounded primitives, voxel-remeshed into ONE watertight surface (no clipping possible),
# smoothed into soft ceramic fillets, coloured from the nearest part, face painted into vertex colours,
# rigged with the game skeleton names. Run: blender -b --python figurine.py -- --only=cooper [--render]
import bpy, bmesh, sys, math
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

R = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = next((a.split('=')[1].split(',') for a in ARGS if a.startswith('--only=')), None)
RENDER = '--render' in ARGS
QUICK = '--quick' in ARGS
VOXEL = float(next((a.split('=')[1] for a in ARGS if a.startswith('--voxel=')), .0042))

PAL = {
    'skin': (.94, .80, .70), 'cheek': (.95, .36, .34), 'ink': (.03, .025, .028), 'hair_black': (.035, .03, .035),
    'suit_black': (.018, .018, .022), 'shirt': (.94, .94, .92), 'shirt_blue': (.62, .74, .86), 'tie': (.06, .05, .07), 'tie_stripe': (.82, .6, .12),
    'shoe': (.01, .01, .012), 'blonde': (.9, .7, .3), 'dress_black': (.02, .018, .024), 'grey_hair': (.66, .64, .6),
    'denim': (.18, .25, .38), 'denim_dark': (.11, .14, .22), 'giant_suit': (.2, .19, .17), 'red_suit': (.78, .06, .05),
    'lips': (.8, .18, .2), 'stubble': (.62, .52, .48), 'gold': (.85, .62, .2),
    'brown_hair': (.2, .1, .05), 'auburn': (.42, .12, .05), 'red_hair': (.6, .16, .06), 'white_hair': (.9, .9, .88), 'dark_brown': (.08, .045, .03),
    'sheriff_tan': (.55, .43, .27), 'sheriff_brown': (.22, .14, .08), 'leather': (.035, .03, .03), 'waitress_blue': (.36, .62, .72), 'apron': (.95, .94, .9),
    'cardigan': (.42, .08, .1), 'plaid_red': (.55, .1, .08), 'sweater_pink': (.85, .55, .6), 'sweater_cream': (.86, .8, .66), 'grey_suit': (.3, .3, .32),
    'navy': (.07, .09, .18), 'olive': (.25, .26, .14), 'mustard': (.72, .55, .16), 'log': (.35, .2, .1), 'log_end': (.72, .55, .32), 'glass_rim': (.1, .08, .06),
    'gown_red': (.62, .03, .05), 'sequin': (.86, .82, .76), 'purple': (.3, .12, .38), 'lilac': (.62, .52, .72), 'teal_dress': (.08, .32, .32), 'cream_dress': (.9, .86, .74),
    'sky_blue': (.45, .6, .78), 'green_sweater': (.18, .32, .18), 'eyepatch': (.02, .02, .02), 'cigar': (.3, .16, .07), 'silver': (.7, .7, .72), 'bow_tie': (.05, .05, .06),
}


# ---------------- primitive meshes ----------------
class Kit:
    def __init__(self):
        self.parts = []  # (obj, colour, priority)

    def _obj(self, bm, colour, prio):
        me = bpy.data.meshes.new('part'); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new('part', me); bpy.context.scene.collection.objects.link(o)
        self.parts.append((o, colour, prio)); return o

    def ellip(self, c, s, colour, prio=0, rot=None):
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=1)
        M = Matrix.Translation(c) @ (rot.to_matrix().to_4x4() if rot else Matrix()) @ Matrix.Diagonal((*s, 1))
        bmesh.ops.transform(bm, matrix=M, verts=bm.verts); return self._obj(bm, colour, prio)

    def cone(self, a, b, r1, r2, colour, prio=0, caps=True):
        """tapered capsule from a (radius r1) to b (radius r2)"""
        a, b = Vector(a), Vector(b); d = b - a
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=r1, radius2=r2, depth=d.length)
        M = Matrix.Translation((a + b) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=M, verts=bm.verts); o = self._obj(bm, colour, prio)
        if caps:
            self.ellip(a, (r1, r1, r1), colour, prio); self.ellip(b, (r2, r2, r2), colour, prio)
        return o

    def rbox(self, c, s, r, colour, prio=0, rot=None, taper=None):
        """rounded box: half-sizes s, edge radius r; taper=(top_scale_x, top_scale_y) narrows the top"""
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=2)
        for v in bm.verts:
            v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
            if taper and v.co.z > 0:
                v.co.x *= taper[0]; v.co.y *= taper[1]
        bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=r, segments=5, affect='EDGES', profile=.5)
        M = Matrix.Translation(c) @ (rot.to_matrix().to_4x4() if rot else Matrix())
        bmesh.ops.transform(bm, matrix=M, verts=bm.verts); return self._obj(bm, colour, prio)

    def plate(self, pts, thick, colour, prio=0, normal=(0, -1, 0)):
        """flat polygon (e.g. a lapel) extruded by thick along normal"""
        bm = bmesh.new(); vs = [bm.verts.new(p) for p in pts]; f = bm.faces.new(vs)
        ext = bmesh.ops.extrude_face_region(bm, geom=[f]); n = Vector(normal) * thick
        bmesh.ops.translate(bm, vec=n, verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)])
        return self._obj(bm, colour, prio)

    # --- fuse ---
    def fuse(self, name, paint=None, smooth_iter=10):
        for o in bpy.context.selected_objects:
            o.select_set(False)
        objs = [p[0] for p in self.parts]
        # keep pristine copies for colour lookup
        bvhs = [(BVHTree.FromObject(o, bpy.context.evaluated_depsgraph_get()), col, prio) for o, col, prio in self.parts]
        dup = []
        for o in objs:
            c = o.copy(); c.data = o.data.copy(); bpy.context.scene.collection.objects.link(c); dup.append(c)
        for o in dup:
            o.select_set(True)
        bpy.context.view_layer.objects.active = dup[0]
        bpy.ops.object.join()
        body = bpy.context.object; body.name = name
        rm = body.modifiers.new('Fuse', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = VOXEL; rm.adaptivity = 0
        sm = body.modifiers.new('Ceramic fillets', 'SMOOTH'); sm.factor = .6; sm.iterations = smooth_iter
        bpy.ops.object.modifier_apply(modifier='Fuse'); bpy.ops.object.modifier_apply(modifier='Ceramic fillets')
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
        me = body.data
        ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT'); me.color_attributes.active_color = ca
        me.calc_loop_triangles() if hasattr(me, 'calc_loop_triangles') else None
        aa = VOXEL * 1.8
        for v in me.vertices:
            ds = []
            for bvh, col, prio in bvhs:
                hit = bvh.find_nearest(v.co)
                if hit[0] is not None:
                    ds.append((hit[3] - prio * .0025, col))
            ds.sort(key=lambda x: x[0])
            best = ds[0][1]
            col = Vector(paint(v.co, v.normal, best) if paint else PAL[best])
            # soften the seam between two differently coloured parts
            other = next((d for d in ds[1:] if d[1] != best), None)
            if other and other[0] - ds[0][0] < aa:
                w = .5 + .5 * (other[0] - ds[0][0]) / aa
                col = col.lerp(Vector(paint(v.co, v.normal, other[1]) if paint else PAL[other[1]]), 1 - w)
            ca.data[v.index].color = (*col, 1)
        for p in me.polygons:
            p.use_smooth = True
        glaze = bpy.data.materials.new(name + ' • glaze'); glaze.use_nodes = True
        nt = glaze.node_tree; bsdf = nt.nodes['Principled BSDF']
        vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
        nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = .2; bsdf.inputs['Coat Weight'].default_value = 1.; bsdf.inputs['Coat Roughness'].default_value = .05
        me.materials.append(glaze)
        return body


# ---------------- painted face ----------------
def arc_dist(px, pz, cx, cz, w, bow):
    t = (px - cx) / w
    if abs(t) > 1.05:
        return 1e9
    t = max(-1, min(1, t)); return abs(pz - (cz + bow * (1 - t * t)))


def face(hc, r, *, mouth='smile', eyes='closed', cheeks=True, brows=True, stubble=False, lips='lips', extra=None):
    """returns a paint(co, n, key) giving the final colour for every vertex; strokes are anti-aliased"""
    hx, hy, hz = hc
    soft = lambda d, w, aa=.018: max(0., min(1., (w - d) / aa + .5))

    def paint(co, n, key):
        base = extra(co, n, key) if extra else None
        c = Vector(base if base else PAL[key])
        if key != 'skin' or co.z < hz - r * 1.05 or co.y > hy - r * .2:
            return tuple(c)
        x, z = (co.x - hx) / r, (co.z - hz) / r
        ink = Vector(PAL['ink'])
        if stubble and z < -.3 and abs(x) < .7:
            c = c.lerp(Vector(PAL['stubble']), .4)
        if cheeks:
            for sx in (-1, 1):
                d = math.hypot(x - sx * .52, (z + .22) * 1.2) / .21
                if d < 1:
                    c = c.lerp(Vector(PAL['cheek']), (1 - d * d) ** .8 * .85)
        for sx in (-1, 1):
            if eyes == 'closed':
                c = c.lerp(ink, soft(arc_dist(x, z, sx * .33, -.02, .17, -.07), .022))
                lx = x - sx * .5
                if -.06 < z < .03 and 0 <= lx * sx < .07:
                    c = c.lerp(ink, soft(abs(lx * sx * .6 - (z + .02)), .016))
            elif eyes == 'open':
                d = math.hypot(x - sx * .33, (z + .01) * .8)
                c = c.lerp(ink, soft(d, .085)); c = c.lerp(Vector((.95, .95, .95)), soft(math.hypot(x - sx * .33 - .025, z + .035), .025))
            if brows:
                c = c.lerp(ink, soft(arc_dist(x, z, sx * .34, .27, .14, .035), .016) * .9)
        if mouth == 'smile':
            c = c.lerp(Vector(PAL[lips]), soft(arc_dist(x, z, 0, -.42, .1, -.045), .02))
        elif mouth == 'lips':
            d = math.hypot(x / 1.5, (z + .44) * 1.7); c = c.lerp(Vector(PAL[lips]), soft(d, .08))
            c = c.lerp(Vector((.42, .07, .09)), soft(abs(z + .44), .008) * soft(abs(x), .1))
        elif mouth == 'o':
            d = math.hypot(x / .9, (z + .44) * 1.1); c = c.lerp(Vector((.35, .05, .07)), soft(d, .07)); c = c.lerp(Vector(PAL[lips]), soft(abs(d - .08), .02))
        elif mouth == 'flat':
            c = c.lerp(Vector(PAL[lips]), soft(abs(z + .43), .014) * soft(abs(x), .09))
        elif mouth == 'frown':
            c = c.lerp(Vector(PAL[lips]), soft(arc_dist(x, z, 0, -.44, .1, .035), .02))
        elif mouth == 'grin' and abs(z + .42) < .08 and abs(x) < .34:
            tooth = (.97, .95, .88) if int((x + 1) / .09) % 2 else (.85, .82, .74)
            c = c.lerp(ink, soft(max(abs(z + .42) - .045, abs(x) - .3), .0, .02)) if False else c
            c = c.lerp(Vector(tooth) if abs(z + .42) < .045 else ink, soft(max(abs(z + .42), abs(x) * .2), .07))
        return tuple(c)
    return paint


# ---------------- characters (height ≈ 1.0, feet on z=0, facing -Y) ----------------
HEAD = Vector((0, 0, .79)); HR = .155


ARMS_DEFAULT = {sx: (Vector((sx * .14, 0, .6)), Vector((sx * .19, 0, .48)), Vector((sx * .2, -.015, .375))) for sx in (-1, 1)}
POSES = {
    'hold_front': {sx: (Vector((sx * .14, 0, .6)), Vector((sx * .18, -.04, .47)), Vector((sx * .085, -.15, .45))) for sx in (-1, 1)},
    'hips': {sx: (Vector((sx * .14, 0, .6)), Vector((sx * .25, 0, .5)), Vector((sx * .15, -.03, .42))) for sx in (-1, 1)},
    'dance': {1: (Vector((.14, 0, .6)), Vector((.23, -.02, .7)), Vector((.25, -.05, .84))), -1: (Vector((-.14, 0, .6)), Vector((-.25, -.03, .52)), Vector((-.3, -.08, .44)))},
    'mic': {1: (Vector((.14, 0, .6)), Vector((.17, -.1, .5)), Vector((.05, -.16, .64))), -1: (Vector((-.14, 0, .6)), Vector((-.19, 0, .48)), Vector((-.2, -.015, .375)))},
    'one_arm': {1: (Vector((.14, 0, .6)), Vector((.19, 0, .48)), Vector((.2, -.015, .375))), -1: (Vector((-.14, 0, .6)), Vector((-.16, 0, .56)), Vector((-.165, 0, .54)))},
    'pocket': {sx: (Vector((sx * .14, 0, .6)), Vector((sx * .2, .02, .48)), Vector((sx * .14, -.04, .4))) for sx in (-1, 1)},
}
CUR = {'arms': ARMS_DEFAULT}


def base_figure(k, *, jacket, trousers, shoes='shoe', shirt='shirt', sleeves=None, dress=None, hands=1.0, torso=1.0, arms=None, legs='trousers', socks=None):
    sl = sleeves or jacket
    arms = POSES.get(arms, arms) if isinstance(arms, str) else (arms or ARMS_DEFAULT)
    CUR['arms'] = arms
    # head + ears + nose + neck
    k.ellip(HEAD, (HR, HR * .95, HR * 1.04), 'skin', prio=1)
    for sx in (-1, 1):
        k.ellip(HEAD + Vector((sx * HR * .97, .01, -.01)), (.022, .03, .04), 'skin', prio=1)
    k.ellip(HEAD + Vector((0, -HR * .96, -.03)), (.013, .012, .012), 'skin', prio=2)
    k.cone((0, 0, .6), (0, 0, .67), .045, .042, 'skin', caps=False)
    # torso: tapered rounded jacket body + slight flared hem
    if dress:
        hem = {'trousers': .14, 'dress': .14, 'skirt': .26, 'gown': .03}[legs]
        k.rbox((0, 0, .5), (.12 * torso, .085, .12), .07, jacket if legs == 'skirt' else dress, taper=(.85, .9))
        k.cone((0, 0, .42), (0, 0, hem), .13, .18 + (.04 if legs == 'gown' else 0), dress, caps=False)
        k.ellip((0, 0, hem), (.18 + (.04 if legs == 'gown' else 0), .15, .03), dress)
        if legs != 'gown':
            for sx in (-1, 1):
                k.cone((sx * .05, 0, hem + .02), (sx * .05, -.005, .06), .03, .026, socks or 'skin')
    else:
        k.rbox((0, 0, .51), (.135 * torso, .09, .13), .07, jacket, taper=(.9, .92))
        k.rbox((0, 0, .385), (.125 * torso, .086, .035), .03, jacket)
        for sx in (-1, 1):
            k.cone((sx * .065, 0, .36), (sx * .068, 0, .085), .062, .055, trousers)
    for sx in (-1, 1):
        k.ellip((sx * .068, -.03, .045), (.062, .1, .045), shoes, prio=2)
    # arms in a soft A-pose; mitten hands with a thumb
    for sx in (-1, 1):
        sh, el, wr = arms[sx]
        k.cone(sh, el, .052, .046, sl); k.cone(el, wr, .046, .042, sl)
        if (el - wr).length < .03:   # stump (missing forearm)
            continue
        d = (wr - el).normalized()
        k.cone(wr - d * .012, wr + d * .008, .044, .044, shirt, prio=2, caps=False)  # cuff
        k.ellip(wr + d * .045, (.035 * hands, .035 * hands, .045 * hands), 'skin', prio=3)
        k.ellip(wr + d * .03 + Vector((-sx * .028, -.022, 0)), (.014 * hands, .014 * hands, .022 * hands), 'skin', prio=3)


def cooper(k):
    base_figure(k, jacket='suit_black', trousers='suit_black')
    # shirt V, tie, lapels, collar
    k.plate([(-.05, -.088, .64), (.05, -.088, .64), (.0, -.088, .5)], .012, 'shirt', prio=3)
    k.plate([(-.013, -.1, .625), (.013, -.1, .625), (.017, -.1, .53), (0, -.1, .5), (-.017, -.1, .53)], .01, 'tie', prio=5)
    for sx in (-1, 1):
        k.plate([(sx * .052, -.092, .645), (sx * .1, -.088, .62), (sx * .04, -.092, .49), (sx * .005, -.094, .49)], .014, 'suit_black', prio=4)
        k.plate([(sx * .012, -.098, .655), (sx * .055, -.094, .655), (sx * .04, -.098, .62)], .012, 'shirt', prio=4)
    # slicked helmet hair with a rounded quiff
    k.ellip(HEAD + Vector((0, .012, .045)), (HR * 1.05, HR * 1.02, HR * .84), 'hair_black', prio=3)
    k.ellip(HEAD + Vector((-.012, -.045, .085)), (HR * .9, HR * .72, HR * .5), 'hair_black', prio=4)   # soft swept front, part of the helmet
    for sx in (-1, 1):
        k.ellip(HEAD + Vector((sx * HR * .92, .03, .0)), (.032, .09, .075), 'hair_black', prio=4)

    def extra(co, n, key):
        if key == 'tie' and int((co.z * 1.4 - co.x) / .016) % 2:
            return PAL['tie_stripe']
        if key == 'hair_black' and abs(co.x - .06) < .005 and co.z > HEAD.z + .09 and co.y < HEAD.y + .06:
            return (.16, .15, .16)
        return None
    return extra, dict(mouth='smile')


def laura(k):
    base_figure(k, jacket='dress_black', trousers='dress_black', dress='dress_black', torso=.88, hands=.9)
    k.plate([(-.04, -.082, .62), (.04, -.082, .62), (0, -.082, .56)], .006, 'skin', prio=3)  # neckline
    k.ellip(HEAD + Vector((0, .025, .05)), (HR * 1.08, HR * 1.04, HR * .85), 'blonde', prio=3)
    for sx in (-1, 1):  # long hair falling to the shoulders, a curl at each end
        k.cone(HEAD + Vector((sx * HR * .9, .03, 0)), (sx * .14, .04, .55), .055, .045, 'blonde', prio=3)
        k.ellip((sx * .145, .03, .54), (.05, .045, .035), 'blonde', prio=3)
    k.ellip(HEAD + Vector((0, .1, -.12)), (HR * .9, HR * .45, HR * 1.0), 'blonde', prio=3)
    k.ellip(HEAD + Vector((.04, -.09, .11)), (HR * .62, HR * .34, HR * .3), 'blonde', prio=4)
    return None, dict(mouth='lips')


def bob(k):
    base_figure(k, jacket='denim', trousers='denim_dark', sleeves='denim', hands=1.35, torso=1.08)
    for sx in (-1, 1):
        k.rbox((sx * .06, -.092, .56), (.03, .006, .022), .006, 'denim_dark', prio=4)
    k.plate([(-.04, -.093, .64), (.04, -.093, .64), (0, -.093, .58)], .008, 'skin', prio=3)
    # wild grey mane: big uneven lumps falling past the shoulders
    k.ellip(HEAD + Vector((0, .03, .05)), (HR * 1.15, HR * 1.1, HR * .9), 'grey_hair', prio=3)
    for sx in (-1, 1):
        k.cone(HEAD + Vector((sx * HR * .95, .02, 0)), (sx * .17, .05, .5), .07, .05, 'grey_hair', prio=3)
        k.ellip((sx * .17, .05, .5), (.06, .05, .04), 'grey_hair', prio=3)
    k.ellip(HEAD + Vector((0, .1, -.13)), (HR * 1.0, HR * .5, HR * 1.05), 'grey_hair', prio=3)
    k.ellip(HEAD + Vector((-.05, -.1, .1)), (HR * .5, HR * .3, HR * .3), 'grey_hair', prio=4)
    return None, dict(mouth='grin', eyes='open', cheeks=False, stubble=True)


FIGS = {'cooper': cooper, 'laura': laura, 'bob': bob}
exec(open(str(R / 'cast_more.py'), encoding='utf-8').read())


def rig_for(mesh):
    arm = bpy.data.armatures.new(mesh.name + ' rig'); ro = bpy.data.objects.new(mesh.name + '.rig', arm)
    bpy.context.scene.collection.objects.link(ro); bpy.context.view_layer.objects.active = ro
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ro.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')

    def b(name, h, t, parent=None):
        e = arm.edit_bones.new(name); e.head = h; e.tail = t
        if parent:
            e.parent = arm.edit_bones[parent]
    b('pelvis', (0, 0, .36), (0, 0, .44)); b('spine_01', (0, 0, .44), (0, 0, .53), 'pelvis'); b('spine_03', (0, 0, .53), (0, 0, .6), 'spine_01')
    b('neck_01', (0, 0, .6), (0, 0, .66), 'spine_03'); b('head', (0, 0, .66), (0, 0, .98), 'neck_01')
    for s, sx in (('l', 1), ('r', -1)):
        b(f'clavicle_{s}', (sx * .03, 0, .6), (sx * .13, 0, .6), 'spine_03')
        sh, el, wr = CUR['arms'][sx]
        if (el - wr).length < .03:
            wr = el + (el - sh).normalized() * .05
        b(f'upperarm_{s}', sh, el, f'clavicle_{s}')
        b(f'lowerarm_{s}', el, wr, f'upperarm_{s}')
        b(f'hand_{s}', wr, wr + (wr - el).normalized() * .08, f'lowerarm_{s}')
        b(f'thigh_{s}', (sx * .065, 0, .36), (sx * .067, 0, .22), 'pelvis')
        b(f'calf_{s}', (sx * .067, 0, .22), (sx * .068, 0, .07), f'thigh_{s}')
        b(f'foot_{s}', (sx * .068, 0, .07), (sx * .068, -.1, .02), f'calf_{s}')
    bpy.ops.object.mode_set(mode='OBJECT')
    mesh.select_set(True); ro.select_set(True); bpy.context.view_layer.objects.active = ro
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return ro


def studio(slug):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'; s.cycles.samples = 16 if QUICK else 40; s.cycles.use_denoising = True
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('W'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (.92, .9, .87, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .55
    def light(n, loc, power, size):
        d = bpy.data.lights.new(n, 'AREA'); d.energy = power; d.size = size
        o = bpy.data.objects.new(n, d); s.collection.objects.link(o); o.location = loc
        o.rotation_euler = (Vector((0, 0, .55)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    light('Key', (-1.2, -1.6, 1.8), 110, 1.2); light('Rim', (1.2, 1.2, 1.4), 60, 1.)
    bpy.ops.mesh.primitive_plane_add(size=6); fl = bpy.context.object
    fm = bpy.data.materials.new('floor'); fm.use_nodes = True; fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.86, .84, .8, 1); fl.data.materials.append(fm)
    cd = bpy.data.cameras.new('C'); cam = bpy.data.objects.new('C', cd); s.collection.objects.link(cam); s.camera = cam
    out = R / 'previews'; out.mkdir(exist_ok=True)
    for name, loc, tgt, lens, res in [('full', (.75, -1.9, .7), (0, 0, .5), 50, (720, 900)), ('face', (.22, -.7, .84), (0, 0, .78), 85, (720, 720))][:1 if QUICK else 2]:
        cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); cd.lens = lens
        s.render.resolution_x, s.render.resolution_y = res
        s.render.filepath = str(out / f'{slug}-{name}.png'); bpy.ops.render.render(write_still=True)


for slug, fn in FIGS.items():
    if ONLY and slug not in ONLY:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    k = Kit()
    extra, fopts = fn(k)
    paint = face(HEAD, HR, extra=extra, **fopts)
    mesh = k.fuse(slug.capitalize(), paint)
    print('VERTS', slug, len(mesh.data.vertices), flush=True)
    rig_for(mesh)
    bpy.ops.wm.save_as_mainfile(filepath=str(R / f'{slug}.blend'), compress=True)
    if RENDER:
        studio(slug)
    print('FIG_DONE', slug, flush=True)
