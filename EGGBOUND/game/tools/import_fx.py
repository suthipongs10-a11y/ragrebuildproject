#!/usr/bin/env python3
"""Import art batch 06 (hatching altar, treasure chests, light FX), 12 (hatch power-up FX), 13-B, 14 (loot UI), 15 (adventure book) and 16 (pedestals) into game/assets/.

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
    # BATCH14 loot UI
    'ui_star': (128, 128), 'ui_star_empty': (128, 128), 'ui_coin': (128, 128), 'ui_coin_pile': (192, 192), 'ui_frame_gold': (256, 320), 'ui_frame_plain': (256, 320),
    # BATCH15 adventure book (opaque textures + transparent seal/emblem/ribbon)
    'book_page': (768, 768), 'book_cover': (768, 768), 'book_emblem': (160, 160), 'book_seal': (128, 128), 'book_ribbon': (64, 256),
    # BATCH16 showcase pedestals, already moved onto the PED anchor by `fit_flow.py ... 1024x512 anchor --key --anchor CX,CY,RX`
    'ped_light': (1024, 512), 'ped_fire': (1024, 512), 'ped_water': (1024, 512), 'ped_wind': (1024, 512), 'ped_earth': (1024, 512), 'ped_dark': (1024, 512),
}
# BATCH11 mystery eggs: placed like monster eggs (import_art.py) — 254 px tall, bottom at y=425 on a 512 canvas
EGGS = ['eggM_common', 'eggM_silver', 'eggM_gold', 'eggM_rainbow']
LIGHT = {
    'hatch_altar_glow': (768, 768), 'fx_rays': (512, 512), 'fx_burst': (512, 512), 'fx_ring': (512, 512),
    'fx_rune_circle': (768, 768), 'fx_column': (256, 512), 'fx_sparkle': (128, 128), 'fx_orb': (128, 128),
    # BATCH12 hatch power-up (epic+ hatch): used automatically by hatchView when present, code drawing otherwise
    'fx_aura_flame': (512, 768), 'fx_aura_flame_b': (512, 768), 'fx_light_shaft': (128, 512), 'fx_energy_beam': (512, 128),
    'fx_vortex_spiral': (256, 512), 'fx_arc_ring': (512, 512), 'fx_aura_burst_ground': (512, 512),
    # BATCH13 fox prototype skill FX + shared hit sparks
    # BATCH09 elemental ultimate FX (battleView ultFx(): one per element + a shared slash)
    'fx_flame_wave': (768, 384), 'fx_flame_bird': (512, 512), 'fx_water_wave': (768, 384), 'fx_water_serpent': (512, 512),
    'fx_tornado': (384, 512), 'fx_wind_blades': (512, 512), 'fx_rock_spikes': (768, 384), 'fx_ground_crack': (512, 512),
    'fx_holy_cross': (512, 512), 'fx_dark_vortex': (512, 512), 'fx_slash': (512, 512),
    'fx_foxfire': (256, 384), 'fx_bite': (512, 512), 'fx_fire_trail': (768, 256), 'fx_hit_spark': (512, 512), 'fx_hit_spark_b': (512, 512), 'fx_slash_arc': (512, 512),
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
        q = (80, 72) if name in LIGHT else (82, 80) if name.startswith('ped_') else (88, 100)  # pedestals are big: a lighter encode
        im.resize(size, Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=q[0], alpha_quality=q[1], method=6)
        done.append(name)
    for name in EGGS:
        if name not in files: continue
        im = Image.open(files[name]).convert('RGBA'); b = im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox(); s = 254 / (b[3] - b[1])
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS); c = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
        c.alpha_composite(im, (round(268 - (b[0] + b[2]) / 2 * s), round(425 - b[3] * s))); c.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=80, alpha_quality=70, method=6); done.append(name)
    kb = sum(os.path.getsize(os.path.join(OUT, n + '.webp')) for n in done) / 1024
    print(f'imported {len(done)} images ({kb:.0f} KB)')
    if missing: print('not found (code drawing stays):', ', '.join(missing))


if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit(__doc__)
    main(sys.argv[1])
