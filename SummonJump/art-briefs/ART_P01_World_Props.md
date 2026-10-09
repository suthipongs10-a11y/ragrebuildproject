# Summon Jump — Art Brief P01: World Props

> **ข้อความถึงผู้ใช้:** แนบไฟล์นี้ในแชท ChatGPT เดิม แล้วพิมพ์ว่า
> **"อ่านไฟล์นี้แล้วทำตามทั้งหมด เริ่ม Part 1 ได้เลย"**
> ถ้าหยุดกลางทางให้พิมพ์ **"ทำต่อจากที่ค้าง"** · ได้ zip 2 ไฟล์ ส่งให้ Claude ไม่ต้องเปลี่ยนชื่อ
> (เกมใช้ภาพชั่วคราวไปก่อน ไม่ต้องรีบ — ภาพมาแล้วค่อยสลับเข้า)

---

## 0. Instructions to ChatGPT

This is the **world props pack** for my game **Summon Jump** (the painted fantasy platformer you already made art for in this chat): warp pipes, breakable boulders, gates, signs, chests, a save statue, town props and 4 town NPCs. It has **2 parts, 29 images**. Do Part 1 → Part 2. After each part, zip that part's PNGs **plus `manifest.json`** with the exact zip name given, give me the link, then continue automatically. If you hit a limit, stop after a complete image and tell me the number to continue from.

Use the same **golden valley style reference** and the same painted world as earlier in this chat (hero, monsters, UI kit). Props stand on the ground in **side view** (flat orthographic, no perspective). NPCs face **left**, full body, **feet at the same height** in both of their poses.

## 1. Global style
- Hand-painted digital painting, soft visible brushstrokes, warm golden-hour light, muted ochre / sand / sage / dusty peach palette, richer contrast on the subject.
- Aged bronze, weathered stone, warm wood. Clean readable silhouettes that still read at 64 px on a phone.
- **No text, letters, numbers, logos or watermark** (signs and doors stay blank).
- No ground shadow, no scenery behind the object.

## 2. Background rules
- **All images: true transparent PNG** (real alpha, no checkerboard, no box, no glow halo outside the shape unless the item asks for a glow).

## 3. Size rules
- Use exactly the size in the tables. Keep the object centered with a small empty margin, **bottom of the object touching the same baseline** (bottom margin equal) so props line up on the ground.
- Items marked **tileable** must have identical edges on the tiling axis (top = bottom, or left = right).

## 4. Image list

### PART 1 — Props (16 images) → `SJ_P01_World_Props_Part1.zip`

| # | File | Size | Description |
|---|---|---|---|
| 1 | `prop_pipe_top.png` | 512×256 | Stone-and-bronze warp pipe, **top cap only**, seen from the side: a wide rounded rim with a dark opening hint on top. Same width as the body piece below it. |
| 2 | `prop_pipe_body.png` | 512×256 | Matching pipe **body segment**, tileable vertically (top and bottom edges identical so it can stack). Same width as the cap. |
| 3 | `prop_rock_wall.png` | 512×512 | Giant cracked boulder wall block, **tileable vertically**, grey-brown stone with warm orange cracks (it can be smashed by fire). |
| 4 | `prop_rock_debris.png` | 512×256 | Pile of broken rock pieces and a little dust, lying on the ground (what remains after the rock wall is smashed). |
| 5 | `prop_gate_closed.png` | 1024×1024 | Tall carved stone gate/door, **closed**, with a glowing blank rune circle in the middle. |
| 6 | `prop_gate_open.png` | 1024×1024 | The same gate, **opened** (doors slid apart), warm light inside. |
| 7 | `prop_sign_wood.png` | 512×512 | Wooden signpost with a blank painted board (no writing), standing on the ground. |
| 8 | `prop_sign_stone.png` | 512×512 | Small carved stone marker with a blank face and a little moss. |
| 9 | `prop_chest_closed.png` | 512×512 | Treasure chest, **closed**, wood and bronze, gold lock. |
| 10 | `prop_chest_open.png` | 512×512 | The same chest, **open**, soft golden glow rising from inside. |
| 11 | `prop_statue_off.png` | 1024×1024 | Save statue: small stone spirit-guardian statue on a plinth, **dormant** (dull stone, no glow). |
| 12 | `prop_statue_on.png` | 1024×1024 | The same statue, **activated** (gems and eyes glowing warm gold, soft light ring on the plinth). |
| 13 | `prop_fountain.png` | 1024×1024 | Town fountain: round stone basin with a small tiered center, water streaming, side view. |
| 14 | `prop_anvil.png` | 512×512 | Blacksmith anvil on a wooden stump with a hammer leaning on it. |
| 15 | `prop_altar.png` | 1024×1024 | Summon altar: round stone dais with a violet magic circle carved on top and two small crystal pillars, faint violet glow. |
| 16 | `prop_ladder.png` | 256×512 | Wooden rope ladder / climbing ladder segment, **tileable vertically**. |

