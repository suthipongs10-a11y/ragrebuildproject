# เฟส 3 — ขึ้น VPS ทดสอบวงปิด (~20 คน)

> อ่านคู่กับ `deploy/` คำสั่ง PowerShell พิมพ์ทีละบรรทัด (ไม่มี `&&`)

## สิ่งที่โค้ดเตรียมไว้ให้แล้ว

- `appsettings.Production.json` ถูกตั้งเป็นเซิร์ฟเวอร์เปิดจริง: `LiveServer` เปิด (ปิดประตูโกงทั้งหมดเองตอนบูต) ผูกพอร์ตแค่ `127.0.0.1:5000` ให้ nginx เป็นคนรับ 443
- **บัญชี GM `gmrebuild`** เซิร์ฟเวอร์สร้างให้เองตอนบูตครั้งแรกจากไฟล์ `RoRebuildServer/RoRebuildServer/GmAccount.local.json` (ไฟล์นี้อยู่นอก git มีรหัสผ่านอยู่ข้างใน อย่าส่งต่อ) ชื่อนี้อยู่ใน `AdminAccounts` แล้ว และถึงลืมใส่ เซิร์ฟเวอร์ก็นับชื่อในไฟล์เป็น GM ให้
- **ประตูรอบทดสอบ** แก้ตัวเลขได้ใน Production config แล้ว restart

| ค่า | ตั้งไว้ | ความหมาย |
|---|---|---|
| `MaxOnlinePlayers` | 25 | ออนไลน์พร้อมกันสูงสุด GM เข้าได้เสมอแม้เต็ม |
| `MaxAccounts` | 30 | มีบัญชีครบ 30 การสมัครปิดเอง คนที่มีบัญชีแล้วเข้าได้ปกติ |
| `AllowRegistration` | true | เปลี่ยนเป็น false เมื่ออยากปิดสมัครทันที |
| `MaxNewAccountsPerAddressPerDay` | 3 | หนึ่ง IP สมัครได้ 3 บัญชีต่อวัน |
| `MaxFailedLoginsPerAddress` | 10 | ใส่รหัสผิด 10 ครั้งใน 10 นาที IP นั้นถูกพักชั่วคราว |

- เซิร์ฟเวอร์อ่าน IP จริงของผู้เล่นจาก header ของ nginx ระบบแบน IP และตัวนับต่อ IP จึงทำงานหลัง proxy ได้
- รหัสผ่านตอนสมัครขั้นต่ำ 6 ตัวอักษร (บัญชีเก่าที่สั้นกว่ายังเข้าได้)

## สิ่งที่ต้องทำเอง (เรียงตามลำดับ)

### A. บนเครื่อง Windows

1. ดึงโค้ดล่าสุด แล้วรัน `updateclient.bat`
2. รันสคริปต์ playtest ให้ build ผ่าน แล้วลองเข้าเกมในเครื่องหนึ่งรอบ ใน log ตอนบูตต้องเห็น `[Lockdown] Created the GM account 'gmrebuild'` และ `[Gate] Online players: ...`
3. **Build ตัวเกมเป็น Web** ใน Unity — ขั้นตอนเต็มอยู่ที่ `MOBILE.md` อ่านอันนั้น อย่าเดา

   สรุปสั้น ๆ: Unity 6 ไม่มี `Build Settings` แล้ว ใช้ `File → Build Profiles` platform ชื่อ **`Web`** (ไม่ใช่ `WebGL`) ก่อนกด Build ต้อง build Addressables ก่อนทุกครั้ง และโฟลเดอร์ปลายทางต้องเป็น

   ```
   RoRebuildServer\RoRebuildServer\bin\Debug\net9.0\WebClient
   ```

   ที่เดียวกับตอนเล่นในเครื่อง — **ไม่ใช่ `RebuildClient\WebGL`** ซึ่งเป็นที่เก่า
   - ถ้ายังไม่ build ก็ขึ้น VPS ได้ แต่คนจะเล่นผ่านเบราว์เซอร์ไม่ได้ ต้องใช้ client จาก Unity/Windows ชี้ `wss://โดเมน/ws`
4. เช็คว่ามี `RebuildClient\Assets\Maps\exportdata` (walk data จากการ import แมพ)

   แมพไหนอ่านไม่ได้ เซิร์ฟเวอร์บอกตอนบูตว่า `Failed to load map walk data for file ...` แล้วแทนด้วยผืน 1024x1024 ที่**เดินไม่ได้สักช่อง** ไม่ใช่เดินได้ทั้งแมพ — ใครวาร์ปเข้าไปจะขยับไม่ได้เลย
   ถ้าแมพที่ขึ้นชื่อเป็นแมพ PvP หรือห้อง debug (`payon_p`, `pvp_n_*`, `2009rwc_*`) ปล่อยได้ ไม่มีทางเข้าถึงในเกมปกติ
5. สร้างชุดไฟล์

