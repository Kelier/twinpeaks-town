import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent
OUT=R.parents[1]/'public/models/twin-peaks'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
 if c.name!='Collection' and c.users==0:bpy.data.collections.remove(c)
random.seed(11)
CHAR=None;ROOT=None;group=None

def material(name,c,rough=.55,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
skin=material('Paint • warm porcelain skin',(.55,.32,.22),.66)
blush=material('Paint • ear and lips',(.34,.105,.078),.65)
black=material('Cloth • graphite wool',(.024,.031,.037),.86)
lapel=material('Cloth • lapel satin',(.045,.055,.065),.52)
white=material('Cloth • warm ivory cotton',(.78,.75,.65),.82)
hair=material('Hair • espresso',(.025,.014,.012),.56)
hairline=material('Hair • carved highlights',(.07,.038,.022),.6)
eye=material('Eye • ivory',(.82,.80,.7),.34)
iris=material('Eye • hazel green',(.115,.17,.12),.38)
pupil=material('Eye • pupil',(.003,.005,.004),.25)
leather=material('Leather • oxford',(.019,.023,.025),.34)
gold=material('Metal • aged brass',(.50,.29,.075),.32,.7)
wood=material('Wood • walnut miniature frame',(.11,.052,.023),.63)
walnut=material('Wood • honey counter',(.29,.14,.055),.56)
red=material('Vinyl • oxblood',(.28,.025,.028),.48)
velvet=material('Velvet • red curtain',(.31,.014,.025),.94)
teal=material('Paint • diner teal',(.064,.17,.15),.75)
cream=material('Paint • warm plaster',(.57,.52,.39),.88)
forest=material('Foliage • Douglas fir',(.035,.095,.068),.9)
forestlight=material('Foliage • sage tips',(.07,.17,.12),.9)
stone=material('Rock • charcoal slate',(.12,.16,.16),.95)
water=material('Water • painted lake',(.06,.19,.21),.22,.25)
mirror=material('Mirror • silver',(.45,.57,.58),.12,.85)
blue=material('Cloth • Audrey skirt',(.18,.055,.058),.86)
blonde=material('Hair • Laura golden',(.43,.24,.082),.64)
tan=material('Cloth • sheriff tan',(.37,.29,.16),.83)
lightmat=material('Light • golden glass',(.9,.52,.16),.35)
p=lightmat.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.49,.12,1);p.inputs['Emission Strength'].default_value=.7
# Physical fabric grain is authored in Blender; base colors remain portable in glTF.
for m in [black,lapel,white,red,tan,velvet]:
 n=m.node_tree.nodes;l=m.node_tree.links;no=n.new('ShaderNodeTexNoise');no.inputs['Scale'].default_value=180;no.inputs['Detail'].default_value=2;b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=.08;b.inputs['Distance'].default_value=.002;l.new(no.outputs['Fac'],b.inputs['Height']);l.new(b.outputs[0],n.get('Principled BSDF').inputs['Normal'])

def own(o,name,m=None,bone=None):
 o.name=name
 if group:
  for c in list(o.users_collection):c.objects.unlink(o)
  group.objects.link(o)
 if ROOT:o.parent=ROOT
 if m:o.data.materials.append(m)
 if CHAR and o.type in ['MESH','CURVE']:o['bind_bone']=bone or 'spine'
 return o

def mesh(name,v,f,m,bone=None,smooth=True):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);own(o,name,m,bone)
 for p in d.polygons:p.use_smooth=smooth
 return o

def ell(name,loc,scale,m,bone=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=1,location=loc);o=own(bpy.context.object,name,m,bone);o.scale=scale
 for p in o.data.polygons:p.use_smooth=True
 return o

def box(name,loc,dim,m,bevel=.025,bone=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=own(bpy.context.object,name,m,bone);o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:mo=o.modifiers.new('Soft handcrafted edge','BEVEL');mo.width=bevel;mo.segments=2;o.modifiers.new('Corner normals','WEIGHTED_NORMAL')
 return o

def rod(name,a,b,r,m,r2=None,bone=None,vertices=16):
 a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2==None else r2,depth=d.length,location=(a+b)/2);o=own(bpy.context.object,name,m,bone);o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
 for p in o.data.polygons:p.use_smooth=True
 return o

def curve(name,points,r,m,bone=None):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=8;d.bevel_depth=r;d.bevel_resolution=2;sp=d.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for a,p in zip(sp.bezier_points,points):a.co=p;a.handle_left_type='AUTO';a.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return own(o,name,m,bone)

def loft(name,rings,m,bone=None,n=40,detail=None):
 v=[];f=[]
 for z,rx,ry,cy in rings:
  for j in range(n):
   t=2*math.pi*j/n;x=rx*math.sin(t);y=cy-ry*math.cos(t)
   if detail:y+=detail(x,z)*max(0,math.cos(t))**8
   v.append((x,y,z))
 for k in range(len(rings)-1):
  for j in range(n):a=k*n+j;b=k*n+(j+1)%n;f.append((a,b,b+n,a+n))
 f.append(tuple(reversed(range(n))));f.append(tuple((len(rings)-1)*n+j for j in range(n)))
 return mesh(name,v,f,m,bone)

def text(body,loc,size,m=cream,rot=(math.pi/2,0,0),name=None):
 d=bpy.data.curves.new(body,'FONT');d.body=body;d.size=size;d.align_x='CENTER';d.extrude=.001;o=bpy.data.objects.new(name or body,d);bpy.context.collection.objects.link(o);own(o,name or body,m);o.location=loc;o.rotation_euler=rot;return o