➡ Zip 1–16 + `manifest.json` as **`SJ_P01_World_Props_Part1.zip`**, give the link, continue.

### PART 2 — Water, doors, runes, NPCs (13 images) → `SJ_P01_World_Props_Part2.zip`

| # | File | Size | Description |
|---|---|---|---|
| 17 | `prop_water_surface.png` | 1024×128 | Painted water surface strip (top edge of an underwater area): translucent aqua with soft white foam line, **tileable horizontally** (left and right edges match). Semi-transparent alpha is allowed here. |
| 18 | `prop_door_wood.png` | 512×1024 | Wooden building door in a stone frame, closed, warm lit window slit. |
| 19 | `prop_rune_wind.png` | 512×512 | Floor rune plate: **wind** glyph (swirl) glowing mint-green on a round stone disc. Marks an area that needs the double-jump ability. |
| 20 | `prop_rune_water.png` | 512×512 | Floor rune plate: **water** glyph (drop) glowing aqua on a round stone disc. Marks an area that needs the dive ability. |
| 21 | `prop_rune_fire.png` | 512×512 | Floor rune plate: **fire** glyph (flame) glowing orange on a round stone disc. Marks something that needs the smash ability. |
| 22 | `npc_smith_idle.png` | 1024×1024 | Town **blacksmith**: stocky friendly man with leather apron, big mustache, hammer in hand; standing relaxed, facing left, full body. |
| 23 | `npc_smith_talk.png` | 1024×1024 | Same blacksmith, **talking pose**: mouth open, one hand gesturing. |
| 24 | `npc_priest_idle.png` | 1024×1024 | Town **priestess/acolyte**: gentle woman in white-gold robe with a small staff; standing relaxed, facing left, full body. |
| 25 | `npc_priest_talk.png` | 1024×1024 | Same priestess, **talking pose**: hand raised in blessing, kind smile. |
| 26 | `npc_merchant_idle.png` | 1024×1024 | Town **merchant**: round cheerful man with a huge backpack full of goods and a hat; standing relaxed, facing left, full body. |
| 27 | `npc_merchant_talk.png` | 1024×1024 | Same merchant, **talking pose**: pointing at his goods, mouth open. |
| 28 | `npc_guide_idle.png` | 1024×1024 | Town **guide kid**: young girl with a cape and satchel, bright eyes (a helper NPC); standing relaxed, facing left, full body. |
| 29 | `npc_guide_talk.png` | 1024×1024 | Same guide, **talking pose**: waving one hand, mouth open. |

➡ Zip 17–29 + `manifest.json` as **`SJ_P01_World_Props_Part2.zip`**, give the link.

## 5. manifest.json
```json
[{"no":1,"file":"prop_pipe_top.png","size":"512x256","background":"transparent","status":"ok"}]
```
Use `"status":"redo-suggested"` + `"note"` when something didn't come out right.

## 6. Checklist (before each zip)
- [ ] Exact file names; PNG; real transparency.
- [ ] Tileable pieces tile cleanly; pipe cap and body have the same width.
- [ ] NPC idle/talk pairs: same character, same scale, same ground line.
- [ ] No text or letters anywhere.
- [ ] Same palette and painting style as the previous art in this chat.

## 7. Final reply
Give both zip links and list any files that need a redo.
