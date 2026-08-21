#!/usr/bin/env python3
"""Turns an item description file into Thai, and reports whatever it could not turn.

These lines are templates, not prose - "ATK +5", "+20% physical damage vs. Shadow" - so
what this holds is a table of phrases rather than a translation. The point of doing it
that way is that one English phrase always comes out as the same Thai one. Four hundred
cards translated by hand would say the same thing three different ways and a player would
reasonably wonder whether three different things were meant.

Two kinds of text are left in English deliberately:

  - anything inside <color=#008080>...</color>. The exporter turns those into clickable
    item links by matching the English item name; translate one and the link goes dead.
  - skill names, which every player of this game already reads in English and which
    would be unrecognisable spelled out in Thai.

Anything else still holding English after the table has run is reported instead of
written. A line the table does not cover is a line nobody wrote a translation for, and
that should be visible rather than quietly shipped half done.

The stat lines are templates and go through the phrase table below. The sentences that
describe what a thing is are not templates, and go through prose.tsv - one English
sentence to one Thai one, written by hand, so the same sentence on twenty different
items reads the same way on all twenty.

  python3 thaidesc.py <file>            say what is not covered
  python3 thaidesc.py <file> --apply    write it
  python3 thaidesc.py <file> --dump     list the sentences prose.tsv is missing
"""
import io
import os
import re
import sys

STAY = "\x01"

# --- vocabulary ---------------------------------------------------------------

ELEMENT = {
    "Neutral": "ไร้ธาตุ", "Water": "ธาตุน้ำ", "Earth": "ธาตุดิน", "Fire": "ธาตุไฟ",
    "Wind": "ธาตุลม", "Poison": "ธาตุพิษ", "Holy": "ธาตุศักดิ์สิทธิ์",
    "Shadow": "ธาตุมืด", "Dark": "ธาตุมืด", "Ghost": "ธาตุผี", "Undead": "ธาตุอันเดด",
    "Decay": "ธาตุเน่าเปื่อย",
}

RACE = {
    "Demi-Human": "มนุษย์", "Brute": "สัตว์", "Insect": "แมลง", "Plant": "พืช",
    "Fish": "สัตว์น้ำ", "Aquatic": "สัตว์น้ำ", "Demon": "ปีศาจ", "Angel": "เทวดา",
    "Dragon": "มังกร", "Formless": "ไร้รูปร่าง", "Undead": "อันเดด",
    #the weapon file writes several of these in the plural, or in lower case
    "Plants": "พืช", "Beast": "สัตว์", "Demi-human": "มนุษย์", "beast": "สัตว์",
    "insect": "แมลง", "dragon": "มังกร", "aquatic": "สัตว์น้ำ", "plant": "พืช",
}

SIZE = {"Small": "ขนาดเล็ก", "Medium": "ขนาดกลาง", "Large": "ขนาดใหญ่"}

#Monster families a card singles out. The ones that are proper names stay as they are:
#somebody hunting Aster is looking for the word Aster on the screen.
FAMILY = {
    "Ants": "มด", "Goblin": "ก็อบลิน", "Orcs": "ออร์ค", "Golem": "โกเลม",
    "Kobolds": "โคบอลด์", "Crab": "ปู", "Shell Fish": "หอย", "Aster": "Aster",
    "Munak": "Munak", "Boss": "บอส", "non-Boss": "มอนที่ไม่ใช่บอส",
}

STATUS = {
    "Stun": "สตัน", "Freeze": "แช่แข็ง", "Curse": "สาป", "Silence": "ใบ้",
    "Blind": "ตาบอด", "Sleep": "หลับ", "Poison": "พิษ", "Petrify": "กลายเป็นหิน",
    "Chaos": "สับสน", "Confusion": "สับสน", "Bleed": "เลือดออก", "Coma": "โคม่า",
    "Hallucination": "ประสาทหลอน",
}

#Job names stay as they are - the character select screen says Swordman, so the card
#saying anything else would be a second name for the same thing.
JOBS = ["Novice", "Swordman", "Thief", "Acolyte", "Merchant", "Archer", "Mage",
        "Knight", "Priest", "Wizard", "Blacksmith", "Hunter", "Assassin", "Crusader",
        "Monk", "Sage", "Rogue", "Alchemist", "Bard", "Dancer", "Performer"]

TARGET = {}
TARGET.update(ELEMENT)
TARGET.update(RACE)
TARGET.update(SIZE)
TARGET.update(FAMILY)

#The game's own shorthand, which is already what players read. Translating STR into Thai
#would be translating away the word on the stat window.
KEEP = set("""STR AGI VIT INT DEX LUK ATK DEF MDEF MATK FLEE HIT CRIT HP SP ASPD
MaxHP MaxSP EXP Zeny zeny Perfect Dodge Endure Double Attack Increase AGI
Gemstone Autospell Job Lv Perfect Hit
Blessing Provoke Resurrection Improve Concentration Swordsman""".split())
KEEP.update(JOBS)
#a few targets are proper names that stay as they are; they are still "translated"
KEEP.update(v for v in TARGET.values() if re.match(r"^[A-Za-z]", v))


