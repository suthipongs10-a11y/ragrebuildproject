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
- [ ] Art brief written (`ART_P03_Jobs.md`)
- [ ] Content: `jobs.csv`, 34 skills in `skills.csv`, job weapons/equipment in `items.csv`, content-build validation
- [ ] `shared/progression`: EXP curves, level-up, stat points/costs, skill points, derived stats from build (equipment + cards + refine + passives + buffs)
- [ ] Skill runtime (`shared/sim/skills.ts`): melee/aoe/projectile/ground/heal/buff/passive, SP, cooldowns, cast time
- [ ] Hero state + save migration (level, job, stats, skills, slots, bag of item instances, equipment)
- [ ] Menus: Status / Skills / Equipment / Inventory / Cards (DOM overlay)
- [ ] Job change NPC + Novice basic skill gate
- [ ] Equip/refine/card socket rules (refine +15 with downgrade/break from `shared/formulas/refine`, card slot type restriction, card sets)
- [ ] Armor sets change rig parts (mechanism + placeholder until job parts arrive)
- [ ] Level-up / job-up VFX
- [ ] Tests (progression, skills, equipment rules, save migration; e2e: level up, change job, use a skill, equip)

## Exit gate
- [ ] Each job playable to Lv 30 in the test zone
- [ ] Menus usable one-handed on a phone
- [ ] Save/load keeps everything

## Known issues / questions
(none yet)
