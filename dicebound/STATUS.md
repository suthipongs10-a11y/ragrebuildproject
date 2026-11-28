# STATUS — DICEBOUND

อัปเดตล่าสุด: 2026-11-28

## ตอนนี้อยู่ที่
**M1 ส่งมอบแล้ว — รอเจ้าของโปรเจกต์ตรวจ gallery** (เกณฑ์ผ่าน M1) · M0 ยังค้างข้อเดียว: เปิด .exe บน Windows จริง (เจ้าของโปรเจกต์เน็ตช้า โหลดไฟล์ใหญ่ไม่ได้ สั่งให้ทำ M1 ต่อเมื่อ 2026-11-28)

Gallery (ลิงก์ส่วนตัวของเจ้าของโปรเจกต์): https://claude.ai/artifact/SLAa4PiLNfbGRkDptKUrca · ในเครื่อง: `npm run dev` แล้วเปิด `/gallery/`

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

- **M1:** `npm run assets` (≈25 วิ รันซ้ำได้) → `assets/atlases/*.png` (13 หน้า, 482 ชิ้น) + `assets/images/*.webp` (22 ภาพใหญ่) + `assets/manifest.json` + `docs/ASSET_REPORT.md` + `docs/asset-samples/`
  - ตัดชีตจากพิกเซลจริง: ท่าทาง = ก้อนพิกเซลที่ต่อกัน (กัดขอบ mask ชั่วคราวถ้าท่าชนกัน), เอฟเฟกต์พื้นดำ = ช่วงคอลัมน์ที่มีแสง, กริด = ก้อนพิกเซลจัดเข้าช่อง, ช่องกระดาน = หารอยต่อจาก alpha
  - ทุกชีตตัดได้ครบตามจำนวนใน manifest (131 ไฟล์: 127 ใช้ในเกม + 4 mock อ้างอิง) ไม่มี placeholder
  - หน้า gallery (`gallery/index.html`, dev เท่านั้น ไม่เข้า build เกม): แท็บตามหมวด, สลับพื้นหลัง, ค้นหา id, เล่นวนเอฟเฟกต์, แท็บเทียบ nearest กับ lanczos
  - เทสต์ pipeline 9 ข้อ (`tests/tools/assets.test.ts`) รวมทั้งหมด 17 เทสต์

## ทดสอบแล้ว / ยังไม่ได้ทดสอบ
- ✅ M1: `npm run check` ผ่าน · เปิด gallery ทุกแท็บในเบราว์เซอร์ที่ 1500px และ 400px ไม่มี error ไม่มีเลื่อนแนวนอน
- ✅ M1: ดูด้วยตาแล้ว — ตัวละคร (archer ทั้ง 3 tier, cleric t1), มอน 8 ตัว, เอฟเฟกต์ 2 ชุด, ตัวอย่างย่อภาพ 3 คู่: เท้าเส้นเดียวกัน สเกลคงที่ ไม่มีชิ้นส่วนข้ามท่า
- ❌ M1: ยังไม่ได้ดูด้วยตาทีละชิ้น: icons, ui, ภาพใหญ่, บอส/อีลิท และตัวละคร/มอน/เอฟเฟกต์ที่เหลือ — ให้เจ้าของโปรเจกต์ตรวจใน gallery
- ❌ M1: ยังไม่ได้เปิดหน้า gallery ที่ publish แล้วด้วยตัวเอง (ทดสอบไฟล์เดียวกันผ่าน dev server)
- ✅ `npm run check` ผ่าน · `npm run build` ผ่าน
- ✅ dev server ในเบราว์เซอร์ที่ 1920×1080 และ 1280×800 (ไทย) — แสดงผลถูก ไม่มี console error
- ✅ แอป Electron (Linux, จอเสมือน) โหลด build จริง — มี canvas, bridge `window.dicebound`, renderer ไม่มี `require`
- ✅ `npm run build:win` บน Linux ได้ไฟล์ .exe
- ❌ **ยังไม่ได้เปิด .exe บน Windows จริง** (เครื่อง build เป็น Linux ไม่มี wine) — เจ้าของโปรเจกต์ต้องเปิดเอง = เกณฑ์ผ่าน M0
- ❌ `npm run dev:electron` ยังไม่ได้รันทั้งคำสั่ง (ทดสอบแยกส่วน: vite dev และ electron โหลด build)
- ✅ CI รันแรกผ่านทั้ง 2 job (check บน Linux, build-win บน Windows) ได้ artifact `dicebound-win-portable`
- ❌ tag `dicebound-m0` สร้างในเครื่อง build แล้วแต่ push ไม่ขึ้น (remote ตัดการเชื่อมต่อ) — M0 อยู่ที่ commit `67d5fa2`

