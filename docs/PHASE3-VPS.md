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

   ได้ `rorebuild-server.tar` ที่ root ของ repo (GmAccount.local.json ติดไปด้วยถ้าวางไว้ที่ `RoRebuildServer\RoRebuildServer\`)

   **อ่านสิ่งที่มันพิมพ์ออกมาให้ครบก่อนอัป** บรรทัดที่ต้องเห็น:

   | บรรทัด | แปลว่า |
   |---|---|
   | `Browser build: ...\WebClient` | เจอตัวเกมแล้ว เล่นผ่านเบราว์เซอร์ได้ |
   | `dropping stale build Build_...` | ตัดตัวเกมรอบเก่าที่ไม่ได้ใช้ออกจาก zip (ปกติ ดีด้วย) |
   | `tar.exe failed with exit code ...` ตามด้วย `Packing with the .NET tar writer instead` | tar ของ Windows crash (เคยเกิดรหัส -1073741819) สคริปต์สลับไปใช้ตัวมัดไฟล์สำรองใน `deploy/bundler` เอง ปกติ รอจนขึ้นว่า `Done.` |
| `Bundle ready: ...zip` | เสร็จ |

   ถ้าขึ้น `WARNING: No browser build found` **อย่าเพิ่งอัป** — build ยังไม่ได้ลงที่ที่ควรอยู่ กลับไปข้อ 3

### B. บน VPS (Ubuntu 22.04 / 24.04, RAM 2 GB ขึ้นไป)

> **ยังไม่จดโดเมนก็ทดสอบได้** ใส่ IP ของ VPS แทนชื่อโดเมนในข้อ 3 แล้ว**ข้ามข้อ 5 (certbot)** ไป
> เปิดเล่นที่ `http://IP/` ตัว client อ่าน address จากหน้าเว็บที่มันถูกโหลดมา จึงต่อ `ws://IP/ws` ให้เอง ไม่ต้องตั้งอะไร
> ข้อเสียคือไม่มี SSL — รหัสผ่านวิ่งแบบไม่เข้ารหัส ใช้ได้เฉพาะรอบทดสอบกับคนรู้จัก อย่าใช้รหัสผ่านซ้ำกับที่อื่น
> พอจดโดเมนแล้วค่อยรัน `vps-setup.sh` ซ้ำด้วยชื่อโดเมน แล้วรัน certbot

1. ชี้ DNS ของโดเมนมาที่ IP ของ VPS ก่อน รอจน `ping โดเมน` ได้ IP ถูก (ข้ามได้ถ้ายังไม่จด)
2. คัดลอก `deploy/` และ `rorebuild-server.tar` ขึ้นไป เช่น `scp -r deploy rorebuild-server.tar root@IP:/root/`
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

   ⛔ **อย่า `unzip` เองด้วยมือ** — สคริปต์นี้ `chmod` ไฟล์ `.so` ให้ (ไม่งั้นเซิร์ฟเวอร์ตายตอนเรียกฐานข้อมูลด้วย `Unable to load shared library 'e_sqlite3'` ทั้งที่ไฟล์ครบ)

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

### D. แพตช์เฉพาะโค้ดเซิร์ฟเวอร์ (ไม่ต้อง build Web ใหม่)

ใช้เมื่อแก้แค่ C# ฝั่งเซิร์ฟเวอร์ เช่นเพิ่มคำสั่ง GM ไม่ต้องมัดไฟล์ 2 GB ใหม่ เพราะโค้ดเซิร์ฟเวอร์อยู่ใน DLL ไม่กี่ไฟล์
บนเครื่อง Windows ที่ build (เปลี่ยน `IP` เป็น IP ของ VPS):

```powershell
cd RoRebuildServer\RoRebuildServer
dotnet publish RoRebuildServer.csproj -c Release -o bin\publish
scp bin\publish\RoRebuildServer.dll bin\publish\RebuildSharedData.dll root@IP:/opt/rorebuild/server/
```

แล้วบน VPS:

```bash
chown rorebuild:rorebuild /opt/rorebuild/server/RoRebuildServer.dll /opt/rorebuild/server/RebuildSharedData.dll
systemctl restart rorebuild
sleep 60
systemctl is-active rorebuild
journalctl -u rorebuild --since "1 minute ago" --no-pager | grep -E "scripts loaded|Server started|Exception"
```

ส่งสองไฟล์คู่กันเสมอ (โค้ดเซิร์ฟเวอร์กับไลบรารีที่ใช้ร่วมกับ client) ให้เวอร์ชันตรงกัน
ถ้าเปลี่ยนอะไรที่ client ต้องเห็นด้วย (เมนู หน้าต่าง) ต้อง build Web ใหม่แล้วใช้วิธี C แทน

### E. รีเซ็ตเซิร์ฟ: เก็บไอดี ลบตัวละครและของทั้งหมด

ใช้สคริปต์ `tools/admin/resetworld.py` (ต้องมี python3 ซึ่ง VPS มีอยู่แล้ว) มันทำทุกอย่างในคราวเดียวและสำรองให้ก่อนลบ

**เก็บ:** บัญชีล็อกอินทั้งหมด (รหัสผ่านเดิม, GM ยังเป็น GM เพราะดูจากชื่อบัญชี), รายการแบน, ประวัติไอพี
**ลบ:** ตัวละครทุกตัว (ของในกระเป๋า ของที่สวม สกิล เซนี่ ธงเควส สมุดผจญภัย Boss Log อยู่ในแถวตัวละครเองจึงหายไปด้วย), คลัง Kafra และเงินในคลัง, พัสดุ, ประมูล, ใบสั่งซื้อ, บันทึกคนตีอาวุธ/ออปชั่น enchant, เพื่อน, ปาร์ตี้, กิลด์ และความคืบหน้าของทั้งเซิร์ฟ (`ScriptGlobals`)

ข้อควรรู้เรื่อง `ScriptGlobals` (ข้อมูลของกระดานหมุดหมายที่ป้ายหน้าค่าย): เก็บ 10 อันดับเลเวลสูงสุด, คนแรกที่ถึงแต่ละเลเวล, คนแรกที่ล้มมินิบอส/MVP แต่ละตัว (เป็นชื่อตัวละคร) และธงว่า Okolnir เคยถูกเคลียร์ ล้างแล้วกระดานว่างและรางวัล "คนแรก" (EXP กับของ) แจกได้อีกรอบ ส่วน Kafra ร้านค้า Valkyrie และ NPC อื่นในค่ายไม่ผูกกับตรงนี้ (เซิร์ฟนี้ตั้งให้อยู่ตั้งแต่เปิดเครื่อง ดูหัวข้อ `EventRevealedNpc` ใน `Script/Event/MilestoneEvent.txt`) จึงอยู่ครบเหมือนเดิม ถ้าไม่อยากล้าง ใส่ `--keep-globals` แต่กระดานจะยังโชว์ชื่อตัวละครที่ถูกลบแล้ว และรางวัลคนแรกจะเป็นของคนเก่าตลอดไป

ขั้นตอน (เปลี่ยน `IP` เป็น IP ของ VPS) บนเครื่อง Windows ที่เปิด repo อยู่:

```powershell
scp tools\admin\resetworld.py root@IP:/root/
```

แล้วบน VPS ดูก่อนว่าจะลบอะไร (ยังไม่ลบ ทำตอนเซิร์ฟเวอร์เปิดอยู่ได้):

```bash
python3 /root/resetworld.py /opt/rorebuild/server/RoCharacterDatabase.db
```

ถ้าตรงที่ต้องการ หยุดเซิร์ฟเวอร์แล้วรันจริง:

```bash
systemctl stop rorebuild
python3 /root/resetworld.py /opt/rorebuild/server/RoCharacterDatabase.db --apply
```

มันปฏิเสธเองถ้า service ยังรันอยู่ จะสำรองไฟล์เป็น `/opt/rorebuild/backup/BeforeReset-RoCharacterDatabase-เวลา.db.gz` (ชื่อนี้ cron ล้างไฟล์เก่า 14 วันไม่ลบทิ้ง) ตรวจไฟล์สำรองก่อนค่อยลบ และถ้าตัวเลขหลังลบไม่ตรงที่ควร มันยกเลิกทั้งหมดให้ ลบเสร็จเปิดเซิร์ฟเวอร์:

```bash
systemctl start rorebuild
sleep 60
systemctl is-active rorebuild
journalctl -u rorebuild --since "1 minute ago" --no-pager | grep -E "scripts loaded|Server started|Exception"
```

ผู้เล่นล็อกอินด้วยไอดีเดิมได้ทันที ไม่เจอตัวละครสักตัว สร้างใหม่ได้ (ชื่อเดิมใช้ซ้ำได้เพราะตัวละครถูกลบแล้ว)
ย้อนกลับ: ขั้นตอนเดียวกับกู้ฐานข้อมูลด้านล่าง โดยใช้ไฟล์ `BeforeReset-...` สคริปต์พิมพ์คำสั่งกู้ให้ท้ายผลลัพธ์
ธง `--wipe-bans` กับ `--wipe-addresses` ล้างรายการแบนกับประวัติไอพีด้วย (ปกติเก็บไว้ การรีเซ็ตไม่ใช่การอภัยโทษ)

### F. แพตช์เฉพาะสคริปต์และข้อมูลเกม (ServerData)

ใช้เมื่อแก้แค่ไฟล์ใน `RoRebuildServer/GameConfig/ServerData/` เช่น NPC เรทดรอป ไฟล์ csv ไม่ต้อง build Web ใหม่
หน้า DB มอนกับรายชื่อ NPC ในเกมเป็นข้อมูลที่ฝังตอน build จึงโชว์ตัวเลขเก่าจนกว่าจะ build ใหม่ ส่วนเว็บไกด์ถูกต้องเสมอถ้ารัน `tools/webdata/export.py` แล้ว

1. หยุด service ก่อน (`systemctl stop rorebuild`) แล้วค่อยแก้ไฟล์ และเปิดครั้งเดียวหลังไฟล์ครบ ถ้าเปิดตอนไฟล์ใหม่ปนไฟล์เก่า เซิร์ฟเวอร์อาจไม่ขึ้น (log ขึ้น `Npc ... is selling ...`) แล้ว systemd เปิดซ้ำวนไปเรื่อย ๆ
2. ส่งไฟล์ที่แก้ด้วย `scp` ทีละไฟล์ไปที่เดียวกันใต้ `/opt/rorebuild/server/ServerData/` (PowerShell พิมพ์ทีละบรรทัด)
3. ไฟล์ที่ถูก**ลบ**ใน repo `scp` ไม่ลบให้ ต้อง `rm` บน VPS เอง ถ้าลืม NPC เก่ายังอยู่
4. เรท EXP ไม่ได้อยู่ใน ServerData แต่อยู่ใน `appsettings.json` แก้บน VPS ด้วย `sed -i 's/"ExpRate": 200,/"ExpRate": 250,/' /opt/rorebuild/server/appsettings.json` (ใส่เลขเดิมและเลขใหม่ให้ตรงของจริง) แล้ว `grep -n '"ExpRate"' /opt/rorebuild/server/appsettings*.json` ดูว่าไม่มีไฟล์อื่นตั้งทับ
5. `systemctl start rorebuild` รอ 60 วินาที แล้ว `journalctl -u rorebuild --since "1 minute ago" --no-pager | grep -E "Experience rate|scripts loaded|Server started|Exception"` ต้องเห็นบรรทัด `Experience rate: ...%` กับ `Server started.`
6. ก่อน build Web รอบถัดไป รัน `updateclient.bat` ที่ root ของ repo

## ระหว่างทดสอบ

- คำสั่ง GM ในแชท: `!who`, `!kick ชื่อ`, `!ban ชื่อ เหตุผล`, `!banip`, `!bans`, `!alt ชื่อ`, `!equip ชื่อ` (ดูของที่ตัวละครที่ออนไลน์ใส่อยู่ ทั้งรีไฟน์ การ์ด ออพ หรือคลิกขวาที่ตัวละครหลัง build Web ใหม่) และ `!ench*` สำหรับทดสอบคัมภีร์
- ปิดรับสมัครทันที: แก้ `AllowRegistration` เป็น `false` ใน `/opt/rorebuild/server/appsettings.Production.json` แล้ว `systemctl restart rorebuild`
- ดู log: `journalctl -u rorebuild -n 200` หรือไฟล์ใน `/opt/rorebuild/server/Logs/`
- สำรองข้อมูลอัตโนมัติทุก 6 ชั่วโมงที่ `/opt/rorebuild/backup/` สั่งเองได้ด้วย `/opt/rorebuild/backup.sh`
- กู้ฐานข้อมูล: หยุด service, `gunzip -c ไฟล์.gz > /opt/rorebuild/server/RoCharacterDatabase.db`, chown, start

## ยังไม่ครอบคลุม (ไว้รอบเปิดสาธารณะ)

- แมพมีเท่าที่ import ในเฟส 1 คนทดสอบเดินออกนอกแมพเหล่านั้นไม่ได้
- ไม่มีรหัสเชิญ ใครรู้โดเมนก็สมัครได้จนครบ 30 บัญชี ถ้าอยากจำกัดเฉพาะคนรู้จัก ตั้ง `AllowRegistration` เป็น false หลังทุกคนสมัครแล้ว
- ไม่มีกันแชทรัว นอกจากจำกัด 140 ตัวอักษร
