# STATUS — DICEBOUND

อัปเดตล่าสุด: 2026-11-28

## ตอนนี้อยู่ที่
**M0 เสร็จ — รอเจ้าของโปรเจกต์ตรวจ** ก่อนขึ้น M1 (asset pipeline)

## ทำไปแล้ว
- รับภาพครบ 5 ชุด ตรง manifest ทุกชุด: `01_characters` 26/26, `02_monsters` 32/32, `03_icons` 18/18, `04_ui` 29/29, `05_effects` 26/26 (รวม 131 ไฟล์)
- **M0:** โครง Vite + TypeScript (strict) + PixiJS v8 + Electron, โฟลเดอร์ตาม CLAUDE.md §3
  - `npm run dev` (เบราว์เซอร์) · `npm run dev:electron` · `npm run build:win` → `release/DICEBOUND 0.0.0.exe` (portable) + `release/win-unpacked/`
  - `npm run check` = typecheck + lint + test + validate data (ผ่าน: 8 เทสต์)
  - ESLint บังคับกฎ sim: `src/sim/` ห้าม import pixi/electron/ชั้นบน ห้าม `Math.random` / `Date.now` / `window`
  - seeded RNG (`src/sim/rng.ts`) state เป็น JSON ได้ + เทสต์ seed เดิมผลเดิม
  - i18n `t('key')` EN/TH + ตรวจ key สองภาษาตรงกันใน `validate:data`
  - `PlatformService` + `WebPlatform` (no-op)
  - letterbox 1920×1080 (integer scale เมื่อจอ ≥ design, เศษส่วนเมื่อเล็กกว่า)
  - Electron: `contextIsolation`, `sandbox`, ไม่มี `nodeIntegration`, DevTools ปิดใน build จริง, CSP ไม่มี `unsafe-eval`
  - CI: `.github/workflows/dicebound.yml` (check บน Linux → build .exe บน Windows แล้วแนบเป็น artifact)

## ทดสอบแล้ว / ยังไม่ได้ทดสอบ
- ✅ `npm run check` ผ่าน · `npm run build` ผ่าน
- ✅ dev server ในเบราว์เซอร์ที่ 1920×1080 และ 1280×800 (ไทย) — แสดงผลถูก ไม่มี console error
- ✅ แอป Electron (Linux, จอเสมือน) โหลด build จริง — มี canvas, bridge `window.dicebound`, renderer ไม่มี `require`
- ✅ `npm run build:win` บน Linux ได้ไฟล์ .exe
- ❌ **ยังไม่ได้เปิด .exe บน Windows จริง** (เครื่อง build เป็น Linux ไม่มี wine) — เจ้าของโปรเจกต์ต้องเปิดเอง = เกณฑ์ผ่าน M0
- ❌ `npm run dev:electron` ยังไม่ได้รันทั้งคำสั่ง (ทดสอบแยกส่วน: vite dev และ electron โหลด build)
- ✅ CI รันแรกผ่านทั้ง 2 job (check บน Linux, build-win บน Windows) ได้ artifact `dicebound-win-portable`
- ❌ tag `dicebound-m0` สร้างในเครื่อง build แล้วแต่ push ไม่ขึ้น (remote ตัดการเชื่อมต่อ) — M0 อยู่ที่ commit `67d5fa2`

## ค้างอยู่ (รอเจ้าของโปรเจกต์)
- [ ] เปิด .exe บน Windows ยืนยัน M0
- [ ] `04_ui`: `ui_menu_bg`, `ui_run_map` เป็นแนวตั้ง 1080×1920 แต่เกมเป็นแนวนอน — สร้างเวอร์ชันแนวนอนหรือไม่ (`mock_*` 4 ไฟล์ก็แนวตั้ง แต่ใช้อ้างอิงเท่านั้น)
- [ ] `03_icons`: ชื่อของช่อง/ไอคอนแต่ละชิ้น (manifest บอกแค่ `tile_<name>` / `icon_<name>`) — ขอโฟลเดอร์ `prompts/` หรือรายชื่อ
- [ ] `03_icons` + ภาพหน้า/หมากใน `01_characters`: ขอบนุ่มกว่าชุด effects/UI — ดูใน gallery (M1) แล้วตัดสินว่าสร้างใหม่ไหม

## ขั้นต่อไป
**M1 — Asset pipeline** (เริ่มเมื่อ M0 ได้รับการยืนยัน): `npm run assets`, ตัดชีตด้วย connected components, atlas, `/gallery`, `docs/ASSET_REPORT.md`, ตัวอย่างย่อภาพ nearest vs lanczos 3 ไฟล์ให้เลือก

