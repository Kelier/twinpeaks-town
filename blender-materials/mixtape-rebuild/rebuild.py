import bpy, math, random, sys, json
from pathlib import Path
from mathutils import Vector, Matrix
R=Path(__file__).resolve().parent
MODE=sys.argv[sys.argv.index('--')+1]
random.seed(87)
bpy.ops.wm.open_mainfile(filepath=str(R.parent/'scenes'/f'{MODE}.blend'))
s=bpy.context.scene
NEW=bpy.data.collections.new('REBUILD • Architecture and lived-in details');s.collection.children.link(NEW)
def link(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 NEW.objects.link(o);return o

def mat(name,c,rough=.65,metal=0,grain=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*c,1);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if grain:
  n=m.node_tree.nodes;l=m.node_tree.links;co=n.new('ShaderNodeTexCoord');mp=n.new('ShaderNodeMapping');mp.inputs['Scale'].default_value=(1,1,grain);l.new(co.outputs['Generated'],mp.inputs['Vector']);noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=38;noise.inputs['Detail'].default_value=2;l.new(mp.outputs[0],noise.inputs[0]);r=n.new('ShaderNodeValToRGB');r.color_ramp.elements[0].color=(*[v*.65 for v in c],1);r.color_ramp.elements[1].color=(*[min(1,v*1.18) for v in c],1);l.new(noise.outputs['Fac'],r.inputs[0]);l.new(r.outputs[0],p.inputs['Base Color']);b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=.12;b.inputs['Distance'].default_value=.004;l.new(noise.outputs['Fac'],b.inputs['Height']);l.new(b.outputs[0],p.inputs['Normal'])
 return m
wood=mat('V2 • warm walnut grain',(.13,.058,.023),.58,grain=.12)
cream=mat('V2 • aged enamel',(.65,.60,.43),.38)
dark=mat('V2 • charcoal blue',(.016,.028,.034),.49)
gold=mat('V2 • warm brass',(.42,.23,.065),.32,.7)
red=mat('V2 • oxblood',(.23,.022,.019),.60)
teal=mat('V2 • faded teal',(.045,.115,.115),.77,grain=1)
paper=mat('V2 • warm paper',(.65,.56,.37),.92)
soil=mat('V2 • olive earth',(.09,.082,.039),.98,grain=1)
bark=mat('V2 • tree bark',(.075,.043,.023),.96,grain=.075)
stone=mat('V2 • slate',(.10,.13,.13),.91,grain=1)
leafm=[]
for i,c in enumerate([(.36,.13,.018),(.56,.22,.026),(.24,.29,.056),(.12,.19,.035),(.60,.34,.055)]):
 m=mat('V2 • leaf pigment '+str(i),c,.9);n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');out=n.get('Material Output');tr=n.new('ShaderNodeBsdfTranslucent');tr.inputs[0].default_value=(*c,1);mix=n.new('ShaderNodeMixShader');mix.inputs[0].default_value=.25;l.new(p.outputs[0],mix.inputs[1]);l.new(tr.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs['Surface']);leafm.append(m)
def box(name,loc,dim,m=wood,bevel=.008):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=link(bpy.context.object);o.name=name;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  b=o.modifiers.new('Small crafted edge','BEVEL');b.width=bevel;b.segments=2;o.modifiers.new('Face normals','WEIGHTED_NORMAL')
 return o

def rod(name,a,b,r,m=wood,r2=None,n=10):
 a=Vector(a);b=Vector(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(a+b)/2);o=link(bpy.context.object);o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o

def sphere(name,loc,scale,m=stone,sub=2):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc);o=link(bpy.context.object);o.name=name;o.scale=scale;o.data.materials.append(m);return o

def curve(name,points,r,m=dark):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for p,co in zip(sp.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);NEW.objects.link(o);c.materials.append(m);return o

def text(body,loc,size=.1,m=cream,rot=(math.pi/2,0,0),name=None):
 c=bpy.data.curves.new('Lettering','FONT');c.body=body;c.align_x='CENTER';c.size=size;c.extrude=.0005;o=bpy.data.objects.new(name or body,c);NEW.objects.link(o);o.location=loc;o.rotation_euler=rot;c.materials.append(m);return o

