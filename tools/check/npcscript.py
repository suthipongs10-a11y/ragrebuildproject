#!/usr/bin/env python3
"""Whether the npc scripts still hold together, without starting the server to find out.

Run from the repo root:  python3 tools/check/npcscript.py

The scripts under ServerData/Script are a language of their own, compiled to C# at
startup by ScriptTreeWalker. Nothing here type checks them and the build does not touch
them, so the first sign of a broken one is the server refusing to load - or worse, an npc
that talks right up to the line that is wrong and then stops mid conversation.

Four things, chosen because each of them is a mistake that is easy to make while editing
and impossible to see while reading:

  braces and parens   a macro that swallowed its own closing brace takes everything
                      after it with it, and the error names a line a long way away
  missing macros      @Something() with no `macro Something()` anywhere. The compiler
                      says so, but only once it gets that far into the file
  option counts       Option() takes at most ten; NpcInteractionState truncates the rest
                      and logs a warning nobody is reading
  menu bounds         a `while(result < n)` around an Option() where n is not the index
                      of the last entry. Add an entry to a menu and forget the bound and
                      the menu starts closing itself on the entries past it, which reads
                      as "that button does nothing"
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRIPTS = os.path.join(ROOT, "RoRebuildServer", "GameConfig", "ServerData", "Script")

MAX_OPTIONS = 10  # NpcInteractionState.Option

MACRO_DEF = re.compile(r"^\s*macro\s+(\w+)\s*\(", re.M)
MACRO_CALL = re.compile(r"@(\w+)\s*\(")
OPTION = re.compile(r"\bOption\s*\((.*?)\)\s*;", re.S)
MENU_LOOP = re.compile(r"while\s*\(\s*result\s*<\s*(\d+)\s*\)\s*\{(.*?)\n\t*\}", re.S)


def strip(source):
    """The source with strings and comments blanked, so counting is counting code."""
    source = re.sub(r'"(?:\\.|[^"\\])*"', '""', source)
    source = re.sub(r"//[^\n]*", "", source)
    return re.sub(r"/\*.*?\*/", "", source, flags=re.S)


def script_files():
    found = []
    for folder, _, files in os.walk(SCRIPTS):
        for name in sorted(files):
            if name.endswith(".txt"):
                found.append(os.path.join(folder, name))
    return sorted(found)


def read(path):
    with open(path, encoding="utf-8-sig") as handle:
        return handle.read()


def count_options(text):
    """How many entries an Option() call has, read off its string literals."""
    return text.count('"') // 2


def main():
    files = script_files()
    if not files:
        print(f"no scripts found under {SCRIPTS}")
        return 1

    sources = {path: read(path) for path in files}

    macros = set()
    for source in sources.values():
        macros.update(match.group(1) for match in MACRO_DEF.finditer(source))

    problems = []

    for path, source in sources.items():
        name = os.path.relpath(path, SCRIPTS).replace(os.sep, "/")
        code = strip(source)

        braces = code.count("{") - code.count("}")
        parens = code.count("(") - code.count(")")
        if braces:
            problems.append(f"{name}: {abs(braces)} unclosed {{ }}" if braces > 0
                            else f"{name}: {abs(braces)} extra }}")
        if parens:
            problems.append(f"{name}: {abs(parens)} unclosed ( )" if parens > 0
                            else f"{name}: {abs(parens)} extra )")

        for match in MACRO_CALL.finditer(code):
            if match.group(1) not in macros:
                line = code[:match.start()].count("\n") + 1
                problems.append(f"{name}:{line}: calls @{match.group(1)}() but no macro of that name exists")

        for match in OPTION.finditer(source):
            count = count_options(match.group(1))
            if count > MAX_OPTIONS:
                line = source[:match.start()].count("\n") + 1
                problems.append(f"{name}:{line}: Option() with {count} entries, "
                                f"and only the first {MAX_OPTIONS} can be picked")

        #the loop guard against the menu it is wrapped around. The last entry is the way
        #out, so the loop should run while the answer is anything before it.
        for match in MENU_LOOP.finditer(source):
            bound = int(match.group(1))
            inner = OPTION.search(match.group(2))
            if inner is None:
                continue

            count = count_options(inner.group(1))
            if count and bound != count - 1:
                line = source[:match.start()].count("\n") + 1
                problems.append(f"{name}:{line}: menu of {count} entries looped with "
                                f"while(result < {bound}) - entries {bound} to {count - 2} "
                                f"close the conversation instead of returning to it")

    if problems:
        print()
        for problem in problems:
            print(f"  !  {problem}")
        print(f"\n{len(problems)} problem(s) in {len(files)} script file(s).")
        return 1

    print(f"checked {len(files)} script file(s) and {len(macros)} macro(s)\n")
    print("every npc script closes what it opens and calls only macros that exist")
    return 0


if __name__ == "__main__":
    sys.exit(main())
