# เฟส 0 — ทำให้เล่นได้ใน Unity Editor

เป้าหมาย: กด Play แล้วเดินตีปอริงได้ ทุกข้อในนี้ตรวจกับซอร์สจริงใน repo แล้ว (ไม่ได้เดา)
อ้างอิงบรรทัดโค้ดไว้ให้ทุกจุดที่สำคัญ

---

## ⚠️ 4 จุดที่ไกด์ทั่วไปเขียนผิด — อ่านก่อน

### 1. Data Directory ต้องชี้ที่โฟลเดอร์ `data` ไม่ใช่โฟลเดอร์แม่

`RagnarokCopyFromRealClient.cs:897` เช็ค sanity ก่อนเปิดหน้าต่าง Health Check:

```csharp
if (!TestPath("prontera.gat") || !TestPath("texture/워터/water000.jpg"))
    return;
```

คือหาไฟล์ `<dataDir>/prontera.gat` และ `<dataDir>/texture/워터/water000.jpg` **ตรง ๆ**
`RagnarokMapImporterWindow.cs:46` ก็หา `.gnd` แบบเดียวกัน: `Path.Combine(dataDir, map.Code + ".gnd")`

data.grf แตกออกมาจะได้โครง `D:\ROData\data\prontera.gat` → **ต้องเลือก `D:\ROData\data`**
ถ้าเลือก `D:\ROData` หน้าต่างจะเด้งปิดเงียบ ๆ พร้อม error `Invalid client data directory: missing prontera.gat`

**กฎที่จำง่ายที่สุด:** โฟลเดอร์ที่เลือก ต้องมี `prontera.gat` วางอยู่ในนั้นตรง ๆ และมีโฟลเดอร์ `texture`, `sprite` อยู่ข้าง ๆ

### 2. ⭐ ใน Health Check ต้อง **ติ๊กออก** `Post-process: Missing Maps`

ตัวนี้เรียก `RagnarokMapImporterWindow.ImportAllMissingMaps()` (`RagnarokMapImporterWindow.cs:29`)
ซึ่ง **วนอ่าน maps.json ทั้งไฟล์แล้ว import ทุกแมพที่ยังไม่มี scene — ไม่สนใจว่าเลือกอะไรไว้ในหน้าต่าง "Select maps to import"**

ถ้าปล่อยติ๊กไว้ = import 271 แมพที่เหลือ = หลายชั่วโมง แล้วโครงการก็ตายกลางทางเหมือนเดิม
ปุ่ม `Select Missing` ในหน้าต่างนั้นจะติ๊กช่องนี้ให้อัตโนมัติ → **กด Select Missing แล้วต้องไล่ติ๊กออกเอง**

### 3. `prt_fild00` เดินไปไม่ถึง — เปลี่ยนเป็น `prt_fild07`

ทางออกของ prontera มีแค่ 3 ทุ่ง (`Script/Warps/Towns/Prontera.txt`):

| ประตู | ไปที่ |
|---|---|
| ตะวันตก (22,203) | `prt_fild05` |
| ใต้ (156,22) | `prt_fild08` |
| ตะวันออก (289,203) | `prt_fild06` |

**ไม่มี warp จาก prontera ไป prt_fild00** (prt_fild00 ต่อกับ gef_fild00 / mjolnir_07 / mjolnir_09 / prt_fild04 เท่านั้น)

ใช้ `prt_fild07` แทน — ติดกับแมพเกิดเลย เดินออกขอบตะวันตกของ prt_fild08 ที่ x≈16 ก็ถึง
(`PronteraFields.txt:49-50`) ทดสอบ warp ได้ทันทีโดยไม่ต้องเดินเข้าเมือง

### 4. `Make Minimaps` ไม่ใช่เมนู `Ragnarok/*`

เป็นปุ่มอยู่ในหน้าต่าง `Ragnarok → Lighting Manager` (`RoLightingManagerWindow.cs:866`)
เฟส 0 ข้ามทั้งคู่อยู่แล้ว แต่จำไว้ตอนเฟส 1

---

## แมพสำหรับเฟส 0 (4 แมพ)

