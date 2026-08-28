#!/usr/bin/env python3
"""Export the server's game data to JSON files the guide website reads.

The website is a static site - it never talks to the running server. This script
is the only bridge: it reads the exact same files the server loads at startup
(GameConfig/ServerData) and writes plain JSON into web/data/.

Run from anywhere:  python3 tools/webdata/export.py
"""

import csv
import io
import json
import os
import re
import sys
import tomllib
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "RoRebuildServer", "GameConfig", "ServerData")
DB = os.path.join(DATA, "Db")
SCRIPT = os.path.join(DATA, "Script")
SKILLS = os.path.join(DATA, "Skills")
DESCS = os.path.join(DATA, "ItemDescriptions")
OUT = os.path.join(ROOT, "web", "data")

warnings = []


def warn(msg):
    warnings.append(msg)


# ---------------------------------------------------------------------------
# readers
# ---------------------------------------------------------------------------

def read_csv(name, folder=DB):
    """Read a csv as a list of dicts. Handles the BOM every file here carries."""
    path = os.path.join(folder, name)
    with open(path, "r", encoding="utf-8-sig", newline="") as fh:
        return [row for row in csv.DictReader(fh)]


def read_csv_rows(name, folder=DB):
    """Read a csv as raw rows (header first). For ragged files like DropData."""
    path = os.path.join(folder, name)
    with open(path, "r", encoding="utf-8-sig", newline="") as fh:
        return [row for row in csv.reader(fh)]


def read_text(path):
    with open(path, "r", encoding="utf-8-sig") as fh:
        return fh.read()


def read_toml(name, folder=SKILLS):
    # these files carry a BOM, so decode first - tomllib.load() would choke on it
    return tomllib.loads(read_text(os.path.join(folder, name)))


def monster_key(name):
    """Server-side normalisation - ServerMapConfig.CreateSpawn and the drop loader
    both do .Replace(" ", "_").ToUpper() before looking a monster up."""
    return name.strip().replace(" ", "_").upper()


def num(value, default=0):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def script_files(folder):
    base = os.path.join(SCRIPT, folder)
    out = []
    for dirpath, _dirs, files in os.walk(base):
        for f in sorted(files):
            if f.endswith(".txt"):
                out.append(os.path.join(dirpath, f))
    return out


# ---------------------------------------------------------------------------
# items
# ---------------------------------------------------------------------------

ITEM_SOURCES = [
    # csv file,             ItemClass,     SubCategory ("*" = take from Usage column)
    ("ItemsRegular.csv",    "Etc",         "*"),
    ("ItemsUsable.csv",     "Useable",     "Useable"),
    ("ItemsWeapons.csv",    "Weapon",      "Weapon"),
    ("ItemsEquipment.csv",  "Equipment",   "Equipment"),
    ("ItemsCards.csv",      "Card",        "Card"),
    ("ItemsAmmo.csv",       "Ammo",        "Ammo"),
]

# Mirrors Script/Config/ItemDropAndValueAdjustments.txt -> OnSetItemPurchasePrice.
# Kept as a table so a change over there is a one line change here.
ETC_VALUE_MULTIPLIER = 2


def remap(value, from1, to1, from2, to2):
    """RebuildSharedData/Extensions/RemapExtension.cs, truncated to int like the script does."""
    return int((value - from1) / (to1 - from1) * (to2 - from2) + from2)


#appsettings.json is json with // comments in it, which json.load will not read, and the
#one value wanted here is a bool on a line of its own. Read with a pattern rather than a
#parser, and fail loudly rather than guess: guessing this wrong means every drop rate on
#the site is off by up to twelve times and nothing anywhere says so.
REMAP_FLAG_RE = re.compile(r'"RemapDropRates"\s*:\s*(true|false)')


def read_remap_flag():
    path = os.path.join(ROOT, "RoRebuildServer", "RoRebuildServer", "appsettings.json")
    with io.open(path, encoding="utf-8-sig") as handle:
        found = REMAP_FLAG_RE.search(handle.read())
    if not found:
        raise SystemExit(f"no RemapDropRates setting in {path} - the site cannot know "
                         f"which drop rates the server is running")
    return found.group(1) == "true"


REMAP_DROPS = read_remap_flag()


def remap_drop_rate(item, rate):
    """Replicate Script/Config/ItemDropAndValueAdjustments.txt -> OnLoadDropData.

    When appsettings.json has RemapDropRates on, the numbers in DropData.csv are NOT what
    a player sees, and this produces the rate the server actually rolls. When it is off,
    DataLoader never calls the script at all - so neither does this, and that includes the
    Refine doubling, which lives inside the same block.
    """
    if not REMAP_DROPS:
        return rate

    itype = item["type"] if item else "Etc"
    sub = item["subCategory"] if item else "None"
    code = item["code"] if item else ""

    if itype == "Etc" and sub == "Quest":
        return rate
    if code in ("Water_Lily_Hat", "Red_Stocking", "Gift_Box"):
        return rate
    if itype == "Etc" and sub == "Refine":
        rate *= 2

    if rate <= 20:
        rate = remap(rate, 1, 20, 50, 200)
    elif rate <= 80:
        rate = remap(rate, 20, 80, 200, 400)
    elif rate <= 300:
        rate = remap(rate, 80, 300, 400, 900)
    elif rate <= 1200:
        rate = remap(rate, 300, 1200, 900, 2400)
    elif rate <= 10000:
        rate = remap(rate, 1200, 10000, 2400, 10000)
    else:
        rate = 10000

    return min(rate, 10000)


SALE_ZERO_RE = re.compile(r'if\s*\((.*?)\)\s*return\s+0\s*;')
CODE_EQ_RE = re.compile(r'code\s*==\s*"([^"]+)"')


def parse_zero_sale_codes():
    """Items a config script forces to sell back for nothing.

    Script/Config/TesterShopValues.txt does this so the Equipment Tester can hand
    out starting gear for a single zeny without opening a buy-low-sell-high loop.
    Npc.SellItem throws at startup if that loop exists, so getting this wrong here
    would make the site claim a shop the server would refuse to start with.
    """
    zero = set()
    folder = os.path.join(SCRIPT, "Config")
    if not os.path.isdir(folder):
        return zero
    for fname in sorted(os.listdir(folder)):
        if not fname.endswith(".txt"):
            continue
        text = read_text(os.path.join(folder, fname))
        idx = text.find("OnSetItemSaleValue:")
        if idx < 0:
            continue
        section = text[idx:]
        end = section.find("\nOn", 1)
        if end > 0:
            section = section[:end]
        for line in section.splitlines():
            line = line.split("//")[0]
            m = SALE_ZERO_RE.search(line)
            if not m:
                continue
            codes = CODE_EQ_RE.findall(m.group(1))
            if codes:
                zero.update(codes)
            elif "type ==" not in m.group(1):
                warn(f"Config: {fname} has a `return 0` in OnSetItemSaleValue "
                     f"that this exporter does not understand: {line.strip()}")
    return zero


