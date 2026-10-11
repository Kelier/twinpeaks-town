import bpy,sys
from pathlib import Path
root=Path(__file__).resolve().parent;sys.path.insert(0,str(root))
bpy.ops.wm.open_mainfile(filepath=str(root/'scenes/forest.blend'))
from forest_detail import refine
refine();s=bpy.context.scene;bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'scenes/forest.blend'),compress=True)
s.render.filepath=str(root/'previews/forest.png');bpy.ops.render.render(write_still=True)
