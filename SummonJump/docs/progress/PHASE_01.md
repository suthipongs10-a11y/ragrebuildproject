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
- [x] Art brief P01 written (`art-briefs/ART_P01_World_Props.md`, 29 images)
- [x] LDtk loader + collision IntGrid / one-way / exits / pipes / gates / signs / NPC spawns
- [x] Hero movement feel (accel, coyote, jump buffer, variable jump, double jump, swim/dive, drop-through one-way)
- [x] Room transitions L/R/up/down/pipe with fade; scrolling camera for wide rooms
- [x] Ability gates (double jump, dive, break rock)
- [x] Respawn system (normal on re-entry, timers for mini-boss / MVP)
- [x] Port the 8 prototype maps into LDtk
- [x] Local save (room, broken rocks, defeated timers)
- [x] Tests: motion, loader, level validation, walk-through (snag) test, respawn; e2e smoke
- [ ] CI green; owner phone test

## Exit gate
- [ ] Walk all 8 maps on phone at 60 fps
- [ ] Every gate works
- [ ] No collision snags in a 10-min run (owner) — automated walk test passes (Claude)
- [ ] Owner says "go" for Phase 2

## Known issues / questions
- LDtk file is generated (`npm run levels`) in LDtk 1.5 layout; **not yet opened in the real LDtk editor** (not available in the cloud). If LDtk complains, tell Claude; the game does not depend on the editor.
- Props / NPCs / blocks are placeholders (legacy icons, coloured shapes) until `ART_P01_World_Props` zips arrive.
- Hero is still the single design image; hitbox 24×56 px. Rig + real attack = Phase 2. Attack key only smashes rocks.
- Monsters in rooms are static pictures (no AI/combat until Phase 2). `Shift+K` kills them all to test respawn rules.
- Quick taps shorter than one frame give the minimum hop (variable jump); real taps are fine.

## How to test (owner, phone)
Play link: https://suthipongs10-a11y.github.io/ragrebuildproject/summon-jump/
- Start in town. Walk ← forest → deep forest; → desert (rock wall blocks it); ▲ on sky ledge (needs double jump); pipe in town (▼ on top) → abyss (needs dive or you drown).
- Enable gates for testing with the URL: `?abil=double,dive,break` (e.g. `…/summon-jump/?abil=double,dive,break`). Jump to a room: `?map=forest|deep|town|sky1|sky2|abyss1|abyss2|desert|test_wide`.
- Desktop keys: 7/8/9 toggle double/dive/break; Shift+K = defeat all monsters in the room (respawn test).
- On phone: ▲ = push joystick up near a sign/NPC/chest/pipe; ▼ = push down on a pipe top; down + jump button on a wooden platform = drop through.

## Tests
- 33 unit tests (motion feel, one-way, tunnelling at 20 fps, LDtk loader, level validation, walk-through every room, ability gates, respawn) + 5 e2e (boot, room change, scrolling camera, rock smash, respawn timer).
