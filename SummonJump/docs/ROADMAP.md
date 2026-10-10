# Roadmap — phases, art packs and exit gates

Rule: finish a phase → pass its **Exit Gate** → owner says "go" → next phase.
Each phase lists the **art brief** Claude must write at the start of the phase (`art-briefs/ART_PXX_*.md`). Code proceeds with placeholders while the owner generates the art.

Art already available (from the prototype): 6 zones × 5 layers, hero design + parts sheet, 8 monsters, 5 small spirits, 16 icons (pack `P00_legacy`). Pack v3 (gear, cards, skill icons, big spirits, VFX, pipe, boulder) is in production → becomes `P03_gear_vfx`.

---

## Phase 0 — Foundation
**Scope**
- Vite + TS strict + Phaser (latest stable) + ESLint/Prettier + Vitest + Playwright.
- `shared/` package wired into client (path alias) and tests.
- `tools/content-build.ts`: CSV → JSON with validation; seed CSVs from `content/` (8 monsters, items, cards, spirits, skills).
- `tools/art-import`: zip → validate against brief manifest → alpha clean (remove <10% halos) → trim → resize → WebP → atlas → `manifest.generated.ts`. Import `P00_legacy` art.
- Asset loader with per-zone packs; i18n loader (Thai font: Itim/Sarabun + a pixel/number font for damage).
- Landscape touch controls (joystick + 6 buttons) + keyboard mapping.
**Art brief:** `ART_P00_UI_Kit.md` (included now) — HUD frames, buttons, panels, bars, tabs, badges, cursor, number font sheet.
**Exit gate:** blank World scene shows a painted zone with parallax, touch controls respond, `npm run content` and `npm run art:import` work on the sample zips, CI green.

## Phase 1 — Platforming & world
**Scope**
- LDtk integration: collision IntGrid, one-way platforms, exits, pipes, gates, signs, NPC spawn points.
- Hero movement feel from demo (accel, coyote time, jump buffer, variable jump, double jump flag, swim).
- Room transitions (L/R/up/down/pipe), fade, camera with scrolling rooms (maps wider than one screen).
- Ability gates (double jump, dive, break rock) read from team abilities.
- Respawn system (normal on re-entry; timers for mini-boss/MVP).
- Port the 8 prototype maps into LDtk.
**Art brief:** `ART_P01_World_Props.md` — painted pipes, boulders, gates, doors, signs, NPC sprites (4 town NPCs, idle + talk poses), save statue, chest open/closed, ladders, breakable walls, water surface strip.
**Exit gate:** walk all 8 maps on phone at 60 fps; every gate works; no collision snags in a 10-min run.

## Phase 2 — Combat core
**Scope**
- Cut-out rig runtime + clip editor-in-JSON; hero clips: idle, run, jump, fall, attack1/2/3 combo, hurt, death, cast.
- Hitbox/hurtbox system, hit-stop, knockback, i-frames, stomp.
- RO damage numbers, crit starburst, element colors; VFX system (additive sprites, particles, rings, slash trails) using P03 VFX.
- Enemy FSM framework driven by `monsters.csv` (`ai`: hopper, walker, charger, flyer, swimmer, turret, boss script).
- Monster pose sets (idle/windup/attack/hurt) + tweens; death dissolve; drops with pickup.
**Art brief:** `ART_P02_Monster_Actions.md` — for the 8 existing monsters: windup, attack, hurt poses (same character, same scale), plus 3 new forest monsters with full pose sets.
**Exit gate:** fights feel like the demo or better (owner play-test); 30 enemies on screen hold 60 fps on a mid-range phone.

## Phase 3 — Hero progression (RO)
**Scope**
- Base/Job level, stat points, derived stats (`shared/formulas`), job change NPC: Novice → Swordsman / Mage / Archer / Acolyte.
- Skill trees (8 skills per first job), 3 skill slots, SP, cooldowns, casting.
- Equipment (8 slots), inventory, item tiers, card slots + type restriction, refine +15 with downgrade/break, card sets.
- Armor sets change rig parts (torso/upper arm/cape/hat).
- Menus: Status, Skills, Equipment, Inventory, Cards.
**Art brief:** `ART_P03_Jobs.md` — parts sheets for 4 first jobs (male base; same pivots as hero sheet), job weapons (swords, staves, bows, maces), 32 skill icons, 32 skill VFX on black, hats/capes/boots/shields icons.
**Exit gate:** each job playable to Lv 30 in the test zone; menus usable one-handed; save/load keeps everything.

## Phase 4 — Spirits (SW)
**Scope**
- Spirit collection, element, 1★–6★, level, star-up with fodder, awaken (new form + skill), runes (6 slots, sets, main/sub stats, rune upgrade +15).
- Team of 3: leader skill, follow AI, auto skill, ultimate cinematic, combo, exploration abilities.
- Summon altar: scroll types, rates table in `shared/rules`, pity; summon animation.
**Art brief:** `ART_P04_Spirits.md` — 15 spirit families × (small, big ultimate form, awakened small, awakened big) + element variants by recolor guide, rune icons (sets × 6 slot shapes), summon scrolls, summon portal VFX.
**Exit gate:** collect/upgrade/awaken loop works offline; ultimate cinematics for every family; summon rates verified by a 100k-roll test.

