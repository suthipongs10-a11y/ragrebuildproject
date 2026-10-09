# Phase 2 — Combat core · progress

Status: **in progress** (started 2026-10-09)

Art: `ART_P02_Monster_Actions` already imported (42/42, pack `P02_Monster_Actions`). No new brief needed for this phase.
VFX use code-drawn additive shapes until the P03 VFX pack (`ART_P03_Gear_Cards_VFX.md`) arrives.

## Checklist
- [x] Cut-out hero rig (`src/rig/`) from the legacy parts sheet; pose clips as JSON: idle, run, jump, fall, attack1/2/3, hurt, death, cast
- [x] Combat sim in `shared/sim/` (pure, seeded RNG): attack combo + hitboxes, hurtboxes, knockback, i-frames, stomp, hero HP/death
- [x] Hit-stop, screen shake, enemy flash
- [x] RO damage numbers (normal / crit red+yellow+starburst+"CRITICAL" / weak orange / resist grey / taken pink / heal green)
- [x] VFX: slash arcs, sparks, rings, particles (additive)
- [x] Enemy FSM from `monsters.csv` `ai`: hopper, walker, charger, flyer, swimmer, turret, boss scripts (king_slam, harpy_dive, kraken_ink)
- [x] Monster pose swap (idle / windup / attack / hurt) + squash/lunge/bob tweens; death dissolve
- [x] Drops (`drops.csv`, shared roll) with pickup; EXP / zeny counted (levels are Phase 3)
- [x] Hero death → respawn at save point
- [x] Stress test: 30 enemies on screen
- [x] Tests (unit: sim, drops; e2e: hit a monster, kill, pickup)

## Exit gate
- [ ] Fights feel like the demo or better (owner play-test)
- [ ] 30 enemies on screen hold 60 fps on a mid-range phone

## Known issues / questions
- Hero rig uses the legacy parts sheet (top of the head part is cropped flat in the source art). Job/armor parts come in Phase 3.
- Skills S1/S2 and the spirit ✦ button do nothing yet (Phase 3 / Phase 4).
- Levels/EXP curve are Phase 3: EXP and zeny are counted and saved, items/cards go to a saved bag (no menu yet).
- Headless CI renders in software (~17 fps baseline), so 60 fps must be checked by the owner on a phone: `?map=test_wide&stress=30`.

## Owner test round 1 (fixed)
- Room edges were swapped since Phase 1: walking left out of town put the hero on the forest's LEFT edge, so he fell straight into the deep forest. Now you enter on the correct side (e2e test added).
- Bosses (King / Harpy / Kraken) now show a big HP bar with their name at the top of the screen.
- Attack animation polish is planned: the clips are JSON (`src/rig/hero.rig.json`) and get tuned with the job parts in Phase 3.

## How to test
- `?map=forest` — porings (hop), mantis (walks, telegraphs a lunge). `?map=deep` — Poring King (jump slam, summons porings below half HP).
- `?map=sky1` birds (swoop), `?map=sky2` Harpy (dive + feather shots), `?map=abyss1&abil=dive` fish, `?map=abyss2&abil=dive` Kraken (ink shots).
- `?map=test_wide&stress=30` — 30 extra monsters for the fps check.
- Attack: X (keyboard) / ฟัน button. Press repeatedly for the 3-hit combo. Jump on porings/birds/king/harpy to stomp.
