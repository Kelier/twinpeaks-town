from pathlib import Path
from PIL import Image
import zipfile,json
root=Path(__file__).resolve().parent
for mode in ['diner','motel','redroom','forest']:
 p=root/'previews'/f'{mode}-painted.png'
 with Image.open(p) as im:
  assert im.size==(1200,750)
  im.verify()
files=list((root/'scenes').glob('*.blend'))+list((root/'previews').glob('*.png'))+[root/'ART-DIRECTION.txt',root/'restyle.py',root/'audit_assets.py',root/'ASSET-MANIFEST.json']
assert len(files)==12
out=root/'painted-memory-blender.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,6) as z:
 for p in files:z.write(p,p.relative_to(root))
with zipfile.ZipFile(out) as z:assert z.testzip() is None
print(json.dumps({'files':len(files),'archive_bytes':out.stat().st_size,'images_verified':4}))
