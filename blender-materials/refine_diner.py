import bpy
from pathlib import Path
root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'scenes/diner.blend'))
s=bpy.context.scene;m=bpy.data.materials['Brushed nickel']
for x in [-.95,.95]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.065,depth=.88,location=(x,-.4,.49));o=bpy.context.object;o.name='Hero table chrome pedestal';o.data.materials.append(m)
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-.4,.045));o=bpy.context.object;o.name='Hero table foot';o.dimensions=(.72,.6,.09);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);mod=o.modifiers.new('Soft edges','BEVEL');mod.width=.04;mod.segments=3
s.cycles.samples=24;bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'scenes/diner.blend'))
s.render.filepath=str(root/'previews/diner.png');bpy.ops.render.render(write_still=True)