def patch(name,points,m,thick=.006,bone='spine'):
 o=mesh(name,points,[tuple(range(len(points)))],m,bone);s=o.modifiers.new('Tailored thickness','SOLIDIFY');s.thickness=thick;b=o.modifiers.new('Tailored edge','BEVEL');b.width=.003;b.segments=2;return o

# Sculpted ring surface: cheek volumes, continuous nose bridge and recessed orbital planes.
def make_character(kind):
 global CHAR,ROOT,group
 group=bpy.data.collections.new('CHARACTER • '+kind);bpy.context.scene.collection.children.link(group);ROOT=None
 root=bpy.data.objects.new(kind+' • asset root',None);group.objects.link(root);ROOT=root;CHAR=kind
 female=kind in ['Laura Palmer','Audrey Horne']; giant=kind=='The Giant';sheriff=kind=='Harry Truman'
 suit=tan if sheriff else (blue if female else black)
 headz=0
 def face(x,z):
  g=lambda c,w:math.exp(-((z-c)/w)**2)
  nose=-.052*math.exp(-(x/.020)**2)*g(1.797,.05)-.029*math.exp(-(x/.031)**2)*g(1.774,.017)
  sockets=.018*(math.exp(-((x-.065)/.043)**2)+math.exp(-((x+.065)/.043)**2))*g(1.832,.025)
  cheeks=-.012*(math.exp(-((x-.09)/.037)**2)+math.exp(-((x+.09)/.037)**2))*g(1.786,.04)
  mouth=-.01*math.exp(-(x/.050)**2)*g(1.718,.028)
  return nose+sockets+cheeks+mouth
 profile=[(1.60,.047,.058,.003),(1.62,.078,.086,0),(1.65,.108,.099,0),(1.69,.128,.107,0),(1.74,.139,.114,.003),(1.79,.143,.123,.008),(1.84,.144,.135,.011),(1.89,.142,.14,.014),(1.94,.134,.135,.02),(1.98,.112,.113,.024),(2.01,.066,.067,.02),(2.02,.008,.009,.02)]
 # Add intermediate rings to carry smooth but intentional facial planes.
 rings=[]
 for a,b in zip(profile[:-1],profile[1:]):
  for j in range(4):rings.append(tuple(a[k]+(b[k]-a[k])*j/4 for k in range(4)))
 rings.append(profile[-1]);head=loft('Face • continuous cheek jaw nose sculpt',rings,skin,'head',80,face)
 for side in [-1,1]:
  ell('Ear '+str(side),(side*.144,.004,1.804),(.027,.019,.052),skin,'head');ell('Ear inner '+str(side),(side*.154,-.013,1.801),(.012,.007,.028),blush,'head')
  x=side*.064;z=1.834;w=.042;h=.016
  pts=[(x+w*math.cos(t),-.120-.004*math.sin(t),z+h*math.sin(t)) for t in [j*2*math.pi/40 for j in range(40)]]
  mesh('Almond eye '+str(side),[(x,-.128,z)]+pts,[(0,j+1,(j+1)%40+1) for j in range(40)],eye,'head')
  ell('Iris '+str(side),(x,-.130,z),(.013,.003,.013),iris,'head');ell('Pupil '+str(side),(x,-.133,z),(.006,.002,.0075),pupil,'head');ell('Catchlight '+str(side),(x-.004,-.135,z+.005),(.0025,.0015,.0025),white,'head')
  curve('Upper eyelid '+str(side),[(x-w,-.119,z),(x-.022,-.128,z+.015),(x+.012,-.127,z+.017),(x+w,-.118,z)],.0034,blush,'head')
  curve('Sculpted strong brow '+str(side),[(x-w,-.132,1.87),(x-.018,-.142,1.882),(x+.016,-.139,1.879),(x+w,-.123,1.865)],.007 if not female else .0045,hair,'head')
  ell('Nostril '+str(side),(side*.019,-.166,1.765),(.007,.003,.004),blush,'head')
 curve('Upper lip cupid bow',[(-.045,-.115,1.719),(-.016,-.125,1.723),(0,-.126,1.72),(.017,-.125,1.723),(.045,-.115,1.719)],.0034,blush,'head')
 curve('Lower lip',[(-.038,-.116,1.713),(0,-.128,1.709),(.038,-.116,1.713)],.004,blush,'head')
 rod('Neck',(0,.018,1.49),(0,.018,1.65),.068,skin,bone='neck')
 # One continuous tailored torso, no detached primitive gaps.
 loft('Tailored jacket body',[(.95,.172,.11,.028),(1.02,.183,.126,.018),(1.16,.168,.119,.012),(1.31,.19,.133,.01),(1.44,.228,.132,.015),(1.48,.23,.105,.03),(1.51,.15,.081,.029)],suit,'spine')
 patch('Ivory shirt front',[(-.075,-.102,1.50),(.075,-.102,1.50),(.055,-.14,1.28),(0,-.145,1.23),(-.055,-.14,1.28)],white)
 for side in [-1,1]:
  patch('Notched lapel '+str(side),[(side*.074,-.115,1.49),(side*.185,-.106,1.425),(side*.125,-.155,1.38),(side*.152,-.143,1.353),(side*.037,-.153,1.15)],lapel if not female else suit)
  patch('Point collar '+str(side),[(side*.006,-.102,1.528),(side*.070,-.098,1.514),(side*.093,-.13,1.424),(side*.021,-.15,1.47)],white)
 if not female:
  ell('Tie knot',(0,-.14,1.47),(.021,.015,.029),black)
  patch('Black silk tie',[(-.012,-.15,1.45),(.012,-.15,1.45),(.025,-.155,1.19),(0,-.16,1.16),(-.025,-.155,1.19)],black)
 for z in [1.11,1.02]:ell('Jacket button',(.029,-.122,z),(.009,.005,.009),gold if sheriff else black)
 curve('Pocket welt',[(-.155,-.13,1.345),(-.085,-.144,1.345)],.004,lapel)
 for side in [-1,1]:
  curve('Hip pocket '+str(side),[(side*.08,-.127,1.07),(side*.16,-.104,1.077)],.004,lapel)
  arm='upper_arm.'+('L' if side>0 else 'R');fore='forearm.'+('L' if side>0 else 'R');handbone='hand.'+('L' if side>0 else 'R')
  rod('Jacket sleeve upper '+str(side),(side*.207,.017,1.44),(side*.312,.006,1.19),.095,suit,.073,arm,24)
  ell('Sleeve shoulder '+str(side),(side*.218,.021,1.417),(.083,.092,.083),suit,arm)
  rod('Jacket sleeve forearm '+str(side),(side*.312,.006,1.19),(side*.355,-.033,.945),.074,suit,.052,fore,24)
  rod('White cuff '+str(side),(side*.355,-.033,.96),(side*.358,-.034,.916),.052,white,.048,fore)
  ell('Hand palm '+str(side),(side*.36,-.033,.879),(.047,.026,.062),skin,handbone)
  for j in range(4):
   x=side*.36+(j-1.5)*.021;top=.865;end=.797+[.014,0,.007,.022][j]
   rod('Finger '+str(side)+' '+str(j),(x,-.04,top),(x,-.042,end),.010,skin,.008,handbone,10);ell('Finger tip',(x,-.042,end),(.008,.009,.01),skin,handbone)
  rod('Thumb '+str(side),(side*.323,-.04,.906),(side*.307,-.064,.855),.014,skin,.011,handbone,12)
  leg='thigh.'+('L' if side>0 else 'R');shin='shin.'+('L' if side>0 else 'R')
  rod('Trouser upper '+str(side),(side*.091,.014,1.01),(side*.102,.014,.57),.105,suit,.078,leg,24)
  rod('Trouser lower '+str(side),(side*.102,.014,.59),(side*.113,.013,.13),.08,suit,.063,shin,24)
  curve('Pressed trouser crease '+str(side),[(side*.104,-.064,.55),(side*.111,-.051,.19)],.0025,lapel,shin)
  ell('Polished Oxford '+str(side),(side*.115,-.052,.092),(.076,.151,.061),leather,'foot.'+('L' if side>0 else 'R'))
  box('Oxford sole',(side*.115,-.05,.05),(.151,.282,.02),black,.017,'foot.'+('L' if side>0 else 'R'))
  for k in range(4):curve('Shoe lace',[(side*.115-.025,-.06-k*.012,.146-k*.003),(side*.115+.025,-.06-k*.012,.146-k*.003)],.0018,lapel,'foot.'+('L' if side>0 else 'R'))
 # Swept crown is a separate continuous cap; ridges follow the parting direction.
 if not giant:
  hm=blonde if kind=='Laura Palmer' else hair
  loft('Sculpted swept hair cap',[(1.865,.142,.105,.046),(1.93,.15,.14,.025),(1.975,.148,.14,.025),(2.025,.116,.115,.012),(2.052,.061,.062,-.007),(2.055,.003,.003,-.01)],hm,'head',48)
  for j in range(8):
   t=j/7;curve('Swept hair lock '+str(j),[(-.13+t*.032,-.073,1.94+t*.02),(-.10+t*.045,-.123,1.991+t*.018),(.035+t*.075,-.086,2.04-t*.018),(.135,.015,1.977-t*.021)],.008 if not female else .012,hm,'head')
  if female:
   for side in [-1,1]:
    ell('Hair bob '+str(side),(side*.128,.055,1.81),(.062,.082,.19 if kind=='Laura Palmer' else .135),hm,'head')
 if sheriff:
  ell('Sheriff hat brim',(0,.023,2.025),(.224,.208,.017),tan,'head');loft('Sheriff hat crown',[(2.02,.139,.132,.027),(2.13,.12,.108,.027),(2.15,.08,.08,.027)],tan,'head');ell('Sheriff badge',(-.105,-.15,1.38),(.024,.008,.032),gold)
 if giant:root.scale=(.92,.92,1.34)
 if female:root.scale=(.92,.93,.96)
 # Refinement: continuous sleeve/trouser surfaces, with blended elbow/knee weights.
 for o in list(group.objects):
  if o.name.startswith(('Jacket sleeve upper','Jacket sleeve forearm','Sleeve shoulder','Trouser upper','Trouser lower')):bpy.data.objects.remove(o,do_unlink=True)
 for side,suf in [(1,'L'),(-1,'R')]:
  arings=[(.94,.052,.052,-.033),(1.02,.061,.061,-.02),(1.13,.071,.071,0),(1.20,.077,.077,.007),(1.31,.083,.086,.015),(1.42,.089,.096,.018),(1.485,.043,.06,.022)]
  o=loft('Continuous tailored sleeve '+suf,arings,suit,'upper_arm.'+suf,n=32)
  for v in o.data.vertices:
   z=v.co.z;v.co.x+=side*(.355-(z-.94)/(.545)*.145)
  o['dual_bone']='forearm.'+suf;o['joint_z']=1.20
  o=loft('Continuous pressed trousers '+suf,[(.13,.063,.067,.014),(.24,.066,.072,.012),(.49,.077,.078,.012),(.60,.081,.080,.01),(.81,.091,.095,.013),(1.01,.104,.10,.014)],suit,'thigh.'+suf,n=32)
  o.location.x=side*.11;o['dual_bone']='shin.'+suf;o['joint_z']=.57
 # Female costumes are distinct silhouette designs, not recolored men's suits.
 if female:
  dress=black if kind=='Laura Palmer' else white
  for o in list(group.objects):
   if o.name.startswith(('Notched lapel','Point collar','Jacket button','Hip pocket','Pocket welt','Pressed trouser crease')):bpy.data.objects.remove(o,do_unlink=True);continue
   if o.type=='MESH' and o.name.startswith(('Tailored jacket','Ivory shirt','Continuous tailored sleeve')):o.data.materials.clear();o.data.materials.append(dress)
   if o.name.startswith('Continuous pressed trousers'):
    o.data.materials.clear();o.data.materials.append(black)
  skirt=loft('Laura dress skirt' if kind=='Laura Palmer' else 'Audrey pleated skirt',[(.55,.215,.16,.025),(.62,.209,.152,.02),(.87,.175,.126,.02),(1.06,.165,.12,.02)],black if kind=='Laura Palmer' else blue,'root',48)
  if kind=='Audrey Horne':
   for z,rx,ry in [(.61,.214,.156),(.73,.199,.143),(.85,.18,.13),(.95,.172,.126)]:
    curve('Skirt woven check',[(rx*math.sin(j*math.pi/8),.023-ry*math.cos(j*math.pi/8),z) for j in range(17)],.004,black,'root')
  # Bob cuts have a curved fringe and greater volume around the jaw.
  hm=blonde if kind=='Laura Palmer' else hair
  for side in [-1,1]:
   ell('Face framing bob '+str(side),(side*.14,.035,1.76),(.059,.092,.16),hm,'head')
  for j in range(6):curve('Soft fringe', [(-.125+j*.037,-.11,1.945),(-.1+j*.035,-.146,1.922),(-.08+j*.029,-.134,1.885)],.016,hm,'head')
 if kind in ['Leland Palmer','BOB']:
  grey=material(kind+' silver hair',(.27,.28,.25),.75)
  for o in group.objects:
   if o.type=='MESH' and ('hair' in o.name.lower() or 'brow' in o.name.lower()):o.data.materials.clear();o.data.materials.append(grey)
  if kind=='Leland Palmer':
   for o in list(group.objects):
    if o.name.startswith(('Notched lapel','Black silk tie','Tie knot','Hip pocket','Jacket button')):bpy.data.objects.remove(o,do_unlink=True);continue
    if o.type=='MESH' and o.name.startswith(('Tailored jacket','Continuous tailored sleeve')):o.data.materials.clear();o.data.materials.append(white)
   for side in [-1,1]:curve('Age crease',[(side*.035,-.146,1.766),(side*.054,-.118,1.732),(side*.061,-.105,1.70)],.0017,blush,'head')
  else:
   for side in [-1,1]:
    ell('BOB long hair '+str(side),(side*.143,.045,1.66),(.076,.107,.31),grey,'head')
   for o in group.objects:
    if o.type=='MESH' and o.name.startswith(('Tailored jacket','Continuous tailored sleeve')):o.data.materials.clear();o.data.materials.append(teal)
 if kind=='Pete Martell':
  for o in list(group.objects):
   if o.name.startswith(('Notched lapel','Black silk tie','Tie knot','Point collar')):bpy.data.objects.remove(o,do_unlink=True);continue
   if o.type=='MESH' and o.name.startswith(('Tailored jacket','Continuous tailored sleeve')):o.data.materials.clear();o.data.materials.append(red)
  loft('Pete knitted cap',[(1.96,.157,.145,.025),(2.04,.13,.12,.024),(2.10,.064,.067,.02),(2.11,.004,.004,.02)],forest,'head',40)
  for x in [-.12,-.06,0,.06,.12]:curve('Jacket plaid vertical',[(x,-.137,1.10),(x,-.146,1.35),(x,-.11,1.47)],.009,black)
  for z in [1.12,1.21,1.30,1.39]:curve('Jacket plaid horizontal',[(-.15,-.11,z),(0,-.151,z),(.15,-.11,z)],.007,black)

 # Basic deform rig with locally blended sleeve and leg weights.
 bpy.ops.object.armature_add();rig=own(bpy.context.object,kind+' • performance rig');rig.data.name=kind+' Skeleton';rig.show_in_front=True
 bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0])
 bones=[('root',(0,0,.08),(0,0,.95),None),('spine',(0,0,.95),(0,0,1.48),'root'),('neck',(0,0,1.48),(0,0,1.64),'spine'),('head',(0,0,1.64),(0,0,2.02),'neck')]
 for side,suf in [(1,'L'),(-1,'R')]:bones += [('upper_arm.'+suf,(side*.21,0,1.44),(side*.312,0,1.19),'spine'),('forearm.'+suf,(side*.312,0,1.19),(side*.355,-.03,.945),'upper_arm.'+suf),('hand.'+suf,(side*.355,-.03,.945),(side*.36,-.03,.81),'forearm.'+suf),('thigh.'+suf,(side*.09,0,.99),(side*.10,0,.57),'root'),('shin.'+suf,(side*.10,0,.57),(side*.11,0,.13),'thigh.'+suf),('foot.'+suf,(side*.11,0,.13),(side*.11,-.16,.07),'shin.'+suf)]
 for name,a,b,parent in bones:
  bo=rig.data.edit_bones.new(name);bo.head=a;bo.tail=b
  if parent:bo.parent=rig.data.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT')
 for o in list(group.objects):
  if o.type=='CURVE' and o.get('bind_bone'):
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
  if o.type=='MESH' and o.get('bind_bone'):
   # Bake modifiers and transforms before armature skinning.
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
   for mod in list(o.modifiers):
    try:bpy.ops.object.modifier_apply(modifier=mod.name)
    except:pass
   bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
   vg=o.vertex_groups.new(name=o['bind_bone'])
   if o.get('dual_bone'):
    vg2=o.vertex_groups.new(name=o['dual_bone']);joint=o['joint_z']
    for v in o.data.vertices:
     w=max(0,min(1,(v.co.z-joint+.06)/.12));vg.add([v.index],w,'REPLACE');vg2.add([v.index],1-w,'REPLACE')
   else:vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
   mod=o.modifiers.new('Miniature bone binding','ARMATURE');mod.object=rig
 rig.animation_data_create()
 for f,a in [(1,0),(45,.018),(90,0)]:
  rig.pose.bones['head'].rotation_mode='XYZ';rig.pose.bones['head'].rotation_euler[2]=a;rig.pose.bones['head'].keyframe_insert(data_path='rotation_euler',frame=f)
 if rig.animation_data.action:rig.animation_data.action.name=kind+' • Quiet observation'
 CHAR=None;ROOT=None
 return group,root,rig