## ค้างอยู่ (รอเจ้าของโปรเจกต์)
- [ ] **ตรวจ gallery แล้วบอกว่าโอเคหรือชิ้นไหนต้องแก้** = เกณฑ์ผ่าน M1
- [x] วิธีย่อภาพ: **lanczos + sharpen** — เจ้าของโปรเจกต์ให้เลือกวิธีที่ดีที่สุด (2026-11-28) ปิดข้อ 9.2 ใน CLAUDE.md
- [ ] ข้อที่ต้องตัดสินอื่น ๆ อยู่ใน `docs/ASSET_REPORT.md` หัวข้อ 5
- [ ] เปิด .exe บน Windows ยืนยัน M0
- [ ] `04_ui`: `ui_menu_bg`, `ui_run_map` เป็นแนวตั้ง 1080×1920 แต่เกมเป็นแนวนอน — สร้างเวอร์ชันแนวนอนหรือไม่ (`mock_*` 4 ไฟล์ก็แนวตั้ง แต่ใช้อ้างอิงเท่านั้น)
- [ ] `03_icons`: ชื่อของช่อง/ไอคอนแต่ละชิ้น (manifest บอกแค่ `tile_<name>` / `icon_<name>`) — ขอโฟลเดอร์ `prompts/` หรือรายชื่อ
- [ ] `03_icons` + ภาพหน้า/หมากใน `01_characters`: ขอบนุ่มกว่าชุด effects/UI — ดูใน gallery (M1) แล้วตัดสินว่าสร้างใหม่ไหม

## ขั้นต่อไป
**M2 — Sim core** (เริ่มเมื่อ M1 ได้รับการยืนยัน): state/action/events, เต๋า, กระดาน, ช่อง, ต่อสู้, เศรษฐกิจ, unit tests, บอทสุ่ม 1,000 รัน

