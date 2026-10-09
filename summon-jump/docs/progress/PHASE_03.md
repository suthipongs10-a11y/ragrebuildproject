# Phase 3 — Hero progression (RO) · progress

Status: **in progress** (started 2026-10-09)

Art: `art-briefs/ART_P03_Jobs.md` (76 images, 4 zips: job looks, job weapons + equipment icons, 31 skill icons, 16 skill VFX).
Also still open: `ART_P03_Gear_Cards_VFX.md` (swords, armor, cards, base VFX). Placeholders until the zips arrive.

## Design (decided)
- Base Lv 1–99, Job Lv 1–50 (Novice 1–10). EXP tables in `shared/progression`.
- Stat points per base level (RO-like curve), 1 skill point per job level. Stat cost rises with the stat value (RO style).
- Jobs: Novice → Swordsman / Mage / Archer / Acolyte at Novice Job Lv 10 (NPC in town). Job modifies HP/SP factors, ASPD, allowed weapons.
- 8 skills per first job (+2 Novice), 3 on-screen skill slots (S1 / S2 / S3), SP + cooldowns + cast time.
- Equipment: 8 slots (weapon, offhand, head, armor, cape, shoes, acc1, acc2). Items are instances: refine +0..+15, card slots.
- Menus as a DOM overlay styled with the UI kit (one-handed, big touch targets): Status, Skills, Equipment, Inventory, Cards.

## Checklist
- [x] Art brief written (`ART_P03_Jobs.md`)
- [x] Content: `jobs.csv`, 34 skills in `skills.csv`, job weapons/equipment in `items.csv`, content-build validation
- [x] `shared/progression`: EXP curves, level-up, stat points/costs, skill points, derived stats from build (equipment + cards + refine + passives + buffs)
- [x] Skill runtime (`shared/sim/skills.ts`): melee/aoe/projectile/ground/heal/buff/passive, SP, cooldowns, cast time
- [x] Hero state + save migration (level, job, stats, skills, slots, bag of item instances, equipment)
- [x] Menus: Status / Skills / Equipment / Inventory / Cards (DOM overlay)
- [x] Job change NPC + Novice basic skill gate
- [x] Equip/refine/card socket rules (refine +15 with downgrade/break from `shared/formulas/refine`, card slot type restriction, card sets)
- [~] Armor sets change rig parts — placeholder: clothes/weapon pieces are tinted per job/weapon; real part swap needs the `ART_P03_Jobs` parts sheets
- [x] Level-up / job-up VFX
- [x] Tests (progression, skills, equipment rules, save migration; e2e: level up, change job, use a skill, equip)

## Exit gate
- [ ] Each job playable to Lv 30 in the test zone
- [ ] Menus usable one-handed on a phone
- [ ] Save/load keeps everything

## Known issues / questions
- Card **sets** (bonus for a full set) not implemented yet: no sets are defined in `cards.csv` (set_id empty). Hook is in place when sets are designed.
- Weapon art (staff/bow/mace) and skill icons/VFX use placeholders until `ART_P03_Jobs` + `ART_P03_Gear_Cards_VFX` arrive.
- Balance pass: EXP curve retuned to our monsters (`expToNext = 12·lv^1.35`, Novice job 10 ≈ 25 kills). Lv 30 needs ~14k EXP — later zones (Phase 5) supply higher-EXP monsters; for now `?hero=job:lv` makes test heroes.

## Owner test round 1
- Phone (4G): deep forest showed Phaser's green "missing texture" boxes and some `?hero=` links didn't open. Not reproducible on desktop Chromium (also with slow-network emulation). Likely failed image downloads on mobile data. Fixes: every room's textures load with retries (`loadTextures`), a room that still misses textures fetches them before it starts, a clear "โหลดภาพไม่ครบ / ลองใหม่" screen instead of broken art, on-screen error box for script errors, reload after iOS WebGL context loss. Test heroes now each have their own save slot (`?hero=` value).

## How to test
- New game: start as Novice Lv 1 (Skill S1 = First Aid). Farm to Job Lv 10, learn Basic Skill 9 in ☰ > สกิล, talk to the priest (นักบวช) in town → choose a job.
- Test heroes (separate save slot, never overwrite the real one): `?hero=swordsman:30`, `?hero=mage:30`, `?hero=archer:30`, `?hero=acolyte:30` (add `&map=forest` etc.).
- Skills: S1–S3 buttons (keys C / V / B). Menu: ☰ button or M. Smith/anvil = refine, merchant = shop, priest = job change.