characters={}
for name in ['Dale Cooper','Laura Palmer','Audrey Horne','Harry Truman','The Giant','Pete Martell','Leland Palmer','BOB']:
 characters[name]=make_character(name)
 print('CHARACTER_READY',name,flush=True)
# Character asset exports at origin, with skeletons and authored gentle head-turn clip.
for name,(col,root,rig) in characters.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in col.objects:o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name.lower().replace(' ','-')+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_force_sampling=True,export_apply=False,export_extras=False)
 col.hide_render=True;col.hide_viewport=True

# The ten tableaux share a physical scale: characters ~2 units, stage 7 x 5 units.
stages=[];manifest=[]
def stage(id,title):
 global group,ROOT
 group=bpy.data.collections.new('SET • '+id);bpy.context.scene.collection.children.link(group);ROOT=bpy.data.objects.new('DIORAMA • '+id,None);group.objects.link(ROOT)
 box('Walnut display plinth',(0,0,-.17),(7.2,5.4,.32),wood,.12)
 box('Inset brass rim',(0,0,.006),(6.98,5.18,.025),gold,.07)
 box('Stage floor',(0,0,.047),(6.86,5.06,.06),cream,.035)
 text(title,(0,-2.718,-.205),.16,gold)
 return ROOT

def chair(x,y,mat=red):
 for dx in [-.24,.24]:
  for dy in [-.22,.22]:rod('Chair leg',(x+dx,y+dy,.08),(x+dx,y+dy,.65),.027,wood)
 box('Chair cushion',(x,y,.68),(.62,.62,.15),mat,.08);box('Chair back',(x,y+.26,1.01),(.63,.13,.66),mat,.065)

