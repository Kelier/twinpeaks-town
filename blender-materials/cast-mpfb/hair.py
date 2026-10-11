# Strand-clump hair grown over the MPFB scalp: combed, parted, long or curly styles.
# Clumps are tapered tubes (real geometry), so they render in Cycles and export to glTF.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree


def _surface(body, style):
    """Evaluated body (shape keys + pose) as a BVH of skin faces, plus scalp triangles."""
    mask = [m for m in body.modifiers if m.type == 'MASK']
    for m in mask:
        m.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    mw = body.matrix_world
    gi = {g.name: g.index for g in body.vertex_groups}

    def w(v, name):
        for g in body.data.vertices[v].groups:
            if g.group == gi[name]:
                return g.weight
        return 0.
    skin = [w(v.index, 'body') > .5 for v in body.data.vertices]
    verts = [mw @ v.co for v in me.vertices]
    headv = [i for i, v in enumerate(body.data.vertices) if skin[i] and w(i, 'head') > .5]
    hc = sum((verts[i] for i in headv), Vector()) / len(headv)
    htop = max(verts[i].z for i in headv)
    hf, hs, hb = style.get('hairline', (.075, .035, -.06))  # above head centre: front, side, back

    def in_hair(i):
        r = verts[i] - hc
        a = math.atan2(r.x, -r.y)          # 0 = face direction (-Y)
        ca = math.cos(a)
        thr = hs + (hf - hs) * max(ca, 0) ** style.get('shell', {}).get('front_curve', .45) + (hb - hs) * max(-ca, 0) ** 1.2
        return r.z > thr + style.get('root_inset', 0.)
    scalp = [False] * len(verts)
    for i in headv:
        scalp[i] = in_hair(i)
    bm = bmesh.new()
    for co in verts:
        bm.verts.new(co)
    bm.verts.ensure_lookup_table()
    tris = []
    for p in me.polygons:
        vs = list(p.vertices)
        if all(skin[i] for i in vs):
            try:
                bm.faces.new([bm.verts[i] for i in vs])
            except ValueError:
                pass
            if all(scalp[i] for i in vs):
                for k in range(1, len(vs) - 1):
                    tris.append((verts[vs[0]], verts[vs[k]], verts[vs[k + 1]]))
    bm.normal_update()
    bvh = BVHTree.FromBMesh(bm)
    head_pts = [verts[i] for i in range(len(verts)) if scalp[i]]
    nrm = {i: (mw.to_3x3() @ me.vertices[i].normal).normalized() for i in range(len(verts)) if scalp[i]}
    cap_faces = [list(p.vertices) for p in me.polygons if all(scalp[i] for i in p.vertices)]
    cap = (verts, nrm, cap_faces)
    ev.to_mesh_clear()
    for m in mask:
        m.show_viewport = True
    bm.free()
    return bvh, tris, head_pts, cap, hc


def _sample(tris, n, rnd):
    areas = [((b - a).cross(c - a)).length * .5 for a, b, c in tris]
    tot = sum(areas)
    acc, cum = 0, []
    for ar in areas:
        acc += ar; cum.append(acc)
    out = []
    import bisect
    for _ in range(n):
        i = bisect.bisect(cum, rnd.random() * tot)
        a, b, c = tris[min(i, len(tris) - 1)]
        u, v = rnd.random(), rnd.random()
        if u + v > 1:
            u, v = 1 - u, 1 - v
        out.append(a + (b - a) * u + (c - a) * v)
    return out


