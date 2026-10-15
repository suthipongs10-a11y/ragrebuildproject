"""AVIF copies of every image the build embeds (2026-10-14).

Why: on the owner's phone the Artifact refuses the files published next to the page (settings showed `fetch ./ ✗ http
403`), so maps, painted battle plates and the separate-file monsters never appeared. Everything has to live inside the
single page, under its 16MB limit — WebP was too big, AVIF is ~55% of it at the same look.

Sources stay WebP in git (assets/, assets_ext/, assets_bg/); this writes .avif-cache/<dir>/<name>.avif (gitignored) and
only redoes files whose source changed: manifest.json keeps each source's hash + settings (a fresh checkout has new
mtimes, so the CI cache in .github/workflows/eggbound-vps.yml needs hashes; an old cache without a manifest is trusted
by mtime once). build.mjs runs it before embedding.
  sprites + eggs (mon*, egg*)      quality 45, 512 px as drawn
  other art (fx, buildings, UI)    quality 50
  battle plates + realm charts     1100 px wide, quality 45
"""
import hashlib, json, os, sys
from multiprocessing import Pool
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.avif-cache')
DIRS = ('assets', 'assets_ext', 'assets_bg')


def settings(d, name):
    if d == 'assets_bg': return 45, 1100
    if name.startswith(('mon', 'egg')): return 45, 0
    return 50, 0


def job(a):
    src, dst, q, w = a
    im = Image.open(src); im.load()
    if w and im.width > w:
        im = im.convert('RGB').resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    tmp = dst + '.tmp'
    im.save(tmp, 'AVIF', quality=q, speed=4)
    os.replace(tmp, dst)
    return dst


def digest(path, q, w):
    with open(path, 'rb') as f: return hashlib.sha1(f.read()).hexdigest() + f':{q}:{w}'


def main():
    jobs, mf_path = [], os.path.join(CACHE, 'manifest.json')
    try:
        with open(mf_path) as f: mf = json.load(f)
    except (OSError, ValueError): mf = None
    old, new = mf or {}, {}
    for d in DIRS:
        sd, od = os.path.join(ROOT, d), os.path.join(CACHE, d)
        if not os.path.isdir(sd): continue
        os.makedirs(od, exist_ok=True)
        for f in sorted(os.listdir(sd)):
            if not f.endswith('.webp') or f.startswith('thumb_'): continue
            src, dst = os.path.join(sd, f), os.path.join(od, f[:-5] + '.avif')
            q, w = settings(d, f)
            key, h = d + '/' + f, digest(src, q, w)
            new[key] = h
            if os.path.exists(dst) and (old.get(key) == h if mf is not None else os.path.getmtime(dst) >= os.path.getmtime(src)): continue
            jobs.append((src, dst, q, w))
    if jobs:
        with Pool(min(8, os.cpu_count() or 2)) as p: p.map(job, jobs)
    os.makedirs(CACHE, exist_ok=True)
    with open(mf_path, 'w') as f: json.dump(new, f)
    print(f'avif cache: {len(jobs)} converted', file=sys.stderr)


if __name__ == '__main__':
    main()