| Code | ชื่อในลิสต์ | เหตุผล |
|---|---|---|
| `prt_fild08` | Prontera Field 8 | จุดเกิดตัวละคร (`appsettings.json`: 166, 360) |
| `prontera` | Prontera, Capital of Rune Midgard | เมืองหลัก + save point เริ่มต้น |
| `prt_in` | Prontera Indoors | ทดสอบ NPC / ร้านค้า มีทางเข้าจากเมือง 15 จุด |
| `prt_fild07` | Prontera Field 7 | ทดสอบ warp ข้ามแมพ ติดกับแมพเกิด |

มอนสเตอร์ใน `prt_fild08` (`Script/Spawns/prt_fild.txt:89`):
Poring ×100, Lunatic ×40, Pupa ×20, Drops ×10, Mastering (boss) ×1
และ **`TARGET_DUMMY` ×1 ที่พิกัด (179, 353)** — ห่างจุดเกิดไม่กี่ก้าว ใช้เทสระบบตีได้ทันที

### แนะนำเพิ่ม (ถ้าอยากเดินในเมืองได้อิสระ ไม่ต้องระวัง)

`prt_castle` (ประตูเหนือ 156,360) และ `prt_church` (237,317) — แมพ indoor เล็ก import เร็ว
ถ้าไม่ import ต้องเลี่ยง 2 จุดนี้ + ประตูตะวันตก/ตะวันออกของ prontera

---

## ลำดับขั้นตอน

### A. ฝั่ง Server (Windows)

1. เปิด `RoRebuildServer/RoRebuildServer.sln` ด้วย VS 2022 → Build Solution ให้ผ่านก่อน
2. รัน `updateclient.bat` ที่ root ของ repo

`updateclient.bat` ทำ 3 อย่าง:
- build `GameConfig` (netstandard2.0) + `RebuildSharedData` (netstandard2.1) แบบ Release
- copy DLL ทั้งสองไป `RebuildClient\Assets\Data\`
- build + รัน `DataToClientUtility.exe` → เขียน JSON ลง `RebuildClient\Assets\StreamingAssets\ClientConfigGenerated\` (`DataToClientUtility/Program.cs:35`)

สคริปต์จบด้วย `pause` → **อ่าน error ในหน้าต่างก่อนปิด** ถ้า `maps.json` ไม่ถูกสร้าง หน้าต่าง Select maps to import จะเปิดไม่ได้ (มันอ่านไฟล์นี้โดยตรง)

### B. ฝั่ง Unity

3. `Ragnarok → Set Ragnarok Data Directory` → เลือก **`D:\ROData\data`** (ดูข้อ 1 ด้านบน)
4. `Ragnarok → Select maps to import`
   → กด **Unselect All** ก่อน (หน้าต่างเปิดมาติ๊กทุกแมพที่ยังไม่ import ให้อัตโนมัติ = 275 แมพ)
   → ติ๊กเฉพาะ 4 แมพข้างบน → **Import Selected Maps**
5. `Ragnarok → Client Data Health Check`
   → กด `Run Health Check` → กด `Select Missing`
   → **ติ๊กออก `Post-process: Missing Maps`** ⚠️
   → กด `Import Selected (...)`
6. `Ragnarok → Update Addressables (Full)` — ห้ามข้าม ไม่งั้นโหลด asset ตอน runtime ไม่ได้

**ข้าม:** Lighting Manager (bake), Make Minimaps → เก็บไว้เฟส 1

### รายการที่ Health Check จะ import ให้ (ไม่ต้องรันเมนูซ้ำ)

`RagnarokCopyFromRealClient.cs:903-985` — ครอบคลุมทั้งหมดนี้อยู่แล้ว:

Sounds (WAV) · Monster Sprites · Headgear (ช/ญ) · NPC Sprites · Effect Sprites ·
Head Palettes (ช/ญ) · Character Heads (ช/ญ) · Character Bodies (ช/ญ) · UI Illustrations ·
Weapon Sprites · Shield Sprites · Miscellaneous (cursor/emotion/damage numbers) ·
Post-process: Monster Sprite Aliases · Effect Prefabs · **Skill Effect Atlas** ·
Water Textures · ~~Missing Maps~~ · **Skill and Item Icons**

→ เมนู `Import Skill and Item Icons` กับ `Import and Update Skill Effect Atlas` **ซ้ำกับ Health Check** รันเพิ่มไม่เสียหาย แต่ไม่จำเป็นถ้าติ๊กครบใน Health Check แล้ว
→ Water texture ถูก import อัตโนมัติตอน import แมพอยู่แล้ว (`ImportMap()` เรียก `ImportWater()`) ไม่ต้องกังวลเรื่องลำดับ

### C. รัน

7. VS → dropdown ข้างปุ่ม Run สีเขียว → เลือก **`RoRebuildServer`** (ห้าม IIS / IIS Express)
   server ขึ้นที่ `http://localhost:5000`, SQLite `RoCharacterDatabase.db` สร้างเอง
