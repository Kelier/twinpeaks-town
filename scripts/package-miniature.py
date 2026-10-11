from pathlib import Path
import zipfile,json
root=Path(__file__).resolve().parents[1]
files=[]
for name in ['rebuild.py','integrate.py','verify_assets.py','READ-ME.txt','twin-peaks-character-rebuild.blend','WEB-VERIFICATION.json','ASSET-VERIFICATION.json']:
 files.append(root/'blender-materials/character-rebuild'/name)
for folder in ['public/models/twin-peaks','public/fonts','blender-materials/character-rebuild/previews']:
 files+=list((root/folder).glob('*'))
for name in ['index.html','vite.config.js','src/tvMain.js','src/miniatureStage.js','src/content/tvEpisodes.js','src/ui/tv.css','src/ui/stickers.css','src/ui/stickers.js','PRODUCT.md','DESIGN.md','docs/tv-cut/PLAY.txt','docs/tv-cut/RESEARCH.md','docs/tv-cut/miniature-direction.md','blender-materials/miniature-production/twin-peaks-miniatures.blend','blender-materials/miniature-production/build.py','blender-materials/miniature-production/verify.py','blender-materials/miniature-production/VERIFIED.json','blender-materials/miniature-production/PRODUCTION.txt']:
 files.append(root/name)
for p in ['docs/tv-cut/MINIATURE-VERIFICATION.json','docs/tv-cut/MOTION-VERIFICATION.json','docs/tv-cut/FINAL-REVIEW.txt','.impeccable/review/miniature/build.log']:
 if (root/p).exists(): files.append(root/p)
with zipfile.ZipFile(root/'twin-peaks-miniature-3d.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in files:
  if p.is_file():z.write(p,p.relative_to(root))
 z.writestr('package.json',json.dumps({'name':'twin-peaks-miniature','private':True,'version':'1.0.0','type':'module','scripts':{'dev':'vite --host 0.0.0.0','build':'vite build','preview':'vite preview --host 0.0.0.0'},'dependencies':{'three':'^0.186.1'},'devDependencies':{'vite':'^8.3.4'}},indent=2))
 z.writestr('START.txt','新版人物：blender-materials/character-rebuild/twin-peaks-character-rebuild.blend。完整场景：blender-materials/miniature-production/twin-peaks-miniatures.blend。\n网页版：安装 Node.js 22.12+；在此目录 npm install，然后 npm run dev。\n所有场景与人物为真实网格。细致表情和逐场表演尚未完成。\n')
print(root/'twin-peaks-miniature-3d.zip')