def alt(words):
    """The words as one alternation, longest first so Demi-Human beats Demi."""
    return "|".join(sorted((re.escape(w) for w in words), key=len, reverse=True))


SLOTS = {
    "T": alt(TARGET),                       # anything "vs." can name
    "E": alt(ELEMENT),
    "R": alt(RACE),
    "J": alt(JOBS),
    "S": "STR|AGI|VIT|INT|DEX|LUK",
    "K": STAY + r"\d+" + STAY,              # a stashed tag or skill name
}


def fill(pattern):
    """The pattern with {T} {E} {R} {J} {S} {K} filled in.

    Deliberately not %-formatting: every one of these patterns is about a percentage,
    and a literal % inside a %-formatted string is a bug waiting for a quiet afternoon.
    """
    for key, value in SLOTS.items():
        pattern = pattern.replace("{" + key + "}", value)
    return pattern


def target(word):
    return TARGET.get(word, word)


def targets(text):
    """A list like "Demi-Human, Brute, and Insect", each word looked up."""
    parts = re.split(r",\s*(?:and\s+)?|\s+and\s+", text.strip())
    return ", ".join(target(p.strip()) for p in parts if p.strip())


def sign(mark):
    """A leading plus on a chance says nothing; a minus says the set lowers it."""
    return "" if mark == "+" else mark


#What tells a status apart from a buff: the buff names a stat. A card that gives the
#wearer CRIT +100 for five seconds is not doing anything to anybody, so it reads "ได้";
#one that inflicts Stun reads "ทำให้".
STATLIKE = re.compile(r"\b(?:STR|AGI|VIT|INT|DEX|LUK|ATK|DEF|MDEF|MATK|FLEE|HIT|CRIT"
                      r"|HP|SP|ASPD|Perfect Dodge)\b")


def gets(effect):
    return "ได้" if STATLIKE.search(effect) else "ทำให้"


def selfword(which):
    return "(ใส่ตัวเอง)" if which == "self" else "(ใส่ศัตรู)"


#What set an effect off. One map rather than one rule each, because the same eight
#endings turn up on chances, autospells and procs alike.
WHEN = {
    "physical attack": "เมื่อโจมตีกายภาพ",
    "magical attack": "เมื่อโจมตีเวท",
    "melee attack": "เมื่อโจมตีระยะประชิด",
    "non-skill attack": "เมื่อโจมตีปกติ",
    "attack": "เมื่อโจมตี",
    "receive physical damage": "เมื่อโดนโจมตีกายภาพ",
    "receive magical damage": "เมื่อโดนโจมตีเวท",
    "receive damage": "เมื่อโดนโจมตี",
    "range physical attack": "เมื่อโจมตีกายภาพระยะไกล",
}
WHEN_RE = "|".join(sorted((re.escape(k) for k in WHEN), key=len, reverse=True))


def when(text):
    return WHEN.get(text.strip(), text)


# --- the table ----------------------------------------------------------------
# Ordered. Whatever is written first wins, so whole sentences come before the fragments
# they contain, and "damage from <element> attacks" before the bare "damage from X".

SLOTS["W"] = WHEN_RE

RULES = []


def add(pattern, repl):
    RULES.append((re.compile(fill(pattern)), repl))


# whole sentences
add(r"Some or all of this card's effects do not function as expected\.",
    "ผลของการ์ดใบนี้ยังทำงานไม่ครบ")
add(r"If used in combination with Thief's (\S+) it also disables the weapon type requirement\.",
    r"ถ้าใช้คู่กับ \1 ของ Thief จะไม่จำกัดชนิดอาวุธด้วย")
add(r"Adds a (\d+)% chance to double attack while performing regular attacks\.",
    r"โอกาส \1% ออก Double Attack เมื่อโจมตีปกติ")
add(r"Reduces (\d+) of your (\d+) base stats by (\d+)%, putting half the points removed "
    r"into the remaining stat\.",
    r"ลดสเตตัสพื้นฐาน \1 ใน \2 ค่าลง \3% แล้วเอาครึ่งหนึ่งของแต้มที่ลดไปเพิ่มให้ค่าที่เหลือ")
add(r"Target stat is determined by where this card is socketed:",
    "ค่าที่โดนลดขึ้นกับว่าใส่การ์ดใบนี้ไว้ช่องไหน:")
add(r"Movement Speed \+(\d+)% \(Does not stack with Increase Agi or similar items or skills\)",
    r"ความเร็วเดิน +\1% (ไม่ซ้อนกับ Increase AGI หรือไอเทม/สกิลที่ให้ผลเดียวกัน)")