def pine(x,y,h=2.7):
 rod('Fir trunk',(x,y,.06),(x,y,h),.085,wood,.035)
 for j in range(5):
  z=.55+j*(h-.75)/5;rad=(h-z)*.33
  rod('Fir canopy',(x,y,z),(x,y,z+.85),rad,forest if j%2 else forestlight,.015,vertices=10)

def mug(x,y,z):
 rod('Coffee cup',(x,y,z),(x,y,z+.18),.075,white,.083,vertices=24);rod('Black coffee',(x,y,z+.182),(x,y,z+.185),.069,wood,vertices=24)
 curve('Coffee handle',[(x+.065,y,z+.15),(x+.13,y,z+.15),(x+.13,y,z+.05),(x+.065,y,z+.04)],.016,white)

def curtains(y=2.2):
 for j in range(35):
  x=-3.25+j*.19
  rod('Velvet fold',(x,y+.07*math.sin(j*1.8),.12),(x,y+.07*math.sin(j*1.8),3.6),.15,velvet,.15,vertices=12)
 rod('Curtain rail',(-3.4,y,3.64),(3.4,y,3.64),.06,gold)

def room():
 box('Rear plaster wall',(0,2.49,1.75),(7,.15,3.4),teal,.015)
 box('Cutaway side wall',(-3.43,.7,1.75),(.12,3.6,3.4),teal,.015)
 for x in [-3.25,0,3.25]:box('Oak wall post',(x,2.36,1.7),(.12,.13,3.32),walnut,.01)

