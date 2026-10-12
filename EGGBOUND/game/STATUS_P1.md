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

## BATCH07 ชุดแรก (11/18 ตัว) — ใส่เกมแล้ว
- มอนใหม่ใน `SPECIES`: A07 ไข่ป่วน (หายาก), A08 วิญญาณโคมลอย (หายาก), A09 อสูรรากไม้บรรพ์ (มหากาพย์), B01 ควายธนู, B02 หุ่นพยนต์ฟาง, B04 พรายตะเคียน, B05 เสือสมิง (หายาก), B07 คชสีห์ (มหากาพย์), C01 ปี่เซียะ, C02 คางคกสามขา, C04 กระต่ายหยก
  - สเตตัสเริ่มต้นสำหรับทดสอบ: หายาก ≈ +8%, มหากาพย์ ≈ +16% จากระดับธรรมดา · สกิลใช้กลไก/แอนิเมชันที่มีอยู่ (รอ BATCH09 สำหรับเอฟเฟ็คท่าไม้ตายเฉพาะธาตุ)
  - ไข่ปริศนาฟักได้ตัวหายาก/มหากาพย์จริงแล้ว (ตำนานยังไม่มี → ตกไปมหากาพย์)
- BOSS_ROOT ใช้ภาพ A09 (scale 1.3) แทนโกเลมขยาย
- `import_art.py` ใหม่: ยึดเท้าจริงของแต่ละภาพ, `--mirror`, ข้ามไฟล์เสีย, webp alpha_quality 70 (เล็กลง ~30%)
- `spr()` มีท่าสำรองเมื่อภาพท่าใดหาย · ทดสอบ: ตั้งค่า → "รับมอนทุกตัว", ปุ่มฟักมอนระดับใช้ตัวจริงตามระดับ
- ไฟล์เสีย (truncated) ต้องส่งใหม่: A07 front_hit · A08 back_cast · A09 back_attack, back_cast · B01 front_attack · B02 front_cast · B04 back_attack · B05 front_idle, front_burst · C01 front_attack, eggC01 · C02 front_burst · C04 front_idle
- B05 ท่าหน้าหันซ้าย → กลับด้านตอนนำเข้า (`--mirror front_attack,front_cast,front_hit,master`)

## ดาวแบบ SW + ฉากปลุกพลัง (2026-10-12)
- ฟักได้ดาวตามความหายาก (`NAT_STARS`: ★1/★2/★3/★4) อัปได้ถึง `MAX_STARS` = ★6 · เพดานเลเวล ★6 = 70 · เซฟเก่าถูกยกดาวขึ้นเป็นดาวตามความหายากตอนโหลด
- ไข่ปริศนาทุกลาย: ตัวใหม่ได้ดาวตามความหายาก · ตัวซ้ำ +1 ดาว · เกิน ★6 แลกทอง
- ฉากฟัก (`hatchView.awaken()`): หลังเผยตัว — หายาก/มหากาพย์/ตำนาน: ฉากมืดลง กล้องซูม แสงทองไหลเข้าตัว → ระเบิดแสงทอง + สายฟ้าฟาดรอบตัว + แสงทองพุ่งกระจายรัวๆ (มหากาพย์ขึ้นไปสายฟ้าฟาดต่อเนื่อง, ตำนานเพิ่มวงแสงรุ้ง) → ดาวทองประทับทีละดวงเหนือหัว (ตัวซ้ำ: ดาวเดิมขึ้นก่อน ดาวใหม่กระแทกลง)
- UI: ป้ายความหายากสีตามระดับในหน้าคลังมอน/การ์ดฟักสำเร็จ · กรอบรูปการ์ดมอนเรืองสีตามความหายาก

## ฉากฟักมหากาพย์/ตำนาน (2026-10-12)
- `hatchView.epicPre()` แทนช่วงไข่สั่นเดิมสำหรับมหากาพย์ขึ้นไป (มหากาพย์ ~4.5 วิ, ตำนาน ~5.5 วิ ก่อนแตก):
  รวมพลัง (แสงเกลียววนรอบเสา + ประกายไฟฟ้า, สีไล่ระดับความหายาก) → ยิงลำพลังจากเสาทั้ง 4 เข้าไข่ → โอเวอร์โหลด (ออร่าพลังลุกรอบไข่, ลำแสงพุ่งขึ้น, เกลียวแสงหมุน, สายฟ้าคลานรอบไข่ + ฟาดจากฟ้า, ไข่ร้าว 3 ขั้น, กล้องซูม) → ขาววาบ → แตก
- หลังเผยตัว: ออร่าทองรอบตัวมอน + ระเบิดแสงทอง (เบากว่าเดิมเพราะตูมใหญ่ไปแล้ว) + ประทับดาว
- `drawPowerAura()` ใช้ซ้ำได้ (ไข่/มอน · อนาคตใช้กับท่าไม้ตายได้) · ภาพ BATCH12 (ถ้ามี) ใช้แทนโค้ดอัตโนมัติ: fx_aura_flame(_b), fx_light_shaft, fx_energy_beam, fx_vortex_spiral, fx_arc_ring, fx_aura_burst_ground

