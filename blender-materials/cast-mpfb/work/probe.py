import bpy
b=next(o for o in bpy.data.objects if o.name.endswith('body'))
print('VG',[g.name for g in b.vertex_groups if not g.name.startswith(('helper','joint'))][:200])
print('OBJS',[(o.name,o.type,o.parent.name if o.parent else None) for o in bpy.data.objects])
print('DIMS',b.dimensions[:])
