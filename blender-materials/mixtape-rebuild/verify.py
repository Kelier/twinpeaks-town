import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parent
report=[]
for mode in ['diner','motel','redroom','forest']:
 bpy.ops.wm.open_mainfile(filepath=str(R/'scenes'/f'{mode}-v2.blend'));s=bpy.context.scene
 assert s.camera and s.camera.animation_data,mode
 assert s.get('art_direction','').startswith('V2:'),mode
 assert any(c.name.startswith('REBUILD') and c.asset_data for c in s.collection.children),mode
 images=[i for i in bpy.data.images if i.source=='FILE' and i.users]
 assert all(i.packed_file for i in images),mode
 objects=[o for o in s.objects if o.type=='MESH'];leaves=[o for o in objects if 'canopy leaves' in o.name]
 if mode!='redroom':assert len(leaves)>=5,mode
 report.append({'scene':mode,'mesh_objects':len(objects),'mesh_polygons':sum(len(o.data.polygons) for o in objects),'canopy_meshes':len(leaves),'new_detail_objects':len([o for o in s.objects if o.name.startswith('V2')]),'packed_images':len(images),'camera_animation':True,'resolution':[s.render.resolution_x,s.render.resolution_y]})
(R/'VERIFIED-ASSETS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('PASS: four actual projects reopened, camera tracks, rebuild collection, packed textures and canopy geometry verified')
