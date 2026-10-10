# Summon Jump — Art Brief P03: Jobs (looks, job weapons, skill icons, skill VFX)

> **ข้อความถึงผู้ใช้:** แนบไฟล์นี้ในแชท ChatGPT เดิม แล้วพิมพ์ว่า
> **"อ่านไฟล์นี้แล้วทำตามทั้งหมด เริ่ม Part 1 ได้เลย"**
> ถ้าหยุดกลางทางให้พิมพ์ **"ทำต่อจากที่ค้าง"** · ได้ zip 5 ไฟล์ ส่งให้ Claude ไม่ต้องเปลี่ยนชื่อ
> ถ้ายังไม่ได้ทำ brief เก่า `ART_P03_Gear_Cards_VFX.md` (ดาบ เกราะ การ์ด VFX พื้นฐาน) ให้ทำอันนั้นด้วย — ไม่ซ้ำกับไฟล์นี้
> เกมใช้ภาพชั่วคราวไปก่อน ไม่ต้องรีบ

---

## 0. Instructions to ChatGPT

This is the **job pack** for my game **Summon Jump** (the painted fantasy platformer you already made art for in this chat). The hero can change job to **Swordsman, Mage, Archer or Acolyte**. This brief has **5 parts, 86 images**. Do Part 1 → 4. After each part, zip that part's PNGs **plus `manifest.json`** with the exact zip name given, give me the link, then continue automatically. If you hit a limit, stop after a complete image and tell me the number to continue from.

References from earlier in this chat: the **golden valley style painting**, the hero **`30_hero_design.png`** and the hero parts sheet **`31_hero_parts.png`**. If you no longer have them, tell me and I will attach them again.

**Each job must look like its own character** (different outfit, silhouette, colour theme and signature accessory — readable even as a tiny silhouette on a phone), while keeping the hero's face and body proportions so the game can animate the same pieces.

**Most important rule (Part 1):** every `job_*_parts.png` must use **exactly the same layout as `31_hero_parts.png`** — same piece positions on the sheet, same piece sizes, same joint dots — because the game animates the pieces with fixed pivot points. Only clothing, hair and colours change. Leave the weapon slot empty (weapons come separately).

**Weapons (Part 2):** draw each weapon alone in **exactly the same pose as the sword piece in `31_hero_parts.png`**: handle at the **top-left**, head/tip pointing to the **bottom-right at about 45°**, handle the same size and position as the original sword handle so it fits the hero's fist.

## 1. Global style
- Hand-painted digital painting, soft visible brushstrokes, warm golden-hour light, muted ochre / sand / sage / dusty peach palette, richer contrast on the subject.
- Same boy hero in every job (same face and proportions as `30_hero_design.png`).
- **No text, letters, numbers, logos or watermark.**
- Skill icons: a painted symbol centred on a **rounded-square dark walnut plate with a thin bronze rim** (same look as my UI kit), readable at 64 px.

## 2. Background rules
| Files | Background |
|---|---|
| Parts 1–3 (designs, parts, weapons, equipment, skill icons) | **True transparent PNG** (real alpha, no checkerboard, no box, no halo) |
| Part 4 (`vfx_*`) | **Pure solid black #000000** (the game adds them with additive light) |

## 3. Size rules
Use the size in the table; keep the subject centred with a small empty margin; never crop the subject.

## 4. Image list

### PART 1 — Job looks (8 images) → `SJ_P03_Jobs_Part1.zip`