ZERO_SALE_CODES = set()


def adjust_prices(item):
    """Replicate OnSetItemPurchasePrice / OnSetItemSaleValue from the same config script."""
    price = item["price"]
    itype = item["type"]
    sub = item["subCategory"]

    if itype == "Etc" and sub == "None":
        price *= ETC_VALUE_MULTIPLIER
    if itype == "Weapon":
        price = price * 3 // 2

    sell = price
    if itype != "Weapon":
        sell //= 2
    else:
        sell //= 3
    if itype == "Ammo":
        sell = 0
    if item["code"] in ZERO_SALE_CODES:
        sell = 0

    if sell * 125 // 100 > price * 75 // 100:
        sell = 0

    item["price"] = price
    item["sellPrice"] = sell


def parse_descriptions():
    """ItemDescriptions/*.txt -> {item_code: description text}.

    Format is `::Item_Code //comment` then free text until the next `::`.
    Most of these are already translated to Thai.
    """
    out = {}
    if not os.path.isdir(DESCS):
        return out
    for fname in sorted(os.listdir(DESCS)):
        if not fname.endswith(".txt"):
            continue
        code = None
        buf = []
        for line in read_text(os.path.join(DESCS, fname)).splitlines():
            if line.startswith("::"):
                if code:
                    out[code] = "\n".join(buf).strip()
                code = line[2:].split("//")[0].strip()
                buf = []
            elif code is not None:
                buf.append(line.rstrip())
        if code:
            out[code] = "\n".join(buf).strip()
    return out


EFFECT_RE = re.compile(r'Item\("([^"]+)"\)\s*\{(.*?)\n\}', re.S)
EFFECT_ONELINE_RE = re.compile(r'Item\("([^"]+)"\)\s*\{([^\n}]*)\}')


def parse_item_effects():
    """Script/Items/*.txt -> {item_code: raw script body}.

    This is the technical truth behind a card or gear bonus. The website shows it
    beside the human description so anyone can check what a card really does.
    """
    out = {}
    folder = os.path.join(SCRIPT, "Items")
    if not os.path.isdir(folder):
        return out
    for fname in sorted(os.listdir(folder)):
        if not fname.endswith(".txt"):
            continue
        text = read_text(os.path.join(folder, fname))
        for m in EFFECT_ONELINE_RE.finditer(text):
            out.setdefault(m.group(1), m.group(2).strip())
        for m in EFFECT_RE.finditer(text):
            body = m.group(2).strip()
            if m.group(1) not in out or len(body) > len(out[m.group(1)]):
                out[m.group(1)] = body
    return out


def build_items():
    global ZERO_SALE_CODES
    ZERO_SALE_CODES = parse_zero_sale_codes()
    items = {}
    by_code = {}

    for fname, itype, subcat in ITEM_SOURCES:
        for row in read_csv(fname):
            if not row.get("Id"):
                continue
            iid = num(row["Id"])
            item = {
                "id": iid,
                "code": row["Code"],
                "name": row["Name"],
                "type": itype,
                "subCategory": row.get("Usage", subcat) if subcat == "*" else subcat,
                "price": num(row.get("Price")),
                "weight": num(row.get("Weight")),
            }

            if itype == "Weapon":
                item.update({
                    "attack": num(row.get("Attack")),
                    "range": num(row.get("Range")),
                    "slots": num(row.get("Slot")),
                    "weaponType": row.get("Type", ""),
                    "position": row.get("Position", ""),
                    "element": row.get("Property", ""),
                    "minLevel": num(row.get("MinLvl")),
                    "rank": num(row.get("Rank")),
                    "equipGroup": row.get("EquipGroup", ""),
                    "refinable": row.get("Refinable", "") == "Yes",
                    "breakable": row.get("Breakable", "") == "Yes",
                })
            elif itype == "Equipment":
                item.update({
                    "defense": num(row.get("Defense")),
                    "magicDef": num(row.get("MagicDef")),
                    "slots": num(row.get("Slot")),
                    "equipType": row.get("Type", ""),
                    "position": row.get("Position", ""),
                    "element": row.get("Property", ""),
                    "minLevel": num(row.get("MinLvl")),
                    "equipGroup": row.get("EquipGroup", ""),
                    "refinable": row.get("Refinable", "") == "Yes",
                    "breakable": row.get("Breakable", "") == "Yes",
                })
            elif itype == "Card":
                item.update({
                    "cardSlot": row.get("EquipableSlot", ""),
                    "prefix": row.get("Prefix", ""),
                    "postfix": row.get("Postfix", ""),
                })
            elif itype == "Useable":
                item.update({
                    "useMode": row.get("UseMode", ""),
                    "useEffect": row.get("UseEffect", ""),
                })
            elif itype == "Ammo":
                item.update({
                    "attack": num(row.get("Attack")),
                    "ammoType": row.get("Type", ""),
                    "element": row.get("Property", ""),
                })

            adjust_prices(item)
            items[iid] = item
            by_code[item["code"]] = item

    descriptions = parse_descriptions()
    effects = parse_item_effects()
    for item in items.values():
        desc = descriptions.get(item["code"])
        if desc:
            item["desc"] = desc
        effect = effects.get(item["code"])
        if effect:
            item["effect"] = effect

    return items, by_code


# ---------------------------------------------------------------------------
# monsters, drops, spawns
# ---------------------------------------------------------------------------

def build_monsters():
    monsters = {}
    by_code = {}
    for row in read_csv("Monsters.csv"):
        if not row.get("Id"):
            continue
        mon = {
            "id": num(row["Id"]),
            "code": row["Code"],
            "name": row["Name"],
            "level": num(row["Level"]),
            "hp": num(row["HP"]),
            "str": num(row["Str"]), "int": num(row["Int"]), "vit": num(row["Vit"]),
            "dex": num(row["Dex"]), "agi": num(row["Agi"]), "luk": num(row["Luk"]),
            "atkMin": num(row["AtkMin"]), "atkMax": num(row["AtkMax"]),
            "range": num(row["Range"]),
            "def": num(row["Def"]), "mdef": num(row["MDef"]),
            "exp": num(row["Exp"]), "jobExp": num(row["JExp"]),
            "scanDist": num(row["ScanDist"]), "chaseDist": num(row["ChaseDist"]),
            "size": row["Size"], "race": row["Race"], "element": row["Element"],
            "rechargeTime": num(row["RechargeTime"]),
            "hitTime": num(row["HitTime"]),
            "attackTime": num(row["AttackTime"]),
            "moveSpeed": num(row["MoveSpeed"]),
            "special": row.get("Special", ""),
            "ai": row.get("MonsterAi", ""),
            "sprite": row.get("ClientSprite", ""),
            "tags": [t for t in (row.get("Tags") or "").split("|") if t],
            "feature": row.get("Feature", "") or "",
        }
        monsters[mon["code"]] = mon
        by_code[mon["code"]] = mon
    return monsters, by_code


