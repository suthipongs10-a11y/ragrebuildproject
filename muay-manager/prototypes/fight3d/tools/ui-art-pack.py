# Builds the zip the owner hands to ChatGPT to draw the game's UI art: instructions for ChatGPT, a Thai guide for the
# owner, the shared style block, one ready-to-paste prompt per image, a list of every image, a palette card and
# screenshots of the current game for reference. The Thai overview of the same art is docs/UI_ART_BRIEF.md.
# Usage: python3 tools/ui-art-pack.py <out.zip> [folder with ref-*.png screenshots]     (needs Pillow)
import csv, io, os, sys, zipfile
from PIL import Image, ImageDraw

STYLE = """STYLE: Mobile game UI art for a Muay Thai fighter-management game. Night stadium broadcast mood: deep charcoal
background (#0E0F14), warm overhead spotlights, polished gold (#F2B83A) as the accent, red corner (#E2382F) and
blue corner (#2F76EA) as the two team colours. Semi-realistic painted style with clean shapes, soft rim light,
subtle film grain. Thai ornamental motifs (kanok flame patterns, prajam yam flowers) only as thin gold trim on
edges and corners, never filling the image. Readable at small size on a phone. Absolutely no text, letters,
numbers, logos, watermarks, brand names, sponsor boards or TV channel marks anywhere in the image. No real
people, no recognisable real fighters, no real stadium names."""

SQ, WIDE, TALL = '1024x1024', '1536x1024', '1024x1536'  # the sizes ChatGPT can draw; the game scales them down
ICON = ('Menu icon, transparent background. A single object drawn in polished gold with a thin dark outline and a soft glow, '
        'front view, centred, filling about 70% of the square: {}. Same line weight and lighting for the whole set. No text.')
ACT = ('Training activity icon, transparent background, painted style with gold rim light, one centred object filling about '
       '70% of the square: {}. Same style for the whole set. No text.')
STAFF = ('Character portrait, transparent background, chest-up, three-quarter view, friendly and tough: {}. A fictional person, '
         'consistent painted style for all four portraits. No text.')
BELT = ('Championship belt seen from the front, laid out flat and centred, transparent background. {} The centre plate is blank: '
        'no text, no flag, no logo.')
VENUE = ('Venue card illustration, wide shot of a Muay Thai ring: {}. Keep the ring in the middle band: the game trims the top and '
         'bottom to a 16:9 card. No people in the ring, no text, no sponsor boards.')
MOOD = ('Mood icon, transparent background, a simple round boxer face wearing a headband, flat colours with a gold outline, '
        'expression: {}. The same face for all five, only the expression changes. No text.')
STYLECARD = ('Fighting-style card art, transparent background: a fictional Muay Thai fighter as a dramatic silhouette lit in gold '
             'rim light, {}. Same framing and lighting for all four. No text.')

# file, priority (A: needed before the stores, B: makes the game look complete, C: later), draw size, final size,
# transparent?, where it is used, prompt
A = [
 ('app-icon.png', 'A', SQ, '1024x1024', False, 'App icon on the phone and in the stores',
  'App icon, square with no rounded corners (the store rounds them). A red boxing glove and a blue boxing glove crossing in front '
  'of a gold mongkol headband, ring ropes behind, spotlight from above, dark background. Bold, simple silhouette that still reads '
  'at 48 pixels. No text.'),
 ('logo.png', 'A', WIDE, '1600x600', True, 'Title screen logo (the only image with letters)',
  'Game logo on a transparent background. The words "MUAY MANAGER" in heavy italic sans-serif capitals, "MUAY" in white and '
  '"MANAGER" in gold, with a thin gold kanok flame ornament sweeping under the words and a small mongkol headband icon to the '
  'left. Spell the words exactly, with nothing else written. Exception to the STYLE rule on text: this is the only image in the '
  'set with letters, and only these two words.'),
 ('title-portrait.jpg', 'A', TALL, '1080x1920', False, 'Title screen background, phone held upright',
  'Title screen background, portrait. An empty Muay Thai ring seen from a low angle at ringside, warm spotlights in a hazy dark '
  'stadium, red and blue corner posts, the crowd as soft dark silhouettes far behind. Keep the top third darker and quiet so a '
  'logo and buttons can sit on it. Keep the ring in the middle: the game trims the left and right edges to fit tall phones. '
  'No people in the ring, no text.'),
 ('title-landscape.jpg', 'B', WIDE, '1920x1080', False, 'Title screen background, phone held sideways',
  'Title screen background, landscape. An empty Muay Thai ring seen from a low angle at ringside, warm spotlights in a hazy dark '
  'stadium, red and blue corner posts, the crowd as soft dark silhouettes far behind. Keep the left half darker and quiet so a '
  'logo and buttons can sit on it. No people in the ring, no text.'),
]
for f, what, use in [('tab-camp.png', 'a wooden Thai boxing camp gate with a hanging sign board left blank', 'Bottom menu: camp'),
                     ('tab-train.png', 'a heavy punching bag hanging on a chain', 'Bottom menu: training'),
                     ('tab-dress.png', 'a pair of Muay Thai shorts', 'Bottom menu: outfit'),
                     ('tab-fight.png', 'a pair of boxing gloves tied together by the laces', 'Bottom menu: find a fight'),
                     ('tab-rank.png', 'a trophy on a small podium', 'Bottom menu: ranking')]:
    A.append((f, 'A', SQ, '256x256', True, use, ICON.format(what)))
