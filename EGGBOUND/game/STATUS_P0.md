# Eggbound P0: status

Build: `npm run build` → dist/index.html (single file, assets embedded) · `npm test` = determinism + balance sims · `npm run typecheck`

## DONE (tested in headless desktop 1280x760 + mobile 390x780)
- Battle-core in pure TS, deterministic (seed + separate AI RNG), replayable for server-side verification
- ATB, 3 skills + leader, element advantage, marks/reactions (5 kinds), statuses, shields, boss immunity
- Stage map 1-1 → 1-3 (boss), 3 waves, ★1–3 per stage, unlocks the next stage
- Team setup (4 monsters, slot 1 = leader), monster collection, hatchery, crafting eggs from fragments
- Battle renderer: Canvas2D (P0 choice instead of PixiJS), VFX for every skill, ultimate cut-in, perfect-timing ring +15%, AUTO, x1/x2/x3, skip ultimate
- Portrait layout (allies bottom / enemies top) and landscape layout (diagonal)
- Hatching: crack → burst → reveal; duplicates give +1★
- Save in localStorage (try/catch), settings: sound, quality, skip ultimate

- Final art for all 6 starters (A01 fox + A02–A06 from ChatGPT batch 03), imported with tools/import_art.py
- Auto-derived VFX anchors + portrait crops for new art (fox keeps hand-tuned anchors)

## PLACEHOLDER
- Boss BOSS_ROOT uses the golem art at 1.55x → needs its own art
- Species without art fall back to a hue-shifted fox automatically
- Synthesized sound effects, no BGM

## NOT DONE / NEXT
- Monster equipment + gacha, Starborn eggs, skill-up, rune/card system
- Server / anti-cheat replay, PvP arena
