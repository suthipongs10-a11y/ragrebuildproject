# art-store — full-resolution sources of received art

Zips are never committed, so the PNGs are kept here as full-resolution WebP (same file names, `.webp`). The game never loads
this folder (the build ignores it); `npm run art:jobs` cuts the job rig pieces from `P03_Jobs`. Everything listed is wired as of 2026-10-10.
Each folder has `files.json` (source zip, file name, original size). All sets passed the brief check (names, sizes, backgrounds).

| Folder | Brief | Zips | Files |
|---|---|---|---|
| `P03_Jobs` | `ART_P03_Jobs.md` | `SJ_P03_Jobs_Part1–5` | 86 |
| `P01_World_Props` | `ART_P01_World_Props.md` | `SJ_P01_World_Props_Part1–2` | 29 |
| `P05_NPC_Portal` | `ART_P05_NPC_Portal.md` | `SJ_P05_NPC_Portal` | 3 |
| `P03_Gear_Cards` | `ART_P03_Gear_Cards_VFX.md` Parts 1–2 | `Summon_Jump_v3_Part1_Gear`, `Summon_Jump_v3_Part2_Cards_Skills` | 42 |

(`Summon_Jump_v3_Part3_VFX_Env_1.zip` was byte-identical to the Part 3 zip already imported into `public/assets/P03_VFX_Env`.)

## Notes for wiring
- Job parts sheets: 7 pieces each + joint dots, weapon slot empty. Swordsman matches the `31_hero_parts` layout closely;
  mage / archer / acolyte pieces sit in the same slots but are bigger/shifted (hat, long robe, cape) → detect pieces and
  joint dots per sheet instead of using the hero sheet's fixed rectangles.
- `npm run art:import` resizes non-matching names to 256 px (e.g. `job_*`, `npc_*`) — extend `target()` before importing.
- To import later: rebuild a zip from a folder (PNG via `sharp`), or teach `art:import` to read a folder of WebP.
