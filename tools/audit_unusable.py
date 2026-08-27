#!/usr/bin/env python3
"""What in the item tables does nothing, and what cannot be got at all.

    python3 tools/audit_unusable.py            the lists
    python3 tools/audit_unusable.py count      the counts only

Not a check - it does not pass or fail. It answers the question a player asks after a few
hours in: which of these cards actually do something, and which of these things can I ever
find? Both have the same failure mode, which is silence. A card with no effect equips
cleanly and shows a tooltip; an item nothing drops sits in the database looking exactly
like one that does.

Four questions, and they are not the same question:

  no effect at all      a card or a usable with no Item() block and no set bonus. Equipping
                        or using it does nothing whatsoever. Equipment and weapons are not
                        counted here - their defence and attack come off the item table
                        rather than a script, so having no script is the normal case
  effect goes nowhere   the effect exists and writes a stat the server never reads. See
                        audit_stats.py, whose work this borrows rather than repeats
  nothing drops it      no monster drops it, no box holds it, no shop sells it and no
                        server event hands it out
  its monster is not
  in the world          something drops it, but nothing that drops it is spawned on any
                        map. Which is the same as nothing dropping it, and is worth saying
                        separately because the fix is different - one is a data gap and the
                        other is a spawn that has not been written yet
"""
import collections
import csv
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'RoRebuildServer', 'GameConfig', 'ServerData')
MAPS = os.path.join(ROOT, 'web', 'data', 'maps.json')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit_stats  # noqa: E402  - imported for its work, not its output


def rows(name):
    path = os.path.join(DATA, 'Db', name)
    reader = csv.reader(io.open(path, encoding='utf-8-sig'))
    head = next(reader)
    for row in reader:
        if row and len(row) >= len(head):
            yield dict(zip(head, row))


def read(*parts):
    return io.open(os.path.join(DATA, *parts), encoding='utf-8-sig').read()


# ---------------------------------------------------------------- what exists
KINDS = [('ItemsCards.csv', 'card'), ('ItemsEquipment.csv', 'equip'),
         ('ItemsWeapons.csv', 'weapon'), ('ItemsUsable.csv', 'usable'),
         ('ItemsRegular.csv', 'etc'), ('ItemsAmmo.csv', 'ammo')]

items = {}
for filename, kind in KINDS:
    for row in rows(filename):
        items[row['Code']] = {'kind': kind, 'name': row['Name'], 'id': int(row['Id'])}

# ---------------------------------------------------------------- what has an effect
effects = {}
combos = set()
one_liners = set()
for filename in ['CardEffects.txt', 'EquipmentEffects.txt', 'ItemEffects.txt',
                 'ComboEffects.txt', 'MiscEffects.txt', 'CustomItems.txt']:
    text = read('Script', 'Items', filename)

    #the body runs to the matching brace, and an entry spans as many lines as it likes
    for match in re.finditer(r'Item\("([^"]+)"\)\s*\{', text):
        depth, i = 1, match.end()
        while i < len(text) and depth:
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
            i += 1
        effects[match.group(1)] = effects.get(match.group(1), '') + text[match.end():i]

    for match in re.finditer(r'ComboItem\(([^)]*)\)\s*\{', text):
        for part in re.findall(r'"([^"]+)"', match.group(1))[1:]:
            combos.add(part)

    #RecoveryItem("Red_Potion", 45, 65, 0, 0); - a whole effect on one line with no block
    #around it, which is how seventy two of the potions and the food are written. Read as
    #a block that is not there, every one of them reads as an item that does nothing.
    for match in re.finditer(r'^\s*RecoveryItem\(\s*"([^"]+)"', text, re.M):
        one_liners.add(match.group(1))

#Everything the script language can do, taken from the effect files rather than guessed at.
#A verb missing from here reads as an item with no effect, which is a false alarm.
DOES_SOMETHING = re.compile(
    r'AddStat|AddStatusEffect|RecoveryItem|AutoSpellWhenAttacked|AutoSpellOnAttack|GrantSkill'
    r'|SetArmorElement|AddBonusDropOnKill|OpenItemPackage|UseItemCreationItem|AddDamageVsTag'
    r'|CleanseStatusEffect|ItemActivatedSkillSelfTarget|ChangeWeaponElement|UseSummonItem'
    r'|SetPreserveStatusOnDeath|HealSpPercent|HealHpPercent|TryCastItemSkill|RecoverSpRange'
    r'|RandomTeleport|HealRange|ReturnToSavePoint|CreateEvent|RemoveStatusEffect')


def has_effect(code):
    if code in combos or code in one_liners:
        return True
    body = effects.get(code)
    return bool(body and DOES_SOMETHING.search(body))


# ---------------------------------------------------------------- which stats are dead
dead_stats = set()
for stat in audit_stats.written:
    target = audit_stats.alias_of.get(stat, stat)
    if stat not in audit_stats.index:
        dead_stats.add(stat)
    elif target not in audit_stats.read_names and stat not in audit_stats.read_names:
        dead_stats.add(stat)


