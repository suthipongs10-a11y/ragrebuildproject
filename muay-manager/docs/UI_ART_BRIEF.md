# ภาพ UI สำหรับให้ ChatGPT วาด — Muay Manager

เอกสารนี้ใช้ทำภาพหน้าจอเกมชุดใหม่ ทุกชิ้นวาดให้เข้าชุดกัน แล้วส่งไฟล์กลับมาใส่ในเกม
ตัวหนังสือทุกตัว (ชื่อปุ่ม ตัวเลข ชื่อนักมวย) โค้ดเป็นคนเขียนทับ **ภาพต้องไม่มีตัวอักษร**

**ชุดไฟล์พร้อมส่ง ChatGPT:** `python3 prototypes/fight3d/tools/ui-art-pack.py <ไฟล์.zip> [โฟลเดอร์ภาพหน้าจอ]` ได้ zip ที่มีคำสั่งแยกไฟล์ละภาพ (53 ภาพ เรียงตามความสำคัญ) คำอธิบายงานสำหรับ ChatGPT คู่มือภาษาไทย ภาพสี และภาพหน้าจอเกมปัจจุบัน
ChatGPT วาดได้แค่ 1024×1024, 1536×1024, 1024×1536 คำสั่งในชุดนั้นตั้งขนาดตามนี้ ขนาดในตารางข้อ 4 คือขนาดที่ใช้ในเกม (ย่อให้ภายหลัง)

## 1. วิธีสั่ง ChatGPT

1. เปิดแชตใหม่หนึ่งแชตต่อหนึ่งหมวด (ไอคอนแชตหนึ่ง ฉากหลังอีกแชตหนึ่ง) ภาพในแชตเดียวกันจะออกมาเข้าชุดกันกว่า
2. วาง **STYLE** (ข้อ 3) ไว้ก่อนทุกคำสั่ง แล้วต่อด้วยคำสั่งของชิ้นนั้น (ข้อ 5)
3. ชิ้นแรกที่ได้ ถ้าชอบ ให้บอก ChatGPT ว่า "keep exactly this style for every next image in this chat"
4. ไอคอนและกรอบ ขอเป็น PNG พื้นหลังโปร่งใส ฉากหลังขอเป็น PNG หรือ JPG
5. ตั้งชื่อไฟล์ตามตารางข้อ 4 แล้วส่งมาทั้งชุด (ส่งในแชตนี้ได้เลย) จะย่อ ตัดขอบ และใส่เข้าเกมให้

ตรวจก่อนส่ง
- ไม่มีตัวอักษร ตัวเลข หรือลายเซ็นในภาพ (ChatGPT ชอบแอบใส่ ถ้ามีให้สั่ง "remove all text")
- ไม่มีโลโก้ช่องทีวี สปอนเซอร์ ยี่ห้อเครื่องดื่ม หรือชื่อเวทีจริง (เกมจะลงสโตร์ ใช้ของคนอื่นไม่ได้)
- ไม่มีหน้าคนจริงหรือนักมวยจริง
- ไอคอนชุดเดียวกัน เส้นหนาเท่ากัน มุมมองเดียวกัน

## 2. แนวภาพ

"ศึกมวยคืนวันเสาร์ถ่ายทอดสด": เวทีสว่างกลางความมืด แสงไฟส่องลงจากบน ทองเหลืองกับแดงน้ำเงินของมุมมวย
ลายไทย (กนก ประจำยาม) ใช้แค่ที่มุมกรอบและเส้นขอบ ไม่ถมเต็มภาพ อ่านง่ายบนจอมือถือก่อนความสวย

| ชื่อ | สี | ใช้ทำอะไร |
|---|---|---|
| พื้นหลัง | `#0E0F14` | ฉากหลังทั้งเกม |
| แผง | `#181A22` เส้นขอบ `#2A2D39` | การ์ด แผงข้อมูล |
| ทอง | `#F2B83A` | ปุ่มหลัก ของรางวัล ลายไทย |
| มุมแดง | `#E2382F` | ฝั่งผู้เล่นหรือมุมแดง |
| มุมน้ำเงิน | `#2F76EA` | คู่ชกหรือมุมน้ำเงิน |
| ตัวหนังสือ | `#F1F2F5` รองลงมา `#9A9FB0` | (โค้ดเขียนเอง) |

ตัวหนังสือในเกม: Kanit (หัวข้อ) และ IBM Plex Sans Thai (เนื้อหา) ไม่ต้องให้ ChatGPT ทำ

## 3. STYLE (วางก่อนทุกคำสั่ง)

```
STYLE: Mobile game UI art for a Muay Thai fighter-management game. Night stadium broadcast mood: deep charcoal
background (#0E0F14), warm overhead spotlights, polished gold (#F2B83A) as the accent, red corner (#E2382F) and
blue corner (#2F76EA) as the two team colours. Semi-realistic painted style with clean shapes, soft rim light,
subtle film grain. Thai ornamental motifs (kanok flame patterns, prajam yam flowers) only as thin gold trim on
edges and corners, never filling the image. Readable at small size on a phone. Absolutely no text, letters,
numbers, logos, watermarks, brand names, sponsor boards or TV channel marks anywhere in the image. No real
people, no recognisable real fighters, no real stadium names.
```

