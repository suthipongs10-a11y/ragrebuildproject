#!/usr/bin/env python3
"""Import art batch 06 (hatching altar, treasure chests, light FX) into game/assets/.

usage: python3 tools/import_fx.py <batch06_dir>      (the folder holding A_ALTAR/ B_CHESTS/ C_FX/, or one flat folder)

Objects keep their alpha and are downscaled. Light layers (fx_*.png, hatch_altar_glow.png) arrive as white-on-black
for additive blending; they are converted to WHITE + ALPHA (alpha = brightness) so the game can tint them to any colour
(assets.ts `tinted()`) and draw them with 'lighter'. Code positions stay in the original canvas coordinates.
"""
import sys, os
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
OBJ = {  # name -> output size
    'hatch_altar': (768, 768), 'hatch_crystal': (256, 256), 'hatch_crystal_stand': (256, 256), 'hatch_floor': (1024, 683),
    'chest_wood_closed': (768, 768), 'chest_wood_ajar': (768, 768), 'chest_wood_open': (768, 768),
    'chest_boss_closed': (768, 768), 'chest_boss_ajar': (768, 768), 'chest_boss_open': (768, 768),
}
LIGHT = {
    'hatch_altar_glow': (768, 768), 'fx_rays': (512, 512), 'fx_burst': (512, 512), 'fx_ring': (512, 512),
    'fx_rune_circle': (768, 768), 'fx_column': (256, 512), 'fx_sparkle': (128, 128), 'fx_orb': (128, 128),
}


def light_to_alpha(im):
    a = im.convert('L')
    out = Image.new('RGBA', im.size, (255, 255, 255, 0)); out.putalpha(a)
    return out


def main(src):
    files = {}
    for d, _, fs in os.walk(src):
        for f in fs:
            if f.endswith('.png'): files[f[:-4]] = os.path.join(d, f)
    done, missing = [], []
    for name, size in list(OBJ.items()) + list(LIGHT.items()):
        if name not in files: missing.append(name); continue
        im = Image.open(files[name])
        im = light_to_alpha(im) if name in LIGHT else im.convert('RGBA')
        im.resize(size, Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=88, method=6)
        done.append(name)
    kb = sum(os.path.getsize(os.path.join(OUT, n + '.webp')) for n in done) / 1024
    print(f'imported {len(done)} images ({kb:.0f} KB)')
    if missing: print('not found (code drawing stays):', ', '.join(missing))


if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit(__doc__)
    main(sys.argv[1])
