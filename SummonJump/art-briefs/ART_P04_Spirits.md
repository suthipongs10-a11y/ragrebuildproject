# Summon Jump — Art Brief P04: Spirits (awakened forms, new spirits, summon & runes)

> **ข้อความถึงผู้ใช้:** แนบไฟล์นี้ในแชท ChatGPT เดิม แล้วพิมพ์ว่า
> **"อ่านไฟล์นี้แล้วทำตามทั้งหมด เริ่ม Part 1 ได้เลย"**
> ถ้าหยุดกลางทางให้พิมพ์ **"ทำต่อจากที่ค้าง"** · ได้ zip 4 ไฟล์ ส่งให้ Claude ไม่ต้องเปลี่ยนชื่อ
> ร่างใหญ่ของภูติ 5 ตัวเดิม (`spirit_big_*.png`) อยู่ใน brief เก่า `ART_P03_Gear_Cards_VFX.md` Part 2 — ไม่ซ้ำกับไฟล์นี้
> เกมใช้ภาพชั่วคราวไปก่อน ไม่ต้องรีบ

---

## 0. Instructions to ChatGPT

This is the **spirit pack** for my game **Summon Jump** (the painted fantasy platformer you already made art for in this chat). Spirits are cute magical companions the hero collects, levels up and **awakens** into a stronger form; in battle they float next to the hero, and for their **ultimate attack** a big majestic version appears on screen.

This brief has **4 parts, 79 images**. Do Part 1 → 4. After each part, zip that part's PNGs **plus `manifest.json`** with the exact zip name given, give me the link, then continue automatically. If you hit a limit, stop after a complete image and tell me the number to continue from.

References from earlier in this chat: the **golden valley style painting**, and the 5 spirits you already made: **`40_baby_poring.png`, `41_wind_spirit.png`, `42_water_spirit.png`, `43_fire_spirit.png`, `44_angeling.png`** (and their big versions `spirit_big_*.png` if you made them). If you no longer have them, tell me and I will attach them again.

### The 4 forms of every spirit
| Form | File | Size | What it is |
|---|---|---|---|
| small | `spr_<family>_small.png` | 512×512 | The companion that floats next to the hero. Cute, chibi proportions (big head, small body), **side view facing RIGHT**, whole body visible, floating pose. |
| big | `spr_<family>_big.png` | 1024×1024 | The same character grown up and powerful, shown during its ultimate. **Front-facing**, floating, dramatic, glowing, fills most of the image. |
| awakened small | `spr_<family>_awk_small.png` | 512×512 | The small form **after awakening**: same character and same pose/scale as `small`, but more ornate — crown/horns/armor pieces, extra glow, a few extra details, slightly more mature face. Must be instantly recognisable as the same spirit. |
| awakened big | `spr_<family>_awk_big.png` | 1024×1024 | The big form after awakening: same as `big` but with the awakened details, grander wings/aura. |

**Golden rule:** all 4 forms of one family = **the same character** (same species, colours, face, markings). Small and awakened small: same scale and the same empty margin so they can be swapped in place.

## 1. Global style
- Hand-painted digital painting, soft visible brushstrokes, warm golden-hour light, muted ochre / sand / sage / dusty peach world palette, **richer saturated colour on the spirit itself**.
- Friendly, cute, collectible (think monster-collecting mobile game), never scary — even the dark wolf is "cool", not horror.
- **No text, letters, numbers, logos or watermark. No ground, no ground shadow.**

## 2. Colour rule (important — the game recolours spirits by element)
The game makes the **water / fire / earth / wind / holy / dark** versions of every spirit by **shifting the hue** of your painting. So:
- Paint each spirit with **one dominant colour family** (its natural element colour given in the table) + neutral whites / creams / golds / dark outlines.
- Avoid rainbows and many competing colours on one spirit (the unicorn's mane may have a soft pastel gradient, that's fine).
- Put the element colour where it reads at small size: aura, flames, gems, eyes, tail tip, wing edges.

## 3. Background rules
| Files | Background |
|---|---|
| Parts 1–3 (spirits) and Part 4 items/icons | **True transparent PNG** (real alpha, no checkerboard, no box, no halo) |
| Part 4 `vfx_*` | **Pure solid black #000000** (the game adds them with additive light) |

## 4. Image list