## 4. รายการภาพ

ลำดับความสำคัญ: **A** = ต้องมีก่อนลงสโตร์ • **B** = ทำให้เกมดูครบ • **C** = ทำทีหลังได้

| # | ไฟล์ | ขนาด | สำคัญ | ใช้ที่ |
|---|---|---|---|---|
| 1 | `app-icon.png` | 1024×1024 ไม่โปร่งใส | A | ไอคอนแอปบนมือถือและหน้าสโตร์ |
| 2 | `logo.png` | 1600×600 โปร่งใส | A | หน้าแรก (ภาพนี้ยกเว้นให้มีตัวอักษร MUAY MANAGER ได้) |
| 3 | `title-portrait.jpg` | 1080×1920 | A | ฉากหลังหน้าแรก แนวตั้ง |
| 4 | `title-landscape.jpg` | 1920×1080 | B | ฉากหลังหน้าแรก แนวนอน |
| 5–9 | `tab-camp.png` `tab-train.png` `tab-dress.png` `tab-fight.png` `tab-rank.png` | 256×256 โปร่งใส | A | ปุ่มเมนูล่าง: ค่าย ซ้อม แต่งตัว หาคู่ชก อันดับ |
| 10–17 | `act-bag.png` `act-banana.png` `act-dummy.png` `act-rope.png` `act-spar.png` `act-run.png` `act-fun.png` `act-rest.png` | 256×256 โปร่งใส | A | การ์ดกิจกรรมซ้อม |
| 18–21 | `staff-punch.png` `staff-kick.png` `staff-tech.png` `staff-massage.png` | 512×512 โปร่งใส | B | ทีมงานในค่าย: ครูหมัด ครูเตะ ครูเชิง หมอนวด |
| 22–26 | `belt-1.png` … `belt-5.png` | 768×384 โปร่งใส | B | เข็มขัด: งานวัด อำเภอ จังหวัด เวทีมาตรฐาน แชมป์ประเทศ |
| 27–32 | `venue-temple.png` `venue-province.png` `venue-stadium.png` `venue-champ.png` `venue-chuek.png` `venue-camp.png` | 960×540 | B | การ์ดเลือกเวที |
| 33 | `panel.png` | 512×512 โปร่งใส | A | กรอบการ์ด (ยืดได้ ต้องมีลายเฉพาะที่มุม) |
| 34 | `button-gold.png` `button-dark.png` | 512×160 โปร่งใส | A | ปุ่มหลัก ปุ่มรอง (ยืดได้) |
| 35 | `corner-red.png` `corner-blue.png` | 256×256 โปร่งใส | B | ป้ายมุมแดง มุมน้ำเงิน |
| 36 | `icon-baht.png` `icon-fame.png` `icon-rp.png` `icon-fatigue.png` | 128×128 โปร่งใส | A | เงิน ชื่อเสียง คะแนนอันดับ ความล้า |
| 37–41 | `mood-1.png` … `mood-5.png` | 128×128 โปร่งใส | B | อารมณ์: แย่มาก แย่ ปกติ ดี ดีเยี่ยม |
| 42 | `ribbon-win.png` `ribbon-lose.png` | 1200×300 โปร่งใส | B | แถบผลการชก (โค้ดเขียนคำว่า ชนะน็อก/ชนะคะแนน ทับ) |
| 43 | `loading.jpg` | 1080×1920 | C | หน้าระหว่างโหลด |
| 44–48 | `style-puncher.png` `style-kicker.png` `style-clinch.png` `style-tech.png` | 512×512 โปร่งใส | C | การ์ดสายมวย: หมัดหนัก จอมเตะ เข่าศอก ฝีมือ |

## 5. คำสั่งแต่ละชิ้น (วางต่อท้าย STYLE)

**1 ไอคอนแอป**
```
App icon, 1024x1024, square with no rounded corners (the store rounds them). A red boxing glove and a blue boxing
glove crossing in front of a gold mongkol headband, ring ropes behind, spotlight from above, dark background.
Bold, simple silhouette that still reads at 48 pixels. No text.
```

**2 โลโก้** (ชิ้นเดียวที่มีตัวอักษร)
```
Game logo on a transparent background, 1600x600. The words "MUAY MANAGER" in heavy italic sans-serif capitals,
"MUAY" in white and "MANAGER" in gold, with a thin gold kanok flame ornament sweeping under the words and a small
mongkol headband icon to the left. Spell the words exactly. Nothing else.
```

**3–4 ฉากหลังหน้าแรก**
```
Title screen background, [portrait 1080x1920 | landscape 1920x1080]. An empty Muay Thai ring seen from a low angle
at ringside, warm spotlights in a hazy dark stadium, red and blue corner posts, crowd as soft dark silhouettes far
behind. Keep the [top third | left half] darker and quiet so a logo and buttons can sit on it. No people in the
ring, no text.
```