def stat_verdict(code):
    """live, part-dead or dead, for an effect whose whole job is writing stats."""
    body = effects.get(code)
    if not body:
        return 'none'

    stats = re.findall(r'AddStat\(\s*([A-Za-z_]\w*)', body)
    if not stats:
        return 'live'  #it does something other than write a stat

    dead = [s for s in stats if s in dead_stats]
    if not dead:
        return 'live'

    #anything else in the body is a second thing the item does, and it still works
    without_stats = re.sub(r'AddStat\([^)]*\)', '', body)
    if len(dead) == len(stats) and not DOES_SOMETHING.search(without_stats):
        return 'dead'
    return 'part'


# ---------------------------------------------------------------- what drops what
drops = collections.defaultdict(set)   # item code -> monsters that drop it
for row in rows('DropData.csv'):
    monster = row['Monster'].strip()
    for key, value in row.items():
        if key and key.startswith('Item') and value.strip():
            drops[value.strip().split('#')[0]].add(monster)

in_box = collections.defaultdict(set)  # item code -> boxes that hold it
for row in rows('ItemBoxSummonList.csv'):
    in_box[row['Code'].strip()].add(row['Type'].strip())

shop_text = ''
for base, _, files in os.walk(os.path.join(DATA, 'Script', 'Npcs')):
    for filename in files:
        if filename.endswith('.txt'):
            shop_text += io.open(os.path.join(base, filename), encoding='utf-8-sig').read()

server_text = ''
custom = os.path.join(ROOT, 'RoRebuildServer', 'RoRebuildServer', 'Custom')
for base, _, files in os.walk(custom):
    for filename in files:
        if filename.endswith('.cs'):
            server_text += io.open(os.path.join(base, filename), encoding='utf-8').read()

sold = {code for code in items
        if re.search(r'[",(\s]' + re.escape(code) + r'[",)\s]', shop_text)}
handed_out = {code for code in items if '"' + code + '"' in server_text}

# ---------------------------------------------------------------- what is in the world
spawning = set()
if os.path.exists(MAPS):
    for entry in json.load(io.open(MAPS, encoding='utf-8')):
        for spawn in entry.get('spawns', []):
            if spawn.get('count', 0) > 0:
                spawning.add(spawn['code'].upper().replace(' ', '_'))


def monster_key(name):
    return name.upper().replace(' ', '_')


def source(code):
    """Where an item comes from: 'drop', 'spawnless', 'box', 'shop', 'event' or None."""
    if code in sold:
        return 'shop'
    if code in handed_out:
        return 'event'

    monsters = drops.get(code)
    if monsters:
        if any(monster_key(m) in spawning for m in monsters):
            return 'drop'

    boxes = in_box.get(code)
    if boxes and any(b in items for b in boxes):
        return 'box'

    if monsters:
        return 'spawnless'

    return None


# ---------------------------------------------------------------- the report
def build():
    no_effect, dead_effect, part_effect = [], [], []
    unobtainable, spawnless = [], []

    for code, item in sorted(items.items(), key=lambda kv: kv[1]['name'].lower()):
        kind = item['kind']

        #A card or a usable with no script is a card or a usable that does nothing. An
        #equip or a weapon with no script is the ordinary case: its defence and its attack
        #are columns in the item table, not lines in a file.
        if kind in ('card', 'usable') and not has_effect(code):
            no_effect.append((code, item))
        else:
            verdict = stat_verdict(code)
            if verdict == 'dead':
                dead_effect.append((code, item))
            elif verdict == 'part':
                part_effect.append((code, item))

        where = source(code)
        if where is None:
            unobtainable.append((code, item))
        elif where == 'spawnless':
            spawnless.append((code, item, sorted(drops[code])))

    return no_effect, dead_effect, part_effect, unobtainable, spawnless


def show(title, entries, limit=None):
    print(f'\n{title}: {len(entries)}')
    if not entries:
        return
    shown = entries if limit is None else entries[:limit]
    for entry in shown:
        code, item = entry[0], entry[1]
        extra = ''
        if len(entry) > 2:
            extra = '   <- ' + ', '.join(entry[2][:3])
            if len(entry[2]) > 3:
                extra += f' +{len(entry[2]) - 3}'
        print(f'  {item["kind"]:<7} {code:<34} {item["name"]}{extra}')
    if limit is not None and len(entries) > limit:
        print(f'  ...and {len(entries) - limit} more')


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'list'
    no_effect, dead_effect, part_effect, unobtainable, spawnless = build()

    counts = collections.Counter(item['kind'] for item in items.values())
    print(f'items in the tables: {len(items)}   '
          + '  '.join(f'{k} {v}' for k, v in sorted(counts.items())))
    print(f'monsters spawned somewhere: {len(spawning)}')

    if mode == 'count':
        print(f'\nno effect at all:        {len(no_effect)}')
        print(f'effect goes nowhere:     {len(dead_effect)}')
        print(f'effect partly dead:      {len(part_effect)}')
        print(f'nothing drops it:        {len(unobtainable)}')
        print(f'its monster never spawns:{len(spawnless)}')
        return 0

    show('no effect at all - equipping or using it does nothing', no_effect)
    show('effect goes nowhere - every stat it writes is one the server never reads', dead_effect)
    show('effect partly dead - some of what it grants is never read', part_effect)
    show('its monster is never spawned, so nothing can drop it', spawnless, 40)
    show('nothing drops it, no box holds it, no shop sells it', unobtainable, 60)
    return 0


if __name__ == '__main__':
    sys.exit(main())
