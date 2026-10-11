import bpy,json,struct
from pathlib import Path
R=Path(__file__).resolve().parent;O=R.parents[1]/'public/models/twin-peaks'
bpy.ops.wm.open_mainfile(filepath=str(R/'twin-peaks-miniatures.blend'))
sets=[c for c in bpy.data.collections if c.name.startswith('SET •')];chars=[c for c in bpy.data.collections if c.name.startswith('CHARACTER •')]
assert len(sets)==10;assert len(chars)==8
report={'sets':len(sets),'characters':len(chars),'blender':bpy.app.version_string,'models':[]}
for f in sorted(O.glob('*.glb')):
 data=f.read_bytes();magic,version,total=struct.unpack_from('<III',data,0);assert magic==0x46546c67 and version==2 and total==len(data)
 size,kind=struct.unpack_from('<II',data,12);j=json.loads(data[20:20+size]);assert j.get('meshes');assert not j.get('images'),f.name
 report['models'].append({'file':f.name,'mesh_count':len(j['meshes']),'skins':len(j.get('skins',[])),'animations':len(j.get('animations',[])),'image_planes':False,'bytes':len(data)})
assert len(report['models'])==18
for c in chars:
 rig=next(o for o in c.objects if o.type=='ARMATURE');assert len(rig.data.bones)==16
report['basic_rig_bones_per_character']=16;report['camera_animation']=bool(bpy.context.scene.camera.animation_data)
(R/'VERIFIED.json').write_text(json.dumps(report,indent=2));print('VERIFIED',report['sets'],report['characters'],len(report['models']))
