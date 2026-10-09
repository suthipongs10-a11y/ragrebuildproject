# Art pipeline — ChatGPT → zip → game

## 1. Roles
- **Claude** writes one **art brief** per phase (`art-briefs/ART_PXX_<name>.md`), using the template in §6.
- **Owner** attaches the brief in the *same long-running ChatGPT chat* (so it remembers the style and characters) and says: "อ่านไฟล์นี้แล้วทำตามทั้งหมด เริ่ม Part 1 ได้เลย". ChatGPT returns one zip per part.
- **Owner** drops the zips into `art-inbox/` (or sends them to Claude in chat).
- **Claude** runs `npm run art:import`, reviews `art-inbox/REPORT.md`, and writes a short **redo brief** for any failed files.

## 2. Style bible (paste-ready block is in every brief)
- Hand-painted digital painting, soft visible brushstrokes, warm golden-hour light, atmospheric haze.
- Palette: muted ochre, sand, sage green, dusty peach; richer contrast on the subject.
- Master reference: `reference_valley` (golden canyon painting). Characters: `30_hero_design`, `31_hero_parts`.
- No text, letters, numbers, logos, watermark, signature — except where a brief explicitly asks for a number font sheet.

## 3. Backgrounds and sizes
| Asset kind | Background | Typical size |
|---|---|---|
| Characters, monsters, props, icons, UI | transparent PNG | 1024² (props/characters), 512² (icons) |
| Zone far layer | full painting, no transparency | 1920×1080 (16:9) |
| Zone mid/near/ground/platform layers | transparent | 1920×1080 / 1024×512 |
| VFX | **pure black #000000** (added with additive blend) | 1024² |
| UI 9-slice frames | transparent, with flat uniform borders so they stretch | 512² |

## 4. Naming
`<category>_<id>[_<variant>].png`, lowercase, underscores.
- Monsters: `mon_<id>_idle.png`, `mon_<id>_windup.png`, `mon_<id>_attack.png`, `mon_<id>_hurt.png`
- Bosses (rigged): `boss_<id>_parts.png` + `boss_<id>_design.png`
- Hero/job parts: `job_<job>_parts.png`, `job_<job>_design.png`, armor: `arm_<set>_<part>.png`
- Spirits: `spr_<family>_<element>_small.png`, `..._big.png`, `..._awk_small.png`, `..._awk_big.png`
- Items: `wpn_`, `arm_`, `acc_`, `hat_`, `cape_`, `shoe_`, `card_<monster>.png`
- Skills: `skill_<id>.png`; VFX: `vfx_<id>.png`; UI: `ui_<id>.png`
- Zones: `zone_<zone>_<map>_{far,mid,near,ground,plat}.png`
Each zip: `SJ_PXX_<PackName>_PartN.zip` containing the PNGs + `manifest.json`.

## 5. Monster action standard (scales to 100+ monsters)
- Normal monsters: **4 painted poses** with identical scale, facing left, feet on the same baseline: `idle`, `windup` (anticipation), `attack` (peak of the hit), `hurt`. The game adds squash/stretch, lunges, bobbing and flashes in code, so 4 images give a convincing action cycle.
- Flyers/swimmers: same 4 poses; `idle` may be wings-up, plus optional `idle2` wings-down for flapping.
- Mini-bosses: 4 poses + `skill` pose.
- MVP / world bosses: **parts sheet** (separate limbs with joint dots, like the hero) + a design image → rigged in code with full attack patterns.
- Every monster also gets `card_<id>.png` (portrait card).

## 6. Brief template (Claude fills this in)
```
# Summon Jump — Art Brief PXX: <title>
> ข้อความถึงผู้ใช้: แนบไฟล์นี้ในแชท ChatGPT เดิม แล้วพิมพ์ "อ่านไฟล์นี้แล้วทำตามทั้งหมด เริ่ม Part 1 ได้เลย" ...
## 0. Instructions to ChatGPT (parts, order, zip names, continue rules, references)
## 1. Global style
## 2. Background rules
## 3. Size rules
## 4. Image list (tables per part: # | file | size | background | description)
## 5. manifest.json format
## 6. Checklist
## 7. Final reply format
```

## 7. Import tool behaviour (`npm run art:import <zip...>`)
1. Unzip to `art-inbox/<zip>/`; read `manifest.json`; compare with the brief's expected list.
2. For transparent assets: zero out alpha < 24 (kills glow halos), trim to bbox, keep 6 px padding.
3. For black-background VFX: keep RGB, convert to WebP without alpha (additive blend).
4. Detect pose baseline for monsters (lowest opaque row) and record `footY` in the manifest so poses never jitter.
5. Resize to target (characters 512 px tall max, icons 128, layers 1920 wide), encode WebP q80.
6. Pack atlases per pack; write `public/assets/<pack>/` and update `src/assets/manifest.generated.ts`.
7. Write `art-inbox/REPORT.md`: missing files, wrong backgrounds (opaque corners on transparent assets, non-black corners on VFX), wrong aspect ratio, duplicate images.
