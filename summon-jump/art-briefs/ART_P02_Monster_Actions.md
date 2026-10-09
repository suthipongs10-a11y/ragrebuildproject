# Summon Jump — Art Brief P02: Monster Actions

> **ข้อความถึงผู้ใช้:** แนบไฟล์นี้ในแชท ChatGPT เดิม แล้วพิมพ์ว่า
> **"อ่านไฟล์นี้แล้วทำตามทั้งหมด เริ่ม Part 1 ได้เลย"**
> ได้ zip 3 ไฟล์ ส่งให้ Claude ไม่ต้องเปลี่ยนชื่อ

---

## 0. Instructions to ChatGPT

My monsters need **action poses** so they can attack and react in the game. You already made these monsters earlier in this chat (files `32_poring.png` … `39_kraken.png`). This brief has **3 parts**. After each part, zip that part's PNGs + `manifest.json` with the exact zip name, give the link, and continue automatically. If you hit a limit, stop after a complete image and tell me the number to continue from.

**The golden rule for poses:** every pose of a monster must be the **same character, same size, same colors, same painting style, facing LEFT, side view**, standing on the **same invisible ground line** (feet/bottom at the same height in the image). Only the body pose changes. Think of them as 4 key frames of one animation.

Pose meanings:
- `idle` — neutral, relaxed, ready (like the original image).
- `windup` — anticipation just before attacking: leaning back, coiling, raising claws/weapon, eyes focused.
- `attack` — the peak of the hit: lunging forward to the left, claws/teeth/tail fully extended, dynamic.
- `hurt` — recoiling from a hit: leaning back to the right, eyes squeezed, a little squashed.

## 1. Global style
Same as all previous art: hand-painted digital painting, soft brushstrokes, warm golden light, muted ochre/sand/sage/peach palette, rich contrast on the creature. No text, no numbers, no watermark, no effects lines, no ground shadow.

## 2. Background
**True transparent PNG** for every image (real alpha, no box, no halo).

## 3. Size
**1024×1024** for every pose. Keep the creature at the **same scale** across its 4 poses and leave the same empty margin, so they line up when swapped.

## 4. Image list

### PART 1 — Forest monsters (12 images) → `SJ_P02_Monster_Actions_Part1.zip`
| # | File | Description |
|---|---|---|
| 1 | `mon_poring_idle.png` | Pink jelly blob (match `32_poring.png`), relaxed. |
| 2 | `mon_poring_windup.png` | Squashed low and wide, about to spring, determined eyes. |
| 3 | `mon_poring_attack.png` | Stretched tall and leaning left mid-bounce, mouth open in a cute battle cry. |
| 4 | `mon_poring_hurt.png` | Squished and tilted right, eyes shut ">_<", a jelly droplet flying off. |
| 5 | `mon_mantis_idle.png` | Green mantis warrior (match `34_mantis.png`), scythes folded. |
| 6 | `mon_mantis_windup.png` | Scythe arms raised high behind the head, body coiled back. |
| 7 | `mon_mantis_attack.png` | Both scythes slashing down-left, body lunging forward. |
| 8 | `mon_mantis_hurt.png` | Recoiling right, scythes up defensively, head turned away. |
| 9 | `mon_king_idle.png` | Giant crowned pink jelly king (match `33_poring_king.png`), smug. |
| 10 | `mon_king_windup.png` | Squashed very low, crown tilted, preparing a huge body-slam jump. |
| 11 | `mon_king_attack.png` | Mid-air slam shape: stretched tall, leaning left, angry eyes. |
| 12 | `mon_king_hurt.png` | Wobbling, crown askew, one eye shut. |

➡ Zip 1–12 → **`SJ_P02_Monster_Actions_Part1.zip`**, continue.

