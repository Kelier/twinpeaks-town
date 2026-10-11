import bpy, math, random, sys, os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
MODE=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'redroom'
random.seed(12)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.name={'diner':'01 • The Unspoken Tape','motel':'02 • Tomorrow Has Checked Out','redroom':'03 • The Second Key','forest':'04 • A Road Beneath the Trees'}[MODE]
s.render.engine='CYCLES';s.cycles.samples=32 if MODE in ['diner','redroom'] else 24;s.cycles.use_denoising=True;s.cycles.adaptive_threshold=.065
s.cycles.max_bounces=6;s.cycles.volume_bounces=1
s.render.resolution_x=1200;s.render.resolution_y=750;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG';s.render.fps=24;s.frame_start=1;s.frame_end=96
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.18,.21,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.12
s.view_settings.view_transform='AgX'

def mat(name,c,rough=.5,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    return m

def tex(name,color,scale=(1,1,1),rough=.6):
    m=mat(name,color,rough);nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
    coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeMapping');mapping.inputs['Scale'].default_value=scale;links.new(coord.outputs['Generated'],mapping.inputs['Vector'])
    for channel in ['basecolor','roughness','height']:
        im=nodes.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(ROOT/'textures'/f'{name}_{channel}.png'),check_existing=True);im.projection='BOX';im.projection_blend=.25
        links.new(mapping.outputs['Vector'],im.inputs['Vector'])
        if channel=='basecolor':links.new(im.outputs['Color'],p.inputs['Base Color'])
        elif channel=='roughness':im.image.colorspace_settings.name='Non-Color';links.new(im.outputs['Color'],p.inputs['Roughness'])
        else:
            im.image.colorspace_settings.name='Non-Color';b=nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.28;b.inputs['Distance'].default_value=.035 if name=='asphalt' else .012;links.new(im.outputs['Color'],b.inputs['Height']);links.new(b.outputs['Normal'],p.inputs['Normal'])
    if name=='velvet':p.inputs['Sheen Weight'].default_value=.45
    return m
wood=tex('walnut',(.23,.09,.035),(1,1,3));velvet=tex('velvet',(.35,.02,.03),(2,2,2));asphalt=tex('asphalt',(.08,.09,.1),(5,5,5));leather=tex('leather',(.07,.03,.02),(2,2,2))
cream=mat('Warm ivory porcelain',(.83,.77,.6),.22);black=mat('Soft black enamel',(.009,.013,.015),.24);gold=mat('Aged brass',(.45,.26,.08),.26,.8);chrome=mat('Brushed nickel',(.45,.49,.5),.23,.9)
red=mat('Oxblood vinyl',(.28,.015,.025),.3);green=mat('Fir needles',(.017,.045,.033),.87);bark=mat('Tree bark',(.057,.037,.02),.91);paper=mat('Old paper',(.57,.51,.37),.9)

def emit(name,c,strength=3):
    m=mat(name,c);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=strength;return m
amber=emit('Filament amber',(1,.39,.08),4);neon=emit('Red neon',(1,.025,.009),5);cyan=emit('Distant blue',(0.11,.6,.68),2)