def emit(name,c,power):
 m=mat(name,c);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=power;return m
bulb=emit('V2 • incandescent', (1,.48,.12),3)
def light(name,loc,target,power,color=(1,.73,.44),size=1,typ='AREA'):
 d=bpy.data.lights.new(name,typ);d.energy=power;d.color=color
 if typ=='AREA':d.shape='DISK';d.size=size
 if typ=='SUN':d.angle=size
 if typ=='POINT':d.shadow_soft_size=size
 o=bpy.data.objects.new(name,d);NEW.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o

def camera(loc,target,lens=40):
 o=s.camera;o.animation_data_clear();o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();o.data.lens=lens;o.data.dof.use_dof=False
 o.keyframe_insert(data_path='location',frame=1);o.keyframe_insert(data_path='rotation_euler',frame=1);o.location=o.location.lerp(Vector(target),.05);o.keyframe_insert(data_path='location',frame=96);s.frame_set(1)

def delete(prefixes):
 for o in list(s.objects):
  if any(o.name.startswith(p) for p in prefixes):bpy.data.objects.remove(o,do_unlink=True)

def mesh(name,vs,fs,mats,ids=None):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs)
 for m in mats:me.materials.append(m)
 if ids:
  for p,i in zip(me.polygons,ids):p.material_index=i
 ob=bpy.data.objects.new(name,me);NEW.objects.link(ob);return ob

def foliage(name,centers,density=75,radius=.95,autumn=True):
 vs=[];fs=[];ids=[]
 for center in centers:
  for k in range(density*(6 if 'window garden' in name else 3) if MODE=='diner' else density*2 if MODE=='forest' else density):
   off=Vector((random.gauss(0,radius*.53),random.gauss(0,radius*.53),random.gauss(0,radius*.30)));a=Vector(center)+off
   length=random.uniform(.13,.28);ang=random.random()*math.tau;u=Vector((math.cos(ang),math.sin(ang),random.uniform(-.7,.7)))*length;v=Vector((-math.sin(ang),math.cos(ang),random.uniform(-.4,.4)))*length*.42
   idx=len(vs);col=random.choice([0,1,2,4] if autumn else [2,3])
   if MODE in ['forest','diner']:
    u*=.45 if MODE=='diner' else .70;v*=.65 if MODE=='diner' else .95
    rim=[a-u,a-u*.45-v*.65,a-u*.12-v,a+u*.35-v*.60,a+u,a+u*.35+v*.60,a-u*.12+v,a-u*.45+v*.65]
    vs.extend([a+Vector((0,0,.009 if MODE=='diner' else .025))]+rim)
    fs.extend([(idx,idx+1+j,idx+1+(j+1)%8) for j in range(8)]);ids.extend([col]*8)
   else:
    vs.extend([a-u,a-v,a+Vector((0,0,.035)),a+v,a+u]);fs.extend([(idx,idx+1,idx+2),(idx,idx+2,idx+3),(idx+1,idx+4,idx+2),(idx+2,idx+4,idx+3)]);ids.extend([col]*4)
 return mesh(name,vs,fs,leafm,ids)

def tree(x,y,h=7,autumn=True):
 base=Vector((x,y,0));top=base+Vector((random.uniform(-.4,.4),random.uniform(-.3,.3),h*.85));rod('V2 • irregular trunk',base,top,h*.037,bark,h*.009,11)
 centers=[]
 for j in range(11):
  z=h*(.35+j*.044);a=j*2.4+random.uniform(-.3,.3);length=h*(.30-j*.011);start=base.lerp(top,z/(h*.85));end=start+Vector((math.cos(a)*length,math.sin(a)*length,h*.16));rod('V2 • tapering limb',start,end,h*.014,bark,.012,7)
  for k in range(3):
   tip=end+Vector((random.uniform(-.8,.8),random.uniform(-.8,.8),random.uniform(.05,.8)));rod('V2 • fine branch',end,tip,.025,bark,.006,6);centers.append(tip)
 foliage('V2 • individual canopy leaves',centers,40,h*.125,autumn)

