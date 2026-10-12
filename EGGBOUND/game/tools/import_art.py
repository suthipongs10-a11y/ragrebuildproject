"""Import a ChatGPT monster set (1024px PNG) into game/assets as 512px webp.
Usage: python3 tools/import_art.py <set_dir> <ID> [target_height_px] [--mirror name,name] [--key KEY]
 - sprites: feet pivot (256,435). Each image is anchored on its OWN feet (bottom of the opaque bbox) and the canvas
   centre x, because ChatGPT does not keep the requested y=870 feet line. One uniform scale per set, from front_idle
   (or master when idle is missing/broken), so front_idle ends up target_height tall (starters: 280-345).
 - --mirror: pose names (e.g. front_idle,master) drawn facing left; they are flipped to face right like the fox.
 - damaged (truncated) or missing PNGs are skipped and reported; the game falls back to another pose (assets.ts spr()).
 - egg: scaled to egg001 height (254px), bottom at y=425.
 - --key: asset key when it differs from mon<ID> (e.g. --key monA09e for an evolved form).
"""
import sys, os, glob
from PIL import Image

args = [a for a in sys.argv[1:]]
mirror, key = set(), None
if '--mirror' in args: i = args.index('--mirror'); mirror = set(args[i + 1].split(',')); del args[i:i + 2]
if '--key' in args: i = args.index('--key'); key = args[i + 1]; del args[i:i + 2]
if len(args) < 2: sys.exit(__doc__)
src, ID = args[0], args[1]
target = float(args[2]) if len(args) > 2 else 320
key = key or f'mon{ID}'
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
files = {os.path.basename(p): p for p in glob.glob(src + '/**/*.png', recursive=True)}
broken, missing = [], []


def load(name):
    p = files.get(name + '.png')
    if not p: missing.append(name); return None
    try:
        im = Image.open(p); im.load()
    except OSError:
        broken.append(name); return None
    im = im.convert('RGBA')
    pose = name.split('_', 1)[1] if '_' in name else name
    return im.transpose(Image.FLIP_LEFT_RIGHT) if pose in mirror else im


def bbox(im):
    return im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()


def place(im, s, anchor_src, anchor_dst):
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    c = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    c.alpha_composite(im, (round(anchor_dst[0] - anchor_src[0] * s), round(anchor_dst[1] - anchor_src[1] * s)))
    return c


poses = ['master'] + [f'{v}_{p}' for v in ('front', 'back') for p in ('idle', 'attack', 'cast', 'hit', 'burst')]
imgs = {p: load(f'mon{ID}_{p}') for p in poses}
ref = imgs['front_idle'] or imgs['master'] or imgs['back_idle']
if ref is None: sys.exit(f'{ID}: no usable front_idle/master/back_idle')
rb = bbox(ref)
s = target / (rb[3] - rb[1])
if imgs['front_idle'] is None: s *= .92  # master is drawn a bit bigger than idle
for p, im in imgs.items():
    if im is None: continue
    b = bbox(im)
    c = place(im, s, (im.width / 2, b[3]), (256, 435))
    cb = bbox(c)
    if cb[0] == 0 or cb[1] == 0 or cb[2] == 512: print('WARN clipped', p, cb)
    c.save(os.path.join(out, f'{key}_{p}.webp'), 'WEBP', quality=82, alpha_quality=70, method=6)
egg = load(f'egg{ID}')
if egg is not None:
    eb = bbox(egg)
    c = place(egg, 254 / (eb[3] - eb[1]), ((eb[0] + eb[2]) / 2, eb[3]), (268, 425))
    c.save(os.path.join(out, f'egg{ID}.webp'), 'WEBP', quality=82, alpha_quality=70, method=6)
print(ID, 'scale', round(s, 3), 'ok', ('BROKEN: ' + ','.join(broken)) if broken else '', ('MISSING: ' + ','.join(missing)) if missing else '')