def attach_drops(monsters, items, by_code):
    """DropData.csv -> per monster drop list, with the remapped (real) chance."""
    rows = read_csv_rows("DropData.csv")
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        code = monster_key(row[0])
        mon = monsters.get(code)
        if mon is None:
            warn(f"DropData: monster {code} not in Monsters.csv")
            continue
        drops = []
        for pos in range(1, len(row) - 1, 2):
            raw = row[pos].strip()
            if not raw:
                continue
            count_min = count_max = 1
            if "#" in raw:
                raw, section = raw.split("#", 1)
                if "-" in section:
                    count_min, count_max = (num(x, 1) for x in section.split("-", 1))
                else:
                    count_min = count_max = num(section, 1)
            chance = num(row[pos + 1])
            if chance <= 0:
                continue
            item = by_code.get(raw)
            if item is None:
                warn(f"DropData: monster {code} drops unknown item {raw}")
                continue
            drops.append({
                "id": item["id"],
                "base": chance,
                "chance": remap_drop_rate(item, chance),
                "min": count_min,
                "max": count_max,
            })
        mon["drops"] = drops

    # MvpList.csv only marks which monsters count as MVPs. DataLoader.LoadMvpList
    # reads column 0 and throws the item columns away, and DoMonsterDrops rolls
    # purely off DropData.csv - so the extra items listed there never drop. We
    # deliberately do not publish them; showing them would be a lie.
    for row in read_csv_rows("MvpList.csv")[1:]:
        if not row or not row[0].strip():
            continue
        mon = monsters.get(monster_key(row[0]))
        if mon is not None:
            mon["isMvp"] = True


missing_monsters = defaultdict(set)
unreachable_maps = {}
missing_jobs = defaultdict(set)

SPAWN_MAP_RE = re.compile(r'MapConfig\("([^"]+)"\)')
SPAWN_RE = re.compile(r'CreateSpawn\("([^"]+)"\s*,\s*(\d+)([^;]*)\)\s*;')
AREA_RE = re.compile(r'%\([^)]*\)')
TIME_RE = re.compile(r'^-?[0-9][0-9hms.]*$')

# ServerDebugConfig in appsettings.json. Read once at startup by the server and
# applied to every spawn rule, so the numbers in the spawn scripts are not the
# numbers the server ends up using.
MIN_SPAWN_TIME = 2000
MAX_SPAWN_TIME = 360000

# ServerMilestoneEvent.OnSetMonsterSpawnTime overrides the clamp for MVPs, and it
# runs after it - so an MVP ignores MaxSpawnTime entirely.
MVP_MIN_SPAWN = 14 * 60 * 1000
MVP_MAX_SPAWN = 15 * 60 * 1000


def parse_time(text):
    """ScriptTreeWalker.ParseDecimal: 5m30s -> 330000. Bare digits are already ms."""
    text = text.strip()
    if not TIME_RE.match(text):
        return None
    total = 0
    buf = ""
    for c in text:
        if c.isdigit() or c in "-.":
            buf += c
            continue
        if not buf:
            return None
        try:
            value = float(buf)
        except ValueError:
            return None
        if c == "s":
            total += int(value * 1000)
        elif c == "m":
            total += int(value * 60 * 1000)
        elif c == "h":
            total += int(value * 60 * 60 * 1000)
        else:
            return None
        buf = ""
    if buf:
        try:
            total += int(float(buf))
        except ValueError:
            return None
    return total


def resolve_respawn(respawn, variance, is_mvp):
    """ServerMapConfig.CreateSpawn, in the order the server runs it."""
    if MIN_SPAWN_TIME > 0 and respawn < MIN_SPAWN_TIME:
        respawn = MIN_SPAWN_TIME
    respawn_max = respawn + variance
    if MAX_SPAWN_TIME > 0 and respawn > MAX_SPAWN_TIME:
        respawn = MAX_SPAWN_TIME
    if MAX_SPAWN_TIME > 0 and respawn_max > MAX_SPAWN_TIME:
        respawn_max = MAX_SPAWN_TIME
    if is_mvp:
        respawn, respawn_max = MVP_MIN_SPAWN, MVP_MAX_SPAWN
    return respawn, respawn_max


def parse_spawns(monsters, mvp_codes):
    """Script/Spawns/*.txt -> {map: [{code, count, respawn, ...}]}

    CreateSpawn has five overloads and the arguments after the count shift meaning
    depending on whether a %(x, y, w, h) area is present, so strip the area first
    and read what is left positionally: respawn, then variance, then flags.
    """
    spawns = defaultdict(list)
    for path in script_files("Spawns"):
        text = read_text(path)
        # split the file into MapConfig blocks
        marks = [(m.start(), m.group(1)) for m in SPAWN_MAP_RE.finditer(text)]
        for idx, (start, mapname) in enumerate(marks):
            end = marks[idx + 1][0] if idx + 1 < len(marks) else len(text)
            block = text[start:end]
            for line in block.splitlines():
                line = line.split("//")[0]
                m = SPAWN_RE.search(line)
                if not m:
                    continue
                code, count, tail = monster_key(m.group(1)), num(m.group(2)), m.group(3)
                if code not in monsters:
                    missing_monsters[code].add(mapname)
                    continue
                entry = {"code": code, "count": count}
                if "MVP" in tail:
                    entry["flag"] = "MVP"
                elif "Boss" in tail:
                    entry["flag"] = "Boss"
                if "%(" in tail:
                    entry["fixed"] = True

                rest = AREA_RE.sub("", tail).lstrip(",")
                times = []
                for part in rest.split(","):
                    part = part.strip()
                    if not part:
                        continue
                    value = parse_time(part)
                    if value is None:
                        break          # a flag like Boss / StrictArea - times are done
                    times.append(value)

                written = times[0] if times else 0
                variance = times[1] if len(times) > 1 else 0
                low, high = resolve_respawn(written, variance, code in mvp_codes)
                entry["respawnMin"] = low
                entry["respawnMax"] = high
                if written and (written != low or written + variance != high):
                    entry["respawnWritten"] = written
                    if variance:
                        entry["varianceWritten"] = variance

                spawns[mapname].append(entry)
    return spawns


MONSTER_SKILL_RE = re.compile(r'(?<!Alt)SkillHandler\("([^"]+)"\)\s*\{(.*?)\n\}', re.S)
TRYCAST_RE = re.compile(r'TryCast\(\s*(\w+)\s*,\s*(\d+)\s*,\s*([\d.]+)%')


def parse_monster_skills():
    """Script/MonsterSkills/*.txt -> {monster_code: [skill names]}"""
    out = defaultdict(list)
    for path in script_files("MonsterSkills"):
        text = read_text(path)
        for m in MONSTER_SKILL_RE.finditer(text):
            code = m.group(1)
            for line in m.group(2).splitlines():
                line = line.split("//")[0]
                for cast in TRYCAST_RE.finditer(line):
                    name, lvl, chance = cast.group(1), num(cast.group(2)), cast.group(3)
                    if name == "NoCast":
                        continue
                    entry = {"skill": name, "level": lvl, "chance": float(chance)}
                    if entry not in out[code]:
                        out[code].append(entry)
    return out


