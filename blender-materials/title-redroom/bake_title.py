"""Cycles UV-atlas lighting/AO for the interactive title. No rendered poster.
Run Blender 4.5: blender --factory-startup -b -t 2 --python bake_title.py
"""
import bpy, math, json, time
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/themes';START=time.time()
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender-materials/title-redroom/title-redroom.blend'))
s=bpy.context.scene;stage=bpy.data.collections['SET • redroom']
for layer in bpy.context.view_layer.layer_collection.children:
 layer.exclude=layer.name!=stage.name and not any(o.type=='LIGHT' and o.name.startswith('Title') for o in layer.collection.objects)
for c in bpy.data.collections:
 if c.name.startswith('SET • '):c.hide_render=c!=stage
stage.hide_viewport=False;stage.hide_render=False
for o in stage.objects:o.hide_viewport=False;o.hide_set(False);o.hide_render=o.instance_type=='COLLECTION'
# Evaluate the authored rounded cushions at production resolution.
objects=[]
for o in list(stage.objects):
 if o.type not in {'MESH','FONT'} or o.instance_type=='COLLECTION':continue
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 if o.type=='FONT':bpy.ops.object.convert(target='MESH');o=bpy.context.object
 for m in o.modifiers:
  if m.type=='BEVEL':m.segments=max(m.segments,5 if 'Chair' in o.name else 3)
  if m.type=='SUBSURF' and 'Chair' in o.name:m.levels=max(m.levels,2);m.render_levels=m.levels
 for m in list(o.modifiers):
  try:bpy.ops.object.modifier_apply(modifier=m.name)
  except RuntimeError:pass
 # Give printed chevrons enough depth precision without a floating slab.
 if 'black chevrons' in o.name:o.location.z+=.002
 objects.append(o)
# Real paper programme and a closed dream folio, both navigation targets.
def box(name,loc,scale,color):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for c in list(o.users_collection):c.objects.unlink(o)
 stage.objects.link(o);m=bpy.data.materials.new(name+' • material');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.7;o.data.materials.append(m)
 mod=o.modifiers.new('Fine edge','BEVEL');mod.width=.012;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name);objects.append(o);return o
box('Dream archive • closed folio',(-1.18,-.03,1.39),(.5,.35,.07),(.07,.023,.018))
program=box('Programme • invitation',(-2.65,.55,1.35),(.46,.03,.65),(.48,.40,.28));program.rotation_euler[0]=math.radians(-8)
# One shared atlas packed across every mesh. Model exports atlas as TEXCOORD_0.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:
 o.select_set(True)
 while o.data.uv_layers:o.data.uv_layers.remove(o.data.uv_layers[0])
 o.data.uv_layers.new(name='Baked atlas')
bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.006,area_weight=.5,correct_aspect=True,scale_to_bounds=True);bpy.ops.object.mode_set(mode='OBJECT')
materials={m for o in objects for m in o.data.materials if m}
# Authored material grain survives export as a baked tangent-normal map.
for m in materials:
 if any(word in m.name for word in ['Leather','Velvet']):
  nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
  noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=140 if 'Leather' in m.name else 210;noise.inputs['Detail'].default_value=2
  bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.16 if 'Leather' in m.name else .1;bump.inputs['Distance'].default_value=.004
  links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],p.inputs['Normal'])
s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.cycles.max_bounces=4;s.cycles.diffuse_bounces=3;s.render.threads_mode='FIXED';s.render.threads=2
s.render.bake.margin=12;s.render.bake.use_clear=True
# Soften broad shadows at source instead of low-resolution runtime shadow maps.
for o in s.objects:
 if o.type=='LIGHT':
  o.hide_render=not o.name.startswith('Title')
  if o.name.startswith('Title') and o.data.type=='AREA':o.data.energy*=.45
s.world.node_tree.nodes['Background'].inputs[1].default_value=.18

def bake(name,kind,passes=None):
 image=bpy.data.images.new(name,width=2048,height=2048,float_buffer=False);image.colorspace_settings.name='Non-Color'
 for m in materials:
  n=m.node_tree.nodes.new('ShaderNodeTexImage');n.name='BAKE • '+name;n.image=image;m.node_tree.nodes.active=n
 if passes:
  s.render.bake.use_pass_direct='DIRECT' in passes;s.render.bake.use_pass_indirect='INDIRECT' in passes;s.render.bake.use_pass_color='COLOR' in passes
 print('BAKE_START',name,flush=True);bpy.ops.object.bake(type=kind)
 image.filepath_raw=str(OUT/(name+'.png'));image.file_format='PNG';image.save();print('BAKE_DONE',name,time.time()-START,flush=True)
 return image
normal=bake('room-surface-normal','NORMAL')
ao=bake('room-contact-ao','AO')
metallic={m:m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value for m in materials}
for m in materials:m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=0
light=bake('room-baked-light','DIFFUSE',{'DIRECT','INDIRECT'})
for m,value in metallic.items():m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=value
# Geometry stays real; atlas textures are loaded separately by the worker.
for m in materials:
 for n in list(m.node_tree.nodes):
  if n.name.startswith('BAKE •'):m.node_tree.nodes.remove(n)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender-materials/title-redroom/title-baked.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'red-room-baked.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=True)
triangles=sum(len(o.data.polygons) for o in objects)
# Same miniature at low LOD, visible only in the opening darkness.
for o in objects:
 bpy.context.view_layer.objects.active=o
 if len(o.data.polygons)>150:
  mod=o.modifiers.new('Opening silhouette LOD','DECIMATE');mod.ratio=.12;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.export_scene.gltf(filepath=str(OUT/'red-room-opening.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=False)
(OUT/'room-bake.json').write_text(json.dumps({'source':'blender-materials/title-redroom/title-baked.blend','engine':'Cycles 4.5.10','samples':16,'bounces':4,'atlas':[2048,2048],'uv':'TEXCOORD_0 shared atlas','maps':{'light':'room-baked-light.png','ao':'room-contact-ao.png','normal':'room-surface-normal.png'},'normalSpace':'tangent','lightingPass':['direct','indirect'],'lightColorSpace':'linear','meshes':len(objects),'polygons':triangles,'elapsedSeconds':round(time.time()-START,2)},indent=2))
print('BAKE_EXPORT_COMPLETE',time.time()-START,flush=True)
