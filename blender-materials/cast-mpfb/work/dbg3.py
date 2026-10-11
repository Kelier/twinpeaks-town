import bpy, sys
sys.argv=['x','--','--only=dale-cooper','--shots=portrait','--suffix=-dbg','--samples=8']
__file__='/workspace/oiioii-canvas/red-room/blender-materials/cast-mpfb/build_cast.py'
exec(open(__file__).read().replace("    studio(body, slug)","    COLORS(body)\n    studio(body, slug)").replace("for slug, spec in SPECS.items():","""def COLORS(body):
    for o in bpy.data.objects:
        print('OBJ', o.name, o.type, len(o.data.vertices) if o.type=='MESH' else '')
        if 'hair mass' in o.name or 'strands' in o.name:
            m=bpy.data.materials.new('dbg'); m.use_nodes=True
            m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(1,0,0,1) if 'mass' in o.name else (0,1,0,1)
            o.data.materials.clear(); o.data.materials.append(m)
for slug, spec in SPECS.items():""",1))
