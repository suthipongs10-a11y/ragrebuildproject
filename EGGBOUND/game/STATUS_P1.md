# Eggbound P1: status

## M0 — mystery eggs + hatchery incubation (code done, waiting for owner playtest)
Tested: `npm test` (determinism + balance + tests/eggs.ts), `npm run typecheck`, headless UI 1280x760 + 390x780.

- Egg kinds: **named** (crafted from fragments / starter, species known) and **mystery** (stage drop, species hidden until hatch).
  Species + rare form are rolled when the egg is created (no re-roll by reloading).
- Mystery tiers by shell pattern — values in `src/core/data.ts` (`EGG_TIERS`, `EGG_DROP`):

  | tier | drop | monster rarity | incubation | rare form |
  |---|---|---|---|---|
  | ลายธรรมดา | 68% | common 90 · rare 8.5 · epic 1.45 · legendary 0.05 | instant | 3% |
  | ลายเงิน | 24% | common 66 · rare 28 · epic 5.8 · legendary 0.2 | instant | 4% |
  | ลายทอง | 7% | common 25 · rare 50 · epic 23.5 · legendary 1.5 | 2 h | 5% |
  | ลายรุ้ง | 1% | rare 40 · epic 54 · legendary 6 | 8 h | 8% |

  Every shell can roll every rarity (SW-scroll style: cheap shell = tiny odds). Per mystery egg incl. pity:
  see `npm run rates` for the current numbers (epic ≈ 1 in 20, legendary ≈ 1 in 350; epic:legendary ≈ 18:1, SW Mystical is 16:1). Full report: `npm run rates`.

  All wild/mystery eggs hatch at ★1 (★2 start is reserved for Starborn eggs, per GAME_CONFIG_v2).

  Win → 30% egg (boss stage 60%), first clear always. (Blueprint table totals ~12%/clear; kept higher for the 3-stage prototype, close to P0's old wild-egg rate.) **Pity:** the 20th mystery egg in a row without gold+ is gold/rainbow.
  Each tier rolls monster rarity (common…legendary); a rarity with no species yet falls back to the nearest one (all 6 species are common for now).
- Named eggs: 4% rare form. Rare form = flag `MonSave.rare` (badge in collection + prismatic reveal). Trait slot +1 comes with the trait system.
- Duplicates +1★ (max ★5); a duplicate at ★5 → 500 gold.
- Hatchery: slots = level (1–3, as in the P0 home code; GAME_CONFIG_v2 says incubator 3→6 — pick one with the owner), speed ×1 / ×0.8 / ×0.65 (`HATCH_SPEED` in `src/game/home.ts`). End time is fixed when the egg goes in.
  The nest on the turtle shows incubating eggs in their tier colour, pulsing when ready. Live timers on the egg screen + hatchery panel.
- Odds + pity counter disclosed on the egg screen ("อัตราไข่ปริศนา และการันตี").
- Mystery shells are code-drawn for now (`mysteryEggImg` in `src/render/assets.ts`); final art ordered in `art/prompts/EGGBOUND_ART_BATCH05_MYSTERY_EGGS.txt`.
- Save stays v1: old eggs migrate to `kind: 'named'`, missing `eggPity` / `home.incub` are filled in.
- Prototype test tools in Settings: get one egg of each tier, finish incubation now (remove before the public playtest).
- Fix: `[hidden]{display:none!important}` — the loading overlay never hid outside the Artifact host.

## Not in M0
- Starborn eggs (premium gacha) · friends rubbing eggs to speed up · rare-form recolour in battle (comes with the M2 aura system)
- Turtle home final art (batch 04 in progress by the owner)

## Home tweaks
- Monsters walking on the turtle are half size (`MON_SCALE` .27 → .135 in `homeView.ts`), up to 16 shown (was 8).
