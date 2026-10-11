import bpy
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
print('POSEPOS',rig.data.pose_position)
for n in ['head','hand_l','upperarm_l']:
  b=rig.pose.bones[n]; print('B',n,tuple(b.scale),b.bone.inherit_scale, [c.type for c in b.constraints])
for o in bpy.data.objects:
  if o.type=='MESH': print('M',o.name,[m.type+':'+(m.object.name if getattr(m,'object',None) else '') for m in o.modifiers])
