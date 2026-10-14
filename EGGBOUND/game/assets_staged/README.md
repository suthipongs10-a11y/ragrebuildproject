# assets_staged/

Processed sprites whose monster is **not in the game yet**. `build.mjs` only embeds `assets/`, so files here cost no
bundle size. When the monster is added to `SPECIES` (data.ts), move its files into `assets/` and set `art:`.

- S01 Valkyr Stormwing (BATCH10 Starborn, Google Flow 2026-10-13): complete 12/12
- S02 Chimera Rex v2 (single head, winged; Google Flow 2026-10-13): complete 12/12
- S03 Panchanaga (5-headed naga, WATER; transparent PNGs 2026-10-13): complete 12/12, 5 heads checked in every pose
- S04 Yamata Orochi (8 heads, DARK; transparent PNGs 2026-10-13): complete 12/12
- All Starborn sets imported at front_idle height 360 (`import_art.py <dir> S0x 360 --out assets_staged`); eggs at 254.
  S01–S04 together ≈ 1.5MB — too much for the 16MB single-file build, so they need separate-file loading when added.
- BATCH11 extras: egg_starborn, starborn_shard, star_point
- 2026-10-13: S01–S04 moved to `game/assets_ext/` (the game uses them as zone bosses; separate files loaded on demand).
- 2026-10-14 (all at front_idle height 360, scale matches S01–S04):
  - S05 Thunder Qilin: complete 12/12 (transparent 1024 PNGs, feet at y≈870)
  - S06 Huanglong Gold Dragon: 8/12 — zip was cut off; `front_burst` PNG itself truncated. Missing: front_burst,
    back_hit, back_burst, eggS06
  - S07 Trimukha Asura King: 7/12 (ChatGPT usage limit; 1254px canvas). Missing: back_attack, back_cast, back_hit,
    back_burst, eggS07. Front view is near-frontal rather than 3/4 (accepted for a many-armed humanoid; no mirror)
  - Missing poses arriving later: put them in a folder with the set's `front_idle` (same canvas size as before) and
    re-run `import_art.py <dir> S0x 360 --out assets_staged` so the scale stays the same
- 2026-10-14 (later): S06 complete 12/12 (`EGGBOUND_MONS06_COMPLETE_FIXED`, re-imported whole set at 360) ·
  S07 complete 12/12 (the 5 missing PNGs merged with the original 7 in one folder, re-imported at 360; back views are
  near-straight back, egg drawn taller than asked and scaled to egg height). S05–S07 are now ready to enter the game.
