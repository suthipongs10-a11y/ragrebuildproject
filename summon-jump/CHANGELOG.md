# Changelog

## Phase 5 (in progress) — 2026-10-10
- Phase checklist + 6 art briefs (3 zone packs, 3 monster packs).
- 33 monster types (25 normal, 6 mini-bosses, 2 MVPs) with cards and drops; recoloured look-alikes until their art arrives.
- Boss scripts: Spore Mother, Thunder Ram, Siren, Sawtooth Shark, Storm Roc (MVP, tornado phase), Kraken phase 2; every boss enrages under 50 %.
- 18 maps in zones 1–3 (forest/deep, sky, abyss) with background variations; reachability test with real physics.
- Mini-boss / MVP respawn timer shown in the room, boss returns when it hits zero.
- Hero animation: per-weapon combos with anticipation crouch, lunge and follow-through; skill clips per type; squash/stretch; job art brief revised (distinct job looks + expression heads).
- Balance: `npm run balance` writes `docs/BALANCE.md`; monsters HP ×3 / EXP ×0.22 (bosses ×2.5 / ×0.5) → ~3–4 h of real play to the Kraken.
- Portal NPC (ประตูมิติ) in town: daily elemental dungeon (3 runs/day) and tower floors 1–20 in a new arena room.
- Adventure Book (สมุดผจญภัย): 46 milestones (kills per monster, cards, spirit dex, maps per zone) → permanent stats.
- AUTO button (next to ☰, key T): faces the nearest monster, attacks in reach, casts slotted skills (heal < 60 % HP, buffs, attacks); the player still walks.
- New job-change screen: one card per job with rating bars (damage / tank / range / support / ease), strengths ✓ / weaknesses ✗, weapon and skills (`jobs.csv` `ratings`).
- Level unlocks (`unlocks.csv`): summon Lv 5, adventure book Lv 3, runes Lv 10, daily dungeon Lv 12, tower Lv 15 — locked tabs show 🔒 and the level.
- Guide quest chain (`quests.csv`, 12 steps from "kill 5 Poring" to the Kraken) on the HUD, tap for a hint, auto-claimed rewards.
- Roadmap: world chat + rare-drop/MVP broadcast, offline farming and rested EXP added to Phase 6; backlog section.
- Art: P04 spirits (79 images: 15 families incl. awakened forms, scrolls, essences, runes, summon VFX) and P03 VFX/environment (17: slashes, sparks, crit burst, skill/ultimate effects, level-up, pipe, boulder) imported and wired; summon reveal uses the painted portal/beam/star.
- Art: job characters on the rig (painted parts per job, weapon pictures, battle-shout / hurt faces), painted NPCs and world props, item / card / skill icons, painted arrows, bolts and skill zones; `art:import` no longer skips the first zip.
- RO-style stats: ATK from STR (melee, staff shots) or DEX (bows), MATK from INT with a +15 % staff bonus; staves shoot magic bolts; RO weapon access per job; arrow skills need a bow.
- Sky Isles: continuous cloud ground in every room, cloud pipe from sky1 back to town.
- Own names: currency หินวิญญาณ 💠 (old saves converted; map crystals and Adventure Book milestones now pay it), RO/SW-coined monster, spirit, skill, scroll, essence and rune-set names replaced; pending art briefs ask for original designs.
- Play-test fixes: job change always hands over the new weapon (full bag, paused menu) and asks for confirmation; live HP/SP in the menu, potions not wasted at full; PC left-click attack, menu hotkeys (I/E/U/Y/P), double-click to use/equip, larger menu on big screens.
- Easier play: AUTO hunt (walks, jumps, fights, collects), tap/click a monster to attack it, 🧭 quest travel, softer forest monsters, out-of-combat regen, revive in the same room. (One-tap stats/skills/gear was tried and removed again.)
- Spirit expedition (☰ → สำรวจ): up to 3 spare spirits farm a visited map while the game is closed (max 12 h), normal drop tables + soul stones + spirit EXP.
- Click / tap a monster: lock on and keep attacking until it dies (RO style), any job, flying monsters included.
- Drops fly into the hero by themselves (stop when the bag is full); critical hits show a big yellow number on a spiky red burst.
- Tougher bosses: HP ×4, ATK ×1.5, every boss calls minions (no EXP/drops from them), shorter cooldowns, shockwaves, rage speed-up when hurt, stun/freeze resistance.

