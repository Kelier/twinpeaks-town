from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import zipfile,json
R=Path(__file__).resolve().parent
modes=['diner','motel','redroom','forest']
font=ImageFont.load_default(size=18)
board=Image.new('RGB',(1440,1920),(20,22,22));d=ImageDraw.Draw(board)
for i,mode in enumerate(modes):
 p=R/'previews'/f'{mode}-v2.png'
 with Image.open(p) as im:
  assert im.size==(1440,900);im.verify()
 for col,source in enumerate([R.parent/'mixtape-study'/'previews'/f'{mode}-painted.png',p]):
  im=Image.open(source).convert('RGB');im.thumbnail((720,450));board.paste(im,(col*720,i*480+30))
 d.text((16,i*480+9),f'{mode.upper()} / V1',fill='white',font=font);d.text((736,i*480+9),f'{mode.upper()} / V2 REBUILT',fill='white',font=font)
board.save(R/'previews'/'before-after.jpg',quality=92)
files=list((R/'scenes').glob('*.blend'))+list((R/'previews').glob('*'))+[R/'STYLE-STUDY.txt',R/'rebuild.py',R/'verify.py',R/'make_transition.py',R/'VERIFIED-ASSETS.json']
out=R/'tomorrow-tape-rebuilt-v2.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,5) as z:
 for p in files:z.write(p,p.relative_to(R))
with zipfile.ZipFile(out) as z:assert z.testzip() is None
print(json.dumps({'files':len(files),'bytes':out.stat().st_size,'pngs_verified':4}))