def cube(name,loc,dim,m,bevel=.03):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('Machined soft edges','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

def uv(name,loc,scale,m,segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=12,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(m)
    for f in o.data.polygons:f.use_smooth=True
    return o

def rod(name,a,b,r,m,vertices=20):
    d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=True
    return o

def torus(name,loc,major,minor,m,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=48,minor_segments=12,location=loc,rotation=rotation);o=bpy.context.object;o.name=name;o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=True
    return o

def curve(name,points,thick,m):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=thick;c.bevel_resolution=3;sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);s.collection.objects.link(o);o.data.materials.append(m);return o

def text(name,body,loc,size,m,rot=(math.pi/2,0,0),align='CENTER'):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.align_x=align;c.size=size;c.extrude=.002;c.bevel_depth=.001;o=bpy.data.objects.new(name,c);s.collection.objects.link(o);o.location=loc;o.rotation_euler=rot;o.data.materials.append(m);return o

def area(name,loc,target,color,power,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o

def point(name,loc,color,power,radius=.3):
    d=bpy.data.lights.new(name,'POINT');d.energy=power;d.color=color;d.shadow_soft_size=radius;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;return o

def cam(loc,target,lens=45,focus=None):
    d=bpy.data.cameras.new('Cinematic 24fps');o=bpy.data.objects.new('CAM • slow drift',d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();d.lens=lens;s.camera=o
    if focus:d.dof.use_dof=True;d.dof.focus_distance=(Vector(focus)-o.location).length;d.dof.aperture_fstop=6.3
    o.keyframe_insert(data_path='location',frame=1);o.keyframe_insert(data_path='rotation_euler',frame=1)
    o.location=o.location.lerp(Vector(target),.07);o.keyframe_insert(data_path='location',frame=96)
    s.frame_set(1)
    return o

def fog(size,loc,density=.014):
    m=bpy.data.materials.new('Low lying mist');m.use_nodes=True;n=m.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');v=n.new('ShaderNodeVolumePrincipled');v.inputs['Density'].default_value=density;v.inputs['Color'].default_value=(.48,.57,.59,1);m.node_tree.links.new(v.outputs['Volume'],out.inputs['Volume']);return cube('Atmosphere volume',loc,size,m,0)

def lamp(x,y,z):
    rod('Lamp stem',(x,y,.1),(x,y,z),.027,gold);rod('Lamp foot',(x,y,.03),(x,y,.1),.23,gold)
    bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.4,radius2=.23,depth=.48,location=(x,y,z));o=bpy.context.object;o.name='Pleated ivory lamp shade';o.data.materials.append(cream)
    point('Shade tungsten pool',(x,y,z-.28),(1,.55,.22),55,.18)

def chair(x,y,rz=0):
    before=set(bpy.data.objects)
    cube('Club chair seat',(x,y,.5),(1.04,.95,.3),leather,.13);cube('Club chair back',(x,y+.4,1.08),(1.06,.23,1.02),leather,.12)
    for dx in [-.52,.52]:cube('Club chair rolled arm',(x+dx,y,.82),(.23,.99,.35),leather,.11)
    for dx in [-.38,.38]:
        for dy in [-.33,.33]:rod('Chair dark feet',(x+dx,y+dy,.04),(x+dx,y+dy,.4),.045,wood)
    for z in [.83,1.16]:
        for dx in [-.25,.25]:uv('Upholstery button',(x+dx,y+.265,z),(.023,.015,.023),gold)
    for ob in set(bpy.data.objects)-before:
        v=ob.location-Vector((x,y,0));ob.location=(x+v.x*math.cos(rz)-v.y*math.sin(rz),y+v.x*math.sin(rz)+v.y*math.cos(rz),v.z);ob.rotation_euler.z+=rz

def curtain(name,y,width,height,x=0):
    verts=[];faces=[];nx=180;nz=20
    for j in range(nz+1):
        z=height*j/nz
        for i in range(nx+1):
            u=i/nx;xx=x+(u-.5)*width;yy=y+.14*math.sin(u*math.pi*40)+.025*math.sin(u*math.pi*80)+.04*math.sin(z*1.2+u*8);verts.append((xx,yy,z+.02))
    for j in range(nz):
        for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.materials.append(velvet);o=bpy.data.objects.new(name,me);s.collection.objects.link(o)
    for f in me.polygons:f.use_smooth=True
    solid=o.modifiers.new('Actual fabric thickness','SOLIDIFY');solid.thickness=.008
    return o

def pine(x,y,h):
    rod('Fir trunk',(x,y,-.1),(x,y,h),.10,bark,12)
    for j in range(6):
        z=h*(.23+j*.11);r=h*(.23-j*.029)
        bpy.ops.mesh.primitive_cone_add(vertices=13,radius1=r,radius2=0,depth=h*.36,location=(x,y,z));o=bpy.context.object;o.name='Fir layered boughs';o.data.materials.append(green);o.rotation_euler.z=random.random()
        for k in range(4):
            a=k*math.tau/4+j*.7;rod('Bare branch',(x,y,z-.3),(x+math.cos(a)*r,y+math.sin(a)*r,z-.15),.026,bark,8)

def key(loc):
    x,y,z=loc;torus('Room key loop',(x,y,z),.055,.011,gold);rod('Room key shaft',(x+.04,y,z),(x+.24,y,z),.011,gold);cube('Room key tooth',(x+.2,y+.02,z),(.045,.04,.019),gold,.003)

if MODE=='diner':
    cube('Terrazzo floor',(0,1,-.1),(12,10,.2),black)
    for x in range(-5,6):
        for y in range(-3,6):cube('Ivory floor tile',(x,y,.007),(.95,.95,.015),cream if (x+y)%2 else black,.003)
    cube('Pine wall',(0,4,1.9),(12,.2,3.8),wood)
    for x in [-4,-1,2,5]:
        cube('Window deep reveal',(x,3.85,2.2),(2.3,.12,2),black)
        cube('Rain blue window',(x,3.76,2.2),(2.1,.03,1.8),mat('Night glass '+str(x),(.012,.055,.07),.1,.5))
        for k in range(32):
            xx=x+random.uniform(-1,1);zz=random.uniform(1.4,3);rod('Rain rivulet',(xx,3.72,zz),(xx+.006,3.72,zz-random.uniform(.03,.2)),.0025,chrome,6)
        for dx in [-1.12,0,1.12]:cube('Window metal mullion',(x+dx,3.67,2.2),(.045,.05,1.9),chrome,.006)
    for x in [-3.3,.3,3.9]:
        cube('Booth red seat',(x,2.6,.5),(2.4,.8,.32),red,.14);cube('Booth channeled back',(x,3.06,1.2),(2.4,.25,1.28),red,.1)
        for dx in [-.9,-.6,-.3,0,.3,.6,.9]:curve('Stitched vinyl seam',[(x+dx,2.917,.68),(x+dx,2.917,1.73)],.003,gold)
        cube('Rear diner table',(x,1.7,.95),(2.35,.85,.09),cream);rod('Chrome table pedestal',(x,1.7,0),(x,1.7,.93),.06,chrome)
        rod('Pendant cord',(x,1.7,2.9),(x,1.7,4),.01,black)
        bpy.ops.mesh.primitive_cone_add(vertices=40,radius1=.38,radius2=.1,depth=.27,location=(x,1.7,2.9));bpy.context.object.data.materials.append(cream);point('Pendant warm pool',(x,1.7,2.71),(1,.48,.15),80,.22)
    cube('Hero walnut table',(0,-.4,.94),(3.2,1.9,.16),wood,.07)
    cube('Hero table cream inset',(0,-.4,1.025),(3.08,1.78,.022),cream,.04)
    for x in [-.95,.95]:
        rod('Hero table chrome pedestal',(x,-.4,.05),(x,-.4,.93),.065,chrome)
        cube('Hero table foot',(x,-.4,.045),(.72,.6,.09),chrome,.04)
    # Revolved ceramic cup with inner wall and real open mouth.
    cx,cy=-.55,-.6
    profile=[(.0,1.065),(.23,1.065),(.245,1.10),(.27,1.48),(.255,1.49),(.238,1.46),(.214,1.14),(.0,1.14)]
    verts=[];faces=[]
    for r,z in profile:
        for i in range(64):a=i*math.tau/64;verts.append((cx+r*math.cos(a),cy+r*math.sin(a),z))
    for j in range(len(profile)-1):
        for i in range(64):faces.append((j*64+i,j*64+(i+1)%64,(j+1)*64+(i+1)%64,(j+1)*64+i))
    mesh=bpy.data.meshes.new('Lathed cup mesh');mesh.from_pydata(verts,[],faces);mesh.materials.append(cream);o=bpy.data.objects.new('Hero coffee cup',mesh);s.collection.objects.link(o)
    for p in mesh.polygons:p.use_smooth=True
    torus('Coffee cup handle',(cx-.30,cy,1.29),.13,.035,cream,(math.pi/2,0,0));rod('Coffee black surface',(cx,cy,1.438),(cx,cy,1.445),.237,mat('Fresh coffee',(.008,.003,.001),.08))
    rod('Cup saucer',(cx,cy,1.04),(cx,cy,1.065),.37,cream)
    # Cherry tart, crust, lattice and sticky individual fruit.
    px,py=.62,-.45;rod('Pie plate',(px,py,1.04),(px,py,1.075),.52,cream);crust=mat('Baked pastry',(.46,.21,.052),.66);jam=mat('Cherry glaze',(.18,.004,.012),.16)
    rod('Pie pastry shell',(px,py,1.08),(px,py,1.23),.4,crust);torus('Crimped pie rim',(px,py,1.22),.4,.045,crust)
    for i in range(42):a=i*math.tau/42;uv('Pastry crimp',(px+.4*math.cos(a),py+.4*math.sin(a),1.235),(.039,.035,.031),crust,12)
    for i in range(30):a=random.random()*math.tau;r=random.random()**.5*.32;uv('Glazed cherry',(px+r*math.cos(a),py+r*math.sin(a),1.24),(.067,.067,.054),jam,16)
    for delta in [-.25,-.08,.09,.26]:
        length=2*math.sqrt(.36**2-delta**2);cube('Pastry lattice',(px+delta,py,1.296),(.045,length,.025),crust,.009);cube('Pastry lattice',(px,py+delta,1.31),(length,.045,.025),crust,.009)
    cube('Cassette recorder',(0,-1.03,1.08),(.65,.35,.09),black,.022);cube('Cassette window',(0,-1.03,1.133),(.36,.21,.008),chrome,.009)
    for x in [-.1,.1]:torus('Cassette reel',(x,-1.03,1.14),.058,.012,black)
    for x in [-.24,-.16,-.08,0,.08,.16,.24]:cube('Recorder key',(x,-1.18,1.14),(.05,.04,.015),chrome,.003)
    cube('Tomorrow receipt',(-1.05,-.2,1.045),(.33,.58,.008),paper,.003);text('Receipt print','ROOM 315\nCHECK OUT\nTOMORROW',(-1.05,-.18,1.052),.036,black,(0,0,0))
    area('Warm table key',(-2,-2,4),(0,0,1),(1,.61,.30),240,3);area('Cold window fill',(1,3.4,3),(0,0,1),(.2,.5,.64),170,3)
    text('Diner neon letters','LAST STOP',(-1,3.64,2.35),.34,neon);point('Neon bounce',(-1,3.15,2.4),(1,.06,.025),50,.4)
    cam((3.5,-5.8,3.05),(0,.5,1.25),48,(0,-.4,1.25))

elif MODE=='redroom':
    cube('Black reflective base',(0,0,-.08),(12,12,.16),black)
    # Each zigzag is actual beveled floor geometry, not a flat printed floor.
    for j in range(-14,15):
        verts=[]
        for x in range(-6,7):
            y=j*.40+(.38 if x%2 else 0);verts.extend([(x,y,.008),(x,y+.20,.008)])
        faces=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(12)];me=bpy.data.meshes.new('Chevron inlay');me.from_pydata(verts,[],faces);me.materials.append(cream);o=bpy.data.objects.new('Ivory chevron strip',me);s.collection.objects.link(o)
    curtain('Back red silk curtain',4.2,12,5.2)
    left=curtain('Left red silk curtain',0,10,5.2);left.rotation_euler.z=math.pi/2;left.location.x=-5.8
    right=curtain('Right red silk curtain',0,10,5.2);right.rotation_euler.z=math.pi/2;right.location.x=5.8
    chair(-2,1.5,-.2);chair(2,1.5,.2);lamp(-3.6,2.6,2.1)
    rod('Brass side table stem',(0,1.1,.04),(0,1.1,.9),.04,gold);rod('Table round foot',(0,1.1,.03),(0,1.1,.08),.3,gold);rod('Table stone top',(0,1.1,.92),(0,1.1,1.0),.5,black);key((-.1,1.1,1.025))
    cube('Statue pedestal',(3.7,3.1,.58),(.7,.7,1.16),cream,.025);uv('Marble dream torso',(3.7,3.1,1.53),(.23,.16,.42),cream);uv('Marble head',(3.7,3.1,2.03),(.15,.15,.21),cream)
    for z in [.4,.9,1.4,1.9]:area('Curtain footlight '+str(z),(-4+z*4,3.45,.22),(-4+z*4,4.2,3),(1,.08,.025),65,.6)
    area('Ivory theatrical key',(-3,-1,5),(0,1,0),(1,.74,.45),700,4);area('Blue impossible fill',(4,-1,4),(0,1,1),(.27,.39,.64),250,3)
    cam((.1,-8.7,2.85),(0,1.5,1.45),37)

elif MODE=='motel':
    cube('Wet asphalt road',(0,-1,-.09),(26,25,.18),asphalt)
    water=mat('Thin rain puddles',(.025,.034,.039),.045,.6)
    for i in range(20):
        x=random.uniform(-9,9);y=random.uniform(-8,1);uv('Rain puddle',(x,y,.004),(random.uniform(.3,1.3),random.uniform(.18,.6),.008),water,20)
    for y in range(-10,2,3):cube('Wet centerline paint',(0,y,.011),(.12,1.7,.012),paper,.003)
    cube('Motel long cabin',(0,3.8,1.75),(11,3.8,3.5),wood)
    for z in [i*.19 for i in range(18)]:cube('Horizontal timber siding',(0,1.87,z+.15),(11,.15,.15),wood,.035)
    cube('Roof front slope',(0,3,3.68),(12,2.7,.16),black,.01).rotation_euler.x=.3
    cube('Roof rear slope',(0,4.7,3.68),(12,2.7,.16),black,.01).rotation_euler.x=-.3
    for x in [-3.6,0,3.6]:
        cube('Door surround',(x,1.73,1.4),(1.16,.15,2.8),black);cube('Painted motel door',(x,1.62,1.35),(.95,.1,2.5),mat('Teal paint '+str(x),(.042,.105,.092),.52))
        uv('Door brass knob',(x+.34,1.53,1.25),(.04,.025,.04),gold)
        text('Room number',str(315+int(x/3.6)),(x,1.54,2.1),.14,cream)
        cube('Glowing motel window',(x+1.2,1.68,1.7),(.75,.04,1.05),emit('Occupied window '+str(x),(1,.39,.09),1.2))
        for dx in [-.4,0,.4]:cube('Window frame',(x+1.2+dx,1.6,1.7),(.04,.07,1.13),wood,.008)
        point('Porch tungsten',(x,1.2,2.8),(1,.42,.13),50,.25)
    rod('Motel sign post',(-5.8,.7,0),(-5.8,.7,5.5),.085,chrome);cube('Sign back',(-5.8,.65,4.45),(2.5,.16,1.8),black,.09)
    text('Neon motel','PINE\nMOTEL',(-5.8,.53,4.58),.48,neon);text('Vacancy neon','VACANCY',(-5.8,.53,3.9),.19,cyan)
    point('Neon rain red pool',(-5.8,-.1,3.6),(1,.05,.015),280,1);area('Wet blue moon',(1,-2,8),(0,1,0),(.16,.36,.53),850,7)
    for i in range(18):pine(-12+i*1.4,random.uniform(6,9),random.uniform(5,8))
    fog((30,22,10),(0,3,4),.012)
    cam((9,-13,5),(0,2,1.7),42)

elif MODE=='forest':
    dirt=mat('Moss and forest loam',(.019,.043,.028),.96);cube('Forest earth',(0,0,-.13),(24,24,.26),dirt)
    for i in range(25):
        x=random.uniform(-10,10);y=random.uniform(1,10)
        if abs(x)<2 and y<7:continue
        pine(x,y,random.uniform(5,8))
    for i in range(12):
        a=i*math.tau/12; x=3.3*math.cos(a);y=3.3*math.sin(a)+1
        rod('Pale circle tree',(x,y,0),(x+.15,y,4.8),.09,mat('Pale bark '+str(i),(.31,.34,.26),.85),14)
        for j in range(3):rod('Bare fork',(x,y,2+j*.65),(x+(-1 if j%2 else 1)*.7,y+.1,2.6+j*.65),.025,bark,8)
    water=mat('Still black pool',(.003,.014,.012),.035,.7);rod('Mirror pool',(0,1,.0),(0,1,.012),2.6,water,96)
    curtain('Impossible red threshold',4,2.4,4.1)
    for x in [-1.3,1.3]:rod('Doorway tree',(x,4,0),(x,4,4.5),.12,bark)
    cube('Floating receipt',(-.25,-.6,.029),(.3,.6,.006),paper,.004);key((.2,-.65,.05))
    area('Beyond the red curtain',(0,3.5,2),(0,0,0),(1,.035,.009),400,2.5);area('Moon through canopy',(-4,-1,8),(0,1,0),(.14,.42,.44),950,4)
    area('Warm last roadlight',(4,-5,4),(0,1,0),(.9,.47,.13),220,3)
    for i in range(70):
        x=random.uniform(-6,6);y=random.uniform(-4,7)
        if x*x+(y-1)**2<7:continue
        uv('River pebble',(x,y,.03),(random.uniform(.04,.14),.08,.04),bark,10)
    fog((22,22,10),(0,2,4),.026)
    cam((6,-10,4.5),(0,2,1.8),42)

if MODE=='forest':
    sys.path.insert(0,str(ROOT))
    from forest_detail import refine
    refine()

# Compositor glow is restrained and comes only from bright practicals.
s.use_nodes=True;n=s.node_tree.nodes;n.clear();r=n.new('CompositorNodeRLayers');g=n.new('CompositorNodeGlare');g.glare_type='FOG_GLOW';g.quality='MEDIUM';g.threshold=2;g.mix=-.93;out=n.new('CompositorNodeComposite');s.node_tree.links.new(r.outputs['Image'],g.inputs['Image']);s.node_tree.links.new(g.outputs['Image'],out.inputs['Image'])
for m in bpy.data.materials:
    if m.users:m.asset_mark()
for ob in s.objects:
    if ob.type=='MESH':
        ob['asset_pack']='Twin Peaks / The Tomorrow Tape';ob['scene_role']=MODE
s['story']='Original Twin Peaks homage: The Tomorrow Tape. Not an official episode.'
s['camera_transition']='Frames 1–96: slow 7% push-in at 24fps. Preview montage uses rendered stills with editorial moves and dissolves.'
for image in bpy.data.images:
    if image.source=='FILE':image.pack()
s.render.filepath=str(ROOT/'previews'/f'{MODE}.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scenes'/f'{MODE}.blend'))
print('ASSET_REPORT',MODE,'objects',len(s.objects),'materials',len([m for m in bpy.data.materials if m.users]),flush=True)
bpy.ops.render.render(write_still=True)
