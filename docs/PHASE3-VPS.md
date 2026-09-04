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
3. **Build WebGL** ใน Unity: File → Build Settings → WebGL → Build ไปที่โฟลเดอร์ `RebuildClient\WebGL` (ต้องมี `index.html` ในนั้น) ใช้ template `Ragnarok` เปิด Compression Brotli หรือ Gzip ได้ เซิร์ฟเวอร์ใส่ header ให้เอง
   - ถ้ายังไม่ build ก็ขึ้น VPS ได้ แต่คนจะเล่นผ่านเบราว์เซอร์ไม่ได้ ต้องใช้ client จาก Unity/Windows ชี้ `wss://โดเมน/ws`
4. เช็คว่ามี `RebuildClient\Assets\Maps\exportdata` (walk data จากการ import แมพ) แมพไหนไม่มี เซิร์ฟเวอร์จะถือว่าเดินได้ทั้งแมพ
5. สร้างชุดไฟล์

```powershell
powershell -ExecutionPolicy Bypass -File deploy\publish.ps1
```

   ได้ `rorebuild-server.zip` ที่ root ของ repo (GmAccount.local.json ติดไปด้วยถ้าวางไว้ที่ `RoRebuildServer\RoRebuildServer\`)

### B. บน VPS (Ubuntu 22.04 / 24.04, RAM 2 GB ขึ้นไป)

1. ชี้ DNS ของโดเมนมาที่ IP ของ VPS ก่อน รอจน `ping โดเมน` ได้ IP ถูก
2. คัดลอก `deploy/` และ `rorebuild-server.zip` ขึ้นไป เช่น `scp -r deploy rorebuild-server.zip root@IP:/root/`
3. ตั้งค่าครั้งแรก

```bash
cd /root/deploy
bash vps-setup.sh play.example.com
```

4. แตกไฟล์เซิร์ฟเวอร์แล้วเริ่ม

```bash
unzip -o /root/rorebuild-server.zip -d /opt/rorebuild/server
chown -R rorebuild:rorebuild /opt/rorebuild
systemctl start rorebuild
journalctl -u rorebuild -f
```

   ต้องเห็น `[Lockdown] LiveServer is on`, `[Lockdown] Created the GM account 'gmrebuild'` (เฉพาะครั้งแรก), `[Gate] Online players: 25 ...` และ `Server started`

5. เปิด SSL

```bash
certbot --nginx -d play.example.com
```

6. เปิด `https://play.example.com` หน้าเกมต้องขึ้น ล็อกอิน `gmrebuild` ก่อนใคร แล้วลอง `!who`

### C. อัปเดตรอบถัดไป

```bash
systemctl stop rorebuild
unzip -o /root/rorebuild-server.zip -d /opt/rorebuild/server
chown -R rorebuild:rorebuild /opt/rorebuild
systemctl start rorebuild
```

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