add(r"Reduce Skill Gemstone Requirement by (\d+) of Each Gemstone",
    r"ใช้ Gemstone น้อยลงอย่างละ \1 เม็ด")
add(r"Recover (\d+)% HP and SP on Resurrection", r"ฟื้น HP และ SP \1% เมื่อถูกชุบ")
add(r"Skill/spell casts becomes uninterruptible", "ร่ายสกิลไม่ถูกขัดจังหวะ")
add(r"Physical Damage Scales with Enemy Defense", "ดาเมจกายภาพแปรผันตาม DEF ของศัตรู")
add(r"\+(\d+)% damage against flying or airborn enemies\.", r"ดาเมจต่อศัตรูที่บินได้ +\1%")
add(r"-(\d+)% damage from flying or airborn enemies\.", r"รับดาเมจจากศัตรูที่บินได้ -\1%")

# what a usable item does when you use it
add(r"\bRecover (\d+)% HP and SP", r"ฟื้น HP และ SP \1%")
add(r"^Teleports you to a random map location\.?$", "วาร์ปไปแมพแบบสุ่ม")
add(r"^Returns you to your save location\.?$", "กลับไปยังจุดเซฟ")
add(r"^Summons (\d+) random monsters?\.?$", r"เรียกมอนสุ่ม \1 ตัว")
add(r"^Contains a random card\.$", "เปิดแล้วได้การ์ดสุ่ม 1 ใบ")
add(r"Casts Provoke Lv (\d+) on yourself, reducing DEF by (\d+)% and increasing ATK "
    r"by (\d+)% for (\d+)s?\.?",
    r"ร่าย Provoke Lv \1 ใส่ตัวเอง DEF -\2% ATK +\3% นาน \4 วินาที")
add(r"Increases movement speed by (\d+)% for (\d+) minutes\. Does not stack with "
    r"Increase (?:AGI|Agi)\.?",
    r"ความเร็วเดิน +\1% นาน \2 นาที (ไม่ซ้อนกับ Increase AGI)")
add(r"^Casts (.+?) on yourself when used\.$", r"ใช้แล้วร่าย \1 ใส่ตัวเอง")
add(r"^Casts:? ", "ร่าย ")
add(r"^Cast(?=(?:{K}))", "ร่าย ")
add(r"^Move Quickly for (\d+) seconds?\.?$", r"เดินเร็วขึ้น นาน \1 วินาที")
add(r"^Move slowly for (\d+) seconds?\.?$", r"เดินช้าลง นาน \1 วินาที")
add(r"^Enchant weapon with ({E}) for (\d+) minutes?\.?$",
    lambda m: "เปลี่ยนอาวุธเป็น" + ELEMENT[m.group(1)] + " นาน " + m.group(2) + " นาที")
add(r"^\[Properties\]Casts: ", "[คุณสมบัติ]ร่าย: ")
add(r"^\[Properties\]Useable by: ", "[คุณสมบัติ]ใช้ได้: ")
add(r"^Required Level: ", "เลเวลที่ต้องใช้: ")
add(r"^Channelled: ", "ร่ายต่อเนื่อง: ")
add(r"\bLv (\d+)\b", r"Lv \1")

# which slot the card went in
add(r"^Headgear: Int$", "ช่องหมวก: INT")
add(r"^Body: Vit$", "ช่องชุด: VIT")
add(r"^Weapon/Shield: Str$", "ช่องอาวุธ/โล่: STR")
add(r"^Garment: Agi$", "ช่องผ้าคลุม: AGI")
add(r"^Boots: Dex$", "ช่องรองเท้า: DEX")
add(r"^Accessory: Luk$", "ช่องเครื่องประดับ: LUK")

# standing effects
add(r"\bSet Bonus\b", "โบนัสเซ็ต")
add(r"\bIndestructible Armor\b", "เกราะไม่แตก")
add(r"\bIndestructible Weapon\b", "อาวุธไม่แตก")
add(r"\b({E}) Property Armor\b", lambda m: "เกราะ" + ELEMENT[m.group(1)])
add(r"\bMagic Immunity\b", "ภูมิคุ้มกันเวทมนตร์")
add(r"\bKnockback Immunity\b", "ไม่ถูกผลักถอยหลัง")
add(r"\bPermanent Endure Effect\b", "ติดผล Endure ตลอดเวลา")
add(r"\bUninterruptible Cast\b", "ร่ายสกิลไม่ถูกขัดจังหวะ")
add(r"\bSee Hidden Targets\b", "มองเห็นศัตรูที่ซ่อนตัว")
add(r"\bEnables? use of (.+?)\.?$", r"ใช้ \1 ได้")
add(r"\bEnable (.+?)\.?$", r"ใช้ \1 ได้")
add(r"splash (\d+)x(\d+) AoE on non-skill attack", r"โจมตีปกติกระจายเป็นวง \1x\2 ช่อง")

