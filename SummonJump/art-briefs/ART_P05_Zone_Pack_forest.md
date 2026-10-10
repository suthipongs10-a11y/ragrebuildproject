# Summon Jump — Art Brief P05: Zone Pack — forest

> **ข้อความถึงผู้ใช้:** แนบไฟล์นี้ในแชท ChatGPT เดิม แล้วพิมพ์ว่า
> **"อ่านไฟล์นี้แล้วทำตามทั้งหมด เริ่ม Part 1 ได้เลย"**
> ถ้าหยุดกลางทางให้พิมพ์ **"ทำต่อจากที่ค้าง"** · ได้ zip 2 ไฟล์ ส่งให้ Claude ไม่ต้องเปลี่ยนชื่อ
> เกมใช้ภาพชั่วคราวไปก่อน ไม่ต้องรีบ — ภาพมาแล้วค่อยสลับเข้าอัตโนมัติ

---

## 0. Instructions to ChatGPT
This is a **zone pack** for my game **Summon Jump** (the painted fantasy platformer you already made art for in this chat). Zone: **Forest (zone 1, the first area after town)**. The game already uses the existing forest backgrounds (`zone_forest_*`, the sunny valley forest with flat-topped trees) as variation A. I need **3 more variations (B, C, D)** of the same zone so the 6 maps of this zone don't all look the same, plus a few props. **20 images, 2 parts.** After each part, zip that part's PNGs **plus `manifest.json`** with the exact zip name, give the link and continue automatically.

**Layer rules (very important, the game scrolls them at different speeds):** every variation has 5 layers that must belong to the **same scene**: far (opaque painting), mid and near (transparent overlays, tileable left↔right), ground strip (tileable), floating platform. Side view, horizon around 55–65 % height, the hero walks on the ground strip.

## 1. Global style
- Hand-painted digital painting, soft visible brushstrokes, warm golden-hour light, muted ochre / sand / sage / dusty peach palette, richer contrast on the subject (same world as everything earlier in this chat, style reference = the golden valley painting).
- Cute-but-cool **original** fantasy, readable silhouettes at 64 px on a phone. **Original designs only: do not copy or imitate monsters, characters or items from Ragnarok Online, Summoners War or any other game.**
- **No text, letters, numbers, logos or watermark. No ground shadow** (except the far background paintings, which are full scenes).

## 2. Background rules
| Files | Background |
|---|---|
| `*_far.png` | full opaque painting |
| everything else | **true transparent PNG** |

## 3. Size rules
Exact sizes from the table. "Tileable horizontally" = the left and right edges match so copies can sit side by side without a seam.

## 4. Image list

### PART 1 — Variations B and C (10 images) → `SJ_P05_Zone_forest_Part1.zip`
| # | File | Size | Background | Description |
|---|---|---|---|---|
| 1 | `zone_forest_b_far.png` | 1920×1080 | opaque | **Far background B** — full painting, no transparency, distant layer only (sky, far mountains/scenery). Sunny mushroom glade: giant red-and-cream mushrooms among the trees, fireflies, flowers, soft dappled light. |
| 2 | `zone_forest_b_mid.png` | 1920×1080 | transparent | **Mid layer B** — middle-distance scenery of the same scene (trees / rocks / buildings), bottom half filled, top transparent, **tileable horizontally**. |
| 3 | `zone_forest_b_near.png` | 1920×1080 | transparent | **Near layer B** — close foreground silhouettes (bushes, roots, rocks) only along the bottom third, rest transparent, **tileable horizontally**. |
| 4 | `zone_forest_b_ground.png` | 1920×320 | transparent | **Ground strip B** — the walkable ground seen from the side: grass/stone/sand top edge at about 35 % from the top, soil below, **tileable horizontally**. |
| 5 | `zone_forest_b_plat.png` | 1024×400 | transparent | **Floating platform B** — a floating ledge matching this scene, flat walkable top at about 25 % from the top, rough underside. |
| 6 | `zone_forest_c_far.png` | 1920×1080 | opaque | **Far background C** — full painting, no transparency, distant layer only (sky, far mountains/scenery). Misty deep woods: huge mossy roots and hanging vines, cooler green-blue light, fog between trunks (a little darker, still friendly). |
| 7 | `zone_forest_c_mid.png` | 1920×1080 | transparent | **Mid layer C** — middle-distance scenery of the same scene (trees / rocks / buildings), bottom half filled, top transparent, **tileable horizontally**. |
| 8 | `zone_forest_c_near.png` | 1920×1080 | transparent | **Near layer C** — close foreground silhouettes (bushes, roots, rocks) only along the bottom third, rest transparent, **tileable horizontally**. |
| 9 | `zone_forest_c_ground.png` | 1920×320 | transparent | **Ground strip C** — the walkable ground seen from the side: grass/stone/sand top edge at about 35 % from the top, soil below, **tileable horizontally**. |
| 10 | `zone_forest_c_plat.png` | 1024×400 | transparent | **Floating platform C** — a floating ledge matching this scene, flat walkable top at about 25 % from the top, rough underside. |

