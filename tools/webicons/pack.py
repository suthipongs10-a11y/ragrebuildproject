#!/usr/bin/env python3
"""Item icons out of the extracted client data and into one sheet the guide can draw.

    python3 tools/webicons/pack.py "D:/RO/data"

where that path is the folder you extracted data.grf into - the same one Unity is
pointed at under Ragnarok > Set Ragnarok Data Directory. Writes web/data/icons.png
and web/data/icons.json, and the guide picks both up on its own.

Neither file is committed. They are Gravity's artwork, this repository is public, and
the rule against committing anything out of the grf is the whole of section 1.4. So
the sheet is built on the machine that has the grf, stays there, and gets folded into
web/dist/guide.html by bundle.py - which is also the file you keep to yourself.

The icons are bmp, not spr. Every item row in the six item tables names a sprite in
its Sprite column - in Korean - and that name is a file under

    <data>/texture/유저인터페이스/item/<sprite>.bmp

with two custom folders in the client project standing behind it for the handful of
icons this project drew itself. Which means no sprite decoder: bmp is a header and a
block of pixels, and this reads it in a page of code with nothing installed.

Transparency is the client's rule, not a guess: TextureImportHelper.LoadTexture keys
out magic pink after masking each channel with 0xF0, so a pixel counts as background
when it is within a shade of ff00ff rather than exactly it. Copied here so that an
icon looks the same in the guide as it does in the inventory.

Sprites are shared - four hundred odd cards are all 이름없는카드 - so the sheet holds
one copy of each distinct icon and the index points many codes at the same cell.
"""

import csv
import io
import json
import math
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB = os.path.join(ROOT, "RoRebuildServer", "GameConfig", "ServerData", "Db")
CUSTOM = os.path.join(ROOT, "RebuildClient", "Assets", "Textures", "CustomIcons")
OUT = os.path.join(ROOT, "web", "data")

ITEM_TABLES = ["ItemsCards.csv", "ItemsEquipment.csv", "ItemsWeapons.csv",
               "ItemsUsable.csv", "ItemsRegular.csv", "ItemsAmmo.csv"]

#texture/유저인터페이스/item - the folder the client reads item icons out of
ICON_DIR = os.path.join("texture", "\uc720\uc800\uc778\ud130\ud398\uc774\uc2a4", "item")


# ------------------------------------------------------------------------ bmp

class Unsupported(Exception):
    """A bmp shape this reader does not know. Named, never guessed at."""


def _u32(b, i):
    return struct.unpack_from("<I", b, i)[0]


def _i32(b, i):
    return struct.unpack_from("<i", b, i)[0]


def _u16(b, i):
    return struct.unpack_from("<H", b, i)[0]


def _rle8(body, width, height):
    """BI_RLE8, which a few of the icons are saved as. Absolute mode included."""
    rows = [[0] * width for _ in range(height)]
    x = y = i = 0
    while i + 1 < len(body):
        count, value = body[i], body[i + 1]
        i += 2
        if count:
            for _ in range(count):
                if x < width and y < height:
                    rows[y][x] = value
                x += 1
        elif value == 0:      # end of line
            x, y = 0, y + 1
        elif value == 1:      # end of bitmap
            break
        elif value == 2:      # delta
            x += body[i]
            y += body[i + 1]
            i += 2
        else:                 # absolute run, padded to an even length
            for k in range(value):
                if x < width and y < height:
                    rows[y][x] = body[i + k]
                x += 1
            i += value + (value & 1)
    return rows


