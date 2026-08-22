#!/usr/bin/env python3
"""What is missing behind the twelve job trees.

A skill on a tree is data. Whether anything happens when you use it is code, and nothing
checks that the two agree - a skill can cost points, show an icon, sit in the hotbar and
do nothing at all. Same for its description: the tooltip is a file, and a skill with no
entry in it shows a blank.

So this reports two different holes, which need two different fixes:

  no code        - the skill is on a tree and nothing anywhere reads it. Learning it is
                   throwing points away.
  no description - the skill works, but the tooltip has nothing to say about it.

"No handler" alone is not the test. Half the passives never get one: Beast Bane is read
in the damage code, Discount in the shop code, Basic Mastery in six different packet
handlers. What matters is whether the skill's name appears in the server at all.

Nor is "named in the server project" the whole test any more. The forging skills are
driven by a table: what they make is a row of ProduceRecipes.csv, and the only code that
names them is the shared list of which skills open the forge. A skill with a recipe is a
skill that does something, so a recipe counts the same as a mention.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "RoRebuildServer/GameConfig/ServerData/Skills"
SERVER = ROOT / "RoRebuildServer/RoRebuildServer"
SHARED = ROOT / "RoRebuildServer/RebuildSharedData"
RECIPES = ROOT / "RoRebuildServer/GameConfig/ServerData/Db/ProduceRecipes.csv"

ORDER = ["Novice", "Swordsman", "Archer", "Mage", "Acolyte", "Thief", "Merchant",
         "Knight", "Wizard", "Priest", "Hunter", "Assassin", "Blacksmith"]


def trees():
    """Each job and the skills on its tree, in the order the file lists them."""
    jobs = {}
    current = None
    for line in (DATA / "SkillTree.toml").read_text(encoding="utf-8-sig").split("\n"):
        head = re.match(r"^\[(\w+)\.SkillTree\]", line)
        if head:
            current = head.group(1)
            jobs[current] = []
            continue
        if line.startswith("["):
            current = None
            continue
        named = re.match(r"^\s*(\w+)\s*=", line)
        if current and named:
            jobs[current].append(named.group(1))
    return jobs


def mentioned():
    """Every skill something reads - named in code, or carrying a recipe."""
    seen = set()
    for root in (SERVER, SHARED):
        for path in root.rglob("*.cs"):
            for m in re.finditer(r"CharacterSkill\.(\w+)", path.read_text(encoding="utf-8-sig")):
                seen.add(m.group(1))

    if RECIPES.exists():
        rows = RECIPES.read_text(encoding="utf-8-sig").splitlines()
        header = rows[0].split(",")
        column = header.index("Skill")
        for row in rows[1:]:
            fields = row.split(",")
            if len(fields) > column and fields[column]:
                seen.add(fields[column])

    return seen


def described():
    return set(re.findall(r"^::(\w+)",
                          (DATA / "SkillDescriptions.txt").read_text(encoding="utf-8-sig"),
                          re.M))


def main():
    jobs, live, docs = trees(), mentioned(), described()

    dead_total = blank_total = skills_total = 0
    for job in ORDER:
        if job not in jobs:
            continue
        skills = jobs[job]
        dead = [s for s in skills if s not in live]
        blank = [s for s in skills if s not in docs]
        skills_total += len(skills)
        dead_total += len(dead)
        blank_total += len(blank)

        mark = "!!" if dead else ("? " if blank else "OK")
        print("%s %-11s %2d skills" % (mark, job, len(skills)), end="")
        print(", %d with no code" % len(dead) if dead else ", all have code", end="")
        print(", %d with no description" % len(blank) if blank else ", all described")
        for s in dead:
            print("      no code:        %s" % s)
        for s in blank:
            if s not in dead:
                print("      no description: %s" % s)

    #A skill with a working handler that no tree offers is work nobody can reach.
    #Only the job folders count: what is under Monster/ and Other/ is what monsters cast
    #at you, and belongs on no player's tree by design.
    on_a_tree = set().union(*jobs.values())
    handlers = set()
    for path in (SERVER / "Simulation/Skills/SkillHandlers").rglob("*.cs"):
        if "Monster" in path.parts or "Other" in path.parts:
            continue
        for m in re.finditer(r"\[SkillHandler\(CharacterSkill\.(\w+)",
                             path.read_text(encoding="utf-8-sig")):
            handlers.add(m.group(1))
    stranded = sorted(s for s in handlers if s not in on_a_tree and s != "None")
    if stranded:
        print()
        print("written and working, but on nobody's tree so nobody can learn it:")
        for s in stranded:
            print("      %s" % s)

    print()
    print("%d skills across the twelve trees: %d with no code, %d with no description"
          % (skills_total, dead_total, blank_total))
    return 1 if dead_total else 0


if __name__ == "__main__":
    sys.exit(main())
