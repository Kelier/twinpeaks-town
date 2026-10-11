import bpy, sys, json, math
sys.path.insert(0,'/workspace/oiioii-canvas/red-room/blender-materials/cast-mpfb')
import hair
from mathutils import Vector
spec=json.load(open('/workspace/oiioii-canvas/red-room/blender-materials/cast-mpfb/cast.json'))['dale-cooper']
body=next(o for o in bpy.data.objects if o.name.endswith('• body'))
bvh,tris,pts,cap,c=hair._surface(body,dict(spec['hair_style'],root_inset=0))
print('C',c[:], 'NPTS',len(pts))
for a in [0,30,60,90,120,150]:
  ar=math.radians(a); d=Vector((0,-math.cos(ar),math.sin(ar)))
  print(a, bvh.ray_cast(c+d*.25,-d)[0])
m=hair.hair_material('x',spec['hair_style'])
ob=hair.comb_back(body,spec['hair_style'],m,name='CB')
print('CB',ob.type,len(ob.data.vertices),ob.dimensions[:], ob.location[:])
