#!/usr/bin/env python3
"""
Structs that get stack allocated cannot hold a reference.

`Span<T> x = stackalloc T[n]` compiles only when T is an unmanaged type: every field,
all the way down, has to be a value type. Add one string to such a struct and the build
stops with CS0208 pointing at the stackalloc, not at the field that caused it - which is
a long way from where the mistake was made.

There is no compiler in this environment, so this walks the same ground by hand: find
every stackalloc of a repo struct, then look for a reference-typed field in it.

    python3 tools/check/unmanaged.py
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

#Types the runtime supplies that are values, so a field of one of these is fine.
VALUE_TYPES = {
    "bool", "byte", "sbyte", "char", "short", "ushort", "int", "uint", "long", "ulong",
    "float", "double", "decimal", "nint", "nuint", "Guid", "DateTime", "TimeSpan",
}

COMMENT = re.compile(r"//.*?$|/\*.*?\*/", re.S | re.M)
STACKALLOC = re.compile(r"\bstackalloc\s+([A-Za-z_]\w*)\s*\[")
FIELD = re.compile(r"^\s*public\s+(?:readonly\s+)?([A-Za-z_][\w<>,\[\]\?\. ]*?)\s+([A-Za-z_]\w*)\s*(?:=|;)", re.M)


def read(path):
    with open(path, encoding="utf-8-sig") as f:
        return f.read()


def cs_files():
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in ("bin", "obj", "Library", "Temp", ".git")]
        for f in files:
            if f.endswith(".cs"):
                yield os.path.join(base, f)


def main():
    sources = {p: COMMENT.sub("", read(p)) for p in cs_files()}

    #What the repo declares, so a field type can be sorted into value or reference.
    structs, refs = {}, set()
    for path, text in sources.items():
        for kind, name in re.findall(r"\b(?:public|internal|private)?\s*(?:readonly\s+|partial\s+|abstract\s+|sealed\s+|static\s+)*\b(struct|class|record|interface|enum)\s+([A-Za-z_]\w*)", text):
            if kind == "struct":
                structs.setdefault(name, (path, text))
            elif kind == "enum":
                VALUE_TYPES.add(name)
            else:
                refs.add(name)

    wanted = {}
    for path, text in sources.items():
        for name in STACKALLOC.findall(text):
            wanted.setdefault(name, []).append(os.path.relpath(path, ROOT))

    problems = []
    for name, sites in sorted(wanted.items()):
        if name not in structs:
            continue  #a framework type, or a generic parameter - not ours to check
        path, text = structs[name]
        body = text[text.index(f"struct {name}"):]
        for ftype, fname in FIELD.findall(body[:body.find("\n}")]):
            ftype = ftype.strip()
            bare = ftype.rstrip("?").split("<")[0].split(".")[-1]
            if ftype.endswith("[]") or bare == "string" or bare == "object" or bare in refs:
                problems.append((name, ftype, fname, os.path.relpath(path, ROOT), sites))

    print(f"checked {len(wanted)} stack allocated type(s) across {len(sources)} file(s)\n")

    if not problems:
        for name, sites in sorted(wanted.items()):
            mark = "repo struct" if name in structs else "not a repo struct, skipped"
            print(f"  {name:<24} {mark}")
        print("\nnothing stack allocated is holding a reference")
        return 0

    for name, ftype, fname, decl, sites in problems:
        print(f"  {decl}: {name}.{fname} is a {ftype}, which is a reference")
        for s in sites:
            print(f"      stack allocated in {s}")
    print("\nCS0208 waiting to happen: store an id and look the object up instead.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
