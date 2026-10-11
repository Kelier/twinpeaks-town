import bpy,random,math
from mathutils import Vector

def refine():
    random.seed(44);s=bpy.context.scene
    if s.get('forest_detail_v2'):return
    s['forest_detail_v2']=True
    for matname,col in [('Tree bark',(.07,.045,.025))]:
        m=bpy.data.materials.get(matname)
        if not m:continue
        n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=6;tex.inputs['Detail'].default_value=5
        co=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeMapping');mapping.inputs['Scale'].default_value=(8,8,.5);l.new(co.outputs['Generated'],mapping.inputs['Vector']);l.new(mapping.outputs['Vector'],tex.inputs['Vector']);b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=.7;b.inputs['Distance'].default_value=.04;l.new(tex.outputs['Fac'],b.inputs['Height']);l.new(b.outputs['Normal'],p.inputs['Normal'])
        ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.013,.018,.009,1);ramp.color_ramp.elements[1].color=(*col,1);l.new(tex.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],p.inputs['Base Color'])
    for o in list(s.objects):
        if o.name.startswith('Pale circle tree'):
            o.scale.z*=2;o.location.z+=2.4
            m=o.data.materials[0];n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=24;noise.inputs['Detail'].default_value=3;coord=n.new('ShaderNodeTexCoord');l.new(coord.outputs['Generated'],noise.inputs['Vector']);b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=.5;b.inputs['Distance'].default_value=.025;l.new(noise.outputs['Fac'],b.inputs['Height']);l.new(b.outputs['Normal'],p.inputs['Normal'])
            ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.04,.065,.05,1);ramp.color_ramp.elements[1].color=(.30,.34,.26,1);l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],p.inputs['Base Color'])
        if not o.name.startswith('Fir layered boughs'):continue
        verts=[];faces=[]
        radius=max(Vector((v.co.x,v.co.y)).length for v in o.data.vertices);h=max(v.co.z for v in o.data.vertices)-min(v.co.z for v in o.data.vertices)
        def blade(a,b,width):
            a=Vector(a);b=Vector(b);d=b-a;side=d.cross(Vector((0,0,1)))
            if side.length<.001:side=Vector((1,0,0))
            side.normalize();side*=width;idx=len(verts);verts.extend([a-side,a+side,b]);faces.append((idx,idx+1,idx+2))
        for row in range(7):
            z=-h*.48+row*h*.135;r=radius*(1-row*.12)
            for j in range(13):
                a=j*math.tau/13+row*.63+random.uniform(-.18,.18);end=Vector((math.cos(a)*r,math.sin(a)*r,z-h*.05));start=Vector((0,0,z+h*.10))
                blade(start,end,.012)
                for t in [.2,.35,.5,.65,.8,.95]:
                    center=start.lerp(end,t);length=r*.20*(1-t*.4)
                    for side in [-1,1]:
                        ang=a+side*.70
                        for off in [-.24,0,.24]:
                            dest=center+Vector((math.cos(ang+off)*length,math.sin(ang+off)*length,random.uniform(-.035,.035)))
                            blade(center,dest,.017)
        mesh=bpy.data.meshes.new('Needled radial bough mesh');mesh.from_pydata(verts,[],faces);mesh.materials.append(bpy.data.materials['Fir needles']);old=o.data;o.data=mesh;o.name='Detailed fir needle bough';bpy.data.meshes.remove(old)
    s.cycles.samples=24
