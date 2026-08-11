# เฟส 0 — ทำให้เล่นได้ใน Unity Editor

เป้าหมาย: กด Play แล้วเดินตีปอริงได้ ทุกข้อในนี้ตรวจกับซอร์สจริงใน repo แล้ว (ไม่ได้เดา)
อ้างอิงบรรทัดโค้ดไว้ให้ทุกจุดที่สำคัญ

---

## data.grf ต้องเอามาจากไหน

repo นี้ไม่มี asset ของ RO เลย (README ต้นทางระบุไว้) ต้องหา `data.grf` จาก client RO ตัวจริงเอง
**ต้องการแค่ไฟล์ `data.grf` ไฟล์เดียว** — ไม่ต้องสมัคร ไม่ต้องเล่น ไม่ต้อง login

### ต้องใช้ client ยุคไหน

ดูจากข้อมูลใน repo:

| ตรวจจาก | ผลลัพธ์ |
|---|---|
| `Db/Jobs.csv` | สูงสุดคือ Ninja / Gunslinger / Taekwon / Soul Linker / Star Gladiator (id 21-25) — **ไม่มีอาชีพ 3 ไม่มี Doram ไม่มี Rebellion** |
| `Db/Maps.csv` | 275 แมพ **ไม่มีแมพยุค renewal สักแมพ** (ra_, ve_, dic_, mora, malaya, eclage = 0) |

→ ต้องการ sprite แค่ยุค **Episode 12 ลงมา** client ตัวไหนก็ได้ที่ใหม่กว่าปี 2007
client ยุคใหม่มีของเก่าครบอยู่แล้ว (GRF เพิ่มของ ไม่ได้ลบของเก่าทิ้ง) → ใช้ตัวที่หาง่ายที่สุดได้เลย

### ⛔ ตัวที่ใช้ไม่ได้

- **Ragnarok V: Returns** — เกม 3D คนละเกม ไม่มีโครงสร้าง GRF แบบนี้
- **Ragnarok M / Ragnarok Origin / RO Landverse** — เกมมือถือ คนละ engine
- ต้องเป็น **Ragnarok Online ตัว client PC คลาสสิก 2D** เท่านั้น

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

data.grf แตกออกมาจะได้โครง `C:\ROData\data\prontera.gat` → **ต้องเลือก `C:\ROData\data`**
ถ้าเลือก `C:\ROData` หน้าต่างจะเด้งปิดเงียบ ๆ พร้อม error `Invalid client data directory: missing prontera.gat`

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

**ไม่ต้องมี Visual Studio 2022** — csproj เป็น SDK-style ธรรมดา (`Microsoft.NET.Sdk.Web` / `Microsoft.NET.Sdk`)
ไม่มี WPF/WinForms → `dotnet` CLI + VS Code build และรันได้ครบ

1. build ให้ผ่านก่อน:
   ```bat
   cd RoRebuildServer
   dotnet build RoRebuildServer.sln
   ```
2. รัน `updateclient.bat` ที่ root ของ repo

