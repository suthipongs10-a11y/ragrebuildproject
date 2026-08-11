# CLAUDE.md — RagnarokRebuildTcp (โปรเจกต์ส่วนตัว)

> ไฟล์นี้คือกติกาการทำงานของ Claude Code ในโปรเจกต์นี้
> **อ่านทั้งไฟล์ก่อนลงมือทุกครั้ง** ห้ามข้ามส่วน "ข้อห้ามเด็ดขาด"

---

## 0. บริบทโปรเจกต์

- Fork/clone จาก `github.com/Doddler/RagnarokRebuildTcp`
- เป็น Ragnarok Online ที่เขียนใหม่ทั้ง client และ server ด้วย C# — **ไม่ใช่ rAthena ไม่ใช่ Hercules** อย่าเอา knowledge ของ rAthena มาใช้
- Client = Unity, Server = ASP.NET Core, สื่อสารกันด้วย **WebSocket**
- เป้าหมายปลายทาง: build เป็น **WebGL** ให้เล่นบนเบราว์เซอร์มือถือได้ + PWA
- เป้าหมายเนื้อหา: ปรับให้ใกล้ **Episode 4 (pre-renewal)**
- ทำเล่นสนุก ไม่ใช่เชิงพาณิชย์

### ภาษา
- **ตอบเป็นภาษาไทยเสมอ** กระชับ ตรงประเด็น ไม่ต้องเกริ่น
- comment ในโค้ดเขียนภาษาอังกฤษ (ให้เข้ากับ codebase เดิม)

---

## 1. ⛔ ข้อห้ามเด็ดขาด

อ่านให้ครบก่อนแก้อะไรก็ตาม ละเมิดข้อไหนก็ตาม = โปรเจกต์พังแบบไล่หาสาเหตุยาก

### 1.1 ห้ามตัด `Maps.csv` หรือ `Instances.csv`
README ต้นทางแนะนำให้ตัดเพื่อลดเวลา import — **เราไม่ทำ**
เพราะ script ใน `ServerData/Script/Warps/` และ `Spawns/` อ้างถึงชื่อแมพ ถ้าแถวหายจะ error ลามเป็นทอด ๆ แล้วหาต้นตอไม่เจอ

**วิธีที่ถูก:** ลดจำนวนแมพผ่านเมนู Unity `Ragnarok → Select maps to import` แทน (ผู้ใช้ทำเอง)

### 1.2 ห้ามลืมรัน `updateclient.bat` หลังแก้ CSV
ทุกครั้งที่แก้ไฟล์ใน `RoRebuildServer/GameConfig/ServerData/` **ต้องรัน `updateclient.bat` ที่ root**
ไม่งั้น client กับ server จะข้อมูลไม่ตรงกัน → บั๊กประหลาดที่ไล่ไม่เจอ

### 1.3 ห้ามรัน server ผ่าน IIS / IIS Express
ต้องเลือก run profile **`RoRebuildServer`** เท่านั้น ไม่งั้น WebSocket ทำงานผิด

### 1.4 ห้ามแตะไฟล์ asset ที่ gitignore ไว้
`RebuildClient/Assets/Sprites/`, `Maps/`, `Sounds/`, `Music/`, `Plugins/`
มาจากการ extract `data.grf` — ห้ามสร้าง ห้ามลบ ห้าม commit

### 1.5 ห้ามเปิด feature flag `DoddlerCustomMonsters`
มอนสเตอร์ ID 6000+ ไม่มี sprite เปิดแล้วกลายเป็น Poring หมด ปล่อย `"FeatureFlags": []` ไว้ตามเดิม

### 1.6 ห้ามข้าม milestone gate (ดูข้อ 5)
ห้ามเริ่มงานเฟสถัดไปจนกว่าเฟสปัจจุบันจะผ่านการยืนยันด้วยตาจากผู้ใช้

### 1.7 ห้ามนั่งเฝ้า process ที่ใช้เวลานาน
`Client Data Health Check`, lighting bake, WebGL build ใช้เวลาเป็นชั่วโมง
**ห้าม poll รอ** — บอกผู้ใช้ให้ไปรัน แล้วจบ turn กลับมาทำงานต่อเมื่อผู้ใช้แจ้งว่าเสร็จ

---

## 2. โครงสร้าง repo