def read_bmp(path):
    """A bmp as (width, height, rows of (r, g, b, a)), top row first.

    Reads the shapes the client data actually uses - 1, 4, 8, 24 and 32 bits, plain or
    run length encoded - and raises on anything else rather than returning something
    that looks like an icon and is not.
    """
    with open(path, "rb") as handle:
        blob = handle.read()

    if blob[:2] != b"BM":
        raise Unsupported("not a bmp")

    start = _u32(blob, 10)
    header = _u32(blob, 14)
    if header < 40:
        raise Unsupported(f"{header} byte header (only the 40 byte one and later)")

    width, height = _i32(blob, 18), _i32(blob, 22)
    depth, compression = _u16(blob, 28), _u32(blob, 30)
    top_down = height < 0
    height = abs(height)

    if compression not in (0, 1, 3):
        raise Unsupported(f"compression {compression}")
    if compression == 3 and depth != 32:
        raise Unsupported(f"bitfields at {depth} bits")
    if depth not in (1, 4, 8, 24, 32):
        raise Unsupported(f"{depth} bits per pixel")

    palette = []
    if depth <= 8:
        used = _u32(blob, 46) or (1 << depth)
        at = 14 + header
        for n in range(used):
            b, g, r = blob[at + n * 4], blob[at + n * 4 + 1], blob[at + n * 4 + 2]
            palette.append((r, g, b))

    body = blob[start:]

    if compression == 1:
        indexed = _rle8(body, width, height)
        rows = [[palette[i] if i < len(palette) else (0, 0, 0) for i in row]
                for row in indexed]
    else:
        stride = ((width * depth + 31) // 32) * 4
        rows = []
        for y in range(height):
            line = body[y * stride:(y + 1) * stride]
            row = []
            for x in range(width):
                if depth == 32:
                    at = x * 4
                    row.append((line[at + 2], line[at + 1], line[at]))
                elif depth == 24:
                    at = x * 3
                    row.append((line[at + 2], line[at + 1], line[at]))
                elif depth == 8:
                    row.append(palette[line[x]])
                elif depth == 4:
                    byte = line[x // 2]
                    row.append(palette[(byte >> 4) if x % 2 == 0 else (byte & 0x0F)])
                else:
                    byte = line[x // 8]
                    row.append(palette[(byte >> (7 - x % 8)) & 1])
            rows.append(row)

    if not top_down:
        rows.reverse()

    #the client's key, masked to 0xF0 a channel at a time, so a pixel a shade off magic
    #pink still counts as background - see TextureImportHelper.LoadTexture
    out = []
    for row in rows:
        line = []
        for r, g, b in row:
            keyed = (r & 0xF0) == 0xF0 and (g & 0xF0) == 0x00 and (b & 0xF0) == 0xF0
            line.append((0, 0, 0, 0) if keyed else (r, g, b, 255))
        out.append(line)
    return width, height, out


# ------------------------------------------------------------------------ png

def write_png(path, width, height, rows):
    """RGBA, no filtering, which is small enough for a sheet of flat pixel art."""
    raw = bytearray()
    for row in rows:
        raw.append(0)
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, payload):
        return (struct.pack(">I", len(payload)) + tag + payload
                + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))

    with open(path, "wb") as handle:
        handle.write(png)
    return len(png)


# ----------------------------------------------------------------- the tables

def item_sprites():
    """Every item code and the sprite it draws itself with."""
    found = {}
    for name in ITEM_TABLES:
        path = os.path.join(DB, name)
        with io.open(path, encoding="utf-8-sig") as handle:
            for row in csv.DictReader(handle):
                code = (row.get("Code") or "").strip()
                sprite = (row.get("Sprite") or "").strip()
                if code and sprite:
                    found[code] = sprite
    return found


def icon_folder(data_dir):
    """Where the item icons are, allowing for an extract that named things its own way."""
    direct = os.path.join(data_dir, ICON_DIR)
    if os.path.isdir(direct):
        return direct

    #the interface folder is Korean and an extractor run under the wrong locale can
    #mangle it, so fall back to whatever folder under texture/ holds an item/ of bmps
    texture = os.path.join(data_dir, "texture")
    if os.path.isdir(texture):
        for entry in sorted(os.listdir(texture)):
            candidate = os.path.join(texture, entry, "item")
            if os.path.isdir(candidate) and any(f.lower().endswith(".bmp")
                                                for f in os.listdir(candidate)):
                return candidate
    return None


def locate(sprite, folder):
    """The bmp for one sprite: the client data first, then this project's own icons."""
    for base in (folder, os.path.join(CUSTOM, "Item"), os.path.join(CUSTOM, "Skills")):
        if not base:
            continue
        path = os.path.join(base, sprite + ".bmp")
        if os.path.isfile(path):
            return path
    return None


# ----------------------------------------------------------------------- pack

def main():
    if len(sys.argv) < 2:
        print(__doc__.strip().split("\n\n")[1].strip())
        return 2

    data_dir = os.path.abspath(sys.argv[1])
    if not os.path.isdir(data_dir):
        print(f"no such folder: {data_dir}")
        return 1

    folder = icon_folder(data_dir)
    if folder is None:
        print(f"no item icons under {os.path.join(data_dir, ICON_DIR)}\n"
              f"point this at the folder you extracted data.grf into - the one that "
              f"has texture/ and sprite/ directly inside it")
        return 1

    sprites = item_sprites()
    print(f"{len(sprites)} item(s) name a sprite, reading icons from {folder}")

    cells = {}       # sprite name -> index in the sheet
    images = []      # index -> (width, height, rows)
    missing, broken = [], []

    for sprite in sorted(set(sprites.values())):
        path = locate(sprite, folder)
        if path is None:
            missing.append(sprite)
            continue
        try:
            width, height, rows = read_bmp(path)
        except Unsupported as why:
            broken.append(f"{sprite}: {why}")
            continue
        cells[sprite] = len(images)
        images.append((width, height, rows))

    if not images:
        print("nothing could be read - is that the right folder?")
        return 1

    cell = max(max(w, h) for w, h, _ in images)
    cols = max(1, math.ceil(math.sqrt(len(images))))
    rows_count = math.ceil(len(images) / cols)

    sheet = [[(0, 0, 0, 0)] * (cols * cell) for _ in range(rows_count * cell)]
    for n, (width, height, pixels) in enumerate(images):
        left = (n % cols) * cell + (cell - width) // 2
        top = (n // cols) * cell + (cell - height) // 2
        for y, line in enumerate(pixels):
            for x, pixel in enumerate(line):
                if pixel[3]:
                    sheet[top + y][left + x] = pixel

    os.makedirs(OUT, exist_ok=True)
    png = os.path.join(OUT, "icons.png")
    size = write_png(png, cols * cell, rows_count * cell, sheet)

    index = {code: cells[sprite] for code, sprite in sprites.items() if sprite in cells}
    with io.open(os.path.join(OUT, "icons.json"), "w", encoding="utf-8") as handle:
        json.dump({"cell": cell, "cols": cols, "sheet": "icons.png", "items": index},
                  handle, ensure_ascii=False, separators=(",", ":"))

    print(f"\n{png}  {size / 1024:.0f} KB  "
          f"{cols * cell}x{rows_count * cell}, {len(images)} distinct icon(s)")
    print(f"{os.path.join(OUT, 'icons.json')}  {len(index)} of {len(sprites)} item(s) "
          f"have one")

    if broken:
        print(f"\n{len(broken)} icon(s) in a bmp shape this reader does not know:")
        for line in broken[:10]:
            print(f"  {line}")
    if missing:
        print(f"\n{len(missing)} sprite(s) named by an item but not in the data folder "
              f"(normal for anything this server added itself):")
        for sprite in missing[:10]:
            print(f"  {sprite}")
        if len(missing) > 10:
            print(f"  ...and {len(missing) - 10} more")

    print("\nnow run:  python3 web/bundle.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
