# Phase 5 — World content v1 · progress

Status: **in progress** (started 2026-10-10, owner said "go" after Phase 4: "ท่าไม้ตายภูตแรงดีมาก go")

Art (7 briefs, placeholders until the zips arrive) — also `ART_P05_NPC_Portal.md` (portal keeper NPC + gate, 3 images):
- Zones: `ART_P05_Zone_Pack_forest.md`, `ART_P05_Zone_Pack_sky.md`, `ART_P05_Zone_Pack_abyss.md` — 3 more background variations per zone + props
- Monsters: `ART_P05_Monsters_forest.md`, `ART_P05_Monsters_sky.md`, `ART_P05_Monsters_abyss.md` — new monsters (4 poses), mini-bosses (+skill pose), MVP Storm Roc (parts sheet), cards

## Design (decided)
Zones 1–3 = **Forest (Lv 1–14) → Sky Isles (Lv 10–20) → Abyss (Lv 15–26)**, hub = town. Desert stays a 1-map teaser (zone 4 later).

| Zone | Maps | Normal monsters | Mini-bosses | MVP |
|---|---|---|---|---|
| 1 Forest | forest 1–4, deep 1–2 (6) | poring, drops, poporing, rocker, mushroom, wisp, mantis, boar, willow (9) | King Poring, Spore Mother | — |
| 2 Sky | sky 1–6 (6) | bird, sky poring, cloud imp, sky snail, fire hawk, thunder puff, griffin (7) | Harpy Queen, Thunder Ram | **#1 Storm Roc** (sky 6) |
| 3 Abyss | abyss 1–6 (6) | fish, marin, jellyfish, crab, eel, gold fish, urchin, angler (8) | Siren, Sawtooth Shark | **#2 Kraken** (abyss 6) |