| # | File | Size | Description |
|---|---|---|---|
| 1 | `job_swordsman_design.png` | 1024×1024 | **Swordsman — knight in training.** The same boy hero from `30_hero_design.png` (same face, same body proportions, side view facing right) but he must look like **a different, heroic warrior at first glance**: polished silver breastplate over a royal-blue tabard with a gold trim, one big rounded steel pauldron on the front shoulder, steel gauntlets and greaves, a long **red cape-scarf** flowing behind, spiky hair held by a steel headband with a small blue gem. Colour theme: steel + royal blue + red. Confident stance, chest out. Full body standing pose, sword at the hip. |
| 2 | `job_swordsman_parts.png` | 1536×1024 | **Swordsman parts sheet** — exactly the same **layout, piece positions, piece sizes and skin-coloured joint dots** as `31_hero_parts.png` (head, torso, upper arm, forearm+hand, thigh, shin+boot, scarf/cape, and the weapon slot left EMPTY), only the clothes/hair change to match `job_swordsman_design.png`. Pieces separated by large gaps. |
| 3 | `job_mage_design.png` | 1024×1024 | **Mage — young wizard.** The same boy hero (same face and proportions, side view facing right) but instantly recognisable as a spell-caster: a **tall wide-brimmed pointed hat** with small embroidered stars (hat drawn as part of the head piece), deep indigo robe with glowing violet rune lines on the hem, long flowing sleeves, a crystal amulet on the chest, a scroll pouch on the belt, soft violet glow around the hands. Colour theme: indigo + gold + violet glow. Calm, focused stance. Full body standing pose. |
| 4 | `job_mage_parts.png` | 1536×1024 | **Mage parts sheet** — exactly the same **layout, piece positions, piece sizes and skin-coloured joint dots** as `31_hero_parts.png` (head, torso, upper arm, forearm+hand, thigh, shin+boot, scarf/cape, and the weapon slot left EMPTY), only the clothes/hair change to match `job_mage_design.png`. Pieces separated by large gaps. |
| 5 | `job_archer_design.png` | 1024×1024 | **Archer — forest ranger.** The same boy hero (same face and proportions, side view facing right) as an agile ranger: forest-green hooded cloak with the hood down, short leather vest, a **quiver full of orange-feathered arrows on the back** (drawn on the torso piece), leather arm guard, fingerless gloves, a long feather tucked in the hair, a green scarf around the neck. Colour theme: forest green + brown leather + orange feathers. Light, ready-to-move stance. Full body standing pose. |
| 6 | `job_archer_parts.png` | 1536×1024 | **Archer parts sheet** — exactly the same **layout, piece positions, piece sizes and skin-coloured joint dots** as `31_hero_parts.png` (head, torso, upper arm, forearm+hand, thigh, shin+boot, scarf/cape, and the weapon slot left EMPTY), only the clothes/hair change to match `job_archer_design.png`. Pieces separated by large gaps. |
| 7 | `job_acolyte_design.png` | 1024×1024 | **Acolyte — young priest.** The same boy hero (same face and proportions, side view facing right) as a holy healer: **white-and-gold cassock** with a tall collar, sky-blue sash, a golden holy-sun pendant on the chest, prayer beads on the wrist, a small white-and-gold cap, a short white cape with gold embroidery, a soft warm golden glow around him. Colour theme: white + gold + sky blue. Gentle, upright stance. Full body standing pose. |
| 8 | `job_acolyte_parts.png` | 1536×1024 | **Acolyte parts sheet** — exactly the same **layout, piece positions, piece sizes and skin-coloured joint dots** as `31_hero_parts.png` (head, torso, upper arm, forearm+hand, thigh, shin+boot, scarf/cape, and the weapon slot left EMPTY), only the clothes/hair change to match `job_acolyte_design.png`. Pieces separated by large gaps. |

➡ Zip 1–8 + `manifest.json` as **`SJ_P03_Jobs_Part1.zip`**, give the link, continue.

### PART 2 — Job weapons, arrow, equipment icons (21 images) → `SJ_P03_Jobs_Part2.zip`

| # | File | Size | Description |
|---|---|---|---|
| 9 | `wpn_staff_wood.png` | 1024×1024 | Wooden staff with a small amber crystal at the top (mage starter). |
| 10 | `wpn_staff_crystal.png` | 1024×1024 | Silver staff with a big floating blue crystal and small orbiting sparks. |
| 11 | `wpn_staff_flame.png` | 1024×1024 | Dark wood staff topped with a caged orange flame gem. |
| 12 | `wpn_bow_short.png` | 1024×1024 | Simple wooden short bow with a light string (archer starter). |
| 13 | `wpn_bow_composite.png` | 1024×1024 | Recurve composite bow, horn and wood layers, bronze tips. |
| 14 | `wpn_bow_gale.png` | 1024×1024 | Elegant mint-green wind bow with feather decorations. |
| 15 | `wpn_mace_iron.png` | 1024×1024 | Iron flanged mace, leather grip (acolyte starter). |
| 16 | `wpn_mace_holy.png` | 1024×1024 | White-gold holy mace with a small sun emblem (no letters). |
| 17 | `wpn_mace_star.png` | 1024×1024 | Morning-star style mace with a glowing pale-gold head. |
| 18 | `prj_arrow.png` | 512×256 | A single arrow flying to the RIGHT, horizontal, wooden shaft, white fletching. |
| 19 | `hat_leather_cap.png` | 512×512 | Icon: brown leather cap. |
| 20 | `hat_wizard.png` | 512×512 | Icon: indigo pointed wizard hat with gold band. |
| 21 | `hat_feather.png` | 512×512 | Icon: green ranger hat with a long feather. |
| 22 | `hat_circlet.png` | 512×512 | Icon: thin gold circlet with a small blue gem. |
| 23 | `cape_traveler.png` | 512×512 | Icon: worn brown traveller cape. |
| 24 | `cape_hood.png` | 512×512 | Icon: hooded white-blue holy cape. |
| 25 | `shoe_sandals.png` | 512×512 | Icon: simple leather sandals (pair). |
| 26 | `shoe_boots.png` | 512×512 | Icon: sturdy brown boots (pair). |
| 27 | `shoe_wind.png` | 512×512 | Icon: light green boots with small wings at the heel. |
| 28 | `shield_buckler.png` | 512×512 | Icon: small round wooden buckler with iron rim. |
| 29 | `shield_kite.png` | 512×512 | Icon: steel kite shield with a simple blue band (no emblem letters). |

