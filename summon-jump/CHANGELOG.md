# Changelog

## Phase 1 (in progress) — 2026-10-09
- Platforming core in `shared/platformer` (tile collision, sub-stepped, coyote/buffer/variable jump/double jump/swim/drop-through), LDtk loader + validator, respawn rules.
- 8 prototype maps ported to `levels/world.ldtk` (`npm run levels`), room transitions, pipes, rock smash, signs/NPCs/chest, local save, scrolling camera.
- Art brief `ART_P01_World_Props.md`.

## 2026-10-09 — Art packs
- UI Kit complete (40/40, pack `P00_UI_Kit`); Monster Actions imported (42/42, pack `P02_Monster_Actions`).
- art:import brief check now reads only the File column (no false 'missing' from reference names).

## 2026-10-09 — UI Kit art (partial)
- Imported UI Kit Part 1 (22/40 images) into pack `P00_UI_Kit`; added `art-briefs/ART_P00_UI_Kit_REDO.md` for the 18 missing images.

## Phase 0 — 2026-10-09
- Project scaffold (Phaser 4.2.1, TS, Vite), shared formulas + tests, content pipeline, art import pipeline, legacy art pack, landscape controls, painted parallax world, CI + gh-pages deploy.
