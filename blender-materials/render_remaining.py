import subprocess
from pathlib import Path
root=Path(__file__).resolve().parent
blender='/workspace/oiioii-canvas/lake-room/runtime/blender-4.5.10-linux-x64/blender'
for name in ['diner','motel','forest']:
    print('START',name,flush=True)
    with (root/'previews'/f'{name}.log').open('w') as log:
        p=subprocess.run([blender,'-b','-t','2','--python',str(root/'build_cinematic.py'),'--',name],stdout=log,stderr=subprocess.STDOUT)
    if p.returncode or not (root/'previews'/f'{name}.png').exists():raise RuntimeError(name+' render failed')
    print('DONE',name,flush=True)