# conditions
add(r"\bif Refine (<|>|=) (\d+):", r"ถ้าตีบวก \1 \2:")
add(r"\bif b({S}) (<|>|=) (\d+):", r"ถ้า \1 พื้นฐาน \2 \3:")
add(r"\b[Ii]f ((?:{J})(?:, (?:{J}))*):", r"ถ้าเป็น \1:")
add(r"\b[Ii]f One or Two-Handed Sword:", "ถ้าใช้ดาบมือเดียวหรือสองมือ:")
add(r"\b[Ii]f One or Two-Handed Staff:", "ถ้าใช้ไม้เท้ามือเดียวหรือสองมือ:")
add(r"\b[Ii]f Bow:", "ถ้าใช้ธนู:")
add(r"\b[Ii]f ({K}):", r"ถ้าได้ \1:")

# costs and upkeep
add(r"\bLose ([\d,]+) SP/unequip", r"เสีย SP \1 เมื่อถอด")
add(r"\bLose ([\d,]+) HP/unequip", r"เสีย HP \1 เมื่อถอด")
add(r"\bLose ([\d,]+) SP/physical attack", r"เสีย SP \1 ต่อการโจมตีกายภาพ")
add(r"\bLose ([\d,]+) HP/(\d+) seconds", r"เสีย HP \1 ทุก \2 วินาที")
add(r"\bRecover ([\d,]+) HP and ([\d,]+) SP/(\d+) seconds",
    r"ฟื้น HP \1 และ SP \2 ทุก \3 วินาที")
add(r"\b[Rr]ecover ([\d,]+) (HP|SP)/melee kill vs\. ({T})",
    lambda m: "ฟื้น " + m.group(2) + " " + m.group(1)
              + " เมื่อฆ่า" + target(m.group(3)) + " ด้วยระยะประชิด")
add(r"\b[Rr]ecover ([\d,]+) (HP|SP)/melee kill", r"ฟื้น \2 \1 เมื่อฆ่าด้วยระยะประชิด")
add(r"\b[Rr]ecover ([\d,]+) (HP|SP)/physical attack", r"ฟื้น \2 \1 ต่อการโจมตีกายภาพ")

# drains, reflects, breaks
add(r"\+(\d+)% chance to recover (\d+)% physical damage as (HP|SP)",
    r"โอกาส \1% ดูดดาเมจกายภาพ \2% กลับมาเป็น \3")
add(r"\+(\d+)% chance (\d+)% SP drain on physical attack",
    r"โอกาส \1% ดูด SP \2% เมื่อโจมตีกายภาพ")
add(r"\+(\d+)% melee damage reflect", r"สะท้อนดาเมจระยะประชิด \1%")
add(r"\+(\S+)% chance(?: of)? single target magic reflect",
    r"โอกาส \1% สะท้อนเวทเป้าหมายเดียว")
add(r"\+(\S+)% chance to reflect single target magic",
    r"โอกาส \1% สะท้อนเวทเป้าหมายเดียว")
add(r"\+(\d+)% chance WpnBreak on physical attack",
    r"โอกาส \1% ทำอาวุธศัตรูแตก เมื่อโจมตีกายภาพ")
add(r"\+(\d+)% chance ArmorBreak on physical attack",
    r"โอกาส \1% ทำเกราะศัตรูแตก เมื่อโจมตีกายภาพ")
add(r"\+(\d+)% chance of polymorph vs\. non-Boss monster on physical attack",
    r"โอกาส \1% แปลงร่างมอนที่ไม่ใช่บอส เมื่อโจมตีกายภาพ")

# finding things off corpses - before the chance rules, or "chance to find X on
# monster kill" reads as a chance of something happening on a monster kill
add(r"\+([\d.]+)% chance to find (.+?) on ({T}) kill",
    lambda m: "โอกาส " + m.group(1) + "% ได้ " + m.group(2) + " เมื่อฆ่า" + target(m.group(3)))
add(r"\+([\d.]+)% chance to find (.+?) on monster kill", r"โอกาส \1% ได้ \2 เมื่อฆ่ามอน")
add(r"\+([\d.]+)% chance to find (.+)$", r"โอกาส \1% ได้ \2")
add(r"\+([\d.]+)% (.+?) on ({T}) kill",
    lambda m: "โอกาส " + m.group(1) + "% ได้ " + m.group(2) + " เมื่อฆ่า" + target(m.group(3)))
add(r"\+([\d.]+)% (.+?) on monster kill", r"โอกาส \1% ได้ \2 เมื่อฆ่ามอน")
add(r"\+(\d+)% recovery from (.+)$", r"ฟื้นฟูจาก \2 +\1%")

