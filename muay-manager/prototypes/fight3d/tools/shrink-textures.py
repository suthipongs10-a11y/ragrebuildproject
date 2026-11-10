# Writes a 1536px copy of each model's texture (assets/<name>-1k.jpg) for embedding in the page.
# Usage: python3 tools/shrink-textures.py     (needs Pillow)
import glob, io, json, struct
from PIL import Image
for path in sorted(glob.glob('assets/fighter-?.glb')):
    b = open(path, 'rb').read(); jl = struct.unpack('<I', b[12:16])[0]
    g = json.loads(b[20:20 + jl]); bin_ = b[20 + jl + 8:]
    v = g['bufferViews'][g['images'][0]['bufferView']]; off = v.get('byteOffset', 0)
    im = Image.open(io.BytesIO(bin_[off:off + v['byteLength']])).convert('RGB').resize((1536, 1536), Image.LANCZOS)
    out = path.replace('.glb', '-1k.jpg'); im.save(out, quality=85, optimize=True); print(out, im.size)