def grass_patch(bounds,count,exclude=lambda x,y:False):
 vs=[];fs=[];ids=[]
 for _ in range(count):
  x=random.uniform(bounds[0],bounds[1]);y=random.uniform(bounds[2],bounds[3])
  if exclude(x,y):continue
  for k in range(5):
   a=random.random()*math.tau;w=random.uniform(.012,.025);h=random.uniform(.13,.46);i=len(vs);vs.extend([(x-math.cos(a)*w,y-math.sin(a)*w,.008),(x+math.cos(a)*w,y+math.sin(a)*w,.008),(x+.06*math.sin(a),y+.06*math.cos(a),h*.65),(x+.13*math.sin(a),y+.13*math.cos(a),h)]);fs.extend([(i,i+1,i+2),(i,i+2,i+3)]);ids.extend([random.choice([2,3,4])]*2)
 mesh('V2 • meadow grass blades',vs,fs,leafm,ids)

def scatter_leaves(bounds,count,exclude=lambda x,y:False):
 vs=[];fs=[];ids=[]
 for _ in range(count):
  x=random.uniform(bounds[0],bounds[1]);y=random.uniform(bounds[2],bounds[3]);
  if exclude(x,y):continue
  a=random.random()*6.28;r=random.uniform(.035,.10);i=len(vs);vs.extend([(x+math.cos(a)*r,y+math.sin(a)*r,.018),(x-math.sin(a)*r*.45,y+math.cos(a)*r*.45,.023),(x-math.cos(a)*r,y-math.sin(a)*r,.018),(x+math.sin(a)*r*.45,y-math.cos(a)*r*.45,.02)]);fs.append((i,i+1,i+2,i+3));ids.append(random.choice([0,1,2,4]))
 mesh('V2 • fallen autumn leaves',vs,fs,leafm,ids)

def poster(x,y,z,title,subtitle,w=.55,h=.75):
 box('V2 • poster backing',(x,y,z),(w,.016,h),dark,.002);box('V2 • faded printed stock',(x,y-.012,z),(w-.025,.004,h-.025),paper,.001)
 text(title,(x,y-.019,z+h*.27),w*.14,red)
 text(subtitle,(x,y-.020,z-h*.31),w*.053,dark)
 # Geometric printed sunset and landscape, deliberately authored graphic rather than noise.
 o=rod('V2 • printed sun',(x,y-.019,z+.005),(x,y-.024,z+.005),w*.18,red,n=32)
 vs=[(x-w*.40,y-.027,z-h*.19),(x-w*.14,y-.027,z+h*.06),(x+w*.08,y-.027,z-h*.13),(x+w*.24,y-.027,z+h*.02),(x+w*.40,y-.027,z-h*.19)]
 mesh('V2 • printed landscape',vs,[(0,1,2),(2,3,4)],[teal])

def book(loc,dim=(.18,.25,.04),color=None,rot=0):
 x,y,z=loc;w,d,h=dim;box('V2 • book pages',loc,(w,d,h),paper,.002);a=box('V2 • book cover',(x,y,z+h*.55),(w+.012,d+.012,.008),color or teal,.001);a.rotation_euler.z=rot

def plant(x,y,z=.0,size=.5):
 rod('V2 • terracotta pot',(x,y,z),(x,y,z+size*.45),size*.21,red,size*.28,16)
 cs=[]
 for i in range(9):
  a=i*2.4;end=(x+math.cos(a)*size*.35,y+math.sin(a)*size*.35,z+size*random.uniform(.8,1.4));rod('V2 • plant stem',(x,y,z+size*.3),end,.007,bark,.003,5);cs.append(end)
 foliage('V2 • houseplant leaves',cs,6,size*.10,False)

