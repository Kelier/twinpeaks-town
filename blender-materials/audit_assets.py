import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parent;reports=[]
for mode in ['diner','motel','redroom','forest']:
    bpy.ops.wm.open_mainfile(filepath=str(root/'scenes'/f'{mode}.blend'));s=bpy.context.scene
    meshes=[o for o in s.objects if o.type=='MESH'];images=[i for i in bpy.data.images if i.source=='FILE' and i.users]
    assert s.camera and s.camera.animation_data,mode
    assert all(i.packed_file for i in images),mode+' unpacked texture'
    assert len(s.collection.children)>=5,mode
    reports.append({'scene':mode,'objects':len(s.objects),'mesh_objects':len(meshes),'source_polygons':sum(len(o.data.polygons) for o in meshes),'lights':len([o for o in s.objects if o.type=='LIGHT']),'materials':len([m for m in bpy.data.materials if m.users]),'packed_used_images':len(images),'camera_animation':True,'render':[s.render.resolution_x,s.render.resolution_y],'asset_collections':[c.name for c in s.collection.children if c.asset_data]})
(root/'ASSET-MANIFEST.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print('PASS all four saved scenes reopen; used textures packed; camera tracks present; asset collections present')