for f, what, use in [('act-bag.png', 'a red leather heavy bag', 'Training: heavy bag'),
                     ('act-banana.png', 'a banana tree trunk with a fresh kick mark', 'Training: kicking the banana tree'),
                     ('act-dummy.png', 'a padded wooden training dummy', 'Training: push-kicking the dummy'),
                     ('act-rope.png', 'a skipping rope lying in a loop', 'Training: skipping and shadow boxing'),
                     ('act-spar.png', 'two pairs of sparring gloves touching', 'Training: sparring'),
                     ('act-run.png', 'running shoes on a dirt road at dawn', 'Training: running'),
                     ('act-fun.png', 'a fishing rod leaning on a bowl of noodles', 'Training: a day off for fun'),
                     ('act-rest.png', 'a massage mat with a bottle of liniment oil', 'Training: rest and massage')]:
    A.append((f, 'A', SQ, '256x256', True, use, ACT.format(what)))
A += [
 ('panel.png', 'A', SQ, '512x512', True, 'Frame behind every card (stretched to fit)',
  'UI panel frame, transparent background. A dark charcoal card (#181A22) with rounded corners, a 2-pixel muted border (#2A2D39) '
  'and small gold kanok ornaments only in the four corners; the middle and the straight edges stay completely plain so the frame '
  'can be stretched. No text.'),
 ('button-gold.png', 'A', WIDE, '512x160', True, 'Main buttons (stretched sideways)',
  'UI button, transparent background, one wide rounded rectangle in polished gold (#F2B83A) with a darker gold bottom edge and a '
  'soft top highlight, centred with empty space around it. Plain: no icon, no text, so it can be stretched horizontally.'),
 ('button-dark.png', 'A', WIDE, '512x160', True, 'Second buttons (stretched sideways)',
  'UI button, transparent background, one wide rounded rectangle in dark charcoal (#181A22) with a thin gold border, centred with '
  'empty space around it. Plain: no icon, no text, so it can be stretched horizontally.'),
]
for f, what, use in [('icon-baht.png', 'a gold coin with a plain face', 'Money'),
                     ('icon-fame.png', 'a gold star with a small spark', 'Fame'),
                     ('icon-rp.png', 'a gold shield with an upward arrow', 'Ranking points'),
                     ('icon-fatigue.png', 'a water bottle with a towel over it', 'Fatigue')]:
    A.append((f, 'A', SQ, '128x128', True, use, 'Small value icon, transparent background, gold with a dark outline, one centred object that '
              'still reads at 24 pixels: ' + what + '. No letters or symbols on the object.'))
for f, what, use in [('staff-punch.png', 'an older Thai boxing coach with a whistle and focus mitts', 'Camp staff: punching coach'),
                     ('staff-kick.png', 'a wiry kicking coach holding a pair of Thai pads', 'Camp staff: kicking coach'),
                     ('staff-tech.png', 'a calm technique teacher with a towel over one shoulder', 'Camp staff: technique coach'),
                     ('staff-massage.png', 'a masseur with a bottle of liniment oil', 'Camp staff: masseur')]:
    A.append((f, 'B', SQ, '512x512', True, use, STAFF.format(what)))