# Rebuild source materials: fine material-specific texture, restrained edge bevel, no large clay blotches.
for m in list(bpy.data.materials):
 if m.name.startswith('V2'):continue
 if not m.use_nodes:continue
 p=m.node_tree.nodes.get('Principled BSDF')
 if not p:continue
 if m.name=='velvet':
  for l in list(p.inputs['Base Color'].links):m.node_tree.links.remove(l)
  p.inputs['Base Color'].default_value=(.19,.012,.018,1);p.inputs['Roughness'].default_value=.8;p.inputs['Sheen Weight'].default_value=.45
 if m.name=='leather':
  for l in list(p.inputs['Base Color'].links):m.node_tree.links.remove(l)
  p.inputs['Base Color'].default_value=(.045,.022,.019,1);p.inputs['Roughness'].default_value=.4
 if m.name=='Warm ivory porcelain':p.inputs['Base Color'].default_value=(.65,.60,.45,1)
 for n in m.node_tree.nodes:
  if n.type=='BUMP':n.inputs['Strength'].default_value=.12;n.inputs['Distance'].default_value=.004
for o in s.objects:
 if o.type=='MESH':
  for mod in o.modifiers:
   if mod.type=='BEVEL':mod.width*=.55
 if o.type=='LIGHT':o.data.energy*=.12
 if 'Atmosphere volume' in o.name:
  for m in o.data.materials:
   for n in m.node_tree.nodes:
    if n.type=='PRINCIPLED_VOLUME':n.inputs['Density'].default_value=.004
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.38,.55,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.19