➡ Zip → **`SJ_P05_Zone_forest_Part1.zip`**, give the link, continue.

### PART 2 — Variation D + props (10 images) → `SJ_P05_Zone_forest_Part2.zip`
Props: side view, standing on the ground (bottom of the object on the bottom margin), transparent.

| # | File | Size | Background | Description |
|---|---|---|---|---|
| 11 | `zone_forest_d_far.png` | 1920×1080 | opaque | **Far background D** — full painting, no transparency, distant layer only (sky, far mountains/scenery). Ancient forest ruins: overgrown stone arches and small shrines covered in moss and roots, warm god-rays through the canopy. |
| 12 | `zone_forest_d_mid.png` | 1920×1080 | transparent | **Mid layer D** — middle-distance scenery of the same scene (trees / rocks / buildings), bottom half filled, top transparent, **tileable horizontally**. |
| 13 | `zone_forest_d_near.png` | 1920×1080 | transparent | **Near layer D** — close foreground silhouettes (bushes, roots, rocks) only along the bottom third, rest transparent, **tileable horizontally**. |
| 14 | `zone_forest_d_ground.png` | 1920×320 | transparent | **Ground strip D** — the walkable ground seen from the side: grass/stone/sand top edge at about 35 % from the top, soil below, **tileable horizontally**. |
| 15 | `zone_forest_d_plat.png` | 1024×400 | transparent | **Floating platform D** — a floating ledge matching this scene, flat walkable top at about 25 % from the top, rough underside. |
| 16 | `prop_forest_mushroom.png` | 512×512 | transparent | Cluster of 3 giant spotted mushrooms of different heights, standing on the ground. |
| 17 | `prop_forest_log.png` | 1024×512 | transparent | Fallen mossy log lying on the ground, small ferns on it. |
| 18 | `prop_forest_lantern.png` | 512×1024 | transparent | Wooden lantern post with a warm glowing paper lantern. |
| 19 | `prop_forest_bush.png` | 512×512 | transparent | Round bush with red berries and small flowers. |
| 20 | `prop_forest_shrine.png` | 1024×1024 | transparent | Small mossy stone forest shrine with a little roof and a glowing offering bowl. |

➡ Zip → **`SJ_P05_Zone_forest_Part2.zip`** and give the link.

## 5. manifest.json (inside every zip)
```json
[{"no":1,"file":"zone_forest_b_far.png","size":"1920x1080","background":"opaque","status":"ok"}]
```
Use `"status":"redo-suggested"` with a short `"note"` if an image did not come out as asked.

## 6. Checklist before each zip
- [ ] Exact file names and sizes.
- [ ] Transparent images have real alpha (no checkerboard, no box, no halo).
- [ ] No text, no watermark.
- [ ] The 5 layers of one variation look like one scene; mid/near/ground tile left↔right.

## 7. Final reply
2 zip links + any files that need a redo.