# ---------------------------------------------------------------------------
# maps, warps, npcs
# ---------------------------------------------------------------------------

WARP_RE = re.compile(
    r'Warp\(\s*"([^"]+)"\s*,\s*"([^"]*)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(\d+)')
NPC_RE = re.compile(
    r'\b(?:Npc|Trader)\(\s*"([^"]+)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*(\d+)\s*,\s*(\d+)')

TRADER_RE = re.compile(
    r'Trader\(\s*"([^"]+)"\s*,\s*"([^"]*)"\s*,\s*"[^"]*"\s*,\s*(\d+)\s*,\s*(\d+)[^)]*\)\s*\{(.*?)\n\}', re.S)
# Npc.SellItem has two overloads: the one-argument form charges the item's own
# price, the two-argument form names a price and overrides it entirely.
SELL_RE = re.compile(r'SellItem\(\s*"([^"]+)"\s*(?:,\s*(\d+)\s*)?\)')


def parse_shops(by_code):
    """Script/Npcs/Shops/*.txt -> list of shops, and a soldBy back-reference per item."""
    shops = []
    for path in script_files("Npcs"):
        text = read_text(path)
        for m in TRADER_RE.finditer(text):
            stock = []
            seen = set()
            for line in m.group(5).splitlines():
                line = line.split("//")[0]
                for sell in SELL_RE.finditer(line):
                    code = sell.group(1)
                    item = by_code.get(code)
                    if item is None:
                        warn(f"Shops: {m.group(2)} sells unknown item {code}")
                        continue
                    if item["id"] in seen:
                        continue
                    seen.add(item["id"])
                    entry = {"id": item["id"]}
                    if sell.group(2) is not None:
                        entry["price"] = num(sell.group(2))
                    stock.append(entry)
            if stock:
                shops.append({
                    "map": m.group(1), "name": m.group(2),
                    "x": num(m.group(3)), "y": num(m.group(4)),
                    "items": stock,
                })
    return shops


def find_summon_sources(monsters):
    """Which files call up a monster that no map spawns.

    A monster with no spawn block is not necessarily missing - Antonio is placed by
    GiftMonsterSpawner in code, the Okolnir bosses come out of an event script, and
    several are summoned by another monster's skill. Saying "no spawn" about those
    would be wrong, so record where they actually come from.
    """
    sources = defaultdict(set)
    scan = []
    for folder in ("Event", "MonsterSkills", "Npcs", "Config"):
        scan.extend(script_files(folder))
    custom = os.path.join(ROOT, "RoRebuildServer", "RoRebuildServer", "Custom")
    for dirpath, _dirs, files in os.walk(custom):
        for f in sorted(files):
            if f.endswith(".cs"):
                scan.append(os.path.join(dirpath, f))

    for path in scan:
        try:
            text = read_text(path)
        except (OSError, UnicodeDecodeError):
            continue
        for code in monsters:
            if f'"{code}"' in text:
                sources[code].add(os.path.basename(path))
    return sources


def parse_warps():
    warps = defaultdict(list)
    for path in script_files("Warps"):
        for line in read_text(path).splitlines():
            line = line.split("//")[0]
            m = WARP_RE.search(line)
            if m:
                warps[m.group(1)].append({
                    "name": m.group(2),
                    "x": num(m.group(3)), "y": num(m.group(4)),
                    "to": m.group(7), "toX": num(m.group(8)), "toY": num(m.group(9)),
                })
    return warps


def parse_npcs():
    npcs = defaultdict(list)
    for path in script_files("Npcs"):
        text = read_text(path)
        for line in text.splitlines():
            line = line.split("//")[0]
            m = NPC_RE.search(line)
            if m:
                npcs[m.group(1)].append({
                    "name": m.group(2),
                    "sprite": m.group(3),
                    "x": num(m.group(4)), "y": num(m.group(5)),
                    "file": os.path.basename(path),
                })
    return npcs


def build_maps(spawns, warps, npcs, monsters):
    instances = {}
    for row in read_csv_rows("Instances.csv")[1:]:
        if not row or not row[0].strip():
            continue
        for code in row[2:]:
            code = code.strip()
            if code:
                instances[code] = row[0].strip()

    save_points = defaultdict(list)
    for row in read_csv("SavePoints.csv"):
        save_points[row["Map"]].append({
            "name": row["Name"], "x": num(row["X"]), "y": num(row["Y"]),
        })

    maps = []
    for row in read_csv("Maps.csv"):
        code = row["Code"]
        mspawns = spawns.get(code, [])
        total = sum(s["count"] for s in mspawns)
        entry = {
            "code": code,
            "name": row["Name"],
            "mode": row.get("MapMode", ""),
            "flags": [f for f in (row.get("Flags") or "").split("|") if f and f != "None"],
            "music": row.get("Music", ""),
            "instance": instances.get(code, ""),
            "spawns": mspawns,
            "monsterCount": total,
            "warps": warps.get(code, []),
            "npcs": npcs.get(code, []),
        }
        if save_points.get(code):
            entry["savePoints"] = save_points[code]
        maps.append(entry)

    # A spawn block for a map that is not in Maps.csv never runs - the map does not
    # exist on this server, so nothing in it spawns. Collect them so the site can say
    # "this monster has no live spawn" instead of pointing players at a map they
    # cannot reach.
    known = {m["code"] for m in maps}
    for code in sorted(spawns):
        if code not in known:
            unreachable_maps[code] = sum(s["count"] for s in spawns[code])

    return maps


# ---------------------------------------------------------------------------
# jobs, skills, charts
# ---------------------------------------------------------------------------

def parse_skill_descriptions():
    """Skills/SkillDescriptions.txt -> {skill: thai text} (already translated)."""
    out = {}
    path = os.path.join(SKILLS, "SkillDescriptions.txt")
    if not os.path.isfile(path):
        return out
    code, buf = None, []
    for line in read_text(path).splitlines():
        if line.startswith("::"):
            if code:
                out[code] = "\n".join(buf).strip()
            code = line[2:].split("//")[0].strip()
            buf = []
        elif code is not None:
            buf.append(line.rstrip())
    if code:
        out[code] = "\n".join(buf).strip()
    return out


