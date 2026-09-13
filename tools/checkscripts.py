"""Checks a translated npc script against the version git has, before it reaches the server.

    python tools/checkscripts.py

A script that will not compile stops the server from starting at all, and the message it
gives says which file and nothing about which line. Everything here is a thing that has to
stay true through a translation, checked against HEAD rather than against a guess:

  - the same number of Dialog/Option/Say/Message calls, so none was lost or doubled
  - the same number of arguments in every Option call, because the code below one reads the
    answer by index - a menu one item shorter sends people somewhere else entirely
  - balanced braces and an even number of quotes on every line that changed
  - the Npc(...) declaration untouched, since the name in it becomes a C# class name and a
    Thai one compiles to nothing
  - MoveTo, SignalNpc, SendGlobalSignal and `Signal ==` arguments untouched, because those
    are machine names that have to match each other and are not dialogue
"""

import re
import subprocess
import sys

CALLS = ("Dialog(", "Option(", "Say(", "ServerWideMessage(", "Message(")

#Things whose arguments are data rather than speech. A translation that reaches inside one of
#these breaks something that will not say it is broken.
FROZEN = re.compile(
    r'(?:MoveTo|SignalNpc|SendGlobalSignal|RegisterGlobalSignal|SellItem|CreateTradedItem'
    r'|AddItemToTradeSet|GetItemCount|TakeItem|GetGlobalString|SetGlobalString'
    r'|Requires|Costs)\s*\([^)]*\)')
SIGNAL_CMP = re.compile(r'Signal\s*==\s*"([^"]*)"')
NPC_DECL = re.compile(r'^\s*Npc\(.*$', re.M)


def head(path):
    try:
        return subprocess.run(["git", "show", f"HEAD:{path}"], capture_output=True,
                              text=True, check=True).stdout
    except subprocess.CalledProcessError:
        return None


def option_arity(text):
    """How many arguments each Option call was given, in file order."""
    out = []
    for m in re.finditer(r'Option\(', text):
        i, depth, args, instr, esc = m.end(), 1, 1, False, False
        while i < len(text) and depth:
            c = text[i]
            if instr:
                if esc: esc = False
                elif c == '\\': esc = True
                elif c == '"': instr = False
            elif c == '"': instr = True
            elif c == '(': depth += 1
            elif c == ')': depth -= 1
            elif c == ',' and depth == 1: args += 1
            i += 1
        out.append(args)
    return out


def check(path):
    before, problems = head(path), []
    if before is None:
        return ["is not in git, so there is nothing to compare it against"]

    with open(path, encoding="utf-8") as f:
        after = f.read()

    if before == after:
        return []

    for call in CALLS:
        b, a = before.count(call), after.count(call)
        if b != a:
            problems.append(f"{call} went from {b} to {a}")

    ab, aa = option_arity(before), option_arity(after)
    if ab != aa:
        problems.append(f"Option argument counts changed: {ab} -> {aa}")

    for ch in "{}":
        if before.count(ch) != after.count(ch):
            problems.append(f"'{ch}' went from {before.count(ch)} to {after.count(ch)}")

    for i, line in enumerate(after.split("\n"), 1):
        if line.count('"') % 2:
            problems.append(f"line {i} has an odd number of quotes: {line.strip()[:70]}")

    if NPC_DECL.findall(before) != NPC_DECL.findall(after):
        problems.append("an Npc(...) declaration changed - the name there becomes a class name")

    for name, pattern in (("frozen data call", FROZEN), ("Signal comparison", SIGNAL_CMP)):
        b, a = pattern.findall(before), pattern.findall(after)
        if b != a:
            for x in set(b) ^ set(a):
                problems.append(f"{name} changed: {x}")

    return problems


def main():
    changed = subprocess.run(["git", "diff", "--name-only", "--", "RoRebuildServer/GameConfig/ServerData/Script"],
                             capture_output=True, text=True).stdout.split()
    changed = [p for p in changed if p.endswith(".txt")]

    if not changed:
        print("No script file has been changed.")
        return 0

    bad = 0
    for path in sorted(changed):
        problems = check(path)
        if problems:
            bad += 1
            print(f"\n{path}")
            for p in problems:
                print(f"    {p}")
        else:
            print(f"ok  {path}")

    print(f"\n{len(changed)} changed, {bad} with something to look at.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
