# Phase 2 — Combat core · progress

Status: **in progress** (started 2026-10-09)

Art: `ART_P02_Monster_Actions` already imported (42/42, pack `P02_Monster_Actions`). No new brief needed for this phase.
VFX use code-drawn additive shapes until the P03 VFX pack (`ART_P03_Gear_Cards_VFX.md`) arrives.

## Checklist
- [ ] Cut-out hero rig (`src/rig/`) from the legacy parts sheet; pose clips as JSON: idle, run, jump, fall, attack1/2/3, hurt, death, cast
- [ ] Combat sim in `shared/sim/` (pure, seeded RNG): attack combo + hitboxes, hurtboxes, knockback, i-frames, stomp, hero HP/death
- [ ] Hit-stop, screen shake, enemy flash
- [ ] RO damage numbers (normal / crit red+yellow+starburst+"CRITICAL" / weak orange / resist grey / taken pink / heal green)
- [ ] VFX: slash arcs, sparks, rings, particles (additive)
- [ ] Enemy FSM from `monsters.csv` `ai`: hopper, walker, charger, flyer, swimmer, turret, boss scripts (king_slam, harpy_dive, kraken_ink)
- [ ] Monster pose swap (idle / windup / attack / hurt) + squash/lunge/bob tweens; death dissolve
- [ ] Drops (`drops.csv`, shared roll) with pickup; EXP / zeny counted (levels are Phase 3)
- [ ] Hero death → respawn at save point
- [ ] Stress test: 30 enemies on screen
- [ ] Tests (unit: sim, drops; e2e: hit a monster, kill, pickup)

## Exit gate
- [ ] Fights feel like the demo or better (owner play-test)
- [ ] 30 enemies on screen hold 60 fps on a mid-range phone

## Known issues / questions
(none yet)
