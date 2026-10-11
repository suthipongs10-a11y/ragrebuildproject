# Summon Jump — Art Brief P05: Turn Battle (tower + daily dungeon)

> **ข้อความถึงผู้ใช้:** แนบไฟล์นี้ในแชท ChatGPT เดิม แล้วพิมพ์ว่า
> **"อ่านไฟล์นี้แล้วทำตามทั้งหมด เริ่ม Part 1 ได้เลย"** · ได้ zip 2 ไฟล์ ส่งให้ Claude ไม่ต้องเปลี่ยนชื่อ
> ฉากสู้แบบเทิร์นของหอคอยและดันประจำวัน — ระหว่างรอ เกมใช้ฉากหลังของโซนเดิมกับวงแหวน/ปุ่มที่วาดด้วยโค้ดไปก่อน
> **Part 1 สำคัญกว่า** (ฉากหอคอย ฉากดัน ชุด UI) · Part 2 = ฉากดันแยกธาตุ ทำทีหลังได้

---

## 0. Instructions to ChatGPT
Battle screen art for my game **Summon Jump** (the painted fantasy game you already made art for in this chat). In these battles the player's **spirit team (left side)** fights **monsters (right side)** in turns, like a classic mobile monster-collecting RPG. **21 images, 2 parts.** After each part, zip that part's PNGs **plus `manifest.json`** with the exact zip name, give the link and continue automatically. If you hit a limit, stop after a complete image and tell me the number to continue from.

## 1. Global style
- Hand-painted digital painting, soft visible brushstrokes, warm golden-hour light, muted ochre / sand / sage / dusty peach palette, richer contrast on the subject (same world as everything earlier in this chat).
- **Original designs only: do not copy or imitate any other game's screens, emblems or UI.**
- **No text, letters, numbers, logos or watermark** anywhere (the game draws all text itself).

## 2. Background rules
- **Stages (`tb_stage_*`)**: full opaque scene, 1920×1080, **no characters or monsters**. Camera = side view at eye level, like a theatre stage: a wide, flat, clear battle floor across the **lower 40 %** of the picture (both teams stand there: left third and right third), the upper 60 % is scenery. Keep the centre uncluttered and a bit darker at the very bottom edge (UI buttons sit there).
- **Everything else**: **true transparent PNG** (real alpha, no checkerboard, no box, no halo).

## 3. Size rules
Exact sizes from the table, subject centred with a small empty margin, never cropped.

## 4. Image list

### PART 1 — Stages + battle UI (15 images) → `SJ_P05_TurnBattle_Part1.zip`
| # | File | Size | Description |
|---|---|---|---|
| 1 | `tb_stage_tower.png` | 1920×1080 | **Tower of Trials** interior: a huge round hall inside an ancient sky tower, worn golden stone floor with a faint circular rune pattern, tall arched windows showing clouds and sunset light, hanging banners (plain, no symbols), floating stone pieces near the ceiling. |
| 2 | `tb_stage_dungeon.png` | 1920×1080 | **Elemental shrine** (neutral): an ancient underground shrine, smooth stone floor, glowing crystal clusters in soft white and amber, broken pillars, roots coming through the ceiling, mysterious calm mood. |
| 3 | `tb_banner_win.png` | 1536×768 | **Victory emblem** (no text): a golden laurel wreath around a shining star and two crossed spirit feathers, ribbons flowing left and right, sparkles. Room in the middle-bottom for a word the game writes. |
| 4 | `tb_banner_lose.png` | 1536×768 | **Defeat emblem** (no text): the same layout but dull grey-violet, cracked star, drooping torn ribbons, a few falling dark petals. |
| 5 | `tb_ring_ally.png` | 512×256 | Glowing **teal** magic ring seen from the side (flat oval, perspective of a floor circle), soft light, thin rune marks. Goes under each spirit. |
| 6 | `tb_ring_enemy.png` | 512×256 | The same ring in **crimson red**. Goes under each monster. |
| 7 | `tb_ring_turn.png` | 512×256 | The same ring in **bright gold** with small rising sparkles: marks whose turn it is. |
| 8 | `tb_target.png` | 256×256 | Target marker: four red-gold arrowheads pointing inward around an empty centre (front view). |
| 9 | `tb_btn_skill.png` | 256×256 | Round **skill button frame**: thick antique-gold rim with small gems, the centre is **empty transparent** (the game puts the skill picture inside). |
| 10 | `tb_btn_ult.png` | 256×256 | Round **ultimate button frame**: more ornate, violet and gold rim with small wings on both sides, centre **empty transparent**. |
| 11 | `tb_icon_stun.png` | 128×128 | Status icon: three little yellow stars spinning in a circle. |
| 12 | `tb_icon_shield.png` | 128×128 | Status icon: a small glowing white-blue round shield. |
| 13 | `tb_icon_defdown.png` | 128×128 | Status icon: a cracked grey shield with a small red down-arrow shape (no letters). |
| 14 | `tb_icon_heal.png` | 128×128 | Status icon: a soft green glowing leaf-heart. |
| 15 | `tb_icon_speed.png` | 128×128 | Status icon: a small white-gold winged boot. |

➡ Zip 1–15 + `manifest.json` → **`SJ_P05_TurnBattle_Part1.zip`**, give the link, continue.

### PART 2 — Elemental dungeon stages (6 images) → `SJ_P05_TurnBattle_Part2.zip`
Same layout rules as `tb_stage_dungeon.png` (flat battle floor in the lower 40 %, no characters), one shrine per element of the day:

| # | File | Size | Description |
|---|---|---|---|
| 16 | `tb_stage_water.png` | 1920×1080 | Underwater-feeling shrine: blue stone, waterfalls on the walls, glowing blue coral, light rippling on the floor. |
| 17 | `tb_stage_fire.png` | 1920×1080 | Volcanic shrine: dark basalt, rivers of lava in the background, ember particles, orange glow. |
| 18 | `tb_stage_earth.png` | 1920×1080 | Earth shrine: mossy brown rock, giant tree roots, amber crystals, warm dust in the light. |
| 19 | `tb_stage_wind.png` | 1920×1080 | Sky shrine: white marble on top of clouds, wind ribbons, green-white light, birds far away. |
| 20 | `tb_stage_holy.png` | 1920×1080 | Holy shrine: white and gold temple hall, light beams from high windows, floating feathers. |
| 21 | `tb_stage_dark.png` | 1920×1080 | Dark shrine: deep violet stone, purple moonlight, floating dark crystals, faint mist. |

➡ Zip 16–21 + `manifest.json` → **`SJ_P05_TurnBattle_Part2.zip`** and give the link.

## 5. manifest.json
```json
[{"no":1,"file":"tb_stage_tower.png","size":"1920x1080","background":"opaque","status":"ok"},
 {"no":3,"file":"tb_banner_win.png","size":"1536x768","background":"transparent","status":"ok"}]
```

## 6. Checklist
- [ ] Exact file names and sizes.
- [ ] Stages: opaque, no characters, flat clear floor in the lower 40 %.
- [ ] All other images: real transparent background.
- [ ] No text, letters, numbers or watermark anywhere.
