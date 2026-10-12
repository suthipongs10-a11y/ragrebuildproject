"""Import a ChatGPT monster set (1024px PNG, feet at y=870) into game/assets as 512px webp.
Usage: python3 tools/import_art.py <set_dir> <ID> [target_height_px]
 - sprites: pivot (256,435), uniform scale per set so front_idle is target_height tall
 - egg: scaled to egg001 height (254px), bottom at y=425
"""
import sys, os, glob
from PIL import Image
src, ID = sys.argv[1], sys.argv[2]
target = float(sys.argv[3]) if len(sys.argv) > 3 else 320
out = os.path.join(os.path.dirname(__file__), '..', 'assets')
files = {os.path.basename(p): p for p in glob.glob(src + '/**/*.png', recursive=True)}
def place(im, s, anchor_src, anchor_dst):
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    c = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    c.alpha_composite(im, (round(anchor_dst[0] - anchor_src[0] * s), round(anchor_dst[1] - anchor_src[1] * s)))
    return c
idle = Image.open(files[f'mon{ID}_front_idle.png']).convert('RGBA'); bb = idle.getchannel('A').getbbox()
s = target / (bb[3] - bb[1])
names = [f'mon{ID}_master'] + [f'mon{ID}_{v}_{p}' for v in ('front', 'back') for p in ('idle', 'attack', 'cast', 'hit', 'burst')]
for n in names:
    im = Image.open(files[n + '.png']).convert('RGBA')
    c = place(im, s, (512, 870), (256, 435))
    b = c.getchannel('A').getbbox()
    if b[0] == 0 or b[1] == 0 or b[2] == 512: print('WARN clipped', n, b)
    c.save(os.path.join(out, n + '.webp'), 'WEBP', quality=88, method=4)
egg = Image.open(files[f'egg{ID}.png']).convert('RGBA'); eb = egg.getchannel('A').getbbox()
c = place(egg, 254 / (eb[3] - eb[1]), ((eb[0] + eb[2]) / 2, eb[3]), (268, 425))
c.save(os.path.join(out, f'egg{ID}.webp'), 'WEBP', quality=88, method=4)
print(ID, 'scale', round(s, 3), 'ok')
