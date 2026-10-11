import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parent;reports=[]
for mode in ['diner','motel','redroom','forest']:
    path=root/'scenes'/f'{mode}.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path));s=bpy.context.scene
    groups={}
    for name in ['SET / Environment','PROPS / Story objects','LIGHT RIG','CAMERA / 4 second push','ATMOSPHERE']:
        c=bpy.data.collections.new(name);s.collection.children.link(c);groups[name]=c
    for o in list(s.objects):
        if o.type=='CAMERA':c=groups['CAMERA / 4 second push']
        elif o.type=='LIGHT':c=groups['LIGHT RIG']
        elif 'volume' in o.name.lower():c=groups['ATMOSPHERE']
        elif any(x in o.name.lower() for x in ['coffee','cup','pie','pastry','cherry','cassette','recorder','receipt','key','chair','table','statue','marble','lamp']):c=groups['PROPS / Story objects']
        else:c=groups['SET / Environment']
        for old in list(o.users_collection):old.objects.unlink(o)
        c.objects.link(o)
    for name in ['SET / Environment','PROPS / Story objects','LIGHT RIG']:
        groups[name].asset_mark();groups[name].asset_data.description='The Tomorrow Tape / '+mode+' / '+name
    bpy.context.preferences.filepaths.save_version=0
    meshes=[o for o in s.objects if o.type=='MESH']
    info={'scene':mode,'objects':len(s.objects),'mesh_objects':len(meshes),'source_polygons':sum(len(o.data.polygons) for o in meshes),'lights':len([o for o in s.objects if o.type=='LIGHT']),'materials':len([m for m in bpy.data.materials if m.users]),'packed_images':len([i for i in bpy.data.images if i.packed_file]),'camera_animation':bool(s.camera.animation_data),'render':[s.render.resolution_x,s.render.resolution_y],'collections':list(groups)}
    reports.append(info);bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
(root/'ASSET-MANIFEST.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
print(json.dumps(reports,ensure_ascii=False),flush=True)