### PART 1 — Awakened forms of the 5 spirits you already made (10 images) → `SJ_P04_Spirits_Part1.zip`
| # | File | Size | Description |
|---|---|---|---|
| 1 | `spr_poring_awk_small.png` | 512×512 | **Poring** awakened (match `40_baby_poring.png`): the pink jelly now wears a tiny golden crown and a short red hero cape, sparkle in the eyes, a soft pink glow. |
| 2 | `spr_poring_awk_big.png` | 1024×1024 | Giant heroic awakened Poring, cape flowing, crown shining, front-facing, ready to body-slam. |
| 3 | `spr_sylph_awk_small.png` | 512×512 | **Sylph** awakened (match `41_wind_spirit.png`): mint-green wind spirit with a feather circlet, longer flowing air-ribbons, small leaf-shaped wings. |
| 4 | `spr_sylph_awk_big.png` | 1024×1024 | Grand wind goddess form of the Sylph, swirling ribbons of air and feathers around her, arms wide. |
| 5 | `spr_undine_awk_small.png` | 512×512 | **Undine** awakened (match `42_water_spirit.png`): aquamarine water spirit with a seashell tiara, pearl ornaments, a small water halo. |
| 6 | `spr_undine_awk_big.png` | 1024×1024 | Water queen form: tall maiden of flowing water holding a trident-shaped wave, pearls and shells. |
| 7 | `spr_salamander_awk_small.png` | 512×512 | **Salamander** awakened (match `43_fire_spirit.png`): fire spirit with ember horns, molten-gold armour plates, hotter brighter flames. |
| 8 | `spr_salamander_awk_big.png` | 1024×1024 | Fire lord form: roaring flame body, molten armour, flame horns, a ring of fire behind. |
| 9 | `spr_angel_awk_small.png` | 512×512 | **Angeling** awakened (match `44_angeling.png`): two pairs of small white wings, a brighter double halo, a tiny golden staff. |
| 10 | `spr_angel_awk_big.png` | 1024×1024 | Archangel form: six large white wings, radiant double halo, golden light pouring down. |

➡ Zip 1–10 → **`SJ_P04_Spirits_Part1.zip`**, give the link, continue to Part 2.

### PART 2 — New spirits A (20 images) → `SJ_P04_Spirits_Part2.zip`
Invent a consistent design for each new family from the description; 4 forms each (see section 0).

| # | File | Size | Description |
|---|---|---|---|
| 11 | `spr_pixie_small.png` | 512×512 | **Pixie** (natural colour: mint green) — a tiny forest fairy with dragonfly wings, a flower-petal dress and a glowing dandelion wand. |
| 12 | `spr_pixie_big.png` | 1024×1024 | Grown fairy queen, large glowing dragonfly wings, petals and sparkles swirling. |
| 13 | `spr_pixie_awk_small.png` | 512×512 | Awakened pixie: flower crown, two pairs of wings, the wand becomes a blooming staff. |
| 14 | `spr_pixie_awk_big.png` | 1024×1024 | Awakened fairy queen, huge flower crown, a blossom storm around her. |
| 15 | `spr_turtle_small.png` | 512×512 | **Crystal Turtle** (natural colour: sea blue) — a round little turtle whose shell is made of glowing blue crystals, floating with flippers spread. |
| 16 | `spr_turtle_big.png` | 1024×1024 | Huge guardian turtle, crystal shell like a fortress, front-facing, calm and strong. |
| 17 | `spr_turtle_awk_small.png` | 512×512 | Awakened: crystal spikes taller and brighter, golden rim on the shell, tiny helmet. |
| 18 | `spr_turtle_awk_big.png` | 1024×1024 | Awakened guardian: crystal shell becomes a shining dome-shield, golden bands. |
| 19 | `spr_kitsune_small.png` | 512×512 | **Kitsune** (natural colour: warm orange-red) — a small fox spirit with two fluffy tails tipped with flames, a red ribbon. |
| 20 | `spr_kitsune_big.png` | 1024×1024 | Elegant fire fox spirit with many flaming tails fanned out, floating, fox-fire orbs around it. |
| 21 | `spr_kitsune_awk_small.png` | 512×512 | Awakened: four tails, a golden shrine-bell collar, glowing face markings. |
| 22 | `spr_kitsune_awk_big.png` | 1024×1024 | Awakened nine-tailed form, tails like a crown of flames, gold markings. |
| 23 | `spr_golem_small.png` | 512×512 | **Stone Golem** (natural colour: earthy ochre-brown) — a chubby little golem of rounded stones with moss, glowing amber rune eyes, big fists. |
| 24 | `spr_golem_big.png` | 1024×1024 | Towering stone golem, front-facing, fists raised, rocks orbiting it. |
| 25 | `spr_golem_awk_small.png` | 512×512 | Awakened: crystal shards growing from shoulders, glowing rune lines on the body. |
| 26 | `spr_golem_awk_big.png` | 1024×1024 | Awakened titan: crystal-armoured, runes blazing, floating boulders. |
| 27 | `spr_fluffy_small.png` | 512×512 | **Cloud Sheep** (natural colour: sky blue-white) — a fluffy little sheep whose wool is a soft cloud, tiny curled horns, sleepy smile, floating. |
| 28 | `spr_fluffy_big.png` | 1024×1024 | Giant storm-cloud ram, wool like thunderclouds, small lightning sparks, front-facing. |
| 29 | `spr_fluffy_awk_small.png` | 512×512 | Awakened: golden curled horns, a small rainbow arc over its back, brighter wool. |
| 30 | `spr_fluffy_awk_big.png` | 1024×1024 | Awakened sky ram: huge golden horns, crown of clouds and lightning. |

