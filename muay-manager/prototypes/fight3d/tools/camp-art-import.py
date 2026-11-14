#!/usr/bin/env python3
"""Painted camp backdrops (docs/CAMP_ART_BRIEF.md) into assets/camp/camp-<level>.webp for the website.
Usage: python3 tools/camp-art-import.py <image for level 1> [level 2] ... (or pairs level=path, e.g. 3=camp3.png)
Each picture is cropped to 3:2 around its centre, sized 1536x1024 and saved as WebP."""
import sys, os
from PIL import Image
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'camp')
os.makedirs(OUT, exist_ok=True)
args = sys.argv[1:]
for i, a in enumerate(args):
    lvl, path = (a.split('=', 1) if '=' in a and a.split('=', 1)[0].isdigit() else (str(i + 1), a))
    im = Image.open(path).convert('RGB'); w, h = im.size
    if w / h > 1.5: nw = round(h * 1.5); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    elif w / h < 1.5: nh = round(w / 1.5); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    im = im.resize((1536, 1024), Image.LANCZOS)
    out = os.path.join(OUT, f'camp-{lvl}.webp'); im.save(out, 'WEBP', quality=80, method=6)
    print(out, os.path.getsize(out) // 1024, 'KB')
