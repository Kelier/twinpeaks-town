"""Render the homepage miniature from the project's Blender master.
Run: blender -b --python blender-materials/title-redroom/render_title.py
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'blender-materials/miniature-production/twin-peaks-miniatures.blend'))
s=bpy.context.scene
stage=bpy.data.collections['SET • redroom']
for c in bpy.data.collections:
    if c.name.startswith('SET • '): c.hide_render=c!=stage
stage.hide_render=False
for obj in stage.objects:
    if obj.instance_type=='COLLECTION':obj.hide_render=True
for obj in s.objects:
    if obj.type=='LIGHT':obj.hide_render=True
# A larger, empty chair makes the absence of a person the centre of the scene.
for name,scale,loc in [('Club chair',1.65,(.55,.25,0)),('Deco side table',1.5,(-1.28,.22,0)),('Saturn lamp',1.5,(-1.28,.22,1.2675))]:
    o=bpy.data.objects[name];o.scale=(scale,)*3;o.location=loc
# Burgundy velvet; warm practical light against a cold black surround.
m=bpy.data.materials['Velvet • lodge curtain'];m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.16,.002,.005,1)
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.006,.008,.012,1)
s.world.node_tree.nodes['Background'].inputs[1].default_value=.25

def area(name,loc,target,power,color,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Title • soft key',(1,-5,7),(0,0,1),1800,(1,.83,.65),5)
area('Title • velvet rake',(-2,0,4.7),(0,2,2),480,(1,.36,.24),2.2)
area('Title • silver fill',(5,-1,4),(0,0,1),650,(.58,.72,1),4)
area('Title • lamp glow',(1.75,1.85,3.5),(1.6,2.3,4.5),100,(1,.78,.45),.5)
cam=bpy.data.objects.new('Title • miniature camera',bpy.data.cameras.new('Title • orthographic lens'));s.collection.objects.link(cam)
cam.location=(9,-13,8);cam.rotation_euler=(Vector((0,0,1.55))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=10.5;s.camera=cam
s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=True;s.cycles.max_bounces=5
s.render.resolution_x=1500;s.render.resolution_y=1500;s.render.resolution_percentage=100
s.render.film_transparent=True;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA'
s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender-materials/title-redroom/title-redroom.blend'),compress=True)
s.render.filepath=str(ROOT/'public/themes/red-room-miniature.png');bpy.ops.render.render(write_still=True)
