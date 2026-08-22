#!/usr/bin/env python3
"""Works out what a forged weapon will be called, the way the client will.

The name is assembled from three things that each live somewhere else - the slots on the
item, a row of NonCardPrefixes.csv, and a name the server sent separately - and the order
they go in is the whole point: "Very Very Strong Mitmair's Fire Blade", not "Fire Very
Very Strong Mitmair's Blade". That ordering is one integer column and an off-by-one away
from being wrong in a way nobody would notice until they made one.

This mirrors MakeNameWithSockets against the real csv and checks the cases the forge can
actually produce.
"""
import csv
import io
import sys
from pathlib import Path

DB = Path("/home/user/ragrebuildproject/RoRebuildServer/GameConfig/ServerData/Db")
FORGER_ORDER = 1

prefixes = {}
with io.open(DB / "NonCardPrefixes.csv", encoding="utf-8-sig", newline="") as fh:
    for row in csv.DictReader(fh):
        prefixes[row["Code"]] = row


def name(slots, forger, item):
    """slots is the four card slots in order, by item code or None."""
    groups = []
    for entry in slots:
        if not entry:
            continue
        for g in groups:
            if g[0] == entry:
                g[1] += 1
                break
        else:
            groups.append([entry, 1])

    if not groups and forger is None:
        return item

    groups.sort(key=lambda g: int(prefixes.get(g[0], {}).get("Order") or 0))

    out = []
    placed = forger is None
    for code, count in groups:
        data = prefixes.get(code)
        order = int((data or {}).get("Order") or 0)

        if not placed and order >= FORGER_ORDER:
            out.append(forger + "'s")
            placed = True

        if data and data["Prefix"]:
            stacked = {2: data.get("Prefix2"), 3: data.get("Prefix3"), 4: data.get("Prefix4")}.get(count)
            if stacked:
                out.append(stacked)
            else:
                out.append({1: "", 2: "Double ", 3: "Triple ", 4: "Quadruple "}[count] + data["Prefix"])

    if not placed:
        out.append(forger + "'s")

    out.append(item)
    return " ".join(out)


C = "Star_Crumb"
F = "Flame_Heart"

CASES = [
    (([None] * 4, None, "Blade"), "Blade"),
    (([None] * 4, "Mitmair", "Blade"), "Mitmair's Blade"),
    (([F, None, None, None], None, "Blade"), "Fire Blade"),
    (([F, None, None, None], "Mitmair", "Blade"), "Mitmair's Fire Blade"),
    #one "Very" per crumb, and the third replaces the pair rather than adding a third
    (([C, None, None, None], "Mitmair", "Blade"), "Very Strong Mitmair's Blade"),
    (([C, C, None, None], "Mitmair", "Blade"), "Very Very Strong Mitmair's Blade"),
    (([C, C, C, None], "Mitmair", "Blade"), "Triple Very Strong Mitmair's Blade"),
    (([C, F, None, None], None, "Blade"), "Very Strong Fire Blade"),
    (([C, C, F, None], "Mitmair", "Blade"), "Very Very Strong Mitmair's Fire Blade"),
    (([C, C, C, F], "Mitmair", "Blade"), "Triple Very Strong Mitmair's Fire Blade"),
]

bad = 0
for (slots, forger, item), want in CASES:
    got = name(slots, forger, item)
    mark = "ok " if got == want else "BAD"
    if got != want:
        bad += 1
        print(f"{mark} {got!r}\n    wanted {want!r}")
    else:
        print(f"{mark} {got}")

print()
print("every forged name comes out in the right order" if not bad else f"{bad} name(s) wrong")
sys.exit(1 if bad else 0)
