#!/usr/bin/env python3
"""Fit an image from Google Flow (or any generator that ignores the requested canvas) to the brief's canvas, then save PNG.

usage: python3 -I tools/fit_flow.py <in> <out.png> <W>x<H> <mode> [--bottom F] [--key]

Flow only makes a few aspect ratios (1:1, 9:16, 16:9 ...) and saves JPG, so the importers (import_fx.py / import_art.py)
need the picture moved onto the canvas the brief asked for first. The content box = pixels brighter than the background
(light FX on black) or, with --key, everything that is not the magenta #FF00FF background.
  pad     keep the whole picture, add background around it to reach the target aspect (no distortion)
  crop    cut the target aspect out around the content box centre (content must fit; falls back to pad)
  squash  crop to the content box on the short side, then resize to the target (small distortion, e.g. beams)
  --bottom F   (pad) put the content box bottom at F × height, e.g. .9 for an aura whose body bottom is y≈1380/1536
  --key        object art on flat magenta: magenta → transparent (soft edges de-fringed); output keeps alpha
Light FX stay on black; import_fx.py turns brightness into alpha.
"""
import sys
from PIL import Image

args = sys.argv[1:]
bottom = None; key = '--key' in args
if key: args.remove('--key')
if '--bottom' in args: i = args.index('--bottom'); bottom = float(args[i + 1]); del args[i:i + 2]
if len(args) != 4: sys.exit(__doc__)
src, dst, size, mode = args
W, H = map(int, size.lower().split('x'))
im = Image.open(src).convert('RGBA')


def unkey(im):
    """magenta (#FF00FF) → alpha: distance from magenta sets alpha, and the magenta spill is removed from the colour"""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = px[x, y]
            m = min(r, b) - g  # how magenta the pixel is (0 for neutral colours)
            a = 255 if m < 40 else max(0, 255 - (m - 40) * 255 // 150)
            if a < 255 and a > 0: r, b = max(g, r - m * (255 - a) // 255), max(g, b - m * (255 - a) // 255)
            px[x, y] = (r, g, b, a)
    return im


if key: im = unkey(im)
bg = (0, 0, 0, 0) if key else (0, 0, 0, 255)
mask = im.getchannel('A') if key else im.convert('L').point(lambda v: 255 if v > 24 else 0)
bb = mask.point(lambda v: 255 if v > 40 else 0).getbbox() or (0, 0, im.width, im.height)
ta = W / H


def pad(im):
    w, h = im.size
    cw, ch = (w, round(w / ta)) if w / h > ta else (round(h * ta), h)
    top = (ch - h) // 2
    if bottom:  # move the content bottom to bottom × height (grow the canvas if needed)
        ch = max(ch, round(bb[3] / bottom)); cw = max(cw, round(ch * ta)); ch = round(cw / ta); top = round(bottom * ch) - bb[3]
    c = Image.new('RGBA', (cw, ch), bg); c.alpha_composite(im, ((cw - w) // 2, max(0, top))); return c


if mode == 'crop':
    w, h = im.size
    cw, ch = (round(h * ta), h) if w / h > ta else (w, round(w / ta))
    cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
    x0, y0 = min(max(0, round(cx - cw / 2)), w - cw), min(max(0, round(cy - ch / 2)), h - ch)
    if x0 <= bb[0] and y0 <= bb[1] and x0 + cw >= bb[2] and y0 + ch >= bb[3]: im = im.crop((x0, y0, x0 + cw, y0 + ch))
    else: print('content does not fit the crop, padding instead'); im = pad(im)
elif mode == 'squash':
    m = 12
    im = im.crop((0, max(0, bb[1] - m), im.width, min(im.height, bb[3] + m))) if im.width / im.height > ta else im.crop((max(0, bb[0] - m), 0, min(im.width, bb[2] + m), im.height))
elif mode == 'pad': im = pad(im)
else: sys.exit('mode must be pad, crop or squash')
im = im.resize((W, H), Image.LANCZOS)
(im if key else im.convert('RGB')).save(dst)
print(dst, f'{W}x{H}', mode)
