"""Pixel data for the separate-file art (assets_ext/), computed here because the live Artifact may not let the game read
those images' pixels (2026-10-14: every Starborn and BATCH21 monster showed as a fox on the owner's phone — the files load
but come in "cross-origin", so the canvas can draw them but not read them).

Writes
  assets_ext/meta.json      {key: [x0, y0, x1, y1, area]} — opaque bbox in the 512 sprite space (alpha > 40) and the
                            opaque pixel count of a 128x128 sample (same measure as `opaque()` in render/assets.ts);
                            also the starter fox's front idle as the size reference
  assets/thumb_<art>.webp   the set's master (or front idle) at THUMB px — embedded in the build, so menus (portraits,
                            monster book, rare-form repaints) work at once and never need to read a separate file
  assets/thumb_egg<id>.webp the set's egg at EGG_THUMB px (egg lists, hatch screen cards)

Run after adding or changing anything in assets_ext/ (build.mjs runs it by itself when meta.json misses a file):
  python3 -I tools/ext_meta.py
"""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT, ASSETS = os.path.join(ROOT, 'assets_ext'), os.path.join(ROOT, 'assets')
THUMB, EGG_THUMB = 288, 160


def measure(im):
    a = im.convert('RGBA').resize((512, 512), Image.BILINEAR).getchannel('A').point(lambda v: 255 if v > 40 else 0)
    bb = a.getbbox() or (156, 100, 356, 435)
    s = im.convert('RGBA').resize((128, 128), Image.BILINEAR).getchannel('A')
    area = sum(s.histogram()[41:])
    return [bb[0], bb[1], bb[2] - 1, bb[3] - 1, area]


def thumb(src, dst, px):
    im = Image.open(src).convert('RGBA').resize((px, px), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=82, alpha_quality=80, method=6)


meta = {}
for f in sorted(os.listdir(EXT)):
    if f.endswith('.webp'):
        meta[f[:-5]] = measure(Image.open(os.path.join(EXT, f)))
meta['mon001_front_idle'] = measure(Image.open(os.path.join(ASSETS, 'mon001_front_idle.webp')))
with open(os.path.join(EXT, 'meta.json'), 'w') as fh:
    json.dump(meta, fh, separators=(',', ':'))

made = 0
arts = sorted({k.rsplit('_', 2)[0] if k.startswith('mon') else None for k in meta} - {None, 'mon001'})
for art in arts:
    src = next((os.path.join(EXT, art + p + '.webp') for p in ('_master', '_front_idle') if os.path.exists(os.path.join(EXT, art + p + '.webp'))), None)
    if src: thumb(src, os.path.join(ASSETS, 'thumb_' + art + '.webp'), THUMB); made += 1
    egg = os.path.join(EXT, 'egg' + art[3:] + '.webp')
    if os.path.exists(egg): thumb(egg, os.path.join(ASSETS, 'thumb_egg' + art[3:] + '.webp'), EGG_THUMB); made += 1
print(f'meta: {len(meta)} images · thumbs: {made} ({", ".join(arts)})', file=sys.stderr)