for i, (what, use) in enumerate([
        ('Level 1 of 5, the plainest: a simple red cloth belt with a small brass plate.', 'Belt: temple fair'),
        ('Level 2 of 5: a leather belt with a bronze plate.', 'Belt: district'),
        ('Level 3 of 5: a leather belt with a silver plate and two side plates.', 'Belt: province'),
        ('Level 4 of 5: a gold plate with red enamel and Thai flame trim.', 'Belt: standard stadium'),
        ('Level 5 of 5, the grandest: a large ornate gold plate with red and blue enamel, gems and a kanok flame crest.', 'Belt: national champion')], 1):
    A.append(('belt-%d.png' % i, 'B', WIDE, '768x384', True, use, BELT.format(what)))
for f, what, use in [('venue-temple.png', 'a temple fair ring at night with string lights, food stalls and a temple roof behind', 'Venue: temple fair'),
                     ('venue-province.png', 'a provincial hall with wooden stands and fluorescent lights', 'Venue: provincial hall'),
                     ('venue-stadium.png', 'a standard stadium with tiered seats under bright lights', 'Venue: standard stadium'),
                     ('venue-champ.png', 'a championship arena with a big crowd, haze and gold light beams', 'Venue: championship arena'),
                     ('venue-chuek.png', 'a dirt ground at an old temple for a rope-fist bout, with torches and banana trees', 'Venue: rope-fist ground'),
                     ('venue-camp.png', 'a training camp with a ring under a tin roof and heavy bags hanging', 'Venue: training camp')]:
    A.append((f, 'B', WIDE, '960x540', False, use, VENUE.format(what)))
A += [('corner-red.png', 'B', SQ, '256x256', True, 'Red corner badge', 'Corner badge, transparent background: a boxing-ring corner post pad in red with a small gold diamond emblem, slight 3D, spotlight from above. No text.'),
      ('corner-blue.png', 'B', SQ, '256x256', True, 'Blue corner badge', 'Corner badge, transparent background: a boxing-ring corner post pad in blue with a small gold diamond emblem, slight 3D, spotlight from above. No text.')]
for i, (what, use) in enumerate([('exhausted and gloomy', 'Mood: very bad'), ('tired', 'Mood: bad'), ('neutral', 'Mood: normal'),
                                 ('happy', 'Mood: good'), ('fired up, with sparkles', 'Mood: excellent')], 1):
    A.append(('mood-%d.png' % i, 'B', SQ, '128x128', True, use, MOOD.format(what)))
A += [('ribbon-win.png', 'B', WIDE, '1200x300', True, 'Result banner after a win (the game writes the words on it)',
       'Result ribbon banner, transparent background: one wide horizontal ribbon with folded ends, gold with red edges and light rays '
       'behind it. The middle is plain and empty for words added later. No text.'),
      ('ribbon-lose.png', 'B', WIDE, '1200x300', True, 'Result banner after a loss (the game writes the words on it)',
       'Result ribbon banner, transparent background: one wide horizontal ribbon with folded ends, dark grey with a cracked texture. '
       'The middle is plain and empty for words added later. No text.'),
      ('loading.jpg', 'C', TALL, '1080x1920', False, 'Loading screen',
       'Loading screen, portrait: close-up of hands wrapping hand wraps beside a gold mongkol headband on a wooden bench in a dim '
       'dressing room, a single warm light from above. Keep the lower third dark and plain for a progress bar. No text.')]
for f, what, use in [('style-puncher.png', 'throwing a heavy right hand', 'Fighting style card: heavy hands'),
                     ('style-kicker.png', 'landing a high roundhouse kick', 'Fighting style card: kicker'),
                     ('style-clinch.png', 'driving a knee up in the clinch with both hands behind an unseen opponent\'s neck', 'Fighting style card: knees and elbows'),
                     ('style-tech.png', 'leaning back from a kick with hands up, calm and balanced', 'Fighting style card: technician')]:
    A.append((f, 'C', SQ, '512x512', True, use, STYLECARD.format(what)))

