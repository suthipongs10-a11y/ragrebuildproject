#!/usr/bin/env python3
"""Every item a player can get, against the effect it promises.

Not a checker in tools/check - it does not pass or fail, it produces a list to work through.
"""
import csv, io, os, re, sys, collections

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, '..', 'RoRebuildServer', 'GameConfig', 'ServerData')

def rows(name):
    path = os.path.join(DATA, 'Db', name)
    r = csv.reader(io.open(path, encoding='utf-8-sig'))
    head = next(r)
    for row in r:
        if row and len(row) >= len(head):
            yield dict(zip(head, row))

def read(*parts):
    return io.open(os.path.join(DATA, *parts), encoding='utf-8-sig').read()

# ---------------------------------------------------------------- what exists
items = {}
for f, kind in [('ItemsCards.csv','card'), ('ItemsEquipment.csv','equip'),
                ('ItemsWeapons.csv','weapon'), ('ItemsUsable.csv','usable'),
                ('ItemsRegular.csv','etc'), ('ItemsAmmo.csv','ammo')]:
    for row in rows(f):
        items[row['Code']] = {'kind': kind, 'name': row['Name'], 'id': row['Id']}

# ---------------------------------------------------------------- what has an effect
effects = {}
combos = set()
for f in ['CardEffects.txt','EquipmentEffects.txt','ItemEffects.txt','ComboEffects.txt',
          'MiscEffects.txt','CustomItems.txt']:
    text = read('Script', 'Items', f)

    #Item("X") { ...body... } - the body runs to the matching brace, and an entry can span
    #several lines, so this walks braces rather than trusting a line to hold the whole thing.
    for m in re.finditer(r'Item\("([^"]+)"\)\s*\{', text):
        depth, i = 1, m.end()
        while i < len(text) and depth:
            if text[i] == '{': depth += 1
            elif text[i] == '}': depth -= 1
            i += 1
        effects[m.group(1)] = effects.get(m.group(1), '') + text[m.end():i]

    #ComboItem("Name", "A", "B", ...) - a set bonus counts as an effect for every item in it
    for m in re.finditer(r'ComboItem\(([^)]*)\)\s*\{', text):
        for part in re.findall(r'"([^"]+)"', m.group(1))[1:]:
            combos.add(part)

#Everything the script language can actually do, taken from the effect files themselves
#rather than guessed at - a name missing here reads as an item with no effect, which is a
#false alarm, and a checker that cries wolf is one nobody finishes reading.
REAL = re.compile(
    r'AddStat|AddStatusEffect|RecoveryItem|AutoSpellWhenAttacked|AutoSpellOnAttack|GrantSkill'
    r'|SetArmorElement|AddBonusDropOnKill|OpenItemPackage|UseItemCreationItem|AddDamageVsTag'
    r'|CleanseStatusEffect|ItemActivatedSkillSelfTarget|ChangeWeaponElement|UseSummonItem'
    r'|SetPreserveStatusOnDeath|HealSpPercent|HealHpPercent|TryCastItemSkill|RecoverSpRange'
    r'|RandomTeleport|HealRange|ReturnToSavePoint|CreateEvent|RemoveStatusEffect')

def has_real_effect(code):
    if code in combos:
        return True
    body = effects.get(code)
    return bool(body and REAL.search(body))

# ---------------------------------------------------------------- what is obtainable
obtainable = set()
for row in rows('DropData.csv'):
    for k, v in row.items():
        if k.startswith('Item') and v.strip():
            obtainable.add(v.strip().split('#')[0])
for row in rows('ItemBoxSummonList.csv'):
    obtainable.add(row['Code'].strip())

shops = ''
npcdir = os.path.join(DATA, 'Script', 'Npcs')
for base, _, files in os.walk(npcdir):
    for f in files:
        if f.endswith('.txt'):
            shops += io.open(os.path.join(base, f), encoding='utf-8-sig').read()
for code in items:
    if re.search(r'[",(\s]' + re.escape(code) + r'[",)\s]', shops):
        obtainable.add(code)

srv = ''
for base, _, files in os.walk(os.path.join(ROOT, '..', 'RoRebuildServer', 'RoRebuildServer', 'Custom')):
    for f in files:
        if f.endswith('.cs'):
            srv += io.open(os.path.join(base, f), encoding='utf-8').read()
for code in items:
    if '"' + code + '"' in srv:
        obtainable.add(code)

# ---------------------------------------------------------------- what is described
described = {}
for f in ['DescCards.txt','DescEquipment.txt','DescWeapons.txt','DescUsableItems.txt',
          'DescRegularItems.txt','DescAmmunition.txt']:
    text = read('ItemDescriptions', f)
    for m in re.finditer(r'^::(\S+)[^\n]*\n(.*?)(?=^::|\Z)', text, re.S | re.M):
        described[m.group(1)] = m.group(2).strip()

PROMISE = re.compile(
    r'(STR|AGI|VIT|INT|DEX|LUK|HP|SP|ATK|MATK|DEF|MDEF|FLEE|HIT|CRI|ASPD|Perfect Dodge)\s*[+\-]\s*\d'
    r'|[+\-]\s*\d+\s*%'
    r'|เพิ่ม|ลด|ต้านทาน|โอกาส|ทำให้|ฟื้นฟู|สามารถ')

