# Summon Jump — Art Brief P00 (REDO): UI Kit — ภาพที่ยังขาด 18 ภาพ

> **ข้อความถึงผู้ใช้:** แนบไฟล์นี้ในแชท ChatGPT เดิม (แชทเดียวกับที่ทำ UI Kit Part 1) แล้วพิมพ์ว่า
> **"อ่านไฟล์นี้แล้วทำตามทั้งหมด เริ่ม Part 2 ได้เลย"**
> ถ้าหยุดกลางทางให้พิมพ์ **"ทำต่อจากที่ค้าง"** · ได้ zip 2 ไฟล์ ส่งให้ Claude ไม่ต้องเปลี่ยนชื่อ
> ภาพ 22 ภาพที่ทำเสร็จแล้ว (#1–22) **ไม่ต้องทำใหม่**

---

## 0. Instructions to ChatGPT

This is a **redo brief** for the **UI kit** of my game **Summon Jump**. The first zip only contained images #1–#22 of the original 40-image list. Please make **only the 18 missing images below** (#23–#40), keeping the **exact same style** as the 22 you already made in this chat (aged bronze and gold metal, warm parchment, dark walnut wood, soft inner glow, hand-painted but clean and readable on a phone). Keep the original numbering (#23–#40).

Two parts: **Part 2** (16 images, #25–#40) → **Part 3** (2 images, #23–#24). After each part, zip that part's PNGs **plus `manifest.json`** with the exact zip name given, give me the link, then continue automatically. If you hit a limit, stop after a complete image and tell me the number to continue from. Do not skip any image and do not merge several images into one sheet (except the two number sheets, which are single images by design).

## 1. Global style
- Fantasy RPG UI, hand-painted finish, warm bronze/gold trims, dark brown fills painted as solid dark brown.
- Clean shapes, strong silhouette, no tiny noisy details that disappear at small sizes.
- **No text, letters or numbers** anywhere (except #39–#40, the number sheets).
- Every element centered with a small empty margin.

## 2. Background rules
- **All images: true transparent PNG** (real alpha, no checkerboard, no box behind, no glow halo bleeding outside the shape unless the item asks for a glow).

## 3. Size rules
- Use exactly the size in the table. Rarity overlays must have an **empty transparent center** and a border of equal thickness on all sides.
- #39 and #40: 10 **equal cells** of 102.4 px width (1024 px total), each digit centered in its cell, all digits the same height and baseline.

## 4. Image list

### PART 2 — Badges, rarity, element, currency, number fonts (16 images) → `SJ_P00_UI_Kit_Part2.zip`

| # | File | Size | Description |
|---|---|---|---|
| 25 | `ui_rarity_common.png` | 256×256 | Square item-rarity border overlay: plain bronze. Empty center (transparent). |
| 26 | `ui_rarity_rare.png` | 256×256 | Same overlay: blue-silver with small gem corners. |
| 27 | `ui_rarity_legend.png` | 256×256 | Same overlay: gold with glowing corners. |
| 28 | `ui_rarity_mvp.png` | 256×256 | Same overlay: crimson-gold with flames at the corners. |
| 29 | `ui_elem_water.png` | 256×256 | Element badge: round gem, aquamarine water drop symbol. |
| 30 | `ui_elem_fire.png` | 256×256 | Element badge: round gem, flame symbol, orange-red. |
| 31 | `ui_elem_earth.png` | 256×256 | Element badge: round gem, rock/mountain symbol, brown-ochre. |
| 32 | `ui_elem_wind.png` | 256×256 | Element badge: round gem, swirl symbol, mint green. |
| 33 | `ui_elem_holy.png` | 256×256 | Element badge: round gem, radiant star, white-gold. |
| 34 | `ui_elem_dark.png` | 256×256 | Element badge: round gem, crescent moon, deep purple. |
| 35 | `ui_star.png` | 128×128 | A single gold star (for spirit 1★–6★ ratings). |
| 36 | `ui_star_empty.png` | 128×128 | Same star as a dark empty outline. |
| 37 | `ui_cur_gem.png` | 256×256 | Premium currency: faceted pink-violet crystal gem. |
| 38 | `ui_cur_scroll.png` | 256×256 | Summon scroll item: rolled parchment with violet wax seal. |
| 39 | `ui_numbers_white.png` | 1024×256 | **Number font sheet**: the digits **0 1 2 3 4 5 6 7 8 9** in one row, evenly spaced in 10 equal cells, chunky bold game-damage style, **white fill with thick dark-brown outline**. |
| 40 | `ui_numbers_crit.png` | 1024×256 | Same 10 digits, same layout and size, **red fill with yellow-gold outline and dark edge** (critical damage numbers). |

➡ Zip #25–#40 + `manifest.json` as **`SJ_P00_UI_Kit_Part2.zip`**, give the link, continue.

### PART 3 — Missing slot and portrait frame (2 images) → `SJ_P00_UI_Kit_Part3.zip`

| # | File | Size | Description |
|---|---|---|---|
| 23 | `ui_slot_card.png` | 256×256 | Card socket slot: small vertical card-shaped recess with violet-gold rim. |
| 24 | `ui_portrait_frame.png` | 512×512 | Round hero portrait frame: ornate gold ring with a small crown at the top. |

➡ Zip #23–#24 + `manifest.json` as **`SJ_P00_UI_Kit_Part3.zip`**, give the link.

## 5. manifest.json
```json
[{"no":25,"file":"ui_rarity_common.png","size":"256x256","background":"transparent","status":"ok"}]
```
Use `"status":"redo-suggested"` + `"note"` when something didn't come out right.

## 6. Checklist (before each zip)
- [ ] Exact file names; PNG; real transparency.
- [ ] Rarity overlays: empty center, equal borders.
- [ ] No text or letters (digits only in #39–#40).
- [ ] Same bronze/gold/walnut palette as the 22 finished images.
- [ ] Zip contains exactly the files of that part (no extra or duplicate files).

## 7. Final reply
Give both zip links and list any files that need a redo.
