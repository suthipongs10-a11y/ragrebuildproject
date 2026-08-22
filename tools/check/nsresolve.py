#!/usr/bin/env python3
"""Checks that every repo type a file names is actually reachable from that file.

This is the mistake that keeps happening, three times now and each time it costs a build:
a type is assumed to be in the namespace its folder is named after. OutboundMessage sits
in Networking/ and is in RebuildZoneServer.Networking. GuildEmblems sits under UI/Guild/
and importing Assets.Scripts.UI does not reach it, because a using imports the types in a
namespace and not the namespaces under it.

None of that fails at a glance and all of it fails at the compiler, so this walks the
declarations, works out where each type actually lives, and checks the file can see it.
"""
import re
import sys
from pathlib import Path

ROOT = Path("/home/user/ragrebuildproject")
ROOTS = [ROOT / "RoRebuildServer", ROOT / "RebuildClient/Assets/Scripts"]

DECL = re.compile(r"^\s*(?:\[[^\]]*\]\s*)*(?:public|internal|private|protected|static|"
                  r"sealed|abstract|partial|unsafe|readonly|record|\s)*"
                  r"\b(?:class|struct|interface|enum|record)\s+(\w+)", re.M)
NS = re.compile(r"^\s*namespace\s+([\w.]+)", re.M)

#Names this repo declares that Unity or the framework also declares. There is no way to
#tell from the source which one is meant, and the framework one is almost always what a
#file that imports neither is reaching for, so these are left alone rather than reported
#every run until somebody stops reading the output.
FRAMEWORK_CLASH = {"SelectionMode"}


def clean(src):
    """A byte order mark is not whitespace to this regex engine, and one has a habit of
    turning up part way down a file after an edit - which hides the using on that line."""
    return src.replace("\ufeff", "")


def strip_code(src):
    """Comments and string bodies out, so a type named in prose is not a reference."""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            i += 2
            while i + 1 < n and not (src[i] == "*" and src[i + 1] == "/"):
                i += 1
            i += 2
            continue
        if c == '"':
            i += 1
            while i < n and src[i] != '"':
                i += 2 if src[i] == "\\" else 1
            i += 1
            out.append(' ')
            continue
        out.append(c)
        i += 1
    return "".join(out)


# --- where every type in the repo is declared --------------------------------
declared = {}
for root in ROOTS:
    for f in root.rglob("*.cs"):
        if "/obj/" in f.as_posix() or "/bin/" in f.as_posix():
            continue
        src = clean(f.read_text(encoding="utf-8-sig", errors="ignore"))
        ns = NS.search(src)
        if not ns:
            continue
        for name in DECL.findall(strip_code(src)):
            declared.setdefault(name, set()).add(ns.group(1))

targets = sys.argv[1:]
if not targets:
    print("usage: nsresolve.py <file.cs> ...")
    sys.exit(2)

problems = []
checked = 0
for path in targets:
    f = Path(path)
    if not f.is_absolute():
        f = ROOT / path
    src = clean(f.read_text(encoding="utf-8-sig", errors="ignore"))
    ns_match = NS.search(src)
    if not ns_match:
        continue
    own = ns_match.group(1)
    usings = set(re.findall(r"^\s*using\s+(?:static\s+)?([\w.]+)\s*;", src, re.M))
    aliases = set(re.findall(r"^\s*using\s+(\w+)\s*=", src, re.M))

    #a type is reachable from its own namespace and from every namespace enclosing it
    reachable = set(usings)
    parts = own.split(".")
    prefixes = [".".join(parts[:i + 1]) for i in range(len(parts))]
    reachable.update(prefixes)

    #a using is allowed to be written relative to the namespaces the file is inside, so
    #"using EntityComponents;" inside RoRebuildServer.Data.Monster means RoRebuildServer.
    #EntityComponents. Both readings are accepted, the same way the compiler does.
    for u in list(usings):
        for prefix in prefixes:
            reachable.add(prefix + "." + u)

    code = strip_code(src)
    #types declared in this very file need no import at all
    local = set(DECL.findall(code))

    #a field or property whose name happens to match a type elsewhere is not a reference
    #to that type - Player has a CartInventory field and the repo has a CartInventory row
    local |= set(re.findall(r"(?:public|private|internal|protected)\s+(?:static\s+|readonly\s+|"
                            r"const\s+)*[\w?<>,\[\] ]+?\s(\w+)\s*[;={]", code))

    refs = set()
    refs |= set(re.findall(r"\bnew\s+([A-Z]\w*)\s*[({<]", code))
    refs |= set(re.findall(r"[(,]\s*([A-Z]\w*)\??\s+\w+\s*[,)=]", code))   #parameters
    refs |= set(re.findall(r"(?<![.\w])([A-Z]\w*)\.[A-Z_]\w*", code))       #static access
    refs |= set(re.findall(r"<\s*([A-Z]\w*)\s*[,>]", code))                #generic args
    refs |= set(re.findall(r"\bis\s+([A-Z]\w*)\b", code))
    refs |= set(re.findall(r"\bnew\s+List<([A-Z]\w*)>", code))

    for name in sorted(refs):
        if name in local or name in aliases or name in FRAMEWORK_CLASH:
            continue
        homes = declared.get(name)
        if not homes:
            continue  #not a repo type: framework, or a member that happens to be capitalised

        #the two halves are separate compilations: a server file cannot see a client type
        #and has no business being told about one
        side = "client" if "RebuildClient" in f.as_posix() else "server"
        homes = {h for h in homes if (h.startswith("Assets.")) == (side == "client")}
        if not homes:
            continue
        if any(h in reachable for h in homes):
            continue
        #a fully qualified use in the source is fine even with no using for it
        if re.search(r"[\w.]+\." + re.escape(name) + r"\b", code):
            qualified = re.findall(r"([\w.]+)\." + re.escape(name) + r"\b", code)
            if any(any(h.endswith(q) or q.endswith(h) for h in homes) for q in qualified):
                continue
        problems.append(f"{f.name}: {name} is in {sorted(homes)}, which this file does not import")
    checked += 1

print(f"checked {checked} file(s) against {len(declared)} declared types")
print()
if problems:
    print("FAIL")
    for p in problems:
        print("  -", p)
    sys.exit(1)
print("every repo type named is reachable from the file that names it")