def grow(body, style, name='Hair', seed=3, over=None):
    """style keys: flow ('back'|'part'|'radial'), part_x, length, length_jitter, gravity, lift, lift_falloff,
    curl, curl_freq, frizz, clumps, radius, color, hairline_z (drop roots below), segs."""
    rnd = random.Random(seed)
    bvh, tris, pts, capdata, c = _surface(body, style)
    skin_bvh = bvh
    if over is not None:
        # Strands ride on the sculpted hair mass instead of the skin.
        bvh = BVHTree.FromObject(over, bpy.context.evaluated_depsgraph_get())
    top = max(p.z for p in pts)
    crown = Vector((c.x, c.y + style.get('crown_back', .03), top))
    n = style.get('clumps', 900)
    roots = _sample(tris, n, rnd)
    segs = style.get('segs', 12)
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'; cu.resolution_u = 3
    cu.bevel_depth = 1.; cu.bevel_resolution = style.get('bevel_res', 1); cu.use_fill_caps = True
    for r in roots:
        loc, nrm, _, _ = bvh.find_nearest(r)
        if loc is None:
            continue
        L = style['length'] * (1 + style.get('length_jitter', .25) * (rnd.random() * 2 - 1))
        backness = max(0., min(1., (loc.y - c.y) / .08))
        L *= 1 - (1 - style.get('back_len', 1.)) * backness
        layer = style.get('layer', .006) * rnd.random()
        # Front of head: a bit of lift gives a quiff/volume instead of a painted-on cap.
        front = max(0., min(1., (c.y - loc.y) / .09))
        lift = style.get('lift', .012) * (.4 + .6 * front) * (.7 + .6 * rnd.random())
        flow = style.get('flow', 'back')
        if flow == 'back':
            d0 = Vector((style.get('side_sweep', 0.) * (1 if loc.x > c.x else -1), 1, .15 + front * style.get('front_rise', 1.2)))
        elif flow == 'part':
            px = style.get('part_x', 0.)
            side = 1 if loc.x > c.x + px else -1
            d0 = Vector((side, .25 + style.get('back_bias', .2), -.2))
        else:
            d0 = loc - crown; d0.z = min(d0.z, 0) - .05
        d0 += Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1))) * style.get('frizz', .08)
        step = L / segs
        if over is not None:
            loc, nrm, _, _ = bvh.find_nearest(loc)
        p = loc + nrm * (style.get('root_off', .002))
        pts_ = [p.copy()]
        d = d0.normalized()
        ph = rnd.random() * 6.28
        off_path = []
        for k in range(1, segs + 1):
            t = k / segs
            _, nn, _, dist = bvh.find_nearest(p)
            nn = nn or nrm
            want = d - nn * d.dot(nn) * (1 - t * .3)
            g = style.get('gravity', .2) * t
            want = (want.normalized() * (1 - g) + Vector((0, 0, -1)) * g)
            if want.length < 1e-6:
                want = Vector((0, 0, -1))
            d = (d * .45 + want.normalized() * .55).normalized()
            if front > .4 and t < .5 and d.z < 0:
                d.z = 0; d.normalize()
            p = p + d * step
            if over is not None:
                sl, sn, _, ds = skin_bvh.find_nearest(p)
                if sl is not None and (p - sl).dot((sl - c).normalized()) < style.get('stop_near_skin', .0012):
                    break
            # Keep the clump above the skin: offset grows from root lift toward the outer layer.
            minoff = lift * math.sin(min(1, t * 2.2) * math.pi / 2) * (1 - .5 * t) + .003 + layer
            loc2, n2, _, dist2 = bvh.find_nearest(p)
            if loc2 is not None:
                on_head = loc2.z > c.z + style.get('hug_until', -.09)
                if dist2 < minoff or (p - loc2).dot(n2) < 0 or (on_head and dist2 < minoff + style.get('hug', .03)):
                    p = loc2 + n2 * minoff
            q = p.copy()
            if style.get('curl'):
                side = d.cross(Vector((0, 0, 1)))
                if side.length < 1e-4:
                    side = Vector((1, 0, 0))
                side.normalize(); up = side.cross(d).normalized()
                a = ph + t * style.get('curl_freq', 14)
                amp = style['curl'] * min(1, t * 3)
                q = q + (side * math.cos(a) + up * math.sin(a)) * amp
            pts_.append(q)
        if len(pts_) < 4:
            continue
        for _ in range(style.get('smooth', 2)):
            pts_ = [pts_[0]] + [(pts_[i - 1] + pts_[i] * 2 + pts_[i + 1]) / 4 for i in range(1, len(pts_) - 1)] + [pts_[-1]]
        sp = cu.splines.new('POLY')
        sp.points.add(len(pts_) - 1)
        R0 = style.get('radius', .0045) * (.7 + .6 * rnd.random())
        for i, (spt, q) in enumerate(zip(sp.points, pts_)):
            t = i / (len(pts_) - 1)
            t = t * (len(pts_) - 1) / segs
            spt.co = (*q, 1)
            spt.radius = R0 * (1 - t) ** .7 * (1 if t < .999 else .15) + R0 * .08
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.new(name + ' • strands')
    mat.use_nodes = True
    nt = mat.node_tree; pbsdf = nt.nodes['Principled BSDF']
    col = style.get('color', (.03, .02, .015))
    pbsdf.inputs['Base Color'].default_value = (*col, 1)
    pbsdf.inputs['Roughness'].default_value = style.get('rough', .38)
    pbsdf.inputs['Coat Weight'].default_value = style.get('sheen', .08)
    pbsdf.inputs['Specular IOR Level'].default_value = .3
    pbsdf.inputs['Coat Roughness'].default_value = .3
    # Strand-direction streaks (Blender only) so the clumps read as combed hair.
    tex = nt.nodes.new('ShaderNodeTexWave'); tex.wave_type = 'BANDS'; tex.bands_direction = 'Z'
    tex.inputs['Scale'].default_value = 60; tex.inputs['Distortion'].default_value = 6
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .25
    nt.links.new(tex.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs[0], pbsdf.inputs['Normal'])
    cu.materials.append(mat)
    # Convert to mesh so it skins to the head bone and exports.
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.object
    for poly in ob.data.polygons:
        poly.use_smooth = True
    # Scalp cap in hair colour hides skin between clumps.
    if over is not None:
        return ob, None
    cap = _cap(capdata, mat, name)
    return ob, cap