# damage out
add(r"\+(\d+)% physical, magical damage vs\. ((?:{T})(?:,? (?:and )?(?:{T}))*)",
    lambda m: "ดาเมจกายภาพและเวท +" + m.group(1) + "% ต่อ" + targets(m.group(2)))
add(r"\+(\d+)% physical damage vs\. ((?:{T})(?:,? (?:and )?(?:{T}))*)",
    lambda m: "ดาเมจกายภาพ +" + m.group(1) + "% ต่อ" + targets(m.group(2)))
add(r"\+(\d+)% magical damage vs\. ((?:{T})(?:,? (?:and )?(?:{T}))*)",
    lambda m: "ดาเมจเวท +" + m.group(1) + "% ต่อ" + targets(m.group(2)))
add(r"\+(\d+)% physical damage vs\.? ((?:{K})[^.]*?(?:{K}))\.?$",
    r"ดาเมจกายภาพ +\1% ต่อ\2")
add(r"(\d+)% defense bypass vs\.? ((?:{K})[^.]*?(?:{K}))\.?$", r"เจาะ DEF \1% ต่อ\2")
add(r"\+(\d+)% range physical damage", r"ดาเมจกายภาพระยะไกล +\1%")
add(r"\+(\d+)% physical damage", r"ดาเมจกายภาพ +\1%")
add(r"\bCRIT \+(\d+) vs\. ((?:{T})(?:,? (?:and )?(?:{T}))*)",
    lambda m: "CRIT +" + m.group(1) + " ต่อ" + targets(m.group(2)))
add(r"\bCRIT \+(\d+) \(range attack\)", r"CRIT +\1 (โจมตีระยะไกล)")
add(r"\+(\d+)% (DEF|MDEF) ignore vs\. ({T})",
    lambda m: "เจาะ " + m.group(2) + " " + m.group(1) + "% กับ" + target(m.group(3)))
add(r"\+(\d+)% (DEF|MDEF) ignore", r"เจาะ \2 \1%")

# damage in
add(r"-(\d+)% damage from range(?: attacks)?", r"รับดาเมจระยะไกล -\1%")
add(r"([+-])(\d+)% damage from non-Neutral attacks",
    r"รับดาเมจจากธาตุที่ไม่ใช่ไร้ธาตุ \1\2%")
add(r"([+-])(\d+)% damage from ((?:{E})(?:, (?:{E}))*)"
    r"(?: Property attacks| Element attacks| attacks| Property| Element)",
    lambda m: "รับดาเมจ" + targets(m.group(3)) + " " + m.group(1) + m.group(2) + "%")
add(r"([+-])(\d+)% damage from ((?:{R})(?:, (?:{R}))*) type monsters",
    lambda m: "รับดาเมจจาก" + targets(m.group(3)) + " " + m.group(1) + m.group(2) + "%")
add(r"([+-])(\d+)% damage from ((?:{T})(?:, (?:{T}))*)",
    lambda m: "รับดาเมจจาก" + targets(m.group(3)) + " " + m.group(1) + m.group(2) + "%")
add(r"\+(\d+)% EXP from ({T})",
    lambda m: "EXP จาก" + target(m.group(2)) + " +" + m.group(1) + "%")

# how long a proc lasts, before the chance that starts it
add(r"\bfor (\d+) seconds\b", r"นาน \1 วินาที")

# autocast and lethal hits are written as "a chance of", so they go in before the rule
# that reads anything after "chance of" as a status being put on somebody
add(r"\+?([\d.]+)% chance to auto(?:cast|spell) (.+?) on ({W})\.?",
    lambda m: "โอกาส " + m.group(1) + "% ร่ายอัตโนมัติ " + m.group(2) + " " + when(m.group(3)))
add(r"Adds \((\d+) ?\* ?Refine\)% chance to auto(?:cast|spell) (.+?) when receiving melee damage",
    r"โอกาส (\1×ตีบวก)% ร่ายอัตโนมัติ \2 เมื่อโดนโจมตีระยะประชิด")
add(r"Adds a (\d+)% chance to strike twice with any weapon\.",
    r"โอกาส \1% ตี 2 ครั้ง ไม่ว่าจะใช้อาวุธอะไร")
add(r"\+?([\d.]+)% chance (?:of dealing|to deal) lethal damage to ({T}) on attack",
    lambda m: "โอกาส " + m.group(1) + "% ออกดาเมจสังหารต่อ" + target(m.group(2)))
add(r"\+?([\d.]+)% chance (?:of dealing|to deal) lethal damage to on attack",
    r"โอกาส \1% ออกดาเมจสังหาร")
add(r"\+(\d+)% chance (?:WeaponBreak|WpnBreak) on physical attack",
    r"โอกาส \1% ทำอาวุธศัตรูแตก เมื่อโจมตีกายภาพ")
add(r"\+(\d+)% double attack chance", r"โอกาสออก Double Attack +\1%")

