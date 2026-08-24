#!/usr/bin/env python3
"""The things an item effect names, and whether they exist.

audit_stats.py asks whether a stat is read. This asks the next question down: an effect that
casts a skill, drops an item, resists a status or hits a tagged monster names something, and
naming something is not the same as it being there. A card that auto-casts a skill with no
handler equips cleanly, rolls its chance, and does nothing.
"""
import io, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'RoRebuildServer', 'GameConfig', 'ServerData')
SERVER = os.path.join(ROOT, 'RoRebuildServer', 'RoRebuildServer')

scripts = {}
for base, _, files in os.walk(os.path.join(DATA, 'Script')):
    for f in files:
        if f.endswith('.txt'):
            scripts[f] = io.open(os.path.join(base, f), encoding='utf-8-sig').read()

server = ''
for base, _, files in os.walk(SERVER):
    if 'Migrations' in base:
        continue
    for f in files:
        if f.endswith('.cs'):
            server += io.open(os.path.join(base, f), encoding='utf-8-sig').read()


def uses(pattern, group=1):
    """(value, file, line) for every match across the item scripts"""
    out = []
    for name, text in scripts.items():
        for m in re.finditer(pattern, text):
            out.append((m.group(group), f'{name}:{text.count(chr(10), 0, m.start()) + 1}'))
    return out


handled_skills = set(re.findall(r'\[SkillHandler\(CharacterSkill\.(\w+)', server))

#A passive has no handler - nothing casts it - and is read straight off the player wherever
#it applies. Discount is the only one an item grants, and counting a handler as the only
#proof of a skill existing would report it forever.
handled_skills.update(re.findall(r'LevelOfSkill\(CharacterSkill\.(\w+)\)', server))
status_handlers = set(re.findall(r'\[StatusEffectHandler\(CharacterStatusEffect\.(\w+)', server))

item_codes = set()
for f in ['ItemsCards.csv','ItemsEquipment.csv','ItemsWeapons.csv','ItemsUsable.csv',
          'ItemsRegular.csv','ItemsAmmo.csv']:
    text = io.open(os.path.join(DATA, 'Db', f), encoding='utf-8-sig').read()
    for line in text.split('\n')[1:]:
        cols = line.split(',')
        if len(cols) > 1:
            item_codes.add(cols[1].strip())

#Tags are a column in Monsters.csv, space separated, not something a script hands out.
monster_tags = collections.Counter()
mon = io.open(os.path.join(DATA, 'Db', 'Monsters.csv'), encoding='utf-8-sig').read().split('\n')
header = mon[0].split(',')
tag_col = header.index('Tags') if 'Tags' in header else -1
for line in mon[1:]:
    cols = line.split(',')
    if tag_col >= 0 and len(cols) > tag_col:
        for tag in cols[tag_col].strip('"').split():
            if tag:
                monster_tags[tag] += 1


CHECKS = [
    ('skill with no handler',
     r'(?:AutoSpellOnAttack|AutoSpellWhenAttacked|GrantSkill|ItemActivatedSkillSelfTarget|TryCastItemSkill)\(\s*(\w+)',
     lambda v: v in handled_skills or v == 'item'),
    ('status with no handler',
     r'(?:AddStatusEffect|SetPreserveStatusOnDeath|RemoveStatusEffect)\(\s*(?:Status)?(\w+?)(?:Status)?\s*[,)]',
     lambda v: v in status_handlers or v.replace('Status', '') in status_handlers),
    ('bonus drop of an item that does not exist',
     r'AddBonusDropOnKill(?:Race)?\([^)]*?"([^"]+)"',
     lambda v: all(x.strip() in item_codes for x in v.split(','))),
    ('damage against a tag nothing carries',
     r'AddDamageVsTag\("([^"]+)"',
     lambda v: monster_tags[v] > 0),
]

if __name__ == '__main__':
    total = 0
    for label, pattern, ok in CHECKS:
        bad = collections.defaultdict(list)
        seen = 0
        for value, where in uses(pattern):
            seen += 1
            if not ok(value):
                bad[value].append(where)

        print(f'{label}: {len(bad)} of {seen} use(s)')
        for value, wheres in sorted(bad.items()):
            print(f'   {value}')
            for w in wheres[:5]:
                print(f'       {w}')
            if len(wheres) > 5:
                print(f'       ...and {len(wheres) - 5} more')
        total += len(bad)
        print()

    print('nothing named is missing' if total == 0 else f'{total} name(s) that lead nowhere')