## อัปดาว (Evolution) + อัปสกิล แบบ SW (2026-10-12)
- เซฟ v2: `mons: MonSave[]` (uid, sid, lvl, exp, stars, sk[3], rare) · `team: uid[]` · `nextUid` · `items.soul` · เซฟ v1 แปลงอัตโนมัติ
- ฟักไข่ = ตัวใหม่เสมอ (ไม่มีอัปดาวอัตโนมัติแล้ว) · การ์ดฟักบอก "ตัวซ้ำ ใช้ป้อนอัปสกิล/เป็นอาหารอัปดาว"
- คลังมอน: ปุ่ม "★ อัปดาว" / "อัปสกิล" → แผงเงื่อนไข (เลเวลเต็ม / อาหาร ★เท่ากัน n ตัว / ทอง) แตะการ์ดด้านล่างเพื่อเลือกอาหาร
- สเตตัสใหม่: เพดานเลเวล ★1–6 = 15/20/25/30/35/40 · ด่าน 1-2 และบอส 1-3 ปรับเป็น ★1 เลเวลสูงขึ้นให้ความยากใกล้เดิม
- เลเวลสกิลส่งเข้า battle core (`MonsterRef.sk` → `skillAt()`) ยัง deterministic
- รูปลักษณ์ตามดาว: `lookOf(sid, stars)` → `sid~4` ฯลฯ ใช้ได้ทุกที่ที่วาดมอน (ต่อสู้/บ้าน/รูปโปรไฟล์)
- ทดสอบ: ตั้งค่า → "เตรียมอัปดาว" (ตัวที่เลือกเลเวลเต็ม + อาหาร + ตัวซ้ำ 1 + ทอง + ผลึกวิญญาณ 2)
- ยังไม่ทำ: เลือกสาย A/B ที่ ★5, แหล่งดรอปผลึกวิญญาณ, ป้อน EXP ด้วยมอน (power-up)

## ต้นแบบการเคลื่อนไหวระดับ SW — จิ้งจอก A01 (2026-10-12, โค้ดส่วนแรก รอภาพ BATCH13)
- ภาพมีชีวิต (`assets.warpDraw`): วาดสไปรต์เป็นแถบ 16 แถบ → หายใจ (อกพอง ตัวบนยก), โน้มตัวด้วยสปริง (`v.bend` เด้งเลยแล้วกลับ = follow-through), ระลอกตอนโดนตี · ใช้กับมอนทุกตัวในการต่อสู้
- โจมตีประชิด 3 จังหวะ (`aMelee`): วิ่งเข้า → windup (ง้าง ถอย ย่อตัว) → strike (พุ่ง ยืด smear หยุดภาพ 0.1 วิ) → follow (ไถลต่อ สปริงคืน) → กระโดดกลับ
- โดนตี: เด้งถอย + ระลอก + ประกาย `hitSpark` + ตัวเลขดาเมจแบบ SW (`dmgText`: เด้งใหญ่, ขอบหนา, คริสีทองเอียง + CRITICAL)
- ชนะ: ท่า joy · ตาย: ท่า down · ยิงหลายลูกใช้ท่า cast2
- สกิลเฉพาะของจิ้งจอก: `sk_fox_bite` (ขากรรไกรแสงงับ), `sk_fox_fireball` (ไฟจิ้งจอกวนรอบตัวแล้วพุ่งโค้งทีละลูก), `sk_fox_dawn` (ง้าง → พุ่งทะลุทีละตัวทิ้งทางไฟ → กระโดดลง → ทางไฟปะทุเป็นเสาไฟ)
- ภาพรอ: BATCH13-A (ท่าเพิ่ม) และ 13-B (fx_foxfire, fx_bite, fx_fire_trail, fx_hit_spark(_b), fx_slash_arc) — ใส่แล้วเกมใช้เองอัตโนมัติ

## หน้าหีบสมบัติ: ดาว/เหรียญ/กรอบทอง (2026-10-12)
- การ์ดของรางวัลระดับหายากขึ้นไป = กรอบทองเรืองแสง (ขอบทองหมุน, อัญมณีมุมสีตามเกรด, รัศมีหมุนด้านหลัง, แสงวาบพาด, ประกายวิบ) · ตำนาน = รัศมีสีรุ้ง · ธรรมดา = การ์ดเรียบ
- ดาวผลด่าน/การ์ดฟัก/อัปดาว: ไล่สีทอง ขอบเข้ม เรือง · ใช้ภาพ `ui_star`/`ui_star_empty` อัตโนมัติเมื่อมี (`starHTML()`)
- เหรียญ: `ui_coin` (ทอง ≥ 1000 ใช้ `ui_coin_pile`) · กรอบการ์ด `ui_frame_gold`/`ui_frame_plain` ซ้อนทับเมื่อมีภาพ

## ทีม/สารบัญ/เพิ่มเลเวล (2026-10-12)
- ทีม: มอนชนิดเดียวกันลงได้ 1 ตัว (`teamHasSpecies`) · กดตัวซ้ำขึ้นข้อความเตือน · การ์ดตัวซ้ำทึบ ป้าย "ซ้ำ" · เซฟที่มีตัวซ้ำในทีมถูกล้างตอนโหลด
- สารบัญมอน: แท็บในหน้า "มอน" · ค้นพบ x/ทั้งหมด + แยกธาตุ (กดกรอง)/บทบาท/ความหายาก · ตัวที่ยังไม่ได้เป็นเงาดำ กดดูภาพเต็ม สกิล ค่าพลัง (★เริ่ม Lv1 และ ★6 เต็ม) ภพ และไข่ได้ · `save.dex` จำชนิดที่เคยได้ (ตัวที่ถูกใช้เป็นอาหารก็ยังนับ) · การ์ดฟักบอก "บันทึกลงสารบัญครั้งแรก"
- เพิ่มเลเวล (ป้อนมอน): ปุ่ม "⬆ เลเวล" เลือกอาหารได้ 5 ตัว · EXP = 0.8 × EXP สะสมของอาหาร + 60 × ดาว² · ทอง 10/เลเวลอาหาร · เกินเพดานเลเวลของดาวจะเสีย (เตือนก่อน) · ค่าใน `FEED_*` (data.ts)