8. Unity → `Ragnarok → Open Main Scene` → กด Play → สร้างตัวละคร → เกิดที่ prt_fild08 (166, 360)

---

## เมื่อติดในแมพที่ไม่ได้ import — ไม่ต้องลบ DB

`appsettings.json` ตั้ง `"EnableWarpCommandForEveryone": true` ไว้แล้ว
พิมพ์ในช่องแชท (`ClientCommandHandler.cs:124`):

```
/warp prontera
/warp prt_fild08 166 360
/where            (เช็คว่าอยู่ตรงไหน)
```

ลองอันนี้ก่อนเสมอ ลบ `RoCharacterDatabase.db` เป็นทางเลือกสุดท้าย (ตัวละครหายหมด)

**หมายเหตุ:** server ไม่ crash เวลาเข้าแมพที่ไม่มี walk data — `MapWalkData.cs:317` จับ exception แล้ว fallback เป็นแมพ 1024×1024 เดินได้ทั้งหมด พร้อม log `Failed to load map walk data for file ...` ที่พังคือฝั่ง client ที่ไม่มี scene

### ประตูที่ต้องเลี่ยง (พาไปแมพที่ไม่ได้ import)

**ใน prt_fild08:**
- x≈16 (ขอบตะวันตก) → prt_fild07 ✅ ปลอดภัยถ้า import ตามลิสต์นี้
- (55,21) และ (218–238, 16) ขอบใต้ → `moc_fild01` ❌
- (371, 212) ขอบตะวันออก → `izlude` ❌

**ใน prontera:**
- ประตูตะวันตก (22,203) → `prt_fild05` ❌
- ประตูตะวันออก (289,203) → `prt_fild06` ❌
- (156,360) → `prt_castle` ❌
- (237,317) → `prt_church` ❌

---

## เช็คลิสต์

- [ ] `dotnet --version` ขึ้น 9.x
- [ ] Unity 6000.3.19f1 (+ WebGL module) — เวอร์ชั่นตรงกับ `ProjectSettings/ProjectVersion.txt`
- [ ] system locale = Korean (ไม่ติ๊ก "Beta: UTF-8")
- [ ] extract data.grf แล้วเห็น `data\sprite\인간족\몸통\남\*.spr` อ่านออก
- [ ] Build Solution ผ่าน
- [ ] `updateclient.bat` สำเร็จ → มี `Assets/StreamingAssets/ClientConfigGenerated/maps.json`
- [ ] Set Ragnarok Data Directory = โฟลเดอร์ที่มี `prontera.gat` อยู่ตรง ๆ
- [ ] Select maps to import → Unselect All → 4 แมพ → Import
- [ ] Health Check → Select Missing → **ติ๊กออก Missing Maps** → Import
- [ ] Update Addressables (Full)
- [ ] Server รันผ่าน profile `RoRebuildServer` ที่ localhost:5000
- [ ] Play → เดินได้ + ตี TARGET_DUMMY ที่ (179,353) ได้ + ตีปอริงแล้วดรอปของ ✅

---

## เรื่องที่ปกติ ไม่ต้องแก้

- warning มอนสเตอร์ ID 6000+ ไม่มี sprite — custom monster ของ Doddler ปิดอยู่ด้วย `"FeatureFlags": []` ตามเดิม
- ไม่มีเสียง BGM — mp3 ไม่ได้อยู่ใน data.grf ต้อง copy จากโฟลเดอร์ BGM ของ client เองใส่ `Assets/Music/` (ข้ามได้ในเฟส 0)
- แมพแบน ไม่มีเงา — ยังไม่ bake lighting ปกติสำหรับเฟส 0
