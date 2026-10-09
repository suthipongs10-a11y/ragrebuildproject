# START — Summon Jump (คำสั่งเริ่มแชทใหม่)

> ไฟล์นี้ให้ Claude อ่านเป็นอย่างแรกทุกครั้งที่เปิดแชทใหม่ จะได้รู้ว่าโปรเจกต์อยู่ตรงไหนและต้องทำอะไรต่อ
> เวอร์ชันออนไลน์: https://suthipongs10-a11y.github.io/ragrebuildproject/summon-jump/START.md

## 1. โปรเจกต์อยู่ที่ไหน
- Repo: `suthipongs10-a11y/ragrebuildproject` บน branch **`claude/summon-jump`**
- โฟลเดอร์: **`SummonJump/`** ทำงานทุกอย่างในโฟลเดอร์นี้เท่านั้น
- `CLAUDE.md` ที่ root ของ repo เป็นของ Ragnarok Rebuild (Unity/C#) ซึ่งเป็น**คนละโปรเจกต์** ไม่ต้องใช้ ห้ามแตะไฟล์นอก `SummonJump/` ยกเว้น `.github/workflows/summon-jump.yml`
- ลิงก์เล่นเกม (CI deploy ให้ทุกครั้งที่ push): https://suthipongs10-a11y.github.io/ragrebuildproject/summon-jump/

## 2. ขั้นตอนเริ่มงาน (ทำตามลำดับ)
1. `git fetch origin claude/summon-jump && git checkout claude/summon-jump` แล้ว `cd SummonJump`
2. อ่านไฟล์เหล่านี้ให้ครบ:
   - `SummonJump/CLAUDE.md` (กติกาหลัก)
   - `docs/ROADMAP.md` (เฟสทั้งหมดและเงื่อนไขผ่านเฟส)
   - `docs/progress/` (เปิดไฟล์ล่าสุดเพื่อดูว่าทำถึงไหนแล้ว)
   - `docs/ART_PIPELINE.md` (ระบบภาพจาก ChatGPT)
   - ไฟล์อื่นอ่านเมื่อต้องใช้: `docs/GDD.md`, `docs/ARCHITECTURE.md`, `docs/DATA_SCHEMA.md`
3. `npm ci` → `npm run test` → `npm run build` ต้องผ่านก่อนเริ่มแก้โค้ด
4. ดูว่าเฟสปัจจุบันคือเฟสไหนจาก `docs/progress/PHASE_XX.md` ล่าสุด
   - ถ้าเฟสนั้นยังไม่ปิด ให้ทำต่อจาก checklist
   - ถ้าปิดแล้วและเจ้าของบอก "go" ให้เริ่มเฟสถัดไป:
     - สร้าง `docs/progress/PHASE_XX.md` เป็น checklist
     - เขียน `art-briefs/ART_PXX_<ชื่อ>.md` ก่อนเริ่มเขียนโค้ด เพื่อให้เจ้าของเอาไปสั่ง ChatGPT ได้ทันที
     - ระหว่างที่ยังไม่มีภาพ ให้ใช้ภาพชั่วคราวไปก่อน ห้ามรอภาพ

## 3. เมื่อเจ้าของส่ง zip ภาพมา
1. ย้าย zip ไปไว้ที่ `art-inbox/`
2. รัน `npm run art:import -- art-inbox/<zip> --brief art-briefs/ART_PXX_<ชื่อ>.md`
3. อ่าน `art-inbox/REPORT.md` → ถ้ามีไฟล์ขาดหรือไฟล์เสีย ให้เขียน redo brief เฉพาะไฟล์เหล่านั้น
4. commit เฉพาะไฟล์ใน `public/assets/<pack>/` และ `src/assets/art-manifest.json` + `manifest.generated.ts` ห้าม commit zip

## 4. ทุกครั้งที่จบงานย่อย
- `npm run test` และ `npm run build` ต้องผ่าน (ถ้ารันบนคลาวด์ ให้รัน e2e ด้วย `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test`)
- commit (ข้อความภาษาอังกฤษสั้นๆ) แล้ว `git push origin claude/summon-jump` → CI จะ deploy ลิงก์เล่นให้เอง
- อัปเดต `docs/progress/PHASE_XX.md` และ `CHANGELOG.md`
- สรุปให้เจ้าของเป็น**ภาษาไทยแบบสั้นๆ**: ทำอะไรเสร็จ, ลิงก์เล่น, ต้องทดสอบอะไรบนมือถือ, ภาพชุดไหนที่ต้องสั่ง ChatGPT

## 5. สไตล์การทำงานกับเจ้าของ
- ตอบภาษาไทย กระชับ ตรงประเด็น ให้คำแนะนำแบบฟันธง
- เจ้าของทำงานจากมือถือเป็นหลัก ลิงก์เล่นต้องใช้ได้บนมือถือแนวนอน
- ประหยัดค่าใช้จ่าย: อ่านเฉพาะไฟล์ที่ต้องใช้ ใช้ grep/glob ให้เจาะจง
- ห้ามข้ามเฟส ต้องได้คำยืนยันจากเจ้าของก่อนทุกครั้ง
- คำสั่งภาพทุกไฟล์ต้องส่งให้ ChatGPT ได้ทั้งไฟล์ มีชื่อไฟล์ภาพที่แน่นอน แบ่งเป็นชุดๆ และได้ zip ต่อชุด (ใช้รูปแบบเดียวกับ `art-briefs/ART_P00_UI_Kit.md`)