if MODE=='diner':
 for prefixes,pivot,scale in [(['Hero coffee','Coffee cup','Coffee black','Cup saucer'],(-.55,-.6,1.04),.73),(['Pie plate','Pie pastry','Crimped pie','Pastry crimp','Glazed cherry','Pastry lattice'],(.62,-.45,1.04),.85)]:
  transform=Matrix.Translation(Vector(pivot)) @ Matrix.Scale(scale,4) @ Matrix.Translation(-Vector(pivot))
  for o in s.objects:
   if any(o.name.startswith(k) for k in prefixes):o.matrix_world=transform @ o.matrix_world
 delete(['Pine wall','Rain blue window','Rain rivulet','Window deep reveal','Cold window fill'])
 wall=mat('V2 • muted jade plaster',(.105,.20,.16),.94,grain=1)
 box('V2 • back wall lower',(0,4,.60),(12,.22,1.2),wood)
 box('V2 • back wall upper',(0,4,3.62),(12,.22,.70),wall)
 for x in [-5.5,-2.5,.5,3.5,6.5]:box('V2 • window wall pier',(x,4,2.23),(.7,.22,2.12),wall)
 box('V2 • left wall',(-5.6,.7,1.9),(.2,6.8,3.8),wall)
 box('V2 • ceiling',(0,1.1,3.95),(12,6,.12),cream)
 for x in range(-5,6):box('V2 • ceiling timber',(x,1.1,3.83),(.045,6,.06),wood)
 # Actual open windows let a low, directed light cast frames and foliage onto the interior.
 for x in [-4,-1,2,5]:
  for z in [1.19,2.2,3.28]:box('V2 • window horizontal rail',(x,3.71,z),(2.35,.11,.055),wood)
  box('V2 • window sill',(x,3.56,1.19),(2.45,.4,.08),cream)
  for j in range(6):box('V2 • raised venetian blind',(x,3.55,3.20-j*.043),(2.18,.15,.025),cream,.002).rotation_euler.x=-.16
  for dx in [-.85,.85]:curve('V2 • blind pull cord',[(x+dx,3.45,3.28),(x+dx,3.45,2.65)],.003,paper)
 for x,y,h in [(-4,7,6),(-.5,8,7),(3,7,6),(6,9,8),(-8,10,8)]:tree(x,y,h)
 box('V2 • exterior ground',(0,12,-.18),(40,22,.2),soil)
 for x in [-4,-1,2]:plant(x+.8,3.55,1.23,.32)
 for x,title in [(-2.5,'NIGHT SHIFT'),(.5,'LAST SUMMER'),(3.5,'LOST SIGNAL')]:poster(x,3.83,2.32,title,'LIVE / FRIDAY / 10 PM',.52,.79)
 # Counter at left with stacked cups, coffee urn and an original framed menu.
 box('V2 • side counter',(-4.25,-.5,.53),(1.0,3.8,1.06),wood);box('V2 • counter top',(-4.25,-.5,1.10),(1.1,3.95,.09),cream)
 for y in [-1.4,-.8,-.2]:
  rod('V2 • sugar jar',(-4.3,y,1.15),(-4.3,y,1.36),.085,cream,n=20);rod('V2 • jar cap',(-4.3,y,1.36),(-4.3,y,1.39),.09,gold,n=20)
 rod('V2 • coffee urn',(-4.3,.8,1.15),(-4.3,.8,1.70),.19,dark,n=24);rod('V2 • coffee urn lid',(-4.3,.8,1.70),(-4.3,.8,1.73),.205,gold,n=24)
 for x in [-3.3,.3,3.9]:
  box('V2 • napkin dispenser',(x+.7,1.7,1.12),(.15,.13,.25),gold);box('V2 • visible napkins',(x+.7,1.626,1.12),(.115,.009,.17),paper)
  for dx in [0,.14]:rod('V2 • salt pepper shaker',(x-.8+dx,1.7,1.0),(x-.8+dx,1.7,1.14),.03,cream,n=12)
 # Hero cassette sleeve, pencil, dog-eared album and headphones.
 book((.80,.05,1.08),(.44,.32,.035),teal);text('SIDE B',(.80,.04,1.107),.07,paper,(0,0,0))
 rod('V2 • pencil',(-1.25,-.2,1.06),(-.83,.12,1.06),.009,red,n=6)
 curve('V2 • headphone band',[(.6,-.95,1.07),(.8,-.88,1.19),(1.05,-.95,1.20),(1.20,-1.12,1.08)],.022,dark)
 for x,y in [(.61,-.97),(1.19,-1.11)]:sphere('V2 • headphone pad',(x,y,1.08),(.10,.075,.035),dark)
 text('THE TOMORROW TAPE',(-.08,-.99,1.147),.022,paper,(0,0,0))
 for x in [-5,-3,-1,1,3,5]:
  foliage('V2 • window garden shrubs',[(x,6,1.5),(x+.3,6.4,2.2),(x-.25,6.3,2.9)],110,.7,True)
 light('V2 • sun through window',(-3.8,4.5,3.15),(0,-1,1),1100,(1,.72,.40),.45)
 light('V2 • afternoon outdoor sun',(-6,8,8),(0,0,0),1.25,(1,.75,.46),.07,'SUN')
 light('V2 • reflected table warmth',(-2,-2,3),(0,0,1),95,(1,.80,.58),3)
 s.world.node_tree.nodes['Background'].inputs[0].default_value=(.42,.57,.70,1)
 s.world.node_tree.nodes['Background'].inputs[1].default_value=.34
 light('V2 • room bounce',(2,-4,3),(0,1,1),90,(.49,.66,1),4)
 camera((3.35,-5.2,2.55),(-.25,1.05,1.55),37)

