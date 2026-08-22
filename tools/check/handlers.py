#!/usr/bin/env python3
"""Checks the client's packet dispatch table against the packet list and the handlers.

The table is generated from inside Unity by a menu item. Nothing runs it automatically, so
a handler written outside the editor is a handler nothing dispatches to - and the failure
is silent in the worst way: the packet arrives, finds no handler, and the window that was
waiting for it simply waits. That is what "loading..." forever turns out to mean.
"""
import re
import sys
from pathlib import Path

ROOT = Path("/home/user/ragrebuildproject")
ENUM = ROOT / "RoRebuildServer/RebuildSharedData/Networking/PacketType.cs"
CLIENT = ROOT / "RebuildClient/Assets/Scripts"
TABLE = CLIENT / "Network/PacketBase/ClientPacketHandlerGenerated.cs"
DISPATCH = CLIENT / "Network/PacketBase/ClientPacketHandler.cs"

problems = []

src = ENUM.read_text(encoding="utf-8-sig")
i = src.index("enum PacketType")
j = src.index("{", i)
depth = 0
for k in range(j, len(src)):
    if src[k] == "{":
        depth += 1
    elif src[k] == "}":
        depth -= 1
        if depth == 0:
            break
block = re.sub(r"/\*.*?\*/", "", re.sub(r"//[^\n]*", "", src[j + 1:k]), flags=re.S)
names = [re.sub(r"\[[^\]]*\]", "", t).strip() for t in block.split(",") if t.strip()]
names = [n for n in names if n]

table = TABLE.read_text(encoding="utf-8-sig")
size = re.search(r"new ClientPacketHandlerBase\[(\d+)\]", table)
if not size:
    print("FAIL the generated table has no array to check")
    sys.exit(1)

if int(size.group(1)) != len(names):
    problems.append(f"the table holds {size.group(1)} slots for {len(names)} packet types - "
                    f"run Ragnarok > CodeGen > Update Packet Handlers")
else:
    print(f"  the table has one slot per packet type ({len(names)})")

slots = {int(n): (cls, name) for n, cls, name in
         re.findall(r"handlers\[(\d+)\] = new (\w+)\(\); //(\w+)", table)}

#every slot is the packet the enum says it is, in order
misplaced = [i for i, n in enumerate(names) if i in slots and slots[i][1] != n]
if misplaced:
    first = misplaced[0]
    problems.append(f"slot {first} is labelled {slots[first][1]} but the enum has {names[first]} "
                    f"there - the table was generated against a different packet list")
else:
    print("  every slot lines up with the packet list")

# --- every handler in the client is in the table ------------------------------
found = {}
for f in CLIENT.rglob("*.cs"):
    text = f.read_text(encoding="utf-8-sig", errors="ignore")
    m = re.search(r"\[ClientPacketHandler\(PacketType\.(\w+)\)\]\s*\n\s*public class (\w+)", text)
    if not m:
        continue
    ns = re.search(r"^\s*namespace\s+([\w.]+)", text, re.M)
    found[m.group(1)] = (m.group(2), ns.group(1) if ns else "")

for packet, (cls, ns) in sorted(found.items()):
    if packet not in names:
        problems.append(f"{cls} handles PacketType.{packet}, which the enum does not have")
        continue

    idx = names.index(packet)
    if idx not in slots or slots[idx][0] != cls:
        got = slots.get(idx, ("nothing", ""))[0]
        problems.append(f"{packet} is handled by {cls}, but the table has {got} in slot {idx} "
                        f"- the packet would arrive and be dropped without a word")
        continue

    if ns and f"using {ns};" not in table:
        problems.append(f"the table names {cls} without importing {ns}, so it would not compile")

if not [p for p in problems if "dropped without a word" in p or "would not compile" in p
        or "does not have" in p]:
    print(f"  all {len(found)} handlers are wired to their slot")

# --- and the guard in front of it -------------------------------------------
guard = DISPATCH.read_text(encoding="utf-8-sig")
if "(int)type <= handlers.Length" in guard:
    problems.append("the dispatch guard uses <= against the array length, so the packet one "
                    "past the end throws inside the receive loop instead of being ignored")
elif "(int)type < handlers.Length" not in guard:
    problems.append("the dispatch guard no longer bounds the packet number against the table")
else:
    print("  the dispatch guard bounds the packet number against the table")

print()
if problems:
    print("FAIL")
    for p in problems:
        print("  -", p)
    sys.exit(1)
print("every packet the client answers has somewhere to go")
