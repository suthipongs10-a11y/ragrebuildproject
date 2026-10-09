# Summon Jump — Art Brief v3 (for ChatGPT)

> **ข้อความถึงผู้ใช้:** แนบไฟล์นี้ในแชท ChatGPT เดิมที่ทำภาพ 45 ภาพไว้ แล้วพิมพ์สั้นๆ ว่า
> **"อ่านไฟล์นี้แล้วทำตามทั้งหมด เริ่ม Part 1 ได้เลย"**
> ถ้า ChatGPT หยุดก่อนครบ ให้พิมพ์ว่า **"ทำต่อจากที่ค้าง"** หรือ **"ทำ Part 2 ต่อ"** ตามที่มันบอก
> จะได้ zip 3 ไฟล์ ส่งมาให้ Claude ทั้ง 3 ไฟล์ ไม่ต้องเปลี่ยนชื่อ

---

## 0. Instructions to ChatGPT — read this first

You already made the first 45 images for my game **Summon Jump** earlier in this chat (backgrounds, hero, monsters, spirits, icons). This brief asks for **59 new images**, split into **3 parts**. Each part ends with **its own zip file**.

**How to work:**
1. Do **Part 1 → Part 2 → Part 3** in order.
2. Inside a part, generate every image in the list, one PNG per item, with the **exact file name** given.
3. When a part is finished, put that part's PNGs **plus a `manifest.json`** (see section 5) into the zip named for that part, and give me the download link.
4. Then **continue straight to the next part** without waiting for me. If you hit a limit, stop **only after finishing a whole image**, tell me exactly which file number to continue from, and I will reply "continue".
5. Do **not** rename files, merge images into one sheet (unless the item says so), or add extra files besides `manifest.json`.

**References to use (from earlier in this chat):**
- **Style reference** = the golden valley painting I gave you at the very start (also saved as `reference_valley.webp` in the first zip). Every new image must match this painting style.
- **Hero** = `30_hero_design.png` (side view, facing right).
- **Hero parts sheet** = `31_hero_parts.png` (head, torso, upper arm, forearm, thigh, shin, scarf, sword).
- **Monsters** = `32`–`39` and **spirits** = `40`–`44` from the first set. New cards and big spirits must look like **the same characters**.
If you no longer have access to these images, tell me and I will attach them again.

---

## 1. Global style (applies to every image)

- Hand-painted digital painting, soft visible brushstrokes, warm golden-hour light, atmospheric feel.
- Palette: muted ochre, sand, sage green, dusty peach; richer contrast and saturation on the subject itself.
- 2D side-scrolling fantasy game art. Clear, readable silhouette at small size.
- **No text, no letters, no numbers, no logos, no watermark, no frame border** (unless the item is a card/icon frame), no signature.
- Keep a small empty margin around the subject. **Never crop** the subject at the image edge.

## 2. Background rules

| Files | Background |
|---|---|
| Everything except `vfx_` files | **True transparent PNG** (real alpha, no checkerboard drawn in, no white/colored box, no soft glow halo around the object) |
| `vfx_` files (Part 3, items 43–57) | **Pure solid black #000000** — NOT transparent. The game adds them with additive light, so black disappears. |

If a transparent background fails, regenerate that file. Do not fake transparency with a gray checkerboard.

## 3. Size rules

Use the size listed for each item. If the tool cannot output that exact size, use the closest size with the **same aspect ratio** and keep the subject centered.

---

## 4. The image list

### PART 1 — Gear (21 images) → `Summon_Jump_v3_Part1_Gear.zip`

**A. Weapons (1024×1024, transparent).**
Every weapon is drawn **alone, in exactly the same pose as the sword piece in `31_hero_parts.png`**: pommel and handle at the **top-left**, blade pointing to the **bottom-right at about 45°**, side view. The **handle must be the same size and position** as the original sword's handle, so it fits the hero's fist. Only the blade, guard and decoration change.