= 18 new/old maps + town + desert ≈ 20 maps · 25 normal monster types (with scorpion) · 6 mini-bosses · 2 MVPs.
- Recolours first (RO style: Drops / Poporing / Marin are Poring recolours): a monster row can point at another monster's art + a tint (`art`, `tint` columns). New monsters use a tinted look-alike until their art arrives, then switch automatically.
- Mini-bosses respawn 10–30 min, MVPs 60–120 min (per player); MVP rooms show the respawn timer.
- **MVP phase scripts:** Storm Roc (dive → feather volley → tornado phase under 50 % HP), Kraken gets a 2nd phase (enrage + more ink + tentacle slams under 50 %).
- **Adventure Book** (`content/book.csv`): kill counts per monster, cards collected, spirit dex, maps discovered → milestones give **permanent stats** (claim in the menu).
- **Daily dungeon (offline prototype):** portal NPC in town, element of the day (Mon water … Sun dark), 3 entries/day, waves → essences + runes.
- **Tower 1–20 (offline):** one arena room per floor, monsters scale per floor, first clear rewards (scrolls, runes, zeny).
- **Balance sheet** `docs/BALANCE.md` + `tools/balance.ts` (time-to-kill, EXP per minute, level at each zone, time to MVP #2 ≈ 3–4 h).
- Level design guard: an automatic reachability test (every exit reachable with the abilities a room requires).

## Checklist
- [x] Art briefs written (6 files)
- [x] Monsters: 25 normal types, 6 minis, 2 MVPs in `monsters.csv` (+ art/tint fallback), cards, drops, AI for new types
- [x] Mini-boss scripts (Spore Mother, Thunder Ram, Siren, Shark) + MVP phase scripts (Storm Roc, Kraken phase 2)
- [x] Levels: forest 1–4 + deep 1–2, sky 1–6, abyss 1–6 (background variations), reachability test
- [x] MVP / mini respawn timers shown in the room
- [x] Adventure Book (tracking + milestones + permanent stats + menu tab)
- [x] Daily dungeon (offline prototype) — portal NPC in town (🌀), element by weekday, 3 entries/day, 3 waves scaled to the hero
- [x] Tower floors 1–20 (offline) — `content/tower.csv`, boss every 5th floor, first-clear rewards
- [x] Balance sheet + simulation tool (`npm run balance` → `docs/BALANCE.md`); tuned monster HP ×3 / EXP ×0.22 (bosses HP ×2.5 / EXP ×0.5)
- [x] Tests (unit: bosses, book, dungeon/tower rules, reachability; e2e: book claim, tower floor, daily dungeon)

## Exit gate
- [ ] 3–4 hours of offline content from a new game to MVP #2 (owner plays)
- [ ] Balance sheet reviewed by the owner

## How to test (phone)
- New save: follow the 🎯 quest line (top-left, tap for a hint); summon opens at Lv 5, dungeon Lv 12, tower Lv 15. Press T / AUTO to auto-fight.
- Or `?hero=swordsman:20`: forest → forest 2–4 → deep (King Poring) → deep 2 (Spore Mother); town ↑ sky 1–6 (Harpy, Thunder Ram, **Storm Roc**); town pipe ↓ abyss 1–6 (Siren, Shark, **Kraken**).
- ☰ → สมุดผจญภัย: claim milestones. Town NPC 🌀 ผู้เฝ้าประตูมิติ: daily dungeon + tower.

## Owner request: livelier hero animation (2026-10-10)
- [x] New move sets in code (`src/rig/moves.ts`): fighting stance idle, 3-hit combo per weapon — sword (crouch → lunge cut → rising cut → leap smash), staff (thrust → swing → overhead slam), bow (draw → release recoil → hop-back shot), mace (overhead smash with impact squash) — plus one clip per skill type (front, aoe, bolt, rain, heal, buff, dash, zone), channel while casting, landing squash, knock-back hurt. Rig gained forward shift (`dx`) and squash/stretch (`sq`); clips play to the end.
- [x] `ART_P03_Jobs.md` revised: every job a distinct-looking character (outfit, colours, signature item) + Part 5 expression heads (attack shout / hurt) — 86 images, 5 zips.
- [ ] Wire job parts sheets + expression heads when the P03 Jobs zips are imported.

## Owner request: easier play (2026-10-10, "ทำเลย")
- [x] AUTO button (☰ row, key T, remembered per browser) — `shared/sim/auto.ts` plans, `src/hero/AutoBattle.ts` applies; ultimate stays manual.
- [x] Job-change screen with rating bars, pros/cons, weapon, skills (`src/ui/menu/jobTab.ts`, `jobs.csv` `ratings`).
- [x] Level unlocks (`content/unlocks.csv`) + guide quest chain (`content/quests.csv`, `shared/progression/guide.ts`, `src/hero/Guide.ts`).
- [x] ROADMAP: world chat, rare-drop/MVP broadcast, offline farming, rested EXP → Phase 6; backlog list.

## Art imported (2026-10-10)
- `SJ_P04_Spirits_Part1–4` → pack `P04_Spirits` (79/79 files, no warnings): spirit art is picked up from `spirits.csv`, item/rune icons from `items.csv` and rune names.
- `Summon_Jump_v3_Part3_VFX_Env` (P03 brief Part 3, imported as `SJ_P03_VFX_Env_Part3`) → pack `P03_VFX_Env` (17/17): painted sword slashes, hit spark / critical burst, skill casts (`skills.csv` `vfx`, closest painting via an alias table in `src/vfx/Art.ts`), ultimate hits (jelly splash, tornado, meteor, holy pillar, wave), ultimate aura, level-up pillar, spirit element casts, poring-family death splash, painted pipe and boulder wall. Code-drawn effects stay as the fallback.
- Summon reveal: painted portal + beam (4★) / star (5★) behind the cards.
- Still waiting: P03 Part 1 (gear) + Part 2 (cards, skill icons, big forms of the 5 original spirits), P01 World Props, P03 Jobs, P05 monsters / zones / portal NPC.

## Known issues / notes
- New monsters without art use a recoloured look-alike (`art` + `tint` in monsters.csv), e.g. Crab = red Scorpion, Siren = teal Harpy, Storm Roc = slate Bird. They switch to their own art automatically when `ART_P05_Monsters_*` is imported.
- Background variations B/C/D fall back to the original zone layers until `ART_P05_Zone_Pack_*` arrives.
- `tests/reach.test.ts` checks every land room with the real physics (Lv 1 speed + double jump): every exit reachable from every entrance.
