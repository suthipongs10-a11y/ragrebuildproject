#!/usr/bin/env python3
"""Turns the card descriptions into Thai, and reports whatever it could not turn.

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

  python3 thaicards.py <file>            say what is not covered
  python3 thaicards.py <file> --apply    write it
"""
import io
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
    "Chaos": "สับสน", "Bleed": "เลือดออก", "Coma": "โคม่า",
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
Gemstone Autospell Job Lv""".split())
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
add(r"\bEnables use of (.+?)\.", r"ใช้ \1 ได้")
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
add(r"\+(\d+)% range physical damage", r"ดาเมจกายภาพระยะไกล +\1%")
add(r"\+(\d+)% physical damage", r"ดาเมจกายภาพ +\1%")
add(r"\bCRIT \+(\d+) vs\. ((?:{T})(?:,? (?:and )?(?:{T}))*)",
    lambda m: "CRIT +" + m.group(1) + " ต่อ" + targets(m.group(2)))
add(r"\bCRIT \+(\d+) \(range attack\)", r"CRIT +\1 (โจมตีระยะไกล)")
add(r"\+(\d+)% (DEF|MDEF) ignore vs\. ({T})",
    lambda m: "เจาะ " + m.group(2) + " " + m.group(1) + "% กับ" + target(m.group(3)))
add(r"\+(\d+)% (DEF|MDEF) ignore", r"เจาะ \2 \1%")

# damage in
add(r"-(\d+)% damage from range", r"รับดาเมจระยะไกล -\1%")
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

# --- running it ---------------------------------------------------------------

TAGGED = re.compile(r"<color=#008080>.*?</color>|<color=#0000FF>.*?</color>"
                    r"|<skill>.*?</skill>", re.I)
ANYTAG = re.compile(r"</?[a-zA-Z][^>]*>")
STATUS_SPAN = re.compile(r"(<color=#800000>)([^<]+)(</color>)", re.I)


def translate(line):
    """One line into Thai, with what must stay English stashed out of the way."""
    #status names are ordinary words rather than links, so they are translated first,
    #before the whole span goes into the stash as markup
    line = STATUS_SPAN.sub(
        lambda m: m.group(1) + STATUS.get(m.group(2), ELEMENT.get(m.group(2), m.group(2)))
                  + m.group(3), line)

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


def main(path, apply_it):
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
        left = residue(done)
        if left:
            unhandled.setdefault(line, (n, left))

    if unhandled:
        print("%d line(s) the table does not cover:" % len(unhandled))
        for text, (n, left) in sorted(unhandled.items(), key=lambda kv: kv[1][0]):
            print("  %5d  %-72s  %s" % (n, text[:72], ",".join(sorted(set(left)))))
        return 1

    print("every line translated")
    if apply_it:
        body = "\n".join(out)
        io.open(path, "wb").write((b"\xef\xbb\xbf" if bom else b"") + body.encode("utf-8"))
        print("written to", path)
    return 0


if __name__ == "__main__":
    files = [a for a in sys.argv[1:] if not a.startswith("--")]
    sys.exit(main(files[0], "--apply" in sys.argv))