START = """# Muay Manager: UI art set

You are drawing the user-interface art for **Muay Manager**, a mobile game where the player manages a Muay Thai fighter
(training, outfits, fights watched in 3D). Players are mostly Thai, on phones held upright. The game's screens are dark
with gold accents; red and blue are the two corners of the ring. Screenshots of the game as it is now are in `reference/`:
look at them to see where each image goes. Do not copy them; the new art should make them look better.

## How to work

1. Read `STYLE.txt`. It applies to every image.
2. Go through `assets.csv` in order (column `order`). Each row has a prompt file in `prompts/`; the prompt already includes
   the style. Draw **one image per reply**, at the size in `draw_at`.
3. After each image, write its file name (column `file`) and one line on what you drew, then wait. The owner will answer
   "next" or say what to change.
4. Keep the whole set consistent. Once the first image of a group (icons, portraits, belts, venues...) is approved, use it
   as the style reference for the rest of that group: same line weight, lighting, angle and level of detail.

## Rules for every image

- **No text at all**: no letters, numbers, signatures or symbols that look like writing. The game writes all words itself,
  in Thai. Only `logo.png` has letters, and only the words given in its prompt.
- **Transparent background** when `background` is `transparent`: a real alpha channel, never a drawn grey-and-white
  checkerboard. If you cannot make it transparent, use one flat pure green (#00FF00) background with nothing touching the
  edges, and say so.
- Keep about 10% empty margin round the subject so nothing is cut off when the game trims and scales the image.
- No real people, no real fighters, no brand, sponsor, TV-channel or stadium logos. Everyone you draw is fictional.
- Leave plain areas plain where the prompt says so (panel and button middles, ribbon centres, dark areas for the logo):
  the game stretches those images and puts words on them.
"""

GUIDE = """# คู่มือใช้ชุดไฟล์นี้กับ ChatGPT

ชุดนี้มีคำสั่งสร้างภาพ UI {n} ภาพ (สำคัญมาก A {a} ภาพ • ทำให้ครบ B {b} ภาพ • ทำทีหลังได้ C {c} ภาพ)

## วิธีใช้

1. เปิด ChatGPT แชตใหม่ ใช้รุ่นที่สร้างภาพได้
2. แนบไฟล์ zip นี้ แล้ววางข้อความนี้ (ภาษาอังกฤษ ChatGPT ทำตามได้แม่นกว่า):

```
The attached zip has the art brief for my mobile game. Unzip it and read START_HERE.md, STYLE.txt and assets.csv,
and look at the screenshots in reference/. Then draw image 1 from assets.csv only, following its prompt file exactly,
and wait for me to say "next".
```

3. ได้ภาพแล้วตรวจตามข้อด้านล่าง ถ้าโอเคพิมพ์ `next` ถ้าไม่โอเคบอกเป็นภาษาไทยได้เลยว่าต้องแก้อะไร
4. ดาวน์โหลดภาพทุกภาพ ตั้งชื่อไฟล์ตามที่ ChatGPT บอก (คอลัมน์ `file` ใน `assets.csv`)
5. ครบแล้ว รวมเป็น zip ส่งกลับมาให้ Claude จะย่อ ตัดขอบ และใส่เข้าเกมให้

ถ้า ChatGPT เปิด zip ไม่ได้: เปิดโฟลเดอร์ `prompts/` แล้วก๊อปข้อความทีละไฟล์ไปวางในแชต (ไฟล์เรียงตามลำดับแล้ว)

## ตรวจทุกภาพก่อนพิมพ์ next

- ไม่มีตัวหนังสือหรือตัวเลขในภาพ (ยกเว้นโลโก้) ถ้ามี สั่ง `remove all text`
- พื้นหลังที่ต้องโปร่งใสต้องโปร่งใสจริง ถ้าเห็นตารางหมากรุกเทาขาวเป็นส่วนหนึ่งของภาพ ให้สั่ง
  `the checkerboard is painted in, make the background really transparent`
- ไม่มีโลโก้ช่องทีวี สปอนเซอร์ ยี่ห้อ หรือหน้าคนจริง (เกมจะลงสโตร์)
- ภาพชุดเดียวกันต้องเข้าชุดกัน (ไอคอนเส้นหนาเท่ากัน แสงมาทางเดียวกัน)
- ของไม่ชิดขอบภาพ

## เรื่องขนาด

ChatGPT วาดได้แค่ 3 ขนาด (1024×1024, 1536×1024, 1024×1536) ทุกคำสั่งตั้งไว้ตามนี้แล้ว
ขนาดที่ใช้ในเกมจริงอยู่ในคอลัมน์ `final_size` Claude จะย่อให้เอง ไม่ต้องย่อก่อนส่ง

## ในชุดนี้มีอะไร

- `README_TH.md` คู่มือนี้
- `START_HERE.md` คำอธิบายงานสำหรับ ChatGPT
- `STYLE.txt` แนวภาพที่ใช้ทุกภาพ
- `assets.csv` รายการภาพทั้งหมด ลำดับ ขนาด พื้นหลัง และใช้ตรงไหนในเกม
- `prompts/` คำสั่งพร้อมวาง ไฟล์ละภาพ
- `palette.png` สีของเกม
- `reference/` ภาพหน้าจอเกมตอนนี้ (สร้างตัว ค่าย ซ้อม แต่งตัว หาคู่ชก อันดับ ชก พิธีชูมือ หน้าผล)
"""

