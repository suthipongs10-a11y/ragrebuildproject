# Summon Jump — Art Brief P00: UI Kit

> **ข้อความถึงผู้ใช้:** แนบไฟล์นี้ในแชท ChatGPT เดิม (แชทที่ทำภาพชุดก่อนๆ) แล้วพิมพ์ว่า
> **"อ่านไฟล์นี้แล้วทำตามทั้งหมด เริ่ม Part 1 ได้เลย"**
> ถ้าหยุดกลางทางให้พิมพ์ **"ทำต่อจากที่ค้าง"** · ได้ zip 2 ไฟล์ ส่งให้ Claude ไม่ต้องเปลี่ยนชื่อ

---

## 0. Instructions to ChatGPT

This is the **UI kit** for my game **Summon Jump** (the painted fantasy platformer you already made art for in this chat). It has **2 parts, 40 images**. Do Part 1 → Part 2. After each part, zip that part's PNGs **plus `manifest.json`** with the exact zip name given, give me the link, then continue to the next part automatically. If you hit a limit, stop after a complete image and tell me the number to continue from.

Use the same **golden valley style reference** from earlier in this chat. The UI must feel like part of that painted world: **aged bronze and gold metal, warm parchment, dark walnut wood, soft inner glow**, slightly hand-painted, but **clean and readable on a phone screen**.

## 1. Global style
- Fantasy RPG UI, hand-painted finish, warm bronze/gold trims, dark brown translucent-looking fills (paint them as solid dark brown; I will add transparency in code).
- Clean shapes, strong silhouette, no tiny noisy details that disappear at small sizes.
- **No text, letters or numbers** anywhere (except items 39–40 which are number sheets).
- Every element centered with a small empty margin.

## 2. Background rules
- **All images: true transparent PNG** (real alpha, no checkerboard, no box behind, no glow halo bleeding outside the shape unless the item asks for a glow).

## 3. Size and 9-slice rules
- Frames and panels marked **9-slice** must have **plain, uniform borders of equal thickness on all four sides and a plain center**, with all decoration placed **only in the four corners**, so the image can be stretched without distortion.
- Buttons are perfect circles unless stated.

## 4. Image list

### PART 1 — Frames, panels, buttons (24 images) → `SJ_P00_UI_Kit_Part1.zip`

| # | File | Size | Description |
|---|---|---|---|
| 1 | `ui_panel_main.png` | 512×512 | **9-slice** large menu panel: dark walnut-brown center, bronze-gold border with ornate corner pieces. |
| 2 | `ui_panel_small.png` | 512×256 | **9-slice** small panel/tooltip: same style, thinner border, simple corners. |
| 3 | `ui_panel_parchment.png` | 512×512 | **9-slice** parchment paper panel with torn-free clean edges and small bronze corner caps (for quest/sign text). |
| 4 | `ui_header_ribbon.png` | 1024×256 | Horizontal title ribbon banner in deep crimson cloth with gold edges, empty center for text. |
| 5 | `ui_tab_off.png` | 384×128 | Rounded tab (inactive): dark bronze, subtle. |
| 6 | `ui_tab_on.png` | 384×128 | Same tab active: warm gold, bright edge highlight. |
| 7 | `ui_btn_primary.png` | 512×160 | **9-slice** rectangular button, glossy warm-gold, rounded corners. |
| 8 | `ui_btn_secondary.png` | 512×160 | **9-slice** rectangular button, dark bronze, rounded corners. |
| 9 | `ui_btn_danger.png` | 512×160 | **9-slice** rectangular button, deep crimson with gold edge. |
| 10 | `ui_btn_round.png` | 512×512 | Round action button base: dark bronze ring, dark center (I put icons on top). |
| 11 | `ui_btn_round_big.png` | 512×512 | Larger round main button for ATTACK: thicker gold ring, crossed-swords engraving very faint in the center. |
| 12 | `ui_btn_round_jump.png` | 512×512 | Round JUMP button: gold ring with a soft upward wind-swirl engraving, faint. |
| 13 | `ui_btn_spirit.png` | 512×512 | Round SPIRIT button: lavender-silver ring with small star gems around the rim, glowing violet center. |
| 14 | `ui_btn_spirit_ready.png` | 512×512 | Same spirit button fully charged: bright violet-white glow, radiant. |
| 15 | `ui_joystick_base.png` | 512×512 | Virtual joystick base: semi-dark bronze ring with 4 tiny arrow notches (up/down/left/right), empty center. |
| 16 | `ui_joystick_knob.png` | 256×256 | Joystick knob: polished gold disc with a soft gem center. |
| 17 | `ui_bar_frame.png` | 1024×128 | **9-slice** horizontal bar frame for HP/SP/EXP: bronze rim, empty dark inside. |
| 18 | `ui_bar_fill_hp.png` | 1024×64 | Bar fill: rich red with a subtle top highlight (stretchable horizontally). |
| 19 | `ui_bar_fill_sp.png` | 1024×64 | Bar fill: deep blue. |
| 20 | `ui_bar_fill_exp.png` | 1024×64 | Bar fill: warm amber-gold. |
| 21 | `ui_bar_fill_spirit.png` | 1024×64 | Bar fill: violet with tiny sparkles. |
| 22 | `ui_slot_item.png` | 256×256 | Square inventory slot: dark recessed square with bronze rim. |
| 23 | `ui_slot_card.png` | 256×256 | Card socket slot: small vertical card-shaped recess with violet-gold rim. |
| 24 | `ui_portrait_frame.png` | 512×512 | Round hero portrait frame: ornate gold ring with a small crown at the top. |

➡ Zip 1–24 + `manifest.json` as **`SJ_P00_UI_Kit_Part1.zip`**, give the link, continue.

### PART 2 — Badges, rarity, element, currency, misc (16 images) → `SJ_P00_UI_Kit_Part2.zip`

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

➡ Zip 25–40 + `manifest.json` as **`SJ_P00_UI_Kit_Part2.zip`**, give the link.

## 5. manifest.json
```json
[{"no":1,"file":"ui_panel_main.png","size":"512x512","background":"transparent","status":"ok"}]
```
Use `"status":"redo-suggested"` + `"note"` when something didn't come out right.

## 6. Checklist (before each zip)
- [ ] Exact file names; PNG; real transparency.
- [ ] 9-slice items: equal plain borders, decoration only in corners, plain center.
- [ ] No text or letters (numbers only in 39–40).
- [ ] Same bronze/gold/walnut palette across every item; matches the painted world.

## 7. Final reply
Give both zip links and list any files that need a redo.
