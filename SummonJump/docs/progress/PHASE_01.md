# Phase 1 — Platforming & world · progress

Status: **in progress** (started 2026-10-09)

Art brief: `art-briefs/ART_P01_World_Props.md` (29 images, 2 zips) — owner sends to ChatGPT; code uses placeholders until it arrives.

## Design decisions
- Own tile-grid AABB collision (`shared/platformer/`, pure TS, unit-tested) instead of Arcade physics: deterministic, one-way platforms, sub-stepped (max-delta clamp → no tunnelling), reusable by the server later.
- World scale: prototype 16 px tile ×2 → **32 px tiles**, room 30×17 tiles = 960×544. Rooms may be any size (camera scrolls).
- Levels are real **LDtk JSON** (`levels/world.ldtk`, copied to `public/levels/`). Generated from the prototype's maps by `tools/levels/build-levels.ts` (`npm run levels`) so they can later be opened and edited in the LDtk editor. Runtime loader reads only the subset we use (IntGrid `Collision`, entities, level fields).
- IntGrid values: 1 solid, 2 one-way, 3 breakable rock, 4 pipe top (solid, enterable).
- Abilities (`double`, `dive`, `break`) come from a team-abilities set; Phase 4 spirits will fill it. For now a debug set (URL `?abil=double,dive,break`).

## Checklist
- [ ] Art brief P01 written
- [ ] LDtk loader + collision IntGrid / one-way / exits / pipes / gates / signs / NPC spawns
- [ ] Hero movement feel (accel, coyote, jump buffer, variable jump, double jump, swim/dive, drop-through one-way)
- [ ] Room transitions L/R/up/down/pipe with fade; scrolling camera for wide rooms
- [ ] Ability gates (double jump, dive, break rock)
- [ ] Respawn system (normal on re-entry, timers for mini-boss / MVP)
- [ ] Port the 8 prototype maps into LDtk
- [ ] Local save (room, broken rocks, defeated timers)
- [ ] Tests: motion, loader, level validation, walk-through (snag) test, respawn; e2e smoke
- [ ] CI green; owner phone test

## Exit gate
- [ ] Walk all 8 maps on phone at 60 fps
- [ ] Every gate works
- [ ] No collision snags in a 10-min run (owner) — automated walk test passes (Claude)
- [ ] Owner says "go" for Phase 2

## Known issues / questions
(none yet)