def _cap(capdata, mat, name):
    verts, nrm, faces = capdata
    idx = {i: k for k, i in enumerate(sorted(nrm))}
    vs = [verts[i] + nrm[i] * .0025 for i in sorted(nrm)]
    me = bpy.data.meshes.new(name + ' cap')
    me.from_pydata(vs, [], [[idx[i] for i in f] for f in faces])
    o = bpy.data.objects.new(name + ' cap', me); bpy.context.scene.collection.objects.link(o)
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    return o


def bind_to_head(objs, rig):
    for o in objs:
        o.parent = rig; o.parent_type = 'BONE'; o.parent_bone = 'head'
        hb = rig.pose.bones['head']
        o.matrix_parent_inverse = (rig.matrix_world @ hb.matrix @ Matrix.Translation((0, hb.length, 0))).inverted()


def _smoothstep(e0, e1, x):
    t = max(0., min(1., (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def shell(body, style, mat=None, name='Hair shell'):
    """Sculpted hair mass: scalp offset with feathered hairline, volume profile and comb grooves.
    style.shell = {base, top, front, back, fade, margin, groove_n, groove_depth, clump_n, clump_depth, axis}"""
    sh = style['shell']
    mask = [m for m in body.modifiers if m.type == 'MASK']
    for m in mask:
        m.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    me = body.evaluated_get(dg).to_mesh()
    mw = body.matrix_world
    gi = {g.name: g.index for g in body.vertex_groups}

    def w(v, n):
        for g in body.data.vertices[v].groups:
            if g.group == gi[n]:
                return g.weight
        return 0.
    verts = [mw @ v.co for v in me.vertices]
    head = [i for i in range(len(verts)) if w(i, 'body') > .5 and w(i, 'head') > .5 and w(i, 'ears') < .05]
    hc = sum((verts[i] for i in head), Vector()) / len(head)
    hf, hs, hb = style.get('hairline', (.075, .035, -.06))

    def sd(p):  # signed height above hairline
        r = p - hc
        ca = math.cos(math.atan2(r.x, -r.y))
        return r.z - (hs + (hf - hs) * max(ca, 0) ** sh.get('front_curve', .45) + (hb - hs) * max(-ca, 0) ** 1.2)
    margin = sh.get('margin', .012)
    region = set(i for i in head if sd(verts[i]) > -margin)
    bm = bmesh.new()
    idx = {}
    for i in region:
        idx[i] = bm.verts.new(verts[i])
    for p in me.polygons:
        if all(i in region for i in p.vertices):
            try:
                bm.faces.new([idx[i] for i in p.vertices])
            except ValueError:
                pass
    body.evaluated_get(dg).to_mesh_clear()
    for m in mask:
        m.show_viewport = True
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    for _ in range(sh.get('subdiv', 2)):
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True, smooth=1.0)
    bm.normal_update()
    rnd = random.Random(7)
    ph = [rnd.random() * 6.28 for _ in range(4)]
    axis = sh.get('axis', 'y')
    fade = sh.get('fade', .014)
    for v in bm.verts:
        p = v.co.copy(); r = p - hc
        s_ = sd(p)
        f = _smoothstep(-fade * .4, fade * .6, s_)
        up = max(0., r.z) / .1
        front = max(0., -r.y) / .1
        backf = max(0., r.y) / .1
        T = sh.get('base', .006) + sh.get('top', .01) * up ** 2 + sh.get('front', .012) * front * up + sh.get('back', .003) * backf
        T += sh.get('side_puff', 0.) * abs(r.x) / .08
        # comb grooves: lateral coordinate depends on the comb direction
        if axis == 'y':
            u = math.atan2(r.x, r.z + .03)
            lat = u * sh.get('groove_n', 60)
            lat2 = u * sh.get('clump_n', 12)
            along = r.y * 30
        else:
            u = r.y / .1
            lat = u * sh.get('groove_n', 60) * .5
            lat2 = u * sh.get('clump_n', 12) * .5
            along = r.z * 30
        wob = .6 * math.sin(along * .7 + ph[0]) + .3 * math.sin(along * 1.9 + ph[1])
        g = abs(math.sin(lat + wob)) ** .6
        g2 = abs(math.sin(lat2 + wob * .5 + ph[2])) ** .8
        disp = T - sh.get('groove_depth', .0022) * (1 - g) - sh.get('clump_depth', .004) * (1 - g2) * up
        # Outside the hairline the shell dives under the skin, so the visible edge is a smooth iso-line.
        v.co = p + v.normal * (max(.0015, disp) * f - .004 * (1 - f) + .0008)
    me2 = bpy.data.meshes.new(name); bm.to_mesh(me2); bm.free()
    ob = bpy.data.objects.new(name, me2); bpy.context.scene.collection.objects.link(ob)
    for poly in me2.polygons:
        poly.use_smooth = True
    if mat:
        me2.materials.append(mat)
    return ob


def hair_material(name, style):
    mat = bpy.data.materials.new(name + ' • hair')
    mat.use_nodes = True
    nt = mat.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*style.get('color', (.03, .02, .015)), 1)
    p.inputs['Roughness'].default_value = style.get('rough', .42)
    p.inputs['Specular IOR Level'].default_value = .35
    p.inputs['Anisotropic'].default_value = .6
    p.inputs['Coat Weight'].default_value = style.get('sheen', .1)
    p.inputs['Coat Roughness'].default_value = .35
    tex = nt.nodes.new('ShaderNodeTexWave'); tex.wave_type = 'BANDS'; tex.bands_direction = 'X'
    tex.inputs['Scale'].default_value = 140; tex.inputs['Distortion'].default_value = 3
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .15
    nt.links.new(tex.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs[0], p.inputs['Normal'])
    return mat


def comb_back(body, style, mat, name='Hair'):
    """Slicked-back hair: each clump follows a meridian (great circle through the brow and nape points,
    tilted about the head's front-back axis), ray-cast onto the skull and lifted by a volume profile."""
    rnd = random.Random(11)
    bvh, tris, pts, capdata, c = _surface(body, dict(style, root_inset=0))
    sh = dict(style.get('shell', {}), **style.get('profile', {}))
    hf, hs, hb = style.get('hairline', (.075, .035, -.06))
    fc = sh.get('front_curve', .45)

    def sd(p):
        r = p - c
        ca = math.cos(math.atan2(r.x, -r.y))
        return r.z - (hs + (hf - hs) * max(ca, 0) ** fc + (hb - hs) * max(-ca, 0) ** 1.2)

    def skull(d):
        hit, n, _, _ = bvh.ray_cast(c + d * .25, -d)  # from outside inward
        return hit, n

    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.resolution_u = 2
    cu.bevel_depth = 1.; cu.bevel_resolution = style.get('bevel_res', 1); cu.use_fill_caps = True
    clumps = style.get('clumps', 260)
    per = style.get('per_clump', 5)
    bmax = math.radians(style.get('beta_max', 96))
    a_end = math.radians(style.get('alpha_end', 165))
    for k in range(clumps):
        beta = (rnd.random() * 2 - 1) * bmax
        layer = rnd.random()
        vol = 1 + rnd.gauss(0, style.get('clump_var', .25))
        wave_a, wave_f, wave_p = rnd.uniform(.004, .012), rnd.uniform(2, 4), rnd.random() * 6.28
        for j in range(per):
            skip = rnd.random() * style.get('root_stagger', .25)
            b = beta + rnd.gauss(0, style.get('clump_spread', .03))
            lay = min(1, max(0, layer + rnd.gauss(0, .08)))
            path = []
            started = False
            for i in range(90):
                a = math.radians(-10) + (a_end - math.radians(-10)) * i / 89
                d = Vector((math.sin(b), -math.cos(b) * math.cos(a), math.cos(b) * math.sin(a))).normalized()
                # bias the circle so it wraps the back of the skull rather than the neck
                d.z += style.get('lift_axis', .25) * math.sin(a) * 0
                hit, n = skull(d.normalized())
                if hit is None:
                    continue
                s_ = sd(hit)
                if not started:
                    if s_ < 0:
                        continue
                    started = True; a0 = a + skip
                if s_ < -.004 and started and len(path) > 3:
                    break
                if a < a0:
                    continue
                prog = (a - a0) / max(1e-3, a_end - a0)
                r = hit - c
                up = max(0., r.z) / .1; front = max(0., -r.y) / .1
                T = sh.get('base', .004) + sh.get('top', .008) * up ** 2 + sh.get('front', .014) * front * up
                T *= .25 + .75 * min(1, prog * 6)       # rises out of the hairline
                T *= (.35 + .65 * lay) * vol
                side = Vector((math.cos(b), 0, -math.sin(b)))  # lateral direction on the meridian
                q = hit + n * (T + style.get('floor', .0035)) + side * wave_a * math.sin(prog * wave_f * 3.14 + wave_p) * min(1, prog * 4)
                path.append(q)
                if len(path) > style.get('max_pts', 60):
                    break
            if len(path) < 4:
                continue
            path = path[::2]
            for _ in range(3):
                path = [path[0]] + [(path[i - 1] + path[i] * 2 + path[i + 1]) / 4 for i in range(1, len(path) - 1)] + [path[-1]]
            sp = cu.splines.new('POLY'); sp.points.add(len(path) - 1)
            R0 = style.get('radius', .0024) * (.7 + .6 * rnd.random())
            for i, (pt, q) in enumerate(zip(sp.points, path)):
                t = i / (len(path) - 1)
                pt.co = (*q, 1)
                pt.radius = R0 * (1 - t) ** .5 + R0 * .1
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    cu.materials.append(mat)
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.object
    for poly in ob.data.polygons:
        poly.use_smooth = True
    return ob


def _body_bvh(body):
    mask = [m for m in body.modifiers if m.type == 'MASK']
    for m in mask:
        m.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg); me = ev.to_mesh(); mw = body.matrix_world
    gi = body.vertex_groups['body'].index
    skin = [any(g.group == gi and g.weight > .5 for g in v.groups) for v in body.data.vertices]
    bm = bmesh.new()
    vs = [bm.verts.new(mw @ v.co) for v in me.vertices]
    for p in me.polygons:
        if all(skin[i] for i in p.vertices):
            try:
                bm.faces.new([vs[i] for i in p.vertices])
            except ValueError:
                pass
    bm.normal_update(); bvh = BVHTree.FromBMesh(bm); bm.free(); ev.to_mesh_clear()
    for m in mask:
        m.show_viewport = True
    return bvh