## การตัดสินใจ + เหตุผล
- **โปรเจกต์อยู่ในโฟลเดอร์ `dicebound/` ของ repo `ragrebuildproject`** — เจ้าของโปรเจกต์ขอให้แยกโฟลเดอร์ใน repo เดิม · path ใน `CLAUDE.md` นับจาก `dicebound/` · `CLAUDE.md` ที่ root ของ repo เป็นของโปรเจกต์ Ragnarok ไม่ใช้กับโฟลเดอร์นี้
- **TypeScript 6.0.3 ไม่ใช่ 7.x** — `typescript-eslint` 8.74 รองรับ TS `<6.1.0` เท่านั้น อัปเมื่อ typescript-eslint รองรับ
- **Electron main/preload คอมไพล์เป็น CommonJS** (`dist-electron/`) — preload แบบ sandbox เป็น ES module ไม่ได้
- **ไลบรารี runtime (pixi.js, @pixi/sound, zod) อยู่ใน `devDependencies`** — Vite bundle เข้า `dist/` แล้ว ถ้าอยู่ใน `dependencies` electron-builder จะก๊อป `node_modules` ซ้ำเข้า `app.asar` (+86 MB)
- **`win.signAndEditExecutable: false`** — แก้ icon/metadata ของ .exe ต้องใช้ wine บน Linux; ยังไม่มีไอคอนแอป (รอ pipeline M1) → ตั้งไอคอน + เปิดกลับตอน build บน Windows/CI
- **import `pixi.js/unsafe-eval`** — ให้ Pixi ทำงานภายใต้ CSP ที่ไม่มี `unsafe-eval`
- **tag ใช้ชื่อ `dicebound-m<N>`** แทน `m<N>` — repo นี้มีหลายโปรเจกต์ กันชื่อชน
- ขนาด build: `win-unpacked` 359 MB (เกือบทั้งหมดคือ Electron 45) → เหลือ ~140 MB สำหรับ asset+เสียง ใต้เพดาน 500 MB ต้องจับตา

## Dependency (พร้อมเหตุผล)
- ตาม CLAUDE.md §2: `typescript`, `vite`, `pixi.js`, `@pixi/sound`, `electron`, `electron-builder`, `vitest`, `zod` (schema ของ `data/`)
- เพิ่ม: `eslint` + `typescript-eslint` + `@eslint/js` + `globals` (lint และบังคับกฎชั้น sim) · `tsx` (รัน `tools/*.ts`) · `concurrently` + `wait-on` + `cross-env` (`dev:electron` ข้ามแพลตฟอร์ม) · `@types/node`

## ข้อสังเกตจากการรับไฟล์ (ย้ายไป `docs/ASSET_REPORT.md` ตอน M1)
- `02_monsters`: alpha ของชีตมอนไม่เป็น 0/255 เป๊ะ (ตัวภาพ ~252–254, พื้น 0) → pipeline ต้อง threshold alpha
- `02_monsters`: 10 จาก 28 ชีตแยกตามช่องว่างคอลัมน์ (alpha>16) ได้น้อยกว่าจำนวนท่าใน manifest → ต้องใช้ connected components ถ้ายังติดกันให้รายงาน: `mon_bat` 2/3, `elite_giant_spider` 3/4, `elite_dark_captain` 3/4, `boss_stone_golem_a/b` 2/3, `boss_swamp_witch_a/b` 2/3, `boss_fire_dragon_a/b` 2/3, `boss_dice_demon_p2` 2/4 (อีก 18 ชีตนับได้ตรง)
- `02_monsters`: ท่า hurt/attack มีเอฟเฟกต์วาดติดมาในเฟรม (ดาวกระแทก, ประกายเหรียญ) — ซ้อนกับเอฟเฟกต์จากโค้ดได้ ตัดสินตอนดู gallery
- `raw/00_style_anchor.png`: ภาพอ้างอิงสไตล์ มากับ zip มอน Part 1 ไม่อยู่ใน manifest ไม่ได้ใช้ในเกม
- `01_characters`: 8 จาก 15 ชีตท่าทางแยกตามคอลัมน์ได้ไม่ตรง 4 ท่า (แสงอาวุธ/ประกายชนท่าข้าง ๆ หรือประกายหลุดเป็นก้อนแยก): `warrior_t3` 2, `knight_t2/t3` 3, `archer_t2/t3` 3, `mage_t1` 6, `mage_t3` 3, `cleric_t2/t3` 3 · t1 ส่วนใหญ่สะอาด ปัญหาอยู่ที่ t2–t3 ซึ่งมีแสงเยอะ
- `01_characters`: ท่า attack/hurt/victory มีเอฟเฟกต์วาดติดมา (เส้นฟัน, ดาวกระแทก, ขีดดีใจ) ซ้อนกับเอฟเฟกต์จากโค้ดได้
- `char_knight_t3_sheet`: พื้นหลัง alpha ~4–7 ไม่ใช่ 0 (RGB ขาว) — ใช้ได้เมื่อ threshold
- `raw/00_style_anchor_characters.png`: style anchor จาก zip ตัวละคร Part 1 เนื้อภาพต่างจากของ zip มอน (ชื่อเดิม `00_style_anchor.png` ซ้ำกัน จึงตั้งชื่อใหม่ตอนวาง ไม่ได้แก้เนื้อไฟล์)
