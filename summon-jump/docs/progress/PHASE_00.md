# Phase 0 — Foundation · progress

Status: **done, waiting for owner check on a real phone** (exit gate below)

## Checklist
- [x] Vite 7 + TypeScript 5.9 strict + **Phaser 4.2.1** (latest stable at setup, 2026-10-09)
- [x] `shared/` package (alias `@shared`): seeded RNG, elements, stats, damage (RO crit), refine (+15, downgrade/break) — 9 unit tests
- [x] `npm run content`: CSV → `public/content/content.json` with validation (ids, refs, ranges, JSON columns)
- [x] `npm run art:import`: zip → name check vs brief → alpha-halo clean → trim (monster poses share one crop box) → resize → WebP → `src/assets/art-manifest.json` + `manifest.generated.ts` → `art-inbox/REPORT.md` (warns on non-transparent / non-black backgrounds)
- [x] Legacy prototype art registered as pack `P00_legacy` (68 keys: 6 zones × 5 layers, hero design + 8 parts, monsters, spirits, icons)
- [x] Per-zone lazy loading (`queueZone`), i18n loader (`th.json`)
- [x] Landscape touch controls (joystick + 6 buttons) + keyboard map; portrait shows "rotate" hint
- [x] World scene: 3 parallax layers + ground strip + one-way painted platforms + placeholder hero; keys 1–6 switch zones
- [x] Vitest + Playwright smoke (desktop + phone landscape)
- [x] GitHub Actions: test → build → e2e → deploy to `gh-pages` branch under `/summon-jump/`

## Exit gate
- [x] Painted zone with parallax, touch controls respond (smoke test, phone landscape)
- [x] `npm run content` / `npm run art:import` work on sample data
- [ ] CI green on GitHub (first run after push)
- [ ] **Owner:** open the Pages link on a phone, walk/jump, say "go" for Phase 1

## Decisions
- Physics uses real frame delta (`fixedStep: false`, `fps.smoothStep: false`) so speed is correct on slow devices. Phase 1 must add a max-delta clamp / substeps to stop tunnelling through thin platforms.
- Lint = `tsc --noEmit` for now (no ESLint yet) — add ESLint in Phase 1 if wanted.
- Texture atlas packing deferred to Phase 2 (when monster pose sets arrive); WebP per image for now.

## Known issues
- Placeholder hero is the single design image (rig port is Phase 2).
- Thai web fonts load from Google Fonts; offline/Capacitor builds need bundled fonts (Phase 11).

## UI Kit art import (2026-10-09)
- Imported `SJ_P00_UI_Kit_Part1` (from ChatGPT, sent as `..._INCOMPLETE`) → pack `P00_UI_Kit`: **22 of 40** images OK (#1–#22).
- Missing 18: #23 `ui_slot_card`, #24 `ui_portrait_frame`, #25–28 rarity overlays, #29–34 element badges, #35–36 stars, #37–38 gem/scroll, #39–40 number sheets.
- Redo brief: `art-briefs/ART_P00_UI_Kit_REDO.md` (Part2 = #25–40, Part3 = #23–24).
