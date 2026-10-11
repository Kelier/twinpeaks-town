from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
root=Path(__file__).resolve().parents[1]
files=[Path(p) for p in ['index.html','src/tvMain.js','src/content/tvEpisodes.js','src/ui/tv.css','src/ui/stickers.js','src/ui/stickers.css','PRODUCT.md','DESIGN.md','.impeccable/design.json']]
files += list((root/'public/art/tv-cut').glob('*.png'))+list((root/'public/fonts').glob('*'))+list((root/'docs/tv-cut').glob('*'))
out=root/'twin-peaks-tv-cut.zip'
with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=6) as z:
 for f in files:
  p=f if f.is_absolute() else root/f
  if p.is_file():z.write(p,str(p.relative_to(root)))
 z.writestr('package.json',json.dumps({'name':'twin-peaks-tv-cut','version':'1.0.0','private':True,'type':'module','scripts':{'dev':'vite --host 0.0.0.0','build':'vite build','preview':'vite preview --host 0.0.0.0'},'devDependencies':{'vite':'^8.3.4'}},indent=2))
 z.writestr('README.txt',(root/'docs/tv-cut/PLAY.txt').read_text())
print(out, out.stat().st_size)
with ZipFile(out) as z:
 assert z.testzip() is None
 print('archive verified:', len(z.namelist()), 'files')
