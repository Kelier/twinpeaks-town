from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter
root=Path(__file__).parent/'textures';root.mkdir(exist_ok=True)
n=1024;rng=np.random.default_rng(31);y,x=np.mgrid[0:n,0:n]/n
noise=np.zeros((n,n))
for k,w in [(8,.4),(32,.22),(128,.13),(512,.07)]:
    a=Image.fromarray((rng.random((k,k))*255).astype('uint8')).resize((n,n),Image.Resampling.BICUBIC)
    noise+=(np.array(a)/255-.5)*w
for name,color in [('walnut',(95,53,29)),('velvet',(114,13,21)),('asphalt',(49,57,60)),('leather',(52,28,23))]:
    if name=='walnut': detail=noise*.3+np.sin((x*48+noise*2+np.sin(y*9)*.15)*6.28)*.065;rough=.48+noise*.2
    elif name=='velvet':detail=noise*.16+(np.sin(x*2048)*np.sin(y*2048))*.035;rough=.72+noise*.12
    elif name=='asphalt':detail=noise*.65+rng.random((n,n))*.12;rough=.25+noise*.35
    else:detail=noise*.4+np.sin(noise*60)*.04;rough=.42+noise*.3
    rgb=np.stack([np.clip(c*(1+detail*2),0,255) for c in color],axis=-1).astype('uint8')
    Image.fromarray(rgb).save(root/f'{name}_basecolor.png')
    Image.fromarray((np.clip(rough,0,1)*255).astype('uint8')).save(root/f'{name}_roughness.png')
    Image.fromarray((np.clip(.5+detail,0,1)*255).astype('uint8')).save(root/f'{name}_height.png')
print('12 original 1K material maps generated')