elif MODE=='motel':
 delete(['Fir trunk','Fir layered boughs','Bare branch','Rain puddle','Wet blue moon'])
 # Reconstruct thin architectural trim rather than oversize rounded slabs.
 for o in s.objects:
  if o.name.startswith('Painted motel door'):o.data.materials.clear();o.data.materials.append(teal)
 box('V2 • raised porch slab',(0,1.05,.06),(11.5,1.7,.12),stone)
 for x in [-5.35,-1.8,1.8,5.35]:
  box('V2 • porch support',(x,.46,1.73),(.12,.12,3.3),cream)
  box('V2 • support foot',(x,.46,.18),(.22,.22,.24),stone)
 box('V2 • porch fascia',(0,.45,3.25),(11.65,.13,.19),wood)
 box('V2 • porch roof',(0,1.0,3.38),(11.8,1.7,.12),dark)
 for x in [-3.6,0,3.6]:
  # Panel outlines and peepholes humanize scale.
  for z in [.65,1.6]:
   for dx in [-.33,.33]:box('V2 • door panel trim',(x+dx,1.556,z),(.025,.015,.65),wood,.003)
   for zz in [-.325,.325]:box('V2 • door panel trim',(x,1.55,z+zz),(.66,.015,.025),wood,.003)
  sphere('V2 • peephole',(x,1.545,1.80),(.016,.012,.016),gold)
  box('V2 • doormat',(x,.90,.132),(.7,.4,.018),wood)
  for j in range(12):box('V2 • woven mat line',(x-.32+j*.058,.90,.143),(.018,.36,.005),soil,.001)
  plant(x-.74,.55,.12,.48)
  box('V2 • window sill',(x+1.2,1.42,1.15),(.90,.35,.065),cream)
  for j in range(9):box('V2 • motel blind',(x+1.2,1.62,1.22+j*.115),(.72,.045,.037),cream,.001)
 for x,y,h in [(-8,5,9),(-4,8,9),(0,10,10),(5,8,8),(9,6,10),(-10,11,11),(11,13,11)]:tree(x,y,h)
 for x in [-7,7]:plant(x,1.2,0,1.5)
 # Original posters and signage, utility wiring and weathered road details.
 poster(-2.1,1.74,2.0,'KEEP DRIVING','LAST STOP / 315',.45,.65)
 curve('V2 • porch electrical cable',[(-5.5,.29,3.12),(0,.29,2.95),(5.5,.29,3.12)],.009,dark)
 for x in [-4.8,-2.4,0,2.4,4.8]:sphere('V2 • porch bulb',(x,.27,3.02),(.028,.028,.05),bulb)
 for i in range(17):
  x=random.uniform(-9,9);y=random.uniform(-8,0);curve('V2 • asphalt crack',[(x,y,.012),(x+.2,y+.1,.012),(x+.3,y+.6,.012),(x+.6,y+.8,.012)],.008,dark)
 grass_patch((-11,11,-1,7),2800,lambda x,y:abs(x)<5.8 and y>.0)
 scatter_leaves((-9,9,-8,2),850)
 # Foreground roadside pole and sagging wire frame the camera.
 rod('V2 • telephone pole',(-7,-1,0),(-7,-1,9),.14,wood,.10)
 box('V2 • utility crossarm',(-7,-1,8),(2.4,.12,.12),wood)
 for dx in [-.8,.8]:curve('V2 • overhead line',[(-7+dx,-1,8.1),(0,6,7.2),(8,14,8.5)],.012,dark)
 light('V2 • low western sun',(-8,-6,12),(0,3,0),2.0,(1,.64,.30),.045,'SUN')
 light('V2 • blue dusk fill',(5,-6,7),(0,3,1),220,(.37,.54,1),7)
 camera((10.5,-14,3.3),(0,2.3,2.1),43)