`updateclient.bat` ทำ 3 อย่าง:
- build `GameConfig` (netstandard2.0) + `RebuildSharedData` (netstandard2.1) แบบ Release
- copy DLL ทั้งสองไป `RebuildClient\Assets\Data\`
- build + รัน `DataToClientUtility.exe` → เขียน JSON ลง `RebuildClient\Assets\StreamingAssets\ClientConfigGenerated\` (`DataToClientUtility/Program.cs:35`)

สคริปต์จบด้วย `pause` → **อ่าน error ในหน้าต่างก่อนปิด** ถ้า `maps.json` ไม่ถูกสร้าง หน้าต่าง Select maps to import จะเปิดไม่ได้ (มันอ่านไฟล์นี้โดยตรง)

### B. ฝั่ง Unity

**⛔ ต้องอยู่ในสาย 6000.3 เท่านั้น — ห้ามกดตัวที่ Hub เชียร์ในหน้าแรก**

`ProjectSettings/ProjectVersion.txt` = `6000.3.19f1` แต่ patch ในสายเดียวกันใช้แทนกันได้
ตอนนี้ Unity Hub แท็บ Official releases มี **Unity 6.3 LTS (6000.3.21f1)** ให้เลย — ใช้ตัวนี้
(ไม่ต้องไปแท็บ Archive) จะขึ้นกล่องเตือนว่า editor คนละเวอร์ชั่นตอนเปิดครั้งแรก กดยืนยันได้

| ตัวเลือกใน Hub | ตัดสิน |
|---|---|
| Unity 6.5 (6000.5.x) | ❌ คนละสาย URP โดนบังคับอัป |
| **Unity 6.3 LTS (6000.3.21f1)** | ✅ สายเดียวกัน + LTS |
| Unity 6.0 (6000.0.x) | ❌ ต่ำกว่าขั้นต่ำ เปิดโปรเจกต์ไม่ได้ |


`Packages/manifest.json` pin ไว้ว่า:

```json
"com.unity.render-pipelines.universal": "17.3.0",
"com.unity.shadergraph": "17.3.0",
```

URP 17.3 ผูกกับ editor สาย 6000.3 ถ้าเปิดด้วย 6.5 (6000.5.x) Unity จะบังคับอัป URP
เป็นเวอร์ชั่นของตัวเอง → shader ทั้งโปรเจกต์โดน migrate (โปรเจกต์นี้มี custom shader เยอะ)
README เขียน "6000.3.19f1 or higher" ก็จริง แต่เฟส 0 เอา "รันได้" ไว้ก่อน

**วิธีลง:** Unity Hub → Installs → Install Editor → แท็บ **Archive** → เปิด download archive
→ หา `6000.3.19f1` → Install with Unity Hub

**ติ๊กออกให้หมดเพื่อประหยัดที่:** Visual Studio (ใช้ VS Code แทน), WebGL (เฟส 2 ค่อยเพิ่ม),
Documentation, Language packs, Android / iOS / Mac / Linux Build Support

3. `Ragnarok → Set Ragnarok Data Directory` → เลือก **`C:\ROData\data`** (ดูข้อ 1 ด้านบน)
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

7. รัน server:
   ```bat
   dotnet dev-certs https --trust      :: ครั้งเดียวพอ
   cd RoRebuildServer\RoRebuildServer
   dotnet run --launch-profile RoRebuildServer
   ```
   server ขึ้นที่ `http://localhost:5000`, SQLite `RoCharacterDatabase.db` สร้างเอง
   client ต่อที่ `ws://127.0.0.1:5000/ws` (`NetworkManager.cs:191`)

   **⛔ ห้ามใช้ `--no-launch-profile`** — `ASPNETCORE_ENVIRONMENT` จะกลายเป็น Production
   แล้วโหลด `appsettings.Production.json` ทับ ซึ่งตั้ง `DataPath: "./ServerData/"` และ
   `WalkPathData: "./walkdata/"` (path สำหรับเครื่อง deploy ไม่ใช่ local) + bind https ที่ port 443

   **ทำไมถึงไม่ติดกับดัก IIS:** `launchSettings.json` มี 2 profile — `IIS Express`
   (`commandName: "IISExpress"`) กับ `RoRebuildServer` (`commandName: "Project"`)
   `dotnet run` ใช้ได้เฉพาะแบบ `Project` เท่านั้น → รันผ่าน CLI ยังไงก็ไม่โดน IIS
   ข้อห้าม 1.3 ใน CLAUDE.md จะมีผลก็ต่อเมื่อกดปุ่ม Run ใน Visual Studio

   **ทำไมต้อง `dev-certs`:** profile `RoRebuildServer` ตั้ง
   `applicationUrl: "https://localhost:5001;http://localhost:5000"` → Kestrel ต้อง bind
   https ได้ด้วยถึงจะ start ถ้าไม่มี dev cert จะขึ้น `Unable to configure HTTPS endpoint`
   (ตัวเกมใช้แค่ port 5000)
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
- [ ] Unity **6000.3.19f1 เป๊ะ** (ลงผ่าน Archive) — ไม่ต้องเอา WebGL module ในเฟส 0
- [ ] system locale = Korean (ไม่ติ๊ก "Beta: UTF-8")
- [ ] extract data.grf แล้วเห็น `data\sprite\인간족\몸통\남\*.spr` อ่านออก
- [ ] `dotnet build RoRebuildServer.sln` ผ่าน
- [ ] `updateclient.bat` สำเร็จ → มี `Assets/StreamingAssets/ClientConfigGenerated/maps.json`
- [ ] Set Ragnarok Data Directory = โฟลเดอร์ที่มี `prontera.gat` อยู่ตรง ๆ
- [ ] Select maps to import → Unselect All → 4 แมพ → Import
- [ ] Health Check → Select Missing → **ติ๊กออก Missing Maps** → Import
- [ ] Update Addressables (Full)
- [ ] `dotnet run --launch-profile RoRebuildServer` ขึ้นที่ localhost:5000
- [ ] Play → เดินได้ + ตี TARGET_DUMMY ที่ (179,353) ได้ + ตีปอริงแล้วดรอปของ ✅

---

## เรื่องที่ปกติ ไม่ต้องแก้

- warning มอนสเตอร์ ID 6000+ ไม่มี sprite — custom monster ของ Doddler ปิดอยู่ด้วย `"FeatureFlags": []` ตามเดิม
- ไม่มีเสียง BGM — mp3 ไม่ได้อยู่ใน data.grf ต้อง copy จากโฟลเดอร์ BGM ของ client เองใส่ `Assets/Music/` (ข้ามได้ในเฟส 0)
- แมพแบน ไม่มีเงา — ยังไม่ bake lighting ปกติสำหรับเฟส 0