def build_skills():
    raw = read_toml("Skills.toml")
    thai = parse_skill_descriptions()
    skills = {}
    for key, val in raw.items():
        if not isinstance(val, dict):
            continue
        entry = {
            "code": key,
            # DataLoader only substitutes the id when Name is absent, so an explicit
            # Name = "" (NoEffectAttack) stays blank. Blank is unusable as a heading.
            "name": val.get("Name") or re.sub(r"(?<!^)(?=[A-Z])", " ", key),
            "icon": val.get("Icon", ""),
            "target": val.get("Target", ""),
            "maxLevel": val.get("MaxLevel", 1),
        }
        for src, dst in (("SpCost", "spCost"), ("Params", "params"),
                         ("DescEn", "descEn"), ("CastTime", "castTime"),
                         ("Cooldown", "cooldown"), ("Range", "range"),
                         ("AdjustableLevel", "adjustable"), ("SkillClass", "skillClass"),
                         ("Element", "element"), ("HpCost", "hpCost"),
                         ("RequiredItem", "requiredItem"), ("AmmoCost", "ammoCost")):
            if src in val:
                entry[dst] = val[src]
        if key in thai:
            entry["descTh"] = thai[key]
        skills[key] = entry
    return skills


def build_skill_trees(skills, jobs):
    raw = read_toml("SkillTree.toml")
    max_job_level = {j["name"]: j["maxJobLevel"] for j in jobs}
    trees = {}
    for job, val in raw.items():
        if not isinstance(val, dict):
            continue
        tree = val.get("SkillTree", {})
        entries = []
        for skill, prereqs in tree.items():
            if skill not in skills:
                warn(f"SkillTree: {job} lists unknown skill {skill}")
            entries.append({
                "skill": skill,
                "prereq": [{"skill": p[0], "level": p[1]} for p in prereqs],
            })
        trees[job] = {
            "job": job,
            "jobRank": val.get("JobRank", 0),
            "extends": val.get("Extends", ""),
            "skills": entries,
        }

    # DataLoader.LoadSkillTree: a job cannot spend points in its own tree until it
    # has burned through every point the jobs before it could have earned.
    for job, tree in trees.items():
        points, parent = 0, tree["extends"]
        while parent:
            points += max_job_level.get(parent, 1) - 1
            parent = trees.get(parent, {}).get("extends", "")
        tree["prereqSkillPoints"] = points

    return trees


def parse_block_file(path):
    """`::Key` then free text until the next `::`. Used by several data files."""
    out = {}
    if not os.path.isfile(path):
        return out
    key, buf = None, []
    for line in read_text(path).splitlines():
        if line.startswith("::"):
            if key:
                out[key] = "\n".join(buf).strip()
            key = line[2:].split("//")[0].strip()
            buf = []
        elif key is not None:
            buf.append(line.rstrip())
    if key:
        out[key] = "\n".join(buf).strip()
    return out


def build_status_effects():
    raw = read_toml("StatusEffects.toml")
    thai = parse_block_file(os.path.join(SKILLS, "StatusEffectDescriptions.txt"))
    out = {}
    for key, val in raw.items():
        if not isinstance(val, dict):
            continue
        entry = {"code": key, "name": val.get("Name", key),
                 "type": val.get("Type", ""), "icon": val.get("Icon", "")}
        for src, dst in (("CanDispel", "canDispel"), ("CanDisable", "canDisable")):
            if src in val:
                entry[dst] = val[src]
        if key in thai:
            entry["descTh"] = thai[key]
        out[key] = entry
    return out


def build_skill_tables():
    """SkillDescTables.txt -> {skill: {headers, rows}} - the per level numbers."""
    out = {}
    for key, body in parse_block_file(os.path.join(SKILLS, "SkillDescTables.txt")).items():
        lines = [l for l in body.splitlines() if l.strip()]
        if len(lines) < 2:
            continue
        # first line is the column pixel widths the in-game window uses; skip it
        rows = [l.split("|") for l in lines[1:]]
        out[key] = {"headers": rows[0], "rows": rows[1:]}
    return out


def build_jobs():
    jobs = []
    for row in read_csv("Jobs.csv"):
        jobs.append({
            "id": num(row["Id"]),
            "name": row["Class"],
            "expChart": num(row["ExpChart"]),
            "maxJobLevel": num(row["MaxJobLevel"]),
        })
    return jobs


def read_level_chart(name, jobs):
    """JobHpChart / JobSpChart -> {job name: [value per level]} (index 0 unused).

    DataLoader.ReadHpSpChart pre-fills a zero array for every job in Jobs.csv and
    only overwrites the columns whose header matches a job name - so a job with no
    column, or one spelled differently in the two files, ends up with 0 HP at every
    level on the live server. Reproduce that instead of hiding it, and mark those
    jobs so the site can say so.
    """
    rows = read_csv_rows(name)
    header = rows[0]
    out = {j["name"]: [0] * 100 for j in jobs}
    for h in header[1:]:
        out.setdefault(h, [0] * 100)
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        lvl = num(row[0])
        if not 0 < lvl < 100:
            continue
        for col in range(1, len(header)):
            if col < len(row):
                out[header[col]][lvl] = num(row[col])
    return out


def build_charts(jobs):
    exp = {num(r["Level"]): num(r["Experience"]) for r in read_csv("ExpChart.csv")}
    # ExpJobChart is keyed by job level with one column per job rank (Novice/First/Second)
    jexp_rows = read_csv_rows("ExpJobChart.csv")
    jexp_cols = jexp_rows[0][1:]
    jexp = {c: {} for c in jexp_cols}
    for row in jexp_rows[1:]:
        if not row or not row[0].strip():
            continue
        lvl = num(row[0])
        for i, c in enumerate(jexp_cols):
            if i + 1 < len(row):
                jexp[c][lvl] = num(row[i + 1])

    stat_bonus = {}
    for row in read_csv_rows("JobStatBonuses.csv")[1:]:
        if not row or not row[0].strip():
            continue
        # index 0 is job level 1 - keep every cell so the positions stay aligned
        stat_bonus[row[0].strip()] = [c.strip() for c in row[1:]]

    refine = []
    for row in read_csv("RefineSuccess.csv"):
        refine.append({k: v for k, v in row.items() if k})

    return {
        "exp": exp,
        "jobExp": jexp,
        "hp": read_level_chart("JobHpChart.csv", jobs),
        "sp": read_level_chart("JobSpChart.csv", jobs),
        "statBonus": stat_bonus,
        "refine": refine,
    }


def build_elements():
    rows = read_csv_rows("ElementalChart.csv")
    header = rows[0][1:]
    chart = {}
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        chart[row[0].strip()] = {header[i]: num(row[i + 1]) for i in range(len(header)) if i + 1 < len(row)}
    return {"attackElements": header, "chart": chart}


