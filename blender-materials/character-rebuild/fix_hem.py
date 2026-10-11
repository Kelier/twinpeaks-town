import bpy
from pathlib import Path
R=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(R/'twin-peaks-character-rebuild.blend'))
col=bpy.data.collections['CHARACTER • Audrey Horne']
for o in col.objects:
 if o.type=='MESH' and o.active_material and o.active_material.name.startswith('Audrey • burgundy'):
  for v in o.data.vertices:
   if v.co.z<1.06 and abs(v.co.x)<.22:
    w=max(0,min(1,(1.06-v.co.z)/.06));v.co.y=.022+(v.co.y-.022)*(1+.36*w)
root=next(o for o in col.objects if o.parent is None);old=root.location.copy();root.location=(0,0,0)
bpy.ops.object.select_all(action='DESELECT')
for o in col.objects:o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in col.objects if o.type=='ARMATURE')
bpy.ops.export_scene.gltf(filepath=str(R.parents[1]/'public/models/twin-peaks/audrey-horne.glb'),export_format='GLB',use_selection=True,export_animations=True,export_force_sampling=True,export_apply=False)
root.location=old;bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(R/'twin-peaks-character-rebuild.blend'),compress=True)
s=bpy.context.scene;s.render.filepath=str(R/'previews/character-lineup.png');bpy.ops.render.render(write_still=True)
for c in bpy.data.collections:
 if c.name.startswith('CHARACTER'):c.hide_render=c!=col
root.location=(0,0,0)
from mathutils import Vector
cam=s.camera;cam.location=(.38,-4,2.0);cam.rotation_euler=(Vector((0,0,1.65))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.88;s.render.resolution_x=640;s.render.resolution_y=800;s.render.filepath=str(R/'previews/audrey-horne.png');bpy.ops.render.render(write_still=True)
