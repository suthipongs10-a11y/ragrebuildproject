# Eggbound บน VPS

## ทางหลัก (2026-10-15): ทำงานบน VPS โดยตรง — ไม่ต้องใช้ GitHub
บัญชี GitHub ของเจ้าของใช้ไม่ได้ จึงย้ายงานมาไว้ที่ VPS ทั้งหมด: โค้ดอยู่ที่ `/home/eggbound/ragrebuildproject` · Claude Code ทำงานในเครื่องนั้น · `publish.sh` build แล้วขึ้นเว็บทันที

1. รัน `vps-setup.sh` (nginx + ผู้ใช้ eggbound — ทำแล้ว พอร์ต 8090)
2. รันครั้งเดียวด้วย root:
   ```
   curl -fsSL https://raw.githubusercontent.com/suthipongs10-a11y/ragrebuildproject/claude/ecstatic-cray-ijhpj1/EGGBOUND/deploy/vps-dev-setup.sh | sudo bash
   ```
   (ลง Node 22 + Pillow AVIF + โค้ด + build รอบแรก + ขึ้นเว็บ + Claude Code · ~5 นาที)
3. ทำงาน: `su - eggbound` → `cd ragrebuildproject/EGGBOUND` → `claude`
4. ขึ้นเว็บ: `bash deploy/publish.sh` (เทสต์ + build + ขึ้นเว็บ) หรือ `--quick` (ข้ามเทสต์)
5. ส่งไฟล์ภาพ zip จากคอมขึ้น VPS: `scp ไฟล์.zip root@<IP>:/home/eggbound/` แล้ว `chown eggbound: /home/eggbound/ไฟล์.zip`
6. git: commit ในเครื่อง VPS ได้ตามปกติ (push GitHub ไม่ได้) → สำรองโฟลเดอร์โปรเจกต์ไว้ที่อื่นเป็นระยะ

## ทางเดิม: GitHub Actions ส่งขึ้น VPS (ต้องใช้ GitHub ได้)

ทุกครั้งที่ push โค้ดเกม GitHub Actions จะทดสอบ → build → อัปโหลดขึ้น VPS เอง (`.github/workflows/eggbound-vps.yml`)
เกมอยู่ที่ `http://<IP ของ VPS>:8080/` — แยกพอร์ตจากเซิร์ฟเวอร์ Ragnarok (`deploy/` ที่ root) ไม่ชนกัน

## ตั้งค่าครั้งเดียว (เจ้าของทำเอง ~10 นาที)

### 1. รันสคริปต์บน VPS
เปิด PowerShell บนคอม แล้วเข้า VPS (รหัสผ่าน root อยู่ในอีเมล/หน้าเว็บผู้ให้เช่า):
```
ssh root@<IP>
```
แล้ววางคำสั่งนี้ (เปลี่ยน `<IP>` เป็น IP ของ VPS):
```
curl -fsSL https://raw.githubusercontent.com/suthipongs10-a11y/ragrebuildproject/claude/ecstatic-cray-ijhpj1/EGGBOUND/deploy/vps-setup.sh | sudo bash -s <IP>
```
สคริปต์จะลง nginx เปิดพอร์ต 8080 สร้างผู้ใช้ `eggbound` และกุญแจที่ **อัปโหลดได้เฉพาะโฟลเดอร์เกม** (`/var/www/eggbound`) แล้วพิมพ์บล็อกข้อความออกมา

### 2. ใส่ secret ใน GitHub
github.com → repo **ragrebuildproject** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
- Name: `EGGBOUND_VPS`
- Secret: ก๊อปบล็อกที่สคริปต์พิมพ์ (ตั้งแต่ `url=` จนถึง `-----END OPENSSH PRIVATE KEY-----`)

⚠️ บล็อกนี้มีกุญแจลับ — วางใน GitHub เท่านั้น ห้ามส่งในแชท

### 3. สั่งอัปโหลดรอบแรก
push ครั้งถัดไป หรือ repo → **Actions** → **Eggbound VPS** → เปิดรอบล่าสุด → **Re-run all jobs** (ปุ่ม Run workflow ไม่ขึ้น เพราะ workflow อยู่บน branch งาน ไม่ใช่ default branch) · ใช้เวลา ~5–15 นาที (รอบแรกแปลงรูปนานสุด)
แล้วเปิด `http://<IP>:8080/` บนมือถือ

## ถ้าเปิดไม่ได้
- **หน้าไม่ขึ้นเลย:** ผู้ให้เช่าบางเจ้ามีไฟร์วอลล์ในหน้าเว็บ → เปิดพอร์ต TCP 8080
- **ขึ้น "เซิร์ฟเวอร์พร้อมแล้ว รอ GitHub Actions…":** ยังไม่ได้ใส่ secret หรือ workflow ยังไม่จบ/ล้ม → ดูหน้า Actions
- **workflow ขึ้น "missing a part":** วาง secret ไม่ครบ → แก้ secret แล้ววางบล็อกใหม่ทั้งก้อน (รันสคริปต์ซ้ำได้ กุญแจเดิม)
- **พอร์ต 8080 มีคนใช้:** รันใหม่ด้วย `... | sudo PORT=8090 bash -s <IP>`

## หมายเหตุ
- เป็น HTTP ธรรมดา (ยังไม่มีโดเมน/SSL) เล่นทดสอบได้ปกติ · ทำแอปบนหน้าจอ (PWA) ต้องมีโดเมน + HTTPS ก่อน
- เซฟเกมเก็บในเบราว์เซอร์แยกตามเว็บ — เซฟใน Artifact ไม่ตามมาที่ VPS
- หน้าเกมบน VPS = ไฟล์เดียวกับ Artifact + ส่วนหัว (charset/viewport) ที่ `ci-deploy.sh` เติมให้