➡ Zip 9–29 + `manifest.json` as **`SJ_P03_Jobs_Part2.zip`**, give the link, continue.

### PART 3 — Skill icons (31 images) → `SJ_P03_Jobs_Part3.zip`

| # | File | Size | Description |
|---|---|---|---|
| 30 | `skill_first_aid.png` | 512×512 | Novice: small green cross made of soft light over a bandage (self heal) |
| 31 | `skill_basic_skill.png` | 512×512 | Novice: a simple boot print and a star (basic training) |
| 32 | `skill_hp_recovery.png` | 512×512 | Swordsman passive: red heart with an upward arrow |
| 33 | `skill_endure.png` | 512×512 | Swordsman buff: armored chest with a golden aura (no knockback) |
| 34 | `skill_dash_strike.png` | 512×512 | Swordsman: sword thrust with speed lines forward |
| 35 | `skill_whirlwind.png` | 512×512 | Swordsman: spinning sword making a circular wind |
| 36 | `skill_provoke.png` | 512×512 | Swordsman: angry red shout burst symbol (taunt) |
| 37 | `skill_fire_bolt.png` | 512×512 | Mage: three falling fire bolts |
| 38 | `skill_cold_bolt.png` | 512×512 | Mage: three falling ice shards |
| 39 | `skill_lightning_bolt.png` | 512×512 | Mage: three yellow lightning bolts |
| 40 | `skill_soul_strike.png` | 512×512 | Mage: violet ghostly orbs flying |
| 41 | `skill_fire_wall.png` | 512×512 | Mage: a low wall of flames |
| 42 | `skill_frost_nova.png` | 512×512 | Mage: ring of ice spikes bursting outward |
| 43 | `skill_sp_recovery.png` | 512×512 | Mage passive: blue droplet with an upward arrow |
| 44 | `skill_energy_shield.png` | 512×512 | Mage buff: translucent blue hexagon shield |
| 45 | `skill_double_strafe.png` | 512×512 | Archer: two arrows side by side |
| 46 | `skill_arrow_shower.png` | 512×512 | Archer: many arrows falling in an arc |
| 47 | `skill_charge_arrow.png` | 512×512 | Archer: one glowing heavy arrow with a shockwave |
| 48 | `skill_owl_eye.png` | 512×512 | Archer passive: an owl eye (sharp focus) |
| 49 | `skill_vulture_eye.png` | 512×512 | Archer passive: a vulture eye with a long dotted line (range) |
| 50 | `skill_focus.png` | 512×512 | Archer buff: crosshair with golden glow |
| 51 | `skill_ankle_trap.png` | 512×512 | Archer: snapping iron trap on the ground |
| 52 | `skill_arrow_rain.png` | 512×512 | Archer: arrows falling from a cloud |
| 53 | `skill_heal.png` | 512×512 | Acolyte: bright green-white cross with soft light |
| 54 | `skill_blessing.png` | 512×512 | Acolyte buff: golden wings over a small star |
| 55 | `skill_increase_agi.png` | 512×512 | Acolyte buff: winged boot with speed lines |
| 56 | `skill_holy_light.png` | 512×512 | Acolyte: beam of white-gold light striking down |
| 57 | `skill_pneuma.png` | 512×512 | Acolyte: protective feather dome (blocks projectiles) |
| 58 | `skill_divine_protection.png` | 512×512 | Acolyte passive: small shield with a halo |
| 59 | `skill_angelus.png` | 512×512 | Acolyte buff: a soft bell with radiating light |
| 60 | `skill_ruwach.png` | 512×512 | Acolyte: ring of holy sparks around a centre |

➡ Zip 30–60 + `manifest.json` as **`SJ_P03_Jobs_Part3.zip`**, give the link, continue.

### PART 4 — Skill effects on black (16 images) → `SJ_P03_Jobs_Part4.zip`

