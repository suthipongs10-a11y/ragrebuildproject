#!/usr/bin/env python3
"""Catches the theme helper whose return type is not what the next line wants.

Run from the repo root:  python3 tools/check/uitypes.py

ModernUiTheme is a set of builders that return different things - CreateCard and CreateRect
hand back a RectTransform, CreateButton and CreateIconButton hand back a Button, CreateText
hands back a TextMeshProUGUI - and Place takes a RectTransform. Reading the code, all four
lines look the same, and the two that are wrong are only wrong at the transform.

Not a general type checker. It knows the handful of builders in this one class and the
handful of methods that want a rect, tracks which local came from which builder inside a
single file, and says nothing about anything else. That narrowness is the point: a check
that guesses is a check people learn to run past.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLIENT = os.path.join(ROOT, "RebuildClient", "Assets", "Scripts")

#  builder -> what it hands back
RETURNS = {
    "CreateCard": "RectTransform",
    "CreateRect": "RectTransform",
    "CardBehind": "RectTransform",
    "CreateTitleBar": "RectTransform",
    "CreateButton": "Button",
    "CreateIconButton": "Button",
    "CreateIcon": "Image",
    "CreateText": "TextMeshProUGUI",
}

#  method -> which argument has to be a RectTransform
WANTS_RECT = {
    "Place": 0,
    "Stretch": 0,
    "AttachShadow": 0,
    "AddBorder": 0,
}

ASSIGN = re.compile(r"\bvar\s+(\w+)\s*=\s*ModernUiTheme\.(\w+)\s*\(")
CALL = re.compile(r"\bModernUiTheme\.(\w+)\s*\(\s*([A-Za-z_]\w*)\s*[,)]")


def main():
    problems = []
    checked = 0

    for folder, _, files in os.walk(CLIENT):
        for name in files:
            if not name.endswith(".cs"):
                continue

            path = os.path.join(folder, name)
            with open(path, encoding="utf-8-sig", errors="ignore") as handle:
                src = handle.read()

            if "ModernUiTheme." not in src:
                continue

            checked += 1
            kinds = {}
            for match in ASSIGN.finditer(src):
                builder = match.group(2)
                if builder in RETURNS:
                    kinds[match.group(1)] = RETURNS[builder]

            if not kinds:
                continue

            for match in CALL.finditer(src):
                method, arg = match.group(1), match.group(2)
                if WANTS_RECT.get(method) != 0:
                    continue

                kind = kinds.get(arg)
                if kind is None or kind == "RectTransform":
                    continue

                line = src[:match.start()].count("\n") + 1
                rel = os.path.relpath(path, CLIENT).replace(os.sep, "/")
                problems.append(f"{rel}:{line}  {method}({arg}, ...) - {arg} is a {kind}, "
                                f"and {method} wants a RectTransform. Pass "
                                f"(RectTransform){arg}.transform")

    print(f"checked {checked} file(s) that use the theme builders")

    if problems:
        print("\nFAIL")
        for p in problems:
            print("  -", p)
        return 1

    print("\nevery builder's result is handed to something that takes it")
    return 0


if __name__ == "__main__":
    sys.exit(main())
