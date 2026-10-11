from pathlib import Path
import json,struct,hashlib,datetime
root=Path(__file__).resolve().parents[2]
results=[]
for name in ['dale-cooper','audrey-horne','laura-palmer','harry-truman','the-giant','pete-martell','leland-palmer','bob']:
 p=root/'public/models/twin-peaks'/f'{name}.glb';b=p.read_bytes();length=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+length]);r={'name':name,'bytes':len(b),'meshes':len(d['meshes']),'bones':len(d['skins'][0]['joints']),'animations':len(d.get('animations',[])),'vertexColorPrimitives':sum('COLOR_0' in q['attributes'] for m in d['meshes'] for q in m['primitives']),'sha256':hashlib.sha256(b).hexdigest()};results.append(r)
 assert r['bones']==16 and r['animations']>=1 and r['vertexColorPrimitives']>=1 and r['meshes']<35,r
assert len(set(r['sha256'] for r in results))==8
manifest=json.loads((root/'public/models/twin-peaks/manifest.json').read_text())
assert len(manifest)==10
for scene in manifest:
 for cast in scene['cast']:assert (root/'public/models/twin-peaks'/cast['asset']).exists()
Path(__file__).with_name('ASSET-VERIFICATION.json').write_text(json.dumps({'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'characters':results,'sceneCount':len(manifest)},indent=2))
print('8 distinct skinned character GLBs; 16 bones each; animations and vertex color skin; 10 scene references valid.')