➡ Zip 11–30 → **`SJ_P04_Spirits_Part2.zip`**, give the link, continue to Part 3.

### PART 3 — New spirits B (20 images) → `SJ_P04_Spirits_Part3.zip`
| # | File | Size | Description |
|---|---|---|---|
| 31 | `spr_owl_small.png` | 512×512 | **Sage Owl** (natural colour: olive-brown) — a round wise owl with big golden eyes, tiny round glasses, a little scroll. |
| 32 | `spr_owl_big.png` | 1024×1024 | Great sage owl, wings spread wide, glowing rune circles around it. |
| 33 | `spr_owl_awk_small.png` | 512×512 | Awakened: scholar hat with a feather, floating spell book. |
| 34 | `spr_owl_awk_big.png` | 1024×1024 | Awakened archsage owl, giant open spell book, many glowing runes. |
| 35 | `spr_wolf_small.png` | 512×512 | **Moon Wolf** (natural colour: deep violet / midnight blue) — a small wolf cub with a crescent-moon mark on the forehead, starry fur tips. |
| 36 | `spr_wolf_big.png` | 1024×1024 | Majestic moon wolf howling, front-facing, a big crescent moon behind it. |
| 37 | `spr_wolf_awk_small.png` | 512×512 | Awakened: silver armour on the shoulders, a glowing moon on the chest, longer starry mane. |
| 38 | `spr_wolf_awk_big.png` | 1024×1024 | Awakened moon wolf lord, silver armour, full moon halo, starlight trailing. |
| 39 | `spr_unicorn_small.png` | 512×512 | **Unicorn** (natural colour: soft white-gold with pastel mane) — a small pony unicorn with a spiral horn, little feathered hooves, floating. |
| 40 | `spr_unicorn_big.png` | 1024×1024 | Radiant unicorn rearing up, front-facing, light rays from the horn. |
| 41 | `spr_unicorn_awk_small.png` | 512×512 | Awakened: small feathered wings, golden horn, flower garland. |
| 42 | `spr_unicorn_awk_big.png` | 1024×1024 | Awakened alicorn, big feathered wings, golden horn, holy light. |
| 43 | `spr_dragon_small.png` | 512×512 | **Sky Dragon** (natural colour: teal / jade green) — a baby dragon with round belly, small wings, tiny horns, puffing a little breath cloud. |
| 44 | `spr_dragon_big.png` | 1024×1024 | Mighty sky dragon, wings spread, front-facing, about to breathe a storm. |
| 45 | `spr_dragon_awk_small.png` | 512×512 | Awakened: longer horns, golden chest scales, bigger wings, gem on the forehead. |
| 46 | `spr_dragon_awk_big.png` | 1024×1024 | Awakened elder dragon, golden scales, huge wings, storm swirling. |
| 47 | `spr_phoenix_small.png` | 512×512 | **Phoenix** (natural colour: crimson and gold) — a small fire bird chick with a flame crest and long flame tail feathers. |
| 48 | `spr_phoenix_big.png` | 1024×1024 | Full phoenix with wings of fire spread, front-facing, embers raining. |
| 49 | `spr_phoenix_awk_small.png` | 512×512 | Awakened: golden flame crown, three long tail plumes, brighter core. |
| 50 | `spr_phoenix_awk_big.png` | 1024×1024 | Awakened sun phoenix, a sun disc behind it, wings of white-gold fire. |

➡ Zip 31–50 → **`SJ_P04_Spirits_Part3.zip`**, give the link, continue to Part 4.