# a chance of something, and what set it off
add(r"\+?([\d.]+)% chance(?: of)? (.+?) \(self\) on ({W})",
    lambda m: "โอกาส " + m.group(1) + "% ติด " + m.group(2) + " เอง " + when(m.group(3)))
add(r"\+?([\d.]+)% chance(?: of)? (.+?) on ({W})",
    lambda m: "โอกาส " + m.group(1) + "% " + gets(m.group(2)) + " " + m.group(2)
              + " " + when(m.group(3)))

# resists
add(r"\+(\d+)% resist (.+?) status", r"ต้านทาน \2 +\1%")
add(r"-(\d+)% damage from (.+?) status", r"รับดาเมจจากสถานะ \2 -\1%")
add(r"\+(\d+)% (.+?) resist", r"ต้านทาน \2 +\1%")

# autospell
add(r"([+-])([\d.]+)% [Aa]utospell (.+?) \((self|enemy)\) on ({W})",
    lambda m: "โอกาส " + sign(m.group(1)) + m.group(2) + "% ร่ายอัตโนมัติ " + m.group(3)
              + " " + selfword(m.group(4)) + " " + when(m.group(5)))
add(r"([+-])([\d.]+)% [Aa]uto(?:spell|cast) (.+?) on ({W})",
    lambda m: "โอกาส " + sign(m.group(1)) + m.group(2) + "% ร่ายอัตโนมัติ " + m.group(3)
              + " " + when(m.group(4)))
add(r"([+-])([\d.]+)% autocast (.+?) when taking physical damage\.",
    lambda m: "โอกาส " + sign(m.group(1)) + m.group(2)
              + "% ร่ายอัตโนมัติ " + m.group(3) + " เมื่อโดนโจมตีกายภาพ")
add(r"\b[Aa]utospell (.+?) instead", r"ร่ายอัตโนมัติ \1 แทน")
add(r"\+?([\d.]+)% [Aa]utospell instead", r"โอกาส \1% แทน")
add(r"\+?([\d.]+)% chance instead", r"โอกาส \1% แทน")
add(r"\+(\d+) cell knockback on (.+?)$", r"\2 ผลักถอย \1 ช่อง")

# skill damage: only ever a list of stashed skill names, so it is spelled that way
# rather than as "anything ending in damage", which would eat half the file
add(r"\+(\d+)% ((?:{K})(?:, ?(?:{K}))*) damage$", r"ดาเมจ \2 +\1%")
add(r"\+(\d+)% ({K}) recovery$", r"ฟื้นฟูจาก \2 +\1%")

# what a potion gives back. The amount sits in its own green span, which is markup by
# the time this runs, so the rule moves the whole stashed lump rather than the number.
add(r"\bRecover((?:{K})[\s\d~]+(?:{K}))\s*(HP|SP) and((?:{K})[\s\d~]+(?:{K}))\s*(HP|SP)",
    r"ฟื้น \2\1 และ \4\3")
add(r"\bRecover((?:{K})[\s\d~]+(?:{K}))\s*(HP|SP)", r"ฟื้น \2\1")
add(r"\bRecover (\d+)% (HP|SP)", r"ฟื้น \2 \1%")
add(r"\bRecover (\d+) (HP|SP)/melee attack vs\. ({T})",
    lambda m: "ฟื้น " + m.group(2) + " " + m.group(1)
              + " ต่อการโจมตีระยะประชิดใส่" + target(m.group(3)))
add(r"\bRecover (\d+) (HP|SP)/melee attack", r"ฟื้น \2 \1 ต่อการโจมตีระยะประชิด")
add(r"^Cures: ", "แก้อาการ: ")
add(r"^Contains a random item\.", "เปิดแล้วได้ของสุ่ม 1 ชิ้น")
add(r"Increases attack speed, reducing the delay between your attacks by (\d+)% "
    r"for (\d+) minutes\.",
    r"เพิ่มความเร็วโจมตี ลดดีเลย์ระหว่างการโจมตี \1% นาน \2 นาที")

# arrows
add(r"^\[Properties\]Arrow Attack: (\d+)", r"[คุณสมบัติ]พลังโจมตีลูกศร: \1")
add(r"^Arrow Property: ", "ธาตุลูกศร: ")

# weapons and gear
add(r"\bAll Stats \+ ?(\d+)", r"ทุกสเตตัส +\1")
add(r"^Indestructible$", "ไม่แตก")
add(r"\bAttack Range \+(\d+)", r"ระยะโจมตี +\1")
add(r"\bEnable use of (.+?)\.?$", r"ใช้ \1 ได้")
add(r"\bASPD \+Refine%", "ASPD +(ตีบวก)%")
add(r"\bINT \+\(Refine \+ (\d+)\)", r"INT +(ตีบวก + \1)")
add(r"\bINT \+\((\d+) \+ Refine\)", r"INT +(ตีบวก + \1)")
add(r"\bEvery (\d+) refine increase MATK by (\d+)%\.", r"ทุกๆ ตีบวก \1 ขั้น MATK +\2%")
add(r"\bEvery refine increases SP cost by (\d+)%\.", r"ตีบวกทุกขั้น ใช้ SP +\1%")
add(r"(\d+(?:\.\d+)?)% of physical damage dealt is recovered as (HP|SP)\.",
    r"ดูดดาเมจกายภาพ \1% กลับมาเป็น \2")
