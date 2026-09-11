"""Finds items the data says exist but the game cannot actually use.

Run from the repo root:  python tools/itemaudit.py

Three questions, because there are three ways an item quietly does nothing:

  1. a card in the item table with no effect written for it, or written as the
     "OnValidate: return false" stub the scripts use to mean "not done yet"
  2. gear whose EquipGroup was never defined in EquipmentGroups.csv - the lookup
     is a dictionary miss, so IsJobInEquipGroup says no to every job alive
  3. a usable item stubbed the same way, which refuses to be used

For each, it also asks whether a player can get their hands on the thing at all.
Something broken that nothing drops and no npc sells is a row in a spreadsheet;
the same thing sold in a town shop is a complaint on the first evening.

What this cannot find is the other kind of bug - the butterfly wing that dropped
the server was not a broken item, it was a missing bounds check in the movement
code that any map change could have reached. Those show up in the log as
"Server threw exception!", not here.
"""

import csv
import glob
import os
import re
import sys

DATA = os.path.join("RoRebuildServer", "GameConfig", "ServerData")
STUB = re.compile(r'Item\("([^"]+)"\)\s*\{\s*OnValidate:\s*return false;')
NAMED = re.compile(r'Item\("([^"]+)"\)')


def rows(path):
    with open(os.path.join(DATA, path), encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def read(path):
    with open(path, encoding="utf-8-sig", errors="replace") as f:
        return f.read()


def slurp(pattern):
    return "".join(read(f) for f in glob.glob(os.path.join(DATA, pattern), recursive=True))


def mentions(code, text):
    """Whether a body of text names this item, rather than one whose name contains it."""
    return re.search(r'(^|[",\s(])%s([",\s)]|$)' % re.escape(code), text, re.M) is not None


def main():
    if not os.path.isdir(DATA):
        sys.exit("run this from the repo root")

    drops = read(os.path.join(DATA, "Db", "DropData.csv"))

    #Everything except the item scripts themselves. Script/Items is where an item's own
    #effect is written, so counting it as a source makes every item look obtainable -
    #the question here is whether something hands one over, not whether one is defined.
    npcs = "".join(read(f) for f in glob.glob(os.path.join(DATA, "Script", "**", "*.txt"), recursive=True)
                   if os.path.join("Script", "Items") not in f)

    def obtainable(code):
        where = [name for name, body in (("drops", drops), ("npc", npcs)) if mentions(code, body)]
        return "+".join(where)

    def report(title, items, describe):
        reachable = [(c, obtainable(c)) for c in items]
        live = [(c, w) for c, w in reachable if w]
        print(f"\n{title}: {len(items)} ({len(live)} a player can actually get)")
        for code, where in sorted(live):
            print(f"    {code:<32} {describe(code):<14} via {where}")
        if items and not live:
            print("    none of them are obtainable, so nothing here reaches a player")

    # ---------------------------------------------------------------- cards
    effects = read(os.path.join(DATA, "Script", "Items", "CardEffects.txt"))
    written = set(NAMED.findall(effects))
    dead = set(STUB.findall(effects))
    dead |= {c["Code"] for c in rows("Db/ItemsCards.csv") if c["Code"] not in written}
    report("cards that do nothing when socketed", dead, lambda c: "no effect")

    # ------------------------------------------------------------- equipment
    defined = set()
    with open(os.path.join(DATA, "Db", "EquipmentGroups.csv"), encoding="utf-8-sig") as f:
        for line in f:
            parts = [p.strip().strip('"') for p in line.split(",") if p.strip()]
            if parts and not line.startswith("Group"):
                defined.add(parts[0])
    known = defined | {r["Class"] for r in rows("Db/Jobs.csv")}

    gear = rows("Db/ItemsWeapons.csv") + rows("Db/ItemsEquipment.csv")
    group_of = {}
    for r in gear:
        g = (r.get("EquipGroup") or "").strip()
        if g and g not in known:
            group_of[r["Code"]] = g
    report("gear no job on the server can equip", set(group_of), lambda c: group_of[c])

    # ----------------------------------------------------------------- usable
    stubs = set()
    for f in glob.glob(os.path.join(DATA, "Script", "Items", "*.txt")):
        if "CardEffects" not in f:
            stubs |= set(STUB.findall(read(f)))
    usable = stubs & {r["Code"] for r in rows("Db/ItemsUsable.csv")}
    report("usable items that refuse to be used", usable, lambda c: "stub")


if __name__ == "__main__":
    main()