elif MODE=='redroom':
 # Darker, asymmetric photographic framing with tactile upholstery and foreground story objects.
 for o in s.objects:
  if o.type=='LIGHT':o.data.energy*=.25
 # Buttoned backrests and seam piping refine the silhouette without swelling the furniture.
 for x in [-2,2]:
  for z in [.82,1.06,1.30]:
   for dx in [-.30,0,.30]:sphere('V2 • dark upholstery tuft',(x+dx,1.64,z),(.024,.016,.024),gold,1)
  curve('V2 • upholstery top seam',[(x-.46,1.76,1.51),(x,1.71,1.56),(x+.46,1.76,1.51)],.006,wood)
 # A readable foreground audio station replaces empty unmotivated floor.
 box('V2 • walnut listening console',(-2.6,-1.6,.53),(1.3,.72,1.06),wood,.018)
 for x in [-3.18,-2.02]:box('V2 • console side detail',(x,-1.96,.5),(.04,.025,.8),gold,.004)
 box('V2 • turntable plinth',(-2.6,-1.6,1.11),(1.10,.62,.075),dark)
 rod('V2 • vinyl record',(-2.78,-1.6,1.15),(-2.78,-1.6,1.158),.23,dark,n=64)
 rod('V2 • record label',(-2.78,-1.6,1.159),(-2.78,-1.6,1.162),.07,red,n=32)
 curve('V2 • tonearm',[(-2.2,-1.40,1.18),(-2.25,-1.62,1.20),(-2.50,-1.72,1.17)],.012,gold)
 for i in range(9):book((-2.60,-1.6,.18+i*.045),(.78,.55,.028),teal if i%2 else red)
 text('PLAY THE OTHER SIDE',(-2.6,-1.973,.87),.062,paper)
 # Hanging chandelier; each practical contributes local pools of warm light.
 curve('V2 • chandelier stem',[(0,1.2,5.1),(0,1.2,3.95)],.016,gold)
 for i in range(6):
  a=i*math.tau/6;x=math.cos(a)*.8;y=1.2+math.sin(a)*.8
  curve('V2 • chandelier arm',[(0,1.2,4.0),(x*.6,1.2+(y-1.2)*.6,3.75),(x,y,3.88)],.015,gold)
  rod('V2 • candle socket',(x,y,3.86),(x,y,4.02),.045,gold)
  sphere('V2 • candle bulb',(x,y,4.09),(.035,.035,.085),bulb)
 light('V2 • amber chandelier',(0,1.2,3.95),(0,1,0),100,(1,.62,.32),.35,'POINT')
 light('V2 • dramatic side key',(-4,-2,4),(-1,1,1),380,(1,.74,.46),1.5)
 light('V2 • blue edge',(4,1,3),(0,1,1),100,(.34,.43,1),1.8)
 light('V2 • curtain grazing',(0,3.6,.3),(0,4.2,3),80,(1,.16,.05),1.2)
 s.world.node_tree.nodes['Background'].inputs[1].default_value=.055
 camera((3.9,-7.3,2.1),(-.55,1.25,1.65),35)

elif MODE=='forest':
 delete(['Fir','Detailed fir','Bare','Pale circle','River pebble','Forest earth','Doorway tree','Moon through','Warm last','Beyond the'])
 box('V2 • deep forest floor',(0,4,-.20),(60,65,.35),soil)
 # A natural clearing replaces the mathematically spaced ring.
 positions=[(-5,-1,9),(-3.5,2,8),(-5,6,11),(-2.9,8,9),(3.7,3,9),(6,0,10),(5.8,7,10),(1,10,10),(-7,11,11),(7,12,11),(-9,3,11),(9,7,12),(0,15,12),(-5,18,11),(7,18,12)]
 for x,y,h in positions:tree(x,y,h,True)
 for x in [-1.38,1.38]:rod('V2 • threshold ancient post',(x,4,0),(x,4,4.45),.11,wood,.07,9)
 rod('V2 • threshold lintel',(-1.50,4,4.3),(1.50,4,4.3),.11,wood,.11,9)
 grass_patch((-10,10,-6,15),11500,lambda x,y:x*x+(y-1)**2<8.6 or (abs(x)<1.25 and y<-1))
 scatter_leaves((-9,9,-6,13),1800,lambda x,y:x*x+(y-1)**2<7)
 for i in range(35):
  a=random.random()*math.tau;r=random.uniform(3.0,7.5);x=math.cos(a)*r;y=1+math.sin(a)*r
  sphere('V2 • mossy rock',(x,y,random.uniform(.02,.15)),(random.uniform(.15,.55),random.uniform(.18,.65),random.uniform(.15,.45)),stone)
 for x,y in [(-3,-.4),(3.5,1),(-4,4),(4,6)]:
  # Fern fronds with alternating narrow leaves.
  cs=[]
  for k in range(7):
   a=k*math.tau/7;tip=(x+math.cos(a)*.75,y+math.sin(a)*.75,.42);curve('V2 • fern stem',[(x,y,.03),(x+math.cos(a)*.4,y+math.sin(a)*.4,.58),tip],.007,bark)
   for t in [.3,.45,.6,.75,.9]:cs.append((x+math.cos(a)*.75*t,y+math.sin(a)*.75*t,.55*math.sin(t*2)))
  foliage('V2 • fern leaflets',cs,4,.09,False)
 # Trunk roots and a fallen log avoid planted-on-flat-ground silhouettes.
 rod('V2 • fallen birch',(-5,-.2,.3),(-3.2,2,.35),.20,bark,.15,11)
 for x,y,h in positions[:7]:
  for a in [0,2,4]:rod('V2 • surface root',(x,y,.18),(x+math.cos(a)*.8,y+math.sin(a)*.8,.02),.11,bark,.025,7)
 light('V2 • autumn shafts',(-7,8,12),(0,-1,0),2.1,(1,.65,.28),.035,'SUN')
 light('V2 • clearing soft fill',(3,-5,6),(0,2,1),150,(.38,.56,1),5)
 light('V2 • curtain reflected ember',(0,3.6,1.4),(0,0,0),55,(1,.18,.055),2)
 camera((5.1,-10,2.6),(0,2.3,1.9),35)

