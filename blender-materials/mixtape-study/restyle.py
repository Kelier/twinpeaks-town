import bpy,sys,math,colorsys,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
mode=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT.parent/'scenes'/f'{mode}.blend'))
s=bpy.context.scene
palette={'walnut':(.31,.135,.052),'velvet':(.48,.045,.027),'asphalt':(.095,.15,.17),'leather':(.22,.087,.043),'Fir needles':(.12,.23,.13),'Tree bark':(.20,.11,.064),'Soft black enamel':(.025,.043,.05),'Oxblood vinyl':(.52,.095,.038),'Warm ivory porcelain':(.83,.67,.40),'Old paper':(.72,.56,.32),'Baked pastry':(.67,.31,.075)}
changed=[]
for m in bpy.data.materials:
 if not m.use_nodes:continue
 ns=m.node_tree.nodes;links=m.node_tree.links;p=ns.get('Principled BSDF')
 if not p:continue
 if p.inputs['Emission Strength'].default_value>0:continue
 base=palette.get(m.name,tuple(p.inputs['Base Color'].default_value)[:3])
 if m.name.startswith('Night glass'):base=(.24,.37,.24)
 if m.name.startswith('Teal paint'):base=(.085,.28,.245)
 if 'bark' in m.name.lower():base=(.21,.14,.075)
 if max(base)<.012:base=(.022,.032,.037)
 # Broad stepped pigment variation follows object coordinates, no microscopic photographic noise.
 for slot in ['Base Color','Normal','Roughness']:
  for l in list(p.inputs[slot].links):links.remove(l)
 p.inputs['Roughness'].default_value=.72 if p.inputs['Metallic'].default_value<.5 else .43
 p.inputs['Specular IOR Level'].default_value=.25
 p.inputs['Metallic'].default_value*=.55
 coord=ns.new('ShaderNodeTexCoord');coord.label='Object-space painted patches'
 noise=ns.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=4.5;noise.inputs['Detail'].default_value=1;noise.inputs['Roughness'].default_value=.35
 links.new(coord.outputs['Generated'],noise.inputs['Vector'])
 ramp=ns.new('ShaderNodeValToRGB');ramp.label='Three hand-painted pigment values';ramp.color_ramp.interpolation='EASE'
 ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
 for i,(pos,factor) in enumerate([(.22,.78),(.48,1),(.73,1.15)]):
  e=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(pos);e.position=pos;e.color=(*[min(.95,c*factor) for c in base],1)
 links.new(noise.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],p.inputs['Base Color'])
 m.diffuse_color=(*base,1);changed.append(m.name)
 # Remove orphaned texture nodes so the variant contains only its actual shader assets.
 for n in list(ns):
  if n.type in {'TEX_IMAGE','BUMP'}:ns.remove(n)
for ob in s.objects:
 if ob.type=='MESH':
  for mod in ob.modifiers:
   if mod.type=='BEVEL':mod.segments=2;mod.width*=1.12
  if any(t in ob.name for t in ['Pastry crimp','Glazed cherry','Marble','Fir layered','Pale circle tree','Fir trunk']):
   for f in ob.data.polygons:f.use_smooth=False
 if ob.type=='LIGHT':
  ob.data.energy*=.6
  if ob.data.type=='AREA':ob.data.size=max(.5,ob.data.size*.65)
  if max(ob.data.color)-min(ob.data.color)>.4:ob.data.color=(1,.63,.30) if ob.data.color[0]>.6 else (.35,.60,.75)
 if 'Atmosphere volume' in ob.name:
  for m in ob.data.materials:
   for n in m.node_tree.nodes:
    if n.type=='PRINCIPLED_VOLUME':n.inputs['Density'].default_value*=.45
# Cinematic warm side light, cool ambient shadows; preserve each original composition.
def area(name,loc,target,power,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=(1,.70,.38);d.shape='DISK';d.size=size
 o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
settings={'diner':((-3,-.5,5),(0,0,1),700,2),'motel':((-7,-3,8),(0,3,1),1800,4),'redroom':((-4,-2,5),(0,2,1),850,2),'forest':((-4,-1,8),(0,3,0),1600,3)}
area('ART • Golden directional key',*settings[mode])
if mode in ['motel','forest']:
 d=bpy.data.lights.new('ART • Late afternoon sun','SUN');d.energy=1.4 if mode=='motel' else 1.0;d.color=(1,.74,.43);d.angle=.07
 o=bpy.data.objects.new(d.name,d);s.collection.objects.link(o);o.rotation_euler=(.5,-.65,-.55)
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.38,.51,1)
s.world.node_tree.nodes['Background'].inputs[1].default_value=.30
s.view_settings.view_transform='AgX';s.view_settings.exposure=.35
s.render.engine='CYCLES';s.cycles.samples=20;s.cycles.use_denoising=True;s.cycles.max_bounces=4;s.cycles.volume_bounces=0
s.render.threads_mode='FIXED';s.render.threads=4
s.render.resolution_x=1200;s.render.resolution_y=750;s.render.resolution_percentage=100
s.camera.data.dof.use_dof=False
s.frame_set(1);s['art_direction']='MIxtape screenshot study: painted pigment, shaped silhouettes, golden key / teal shadow. Original environment assets.'
s['modified_materials']=json.dumps(changed)
bpy.context.preferences.filepaths.save_version=0
# Prune unused original material images; no dependence on external textures remains.
for im in list(bpy.data.images):
 if im.users==0:bpy.data.images.remove(im)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scenes'/f'{mode}-painted.blend'),compress=True)
s.render.filepath=str(ROOT/'previews'/f'{mode}-painted.png')
bpy.ops.render.render(write_still=True)
print('PAINTED_DONE',mode,flush=True)
