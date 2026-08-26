#!/usr/bin/env python3
"""Whether every colour the interface writes with can actually be read on what it is written on.

Run from the repo root:  python3 tools/check/contrast.py

A retint is the one change that breaks quietly. Nothing fails to compile, nothing
throws, and the only sign is a label somebody cannot read on a phone in daylight -
which is not something the person who made the change is ever going to notice on
a desk monitor.

The ratio is the one from WCAG 2.1. Normal sized text has to clear 4.5 to 1;
something drawn rather than typed - an icon, a bar, a chip - has to clear 3 to 1.

Which ink lands on which surface cannot be read off the source: it is decided at
the call site, three files away from where either colour is declared. So the
pairings are listed here by hand, and the list is the thing to add to when a new
one appears.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UI = os.path.join(ROOT, "RebuildClient", "Assets", "Scripts", "UI")

TEXT_MIN = 4.5
GRAPHIC_MIN = 3.0


def _linear(channel):
    return channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = rgb
    return 0.2126 * _linear(r) + 0.7152 * _linear(g) + 0.0722 * _linear(b)


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    high, low = max(la, lb), min(la, lb)
    return (high + 0.05) / (low + 0.05)


COLOUR = re.compile(
    r"Color\s+(\w+)\s*=\s*new Color\(\s*([\d.]+)f?\s*,\s*([\d.]+)f?\s*,\s*([\d.]+)f?")


def read_colours():
    """Every named colour constant under Assets/Scripts/UI, keyed file::name."""
    found = {}
    for folder, _, files in os.walk(UI):
        for name in files:
            if not name.endswith(".cs"):
                continue
            path = os.path.join(folder, name)
            with open(path, encoding="utf-8-sig") as handle:
                for line in handle:
                    match = COLOUR.search(line)
                    if not match:
                        continue
                    key = os.path.relpath(path, UI).replace(os.sep, "/") + "::" + match.group(1)
                    found[key] = tuple(float(x) for x in match.groups()[1:])
    return found


THEME = "ModernUiTheme.cs::"

#  ink, surface, kind. "surface" may be a theme colour or another named one.
#  Where a label can land on more than one surface, the darkest one is listed:
#  clearing that clears the lighter ones too.
PAIRS = [
    # the theme's own inks, on every surface the theme puts them on
    (THEME + "TitleColor", THEME + "TitleBarColor", "text"),
    (THEME + "TitleColor", THEME + "CardDeepColor", "text"),
    (THEME + "NameColor", THEME + "CardDeepColor", "text"),
    (THEME + "LabelColor", THEME + "TitleBarColor", "text"),
    (THEME + "MutedColor", THEME + "CardDeepColor", "text"),
    (THEME + "HintColor", THEME + "TitleBarColor", "text"),
    (THEME + "AccentInkColor", THEME + "TitleBarColor", "text"),
    (THEME + "AccentTextColor", THEME + "AccentColor", "text"),
    (THEME + "IconColor", THEME + "CardDeepColor", "graphic"),
    (THEME + "IconMutedColor", THEME + "CardDeepColor", "graphic"),

    # a reading printed across its own gauge
    (THEME + "LightInkColor", THEME + "GaugeHealthColor", "text"),
    (THEME + "LightInkColor", THEME + "GaugeManaColor", "text"),
    (THEME + "LightInkColor", THEME + "GaugeExpColor", "text"),
    (THEME + "LightInkColor", THEME + "GaugeJobExpColor", "text"),

    # the adventure book
    ("AdventureBook/AdventureBookWindow.cs::DoneColor", THEME + "CardDeepColor", "text"),
    ("AdventureBook/AdventureBookWindow.cs::EarnedColor", THEME + "CardDeepColor", "graphic"),
    (THEME + "LightInkColor", "AdventureBook/AdventureBookWindow.cs::RankFillColor", "text"),
    (THEME + "LightInkColor", "AdventureBook/AdventureBookWindow.cs::FillColor", "text"),
    (THEME + "NameColor", "AdventureBook/AdventureBookWindow.cs::RowAltColor", "text"),
    (THEME + "NameColor", "AdventureBook/AdventureBookWindow.cs::MenuRowColor", "text"),

    # the market and the forge
    ("Market/MarketWindow.cs::MoneyColor", "Market/MarketWindow.cs::RowAltColor", "text"),
    ("Market/MarketWindow.cs::MoneyColor", THEME + "CardDeepColor", "text"),
    ("Market/MarketWindow.cs::UrgentColor", THEME + "CardDeepColor", "text"),
    ("Market/MarketWindow.cs::WinningColor", THEME + "CardDeepColor", "text"),
    ("Crafting/ForgeWindow.cs::GoodColor", THEME + "CardDeepColor", "text"),
    ("Crafting/ForgeWindow.cs::ShortColor", THEME + "CardDeepColor", "text"),
    (THEME + "NameColor", "Crafting/ForgeWindow.cs::RowAltColor", "text"),

    # guild and party rosters
    ("Guild/GuildWindow.cs::OnlineColor", THEME + "CardDeepColor", "text"),
    ("Guild/GuildWindow.cs::OfflineColor", THEME + "CardDeepColor", "text"),
    ("Guild/GuildWindow.cs::LeaderColor", THEME + "CardDeepColor", "text"),
    ("Guild/GuildWindow.cs::WarnColor", "Guild/GuildWindow.cs::WarnCardColor", "text"),
    ("Guild/GuildWindow.cs::WarnColor", THEME + "CardDeepColor", "text"),
    ("Party/PartyWindow.cs::OnlineColor", THEME + "CardDeepColor", "text"),
    ("Party/PartyWindow.cs::OfflineColor", THEME + "CardDeepColor", "text"),
    ("Party/PartyWindow.cs::LeaderColor", THEME + "CardDeepColor", "text"),
    ("Party/PartyWindow.cs::PartialColor", THEME + "CardDeepColor", "text"),
    ("Party/PartyWindow.cs::WarnColor", THEME + "CardDeepColor", "text"),
    (THEME + "NameColor", "Party/PartyWindow.cs::MeCardColor", "text"),

    # the rest
    ("EscMenu.cs::NoticeInkColor", "EscMenu.cs::NoticeColor", "text"),
    ("Guide/CharacterGuideWindow.cs::RareColor", THEME + "CardDeepColor", "text"),
    ("Hud/AnnouncementBanner.cs::InkColor", "Hud/AnnouncementBanner.cs::PlateColor", "text"),
    ("Hud/AnnouncementBanner.cs::RuleColor", "Hud/AnnouncementBanner.cs::PlateColor", "graphic"),
    ("Hud/StatusEffectPanel.cs::PlaceholderTint", THEME + "CardDeepColor", "graphic"),
]


def main():
    colours = read_colours()
    missing = []
    failures = []
    checked = 0

    for ink, surface, kind in PAIRS:
        if ink not in colours or surface not in colours:
            missing.append(ink if ink not in colours else surface)
            continue

        checked += 1
        ratio = contrast(colours[ink], colours[surface])
        needed = TEXT_MIN if kind == "text" else GRAPHIC_MIN
        if ratio < needed:
            failures.append((ink, surface, kind, ratio, needed))

    for name in sorted(set(missing)):
        print(f"  ?  no colour named {name} - the pairing list needs updating")

    if failures:
        print()
        for ink, surface, kind, ratio, needed in failures:
            print(f"  !  {ratio:5.2f} : 1   {ink}")
            print(f"                  on {surface}   ({kind} needs {needed})")
        print(f"\n{len(failures)} of {checked} pairing(s) below the bar. "
              f"Darken the ink or lighten what it sits on.")
        return 1

    print(f"checked {checked} ink and surface pairing(s)\n")
    print("everything written on the interface clears the contrast it needs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
