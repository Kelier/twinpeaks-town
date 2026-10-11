# Derived costume textures (e.g. Cooper's plain black tie) from MakeHuman source textures.
from PIL import Image, ImageFilter, ImageChops
from pathlib import Path
import numpy as np
SRC = Path.home() / '.config/blender/4.5/extensions/.user/user_default/mpfb/data/clothes'
OUT = Path(__file__).resolve().parent / 'textures'; OUT.mkdir(exist_ok=True)

im = Image.open(SRC / 'male_elegantsuit01/male_elegantsuit01_diffuse.png').convert('RGB')
a = np.asarray(im).astype(np.int16)
blue = ((a[..., 2] - a[..., 0]) > 18).astype(np.uint8) * 255
m = Image.fromarray(blue).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.MinFilter(9))
mask = np.asarray(m) > 0
lum = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(14))).astype(float)[..., None] / 255.
tie = np.clip(12 + 14 * lum, 0, 255) * np.array([1, 1, 1.08])
a = np.where(mask[..., None], tie, a)
Image.fromarray(a.astype(np.uint8)).save(OUT / 'cooper_suit_diffuse.png')
print('ok')

# Audrey: burgundy knit top + grey/burgundy plaid skirt; Laura: black dress, from female_elegantsuit01.
im = Image.open(SRC / 'female_elegantsuit01/female_elegantsuit01_diffuse.png').convert('RGB')
a = np.asarray(im).astype(np.int16)
red = ((a[..., 0] - a[..., 1]) > 40).astype(np.uint8) * 255
top = np.asarray(Image.fromarray(red).filter(ImageFilter.MaxFilter(41)).filter(ImageFilter.MinFilter(25))) > 0
shade = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(10))).astype(float)[..., None] / 255.
H, W = top.shape
yy, xx = np.mgrid[0:H, 0:W]
rng = np.random.default_rng(3)
knit = (np.sin(xx * 1.6) * np.sin(yy * .8) * 10 + rng.normal(0, 6, (H, W)))[..., None]
burg = np.clip(np.array([92, 16, 26]) + knit, 0, 255)
band = lambda v, p, w: ((v % p) < w)
plaid = np.full((H, W, 3), [78, 74, 70], float)
for v in (xx, yy):
    plaid = np.where(band(v, 96, 30)[..., None], plaid * .55, plaid)
    plaid = np.where(band(v + 40, 96, 6)[..., None], [110, 24, 32], plaid)
    plaid = np.where(band(v + 70, 192, 3)[..., None], [190, 180, 160], plaid)
skirt = plaid * (.75 + .5 * shade)
out = np.where(top[..., None], burg * (.7 + .6 * shade), skirt)
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT / 'audrey_outfit_diffuse.png')
blk = np.where(top[..., None], np.array([14, 13, 15]) * (.8 + .5 * shade), np.array([10, 10, 11]) * (.8 + .5 * shade))
Image.fromarray(np.clip(blk, 0, 255).astype(np.uint8)).save(OUT / 'laura_dress_diffuse.png')
print('ok outfits')
