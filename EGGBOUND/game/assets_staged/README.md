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
- 2026-10-14: Z01 Hrimarch the Frost Sovereign (ice-king boss, BATCH22): complete 16/16 — 12 standard + `front_down`
  imported at front_idle height 380 (boss); ice shards `fxZ01_shard_a|b|c` cropped to 180 px tall (the game will orbit
  them around him as his aura). Placement / mechanics / obtainable: decided with the owner when it goes in.
- 2026-10-14 BATCH21 (ChatGPT): E01 Griffin Cub complete 12/12 (front_idle height 310) · F01 Coral Crab 10/12 at 280 —
  `front_cast` and `back_attack` PNGs were broken inside the zip (bottom half missing) → asked for a resend; re-import
  them with the set's original front_idle at 280. G01 / E11 / C10 zips arrived truncated (G01 7/12 salvaged, E11 1/12,
  C10 2/12) → asked for a resend of the whole sets as single files or two small zips.
- 2026-10-14 BATCH21 (resend): G01 Bastet Kitten complete 12/12 (5 recovered PNGs merged with the 7 salvaged earlier,
  same canvas) · H01 Kappa complete 12/12 · H04 Baku complete 12/12 — all commons, imported at front_idle height 290.
  E11 / C10 resend zips were byte-identical to the first truncated uploads → still E11 1/12, C10 2/12.
- 2026-10-14 BATCH21 (resend 2): F01 Coral Crab complete 12/12 (`front_cast` + `back_attack` resent, merged with the
  original canvas set and re-imported at 280 — the 10 earlier files came out byte-identical) · F03 Ghost Jelly 11/12
  at 290 (its `front_hit` PNG was 0 bytes inside the zip → resend; the set's poses are pre-normalised to 600 px on a
  1024 canvas, bottom y=870) · C10 Jade Qilin Calf 6/12 at 310 (master, front_idle, front_attack, front_cast,
  back_burst, egg; zips REPAIRED_02 + _06 arrived, 03–05 did not). Missing C10: front_hit, front_burst, back_idle,
  back_attack, back_cast, back_hit — re-import with the set's original front_idle when they come.
- 2026-10-14 BATCH21: E10 Dragontooth Skeleton complete 12/12 at 290 (common; transparent 1024 PNGs, one shared
  source scale, feet at y=870). E11 `_SET_1` zip was the same truncated file a third time (md5 a901398d) → still 1/12.