```
RagnarokRebuildTcp/
├── updateclient.bat              ← sync server data → client (สำคัญมาก)
├── RebuildClient/                ← Unity project
│   └── Assets/
│       ├── Scripts/
│       │   ├── UI/               ← uGUI ทั้งหมด (ดูข้อ 6)
│       │   ├── Network/          ← WebSocket ฝั่ง client
│       │   ├── PlayerControl/    ← input + การเดิน
│       │   ├── Sprites/  Effects/  Rendering/  Objects/
│       │   ├── MapEditor/  ObjectEditor/
│       │   ├── Editor/           ← เมนู Ragnarok/* ใน Unity
│       │   └── Data/             ← DLL ที่ updateclient.bat ก๊อปมา
│       ├── WebGLTemplates/Ragnarok/   ← template สำหรับ build WebGL
│       ├── Sprites/ Maps/ Sounds/ Music/   ← ⛔ gitignored, มาจาก GRF
│       └── ...
└── RoRebuildServer/
    ├── RoRebuildServer.sln       ← เปิดด้วย VS 2022
    ├── RoRebuildServer/          ← server หลัก (net9.0)
    │   └── appsettings.json      ← config (ดูข้อ 4)
    ├── GameConfig/
    │   └── ServerData/
    │       ├── Db/               ← CSV 34 ไฟล์ (ดูข้อ 3)
    │       ├── Script/           ← Config Event Items MonsterSkills Npcs Spawns Warps
    │       └── ...
    ├── GameConfig.Generator/     ← source generator
    ├── RebuildSharedData/        ← โค้ดที่ client+server ใช้ร่วม (netstandard2.1)
    ├── RoServerScript/           ← ภาษา script ของ NPC
    └── DataToClientUtility/      ← export JSON ให้ client
```

### Target framework
| Project | Target |
|---|---|
| RoRebuildServer | `net9.0` |
| DataToClientUtility | `net9.0` |
| RebuildSharedData | `net8.0` + `netstandard2.1` |
| GameConfig.Generator | `netstandard2.0` |

⚠️ `RebuildSharedData` ต้องคง `netstandard2.1` ไว้เพราะ Unity ต้องอ่านได้ — **ห้ามอัป target**

---

## 3. ไฟล์ข้อมูลเกม

ที่ `RoRebuildServer/GameConfig/ServerData/Db/` — **แก้ที่นี่คือแก้ gameplay ไม่ต้องแตะ C#**

### ไฟล์ที่ใช้บ่อย
| ไฟล์ | เนื้อหา |
|---|---|
| `Monsters.csv` | 335 ตัว — HP, stats, ATK, DEF, Exp, Element, AI, ClientSprite |
| `Maps.csv` | 275 แมพ ⛔ **ห้ามตัด** |
| `Instances.csv` | จัดกลุ่มแมพ ⛔ **ห้ามตัด** |
| `Jobs.csv` | อาชีพทั้งหมด (ตัด ID 21-25 ตอนเฟส 4) |
| `ItemsWeapons.csv` | 503 |
| `ItemsEquipment.csv` | 555 |
| `ItemsCards.csv` | 441 |
| `ItemsRegular.csv` | 751 |
| `ItemsUsable.csv` | 288 |
| `DropData.csv` | ตารางดรอป |
| `ExpChart.csv` / `ExpJobChart.csv` | ค่า exp |
| `MvpList.csv` | MVP |
| `SavePoints.csv` | จุด save |

ไฟล์อื่น: `Armor Effects ElementalChart Emotes EquipmentGroups ItemBoxSummonList ItemMonsterSummonList ItemsAmmo JobHpChart JobSpChart JobStatBonuses JobWeaponInfo MonsterAI NonCardPrefixes RefineSuccess SpawnMinionTable WeaponAttackTiming WeaponClass DropRateRemapping Npcs`

### รูปแบบแถว (ตัวอย่างจริง)
```
# ItemsWeapons.csv
Id,Code,Name,Attack,Range,Slot,Price,Weight,Type,Position,Property,MinLvl,Rank,EquipGroup,Refinable,Breakable,Sprite,WeaponSprite
1599,Angra_Manyu,Angra Manyu,200,2,0,1,10,Mace,MainHand,Neutral,1,4,AllJobs,Yes,No,앙그라마이뉴,1366
```
- คอลัมน์ `Sprite` เป็น**ภาษาเกาหลี** → ชี้ไปที่ไฟล์ใน GRF
- **ห้ามแก้คอลัมน์ Sprite เป็นภาษาอังกฤษ** จะหาไฟล์ไม่เจอ
- ต้องบันทึกไฟล์เป็น **UTF-8** เท่านั้น ถ้าเซฟเป็น encoding อื่นชื่อเกาหลีจะพัง

### Script
`ServerData/Script/`
- `Items/` — `EquipmentEffects.txt` `CardEffects.txt` `ComboEffects.txt` `ItemEffects.txt` `MiscEffects.txt` `CustomItems.txt`
- `Npcs/` — NPC ทั้งหมด รวม `Shops/`
- `Spawns/` `Warps/` `MonsterSkills/` `Event/` `Config/`

ใช้ภาษา script ของ `RoServerScript` (ไม่ใช่ rAthena script) — **อ่านตัวอย่างในไฟล์เดียวกันก่อนเขียนใหม่เสมอ**

---

## 4. Config และการรัน

### `RoRebuildServer/RoRebuildServer/appsettings.json`
- Database: **SQLite** → `RoCharacterDatabase.db` (ไม่ต้องลง MySQL)
- Server URL: `http://localhost:5000`
- จุดเกิดตัวละคร: `prt_fild08` @ 166, 360
- `"FeatureFlags": []` ⛔ ปล่อยว่าง

### คำสั่งที่ใช้
```bat
:: build
cd RoRebuildServer && dotnet build

:: sync data → client (รันที่ root ทุกครั้งหลังแก้ CSV)
updateclient.bat

:: รัน server
cd RoRebuildServer\RoRebuildServer && dotnet run
```