if __name__ == '__main__':
    want = sys.argv[1] if len(sys.argv) > 1 else 'missing'

    missing = []
    for code, info in sorted(items.items()):
        if info['kind'] in ('etc',):
            continue
        if code not in obtainable:
            continue
        desc = described.get(code, '')
        if not desc or not PROMISE.search(desc):
            continue
        if has_real_effect(code):
            continue

        #Defence and magic defence come off the item table, not out of a script, so a
        #description whose only promise is one of those is already kept.
        stripped = re.sub(r'M?DEF\s*\+\s*\d+', '', desc, flags=re.I)
        if not PROMISE.search(stripped):
            continue

        missing.append((info['kind'], code, info['name'], ' '.join(desc.split())[:90]))

    by_kind = collections.Counter(m[0] for m in missing)
    print(f'obtainable items: {len(obtainable & set(items))}')
    print(f'items with an effect written: {sum(1 for c in items if has_real_effect(c))}')
    print(f'\nobtainable, described as doing something, no effect at all: {len(missing)}')
    for k, n in sorted(by_kind.items()):
        print(f'   {k:<8} {n}')

    if want != 'count':
        print()
        for kind, code, name, desc in missing:
            print(f'{kind:<7} {code:<34} {name:<28} {desc}')

# ---------------------------------------------------------------- numbers
STAT_WORDS = [
    (r'\bSTR\b', 'AddStr'), (r'\bAGI\b', 'AddAgi'), (r'\bVIT\b', 'AddVit'),
    (r'\bINT\b', 'AddInt'), (r'\bDEX\b', 'AddDex'), (r'\bLUK\b', 'AddLuk'),
    (r'Perfect ?Dodge', 'PerfectDodge'),
    (r'\bFLEE\b', 'AddFlee'), (r'\bHIT\b', 'AddHit'), (r'\bCRI(?:T)?\b', 'AddCrit'),
    (r'\bMAXHP\b|\bMax ?HP\b|\bHP\b', 'AddMaxHp'), (r'\bMAXSP\b|\bMax ?SP\b|\bSP\b', 'AddMaxSp'),
    (r'\bMDEF\b', 'AddMDef'), (r'\bDEF\b', 'AddDef'),
    (r'\bMATK\b', 'AddMagicAttackPower'), (r'\bATK\b', 'AddAttackPower'),
]

def promised(desc):
    """stat -> number, from the human description"""
    out = {}
    #A set bonus is a different item's doing, so everything under it is cut away first.
    desc = re.split(r'โบนัสเซ็ต|<color=#800080>', desc)[0]
    #A line that qualifies its bonus - against demihumans, for swordsmen, while mounted - is
    #a different stat under the hood, and holding it against the plain one is a false alarm.
    desc = '\n'.join(l for l in desc.split('\n')
                     if not re.search(r'ต่อ|เมื่อ|ขณะ|สำหรับ|เฉพาะ|ถ้า|กับ', l))
    for pattern, stat in STAT_WORDS:
        #The pattern is wrapped, because several of them are alternations and an
        #alternation left bare binds looser than what follows it - MAXHP|HP followed by
        #a number matches MAXHP on its own and hands back a number that is not there.
        for m in re.finditer('(?:' + pattern + r')\s*([+\-])\s*(\d+)\s*(%)?', desc, re.I):
            if m.group(3):
                continue  #a percentage is a different stat name, left to the eye
            out.setdefault(stat, int(m.group(2)) * (-1 if m.group(1) == '-' else 1))
    return out

#Defence, magic defence and a weapon's attack are columns in the item table, not script
#calls, so a description promising one of those is compared against the table.
CSV_STATS = {'AddDef': 'Defense', 'AddMDef': 'MagicDef', 'AddAttackPower': 'Attack'}
csv_value = {}
for f in ['ItemsEquipment.csv', 'ItemsWeapons.csv']:
    for row in rows(f):
        for stat, column in CSV_STATS.items():
            if column in row and row[column].strip().lstrip('-').isdigit():
                csv_value.setdefault(row['Code'], {})[stat] = int(row[column])


def granted(code):
    """stat -> number, from the effect actually written"""
    out = {}
    body = effects.get(code, '')
    #Only the unconditional part. A bonus inside an if() is for one job or one situation and
    #the description says so in words, which is not something to compare a number against.
    body = re.sub(r'if\s*\([^)]*\)\s*\{[^}]*\}', '', body)
    body = re.sub(r'if\s*\([^)]*\)[^;]*;', '', body)
    for m in re.finditer(r'AddStat\(\s*(\w+)\s*,\s*(-?\d+)\s*\)', body):
        out[m.group(1)] = out.get(m.group(1), 0) + int(m.group(2))
    return out

def compare():
    bad = []
    for code, info in sorted(items.items()):
        if code not in obtainable or info['kind'] not in ('card', 'equip', 'weapon'):
            continue
        desc = described.get(code, '')
        if not desc:
            continue
        want, got = promised(desc), granted(code)
        if not want:
            continue
        for stat, value in want.items():
            #Satisfied by the item table rather than by a script.
            if csv_value.get(code, {}).get(stat, 0) == value:
                continue
            if stat not in got:
                bad.append((code, info['name'], stat, value, None, ' '.join(desc.split())[:70]))
            elif got[stat] != value:
                bad.append((code, info['name'], stat, value, got[stat], ' '.join(desc.split())[:70]))
    return bad
