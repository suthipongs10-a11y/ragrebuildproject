#!/usr/bin/env python3
"""Does the server ever read the stat an item writes?

An item effect is a line that adds a number to a named stat. Whether the number does
anything depends entirely on somewhere else asking for that stat, and nothing complains if
nobody ever does - the card equips, the number is stored, the tooltip is honest, and the
effect does not exist. This finds the stats written by an item and never read by anything.

Some stats are read through a range rather than by name - the on-hit statuses are walked as
OnMeleeAttackFirst + i - so an enum entry inside a range that is walked counts as read.
"""
import io, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, 'RoRebuildServer', 'GameConfig', 'ServerData', 'Script')
SERVER = os.path.join(ROOT, 'RoRebuildServer', 'RoRebuildServer')
SHARED = os.path.join(ROOT, 'RoRebuildServer', 'RebuildSharedData')
ENUMS = os.path.join(SHARED, 'Enum', 'EntityStats', 'StatEnums.cs')

# ---------------------------------------------------------- what scripts write
written = collections.defaultdict(list)
for base, _, files in os.walk(SCRIPTS):
    for f in files:
        if not f.endswith('.txt'):
            continue
        path = os.path.join(base, f)
        text = io.open(path, encoding='utf-8-sig').read()
        #Commented out lines are not written by anything. Ice Falchion carries a disabled
        #AddStat(OnAttackFreezeSelf, 1) after its closing brace, and counting it made a
        #stat that no live item writes look like a stat some item writes and nothing reads.
        text = re.sub(r'//[^\n]*', '', text)
        for m in re.finditer(r'AddStat\(\s*([A-Za-z_]\w*)', text):
            line = text.count('\n', 0, m.start()) + 1
            written[m.group(1)].append(f'{f}:{line}')

# ---------------------------------------------------------- the enum, in order
enum_order = []
text = io.open(ENUMS, encoding='utf-8-sig').read()
body = text[text.index('public enum CharacterStat'):]
body = body[:body.index('\n}')]
blocks = []
current = []
for line in body.split('\n'):
    if not line.strip():
        if current:
            blocks.append(current)
            current = []
        continue
    m = re.match(r'\s*([A-Za-z_]\w*)\s*(?:=\s*([A-Za-z_]\w*))?\s*,', line)
    if m and not line.strip().startswith('//'):
        enum_order.append((m.group(1), m.group(2)))
        current.append(m.group(1))
if current:
    blocks.append(current)

#Which block a name belongs to. The enum is written with a blank line between families -
#the ten attack elements, then the ten resistances, then the three sizes - and that grouping
#is what the code indexes into when it asks for the first of a family and adds an offset.
block_of = {}
for b in blocks:
    for n in b:
        block_of[n] = b

names = [n for n, alias in enum_order]
index = {n: i for i, n in enumerate(names)}
alias_of = {n: a for n, a in enum_order if a}

# ---------------------------------------------------------- what the server reads
server = ''
for base, _, files in os.walk(SERVER):
    if 'Migrations' in base:
        continue
    for f in files:
        if f.endswith('.cs'):
            server += io.open(os.path.join(base, f), encoding='utf-8-sig').read()

read_names = set(re.findall(r'CharacterStat\.([A-Za-z_]\w*)', server))

# ---------------------------------------------------------- families read by offset
# Element and race bonuses are not read by name. The code asks for the first of the family
# and adds the element or race onto it - AddResistElementNeutral + (int)attackElement - so
# every entry in that run is read even though none of their names appear anywhere. Without
# this the checker calls forty perfectly good stats dead, which is how a checker gets
# ignored.
for m in re.finditer(r'CharacterStat\.(\w+)\s*\+', server):
    anchor = alias_of.get(m.group(1), m.group(1))
    for n in block_of.get(anchor, []):
        read_names.add(n)

if __name__ == '__main__':
    dead = []
    for stat in sorted(written):
        target = alias_of.get(stat, stat)
        if stat not in index:
            dead.append((stat, 'not a CharacterStat at all', written[stat]))
        elif target not in read_names and stat not in read_names:
            dead.append((stat, 'never read by the server', written[stat]))

    print(f'stats written by an item script: {len(written)}')
    print(f'of those, dead: {len(dead)}\n')
    for stat, why, where in dead:
        print(f'{stat:<32} {why}')
        for w in where[:4]:
            print(f'      {w}')
        if len(where) > 4:
            print(f'      ...and {len(where) - 4} more')
