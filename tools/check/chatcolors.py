#!/usr/bin/env python3
"""Whether the chat log's notices can be read, and whether they still come from one place.

Run from the repo root:  python3 tools/check/chatcolors.py

The log is where the game tells you things: what dropped, who joined, what failed, what
your shop sold. It is read at a glance over the log's own dark panel, so a colour that is
merely dark is a line nobody reads - and that is not a thing anybody notices while writing
it, because the person writing it knows what the line says.

That is exactly how the friend list ended up navy blue on charcoal, at 2.2 to 1.

Two rules:

  every colour is bright   measured against the panel. Text needs 4.5 to 1 under WCAG 2.1,
                           and there is a floor on lightness as well, because a colour can
                           clear the ratio by being nearly black and still be the wrong
                           answer for a log that is also drawn over grass
  every colour is named    no raw <color=...> inside a chat call. Ninety of those across
                           twenty files is how you end up with a dozen shades of the same
                           blue and no way to change any of them
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRIPTS = os.path.join(ROOT, "RebuildClient", "Assets", "Scripts")
PALETTE = os.path.join(SCRIPTS, "UI", "Utility", "TextColors.cs")

#the log's panel. Near black rather than a measured value, because the panel is drawn at
#partial opacity over whatever is behind it and this is the darkest it ever gets.
PANEL = (0x1A, 0x1A, 0x1A)

TEXT_MIN = 4.5       # WCAG 2.1 for normal sized text
LIGHTNESS_MIN = 0.30 # relative luminance, so nothing clears the ratio by being nearly black
APART_MIN = 60       # rgb distance below which two notices read as the same colour

ENTRY = re.compile(r'public const string (\w+) = "#([0-9A-Fa-f]{6})"')
SPEECH_BLOCK = re.compile(r"class Speech\s*\{(.*?)\n        \}", re.S)
CHAT = re.compile(r"Append(?:ChatText|Notice|Error)")
COLOUR_TAG = re.compile(r"<color=(#?\w+)>")


def _linear(channel):
    channel /= 255
    return channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = (_linear(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    high, low = max(la, lb), min(la, lb)
    return (high + 0.05) / (low + 0.05)


def rgb(hex6):
    return tuple(int(hex6[i:i + 2], 16) for i in (0, 2, 4))


def distance(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def read_palette():
    """The notices and the speech colours, kept apart.

    They are held apart from each other within a group but not across the two, because a
    line of speech always arrives with somebody's name in front of it and is never taken
    for a notice. Both groups still have to be bright enough to read.
    """
    with open(PALETTE, encoding="utf-8-sig") as handle:
        source = handle.read()

    block = SPEECH_BLOCK.search(source)
    speech = [(m.group(1), m.group(2)) for m in ENTRY.finditer(block.group(1))] if block else []

    if block:
        source = source[:block.start()] + source[block.end():]

    notices = [(m.group(1), m.group(2)) for m in ENTRY.finditer(source)]
    return notices, speech


def source_files():
    for folder, _, files in os.walk(SCRIPTS):
        for name in sorted(files):
            if name.endswith(".cs") and os.path.join(folder, name) != PALETTE:
                yield os.path.join(folder, name)


def raw_colours_in_chat():
    """Every <color=...> written by hand inside a chat call, with where it is."""
    found = []
    for path in source_files():
        with open(path, encoding="utf-8-sig") as handle:
            lines = handle.read().split("\n")

        for index, line in enumerate(lines):
            if not CHAT.search(line):
                continue

            #a call can be spread over the lines that follow it, and the colour is often
            #on one of those rather than on the line naming the method
            for offset in range(index, min(index + 4, len(lines))):
                text = lines[offset]
                if "ChatColor" in text or text.strip().startswith("//"):
                    continue

                for match in COLOUR_TAG.finditer(text):
                    name = os.path.relpath(path, SCRIPTS).replace(os.sep, "/")
                    found.append((f"{name}:{offset + 1}", match.group(1)))
    return found


def main():
    notices, speech = read_palette()
    palette = notices + speech
    if not palette:
        print(f"no palette found in {PALETTE}")
        return 1

    problems = []

    for name, hex6 in palette:
        colour = rgb(hex6)
        ratio = contrast(colour, PANEL)
        light = luminance(colour)

        if ratio < TEXT_MIN:
            problems.append(f"ChatColor.{name} (#{hex6}) is {ratio:.2f} to 1 on the log's "
                            f"panel, under the {TEXT_MIN} normal text has to clear")
        if light < LIGHTNESS_MIN:
            problems.append(f"ChatColor.{name} (#{hex6}) has a lightness of {light:.2f}, "
                            f"under the {LIGHTNESS_MIN} floor - it is a dark ink, and the "
                            f"log is not a pale card")

    for group, label in ((notices, "ChatColor"), (speech, "ChatColor.Speech")):
        for i, (name, hex6) in enumerate(group):
            for other, other_hex in group[i + 1:]:
                gap = distance(rgb(hex6), rgb(other_hex))
                if gap < APART_MIN:
                    problems.append(f"{label}.{name} (#{hex6}) and {label}.{other} "
                                    f"(#{other_hex}) are {gap:.0f} apart, which reads as "
                                    f"one colour - two lines nobody can tell apart")

    for where, colour in raw_colours_in_chat():
        problems.append(f"{where}: <color={colour}> written by hand in a chat call - "
                        f"it belongs in ChatColor")

    if problems:
        print()
        for problem in problems:
            print(f"  !  {problem}")
        print(f"\n{len(problems)} problem(s).")
        return 1

    print(f"checked {len(notices)} notice colour(s) and {len(speech)} speech colour(s) "
          f"against the log's panel\n")
    for name, hex6 in notices:
        print(f"  {contrast(rgb(hex6), PANEL):5.2f} : 1   ChatColor.{name} (#{hex6})")
    for name, hex6 in speech:
        print(f"  {contrast(rgb(hex6), PANEL):5.2f} : 1   ChatColor.Speech.{name} (#{hex6})")
    print("\nevery notice the log writes is bright enough to read, and named in one place")
    return 0


if __name__ == "__main__":
    sys.exit(main())