| # | File | Description |
|---|---|---|
| 1 | `wpn_01_training_sword.png` | Plain short sword, worn brown leather grip, simple iron cross-guard, slightly dull blade. The most basic weapon. |
| 2 | `wpn_02_iron_sword.png` | Sturdy longsword, polished steel blade, bronze guard, a bit longer than the training sword. |
| 3 | `wpn_03_flame_sword.png` | Fire sword: blade glows orange-red from inside like hot metal, small embers drifting off the edge, dark iron guard shaped like flames. |
| 4 | `wpn_04_gale_sword.png` | Wind sword: slim slightly curved blade with pale mint-green sheen, feather-shaped silver guard, soft swirling air ribbons around the blade. |
| 5 | `wpn_05_tide_sword.png` | Water sword: aquamarine crystal-like blade with flowing water visible inside, wave-shaped silver guard, a few water droplets. |
| 6 | `wpn_06_king_greatsword.png` | Legendary greatsword: wide gold-and-white blade, crown-shaped golden guard, rose-pink jewel in the pommel, majestic. Clearly bigger than the others but same handle position. |
| 7 | `wpn_07_kraken_blade.png` | MVP blade: dark crimson-black wavy blade, guard made of curling tentacles, glowing teal runes along the blade, menacing. The most impressive weapon. |

**B. Armor icons (1024×1024, transparent).** The armor item alone, front view, centered, as an inventory icon.

| # | File | Description |
|---|---|---|
| 8 | `arm_01_cotton_tunic.png` | Light blue padded cotton tunic with orange scarf and leather belt — the hero's current clothes. |
| 9 | `arm_02_leather_armor.png` | Brown leather armor, one shoulder pad, stitched panels, brass buckles. |
| 10 | `arm_03_knight_armor.png` | Steel knight breastplate with blue cloth tabard, layered pauldrons, gold trim. |
| 11 | `arm_04_royal_armor.png` | Legendary royal armor: white-and-gold plate, crimson cape, glowing gem in the chest. |

**C. Armor pieces worn by the hero (1024×1024, transparent).**
So the hero visibly changes clothes in the game. Open `31_hero_parts.png` and copy the **TORSO** piece and the **UPPER-ARM** piece **exactly** — same pose, same size, same angle, same position of the round joint dots — and only change the clothing material to the new armor. **One piece per file, centered.** The skin-colored round joint dots must stay in the same places.