def place_character(name,x,y,angle=0,scale=1):
 col,_,_=characters[name];inst=bpy.data.objects.new(name+' • cast instance',None);group.objects.link(inst);inst.instance_type='COLLECTION';inst.instance_collection=col;inst.location=(x,y,.08);inst.rotation_euler[2]=angle;inst.scale=(scale,scale,scale);inst.parent=ROOT;return inst

for id,title in [('shore','THE LAKESHORE'),('diner','DOUBLE R DINER'),('stones','THE TIBETAN METHOD'),('redroom','THE WAITING ROOM'),('hotel','THE GREAT NORTHERN'),('roadhouse','THE ROADHOUSE'),('cell','THE LAST CONFESSION'),('cave','OWL CAVE'),('grove','GLASTONBURY GROVE'),('mirror','WHO CAME BACK?')]:
 root=stage(id,title);cast=[]
 if id in ['shore','stones','grove','cave']:
  box('Moss earth',(0,0,.085),(6.8,5,.06),forest,.1)
  for x,y,h in [(-2.8,1.8,3.8),(-1.7,2,3.2),(2.8,1.7,3.6),(2.15,2.1,3),(-3,-.8,2.5)]:pine(x,y,h)
 if id=='shore':
  box('Reflective lake',(.8,-.7,.14),(4.8,3.1,.07),water,.12)
  for j in range(9):box('Pier plank',(-1.3,-1.4+j*.29,.28),(1.1,.26,.10),walnut,.009)
  for y in [-1.4,.1,.9]:
   for x in [-1.82,-.78]:rod('Pier piling',(x,y,.11),(x,y,.62),.055,wood)
  box('Distant sawmill',(1.1,1.55,.53),(1.2,.62,.7),wood,.02);roof=box('Mill roof',(1.1,1.55,.96),(1.45,.88,.12),red,.025);rod('Mill chimney',(1.5,1.8,.72),(1.5,1.8,1.65),.065,stone)
  cast=[('Pete Martell',-2.15,-.2,.2)]
 elif id=='diner':
  room()
  # Open-faced dollhouse: low wall, no ceiling blocking the miniature view.
  for x in [-2.05,.2,2.3]:
   box('Window blue glass',(x,2.38,2.21),(1.66,.035,1.78),water,.018)
   for dx in [-.88,0,.88]:box('Window vertical muntin',(x+dx,2.33,2.21),(.055,.08,1.9),cream,.007)
   for z in [1.3,2.2,3.1]:box('Window horizontal muntin',(x,2.32,z),(1.85,.08,.055),cream,.005)
  for row in range(10):
   for col in range(14):box('Checker tile',(-3.18+col*.48,-2.17+row*.48,.093),(.46,.46,.018),white if (col+row)%2 else black,.004)
  box('Service counter',(-1.9,.25,.63),(1.1,3.0,1.04),walnut,.06);box('Cream counter top',(-1.9,.25,1.18),(1.3,3.18,.12),cream,.05)
  for y in [-.8,.3,1.35]:rod('Stool stem',(-.80,y,.13),(-.80,y,.72),.04,gold);rod('Stool foot',(-.8,y,.13),(-.8,y,.16),.22,black);rod('Teal stool seat',(-.8,y,.73),(-.8,y,.88),.25,teal,vertices=24)
  for y in [.35,1.73]:box('Booth red seat',(2.15,y,.57),(1.88,.65,.3),red,.07);box('Booth red back',(2.15,y+.27,.97),(1.88,.17,.98),red,.065)
  box('Booth table',(2.15,1.05,1.05),(1.7,.73,.10),cream,.035);rod('Table stem',(2.15,1.05,.1),(2.15,1.05,1.03),.05,gold)
  mug(-1.8,-.62,1.25);mug(2.0,1.07,1.11)
  rod('Cherry pie',(-1.9,.65,1.26),(-1.9,.65,1.36),.27,red,vertices=32)
  for j in range(5):box('Pie lattice',(-2.08+j*.09,.65,1.37),(.025,.40,.02),cream,.006)
  # Lived-in counter details and miniature fixtures.
  for y in [-.95,-.37,.21,.79,1.37]:box('Counter raised panel',(-1.335,y,.67),(.025,.49,.69),wood,.018)
  box('Coffee machine',(-2.05,1.34,1.47),(.65,.50,.46),black,.04)
  for x in [-2.24,-1.94]:rod('Espresso boiler',(x,1.33,1.59),(x,1.33,1.82),.11,gold,vertices=24)
  box('Napkin dispenser',(-1.95,-1.04,1.4),(.20,.18,.28),gold,.025);box('Folded napkins',(-1.95,-1.07,1.51),(.17,.10,.08),white,.008)
  rod('Pie golden crust',(-1.9,.65,1.25),(-1.9,.65,1.32),.29,walnut,vertices=32)
  for j in range(13):
   a=j*2.4;rr=.04+.014*j;ell('Cherry filling',(-1.9+rr*math.cos(a),.65+rr*math.sin(a),1.343),(.042,.042,.027),red)
  for j in range(5):box('Golden pastry lattice',(-2.08+j*.09,.65,1.39),(.034,.43,.02),cream,.008)
  box('Jukebox base',(2.9,-1.48,.64),(.65,.50,1.16),walnut,.13);box('Jukebox illuminated grille',(2.9,-1.75,.71),(.48,.03,.58),gold,.07)
  for k in range(6):box('Jukebox grille bar',(2.73+k*.066,-1.78,.70),(.014,.02,.48),wood,.005)
  ell('Jukebox crown',(2.9,-1.5,1.25),(.31,.23,.29),red)
  box('Diner menu',(-2.6,2.23,1.92),(.66,.04,1.10),black,.015);text('COFFEE',(-2.6,2.194,2.23),.11,cream);text('PIE',(-2.6,2.194,1.98),.13,cream);text('24 HRS',(-2.6,2.194,1.72),.10,cream)
  for x in [-1.5,1.5]:
   rod('Pendant cable',(x,1.22,3.38),(x,1.22,2.88),.012,black);rod('Pendant shade',(x,1.22,2.69),(x,1.22,2.98),.29,cream,.07);ell('Pendant glow',(x,1.22,2.72),(.19,.19,.07),lightmat)
  text('DOUBLE R',(0,2.27,3.22),.25,lightmat)
  cast=[('Dale Cooper',.04,-.64,-.24),('Audrey Horne',1.03,.24,.24)]
 elif id=='stones':
  rod('Target stump',(-1.55,.4,.12),(-1.55,.4,.55),.3,wood)
  rod('Glass bottle',(-1.55,.4,.55),(-1.55,.4,.88),.065,water,.035)
  box('Chalk board',(.8,1.5,1.34),(1.34,.1,.92),black,.025)
  for x in [.25,1.35]:rod('Easel leg',(x,1.5,.1),(x,1.5,1.94),.03,walnut)
  text('TIBET',(.8,1.438,1.57),.17,white)
  for j in range(7):ell('River stone',(-1+random.random()*2,-1+random.random(),.14),(.12,.09,.07),stone)
  cast=[('Dale Cooper',.36,-.55,-.35),('Harry Truman',1.65,.55,-.22)]
 elif id=='redroom':
  curtains()
  for row in range(15):
   verts=[]
   for x in range(29):verts.append((-3.4+x*.24,-2.5+row*.34+(.18 if x%2 else 0),.09))
   for x in reversed(range(29)):verts.append((-3.4+x*.24,-2.5+row*.34+.17+(.18 if x%2 else 0),.09))
   mesh('Black chevron floor',verts,[tuple(range(len(verts)))],black,smooth=False)
  chair(-1.55,.45,black);chair(1.55,.45,black)
  rod('Sculpture pedestal',(0,1.6,.12),(0,1.6,.78),.21,white)
  ell('Venus torso',(0,1.6,1.14),(.16,.11,.34),white);ell('Venus head',(0,1.6,1.55),(.085,.08,.12),white)
  cast=[('Laura Palmer',-1.5,-.45,.16),('Dale Cooper',1.48,-.44,-.18)]
 elif id in ['hotel','mirror']:
  room();box('Hotel carpet',(0,-.1,.095),(6.5,4.65,.035),red,.02)
  for k in range(6):box('Carpet gold stripe',(0,-2+k*.76,.115),(6.2,.025,.009),gold,.001)
  box('Writing desk',(-1.9,1.2,.98),(2.1,.82,.12),walnut,.025)
  for x in [-2.7,-1.1]:rod('Desk leg',(x,1.2,.1),(x,1.2,.95),.06,wood)
  box('Bed mattress',(1.75,1.2,.66),(1.6,2.1,.4),white,.13);box('Bed headboard',(1.75,2.29,1.15),(1.9,.17,1.8),walnut,.06);box('Blanket',(1.75,.8,.9),(1.62,1.4,.07),teal,.04)
  rod('Lamp stem',(-1.8,1.2,1.06),(-1.8,1.2,1.65),.03,gold);rod('Lamp shade',(-1.8,1.2,1.52),(-1.8,1.2,1.9),.32,lightmat,.17)
  if id=='mirror':
   box('Mirror silver',(-.35,2.31,1.95),(1.45,.035,1.67),mirror,.02)
   for x in [-1.15,.45]:box('Mirror frame',(x,2.26,1.95),(.09,.12,1.87),gold,.02)
   for z in [1.02,2.88]:box('Mirror frame',(-.35,2.26,z),(1.69,.12,.09),gold,.02)
   box('Wash basin',(-.35,1.95,.98),(1.5,.66,.18),white,.12)
   cast=[('Dale Cooper',-.33,.72,math.pi),('BOB',-.35,2.08,0)]
  else:cast=[('Dale Cooper',-.7,-.82,.1),('The Giant',1.0,.2,.1)]
 elif id=='roadhouse':
  curtains();box('Raised stage',(0,1.25,.27),(6.1,1.8,.37),walnut,.04)
  for x,y in [(-2,-1.2),(0,-1.1),(2,-1.0)]:
   rod('Round table',(x,y,.82),(x,y,.9),.46,walnut,vertices=32);rod('Table pedestal',(x,y,.12),(x,y,.82),.06,black);mug(x,y,.91);chair(x+.44,y-.48,black)
  text('ROADHOUSE',(0,2.1,3.25),.23,gold);cast=[('The Giant',0,1.23,0),('Dale Cooper',1.2,-1.8,.2)]
 elif id=='cell':
  room()
  for row in range(8):
   for col in range(12):box('Masonry brick',(-3.18+col*.54+(row%2)*.17,2.32,.3+row*.39),(.51,.09,.36),stone,.015)
  box('Cell bench',(-1.7,1.75,.55),(2.6,.57,.13),wood,.02)
  for x in [-3.0,-2.6,-2.2,-1.8,-1.4]:rod('Cell bars',(x,.1,.15),(x,.1,3),.025,black)
  rod('Cell crossbar',(-3,.1,1.25),(-1.4,.1,1.25),.025,black)
  box('Wet floor',(0,-.3,.102),(6.3,4.2,.018),mirror,.03)
  cast=[('Dale Cooper',.4,.4,-.2),('Leland Palmer',1.5,1.1,-.3)]
 elif id=='cave':
  for j in range(14):
   a=j*math.pi/13;x=2.6*math.cos(a);y=1.4+random.random()*.2;z=.8+1.4*math.sin(a);ell('Carved cave rock',(x,y,z),(.68,.5,.85),stone)
  box('Carved central stone',(0,1.53,1.65),(2.4,.3,2.65),stone,.12)
  curve('Owl left carving',[(-.83,1.35,2.46),(-.38,1.32,2.13),(0,1.32,2.38)],.035,gold)
  curve('Owl right carving',[(.83,1.35,2.46),(.38,1.32,2.13),(0,1.32,2.38)],.035,gold)
  curve('Owl rune shaft',[(0,1.32,2.35),(0,1.32,1.04),(-.34,1.32,.78)],.025,gold)
  for side in [-1,1]:curve('Rune wing',[(side*.62,1.32,2.04),(side*.32,1.32,1.74),(side*.48,1.32,1.24)],.025,gold)
  cast=[('Dale Cooper',.5,-.4,-.1),('Harry Truman',1.72,-.1,.2)]
 elif id=='grove':
  for x in [-1.6,1.6]:
   rod('Sycamore trunk',(x,.95,.1),(x,.95,3.8),.18,cream,.10)
   for k in range(6):rod('Sycamore bough',(x,.95,2.3+k*.16),(x+(-.7 if x<0 else .7),1.1,2.8+k*.13),.06,cream,.02)
  for j in range(15):rod('Portal velvet',( -1.27+j*.18,1.18,.12),(-1.27+j*.18,1.18,3.05),.14,velvet)
  ell('Black oil pool',(0,-.76,.15),(1.25,.72,.045),black)
  cast=[('Dale Cooper',.20,-.85,math.pi),('Harry Truman',2,-.75,.2)]
 for name,x,y,a in cast:place_character(name,x,y,a)
 # Export scenery only; runtime instances use shared rigged character glBs.
 bpy.ops.object.select_all(action='DESELECT')
 for o in group.objects:
  if o.instance_type!='COLLECTION':o.select_set(True)
 bpy.context.view_layer.objects.active=root
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_animations=False,export_apply=True,export_extras=False)
 manifest.append({'id':id,'title':title,'environment':id+'.glb','cast':[{'asset':n.lower().replace(' ','-')+'.glb','name':n,'position':[x,.08,-y],'rotation':a,'scale':1} for n,x,y,a in cast]})
 stages.append((id,group,root));group.hide_render=True;group.hide_viewport=True
 print('STAGE_READY',id,flush=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
ROOT=None;CHAR=None;group=None
# Studio lights and physically modeled miniature base are included in the master.
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=20;s.cycles.use_denoising=True;s.cycles.max_bounces=5;s.render.resolution_x=1200;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.world.color=(.12,.12,.12)
world=s.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.17,.17,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35
s.view_settings.view_transform='AgX'
def area(name,loc,power,color,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm softbox',(-3,-5,7),950,(1,.80,.58),5);area('Cool fill',(5,-1,5),800,(.65,.80,1),4);area('Amber rim',(0,4,5),1000,(1,.49,.22),3)
bpy.ops.object.camera_add(location=(8,-11,8));cam=bpy.context.object;cam.name='CAMERA • Miniature cinema';cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=9.4;s.camera=cam
# Stage orbit animation (click-based viewer uses matching camera paths).
for f,loc in [(1,(8,-11,8)),(45,(-3,-11,7)),(90,(8,-11,8))]:cam.location=loc;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert(data_path='location',frame=f);cam.keyframe_insert(data_path='rotation_euler',frame=f)
s.frame_end=90;s.frame_set(1)
for id,col,root in stages:
 if id=='diner':col.hide_render=False;col.hide_viewport=False
# Keep character source collections available to instances, hiding only their direct layer instances.
for name,(col,root,rig) in characters.items():col.hide_render=False;col.hide_viewport=False;root.location=(20,0,0)
# Collection instances inherit source object locations, so source roots remain at origin; exclude source collections from view layer instead.
for name,(col,root,rig) in characters.items():
 root.location=(0,0,0)
 lc=bpy.context.view_layer.layer_collection.children.get(col.name)
 if lc:lc.exclude=True
s['production']='Actual geometry, eight rigged named Twin Peaks figures, ten miniature stages; no scene image planes.'
s['note']='Base pose character design is stylized fan interpretation, not actor scan. Basic part-weight rig, not facial production rig.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(R/'twin-peaks-miniatures.blend'),compress=True)
# Render real Blender previews, including isolated character source via temporary layer visibility.
for id in ['diner','redroom','grove']:
 for sid,col,root in stages:col.hide_render=sid!=id;col.hide_viewport=sid!=id
 s.render.filepath=str(R/'previews'/f'{id}.png');bpy.ops.render.render(write_still=True)
for sid,col,root in stages:col.hide_render=True
col,root,rig=characters['Dale Cooper'];bpy.context.view_layer.layer_collection.children[col.name].exclude=False
cam.animation_data_clear();cam.location=(2.7,-6,2.5);cam.rotation_euler=(Vector((0,0,1.22))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.75;s.render.resolution_x=900;s.render.resolution_y=1200;s.render.filepath=str(R/'previews/cooper-full.png');bpy.ops.render.render(write_still=True)
cam.location=(1.15,-4,2.04);cam.rotation_euler=(Vector((0,-.015,1.79))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.82;s.render.resolution_x=1000;s.render.resolution_y=1000;s.render.filepath=str(R/'previews/cooper-portrait.png');bpy.ops.render.render(write_still=True)
print('COMPLETE',flush=True)