## Phase 4 (done) — 2026-10-09
- 15 spirit families × element variants (`spirits.csv`, `spirit_skills.csv`, `spirit_elements.csv`, `spirit_config.csv`).
- `shared/spirits`: stats by star/level/awakening/element, EXP, star-up with fodder, awakening with essences, runes (6 slots, 8 sets, +15 upgrade), team + leader skill + exploration abilities.
- `shared/rules/summon.ts`: 4 scroll types with rates + pity (100k-roll test).
- World: team follows the hero and auto-casts, gauge → ✦ ultimate cinematic (+COMBO), spirits share kill EXP, monsters drop runes / essences / scrolls.
- Menus: ภูต (team, detail, runes, star-up, awaken) and อัญเชิญ (altar) with a reveal animation.
- Abilities now come from the spirit team (debug `?abil=` still works); cloud glide and hidden treasure (reveal).
- Art brief `ART_P04_Spirits.md` (79 images).
- Menu: tabs wrap on portrait phones; new กระเป๋า (bag) tab separate from equipment; new สมุดภูต (spirit encyclopedia).
- Fix: menu after the altar kept only the Summon tab; Summon is now a main tab; warning when a team change loses an ability.

## Phase 3 (in progress) — 2026-10-09
- Jobs (Novice → Swordsman/Mage/Archer/Acolyte), 34 skills, job weapons, hats/capes/shoes/shields, potions (content CSV).
- `shared/progression` (levels, stats, skills, equip, cards, refine), `shared/sim/skills` (bolt/aoe/dash/rain/zone/heal/buff, SP, cast, cooldowns), bows shoot arrows.
- DOM menus with UI kit frame: Status, Skills, Equipment+bag, Cards, Job change, Refine (smith), Shop (merchant). Skill buttons S1–S3, HP/SP/EXP HUD, level-up pillar.
- Art brief `ART_P03_Jobs.md` (76 images).
- Phone action button (talk/shop/refine/pipe/smash) only when standing next to an NPC or station; sits top-right. Tap NPCs/signs directly.

## Phase 2 (in progress) — 2026-10-09
- Cut-out hero rig with JSON clips (idle/run/jump/fall/attack1-3/guard/hurt/death/cast).
- Combat sim in `shared/sim` (enemy AI for every `ai` type + 3 boss scripts, 3-hit combo, stomp, i-frames, shots), drops in `shared/rules/drops.ts`.
- RO damage numbers, crit starburst, slash/spark/ring VFX, hit-stop, shake, monster pose swap + dissolve, HP bar, death → respawn.

## Phase 1 (in progress) — 2026-10-09
- Platforming core in `shared/platformer` (tile collision, sub-stepped, coyote/buffer/variable jump/double jump/swim/drop-through), LDtk loader + validator, respawn rules.
- 8 prototype maps ported to `levels/world.ldtk` (`npm run levels`), room transitions, pipes, rock smash, signs/NPCs/chest, local save, scrolling camera.
- Art brief `ART_P01_World_Props.md`.
- Owner feedback: exit arrows + pipe labels, 🏠 home button, unstick on room entry, rock wall to ceiling, drown → back to town.

## 2026-10-09 — Art packs
- UI Kit complete (40/40, pack `P00_UI_Kit`); Monster Actions imported (42/42, pack `P02_Monster_Actions`).
- art:import brief check now reads only the File column (no false 'missing' from reference names).

## 2026-10-09 — UI Kit art (partial)
- Imported UI Kit Part 1 (22/40 images) into pack `P00_UI_Kit`; added `art-briefs/ART_P00_UI_Kit_REDO.md` for the 18 missing images.

## Phase 0 — 2026-10-09
- Project scaffold (Phaser 4.2.1, TS, Vite), shared formulas + tests, content pipeline, art import pipeline, legacy art pack, landscape controls, painted parallax world, CI + gh-pages deploy.
