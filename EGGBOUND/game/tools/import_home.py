#!/usr/bin/env python3
"""Import the turtle-home art sets (ChatGPT batch 04 A/B/C) into game/assets/.

usage: python3 tools/import_home.py <set_dir> [<set_dir> ...]

Each set dir holds the PNGs named as in art/prompts/EGGBOUND_ART_BATCH04_*.txt. Files are downscaled
(the game never draws them at full size) and saved as webp; positions in the code stay in the original
canvas coordinates (shell 1536x1024, buildings/head/flippers 1024x1024 with base at y=900, relics 512).
Also writes bld_gate_hole.webp: a mask of the transparent arch opening, used to clip the portal swirl.
"""
import sys, os
from collections import deque
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
SIZE = {  # source name -> (asset name, output size)
    'home_turtle_shell.png': ('home_shell', (1152, 768)),
    'home_turtle_head.png': ('home_head', (512, 512)),
    'home_turtle_head_blink.png': ('home_head_blink', (512, 512)),
    'home_turtle_head_hum.png': ('home_head_hum', (512, 512)),
    'home_turtle_flipper_front.png': ('home_flipper_front', (512, 512)),
    'home_turtle_flipper_back.png': ('home_flipper_back', (512, 512)),
}
for n in ['castle_1', 'castle_2', 'castle_3', 'castle_4', 'gate', 'hatchery_1', 'hatchery_2', 'hatchery_3', 'site',
          'mine_1', 'mine_3', 'mine_5', 'shrine', 'altar', 'forge', 'arena']:
    SIZE[f'bld_{n}.png'] = (f'bld_{n}', (512, 512))
for n in ['sun', 'feather', 'shell', 'gourd']:
    SIZE[f'relic_{n}.png'] = (f'relic_{n}', (256, 256))


def hole_mask(im, size):
    """transparent pixels not reachable from the image border = the arch opening"""
    a = im.getchannel('A'); w, h = a.size; px = a.load()
    seen = bytearray(w * h); q = deque()
    for x in range(w):
        for y in (0, h - 1): q.append((x, y))
    for y in range(h):
        for x in (0, w - 1): q.append((x, y))
    while q:
        x, y = q.popleft(); i = y * w + x
        if seen[i] or px[x, y] >= 40: continue
        seen[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    m = Image.new('L', (w, h)); mp = m.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] < 40 and not seen[y * w + x]: mp[x, y] = 255
    out = Image.new('RGBA', (w, h), (255, 255, 255, 0)); out.putalpha(m)
    return out.resize(size, Image.LANCZOS)


def main(dirs):
    done, missing = [], set(SIZE)
    for d in dirs:
        for f in sorted(os.listdir(d)):
            if f not in SIZE: continue
            name, size = SIZE[f]; im = Image.open(os.path.join(d, f)).convert('RGBA')
            im.resize(size, Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=86, method=6)
            if f == 'bld_gate.png':
                hole_mask(im, size).save(os.path.join(OUT, 'bld_gate_hole.webp'), 'WEBP', lossless=True)
            done.append(name); missing.discard(f)
    kb = sum(os.path.getsize(os.path.join(OUT, n + '.webp')) for n in done) / 1024
    print(f'imported {len(done)} images ({kb:.0f} KB)')
    if missing: print('not found (code drawing stays):', ', '.join(sorted(missing)))


if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__)
    main(sys.argv[1:])