def build_equip_groups(jobs):
    """Replicate DataLoader.LoadEquipmentGroups.

    Two behaviours matter and both are easy to miss: a repeated group name merges
    into the existing set rather than replacing it (BookUser is listed twice), and
    a cell naming an already-built group expands to that group's jobs. The lookup
    order is groups-so-far first, then job names - which is why a group called
    Acolyte listing "Acolyte" resolves to the job, not to itself.
    """
    job_names = {j["name"] for j in jobs}
    groups = {}
    for row in read_csv_rows("EquipmentGroups.csv")[1:]:
        if not row or not row[0].strip():
            continue
        name = row[0].strip()
        entry = groups.get(name)
        if entry is None:
            entry = groups[name] = {
                "label": row[1].strip().strip('"') if len(row) > 1 else "",
                "jobs": [],
            }
        for cell in row[2:]:
            cell = cell.strip()
            if not cell:
                continue
            if cell in groups and cell is not name and groups[cell] is not entry:
                for j in groups[cell]["jobs"]:
                    if j not in entry["jobs"]:
                        entry["jobs"].append(j)
            elif cell in job_names:
                if cell not in entry["jobs"]:
                    entry["jobs"].append(cell)
            else:
                # Transcendent classes and the two spaced-out names in Jobs.csv
                # ("Soul Linker", "Star Gladiator") have no match. The server logs
                # the same thing at Debug and carries on, so neither do we.
                missing_jobs[cell].add(name)
    return groups


def build_recipes(by_code):
    out = []
    for row in read_csv("ProduceRecipes.csv"):
        if not row.get("Result"):
            continue
        result = by_code.get(row["Result"])
        if result is None:
            warn(f"ProduceRecipes: unknown result item {row['Result']}")
            continue
        mats = []
        for i in (1, 2, 3):
            code = (row.get(f"Material{i}") or "").strip()
            if not code:
                continue
            mat = by_code.get(code)
            if mat is None:
                warn(f"ProduceRecipes: unknown material {code}")
                continue
            mats.append({"id": mat["id"], "amount": num(row.get(f"Amount{i}"), 1)})
        out.append({
            "result": result["id"],
            "count": num(row.get("Count"), 1),
            "skill": row.get("Skill", ""),
            "minSkillLevel": num(row.get("MinSkillLevel")),
            "baseChance": num(row.get("BaseChance")),
            "materials": mats,
            "zeny": num(row.get("Zeny")),
        })
    return out


def build_ore_discovery(by_code):
    out = []
    for row in read_csv("OreDiscovery.csv"):
        if not row.get("Item"):
            continue
        item = by_code.get(row["Item"])
        if item is None:
            warn(f"OreDiscovery: unknown item {row['Item']}")
            continue
        out.append({"id": item["id"], "rate": num(row["Rate"])})
    return out


# ---------------------------------------------------------------------------
# the systems this project added
# ---------------------------------------------------------------------------

# Custom/AdventureBook/AdventureBook.cs
BOOK_REGION_HEADGEAR = {
    "Prontera Culverts": "Detective's_Cap", "Prontera Fields": "Romantic_White_Flower",
    "Morroc Fields": "Cowboy_Hat", "Payon Fields": "Ayam", "Ant Hell": "Dark_Blinder",
    "Izlude Bailan Cave": "Mythical_Lion_Mask", "Orc Dungeon": "Orc_Helm_",
    "Mt. Mjolnir": "Zealotus_Mask", "Geffen Fields": "Bulb_Band",
    "Mjolnir Dead Pit": "Coif_", "Forest Labyrinth": "Banana_Hat", "Lutie": "Shafka",
    "Yuno Fields": "Ph.D_Hat_", "Payon Dungeon": "Magistrate_Hat", "Comodo": "Pirate_Dagger",
    "Geffen Dungeon": "Dark_Bacilium", "Sphinx": "Sphinx_Hat_", "Sunken Ship": "Red_Bonnet",
    "Pyramid": "Cross_Hat", "Clock Tower": "Golden_Gear_", "Amatsu": "Bride_Mask",
    "Glast Heim": "Opera_Phantom_Mask", "Magma Dungeon": "Hot-Blooded_Headband",
    "Turtle Island": "Spiky_Band_",
}

BOOK_SKIPPED_REGIONS = {"towns", "debug room", "prontera guild realm"}

BOOK_REGION_OVERRIDES = {
    "PORING": "Prontera Fields", "POPORING": "Geffen Fields", "DROPS": "Morroc Fields",
    "MARIN": "Lutie", "POISON_SPORE": "Payon Fields", "THIEF_BUG": "Prontera Culverts",
    "THIEF_BUG_FEMALE": "Prontera Culverts", "THIEF_BUG_MALE": "Prontera Culverts",
}

# AdventureBookRank.StarsForRank, then BonusFor
BOOK_RANK_STARS = [30, 90, 175, 280, 390, 490, 580, 650, 700]

# AdventureBookRewards.Bands, keyed by the page's max level
BOOK_REWARD_BANDS = [
    (29, [("Concentration_Potion", 5), ("Elunium", 1)],
         [("Old_Blue_Box", 1), ("Oridecon", 1)],
         [("Old_Purple_Box", 1), ("Elunium", 2), ("Oridecon", 2)]),
    (59, [("Awakening_Potion", 5), ("Elunium", 1)],
         [("Old_Blue_Box", 2), ("Oridecon", 1)],
         [("Old_Purple_Box", 2), ("Elunium", 2), ("Oridecon", 2)]),
    (None, [("Berserk_Potion", 5), ("Elunium", 1)],
           [("Old_Purple_Box", 1), ("Oridecon", 1)],
           [("Old_Purple_Box", 3), ("Elunium", 3), ("Oridecon", 3)]),
]

BOOK_RANK_REWARDS = [
    [("Elunium", 5), ("Oridecon", 5), ("Battle_Manual", 1), ("Bubble_Gum", 1)],
    [("Elunium", 10), ("Oridecon", 10), ("Battle_Manual", 2), ("Bubble_Gum", 2)],
    [("Elunium", 15), ("Oridecon", 15), ("Battle_Manual", 3), ("Bubble_Gum", 3)],
    [("Elunium", 20), ("Oridecon", 20), ("Battle_Manual", 4), ("Bubble_Gum", 4), ("Old_Purple_Box", 3)],
    [("Elunium", 30), ("Oridecon", 30), ("Battle_Manual", 5), ("Bubble_Gum", 5), ("Old_Purple_Box", 5)],
    [("Elunium", 40), ("Oridecon", 40), ("Battle_Manual", 6), ("Bubble_Gum", 6), ("Old_Card_Album", 3)],
    [("Elunium", 50), ("Oridecon", 50), ("Battle_Manual", 8), ("Bubble_Gum", 8), ("Old_Card_Album", 5)],
    [("Elunium", 70), ("Oridecon", 70), ("Battle_Manual", 10), ("Bubble_Gum", 10), ("Old_Card_Album", 8)],
    [("Elunium", 100), ("Oridecon", 100), ("Battle_Manual", 15), ("Bubble_Gum", 15), ("Old_Card_Album", 12)],
    [("Valkyrian_Helm", 1), ("Valkyrian_Armor", 1), ("Valkyrian_Manteau", 1),
     ("Valkyrian_Shoes", 1), ("Valkyrja's_Shield", 1), ("Elunium", 150), ("Oridecon", 150)],
]


