# assets_staged/

Processed sprites whose monster is **not in the game yet**. `build.mjs` only embeds `assets/`, so files here cost no
bundle size. When the monster is added to `SPECIES` (data.ts), move its files into `assets/` and set `art:`.

- S01 Valkyr Stormwing (BATCH10 Starborn, Google Flow 2026-10-13): 11/12 — missing `monS01_front_attack`
  (Flow returned the back-view thrust twice). Imported with `import_art.py <dir> S01 360 --out assets_staged`.