| # | File | Description |
|---|---|---|
| 12 | `arm_02_torso.png` | Torso piece wearing the leather armor (#9). |
| 13 | `arm_02_uarm.png` | Upper-arm piece wearing the leather armor sleeve/shoulder. |
| 14 | `arm_03_torso.png` | Torso piece wearing the knight armor (#10). |
| 15 | `arm_03_uarm.png` | Upper-arm piece with knight armor pauldron. |
| 16 | `arm_04_torso.png` | Torso piece wearing the royal armor (#11); the cape may hang a little behind. |
| 17 | `arm_04_uarm.png` | Upper-arm piece with royal armor pauldron. |

**D. Accessory icons (1024×1024, transparent).** Front view, centered.

| # | File | Description |
|---|---|---|
| 18 | `acc_power_ring.png` | Heavy gold ring with a red ruby, faint red glow. |
| 19 | `acc_wind_brooch.png` | Silver feather-shaped brooch with a mint-green gem. |
| 20 | `acc_luck_necklace.png` | Necklace with a four-leaf-clover charm and small gold coins. |
| 21 | `acc_light_earring.png` | Pair of crystal earrings glowing soft white-gold. |

➡ When 1–21 are done: zip them with `manifest.json` as **`Summon_Jump_v3_Part1_Gear.zip`**, give the link, continue to Part 2.

---

### PART 2 — Cards, skill icons, big spirits (21 images) → `Summon_Jump_v3_Part2_Cards_Skills.zip`

**E. Monster cards (768×1024 portrait, transparent outside the card).**
Collectible card item in the style of classic MMORPG monster cards: vertical card with rounded corners, ornate antique **gold frame**, parchment-colored inner border, and inside the frame a **painted portrait of the monster**, which must look like the matching monster image from the first set. A small decorative gem at the top of the frame. **No text, no name banner text, no numbers.**

| # | File | Monster (match the earlier image) |
|---|---|---|
| 22 | `card_poring.png` | Pink jelly blob (`32_poring.png`). Normal gold frame. |
| 23 | `card_mantis.png` | Green mantis warrior with scythe arms (`34_mantis.png`). Normal frame. |
| 24 | `card_bird.png` | Teal wind bird with long tail feathers (`35_wind_bird.png`). Normal frame. |
| 25 | `card_fish.png` | Blue sawtooth fish (`37_sawtooth_fish.png`). Normal frame. |
| 26 | `card_scorpion.png` | Sand scorpion with glowing red stinger (`38_sand_scorpion.png`). Normal frame. |
| 27 | `card_king.png` | Giant pink jelly king with small gold crown (`33_poring_king.png`). **Boss frame**: extra gold ornaments. |
| 28 | `card_harpy.png` | Harpy queen with lavender feathers (`36_harpy_queen.png`). **Boss frame**. |
| 29 | `card_kraken.png` | Colossal crimson kraken (`39_kraken.png`). **MVP frame**: dark gold with crimson gems, the most luxurious card. |

**F. Skill icons (512×512, transparent outside the frame).**
Square game skill icon: rounded-square dark bronze frame, one strong central symbol, high contrast so it reads at 40 px.

| # | File | Symbol |
|---|---|---|
| 30 | `skill_power_slash.png` | Heavy golden sword-slash crescent striking downward. |
| 31 | `skill_magnum_burst.png` | Ring of fire exploding outward around a sword planted in the ground. |
| 32 | `skill_sword_mastery.png` | Two crossed swords with a glowing laurel wreath. |
| 33 | `ult_buddy.png` | Giant pink jelly blob slamming down with a shockwave. |
| 34 | `ult_wind.png` | Mint-green tornado. |
| 35 | `ult_water.png` | Huge curling ocean wave. |
| 36 | `ult_fire.png` | Flaming meteors falling. |
| 37 | `ult_angel.png` | Pillar of holy golden light with feathers. |

**G. Awakened big spirits (1024×1024, transparent).**
Big, majestic versions of the companion spirits, shown during their ultimate attack. Front-facing, floating, dramatic and glowing. Each must clearly be the **same character** as the small spirit from the first set, just grown up and powerful.

| # | File | Description (match earlier image) |
|---|---|---|
| 38 | `spirit_big_buddy.png` | Giant heroic pink jelly with a tiny red cape and determined eyes (`40_baby_poring.png`). |
| 39 | `spirit_big_wind.png` | Graceful wind spirit of swirling mint-green air and feathers, wide flowing arms (`41_wind_spirit.png`). |
| 40 | `spirit_big_water.png` | Water spirit maiden made of flowing aquamarine water, holding a wave (`42_water_spirit.png`). |
| 41 | `spirit_big_fire.png` | Fierce fire spirit of roaring flames, ember eyes, flame horns (`43_fire_spirit.png`). |
| 42 | `spirit_big_angel.png` | Radiant angel spirit with large white wings and a golden halo (`44_angeling.png`). |

➡ When 22–42 are done: zip with `manifest.json` as **`Summon_Jump_v3_Part2_Cards_Skills.zip`**, give the link, continue to Part 3.

---

### PART 3 — Effects and environment (17 images) → `Summon_Jump_v3_Part3_VFX_Env.zip`

**H. VFX (1024×1024, PURE BLACK #000000 background — not transparent).**
Bright, glowing, painterly light effects, centered, with black margin around them. Only light and color on black: no ground, no characters, no scenery.

| # | File | Description |
|---|---|---|
| 43 | `vfx_slash.png` | Thin, fast crescent sword-slash trail; white-hot core fading to pale gold; curved from top-left to bottom-right. |
| 44 | `vfx_slash_heavy.png` | Thick powerful crescent slash; white core, orange-gold edges, flying sparks; wider than #43. |
| 45 | `vfx_hit_spark.png` | Impact starburst: sharp radiating light streaks and a bright white-gold core. |
| 46 | `vfx_crit_burst.png` | Spiky explosive starburst in red, orange and yellow, like a comic-book "critical hit" explosion shape, bright yellow center (used behind red critical damage numbers). |
| 47 | `vfx_magic_circle.png` | Golden summoning magic circle with runes and rings, seen straight from the front (a perfect circle), glowing. |
| 48 | `vfx_fire_ring.png` | Ring of fire exploding outward, seen from the side (wide flat ellipse of flames), embers flying. |
| 49 | `vfx_tornado.png` | Tall narrow vertical mint-green tornado of wind with leaves. |
| 50 | `vfx_wave.png` | Big crashing water wave seen from the side, moving to the right, foam and spray, aquamarine. |
| 51 | `vfx_meteor.png` | One flaming meteor falling diagonally down-left with a long fire trail. |
| 52 | `vfx_holy_pillar.png` | Vertical pillar of golden-white holy light with floating feathers and sparkles. |
| 53 | `vfx_levelup.png` | Rising column of golden light with upward sparkles and a glowing ring at the bottom. |
| 54 | `vfx_jelly_splash.png` | Big splash of glowing pink jelly droplets bursting outward. |
| 55 | `vfx_element_wind.png` | Small swirl of mint-green wind ribbons (small hit effect). |
| 56 | `vfx_element_water.png` | Small burst of aquamarine water droplets (small hit effect). |
| 57 | `vfx_element_fire.png` | Small burst of fire and embers (small hit effect). |

**I. Environment (transparent — NOT black).**

| # | File | Size | Description |
|---|---|---|---|
| 58 | `env_pipe.png` | 512×1024 | Painted mossy green-bronze pipe for a platformer, standing upright, side view, wide rim at the top, ancient fantasy style matching the painted world (not plastic, not cartoon). |
| 59 | `env_boulder.png` | 512×1536 (tall, about 1:3) | Giant cracked boulder pile blocking a path, weathered stone with moss and glowing orange cracks hinting it can be broken. |

➡ When 43–59 are done: zip with `manifest.json` as **`Summon_Jump_v3_Part3_VFX_Env.zip`** and give the link.

---

## 5. `manifest.json` inside each zip

List every file in that zip, like this:

```json
[
  {"no": 1, "file": "wpn_01_training_sword.png", "size": "1024x1024", "background": "transparent", "status": "ok"},
  {"no": 43, "file": "vfx_slash.png", "size": "1024x1024", "background": "black", "status": "ok"}
]
```

Use `"status": "redo-suggested"` with a short `"note"` if an image did not come out as asked (for example, the armor pieces don't match the parts sheet).

## 6. Final checklist before each zip

- [ ] Every file name matches the list exactly (lowercase, underscores, `.png`).
- [ ] Non-VFX images have a real transparent background with no halo or box.
- [ ] VFX images are on pure black.
- [ ] No text, letters or numbers anywhere in any image.
- [ ] Weapons all share the same handle position and 45° pose as the original sword.
- [ ] Cards and big spirits clearly match the earlier monster and spirit designs.
- [ ] The style matches the golden valley reference painting.

## 7. When everything is done

Reply with the 3 zip links:
1. `Summon_Jump_v3_Part1_Gear.zip` (21 images)
2. `Summon_Jump_v3_Part2_Cards_Skills.zip` (21 images)
3. `Summon_Jump_v3_Part3_VFX_Env.zip` (17 images)

plus a short list of any files that need a redo.