add(r"(\d+)% defense bypass vs\.? (.+?)\.?$", r"เจาะ DEF \1% ต่อ\2")
add(r"-\((\d+) \+ Refine\)% damage taken from medium size enemies\.",
    r"รับดาเมจจากศัตรูขนาดกลาง -(\1 + ตีบวก)%")
add(r"\bIncreases damage against mushroom and fungus type monsters by \+(\d+)%",
    r"ดาเมจต่อมอนประเภทเห็ดและรา +\1%")
add(r"\+(\d+)% damage against ((?:{T})(?:,? (?:and )?(?:{T}))*)(?: monsters)?\.",
    lambda m: "ดาเมจ +" + m.group(1) + "% ต่อ" + targets(m.group(2)))
add(r"\+(\d+)% damage received", r"รับดาเมจ +\1%")
add(r"-(\d+)% damage from physical", r"รับดาเมจกายภาพ -\1%")
add(r"-(\d+)% damage from range attacks", r"รับดาเมจระยะไกล -\1%")
add(r"\+(\d+)% damage vs\.? ((?:{T})(?:,? (?:and )?(?:{T}))*)\.?",
    lambda m: "ดาเมจ +" + m.group(1) + "% ต่อ" + targets(m.group(2)))
add(r"\+(\d+) CRIT vs\.? ({T})",
    lambda m: "CRIT +" + m.group(1) + " ต่อ" + target(m.group(2)))
add(r"(โบนัสเซ็ต(?:{K})) with ", r"\1 กับ ")
add(r"((?:{K})) or ((?:{K}))", r"\1 หรือ \2")
add(r"\bSp Consumption\b", "ใช้ SP")

# the plain words
add(r"\bHP Regeneration\b", "ฟื้นฟู HP")
add(r"\bSP Regeneration\b", "ฟื้นฟู SP")
add(r"\bSP Consumption\b", "ใช้ SP")
add(r"\bCast Time -\(Refine\)%", "เวลาร่าย -(ตีบวก)%")
add(r"\bCast Time\b", "เวลาร่าย")
add(r"\bCast Delay\b", "ดีเลย์หลังร่าย")
add(r"\bCRIT damage\b", "ดาเมจ CRIT")
add(r"\bMovement Speed\b", "ความเร็วเดิน")
add(r"\+\(floor b({S})/(\d+)\)", r"+(\1 พื้นฐาน/\2 ปัดลง)")
add(r"\bfloor\(jLv/(\d+)\)", r"(Job Lv/\1 ปัดลง)")
add(r"([\d.]+)\*jLv", r"\1×Job Lv")
add(r"\((\d+) - (\d+)\*Refine\)", r"(\1 - \2×ตีบวก)")
add(r"\((\d+)\*Refine\)", r"(\1×ตีบวก)")
add(r"\(Refine - (\d+)\)", r"(ตีบวก - \1)")
add(r"\(Refine\)", "(ตีบวก)")
add(r"\bAgi\b", "AGI")
add(r"\bInt\b", "INT")
add(r"\bVit\b", "VIT")
add(r"\bStr\b", "STR")
add(r"\bDex\b", "DEX")
add(r"\bLuk\b", "LUK")
add(r"\bINT \+ (\d+)", r"INT +\1")

# --- the sentences ------------------------------------------------------------