```powershell
powershell -ExecutionPolicy Bypass -File deploy\publish.ps1
```

   ได้ `rorebuild-server.zip` ที่ root ของ repo (GmAccount.local.json ติดไปด้วยถ้าวางไว้ที่ `RoRebuildServer\RoRebuildServer\`)

   **อ่านสิ่งที่มันพิมพ์ออกมาให้ครบก่อนอัป** บรรทัดที่ต้องเห็น:

   | บรรทัด | แปลว่า |
   |---|---|
   | `Browser build: ...\WebClient` | เจอตัวเกมแล้ว เล่นผ่านเบราว์เซอร์ได้ |
   | `dropping stale build Build_...` | ตัดตัวเกมรอบเก่าที่ไม่ได้ใช้ออกจาก zip (ปกติ ดีด้วย) |
   | `Bundle ready: ...zip` | เสร็จ |

   ถ้าขึ้น `WARNING: No browser build found` **อย่าเพิ่งอัป** — build ยังไม่ได้ลงที่ที่ควรอยู่ กลับไปข้อ 3

### B. บน VPS (Ubuntu 22.04 / 24.04, RAM 2 GB ขึ้นไป)

> **ยังไม่จดโดเมนก็ทดสอบได้** ใส่ IP ของ VPS แทนชื่อโดเมนในข้อ 3 แล้ว**ข้ามข้อ 5 (certbot)** ไป
> เปิดเล่นที่ `http://IP/` ตัว client อ่าน address จากหน้าเว็บที่มันถูกโหลดมา จึงต่อ `ws://IP/ws` ให้เอง ไม่ต้องตั้งอะไร
> ข้อเสียคือไม่มี SSL — รหัสผ่านวิ่งแบบไม่เข้ารหัส ใช้ได้เฉพาะรอบทดสอบกับคนรู้จัก อย่าใช้รหัสผ่านซ้ำกับที่อื่น
> พอจดโดเมนแล้วค่อยรัน `vps-setup.sh` ซ้ำด้วยชื่อโดเมน แล้วรัน certbot

1. ชี้ DNS ของโดเมนมาที่ IP ของ VPS ก่อน รอจน `ping โดเมน` ได้ IP ถูก (ข้ามได้ถ้ายังไม่จด)
2. คัดลอก `deploy/` และ `rorebuild-server.zip` ขึ้นไป เช่น `scp -r deploy rorebuild-server.zip root@IP:/root/`
3. ตั้งค่าครั้งแรก

```bash
cd /root/deploy
bash vps-setup.sh play.example.com
```

4. แตกไฟล์เซิร์ฟเวอร์แล้วเริ่ม

```bash
bash /root/deploy/install-bundle.sh
journalctl -u rorebuild -n 60 --no-pager
```

   ⛔ **อย่า `unzip` เองด้วยมือ** — `Compress-Archive` ของ Windows ไม่เก็บสิทธิ์แบบ unix ลงใน zip ไฟล์ `.so` จะแตกออกมาโดยไม่มี execute bit แล้วเซิร์ฟเวอร์จะตายตอนเรียกฐานข้อมูลครั้งแรกด้วย `Unable to load shared library 'e_sqlite3'` ทั้งที่ไฟล์อยู่ตรงนั้นครบ สคริปต์นี้ `chmod` ให้

   ต้องเห็น `[Lockdown] LiveServer is on`, `[Lockdown] Created the GM account 'gmrebuild'` (เฉพาะครั้งแรก), `[Gate] Online players: 25 ...` และ `Server started`

5. เปิด SSL

```bash
certbot --nginx -d play.example.com
```

6. เปิด `https://play.example.com` หน้าเกมต้องขึ้น ล็อกอิน `gmrebuild` ก่อนใคร แล้วลอง `!who`

### C. อัปเดตรอบถัดไป

อัป zip ตัวใหม่ขึ้นไปทับ แล้วคำสั่งเดียวจบ:

```bash
bash /root/deploy/install-bundle.sh
```

มันหยุด service, แตกไฟล์ทับ, ตั้ง owner กับสิทธิ์, สตาร์ตใหม่ แล้วบอกว่าขึ้นหรือไม่ขึ้น (ถ้าไม่ขึ้นมันพิมพ์ท้าย log ให้เลย)

`RoCharacterDatabase.db`, `Keys/`, `Cache/` ไม่อยู่ใน zip จึงไม่ถูกทับ ถ้าเปลี่ยน `::ServerVersion` ใน `ServerData/Config/ServerClientConfig.txt` ทุกคนต้องรีเฟรชหน้าเว็บแบบล้างแคช (Ctrl+F5)

## ระหว่างทดสอบ

- คำสั่ง GM ในแชท: `!who`, `!kick ชื่อ`, `!ban ชื่อ เหตุผล`, `!banip`, `!bans`, `!alt ชื่อ` และ `!ench*` สำหรับทดสอบคัมภีร์
- ปิดรับสมัครทันที: แก้ `AllowRegistration` เป็น `false` ใน `/opt/rorebuild/server/appsettings.Production.json` แล้ว `systemctl restart rorebuild`
- ดู log: `journalctl -u rorebuild -n 200` หรือไฟล์ใน `/opt/rorebuild/server/Logs/`
- สำรองข้อมูลอัตโนมัติทุก 6 ชั่วโมงที่ `/opt/rorebuild/backup/` สั่งเองได้ด้วย `/opt/rorebuild/backup.sh`
- กู้ฐานข้อมูล: หยุด service, `gunzip -c ไฟล์.gz > /opt/rorebuild/server/RoCharacterDatabase.db`, chown, start

## ยังไม่ครอบคลุม (ไว้รอบเปิดสาธารณะ)

- แมพมีเท่าที่ import ในเฟส 1 คนทดสอบเดินออกนอกแมพเหล่านั้นไม่ได้
- ไม่มีรหัสเชิญ ใครรู้โดเมนก็สมัครได้จนครบ 30 บัญชี ถ้าอยากจำกัดเฉพาะคนรู้จัก ตั้ง `AllowRegistration` เป็น false หลังทุกคนสมัครแล้ว
- ไม่มีกันแชทรัว นอกจากจำกัด 140 ตัวอักษร
