# Changelog

## Phase 3 (in progress) — 2026-10-09
- Jobs (Novice → Swordsman/Mage/Archer/Acolyte), 34 skills, job weapons, hats/capes/shoes/shields, potions (content CSV).
- `shared/progression` (levels, stats, skills, equip, cards, refine), `shared/sim/skills` (bolt/aoe/dash/rain/zone/heal/buff, SP, cast, cooldowns), bows shoot arrows.
- DOM menus with UI kit frame: Status, Skills, Equipment+bag, Cards, Job change, Refine (smith), Shop (merchant). Skill buttons S1–S3, HP/SP/EXP HUD, level-up pillar.
- Art brief `ART_P03_Jobs.md` (76 images).
- Phone action button (talk/shop/refine/pipe/smash) only when standing next to an NPC or station; sits top-right. Tap NPCs/signs directly.

## Phase 2 (in progress) — 2026-10-09
- Cut-out hero rig with JSON clips (idle/run/jump/fall/attack1-3/guard/hurt/death/cast).
- Combat sim in `shared/sim` (enemy AI for every `ai` type + 3 boss scripts, 3-hit combo, stomp, i-frames, shots), drops in `shared/rules/drops.ts`.
- RO damage numbers, crit starburst, slash/spark/ring VFX, hit-stop, shake, monster pose swap + dissolve, HP bar, death → respawn.

## Phase 1 (in progress) — 2026-10-09
- Platforming core in `shared/platformer` (tile collision, sub-stepped, coyote/buffer/variable jump/double jump/swim/drop-through), LDtk loader + validator, respawn rules.
- 8 prototype maps ported to `levels/world.ldtk` (`npm run levels`), room transitions, pipes, rock smash, signs/NPCs/chest, local save, scrolling camera.
- Art brief `ART_P01_World_Props.md`.
- Owner feedback: exit arrows + pipe labels, 🏠 home button, unstick on room entry, rock wall to ceiling, drown → back to town.

## 2026-10-09 — Art packs
- UI Kit complete (40/40, pack `P00_UI_Kit`); Monster Actions imported (42/42, pack `P02_Monster_Actions`).
- art:import brief check now reads only the File column (no false 'missing' from reference names).

## 2026-10-09 — UI Kit art (partial)
- Imported UI Kit Part 1 (22/40 images) into pack `P00_UI_Kit`; added `art-briefs/ART_P00_UI_Kit_REDO.md` for the 18 missing images.

## Phase 0 — 2026-10-09
- Project scaffold (Phaser 4.2.1, TS, Vite), shared formulas + tests, content pipeline, art import pipeline, legacy art pack, landscape controls, painted parallax world, CI + gh-pages deploy.