#What a thing is, as against what it does. One line per sentence, tab separated, so a
#sentence used by twenty items is translated once and reads the same on all twenty.
PROSE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prose.tsv")
PROSE = {}
if os.path.exists(PROSE_FILE):
    for line in io.open(PROSE_FILE, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line or line.startswith("#") or "\t" not in line:
            continue
        en, th = line.split("\t", 1)
        if th.strip():
            PROSE[en] = th

#Three colours carry describing text rather than numbers: the desc shorthand, the grey
#the exporter turns it into, and the darker grey used for the notes under a skill.
OPENERS = r"<desc>|<color=#808080>|<color=#777777>"
CLOSERS = r"</desc>|</color>"
#Greedy on purpose: a sentence can have a colour span inside it, and stopping at
#the first closer would cut the sentence in half and leave the tail untranslated.
DESC_SPAN = re.compile(r"(%s)(.*)(%s)" % (OPENERS, CLOSERS), re.I)
#Two entries in the whole corpus run a description across two lines
DESC_OPEN = re.compile(r"(%s)([^<]+)$" % OPENERS, re.I)
DESC_CLOSE = re.compile(r"^([^<]+)(%s)" % CLOSERS, re.I)
HAS_WORD = re.compile(r"[A-Za-z]{2,}")

missing_prose = []


def swap(text):
    """The sentence's Thai, or the English again with a note that it is still needed."""
    if not HAS_WORD.search(text):
        return text                     # a number in a coloured span is already Thai
    if text in PROSE:
        return PROSE[text]
    missing_prose.append(text)
    return text


def prose(line):
    """The describing sentences on this line swapped for their Thai."""
    line = DESC_SPAN.sub(lambda m: m.group(1) + swap(m.group(2)) + m.group(3), line)
    line = DESC_OPEN.sub(lambda m: m.group(1) + swap(m.group(2)), line)
    return DESC_CLOSE.sub(lambda m: swap(m.group(1)) + m.group(2), line)


# --- running it ---------------------------------------------------------------

TAGGED = re.compile(r"<color=#008080>.*?</color>|<color=#0000FF>.*?</color>"
                    r"|<skill>.*?</skill>|<desc>.*?</desc>"
                    r"|<color=#808080>.*?</color>|<color=#777777>.*?</color>", re.I)
ANYTAG = re.compile(r"</?[a-zA-Z][^>]*>")
#Three spellings of the same thing across the five files: the raw colour, and the two
#shorthand tags the exporter rewrites into it.
STATUS_SPAN = re.compile(r"(<color=#800000>|<status>|<element>|<race>)([^<]+)"
                         r"(</color>|</status>|</element>|</race>)", re.I)

#An arrow's element is written in the skill colour rather than the status one
ELEM_SPAN = re.compile(r"(<color=#0000FF>)(" + alt(ELEMENT) + r")(</color>)", re.I)


def translate(line):
    """One line into Thai, with what must stay English stashed out of the way."""
    #A sentence with no tag around it at all - two of those exist - is looked up whole.
    lead = line[:len(line) - len(line.lstrip())]
    if line.strip() in PROSE:
        return lead + PROSE[line.strip()]

    #then the describing sentences, so what replaces them is Thai before the phrase
    #table ever looks at the line
    line = prose(line)

    #status names are ordinary words rather than links, so they are translated first,
    #before the whole span goes into the stash as markup
    line = STATUS_SPAN.sub(
        lambda m: m.group(1) + STATUS.get(m.group(2),
                                          ELEMENT.get(m.group(2),
                                                      RACE.get(m.group(2), m.group(2))))
                  + m.group(3), line)
    line = ELEM_SPAN.sub(lambda m: m.group(1) + ELEMENT[m.group(2)] + m.group(3), line)

    stash = []

    def hold(m):
        stash.append(m.group(0))
        return STAY + str(len(stash) - 1) + STAY

    out = TAGGED.sub(hold, line)
    out = ANYTAG.sub(hold, out)

    for pattern, repl in RULES:
        out = pattern.sub(repl, out)

    for i, held in enumerate(stash):
        out = out.replace(STAY + str(i) + STAY, held)
    return out


WORD = re.compile(r"[A-Za-z][A-Za-z'\-]+")


def residue(line):
    """English still standing after the table ran, minus what is allowed to stay."""
    bare = ANYTAG.sub(" ", TAGGED.sub(" ", line))
    return [w for w in WORD.findall(bare) if w not in KEEP]


def main(path, apply_it, dump):
    raw = io.open(path, "rb").read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    lines = raw.decode("utf-8-sig").split("\n")

    out = []
    unhandled = {}
    for n, line in enumerate(lines, 1):
        if line.startswith("::") or line.startswith("//") or not line.strip():
            out.append(line)
            continue
        done = translate(line)
        out.append(done)

        #A line that is one hand written sentence has already been decided on, names and
        #all - checking it for English would report the proper nouns somebody chose to keep
        if line.strip() in PROSE:
            continue

        left = residue(done)
        if left:
            unhandled.setdefault(line, (n, left))

    if dump:
        seen = set()
        for text in missing_prose:
            if text not in seen:
                seen.add(text)
                print(text)
        return 0

    gaps = False

    if missing_prose:
        gaps = True
        seen = sorted(set(missing_prose))
        print("%d sentence(s) with no Thai in prose.tsv (%d uses)"
              % (len(seen), len(missing_prose)))
        for text in seen[:6]:
            print("   ", text[:100])
        if len(seen) > 6:
            print("    ... and %d more; run with --dump to list them all" % (len(seen) - 6))

    if unhandled:
        print("%d line(s) the table does not cover:" % len(unhandled))
        for text, (n, left) in sorted(unhandled.items(), key=lambda kv: kv[1][0]):
            print("  %5d  %-72s  %s" % (n, text[:72], ",".join(sorted(set(left)))))
        gaps = True

    if gaps:
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
