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

## Owner request: spirit expedition — farm while offline (2026-10-10)
- [x] ☰ → **สำรวจ** (unlocks at Lv 5): send up to 3 spirits that are not in the team to a visited map; they beat its normal monsters while time passes, game open or closed, up to 12 h (`spirit_config.csv` `explore_*`). Loot = that map's normal drop tables (same rates, cards included) + soul stones + a share of the EXP for the sent spirits. Efficiency from spirit level/star vs the map's monster level and how many went.
- [x] Claim (keep exploring) or recall; welcome-back toast on load; a spirit that is away can't join the team or be used as star-up fodder.
- [x] Pure + seeded (`shared/rules/explore.ts`): Phase 6 moves the clock and the roll to the server (the phone clock can be changed today).

## Owner request: easier to play (2026-10-10, ideas 1 2 8 10; idea 5 removed)
- [x] **AUTO hunt** (`src/hero/AutoPilot.ts`): AUTO now walks to the nearest monster, hops walls / up to platforms (double jump when the team has it), drops through thin platforms, fights with skills, then collects map crystals; gives up on unreachable targets for 8 s; any direction / jump input takes over.
- [x] **Tap / click a monster** → lock on (▼ marker), walk / hop there and keep attacking until it dies, also with AUTO off (bigger tap area; tap empty ground to let go; gives up only after 4 s of being stuck). Tested melee, bow, staff, mace, flying monsters.
- ~~One-tap growth / better-gear prompt~~ — removed again (owner: building your own character is part of the fun; drops stay as they are).
- [x] **🧭 พาไป** next to the quest line: warps to the quest's room (monster's room, room to visit, town for summon / job / tower, a room at the hero's level for level quests).
- [x] **Gentler start:** forest-zone monsters hit 30 % softer; out of combat (4 s without damage) +6 % HP / +4 % SP every 2 s; dying = get up at the room's safe spot with full HP (arena runs still end in town).

## Owner play-test fixes (2026-10-10)
- [x] Job change while the bag is full kept the old sword: the starter weapon now always arrives (bag limit ignored for it); saves that lost it get it back on load. The rig also gets the new weapon picture while the menu has the game paused.
- [x] Job change asks "แน่ใจแล้วนะ?" (confirm / cancel) before it happens.
- [x] Potions: the menu shows live HP / SP bars (+ soul stones); a potion is not used when that bar is already full.
- [x] PC: left mouse click attacks (hold = keep attacking); menu hotkeys I bag · E equipment · U status · Y skills · P spirits (press again to close), letters shown on the tabs; double-click a bag / equipment row to use or equip; bigger menu window on big screens.
- [x] Town: the sky-exit hint no longer covers the quest line / HP bars.

## Owner request: own names + soul stones (2026-10-10)
- [x] Currency **หินวิญญาณ 💠** replaces Zeny everywhere (`soul` in code, saves and CSVs: `soul_min/soul_max`, tower/rune-upgrade `soul`, quest reward key `soul`). Old saves carry their coins over.
- [x] Sources: monster kills, selling items/runes, guide quests, daily dungeon, tower first clears, **map crystals** (now pay 20–120 by zone), **Adventure Book milestones** (`book.csv` `soul`: kill 100, map 150, card 200, dex 250). Sinks: shop, refine, rune upgrades.
- [x] Renamed RO/SW-coined names (display text only; internal ids unchanged): jelly family → บุ๋ม (ชมพู/ส้ม/พิษ/ทะเล/เมฆ, ราชาบุ๋ม, ภูตบุ๋มน้อย, ป่าบุ๋ม), Rocker → ตั๊กแตนใบมีด, Willow → ตอไม้ขี้โมโห, Spore → เห็ดฝุ่นพิษ, Angeling → เทวดาน้อย; skills ระเบิดพสุธา / ม่านลมศักดิ์สิทธิ์ / บทสวดคุ้มกาย / แสงเปิดเผย; ม้วนดวงดาว, ม้วนสุริยจันทรา, เกล็ดธาตุ / เกล็ดเวท; rune sets พฤกษา หินผา เขี้ยว ตาเหยี่ยว อสนี วายุ พิโรธ ปลิงเลือด; MVP → 👑 บอสตำนาน.
- [x] Pending P05 art briefs: original-designs rule, Leafblade Hopper instead of a violin grasshopper, Grumpy Stump, Dust-cap Queen, jelly cards described as our own "Bumm" family (leaf sprout).

## Owner request: RO-style attack stats + solid sky ground (2026-10-10)
- [x] ATK follows the weapon like RO pre-renewal: melee + staff → STR ×2 + (STR/10)² + DEX/5 + LUK/5; bow → DEX ×2 + (DEX/10)² + STR/5 + LUK/5. MATK = INT only (+ weapon MATK) and a staff adds +15 % (RO rods/staves). Status tab shows which stat drives ATK / MATK.
- [x] Staff normal attack = a short-range magic shot (230 px, painted soul-strike orb), still a physical STR hit as a rod's normal attack in RO — mages/acolytes without STR hit weakly, spells scale with INT.
- [x] RO weapon access (no daggers yet, the two basic swords stand in): swordsman sword/mace, mage staff/sword, archer bow/sword, acolyte mace/staff/sword. Arrow skills need a bow ("ต้องถือธนู").
- [x] Sky Isles: every sky room stands on one continuous cloud ground (no gaps → no fall/respawn flicker); sky1 goes back to town through a cloud pipe (level validation accepts edge ↔ pipe pairs).
- Balance: swordsman route unchanged (1.9 → 1.8 h sim to the Kraken).

