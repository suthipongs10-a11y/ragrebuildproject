# STATUS — DICEBOUND

อัปเดตล่าสุด: 2026-11-28

## ตอนนี้อยู่ที่
**ก่อน M0** — สร้างโฟลเดอร์โปรเจกต์แล้ว รอไฟล์ภาพใน `raw/`

## ทำไปแล้ว
- สร้าง `dicebound/` ใน repo พร้อม `CLAUDE.md`, `STATUS.md`, `docs/`, `raw/` (5 ชุด ยังว่าง)

## ค้างอยู่
- [ ] เจ้าของโปรเจกต์ส่ง `01_characters` Part 1 (+ `manifest.csv` — Part 2 ไม่มี manifest มา) · ได้ Part 2 แล้ว 13 ไฟล์ ยังเทียบ manifest ไม่ได้ (ชุดอื่นครบ: `05_effects` 26/26, `04_ui` 29/29, `03_icons` 18/18, `02_monsters` 32/32)
- [ ] **รอเจ้าของโปรเจกต์:** ชื่อของช่อง/ไอคอนแต่ละชิ้นใน `03_icons` (manifest บอกแค่ `tile_<name>` / `icon_<name>`) — ขอโฟลเดอร์ `prompts/` หรือรายชื่อ
- [ ] **รอเจ้าของโปรเจกต์ตัดสิน:** ชุด `04_ui` มีภาพแนวตั้ง 1080x1920 (`ui_menu_bg`, `ui_run_map`, `mock_*` ทั้ง 4) แต่เกมเป็นแนวนอน 16:9 — ต้องสร้างเวอร์ชันแนวนอนหรือไม่
- [ ] ตรวจจำนวนไฟล์ใน `raw/` เทียบ manifest (งานแรกข้อ 10.1)
- [ ] M0: โครงโปรเจกต์ Vite + TS + PixiJS + Electron

## ขั้นต่อไป
1. รับภาพ → วางใน `raw/<ชุด>/` → สรุปจำนวนเทียบ manifest
2. ทำ M0 แล้วหยุดรายงาน

## การตัดสินใจ + เหตุผล
- **โปรเจกต์อยู่ในโฟลเดอร์ `dicebound/` ของ repo `ragrebuildproject`** — เจ้าของโปรเจกต์ขอให้แยกโฟลเดอร์ใน repo เดิม
  path ทั้งหมดใน `CLAUDE.md` (เช่น `src/`, `raw/`, `docs/`) นับจาก `dicebound/` เป็น root
  กติกาใน `CLAUDE.md` ที่ root ของ repo เป็นของโปรเจกต์ Ragnarok ไม่ใช้กับโฟลเดอร์นี้

## Dependency ที่เพิ่ม (พร้อมเหตุผล)
- ยังไม่มี

## ข้อสังเกตจากการรับไฟล์ (ย้ายไป `docs/ASSET_REPORT.md` ตอน M1)
- `02_monsters`: alpha ของชีตมอนไม่เป็น 0/255 เป๊ะ (ตัวภาพ ~252–254, พื้น 0) → pipeline ต้อง threshold alpha
- `02_monsters`: 10 จาก 28 ชีตแยกตามช่องว่างคอลัมน์ (alpha>16) ได้น้อยกว่าจำนวนท่าใน manifest → ต้องใช้ connected components ถ้ายังติดกันให้รายงาน: `mon_bat` 2/3, `elite_giant_spider` 3/4, `elite_dark_captain` 3/4, `boss_stone_golem_a/b` 2/3, `boss_swamp_witch_a/b` 2/3, `boss_fire_dragon_a/b` 2/3, `boss_dice_demon_p2` 2/4 (อีก 18 ชีตนับได้ตรง)
- `02_monsters`: ท่า hurt/attack มีเอฟเฟกต์วาดติดมาในเฟรม (ดาวกระแทก, ประกายเหรียญ) — ซ้อนกับเอฟเฟกต์จากโค้ดได้ ตัดสินตอนดู gallery
- `raw/00_style_anchor.png`: ภาพอ้างอิงสไตล์ มากับ zip มอน Part 1 ไม่อยู่ใน manifest ไม่ได้ใช้ในเกม
- `01_characters`: `char_warrior_t3_sheet` 4 ท่า แต่แยกตามคอลัมน์ได้ 2 ก้อน (แสงดาบ/ประกายชนท่าข้าง ๆ) · ท่า attack มีเส้นฟันดาบวาดติดมา ซ้อนกับ `fx_slash` ได้
