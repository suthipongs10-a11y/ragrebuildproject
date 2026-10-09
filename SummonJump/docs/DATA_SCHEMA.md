# Content data schema

All tables are edited in Google Sheets, exported as CSV into `content/`, built by `npm run content`.
IDs are lowercase snake_case and **never change** once shipped. Thai display names live in `i18n_th.csv` (`key,text`), referenced as `name_key`.

## monsters.csv
| column | type | example | notes |
|---|---|---|---|
| id | string | poring | unique |
| name_key | string | mon.poring | i18n |
| tier | enum | normal / mini / mvp / world | |
| zone | string | forest | home zone id |
| level | int | 3 | |
| hp | int | 22 | |
| atk | int | 7 | |
| def | int | 0 | |
| element | enum | water | neutral/water/fire/earth/wind/holy/dark |
| element_lv | int | 1 | 1–4 (RO style) |
| size | enum | small | small/medium/large (size modifiers) |
| ai | enum | hopper | hopper/walker/charger/flyer/swimmer/turret/boss |
| ai_params | json | {"hop":240,"range":170} | per-ai numbers |
| stompable | bool | true | |
| exp | int | 8 | base exp |
| job_exp | int | 5 | |
| zeny_min, zeny_max | int | 4, 9 | |
| card_id | string | card_poring | |
| card_rate | float | 0.01 | |
| respawn_sec | int | 0 | 0 = on room re-entry; mini/mvp use seconds |
| art_pack | string | P00_legacy | where poses live |
| hitbox | string | 20x16 | w x h in world px |
| draw_h | int | 24 | sprite draw height |

## drops.csv
`monster_id, item_id, rate, min, max` — multiple rows per monster. Rates are base; LUK and events multiply in `shared/rules/drops.ts`.

## items.csv
`id, name_key, type (weapon/offhand/head/armor/cape/shoes/acc/consumable/material/scroll), subtype (sword/staff/bow/mace/...), tier (common/rare/legend/mvp), job_mask (novice|swords|mage|archer|acolyte), level_req, atk, matk, def, mdef, hp, sp, str, agi, vit, int, dex, luk, crit, aspd, element, slots, refineable, price, icon, rig_parts (armor set id or empty)`

## cards.csv
`id, name_key, slot_type (weapon/armor/head/shoes/acc/any), effects (json: {"atk":5,"crit":3,"vs_element":{"water":0.2}}), set_id, art`

## spirits.csv
`id, family, name_key, element, base_star (1-5), hp, atk, def, spd, auto_skill, ult_skill, leader_skill, ability (double/dive/break/cloud/reveal/none), awaken_to, art_small, art_big`

## skills.csv
`id, owner (job id or spirit id), name_key, type (active/passive/ult/leader), max_lv, sp (formula), cd, cast, target (front/aoe/self/all), hit_count, power (formula per lv), element, effects (json), requires (json), icon, vfx`

## runes.csv
`set_id, name_key, pieces (2/4), bonus (json)` + `rune_stats.csv` for main/sub stat roll tables.

## jobs.csv
`id, name_key, tier (0/1/2), from_job, job_lv_req, hp_factor, sp_factor, weapons (list), parts_set, skills (list)`

## maps.csv
`id, zone, name_key, ldtk_file, music, bg_pack, exits (json), spawns_override (json), mvp (monster id), gate_abilities (list)`

## quests.csv / missions.csv / login_calendar.csv
Standard reward tables: `id, type, goal (json), reward (json), reset (daily/weekly/none)`.

## Validation (`npm run content` fails if)
- duplicate ids, unknown references (card_id, item_id, skill ids, art keys)
- rates outside 0–1, negative stats
- missing i18n keys
- art key not present in `manifest.generated.ts` (warning only before art arrives)
