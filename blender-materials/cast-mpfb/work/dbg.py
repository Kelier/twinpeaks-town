import bpy, sys
sys.path.insert(0,'/workspace/oiioii-canvas/red-room/blender-materials/cast-mpfb')
import json, hair
spec=json.load(open('/workspace/oiioii-canvas/red-room/blender-materials/cast-mpfb/cast.json'))['dale-cooper']
body=next(o for o in bpy.data.objects if o.name.endswith('• body'))
st=dict(spec['hair_style']); st['clumps']=60
s,c=hair.grow(body,st,name='DBG')
import statistics
L=[]
for sp in bpy.data.curves.get('DBG').splines if bpy.data.curves.get('DBG') else []:
  pass
me=s.data
print('VERTS',len(me.vertices),'POLYS',len(me.polygons),'DIMS',s.dimensions[:])
xs=[v.co for v in me.vertices]
print('SAMPLE',[tuple(round(a,3) for a in xs[i]) for i in range(0,60,6)])
from mathutils import Vector
sc=bpy.context.scene
for o in bpy.data.objects:
  if o.type=='MESH' and o not in (s,c,body): o.hide_render=True
cam=bpy.data.objects.new('C',bpy.data.cameras.new('C'));sc.collection.objects.link(cam);sc.camera=cam
ctr=Vector((0,0,0))
for v in s.data.vertices: ctr+=s.matrix_world@v.co
ctr/=len(s.data.vertices)
cam.location=ctr+Vector((.25,-.35,.15));cam.rotation_euler=(ctr-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=60
L=bpy.data.lights.new('L','SUN');L.energy=4;lo=bpy.data.objects.new('L',L);sc.collection.objects.link(lo);lo.rotation_euler=(0.6,0.3,0.4)
sc.render.engine='CYCLES';sc.cycles.samples=8;sc.render.resolution_x=800;sc.render.resolution_y=800
sc.render.filepath='/workspace/oiioii-canvas/red-room/blender-materials/cast-mpfb/work/dbg.png';bpy.ops.render.render(write_still=True)
