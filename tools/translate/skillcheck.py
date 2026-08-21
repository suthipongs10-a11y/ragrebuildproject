#!/usr/bin/env python3
"""Checks a translated skill description file against the English it came from.

The formulas are the reason this exists. Nothing evaluates them - the window prints the
description as it is - so a [SkillLevel * 30] that came out as [SkillLevel * 3] is a
tooltip telling a player the wrong number, and nothing anywhere would complain.

  python3 skillcheck.py <english> <thai>
"""
import io
import re
import sys

FORMULA = re.compile(r"\[[^\]]*\]")
TAG = re.compile(r"</?[a-zA-Z][^>]*>")


def read(p):
    return io.open(p, encoding="utf-8-sig").read().split("\n")


def main(before, after):
    a, b = read(before), read(after)
    problems = []

    if len(a) != len(b):
        print("FAIL\n  - line count changed: %d -> %d" % (len(a), len(b)))
        return 1

    heads_a = [l for l in a if l.startswith("::")]
    heads_b = [l for l in b if l.startswith("::")]
    if heads_a != heads_b:
        problems.append("the ::entry headers are not the same list")
    else:
        print("  all %d entries still here, in the same order" % len(heads_a))

    bad = 0
    for n, (x, y) in enumerate(zip(a, b), 1):
        if FORMULA.findall(x) != FORMULA.findall(y):
            bad += 1
            if bad <= 5:
                problems.append("line %d: a formula changed\n      %s\n      %s" % (n, x, y))
    if bad:
        problems.append("%d line(s) had a formula changed" % bad)
    else:
        print("  all %d formulas came through character for character"
              % sum(len(FORMULA.findall(l)) for l in a))

    bad = 0
    for n, (x, y) in enumerate(zip(a, b), 1):
        if TAG.findall(x) != TAG.findall(y):
            bad += 1
            if bad <= 5:
                problems.append("line %d: the markup changed\n      %s\n      %s" % (n, x, y))
    if bad:
        problems.append("%d line(s) had their markup changed" % bad)
    else:
        print("  every tag came through unchanged")

    blank_a = [n for n, l in enumerate(a) if not l.strip()]
    blank_b = [n for n, l in enumerate(b) if not l.strip()]
    if blank_a != blank_b:
        problems.append("the blank lines moved, so entries would run together")
    else:
        print("  the blank lines that separate entries are where they were")

    print()
    if problems:
        print("FAIL")
        for p in problems:
            print("  -", p)
        return 1
    print("the translated file is the same file, in Thai")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
