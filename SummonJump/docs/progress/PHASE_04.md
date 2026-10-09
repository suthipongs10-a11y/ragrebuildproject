# Phase 4 — Spirits (SW) · progress

Status: **in progress** (started 2026-10-09, owner said "go" after Phase 3)

Art: `art-briefs/ART_P04_Spirits.md` (79 images, 4 zips: awakened forms of the 5 old spirits, 10 new spirit families × 4 forms, scrolls/essences/runes/summon VFX).
Placeholders until the zips arrive: the 5 old small spirits (`P00_legacy`), tinted per element; new families use a tinted placeholder orb.

## Design (decided)
- **15 families**, each a CSV row (`content/spirits.csv`). Element variants are generated from the family: 1–3★ families come in water / fire / earth / wind, 4–5★ families also in holy / dark. Element changes stats a little (`content/spirit_elements.csv`) and the colour (hue shift of the same painting).
- **Stars 1★–6★**, max level = 10 + 5×star (15 … 40). Stats grow with level, star and awakening (formula in `shared/spirits`).
- **Star-up**: spirit at max level + N fodder spirits of the same star (N = star) → star +1, level 1. Fodder in the team cannot be used; its runes go back to the rune bag.
- **Awaken**: element essence + magic essence (counts in `spirits.csv`) → new look, stats +15 %, auto skill replaced by the awakened skill.
- **Runes**: 6 slots, 8 sets (2- and 4-piece bonuses), main stat by slot (1 ATK, 3 DEF, 5 HP flat; 2/4/6 random), up to 4 sub stats, upgrade +0 → +15 (zeny, success rate per level, sub stat added/raised at +3/6/9/12). Tables in `content/runes.csv`, `rune_stats.csv`, `rune_upgrade.csv`, `rune_drop.csv`.
- **Team of 3** (slot 1 = leader). Leader: leader skill for hero + team, and the hero's weapon takes the leader's element when the weapon has none. Members follow the hero, auto-cast skill 1 at the nearest monster, and give exploration abilities (double jump, dive, smash rocks, cloud glide, reveal hidden things).
- Spirits don't take damage in the world (they fight in the arena later, Phase 8).
- **Ultimate**: hero hits / spirit hits / kills fill the spirit gauge; ✦ (F) when full → cinematic (dim, magic circle, big spirit, multi-hit on every monster on screen). Using a hero skill within 2 s before = **COMBO** (+30 %).
- Spirits in the team gain the same base EXP as the hero from kills.
- **Summon** (altar in town, or menu): scrolls Normal / Mystic / Element / Light-Dark. Rates + pity in `content/summon.csv`, rolls in `shared/rules/summon.ts` (seeded RNG, same code the server will use in Phase 6).
- Sources (offline, until Phase 5/7 dungeons): new save gets the starter team (Sylph, Undine, Salamander = the old double jump / dive / smash abilities) + Poring + 10 Normal + 3 Mystic scrolls; monsters drop essences (by their element), runes (rare, bosses always) and scrolls (rare); the merchant sells Normal scrolls.

## Checklist
- [x] Art brief written (`ART_P04_Spirits.md`)
- [x] Content: `spirits.csv` (15 families), `spirit_elements.csv`, spirit skills (auto / awakened auto / ult / leader) in `skills.csv`, runes tables, `summon.csv`, essences + scrolls in `items.csv`, drops; content-build validation
- [x] `shared/spirits`: collection, stats, level/EXP, star-up, awaken, runes (roll, equip, upgrade, set bonuses), team + leader + abilities
- [x] `shared/rules/summon.ts`: scroll rates, pity; **100k-roll test**
- [x] Save: spirit box (spirits, runes, team, pity, gauge) + migration (starter team for old saves)
- [x] World: followers, auto skill, abilities from the team (replaces the debug `?abil=`), leader element/buff on the hero
- [x] Spirit gauge + ✦ button + ultimate cinematic for every family + COMBO
- [x] Menus: Spirits (list, detail, team, star-up, awaken, runes), Summon (altar) with summon animation
- [x] Tests: unit (stats, star-up, awaken, runes, team, summon 100k) + e2e (summon, team ability opens a gate, ultimate)

## Exit gate
- [ ] Collect / upgrade / awaken loop works offline — **owner to test on the phone**
- [ ] Ultimate cinematic for every family — every family has one (6 effect styles: slam, vortex, wave, rain, pillar, burst); big art comes with the P04 zips — **owner to check**
- [x] Summon rates verified by a 100k-roll test (`tests/spirits.test.ts`: every scroll within ±0.5 %, pity never exceeded)

## How to test (phone)
- Normal save: the starter team (Sylph / Undine / Salamander) follows you and shoots monsters; ☰ → ภูต to see the team, ✨ อัญเชิญ for the altar (10 normal + 3 mystic scrolls).
- Fight until ✦ is full (it glows) → tap ✦ for the ultimate. Use a skill right before = COMBO.
- `?hero=mage:30` (test slot): one of every family, 30 mystic + other scrolls, essences for awakening, 18 runes.

## Fixed after owner test
- ☰ after using the altar reopened only the Summon tab (status / equipment gone). Now ☰ / M always reopen a main tab, and Summon is a main tab.
- Changing the team now warns when the new team loses an exploration ability.

## Known issues / notes
- Element variants are a hue shift of one painting per family (cheap, consistent). If a variant looks wrong we can order that one painting separately later.
- New families show a coloured orb until `ART_P04_Spirits` arrives; big forms use the small picture until then.
- Hidden treasure (👁️ reveal: Pixie / Sage Owl): forest (mystic scroll) and sky 1 (light-dark scroll).
- Cloud glide (☁️ Cloud Sheep / Unicorn): hold jump while falling. No level needs it yet (Phase 5 content).