def hunt_target(spawn_count):
    """AdventureBook.HuntTargetForSpawnCount."""
    target = (spawn_count // 2 + 49) // 50 * 50
    return max(50, min(target, 500))


def rank_bonus(rank):
    """AdventureBookRank.BonusFor - cumulative, not additive per rank."""
    if rank <= 0:
        return (0, 0, 0, 0)
    if rank >= 10:
        return (5, 12, 12, 8)
    return (min(rank, 3),
            max(0, min(rank - 3, 3)) * 3,
            max(0, min(rank - 6, 3)) * 3,
            max(0, min(rank - 6, 3)) * 2)


def reward_ids(pairs, by_code):
    out = []
    for code, count in pairs:
        item = by_code.get(code)
        if item is None:
            warn(f"AdventureBook: reward item {code} does not exist")
            continue
        out.append({"id": item["id"], "count": count})
    return out


def build_adventure_book(monsters, maps, items, by_code):
    """Replicate AdventureBook.Build against the exported map list.

    The server builds this from the maps that actually loaded, which is the same set
    Maps.csv gives us here, so the page list and the star total come out identical
    to what a player sees.
    """
    instance_of = {m["code"]: m["instance"] for m in maps}

    gathered = {}
    bosses = set()
    for m in maps:
        for rule in m["spawns"]:
            if rule["count"] <= 0:
                continue
            if rule.get("flag") in ("Boss", "MVP"):
                bosses.add(rule["code"])
                continue
            found = gathered.setdefault(rule["code"], {
                "code": rule["code"], "sightings": defaultdict(int),
                "regions": defaultdict(int),
            })
            found["sightings"][m["code"]] += rule["count"]
            region = instance_of.get(m["code"], "")
            if region and region.lower() not in BOOK_SKIPPED_REGIONS:
                found["regions"][region] += rule["count"]

    def card_of(code):
        for drop in monsters[code].get("drops", []):
            if items[drop["id"]]["type"] == "Card":
                return drop["id"]
        return 0

    groups = defaultdict(list)
    not_quarry = 0
    for code, found in gathered.items():
        if code in bosses:
            continue
        mon = monsters.get(code)
        if mon is None:
            continue
        if mon["exp"] == 0 and mon["jobExp"] == 0:
            not_quarry += 1
            continue
        card = card_of(code)
        groups[card if card > 0 else -mon["id"]].append((mon, found))

    pages = []
    regions = {}
    homeless = 0
    for key, members in sorted(groups.items()):
        members.sort(key=lambda x: x[0]["id"])
        region_counts = defaultdict(int)
        map_counts = defaultdict(int)
        for mon, found in members:
            for region, count in found["regions"].items():
                region_counts[region] += count
            for mp, count in found["sightings"].items():
                map_counts[mp] += count

        region = None
        for mon, _ in members:
            chosen = BOOK_REGION_OVERRIDES.get(mon["code"])
            if chosen and chosen in BOOK_REGION_HEADGEAR:
                region = chosen
                break
        if region is None and region_counts:
            region = max(region_counts.items(), key=lambda kv: kv[1])[0]
        if region is None or region not in BOOK_REGION_HEADGEAR:
            homeless += len(members)
            continue

        regions.setdefault(region, {"name": region,
                                    "headgear": by_code[BOOK_REGION_HEADGEAR[region]]["id"]
                                    if BOOK_REGION_HEADGEAR[region] in by_code else 0,
                                    "pages": 0, "stars": 0})

        spawn_count = sum(map_counts.values())
        target = hunt_target(spawn_count)
        card_id = key if key > 0 else 0
        level = sum(m["level"] for m, _ in members) // len(members)
        stars = 3 if card_id else 2

        regions[region]["pages"] += 1
        regions[region]["stars"] += stars

        pages.append({
            "pageId": card_id if card_id else members[0][0]["id"],
            "name": items[card_id]["name"].replace(" Card", "") if card_id else members[0][0]["name"],
            "monsters": [m["code"] for m, _ in members],
            "level": level,
            "region": region,
            "cardId": card_id,
            "spawnCount": spawn_count,
            "huntTarget": target,
            "huntTargetLarge": target * 3,
            "stars": stars,
            "maps": [{"map": k, "count": v}
                     for k, v in sorted(map_counts.items(), key=lambda kv: -kv[1])],
        })

    pages.sort(key=lambda p: (p["region"], p["level"]))
    total_stars = sum(p["stars"] for p in pages)

    band_rows = []
    for max_level, hunt, hunt_large, card in BOOK_REWARD_BANDS:
        band_rows.append({
            "maxLevel": max_level,
            "hunt": reward_ids(hunt, by_code),
            "huntLarge": reward_ids(hunt_large, by_code),
            "card": reward_ids(card, by_code),
        })

    ranks = []
    for rank in range(1, 11):
        stats, drop, exp, refine = rank_bonus(rank)
        ranks.append({
            "rank": rank,
            "stars": BOOK_RANK_STARS[rank - 1] if rank <= len(BOOK_RANK_STARS) else BOOK_RANK_STARS[-1],
            "everyRegion": rank == 10,
            "stats": stats, "dropPercent": drop, "expPercent": exp, "refinePercent": refine,
            "rewards": reward_ids(BOOK_RANK_REWARDS[rank - 1], by_code),
        })

    return {
        "pages": pages,
        "regions": sorted(regions.values(), key=lambda r: r["name"]),
        "totalStars": total_stars,
        "totalKills": sum(p["huntTarget"] + p["huntTargetLarge"] for p in pages),
        "notQuarry": not_quarry,
        "homeless": homeless,
        "bands": band_rows,
        "ranks": ranks,
    }


def build_boss_log(monsters, maps, by_code):
    """Replicate BossLog.Build - every spawn rule flagged Boss or MVP."""
    entries = {}
    for m in maps:
        for rule in m["spawns"]:
            if rule.get("flag") not in ("Boss", "MVP"):
                continue
            mon = monsters.get(rule["code"])
            if mon is None:
                continue
            entry = entries.setdefault(rule["code"], {
                "code": rule["code"], "isMvp": False, "maps": [],
            })
            entry["isMvp"] |= (rule["flag"] == "MVP") or bool(mon.get("isMvp"))
            entry["maps"].append({"map": m["code"], "count": rule["count"],
                                  "respawnMin": rule["respawnMin"],
                                  "respawnMax": rule["respawnMax"]})

    ordered = sorted(entries.values(),
                     key=lambda e: (not e["isMvp"], monsters[e["code"]]["level"]))
    plain = by_code.get("Hat_of_the_Sun_God")
    crowned = by_code.get("Hat_of_the_Sun_God_")
    return {
        "entries": ordered,
        "mvpCount": sum(1 for e in ordered if e["isMvp"]),
        "bossCount": sum(1 for e in ordered if not e["isMvp"]),
        "clearReward": plain["id"] if plain else 0,
        "crownedHat": crowned["id"] if crowned else 0,
    }


# ---------------------------------------------------------------------------
# write
# ---------------------------------------------------------------------------

def write(name, payload):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path)


