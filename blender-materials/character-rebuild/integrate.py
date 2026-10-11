import bpy
from pathlib import Path
R=Path(__file__).resolve().parent
master=R.parent/'miniature-production/twin-peaks-miniatures.blend'
bpy.ops.wm.open_mainfile(filepath=str(master))
names=['Dale Cooper','Laura Palmer','Audrey Horne','Harry Truman','The Giant','Pete Martell','Leland Palmer','BOB']
old={n:bpy.data.collections.get('CHARACTER • '+n) for n in names}
for n,c in old.items():
 if c:c.name='REPLACED • '+n
with bpy.data.libraries.load(str(R/'twin-peaks-character-rebuild.blend'),link=False) as (src,dst):dst.collections=['CHARACTER • '+n for n in names]
new={n:bpy.data.collections.get('CHARACTER • '+n) for n in names}
for n,c in new.items():
 bpy.context.scene.collection.children.link(c);c.hide_render=False;c.hide_viewport=False
 for o in c.objects:
  if o.parent is None:o.location=(0,0,0)
for o in bpy.data.objects:
 if o.instance_type=='COLLECTION':
  for n,c in old.items():
   if o.instance_collection==c:o.instance_collection=new[n];break
for c in old.values():
 if c:
  for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.collections.remove(c)
for c in new.values():bpy.context.view_layer.layer_collection.children[c.name].exclude=True
bpy.context.scene['character_revision']='2026-10-10 individual portrait geometry, corrected wardrobe, material-batched skinned meshes'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(master),compress=True)
print('INTEGRATED_ALL_8')