| # | File | Size | Description |
|---|---|---|---|
| 61 | `vfx_fire_bolt.png` | 1024×1024 | A single fire bolt falling diagonally down-right, bright core, flame tail. |
| 62 | `vfx_cold_bolt.png` | 1024×1024 | A single ice shard falling diagonally down-right with frost sparkles. |
| 63 | `vfx_lightning_bolt.png` | 1024×1024 | A vertical jagged lightning bolt, bright white-yellow core. |
| 64 | `vfx_soul_strike.png` | 1024×1024 | A violet ghostly orb with a wispy tail, flying to the RIGHT. |
| 65 | `vfx_fire_wall.png` | 1024×1024 | A wide low wall of flames (horizontal strip shape, centred). |
| 66 | `vfx_frost_nova.png` | 1024×1024 | A ring of ice spikes bursting outward from the centre, top-down-ish side view. |
| 67 | `vfx_energy_shield.png` | 1024×1024 | A translucent blue hexagon-pattern bubble (sphere). |
| 68 | `vfx_arrow_trail.png` | 1024×1024 | A long glowing white-gold streak, horizontal, fading to the left (arrow trail). |
| 69 | `vfx_arrow_shower.png` | 1024×1024 | A spray of glowing arrow streaks falling down-right from the top-left. |
| 70 | `vfx_ankle_trap.png` | 1024×1024 | A snapping iron trap with small golden sparks (seen from the side). |
| 71 | `vfx_heal.png` | 1024×1024 | Rising green-white sparkles and small crosses from the bottom. |
| 72 | `vfx_blessing.png` | 1024×1024 | Golden feathers and light rays falling gently from above. |
| 73 | `vfx_holy_light.png` | 1024×1024 | A vertical pillar of white-gold light hitting the ground with a burst. |
| 74 | `vfx_pneuma.png` | 1024×1024 | A soft white dome made of feathers and light. |
| 75 | `vfx_whirlwind.png` | 1024×1024 | A horizontal ring of sword wind (white-blue arcs) spinning, side view. |
| 76 | `vfx_dash.png` | 1024×1024 | Horizontal speed streaks and dust burst, moving to the RIGHT. |

➡ Zip 61–76 + `manifest.json` as **`SJ_P03_Jobs_Part4.zip`**, give the link, continue.

### PART 5 — Expression heads (10 images) → `SJ_P03_Jobs_Part5.zip`
The game swaps the head piece during actions so the hero shouts when attacking and winces when hit. Each image = **only the head (with hat/hair/headband of that job), seen from the side facing right, exactly the same size, angle and drawing as the head piece in that job's parts sheet**, neck stump at the bottom centre. 512×512, transparent, head centred with the neck touching the bottom margin.

| # | File | Size | Description |
|---|---|---|---|
| 77 | `hero_head_attack.png` | 512×512 | Base hero (`30_hero_design.png`) head: **battle shout** — mouth open wide, eyebrows down, fierce eyes. |
| 78 | `hero_head_hurt.png` | 512×512 | Base hero head: **hurt** — eyes squeezed shut, teeth clenched, head slightly tilted back. |
| 79 | `job_swordsman_head_attack.png` | 512×512 | Swordsman head (headband) — battle shout. |
| 80 | `job_swordsman_head_hurt.png` | 512×512 | Swordsman head — hurt. |
| 81 | `job_mage_head_attack.png` | 512×512 | Mage head (pointed hat) — focused casting face: eyes glowing violet, mouth open chanting. |
| 82 | `job_mage_head_hurt.png` | 512×512 | Mage head — hurt, hat knocked a little crooked. |
| 83 | `job_archer_head_attack.png` | 512×512 | Archer head (feather) — one eye closed aiming, determined grin. |
| 84 | `job_archer_head_hurt.png` | 512×512 | Archer head — hurt. |
| 85 | `job_acolyte_head_attack.png` | 512×512 | Acolyte head (cap) — determined prayer face, mouth open, eyes glowing gold. |
| 86 | `job_acolyte_head_hurt.png` | 512×512 | Acolyte head — hurt. |

➡ Zip 77–86 + `manifest.json` as **`SJ_P03_Jobs_Part5.zip`** and give the link.

## 5. manifest.json
```json
[{"no":1,"file":"job_swordsman_design.png","size":"1024x1024","background":"transparent","status":"ok"}]
```
Use `"status":"redo-suggested"` + `"note"` when something didn't come out right.

## 6. Checklist (before each zip)
- [ ] Exact file names; PNG; transparency (black only for `vfx_*`).
- [ ] Parts sheets: identical layout to `31_hero_parts.png`, joint dots present, weapon slot empty.
- [ ] Weapons: same pose and handle position as the original sword piece.
- [ ] Each job reads as a different character (outfit, colours, signature item) but with the same face and proportions.
- [ ] Expression heads: same size and angle as the head piece of that job.
- [ ] No text or letters anywhere.

## 7. Final reply
Give all 5 zip links and list any files that need a redo.