## Owner request: tougher bosses — AUTO is for farming (2026-10-10)
- [x] Mini-bosses / MVPs HP ×4 and ATK ×1.5 (e.g. ราชาบุ๋ม 1300 → 5200, Storm Roc 10500 → 42000, Kraken 15000 → 60000).
- [x] Every boss calls its own minions (`monsters.csv` `ai_params`: `minion`, `minion_max`, `minion_cd`): 2 per call, 3 per call and faster in phase 2, only while the hero is near; "{name} เรียกลูกน้อง!" pops up. Hard-coded summons removed from the scripts. Called minions give no EXP / drops / soul (RO slaves) so a boss can't be farmed.
- [x] Harsher skills: shorter cooldowns for every boss, ground shockwaves on slams/crashes (King phase 2, Thunder Ram, Storm Roc phase 2 dives), harpy shoots in phase 1 too, rage speed ×1.2 in phase 2 and ×1.4 under 25 % HP.
- [x] Bosses resist stun / freeze from skills (20 % of the duration).
- Check (Lv 20 test hero, all cards + spirits, AUTO only, no potions): Storm Roc lost 28 % HP in 60 s while the hero lost 65 % → AUTO alone can't solo a boss; potions and dodging are needed. Balance sim: route time unchanged (2.0 h), Kraken fight 4.2 min at full damage.

## Owner request: lock-on, loot magnet, crit burst (2026-10-10)
- [x] Click / tap a monster = lock-on: the hero keeps attacking with normal attacks (normal damage) until it dies, RO style.
- [x] Loot magnet: drops pop out for 0.45 s, then fly into the hero by themselves (no walking over them). With a full bag they stop and wait on the ground.
- [x] Critical number like the owner's reference picture: big yellow digits with a black outline on a spiky orange-red burst (darker rim, lighter core, uneven spikes); slams in, hangs, floats up.

## Art imported (2026-10-10)
- `SJ_P04_Spirits_Part1–4` → pack `P04_Spirits` (79/79 files, no warnings): spirit art is picked up from `spirits.csv`, item/rune icons from `items.csv` and rune names.
- `Summon_Jump_v3_Part3_VFX_Env` (P03 brief Part 3, imported as `SJ_P03_VFX_Env_Part3`) → pack `P03_VFX_Env` (17/17): painted sword slashes, hit spark / critical burst, skill casts (`skills.csv` `vfx`, closest painting via an alias table in `src/vfx/Art.ts`), ultimate hits (jelly splash, tornado, meteor, holy pillar, wave), ultimate aura, level-up pillar, spirit element casts, poring-family death splash, painted pipe and boulder wall. Code-drawn effects stay as the fallback.
- Summon reveal: painted portal + beam (4★) / star (5★) behind the cards.
- Received and checked (all names, sizes and backgrounds match the briefs), sources kept in `art-store/`, then wired (owner: "ใช้เฉพาะภาพที่ได้ ลุยทำเกมต่อ"):
  - P03 Gear + Cards/Skills (42) and P03 Jobs parts 2–4: item, card and skill icons (menus + HUD skill buttons), big ultimate forms of the 5 original spirits, painted projectiles/zones (arrow, fire/cold/lightning bolt, soul strike, fire wall, ankle trap, pneuma, tornado) and cast effects.
  - P01 World Props (29) + P05 Portal NPC (3): painted NPCs with a talk pose, signs, altar, anvil, save statue (lights up when used), chests (open), rune plates, portal gate, rock rubble.
  - P03 Jobs part 1 + 5: `npm run art:jobs` cuts each job's parts sheet into rig pieces (`tools/art-import/job-parts.json`: piece rects + joint pivots from the dots), masks out neighbouring pieces, and lines up the expression heads. The rig wears the job's parts, the equipped weapon's own painting, a battle-shout face while attacking/casting and a pained face when hit. Job-change cards show each job's design picture.
- Not used yet: `prop_pipe_top/body`, `prop_rock_wall`, `prop_gate_*`, `prop_fountain`, `prop_ladder`, `prop_water_surface`, `prop_door_wood`, `arm_0X_torso/uarm` armour overlays, spirit `ult_*` icons.
- Still waiting: P05 monsters (forest / sky / abyss) and zone packs.

## Known issues / notes
- New monsters without art use a recoloured look-alike (`art` + `tint` in monsters.csv), e.g. Crab = red Scorpion, Siren = teal Harpy, Storm Roc = slate Bird. They switch to their own art automatically when `ART_P05_Monsters_*` is imported.
- Background variations B/C/D fall back to the original zone layers until `ART_P05_Zone_Pack_*` arrives.
- `tests/reach.test.ts` checks every land room with the real physics (Lv 1 speed + double jump): every exit reachable from every entrance.