def part_fall(body, style, mat, name='Hair'):
    """Parted hair: strands leave the part line, wrap the skull sideways (meridians about the front-back axis),
    then fall with gravity, resting on shoulders/back. Optional curls (bob / waves)."""
    rnd = random.Random(5)
    bvh, tris, pts, capdata, c = _surface(body, dict(style, root_inset=0))
    full = _body_bvh(body)
    prof = style.get('profile', {})
    hf, hs, hb = style.get('hairline', (.08, -.05, -.09))

    def sd(p):
        r = p - c
        ca = math.cos(math.atan2(r.x, -r.y))
        return r.z - (hs + (hf - hs) * max(ca, 0) ** .45 + (hb - hs) * max(-ca, 0) ** 1.2)

    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.resolution_u = 2
    cu.bevel_depth = 1.; cu.bevel_resolution = 1; cu.use_fill_caps = True
    a_lo, a_hi = [math.radians(x) for x in style.get('alpha_range', (8, 172))]
    part_b = math.radians(style.get('part_beta', 4))
    clumps, per = style.get('clumps', 220), style.get('per_clump', 6)
    for k in range(clumps):
        side = 1 if rnd.random() < style.get('side_ratio', .5) else -1
        alpha = a_lo + (a_hi - a_lo) * rnd.random() ** style.get('alpha_bias', 1.)
        L = style['length'] * (1 + style.get('length_jitter', .15) * rnd.gauss(0, 1))
        vol = 1 + rnd.gauss(0, style.get('clump_var', .25)); layer = rnd.random()
        cph = rnd.random() * 6.28
        for j in range(per):
            a = alpha + rnd.gauss(0, style.get('slice_jitter', .03)); lay = min(1, max(0, layer + rnd.gauss(0, .1)))
            path = []
            # 1) over the skull, from the part outward and down
            last_n = None
            started = False
            # head-relative slice position along the part (front -> back); slices are parallel, never converge
            yp = c.y + style.get('y_front', -.085) + (style.get('y_back', .11) - style.get('y_front', -.085)) * ((a - a_lo) / (a_hi - a_lo))
            drift = style.get('back_drift', .05) * max(0., (yp - c.y) / .1)
            for i in range(70):
                th = part_b + math.radians(style.get('wrap', 105)) * i / 69
                cy = yp + drift * i / 69
                ctr = Vector((c.x, cy, c.z + style.get('slice_zoff', .0)))
                d = Vector((side * math.sin(th), 0, math.cos(th)))
                hit, n, _, _ = bvh.ray_cast(ctr + d * .3, -d)
                if hit is None:
                    continue
                if not started:
                    if sd(hit) < 0:
                        continue
                    started = True
                if sd(hit) < 0 and len(path) > 2:
                    break
                prog = i / 69
                r = hit - c
                up = max(0., r.z) / .1
                T = prof.get('base', .006) + prof.get('top', .01) * up ** 2 + prof.get('side', .008) * min(1, prog * 2)
                T *= (.4 + .6 * lay) * vol
                path.append(hit + n * (T + .003)); last_n = n
            if len(path) < 3:
                continue
            # 2) free fall: keep direction, bend to gravity, stay outside the body
            p = path[-1].copy()
            dvec = ((path[-1] - path[-2]).normalized() + last_n * style.get('flare', .5) + Vector((0, 0, -.6))).normalized()
            used = sum((path[i + 1] - path[i]).length for i in range(len(path) - 1))
            step = .012
            while used < L:
                g = style.get('gravity', .6)
                dvec = (dvec * (1 - g * .35) + Vector((0, 0, -1)) * g * .35).normalized()
                p = p + dvec * step; used += step
                loc, nn, _, dist = full.find_nearest(p)
                clear = style.get('clear', .02) * (.6 + .8 * lay)
                if loc is not None and (dist < clear or (p - loc).dot(nn) < 0):
                    p = loc + nn * clear
                path.append(p.copy())
            # curls / waves along the free part
            if style.get('curl'):
                out = []
                for i, q in enumerate(path):
                    t = i / (len(path) - 1)
                    tang = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
                    s1 = tang.cross(Vector((0, 0, 1)))
                    s1 = s1.normalized() if s1.length > 1e-4 else Vector((1, 0, 0))
                    s2 = s1.cross(tang).normalized()
                    ang = cph + j * .3 + t * style.get('curl_freq', 12)
                    amp = style['curl'] * min(1, t * 2.5)
                    out.append(q + (s1 * math.cos(ang) + s2 * math.sin(ang)) * amp)
                path = out
            for _ in range(3):
                path = [path[0]] + [(path[i - 1] + path[i] * 2 + path[i + 1]) / 4 for i in range(1, len(path) - 1)] + [path[-1]]
            sp = cu.splines.new('POLY'); sp.points.add(len(path) - 1)
            R0 = style.get('radius', .003) * (.7 + .6 * rnd.random())
            for i, (pt, q) in enumerate(zip(sp.points, path)):
                t = i / (len(path) - 1)
                pt.co = (*q, 1); pt.radius = R0 * (1 - t) ** .6 + R0 * .1
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    cu.materials.append(mat)
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.object
    for poly in ob.data.polygons:
        poly.use_smooth = True
    return ob