### รีเซ็ตตัวละคร
ถ้าติดในแมพที่ไม่ได้ import: ปิด server → ลบ `RoCharacterDatabase.db` → รันใหม่

---

## 5. Milestone Gates

**ห้ามข้ามเฟส** แต่ละเฟสต้องได้คำยืนยันจากผู้ใช้ก่อนไปต่อ

### เฟส 0 — เล่นได้ใน Unity Editor 🎯 (ปัจจุบัน)
- ขอบเขต: 4 แมพ (`prt_fild08`, `prontera`, `prt_fild00`, `prt_in`)
- **ข้าม** lighting bake / minimap / WebGL / VPS ทั้งหมด
- ผ่านเมื่อ: ผู้ใช้กด Play แล้ว **เดินได้ + ตีมอนได้ + มอนดรอปของ**
- Claude ทำ: clone, build, `updateclient.bat`, อ่าน log, แก้ error
- ผู้ใช้ทำ: ลง Unity/.NET, ตั้ง locale เกาหลี, extract GRF, เมนู Unity, กด Play

### เฟส 1 — เพิ่มแมพ + bake
เพิ่มแมพทีละกลุ่มตาม `Instances.csv` → bake lighting → `Ragnarok → Make Minimaps`

### เฟส 2 — WebGL build
ใช้ template `Assets/WebGLTemplates/Ragnarok` ทดสอบบนเครื่องตัวเองก่อน

### เฟส 3 — VPS + PWA
nginx + SSL + `wss://` reverse proxy → manifest + service worker → **UI มือถือ** (ดูข้อ 6)

### เฟส 4 — ปรับเป็น Episode 4
- ตัด `Jobs.csv` ID 21-25 (Ninja, Gunslinger, Taekwon, Soul Linker, Star Gladiator)
- ปรับ drop rate / exp
- ⚠️ **ยังไม่มีระบบ guild/WoE ในโค้ดเลย** (grep `guild` = 0 ไฟล์) ถ้าจะทำต้องเขียนใหม่ทั้งระบบ = เฟส 5

### เฟส 5 — Guild / WoE (งานใหญ่ ไว้ทีหลัง)

---

## 6. UI

- ใช้ **uGUI (`UnityEngine.UI`) ล้วน** — 55 ไฟล์ ไม่มี UI Toolkit เลย **ห้ามเอา UI Toolkit เข้ามาปน**
- `Assets/Scripts/UI/` มี 112 ไฟล์ `.cs`
- **สร้างหน้าต่างใหม่: สืบทอด `WindowBase`** แล้วลงทะเบียนกับ `UiManager`
  `WindowBase` ให้มาแล้ว: `CloseWindow()`, `MoveToTop()`, `FitWindowIntoPlayArea()`, `ToggleVisibility()`, `CanCloseWithEscape`
- มี `DragAndResize/` ให้แล้ว ไม่ต้องเขียนเอง
- หน้าต่างที่มีอยู่: `ClientDatabase/` (Monsters/Items/Maps/NPCs/Help), `Inventory/`, `Skills/`, `Stats/`, `ConfigWindow/`, `EmoteWindow`, `HelpWindow`, `WarpWindow`, `NPC/`, `RefineItem/`, `TitleScreen/`, `Hud/`
- ⛔ **ห้ามทำ UI มือถือก่อนเฟส 3** — ต้องทดสอบบนมือถือจริง ทำก่อนจะแยกไม่ออกว่าพังเพราะอะไร

---

## 7. Git

- `main` = ของที่รันได้ ห้าม push งานที่ยังพัง
- แตก branch ต่อเฟส: `phase0-setup`, `phase1-maps`, ...
- commit message ภาษาอังกฤษ สั้น
- ⛔ ห้าม commit: `Assets/Sprites|Maps|Sounds|Music|Plugins`, `RoCharacterDatabase.db`, `Library/`, `*.grf`

---

## 8. วิธีทำงานกับผู้ใช้

- ผู้ใช้เจ็บมาจากโปรเจกต์เก่าที่แก้ไม่จบจนไม่ได้เล่นสักที → **ให้ความสำคัญกับ "รันได้" มากกว่า "ครบ"**
- แก้ทีละอย่าง ทดสอบทีละอย่าง อย่าแก้หลายจุดพร้อมกัน
- ถ้าไม่แน่ใจ → grep หาโค้ดจริงก่อน อย่าเดา อย่าอ้าง knowledge ของ rAthena
- ผู้ใช้ประหยัดค่าใช้จ่าย → อย่าอ่านไฟล์ทั้ง repo ถ้าไม่จำเป็น ใช้ grep/glob เจาะจง
- error ที่ **ไม่ต้องแก้**: warning มอนสเตอร์ ID 6000+ ไม่มี sprite = ปกติ
- งานที่ Claude ทำแทนไม่ได้ (ต้องบอกผู้ใช้ให้ทำเอง): ตั้ง system locale, extract GRF ด้วย GRF Editor, เมนู Unity ที่เป็นหน้าต่าง interactive, ตรวจผลด้วยสายตา, กด Play
