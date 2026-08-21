#!/usr/bin/env python3
"""Checks a translated description file against the English it came from.

The translation is mechanical, so what can go wrong is mechanical too: an entry lost, a
line count that no longer matches, a colour span left half open, or an item name turned
into Thai and its link with it. None of those show up as an error anywhere - the exporter
would take a broken span and the client would draw the raw text - so they are checked
here rather than found in a screenshot.

  python3 thaicheck.py <english> <thai>
"""
import io
import re
import sys

TAG = re.compile(r"</?[a-zA-Z][^>]*>")
LINK = re.compile(r"<color=#008080>(.*?)</color>", re.I)
SKILL = re.compile(r"<color=#0000FF>(.*?)</color>|<skill>(.*?)</skill>", re.I)


def read(p):
    return io.open(p, encoding="utf-8-sig").read().split("\n")


def main(before, after):
    a, b = read(before), read(after)
    problems = []

    if len(a) != len(b):
        problems.append("line count changed: %d -> %d" % (len(a), len(b)))
        print("FAIL")
        print("  -", problems[0])
        return 1

    heads_a = [l for l in a if l.startswith("::")]
    heads_b = [l for l in b if l.startswith("::")]
    if heads_a != heads_b:
        problems.append("the ::entry headers are not the same list")
    else:
        print("  all %d entries still here, in the same order" % len(heads_a))

    #every tag, in order, must be the tag that was there before: the translation may
    #change what is between them and nothing else
    bad = 0
    for n, (x, y) in enumerate(zip(a, b), 1):
        if TAG.findall(x) != TAG.findall(y):
            bad += 1
            if bad <= 5:
                problems.append("line %d: the markup changed\n      %s\n      %s" % (n, x, y))
    if bad:
        problems.append("%d line(s) had their markup changed" % bad)
    else:
        print("  every colour span and tag came through unchanged")

    #item links are matched by their English name at export time, so a translated one
    #is a link that silently stops working
    links_a = [m for l in a for m in LINK.findall(l)]
    links_b = [m for l in b for m in LINK.findall(l)]
    if links_a != links_b:
        changed = [(x, y) for x, y in zip(links_a, links_b) if x != y][:5]
        problems.append("item link names changed, which kills the link: %s" % changed)
    else:
        print("  all %d item link names left in English" % len(links_a))

    #An arrow's element is written in the skill colour, and that one is a word rather
    #than a name - it is meant to come out in Thai. Everything else in that colour is a
    #skill and has to survive untouched.
    elements = {"Neutral", "Water", "Earth", "Fire", "Wind", "Poison", "Holy",
                "Shadow", "Dark", "Ghost", "Undead"}
    skills_a = [m for l in a for m in SKILL.findall(l)]
    skills_b = [m for l in b for m in SKILL.findall(l)]
    changed = [(x, y) for x, y in zip(skills_a, skills_b)
               if x != y and "".join(x).strip() not in elements]
    if len(skills_a) != len(skills_b) or changed:
        problems.append("skill names changed: %s" % changed[:5])
    else:
        print("  all %d skill names left in English" % len(skills_a))

    #A couple of descriptions run across two lines, so a line on its own is allowed to
    #be unbalanced - what may not change is whether it is.
    for n, (x, y) in enumerate(zip(a, b), 1):
        before = x.count("<color=") - x.lower().count("</color>")
        after = y.count("<color=") - y.lower().count("</color>")
        if before != after:
            problems.append("line %d closed its colour spans differently: %s" % (n, y))

    blank_a = [n for n, l in enumerate(a) if not l.strip()]
    blank_b = [n for n, l in enumerate(b) if not l.strip()]
    if blank_a != blank_b:
        problems.append("the blank lines moved, so entries would run together")
    else:
        print("  the blank lines that separate entries are where they were")

    left = 0
    for y in b:
        if y.startswith("::") or y.startswith("//"):
            continue
        bare = TAG.sub(" ", SKILL.sub(" ", LINK.sub(" ", y)))
        if re.search(r"[A-Za-z]{3,}", bare):
            left += 1
    print("  %d line(s) still carry a word of English outside a link or a skill name"
          % left)

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