### PART 4 — Summon scrolls, essences, runes, summon VFX (29 images) → `SJ_P04_Spirits_Part4.zip`
| # | File | Size | Background | Description |
|---|---|---|---|---|
| 51 | `scroll_normal.png` | 256×256 | transparent | Rolled parchment scroll with a plain brown ribbon and a simple wax seal. |
| 52 | `scroll_mystic.png` | 256×256 | transparent | Ornate violet-and-gold scroll, glowing star seal, faint magic sparkles. |
| 53 | `scroll_element.png` | 256×256 | transparent | Scroll with four small element gems (blue, red, ochre, green) set in a golden band. |
| 54 | `scroll_ld.png` | 256×256 | transparent | Half-white, half-black scroll with a sun-and-moon seal, golden light / violet shadow. |
| 55 | `ess_water.png` | 256×256 | transparent | Water essence: a glowing blue crystal droplet with swirls inside. |
| 56 | `ess_fire.png` | 256×256 | transparent | Fire essence: a glowing red-orange crystal with a flame inside. |
| 57 | `ess_earth.png` | 256×256 | transparent | Earth essence: an ochre crystal with a tiny leaf/rock inside. |
| 58 | `ess_wind.png` | 256×256 | transparent | Wind essence: a mint-green crystal with a swirl of air inside. |
| 59 | `ess_holy.png` | 256×256 | transparent | Light essence: a white-gold crystal with a tiny sun inside. |
| 60 | `ess_dark.png` | 256×256 | transparent | Dark essence: a violet-black crystal with a tiny crescent moon inside. |
| 61 | `ess_magic.png` | 256×256 | transparent | Magic essence: a pale lavender crystal with rainbow sparkles. |
| 62 | `rune_slot1.png` | 256×256 | transparent | Rune stone, slot 1 shape: a **circle**, carved grey-blue stone with a bronze rim, empty centre (the set symbol is drawn on top by the game). |
| 63 | `rune_slot2.png` | 256×256 | transparent | Same stone style, **square** shape. |
| 64 | `rune_slot3.png` | 256×256 | transparent | Same stone style, **triangle** shape. |
| 65 | `rune_slot4.png` | 256×256 | transparent | Same stone style, **diamond** shape. |
| 66 | `rune_slot5.png` | 256×256 | transparent | Same stone style, **pentagon** shape. |
| 67 | `rune_slot6.png` | 256×256 | transparent | Same stone style, **hexagon** shape. |
| 68 | `rune_set_energy.png` | 256×256 | transparent | Set symbol "Energy" (HP): a glowing green heart glyph, painted, no letters. |
| 69 | `rune_set_guard.png` | 256×256 | transparent | Set symbol "Guard" (DEF): a blue shield glyph. |
| 70 | `rune_set_blade.png` | 256×256 | transparent | Set symbol "Blade" (crit rate): a silver crossed-blades glyph. |
| 71 | `rune_set_focus.png` | 256×256 | transparent | Set symbol "Focus" (ultimate charge): a violet eye-in-star glyph. |
| 72 | `rune_set_fatal.png` | 256×256 | transparent | Set symbol "Fatal" (ATK): a red skull-less fang/claw glyph (not scary). |
| 73 | `rune_set_swift.png` | 256×256 | transparent | Set symbol "Swift" (speed): a golden winged-boot glyph. |
| 74 | `rune_set_rage.png` | 256×256 | transparent | Set symbol "Rage" (crit damage): an orange flame-burst glyph. |
| 75 | `rune_set_vampire.png` | 256×256 | transparent | Set symbol "Vampire" (lifesteal): a crimson bat-wing glyph. |
| 76 | `vfx_summon_portal.png` | 1024×1024 | black | Summoning portal seen from the front: a glowing circular gateway of golden runes with a bright swirling centre. |
| 77 | `vfx_summon_beam.png` | 1024×1024 | black | A tall vertical pillar of light (narrow, centred), soft edges, golden-white core. |
| 78 | `vfx_summon_star.png` | 1024×1024 | black | A big sparkling star burst (4–8 points) with glitter, white-gold, centred. |
| 79 | `vfx_ult_aura.png` | 1024×1024 | black | A soft radial magic aura with floating sparkles, white core fading out, used behind a big spirit (the game tints it). |

➡ Zip 51–79 → **`SJ_P04_Spirits_Part4.zip`** and give the link.

## 5. manifest.json
List every file in that zip:
```json
[{"no":1,"file":"spr_poring_awk_small.png","size":"512x512","background":"transparent","status":"ok"}]
```

## 6. Checklist before each zip
- [ ] Exact file names, exact sizes.
- [ ] Every family's 4 forms are the same character; small & awakened small same scale and margin; small forms face RIGHT, big forms face the viewer.
- [ ] One dominant colour family per spirit (the game recolours by element).
- [ ] Transparent backgrounds (real alpha) except `vfx_*` on pure black.
- [ ] No text, no letters, no watermark, no ground shadow.

## 7. Final reply
4 zip links + any files that need a redo.
