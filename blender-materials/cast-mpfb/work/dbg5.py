import bpy, sys
sys.argv=['x','--','--only=dale-cooper','--shots=none','--suffix=-dbg','--samples=1']
__file__='/workspace/oiioii-canvas/red-room/blender-materials/cast-mpfb/build_cast.py'
src=open(__file__).read().replace("    (studio_ln if 'ln' in spec else studio)(body, slug)","    DBG(body)")
src=src.replace("for slug, spec in SPECS.items():","""def DBG(body):
    rig=body.parent
    for n in ['head','hand_l']:
        b=rig.pose.bones[n]; print('B',n,tuple(b.scale), b.bone.use_deform, rig.data.pose_position)
    dg=bpy.context.evaluated_depsgraph_get(); me=body.evaluated_get(dg).to_mesh()
    zs=[ (body.matrix_world@v.co).z for v in me.vertices]; print('ZMAX',max(zs))
    rig.pose.bones['head'].scale=(1,1,1); bpy.context.view_layer.update()
    me=body.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh(); print('ZMAX1',max((body.matrix_world@v.co).z for v in me.vertices))
for slug, spec in SPECS.items():""",1)
exec(src)
