#!/usr/bin/env python3
"""Turns the skill and status descriptions into Thai, line by line.

These files are not templates the way the card lines are - each line is a sentence
somebody wrote about one skill - so there is no phrase table here, only skills.tsv:
one English line, one Thai line.

Two things in them must survive untouched:

  - the [bracketed formulas]. Nothing evaluates them; the skill window prints the
    description verbatim, formula and all, and the player reads "[SkillLevel * 30]" and
    works it out. Change one and the number a player is told is simply wrong.
  - the markup: <br>, <color=...>, <element>, <item> and their closers.

A line with no Thai written for it is reported rather than left in English, because a
tooltip that is half Thai and half English is worse than either.

  python3 thaiskills.py <file>            say what is missing
  python3 thaiskills.py <file> --apply    write it
  python3 thaiskills.py <file> --dump     list the lines with no Thai
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TABLE = os.path.join(HERE, "skills.tsv")

LINES = {}
if os.path.exists(TABLE):
    for row in io.open(TABLE, encoding="utf-8"):
        row = row.rstrip("\n")
        if not row or row.startswith("#") or "\t" not in row:
            continue
        en, th = row.split("\t", 1)
        if th.strip():
            LINES[en] = th

WORD = re.compile(r"[A-Za-z]{2,}")
FORMULA = re.compile(r"\[[^\]]*\]")
TAG = re.compile(r"</?[a-zA-Z][^>]*>")

missing = []


def translate(line):
    body = line.rstrip("\r")
    if body in LINES:
        return LINES[body]
    if WORD.search(TAG.sub(" ", FORMULA.sub(" ", body))):
        missing.append(body)
    return body


def main(path, apply_it, dump):
    raw = io.open(path, "rb").read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    lines = raw.decode("utf-8-sig").split("\n")

    out = []
    for line in lines:
        if line.startswith("::") or line.startswith("//") or not line.strip():
            out.append(line)
            continue
        out.append(translate(line))

    if dump:
        seen = set()
        for text in missing:
            if text not in seen:
                seen.add(text)
                print(text)
        return 0

    if missing:
        seen = sorted(set(missing))
        print("%d line(s) with no Thai in skills.tsv (%d uses)" % (len(seen), len(missing)))
        for text in seen[:8]:
            print("   ", text[:110])
        if len(seen) > 8:
            print("    ... and %d more; run with --dump to list them all" % (len(seen) - 8))
        return 1

    print("every line translated")
    if apply_it:
        body = "\n".join(out)
        io.open(path, "wb").write((b"\xef\xbb\xbf" if bom else b"") + body.encode("utf-8"))
        print("written to", path)
    return 0


if __name__ == "__main__":
    files = [a for a in sys.argv[1:] if not a.startswith("--")]
    sys.exit(main(files[0], "--apply" in sys.argv, "--dump" in sys.argv))
