import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'blender-materials/title-redroom/title-redroom.blend'))
stage=bpy.data.collections['SET • redroom'];stage.hide_viewport=False
for layer in bpy.context.view_layer.layer_collection.children:
    if layer.name==stage.name:layer.exclude=False
bpy.ops.object.select_all(action='DESELECT')
for obj in stage.objects:
    if obj.instance_type!='COLLECTION':obj.hide_viewport=False;obj.hide_set(False);obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'public/themes/red-room-interactive.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=False)