PALETTE = [('Background', '#0E0F14'), ('Panel', '#181A22'), ('Border', '#2A2D39'), ('Gold accent', '#F2B83A'),
           ('Red corner', '#E2382F'), ('Blue corner', '#2F76EA'), ('Text', '#F1F2F5'), ('Text, second', '#9A9FB0')]

def palette_png():
    im = Image.new('RGB', (960, 120 * len(PALETTE) // 2), '#0E0F14'); d = ImageDraw.Draw(im)
    for i, (name, hx) in enumerate(PALETTE):
        x, y = (i % 2) * 480 + 20, (i // 2) * 120 + 20
        d.rounded_rectangle([x, y, x + 120, y + 80], 12, fill=hx, outline='#2A2D39', width=2)
        d.text((x + 140, y + 22), name, fill='#F1F2F5'); d.text((x + 140, y + 46), hx, fill='#9A9FB0')
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()

def main():
    out, refs = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else None)
    order = sorted(A, key=lambda r: 'ABC'.index(r[1]))  # stable: keeps the listed order inside each priority
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('START_HERE.md', START)
        z.writestr('README_TH.md', GUIDE.format(n=len(A), a=sum(r[1] == 'A' for r in A), b=sum(r[1] == 'B' for r in A), c=sum(r[1] == 'C' for r in A)))
        z.writestr('STYLE.txt', STYLE + '\n')
        rows = io.StringIO(); w = csv.writer(rows)
        w.writerow(['order', 'file', 'priority', 'draw_at', 'final_size', 'background', 'used_for', 'prompt_file'])
        for i, (f, pr, draw, final, transp, use, prompt) in enumerate(order, 1):
            pf = 'prompts/%02d_%s.txt' % (i, f.rsplit('.', 1)[0])
            w.writerow([i, f, pr, draw, final, 'transparent' if transp else 'opaque', use, pf])
            z.writestr(pf, '%s\n\nIMAGE %d of %d: %s\nDraw at: %s pixels (it will be scaled to %s in the game)\nBackground: %s\nUsed for: %s\n\n%s\n' % (
                STYLE, i, len(order), f, draw, final, 'transparent (real alpha, no painted checkerboard)' if transp else 'opaque, fill the whole frame', use, prompt))
        z.writestr('assets.csv', rows.getvalue())
        z.writestr('palette.png', palette_png())
        if refs:
            for n in sorted(os.listdir(refs)):
                if not (n.startswith('ref-') and n.endswith('.png') and n[4:6].isdigit()): continue
                im = Image.open(os.path.join(refs, n)).convert('RGB'); b = io.BytesIO(); im.save(b, 'JPEG', quality=84)
                z.writestr('reference/' + n[4:-4] + '.jpg', b.getvalue())
    print(out, len(A), 'images,', os.path.getsize(out) // 1024, 'KB')

main()
