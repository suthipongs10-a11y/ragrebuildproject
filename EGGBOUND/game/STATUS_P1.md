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
- Mystery shells are code-drawn for now (`mysteryEggImg` in `src/render/assets.ts`); final art ordered in `art/prompts/EGGBOUND_ART_BATCH11_EGGS.txt` (replaces batch 05).
- Save stays v1: old eggs migrate to `kind: 'named'`, missing `eggPity` / `home.incub` are filled in.
- Prototype test tools in Settings: get one egg of each tier, finish incubation now (remove before the public playtest).
- Fix: `[hidden]{display:none!important}` — the loading overlay never hid outside the Artifact host.

## Not in M0
- Starborn eggs (premium gacha) · friends rubbing eggs to speed up · rare-form recolour in battle (comes with the M2 aura system)

## Home tweaks
- Turtle home art (batch 04 A/B/C) in: shell, head (blink/hum frames), flippers, 16 building sprites by level, construction site, 4 relic icons.
  Code overlays on top: eggs in the nest (tier colour), portal swirl clipped to the gate opening, shrine orbs, floating relic on the altar.
  Import with `tools/import_home.py`; code-drawn art remains as fallback. Build is now ~4.4 MB.
- Monsters walking on the turtle are half size (`MON_SCALE` .27 → .135 in `homeView.ts`), up to 16 shown (was 8).

## Stage-end treasure chest
- Win → chest drops in (boss stage = red/gold chest) → tap → shakes while light leaks from the seam, stepping white → blue → purple → gold
  up to the real grade → bursts open (rays, light pillar, coins) → items fly out one by one, best last → "ต่อไป" → result card.
- Grade = best item (`lootOf` in progression.ts, colours `LOOT_GRADES` in data.ts): gold/shards = white · common/silver egg = blue ·
  gold egg = purple · rainbow egg = gold + rainbow. Monster cards (M4) will be legendary.
- Settings → test buttons preview each chest colour (prototype only).

## Hatching altar
- Code-drawn: 3-tier gold-trimmed altar, rotating rune circle, 4 floating crystal obelisks, soft light column + spinning rings,
  energy beams from the crystals into the egg while it cracks. Teal while idle; egg colour while hatching (rainbow eggs cycle).

## Batch 06 art (hatching altar, chests, light FX) — in
- `tools/import_fx.py` imports 18 images; light layers become white+alpha and are tinted at runtime (`tinted`, `fx`, `colored` in assets.ts).
- Hatch scene: ceremony floor + rotating rune circle, 4 tinted crystals on stands, altar sprite + tinted glow mask, light column,
  rays, burst + shockwave rings when the egg breaks, sparkles while it cracks. Code-drawn version remains as fallback.
- Chest: closed → lid rattles closed/ajar with light leaking from the gap while charging → open sprite with light from the cavity,
  rays, burst + rings (rainbow rings for legendary), ring per rare item. Boss stages use the red/gold chest.

## Hatch by monster rarity + battle level plates
- Hatch grandeur follows the monster's rarity (SPECIES rarity): while the egg cracks the light steps up white → blue → purple → gold
  (same colours as the chest) and the build-up is slower the rarer it is; the burst gets bigger with more shockwaves
  (legendary: rainbow rings + white-out + fanfare); epic/legendary add a sky light pillar, twinkles and a rarity banner.
- Settings → test buttons preview each rarity (prototype only).
- Battle: "Lv.N" plate under every monster's feet (green = ours, red = enemy, gold = boss) with an element dot.

## Ultimate cinematic
- Ultimates: screen darkens, camera rushes in (2x zoom, centred on the caster), it crouches gathering power, snaps into
  its burst pose with flash + shockwave + shake, element-coloured rotating rays + orb behind it, anime speed lines, skill-name
  cut-in; then the camera pulls back and the skill plays. HP bars/level plates hidden during the cinematic.
- Uses fx_rays / fx_orb / fx_burst (batch 06) and fx_speedlines (batch 09, code-drawn lines until it arrives).
- Next when batch 09 lands: per-element ultimate effects (flame wave/bird, tidal wave/serpent, tornado/blades, rock spikes/
  ground shatter, divine star, shadow vortex, slash).