## การตัดสินใจ + เหตุผล
- **โปรเจกต์อยู่ในโฟลเดอร์ `dicebound/` ของ repo `ragrebuildproject`** — เจ้าของโปรเจกต์ขอให้แยกโฟลเดอร์ใน repo เดิม · path ใน `CLAUDE.md` นับจาก `dicebound/` · `CLAUDE.md` ที่ root ของ repo เป็นของโปรเจกต์ Ragnarok ไม่ใช้กับโฟลเดอร์นี้
- **TypeScript 6.0.3 ไม่ใช่ 7.x** — `typescript-eslint` 8.74 รองรับ TS `<6.1.0` เท่านั้น อัปเมื่อ typescript-eslint รองรับ
- **Electron main/preload คอมไพล์เป็น CommonJS** (`dist-electron/`) — preload แบบ sandbox เป็น ES module ไม่ได้
- **ไลบรารี runtime (pixi.js, @pixi/sound, zod) อยู่ใน `devDependencies`** — Vite bundle เข้า `dist/` แล้ว ถ้าอยู่ใน `dependencies` electron-builder จะก๊อป `node_modules` ซ้ำเข้า `app.asar` (+86 MB)
- **`win.signAndEditExecutable: false`** — แก้ icon/metadata ของ .exe ต้องใช้ wine บน Linux; ยังไม่มีไอคอนแอป (รอ pipeline M1) → ตั้งไอคอน + เปิดกลับตอน build บน Windows/CI
- **import `pixi.js/unsafe-eval`** — ให้ Pixi ทำงานภายใต้ CSP ที่ไม่มี `unsafe-eval`
- **tag ใช้ชื่อ `dicebound-m<N>`** แทน `m<N>` — repo นี้มีหลายโปรเจกต์ กันชื่อชน
- **M1 — ย่อด้วย lanczos + sharpen (ตัดสินแล้ว)** — เจ้าของโปรเจกต์มอบให้เลือก · ภาพต้นฉบับไม่ได้อยู่บน pixel grid จริงและย่อด้วยอัตราส่วนไม่ลงตัว (0.36–0.85) nearest จะทิ้งพิกเซลแบบสุ่ม ทำให้เส้นขอบขาด/หนาไม่เท่ากัน lanczos เฉลี่ยพิกเซลจึงเก็บรายละเอียดครบ · ชุดเอฟเฟกต์ไม่ถูกย่อ (สเกล 1.00) จึงคมเท่าเดิมทั้งสองวิธี
- **M1 — id ของชิ้นที่ manifest ไม่ตั้งชื่อ ใช้เลขลำดับชั่วคราว** (`icons_items_3`) — ไม่เดาชื่อจากภาพ เพราะ id เปลี่ยนไม่ได้หลังปล่อยเกม
- **M1 — สเกลร่วมต่อ "ตัว"** — ตัวละครตัวเดียวกันทุก tier และบอสชีต A+B ใช้สเกลเดียวกัน (ท่าที่ใหญ่สุดพอดีผืน final_size ไม่ขยายเกิน 1.0) จัดชิดล่างกึ่งกลาง · เอฟเฟกต์จัดกึ่งกลางและใช้แถบแนวตั้งร่วมกันทั้งชีตเพื่อไม่ให้กระโดดระหว่างเฟรม
- **M1 — alpha ถูกปัดเป็น 0/255 ที่ค่า 128** — ต้นฉบับ alpha ไม่สะอาด (ตัวภาพ ~252, พื้น 0–7)
- **M1 — ภาพฉาก/ภาพใหญ่เก็บเป็น WebP แยกไฟล์ (คุณภาพ 92) ไม่เข้า atlas** — 22 ภาพรวม 4.2 MB (ถ้าเป็น PNG ≈ 50 MB) · ภาพโปร่งใสที่ใหญ่เกิน 512 (โลโก้) เป็น WebP lossless
- **M1 — atlas หน้าละ 2048 px** — ปลอดภัยกับการ์ดจอออนบอร์ดรุ่นเก่า
- **M1 — `assets/` commit ลง repo** — เกมและ CI build ได้โดยไม่ต้องรัน pipeline (33 MB)
- **M1 — Vite `publicDir: 'assets'`** — เกมโหลด `manifest.json` / `atlases/` / `images/` จาก root ของเว็บ
- ขนาด build: `win-unpacked` 359 MB (เกือบทั้งหมดคือ Electron 45) → เหลือ ~140 MB สำหรับ asset+เสียง ใต้เพดาน 500 MB ต้องจับตา

## Dependency (พร้อมเหตุผล)
- ตาม CLAUDE.md §2: `typescript`, `vite`, `pixi.js`, `@pixi/sound`, `electron`, `electron-builder`, `vitest`, `zod` (schema ของ `data/`)
- เพิ่ม: `eslint` + `typescript-eslint` + `@eslint/js` + `globals` (lint และบังคับกฎชั้น sim) · `tsx` (รัน `tools/*.ts`) · `concurrently` + `wait-on` + `cross-env` (`dev:electron` ข้ามแพลตฟอร์ม) · `@types/node` · `sharp` (M1: อ่าน/ย่อ/เขียนภาพใน asset pipeline)

## ข้อสังเกตเรื่องภาพ
ย้ายไป `docs/ASSET_REPORT.md` หัวข้อ 5 แล้ว (ต้นฉบับอยู่ที่ `tools/assets/review-notes.md`)
