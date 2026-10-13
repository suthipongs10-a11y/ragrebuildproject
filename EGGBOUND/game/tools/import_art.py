"""Import a ChatGPT monster set (1024px PNG) into game/assets as 512px webp.
Usage: python3 tools/import_art.py <set_dir> <ID> [target_height_px] [--mirror name,name] [--key KEY]
 - sprites: feet pivot (256,435). Each image is anchored on its OWN feet (bottom of the opaque bbox) and the canvas
   centre x, because ChatGPT does not keep the requested y=870 feet line. One uniform scale per set, from front_idle
   (or master when idle is missing/broken), so front_idle ends up target_height tall (starters: 280-345).
 - --mirror: pose names (e.g. front_idle,master) drawn facing left; they are flipped to face right like the fox.
 - damaged (truncated) or missing PNGs are skipped and reported; the game falls back to another pose (assets.ts spr()).
 - egg: scaled to egg001 height (254px), bottom at y=425.
 - --key: asset key when it differs from mon<ID> (e.g. --key monA09e for an evolved form).
 - --out DIR: write somewhere other than assets/ (e.g. assets_staged/ for art whose monster is not in the game yet —
   build.mjs embeds everything in assets/, so staged art does not cost bundle size until it is moved in).
 - extra motion poses (BATCH13+: windup, strike, follow, cast2, joy, down — front/back) are imported when present.
 - add-on sets without front_idle: include mon<ID>_front_idle_ref.png (a redraw of the idle); its height is matched to the
   EXISTING assets/<key>_front_idle.webp so new poses keep the in-game scale (target height is then ignored).
"""
import sys, os, glob
from PIL import Image

args = [a for a in sys.argv[1:]]
mirror, key = set(), None
if '--mirror' in args: i = args.index('--mirror'); mirror = set(args[i + 1].split(',')); del args[i:i + 2]
if '--key' in args: i = args.index('--key'); key = args[i + 1]; del args[i:i + 2]
out_dir = None
if '--out' in args: i = args.index('--out'); out_dir = args[i + 1]; del args[i:i + 2]
if len(args) < 2: sys.exit(__doc__)
src, ID = args[0], args[1]
target = float(args[2]) if len(args) > 2 else 320
key = key or f'mon{ID}'
out = out_dir or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
os.makedirs(out, exist_ok=True)
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


BASE = ['master'] + [f'{v}_{p}' for v in ('front', 'back') for p in ('idle', 'attack', 'cast', 'hit', 'burst')]
EXTRA = [f'{v}_{p}' for v in ('front', 'back') for p in ('windup', 'strike', 'follow', 'cast2', 'joy', 'down')]
present = lambda p: f'mon{ID}_{p}.png' in files
idle_ref = load(f'mon{ID}_front_idle_ref') if present('front_idle_ref') else None
poses = [p for p in BASE if not idle_ref or present(p)] + [p for p in EXTRA if present(p)]
imgs = {p: load(f'mon{ID}_{p}') for p in poses}
if idle_ref is not None:  # add-on set: match the in-game idle height
    cur = Image.open(os.path.join(out, f'{key}_front_idle.webp')).convert('RGBA'); cb0 = bbox(cur); rb = bbox(idle_ref)
    s = (cb0[3] - cb0[1]) / (rb[3] - rb[1]); FEET_Y = cb0[3]  # e.g. the fox's feet sit at y=416, not 435
else:
    FEET_Y = 435
    ref = imgs.get('front_idle') or imgs.get('master') or imgs.get('back_idle')
    if ref is None: sys.exit(f'{ID}: no usable front_idle/master/back_idle')
    rb = bbox(ref)
    s = target / (rb[3] - rb[1])
    if imgs.get('front_idle') is None: s *= .92  # master is drawn a bit bigger than idle
AIR = ('strike', 'joy')  # airborne poses keep their height above the feet line of the idle reference
for p, im in imgs.items():
    if im is None: continue
    b = bbox(im)
    feet = b[3] if not p.endswith(AIR) or idle_ref is None else bbox(idle_ref)[3]
    c = place(im, s, (im.width / 2, feet), (256, FEET_Y))
    cb = bbox(c)
    if cb[0] == 0 or cb[1] == 0 or cb[2] == 512: print('WARN clipped', p, cb)
    c.save(os.path.join(out, f'{key}_{p}.webp'), 'WEBP', quality=72, alpha_quality=60, method=6)
egg = load(f'egg{ID}') if present('egg' + ID) or not idle_ref else None
if egg is not None:
    eb = bbox(egg)
    c = place(egg, 254 / (eb[3] - eb[1]), ((eb[0] + eb[2]) / 2, eb[3]), (268, 425))
    c.save(os.path.join(out, f'egg{ID}.webp'), 'WEBP', quality=72, alpha_quality=60, method=6)
print(ID, 'scale', round(s, 3), 'ok', ('BROKEN: ' + ','.join(broken)) if broken else '', ('MISSING: ' + ','.join(missing)) if missing else '')