**5–9 ไอคอนเมนู** (สั่งทีละอัน เปลี่ยนแค่ของในวงเล็บ)
```
Menu icon, 256x256, transparent background. A single object drawn in polished gold with a thin dark outline and a
soft glow, front view, centred, filling about 70% of the square: [a wooden Thai boxing camp gate with a hanging
sign board left blank | a heavy punching bag on a chain | a pair of Muay Thai shorts | a pair of boxing gloves tied
together | a trophy on a small podium]. Same line weight and lighting for the whole set. No text.
```

**10–17 ไอคอนกิจกรรมซ้อม**
```
Training activity icon, 256x256, transparent background, painted style with gold rim light, centred object:
[a red leather heavy bag | a banana tree trunk with a kick mark | a padded wooden training dummy | a skipping rope in
a loop | two pairs of sparring gloves touching | running shoes on a dirt road | a fishing rod and a bowl of noodles |
a massage mat with a bottle of liniment oil]. Same style for the whole set. No text.
```

**18–21 ทีมงาน** (ตัวละครคิดขึ้นใหม่ ไม่ใช่คนจริง)
```
Character portrait, 512x512, transparent background, chest-up, three-quarter view, friendly and tough:
[an older Thai boxing coach with a whistle and focus mitts | a wiry kicking coach holding Thai pads |
a calm technique teacher with a towel over the shoulder | a masseur with a bottle of oil]. Fictional person,
consistent painted style for all four. No text.
```

**22–26 เข็มขัด** (ห้าระดับ ของยิ่งสูงยิ่งหรู)
```
Championship belt, front view, 768x384, transparent background. Level [1 of 5: simple red cloth belt with a small
brass plate | 2: leather belt with a bronze plate | 3: leather belt with a silver plate and side plates |
4: gold plate with red enamel and Thai flame trim | 5: large ornate gold plate, red and blue enamel, gems,
kanok flame crest]. The centre plate is blank: no text, no flag, no logo.
```

**27–32 เวที**
```
Venue card illustration, 960x540, wide shot of a Muay Thai ring: [a temple fair ring at night with string lights,
food stalls and a temple roof behind | a provincial hall with wooden stands and fluorescent lights |
a standard stadium with tiered seats under bright lights | a championship arena with a big crowd, haze and
gold light beams | a dirt ground at an old temple for a rope-fist bout, torches and banana trees | a training camp
with a ring under a tin roof, heavy bags hanging]. No people in the ring, no text, no sponsor boards.
```

**33–34 กรอบการ์ดและปุ่ม**
```
UI panel frame, 512x512, transparent background. A dark charcoal card (#181A22) with rounded corners, a 2-pixel
muted border (#2A2D39) and small gold kanok ornaments only in the four corners; the middle and the straight edges
stay plain so the frame can be stretched. No text.
```
```
UI button, 512x160, transparent background, rounded rectangle, [polished gold (#F2B83A) with a darker gold bottom
edge and a soft top highlight | dark charcoal with a thin gold border]. Plain, no icon, no text, so it can be
stretched horizontally.
```

**35 ป้ายมุม**
```
Corner badge, 256x256, transparent background: a ring corner post pad in [red | blue] with a small gold diamond
emblem, slight 3D, spotlight from above. No text.
```

**36 ไอคอนค่าต่าง ๆ**
```
Small currency icon, 128x128, transparent background, gold with dark outline, readable at 24 pixels:
[a gold coin with a plain face | a gold star with a spark | a gold shield with an upward arrow |
a water bottle and a towel]. No letters or symbols on the object.
```

**37–41 อารมณ์**
```
Mood icon, 128x128, transparent background, a simple round boxer face with a headband, flat colours with a gold
outline, expression: [exhausted and gloomy | tired | neutral | happy | fired up with sparkles]. Same face for all
five, only the expression changes. No text.
```

**42 แถบผล**
```
Result ribbon banner, 1200x300, transparent background, wide horizontal ribbon with folded ends, [gold with
red edges and light rays behind | dark grey with a cracked texture]. The middle is plain and empty for text
added later. No text.
```

## 6. ส่งกลับมาแล้วทำอะไรต่อ

- ย่อเป็น WebP และตัดขอบโปร่งใสให้ ไอคอนเหลือชิ้นละ 5–20 KB
- หน้าทดลองบน claude.ai จำกัด 16 MB ต่อหน้า (ตอนนี้ใช้ 13.7 MB) จึงใส่ภาพย่อเฉพาะที่จำเป็น ส่วนแอปบนสโตร์ไม่มีเพดานนี้ ใส่ภาพเต็มได้
- ภาพที่ใช้จริงจะเก็บที่ `prototypes/fight3d/assets/ui/` ชื่อไฟล์ตามตารางข้อ 4
