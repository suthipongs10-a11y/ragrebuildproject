#!/usr/bin/env python3
"""Finds framework-qualified names that a repo namespace of the same name steals.

C# resolves the first segment of `A.B.C` by walking outward from the file's own namespace
and stopping at the first thing called A. The framework namespaces - System, UnityEngine
and the rest - live at the outermost scope, so ANY repo namespace of the same name, at any
depth on the way out, wins over them.

This repo has a namespace literally called System (Assets.Scripts.Network.
IncomingPacketHandlers.System, the folder of system packet handlers). A file in a sibling
folder that writes `System.Guid` therefore does not get System.Guid. It gets the handler
namespace, finds no Guid in it, and fails with an error naming a namespace nobody typed.

Only framework roots are checked, because only those are unambiguous: a repo-qualified name
like `Network.EntityList` may be resolving relative to an enclosing namespace on purpose,
and telling those apart needs a compiler. Using directives above the namespace declaration
are skipped - they resolve globally and are always fine.

The fix is always the same: import the namespace and drop the qualifier.
"""
import re
import sys
from pathlib import Path

ROOT = Path("/home/user/ragrebuildproject")
ROOTS = [ROOT / "RoRebuildServer", ROOT / "RebuildClient/Assets/Scripts"]

#the roots that can only ever mean the framework
EXTERNAL = {"System", "UnityEngine", "UnityEditor", "TMPro", "MemoryPack", "Microsoft",
            "Newtonsoft", "CsvHelper", "Tomlyn", "K4os"}

NS = re.compile(r"^\s*namespace\s+([\w.]+)", re.M)
QUALIFIED = re.compile(r"(?<![\w.])([A-Z]\w*)\.([A-Z]\w*)")

files = []
declared = set()
for root in ROOTS:
    for path in root.rglob("*.cs"):
        if any(p in path.parts for p in ("bin", "obj", "Library", "Temp")):
            continue
        text = path.read_text(encoding="utf-8-sig", errors="replace")
        found = NS.search(text)
        files.append((path, found, text))
        if found:
            declared.add(found.group(1))

#every namespace, including the intermediate ones nobody declares outright
allns = set()
for ns in declared:
    parts = ns.split(".")
    for i in range(1, len(parts) + 1):
        allns.add(".".join(parts[:i]))

#which framework roots this repo shadows, and where
shadows = {}
for ns in allns:
    tail = ns.rsplit(".", 1)[-1]
    if tail in EXTERNAL and "." in ns:
        shadows.setdefault(tail, set()).add(ns)

problems = []
for path, found, text in files:
    if not found:
        continue

    ns = found.group(1)
    parts = ns.split(".")
    #the scopes searched, nearest first; global is last and is where the real one lives
    scopes = [".".join(parts[:i]) for i in range(len(parts), 0, -1)]

    #a using above the namespace resolves globally, so only look after it
    body = text[found.end():]
    offset = found.end()

    for m in QUALIFIED.finditer(body):
        head = m.group(1)
        if head not in shadows:
            continue

        for scope in scopes:
            candidate = f"{scope}.{head}"
            if candidate not in allns:
                continue
            if ns == candidate or ns.startswith(candidate + "."):
                break

            line = text[:offset + m.start()].count("\n") + 1
            problems.append(
                f"{path.relative_to(ROOT)}:{line}: `{m.group(0)}` - `{head}` resolves to "
                f"{candidate}, not the framework {head}. Import it and drop the qualifier.")
            break

if problems:
    print("\n".join(problems))
    print()
    print(f"{len(problems)} shadowed qualifier(s)")
    sys.exit(1)

print(f"checked {len(files)} file(s); this repo shadows: "
      + ", ".join(sorted(shadows)) if shadows else "checked, nothing shadowed")
print()
print("no framework name is stolen by a repo namespace")