def main():
    os.makedirs(OUT, exist_ok=True)

    items, by_code = build_items()
    monsters, mon_by_code = build_monsters()
    attach_drops(monsters, items, by_code)

    for code, casts in parse_monster_skills().items():
        if code in monsters:
            monsters[code]["skills"] = casts
        else:
            missing_monsters[code].add("MonsterSkills")

    mvp_codes = {m["code"] for m in monsters.values() if m.get("isMvp")}
    spawns = parse_spawns(monsters, mvp_codes)
    maps = build_maps(spawns, parse_warps(), parse_npcs(), monsters)

    # where does each monster live, and where does each item drop from
    homes = defaultdict(list)
    for m in maps:
        for s in m["spawns"]:
            place = {"map": m["code"], "count": s["count"],
                     "respawnMin": s["respawnMin"], "respawnMax": s["respawnMax"]}
            if s.get("flag"):
                place["flag"] = s["flag"]
            if s.get("respawnWritten"):
                place["respawnWritten"] = s["respawnWritten"]
            homes[s["code"]].append(place)
    for code, places in homes.items():
        monsters[code]["maps"] = sorted(places, key=lambda p: -p["count"])

    # monsters whose only spawn blocks live on maps this server does not have,
    # minus the ones something other than a spawn script brings into the world
    summons = find_summon_sources(monsters)
    for mon in monsters.values():
        if mon.get("maps"):
            continue
        called = sorted(summons.get(mon["code"], ()))
        if called:
            mon["summonedBy"] = called
        else:
            mon["noSpawn"] = True

    drop_sources = defaultdict(list)
    for mon in monsters.values():
        for d in mon.get("drops", []):
            drop_sources[d["id"]].append({"monster": mon["code"], "chance": d["chance"]})
        for d in mon.get("mvpDrops", []):
            drop_sources[d["id"]].append({"monster": mon["code"], "chance": d["chance"], "mvp": True})
    for iid, sources in drop_sources.items():
        items[iid]["droppedBy"] = sorted(sources, key=lambda s: -s["chance"])

    shops = parse_shops(by_code)
    sold_by = defaultdict(list)
    for shop in shops:
        for entry in shop["items"]:
            seller = {"map": shop["map"], "name": shop["name"]}
            if "price" in entry:
                seller["price"] = entry["price"]
            sold_by[entry["id"]].append(seller)
    for iid, sellers in sold_by.items():
        items[iid]["soldBy"] = sellers

    jobs = build_jobs()
    skills = build_skills()
    trees = build_skill_trees(skills, jobs)
    tables = build_skill_tables()
    for code, table in tables.items():
        if code in skills:
            skills[code]["table"] = table
        else:
            warn(f"SkillDescTables: table for unknown skill {code}")

    sizes = {}
    sizes["items.json"] = write("items.json", sorted(items.values(), key=lambda i: i["id"]))
    sizes["monsters.json"] = write("monsters.json", sorted(monsters.values(), key=lambda m: m["id"]))
    sizes["maps.json"] = write("maps.json", maps)
    sizes["skills.json"] = write("skills.json", {"skills": skills, "trees": trees})
    sizes["status.json"] = write("status.json", build_status_effects())
    sizes["shops.json"] = write("shops.json", shops)

    charts = build_charts(jobs)
    zero_hp = sorted(j["name"] for j in jobs if not any(charts["hp"].get(j["name"], [])))
    for job in jobs:
        if not any(charts["hp"].get(job["name"], [])):
            job["noHpCurve"] = True
    sizes["charts.json"] = write("charts.json", charts)
    sizes["jobs.json"] = write("jobs.json", jobs)   # after the noHpCurve flag is set
    sizes["elements.json"] = write("elements.json", build_elements())
    sizes["reference.json"] = write("reference.json", {
        "equipGroups": build_equip_groups(jobs),
        "recipes": build_recipes(by_code),
        "oreDiscovery": build_ore_discovery(by_code),
        "weaponClasses": read_csv("WeaponClass.csv"),
        "elementNames": [r[0] for r in read_csv_rows("ElementalChart.csv")[1:] if r and r[0].strip()],
    })

    sizes["custom.json"] = write("custom.json", {
        "adventureBook": build_adventure_book(monsters, maps, items, by_code),
        "bossLog": build_boss_log(monsters, maps, by_code),
    })

    meta = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "counts": {
            "items": len(items),
            "monsters": len(monsters),
            "maps": len(maps),
            "skills": len(skills),
            "jobs": len(jobs),
            "mapsWithSpawns": sum(1 for m in maps if m["spawns"]),
            "totalSpawnedMonsters": sum(m["monsterCount"] for m in maps),
            "npcs": sum(len(m["npcs"]) for m in maps),
            "warps": sum(len(m["warps"]) for m in maps),
            "unreachableSpawnMaps": len(unreachable_maps),
            "monstersWithoutSpawns": sum(1 for m in monsters.values() if m.get("noSpawn")),
            "monstersSummonedOnly": sum(1 for m in monsters.values() if m.get("summonedBy")),
            "shops": len(shops),
            "statusEffects": len(build_status_effects()),
        },
        "sizes": sizes,
        #read from appsettings.json rather than written down, so a page can say which rates
        #it is showing instead of a sentence going stale the day somebody flips the setting
        "remapDropRates": REMAP_DROPS,
        "unreachableSpawnMaps": unreachable_maps,
        "monstersWithoutSpawns": sorted(m["code"] for m in monsters.values() if m.get("noSpawn")),
        "monstersSummonedOnly": sorted(m["code"] for m in monsters.values() if m.get("summonedBy")),
        "jobsWithoutHpCurve": zero_hp,
    }
    write("meta.json", meta)

    print("exported to", OUT)
    for k, v in meta["counts"].items():
        print(f"  {k:24} {v}")
    total = sum(sizes.values())
    print(f"  {'total json bytes':24} {total:,}")

    if missing_monsters:
        maps_only = sorted(missing_monsters)
        print(f"\n{len(maps_only)} monster code(s) referenced by scripts but absent from "
              f"Monsters.csv (expected - those maps are outside the episode 4 scope):")
        print("   ", ", ".join(maps_only[:20]) + (" ..." if len(maps_only) > 20 else ""))

    if missing_jobs:
        print(f"\n{len(missing_jobs)} job name(s) used by EquipmentGroups.csv but absent from "
              f"Jobs.csv (transcendent classes, plus SoulLinker/StarGladiator which are "
              f"spelled with a space in Jobs.csv):")
        print("   ", ", ".join(sorted(missing_jobs)))

    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        seen = set()
        for w in warnings:
            if w not in seen:
                seen.add(w)
                print("  -", w)
    return 0


if __name__ == "__main__":
    sys.exit(main())
