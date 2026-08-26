#!/usr/bin/env python3
"""Check that web/data/*.json still matches the server's own data files.

Run after every export. It re-reads the source CSV/TOML independently of
export.py and compares counts and a set of derived values, so a parser that
quietly starts dropping rows shows up as a number rather than as a page that
looks fine but is missing half its content.

    python3 tools/webdata/verify.py

Exit code is the number of mismatches, so it works in a shell chain.
"""

import csv
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "RoRebuildServer", "GameConfig", "ServerData")
DB = os.path.join(DATA, "Db")
OUT = os.path.join(ROOT, "web", "data")

failures = []


def rows(name, folder=DB):
    with open(os.path.join(folder, name), encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def raw(name, folder=DB):
    with open(os.path.join(folder, name), encoding="utf-8-sig", newline="") as fh:
        return list(csv.reader(fh))


def load(name):
    path = os.path.join(OUT, f"{name}.json")
    if not os.path.isfile(path):
        failures.append(f"{name}.json is missing - run tools/webdata/export.py")
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def check(label, got, want):
    ok = got == want
    if not ok:
        failures.append(f"{label}: json has {got!r}, source says {want!r}")
    print(f"{'ok  ' if ok else 'FAIL'} {label:46} {got!r}"
          + ("" if ok else f"   expected {want!r}"))


def toml_sections(name):
    text = open(os.path.join(DATA, "Skills", name), encoding="utf-8-sig").read()
    return len(re.findall(r"^\[([A-Za-z0-9_]+)\]", text, re.M))


def main():
    items = load("items")
    monsters = load("monsters")
    maps = load("maps")
    jobs = load("jobs")
    skills = load("skills")
    status = load("status")
    ref = load("reference")
    charts = load("charts")
    shops = load("shops")
    if None in (items, monsters, maps, jobs, skills, status, ref, charts, shops):
        print("\n".join(failures))
        return len(failures)

    by_id = {i["id"]: i for i in items}
    by_code = {i["code"]: i for i in items}
    mons = {m["code"]: m for m in monsters}
    maps_by_code = {m["code"]: m for m in maps}

    print("--- row counts -------------------------------------------------")
    item_files = ["ItemsRegular.csv", "ItemsUsable.csv", "ItemsWeapons.csv",
                  "ItemsEquipment.csv", "ItemsCards.csv", "ItemsAmmo.csv"]
    check("items", len(items), sum(len(rows(f)) for f in item_files))
    check("monsters", len(monsters), len(rows("Monsters.csv")))
    check("maps", len(maps), len(rows("Maps.csv")))
    check("jobs", len(jobs), len(rows("Jobs.csv")))
    check("skills", len(skills["skills"]), toml_sections("Skills.toml"))
    check("status effects", len(status), toml_sections("StatusEffects.toml"))
    check("recipes", len(ref["recipes"]), len(rows("ProduceRecipes.csv")))
    check("ore discovery", len(ref["oreDiscovery"]), len(rows("OreDiscovery.csv")))
    check("weapon classes", len(ref["weaponClasses"]), len(rows("WeaponClass.csv")))

    # EquipmentGroups repeats a name on purpose (BookUser), and the loader merges
    # rather than replaces, so the group count is the number of distinct names.
    group_names = {r[0].strip() for r in raw("EquipmentGroups.csv")[1:] if r and r[0].strip()}
    check("equipment groups", len(ref["equipGroups"]), len(group_names))

    print("\n--- drops ------------------------------------------------------")
    codes = set(mons)
    drop_rows = raw("DropData.csv")[1:]
    src_monsters = sum(1 for r in drop_rows
                       if r and r[0].strip().replace(" ", "_").upper() in codes)
    src_entries = 0
    for r in drop_rows:
        if not r or r[0].strip().replace(" ", "_").upper() not in codes:
            continue
        for pos in range(1, len(r) - 1, 2):
            if r[pos].strip() and int(r[pos + 1] or 0) > 0:
                src_entries += 1
    check("monsters carrying a drop table", sum(1 for m in monsters if "drops" in m), src_monsters)
    check("individual drop entries", sum(len(m.get("drops", [])) for m in monsters), src_entries)
    check("every drop points at a real item",
          all(d["id"] in by_id for m in monsters for d in m.get("drops", [])), True)
    check("no drop chance above 100%",
          max((d["chance"] for m in monsters for d in m.get("drops", [])), default=0) <= 10000, True)

    print("\n--- derived values ---------------------------------------------")
    weapons = {r["Code"]: r for r in rows("ItemsWeapons.csv")}
    regular = {r["Code"]: r for r in rows("ItemsRegular.csv")}

    # OnSetItemPurchasePrice / OnSetItemSaleValue from the config script
    sample_weapon = next(c for c in weapons if c in by_code)
    check("weapon buy price is csv * 3/2",
          by_code[sample_weapon]["price"], int(weapons[sample_weapon]["Price"]) * 3 // 2)
    check("weapon sell price is buy / 3",
          by_code[sample_weapon]["sellPrice"], by_code[sample_weapon]["price"] // 3)
    etc = next(c for c, r in regular.items() if r["Usage"] == "None" and c in by_code)
    check("plain etc buy price is csv * 2",
          by_code[etc]["price"], int(regular[etc]["Price"]) * 2)

    # spawn totals must agree between the map side and the monster side
    from_maps = sum(m["monsterCount"] for m in maps)
    from_monsters = sum(p["count"] for m in monsters for p in m.get("maps", []))
    check("spawn totals agree (map view vs monster view)", from_maps, from_monsters)

    check("every spawn names a real monster",
          all(s["code"] in mons for m in maps for s in m["spawns"]), True)
    check("monsters flagged noSpawn really have no map",
          all(not m.get("maps") for m in monsters if m.get("noSpawn")), True)

    # skill trees
    max_job = {j["name"]: j["maxJobLevel"] for j in jobs}
    for job, tree in skills["trees"].items():
        want, parent = 0, tree["extends"]
        while parent:
            want += max_job.get(parent, 1) - 1
            parent = skills["trees"].get(parent, {}).get("extends", "")
        if tree["prereqSkillPoints"] != want:
            failures.append(f"{job} prereqSkillPoints is {tree['prereqSkillPoints']}, expected {want}")
    check("skill tree prereq points recompute", not any(
        f.startswith(j) for j in skills["trees"] for f in failures), True)

    check("every tree entry names a real skill",
          all(e["skill"] in skills["skills"] for t in skills["trees"].values() for e in t["skills"]), True)
    check("every prereq names a real skill",
          all(p["skill"] in skills["skills"] for t in skills["trees"].values()
              for e in t["skills"] for p in e["prereq"]), True)
    check("no skill left without a display name",
          all(s["name"] for s in skills["skills"].values()), True)

    # charts
    # DataLoader pre-fills a zero row for every job, so the entry must exist even
    # when JobHpChart.csv has no column for it. The all-zero ones are a data gap in
    # the game files, not an export bug - list them rather than fail on them.
    check("HP chart has a row for every job in Jobs.csv",
          all(j["name"] in charts["hp"] for j in jobs), True)
    check("SP chart has a row for every job in Jobs.csv",
          all(j["name"] in charts["sp"] for j in jobs), True)
    zero = sorted(j["name"] for j in jobs if not any(charts["hp"][j["name"]]))
    check("jobs flagged noHpCurve match the all-zero rows",
          sorted(j["name"] for j in jobs if j.get("noHpCurve")), zero)
    if zero:
        print(f"     note: no HP column in JobHpChart.csv for {', '.join(zero)}"
              f" - those jobs have 0 max HP on the live server too")
    check("stat bonus rows are 70 long",
          all(len(v) == 70 for v in charts["statBonus"].values()), True)

    # cross references
    check("shop items all resolve",
          all(e["id"] in by_id for s in shops for e in s["items"]), True)
    # SellItem(name, price) must never let a player buy below the npc buy-back value;
    # Npc.SellItem throws at startup if it would, so the exported data must agree.
    check("no shop sells below its own buy-back value",
          all(by_id[e["id"]]["sellPrice"] - e["price"] * 0.5 <= 0
              for s in shops for e in s["items"] if "price" in e), True)
    check("soldBy back-reference matches shop stock",
          sum(len(i.get("soldBy", [])) for i in items),
          sum(len(s["items"]) for s in shops))
    check("recipe results all resolve", all(r["result"] in by_id for r in ref["recipes"]), True)
    check("recipe materials all resolve",
          all(m["id"] in by_id for r in ref["recipes"] for m in r["materials"]), True)
    check("warps point at maps or are recorded as missing",
          all(w["to"] for m in maps for w in m["warps"]), True)
    check("droppedBy back-reference matches drops",
          sum(len(i.get("droppedBy", [])) for i in items),
          sum(len(m.get("drops", [])) for m in monsters)
          + sum(len(m.get("mvpDrops", [])) for m in monsters))

    print("\n--- respawn windows ---------------------------------------------")
    MIN_SPAWN, MAX_SPAWN = 2000, 360000
    MVP_LOW, MVP_HIGH = 14 * 60 * 1000, 15 * 60 * 1000
    mvp_codes = {m["code"] for m in monsters if m.get("isMvp")}
    bad_clamp = []
    for m in maps:
        for rule in m["spawns"]:
            lo, hi = rule["respawnMin"], rule["respawnMax"]
            if rule["code"] in mvp_codes:
                if (lo, hi) != (MVP_LOW, MVP_HIGH):
                    bad_clamp.append(f'{m["code"]}/{rule["code"]} mvp window {lo}-{hi}')
            elif lo < MIN_SPAWN or lo > MAX_SPAWN or hi > MAX_SPAWN or hi < lo:
                bad_clamp.append(f'{m["code"]}/{rule["code"]} window {lo}-{hi}')
    check("every spawn window obeys the clamp chain", bad_clamp[:3] or True, True)
    check("every mvp spawn is the 14-15 minute window",
          all(r["respawnMin"] == MVP_LOW and r["respawnMax"] == MVP_HIGH
              for m in maps for r in m["spawns"] if r["code"] in mvp_codes), True)

    print("\n--- adventure book and boss log ---------------------------------")
    custom = load("custom")
    if custom:
        ab, bl = custom["adventureBook"], custom["bossLog"]
        mons_by_code = {m["code"]: m for m in monsters}

        def hunt_target(spawn_count):
            return max(50, min((spawn_count // 2 + 49) // 50 * 50, 500))

        check("book star total matches the pages",
              ab["totalStars"], sum(p["stars"] for p in ab["pages"]))
        check("book kill total matches the pages", ab["totalKills"],
              sum(p["huntTarget"] + p["huntTargetLarge"] for p in ab["pages"]))
        check("every hunt target follows the spawn-count formula",
              all(p["huntTarget"] == hunt_target(p["spawnCount"])
                  and p["huntTargetLarge"] == p["huntTarget"] * 3 for p in ab["pages"]), True)
        check("a page has 3 stars exactly when it has a card",
              all((p["stars"] == 3) == bool(p["cardId"]) for p in ab["pages"]), True)
        check("every page names real monsters",
              all(c in mons_by_code for p in ab["pages"] for c in p["monsters"]), True)
        # AdventureBook.Build excludes on the spawn rule's DisplayType, not on the
        # monster's Special column - so a monster that behaves like a boss but whose
        # spawn is not flagged Boss/MVP does belong in the book. Assert what the
        # server actually does, and list the three that read oddly because of it.
        flagged = {r["code"] for m in maps for r in m["spawns"]
                   if r.get("flag") in ("Boss", "MVP")}
        check("no spawn-flagged boss ended up in the book",
              all(c not in flagged for p in ab["pages"] for c in p["monsters"]), True)
        odd = sorted({c for p in ab["pages"] for c in p["monsters"]
                      if mons_by_code[c].get("special") == "Boss"})
        if odd:
            print(f"     note: {', '.join(odd)} carry Special=Boss in Monsters.csv but no "
                  f"spawn flags them, so they count as ordinary hunts in the book")
        check("every page's region hands out a real headgear",
              all(r["headgear"] in by_id for r in ab["regions"]), True)
        check("region page and star counts add up to the book",
              (sum(r["pages"] for r in ab["regions"]), sum(r["stars"] for r in ab["regions"])),
              (len(ab["pages"]), ab["totalStars"]))
        check("every rank reward resolves",
              all(x["id"] in by_id for r in ab["ranks"] for x in r["rewards"]), True)
        check("every star reward resolves",
              all(x["id"] in by_id for b in ab["bands"]
                  for key in ("hunt", "huntLarge", "card") for x in b[key]), True)
        check("boss log counts add up", bl["mvpCount"] + bl["bossCount"], len(bl["entries"]))
        check("every boss log entry is a real monster",
              all(e["code"] in mons_by_code for e in bl["entries"]), True)
        check("boss log rewards resolve",
              bl["clearReward"] in by_id and bl["crownedHat"] in by_id, True)

    print()
    if failures:
        print(f"{len(failures)} problem(s):")
        for f in failures:
            print("  -", f)
    else:
        print("web/data matches the server's data files")
    return len(failures)


if __name__ == "__main__":
    sys.exit(main())