if MODE=='forest':
 # Fill the middle distance and light beneath the canopy: a usable narrative environment.
 for x in range(-18,19,2):
  foliage('V2 • layered forest understory',[(x,13,1.5),(x+.4,14,2.4),(x-.25,15,3.2)],95,1.0,False)
 for i in range(22):
  x=random.uniform(-18,18);y=random.uniform(18,26)
  rod('V2 • distant forest trunk',(x,y,0),(x+.15,y,random.uniform(6,9)),.09,bark,.035,7)
 sphere('V2 • distant wooded ridge',(-12,30,1),(22,10,5),leafm[3],3)
 sphere('V2 • distant wooded ridge',(14,34,1),(24,12,6),leafm[2],3)
 light('V2 • warm clearing key',(-3,-3,5),(0,2,1),1600,(1,.73,.43),3.0)
 light('V2 • canopy blue bounce',(4,-1,4),(0,3,1),600,(.43,.63,1),5)
 light('V2 • threshold accent',(1,1.0,3),(0,4,2),220,(1,.65,.37),2)
 s.world.node_tree.nodes['Background'].inputs[1].default_value=.42
 for o in s.objects:
  if o.type=='LIGHT' and o.name=='V2 • curtain reflected ember':o.data.energy=12
 m=bpy.data.materials.get('Still black pool')
 if m:
  p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.18;p.inputs['IOR'].default_value=1.33;p.inputs['Specular IOR Level'].default_value=.25

if MODE=='redroom':
 delete(['V2 • dark upholstery tuft','V2 • upholstery top seam'])
 for o in s.objects:
  if 'red silk curtain' in o.name:o.scale.z*=1.4

# Human scale, modest bloom, deep shadows, restrained texture. No 2D backdrop substitutes for models.
s.render.engine='CYCLES';s.cycles.samples=24 if MODE in ['forest','diner','redroom'] else 32;s.cycles.use_denoising=True;s.cycles.adaptive_threshold=.05;s.cycles.max_bounces=5;s.cycles.volume_bounces=1
s.render.threads_mode='FIXED';s.render.threads=4
s.render.resolution_x=1440;s.render.resolution_y=900;s.render.resolution_percentage=100
s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=0
s.render.image_settings.file_format='PNG';s.render.fps=24
s['art_direction']='V2: studied official mixtape.game gallery; human-scale lived-in sets, dense branching foliage, light/shadow hierarchy. Original geometry and story.'
NEW.asset_mark()
for m in bpy.data.materials:
 if m.users:m.asset_mark()
bpy.context.preferences.filepaths.save_version=0
for im in bpy.data.images:
 if im.source=='FILE' and im.users:im.pack()
# Purge orphan data from rebuilt sets without touching original source files.
for _ in range(3):bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=False,do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(R/'scenes'/f'{MODE}-v2.blend'),compress=True)
s.render.filepath=str(R/'previews'/f'{MODE}-v2.png')
print('REBUILT',MODE,len(s.objects),flush=True)
bpy.ops.render.render(write_still=True)
