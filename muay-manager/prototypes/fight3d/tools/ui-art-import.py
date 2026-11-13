# Takes the UI art drawn from the brief (tools/ui-art-pack.py) and makes the game's copies in assets/ui/: faint haze
# cleared from transparent images, trimmed to what is drawn, scaled to the size the game shows them at (twice the CSS
# size, for sharp phone screens) and saved as WebP. The originals stay with the owner.
# Usage: python3 -I tools/ui-art-import.py <folder> [<folder> ...]     (needs Pillow and NumPy)
import os, sys
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'ui')
# name pattern -> (box w, box h, trim to the drawing, WebP quality, square canvas)
SPEC = [
    ('logo', (560, 140, True, 86, False)),
    ('title-portrait', (720, 1080, False, 66, False)), ('title-landscape', (1080, 720, False, 66, False)), ('loading', (720, 1080, False, 66, False)),
    ('app-icon', (512, 512, False, 86, False)),
    ('tab-', (96, 96, True, 84, True)), ('act-', (128, 128, True, 80, True)), ('icon-', (64, 64, True, 86, True)),
    ('staff-', (192, 192, False, 78, False)), ('belt-', (360, 120, True, 82, False)), ('venue-', (640, 427, False, 66, False)),
    ('panel', (256, 256, False, 88, False)), ('button-', (360, 90, True, 88, False)), ('corner-', (96, 96, True, 84, True)),
    ('mood-', (64, 64, True, 86, True)), ('ribbon-', (600, 200, True, 82, False)), ('style-', (192, 192, True, 78, True)),
]
HAZE = 40  # alpha below this is a painted glow plane, not part of the drawing

def spec(name):
    for k, s in SPEC:
        if name.startswith(k): return s
    return None

def main():
    os.makedirs(OUT, exist_ok=True); total = 0; seen = set()
    for folder in sys.argv[1:]:
        for fn in sorted(os.listdir(folder)):
            name, ext = os.path.splitext(fn); s = spec(name)
            if not s or ext.lower() not in ('.png', '.jpg', '.jpeg', '.webp'): continue
            w, h, trim, q, square = s
            im = Image.open(os.path.join(folder, fn))
            alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
            im = im.convert('RGBA' if alpha else 'RGB')
            if alpha:
                a = np.asarray(im).copy(); a[a[:, :, 3] < HAZE, 3] = 0; im = Image.fromarray(a)
                if trim:
                    box = im.getchannel('A').getbbox()
                    if box: im = im.crop(box)
            if square: # centre on a square so every icon of a set sits the same way
                side = max(im.size); c = Image.new('RGBA', (side, side), (0, 0, 0, 0)); c.paste(im, ((side - im.width) // 2, (side - im.height) // 2)); im = c
            if not alpha and abs(im.width / im.height - w / h) > .01: # opaque art: fill the box, trimming the long side evenly
                k = max(w / im.width, h / im.height); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
                x, y = (im.width - w) // 2, (im.height - h) // 2; im = im.crop((x, y, x + w, y + h))
            else:
                im.thumbnail((w, h), Image.LANCZOS)
            out = os.path.join(OUT, name + '.webp'); im.save(out, 'WEBP', quality=q, method=6)
            size = os.path.getsize(out); total += size; seen.add(name)
            print('%-20s %4dx%-4d %5.1f KB' % (name, im.width, im.height, size / 1024))
    print(len(seen), 'images,', round(total / 1024), 'KB in', os.path.normpath(OUT))

main()