### PART 2 — Sky, sea, desert (16 images) → `SJ_P02_Monster_Actions_Part2.zip`
| # | File | Description |
|---|---|---|
| 13 | `mon_bird_idle.png` | Teal wind bird (match `35_wind_bird.png`), wings half open, hovering. |
| 14 | `mon_bird_idle2.png` | Same bird, wings fully down (second flap frame). |
| 15 | `mon_bird_attack.png` | Diving left, wings swept back, talons forward. |
| 16 | `mon_bird_hurt.png` | Tumbling, feathers ruffled, a few loose feathers. |
| 17 | `mon_harpy_idle.png` | Harpy queen (match `36_harpy_queen.png`), wings spread, hovering. |
| 18 | `mon_harpy_windup.png` | Wings raised high, body pulled back, talons ready. |
| 19 | `mon_harpy_attack.png` | Swooping left with talons extended, wings forward. |
| 20 | `mon_harpy_hurt.png` | Recoiling, one wing folded, grimacing. |
| 21 | `mon_fish_idle.png` | Sawtooth fish (match `37_sawtooth_fish.png`), swimming. |
| 22 | `mon_fish_windup.png` | Body curved back like a spring, fins flared. |
| 23 | `mon_fish_attack.png` | Lunging left, jaws wide open showing teeth. |
| 24 | `mon_fish_hurt.png` | Twisted, eyes wide, small bubbles. |
| 25 | `mon_scorpion_idle.png` | Sand scorpion (match `38_sand_scorpion.png`), tail curled. |
| 26 | `mon_scorpion_windup.png` | Tail arched far back over the body, claws raised. |
| 27 | `mon_scorpion_attack.png` | Tail stinger striking forward to the left over its head, claws open. |
| 28 | `mon_scorpion_hurt.png` | Flinching, legs bunched, tail lowered. |

➡ Zip 13–28 → **`SJ_P02_Monster_Actions_Part2.zip`**, continue.

### PART 3 — MVP Kraken rig + new forest monsters (14 images) → `SJ_P02_Monster_Actions_Part3.zip`
**Kraken parts sheet (for full animation):**
| # | File | Size | Description |
|---|---|---|---|
| 29 | `boss_kraken_parts.png` | 1536×1024 | Parts sheet of the kraken (match `39_kraken.png`), pieces separated with large gaps: head/mantle, left eye lid, right eye lid, jaw/beak, 4 separate tentacles (each a long curved piece with a round skin-colored joint dot at its base). Same painting style. |
| 30 | `boss_kraken_design.png` | 1024×1024 | The kraken fully assembled from those parts, front-left view, as the reference. |

**Three new forest monsters (4 poses each, invent consistent designs):**
| # | File | Description |
|---|---|---|
| 31 | `mon_mushroom_idle.png` | **Spore Cap**: a small walking mushroom with a red-brown spotted cap, little stubby legs, sleepy eyes. |
| 32 | `mon_mushroom_windup.png` | Cap puffed up, crouching, spores starting to glow. |
| 33 | `mon_mushroom_attack.png` | Hopping forward left, releasing a puff of glowing spores from under the cap. |
| 34 | `mon_mushroom_hurt.png` | Cap bent, eyes swirling. |
| 35 | `mon_boar_idle.png` | **Thorn Boar**: a stocky wild boar with mossy fur and thorny vines on its back. |
| 36 | `mon_boar_windup.png` | Head down, front hoof scraping the ground, ready to charge. |
| 37 | `mon_boar_attack.png` | Full charge to the left, tusks forward, legs stretched. |
| 38 | `mon_boar_hurt.png` | Skidding back, head turned away. |
| 39 | `mon_wisp_idle.png` | **Lantern Wisp**: a floating forest spirit-lantern made of glowing amber light and leaves (an enemy, slightly mischievous face). |
| 40 | `mon_wisp_windup.png` | Pulling inward, glow brightening. |
| 41 | `mon_wisp_attack.png` | Flaring out with a burst of amber light toward the left. |
| 42 | `mon_wisp_hurt.png` | Flickering, dimmed, leaves scattering. |

➡ Zip 29–42 → **`SJ_P02_Monster_Actions_Part3.zip`** and give the link.

## 5. manifest.json
```json
[{"no":1,"file":"mon_poring_idle.png","size":"1024x1024","background":"transparent","status":"ok"}]
```

## 6. Checklist
- [ ] Every monster's poses: same character, same scale, facing left, same ground line.
- [ ] Transparent backgrounds, exact file names.
- [ ] No text, no motion-line effects, no shadows on the ground.

## 7. Final reply
3 zip links + any files needing a redo.