## Phase 5 — World content v1
**Scope**
- Zones 1–3 complete (≈20 maps), 25 monsters, 6 mini-bosses, 2 MVPs with phase scripts, MVP timers.
- Adventure Book (kill counts, card collection, spirit dex, map discovery) with permanent stat rewards.
- Daily dungeon prototype (offline), tower floors 1–20 (offline).
**Art brief:** `ART_P05_Zone_Pack_<zone>.md` per new zone (5 layers × 4–6 maps variations, props) + `ART_P05_Monsters_<zone>.md` (monster pose sets, cards, boss parts sheets).
**Exit gate:** 3–4 hours of offline content from new game to MVP #2; balance sheet reviewed.

## Phase 6 — Online foundation (Nakama)
**Scope**
- Docker Compose (nakama + postgres) on VPS; client `src/net`.
- Auth (device → Google/Apple link), cloud save, server-authoritative economy RPCs (summon, refine, socket, shop, claim), battle reports for drops/exp.
- Mail/inbox, content bundle served by server (hot balance updates).
- Migration of local saves to the cloud on first login.
- **World chat** (Nakama channel) + system broadcasts for rare drops / MVP kills; profanity filter, rate limit, block & report. *(added 2026-10-10, owner request — moved up from Phase 9)*
- **Offline farming:** spirits explore while the game is closed; rewards by time away (cap 12 h) × best cleared map, timestamps checked on the server. *(added 2026-10-10)*
- **Rested EXP:** time away builds a ×2 EXP bonus for the next N kills. *(added 2026-10-10)*
**Art brief:** `ART_P06_Account_UI.md` — login screen key art, avatar frames, profile card, mail icons.
**Exit gate:** tampered client cannot add items/currency (tested); 2 devices share one account; server restart loses nothing; 2 phones see each other's world chat; offline rewards cannot be faked by changing the phone clock.

## Phase 7 — Live-ops basics
**Scope**
- Daily login calendar (28 days), daily/weekly missions, achievements, secret shop (hourly), energy for dungeons/tower, daily reset 05:00 ICT, push notification hooks.
**Art brief:** `ART_P07_Liveops_UI.md` — calendar tiles, reward chests (3 tiers), mission badges, shop stall frame, energy/scroll/gem currency icons.
**Exit gate:** a full week simulated by clock-skew tests gives correct rewards exactly once.

## Phase 8 — Arena
**Scope**
- Defense snapshot (hero build + team + runes), arena stage scene, defense AI (uses the bot brain from Phase 2 + skill priority list), attack flow with wings, rating/leagues, seasons, revenge log, arena shop.
- Validation: deterministic `shared/sim` + input log re-sim on the server (fallback: plausibility bounds).
**Art brief:** `ART_P08_Arena.md` — arena stage (5 layers), league badges ×6, victory/defeat banners, VS screen frames.
**Exit gate:** 20 test accounts run 500 arena fights; no desync between client result and server re-sim > 1%.

## Phase 9 — Social
**Scope**
- Friends (hearts, borrow spirit), guilds (join/create, roles, check-in, shop), guild war (async), world boss (weekly, 3 tries/day, leaderboard), chat (guild channel; world chat ships in Phase 6).
**Art brief:** `ART_P09_Social.md` — guild emblems kit, world boss (full parts sheet + 5 layers arena), guild hall background.
**Exit gate:** 2 guilds × 10 test accounts complete a guild war and a world boss week.

## Phase 10 — Dungeons & tower online
**Scope**
- Rune dungeons and awaken dungeons with daily element rotation, tower 100 floors with monthly reset and rewards, friend helper.
**Art brief:** `ART_P10_Dungeons.md` — 3 dungeon tilesets (5 layers each), tower floor variants, dungeon bosses.
**Exit gate:** server-validated clears; rune economy simulation within balance targets.

## Phase 11 — Mobile release prep
**Scope**
- Capacitor Android build, icons/splash, performance pass, offline handling, crash reporting, analytics events, IAP (Battle Pass, packs) via store billing, privacy policy, age rating.
**Art brief:** `ART_P11_Store.md` — app icon, splash, 8 store screenshots frames, feature graphic, Battle Pass art.
**Exit gate:** closed test on Play Console with 20+ testers, crash-free ≥ 99%.

## Phase 12 — Soft launch & iterate
- Soft launch in Thailand, watch D1/D7 retention and arena participation (targets in GDD §9), weekly content patches through the content bundle.

## Backlog (after launch, not scheduled)
Ideas from looking at other RO-style games (owner, 2026-10-10): player market / trading, gathering & crafting, 3-branch skill trees with evolutions, day/night card modifiers.
