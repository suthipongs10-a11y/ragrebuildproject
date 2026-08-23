# สมุดผจญภัย (Adventure Book) — เวอร์ชัน 1

> เอกสารออกแบบ ไม่ใช่คู่มือผู้เล่น
> ตัวเลขทุกตัวในไฟล์นี้คำนวณจากข้อมูลจริงในโปรเจกต์ ณ ตอนเขียน
> v1 คือ "รันได้ ครบวง" ไม่ใช่ "สมบูรณ์" — เอาขึ้น VPS ให้คนลองเล่นแล้วค่อยปรับ

---

## 1. สมุดนี้มีไว้ทำไม

เกมนี้ออกแบบมาให้เล่นอิสระ คนที่เล่นเป็นจะรู้วิธีฟาร์ม วิธีหาของอยู่แล้ว
สมุดผจญภัย **ไม่ได้มาแทนที่การเล่นแบบนั้น** — มันคือ **อีกเส้นทางหนึ่ง**
ที่ให้ของซึ่ง **ไม่มีทางหาได้จากที่อื่นเลย**

หลักการ:
- ต้องยากพอที่คนเก่งจะรู้สึกว่าท้าทาย
- ต้องคุ้มพอที่คนเก่งจะยอมทำ
- ต้องเดินไปเองระหว่างเล่นปกติ ไม่ต้องกดรับเควสต์

---

## 2. หน่วยพื้นฐานคือ "มอน" ไม่ใช่ "แมพ"

เคยคิดจะทำตามแมพ แต่ข้อมูลจริงบอกว่าไม่เวิร์ค

| มอน | spawn slot ทั่วโลก | เกิดในกี่ภูมิภาค |
|---|---|---|
| PORING | 1,183 | 8 |
| POPORING | 1,176 | 13 |
| GREEN_PLANT | 546 | 10 |
| POISON_SPORE | 452 | 8 |

ถ้ายึดแมพ Poporing จะโผล่ในสมุด 13 ที่ นับแยกกัน

**โครงสร้างจริง**

```
มอน 1 ตัว  →  3 ดาว (★1 ล่า / ★2 ล่าเยอะ / ★3 การ์ด)
     ↓ รวมกลุ่ม
ภูมิภาค 1 แห่ง  →  ครบทุกดาว = หมวกประจำภูมิภาค
     ↓ รวมกลุ่ม
ทั้งโลก  →  ครบทุกภูมิภาค = Valkyrie Set + Adventure Rank 10
```

---

## 3. ข้อมูลมาจากไหน — สมุดสร้างตัวเอง

ไม่เขียนมือสักบรรทัด สร้างตอนเซิร์ฟเวอร์บูตจากไฟล์ที่มีอยู่แล้ว

| ต้องรู้ | อ่านจาก |
|---|---|
| มอนตัวไหนอยู่แมพไหน กี่ตัว | `Script/Spawns/*.txt` → `MapConfig` + `CreateSpawn` |
| แมพไหนอยู่ภูมิภาคไหน | `Db/Instances.csv` |
| มอนตัวไหนดรอปการ์ดอะไร | `Db/DropData.csv` |
| มอนตัวนั้นเลเวลเท่าไหร่ | `Db/Monsters.csv` |

**เพิ่มมอนใหม่ / เพิ่มแมพใหม่ = สมุดขึ้นเอง** ไม่ต้องแตะโค้ด

### มอนอยู่ภูมิภาคไหน

จับไปอยู่ภูมิภาคที่มัน spawn เยอะที่สุด แล้วมี**ตารางกำหนดเองทับ**สำหรับตัวที่เกิดทั่วโลก
(Poporing เกิด 13 ภูมิภาค ระบบอัตโนมัติจับไป Payon Fields ด้วยสัดส่วนแค่ 17% ซึ่งมั่ว)

### มอนที่กรองทิ้ง

- มอนที่มี flag `Boss` (26 ตัว) — MVP/มินิบอสไม่เข้าสมุด
- `TARGET_DUMMY` และหุ่นฝึก
- มอนที่แมพไม่อยู่ใน `Instances.csv` — **147 ตัว** ส่วนใหญ่คือ ep8-11
  (Abyss Lake, Einbroch, Ayothaya, Gonryun, Hugel, Ice Dungeon, Gefenia, Guild Dungeon)
  → ยกไปเป็นชุดอัปเดตถัดไป แค่เติมแถวใน `Instances.csv` ก็เข้าสมุดเอง

**เหลือเข้าสมุด v1: 256 ตัว ใน 24 ภูมิภาค** (ยืนยันจาก log ตอนบูตจริง)

> ตัวเลขนี้ต่ำกว่าที่ประเมินไว้ตอนออกแบบ (284) เพราะการนับจากไฟล์สคริปต์ตรง ๆ นับเกิน
> 3 ทาง: มันนับทั้งสองฝั่งของ `if(IsFeatureEnabled("DoddlerCustomMonsters"))` ทั้งที่
> flag ปิดอยู่, มันไม่รู้จักคำว่า `MVP` ตัวใหญ่เลยปล่อย MVP หลุดเข้ามา, และมันไปจับ
> `CreateSpawnEvent` ด้วย ตัวเลขจากเซิร์ฟเวอร์คือตัวจริง เพราะมันอ่านจาก spawn rule
> ที่แมพโหลดขึ้นมาจริง

---

## 4. เป้าหมายไล่ตามความชุก

มอนหายากไม่ควรต้องฆ่าเท่ามอนที่เดินชนทุกก้าว

```
★1 = clamp( spawn slot รวมทั่วโลก ÷ 2 , 50 , 500 )   ปัดขึ้นเป็นหลัก 50
★2 = ★1 × 3
★3 = มีการ์ดของมอนตัวนั้น
```

| มอน | spawn | ★1 | ★2 |
|---|---|---|---|
| Poring | 1,183 | 500 | 1,500 |
| Drops | 643 | 350 | 1,050 |
| Lunatic | 375 | 200 | 600 |
| Thief Bug | 287 | 150 | 450 |
| Raydric | 171 | 100 | 300 |
| Khalitzburg | 56 | 50 | 150 |
| Medusa | 65 | 50 | 150 |

**รวมทั้งสมุด ★1+★2 = 80,400 ตัว**

### ★3 คืนการ์ด

เดินไปหา NPC → ระบบเช็คว่ามีการ์ดใบนั้นในกระเป๋า → ติ๊กถาวร → **คืนการ์ดให้**
เสียแค่ค่าเดินทาง ไม่กินการ์ด — เพราะการ์ดมีมูลค่าในตลาดกลางที่เราทำไว้แล้ว
ถ้ากินทิ้งจะไม่มีใครกล้าทำ

---

## 5. รางวัล

**ไม่มี Zeny ในสมุดเลย** เจตนา — เงินหาจากที่อื่นได้ ของพวกนี้หาไม่ได้

### ต่อดาว

| ดาว | ได้อะไร |
|---|---|
| ★1 | ยาบัฟ / ของเปลี่ยนธาตุ / Fly Wing |
| ★2 | `Old_Blue_Box` ×2 หรือ `Dead_Branch` ×3 |
| ★3 | `Old_Card_Album` ×1 หรือ `Old_Violet_Box` ×1 |

### รายการไอเทมที่ใช้ได้จริง

`ItemsUsable.csv` มี 288 ชิ้น แต่ **ทำงานจริงแค่ 82** ที่เหลือกินแล้วไม่เกิดอะไร
รางวัลต้องเลือกจากตารางนี้เท่านั้น

| กลุ่ม | Code |
|---|---|
| กล่องสุ่ม | `Old_Blue_Box` `Old_Violet_Box` `Old_Card_Album` `Gift_Box_1~4` `Cookie_Bag` |
| ยาบัฟ | `Berserk_Potion` `Awakening_Potion` `Concentration_Potion` `Authoritative_Badge` |
| เปลี่ยนธาตุ | `Elemental_Converter_Fire` `_Water` `_Wind` `_Earth` (10 นาที) |
| ไม้ | `Dead_Branch` `Bloody_Branch` |
| ฟื้นฟู | `Yggdrasil_Berry` `Yggdrasil_Seed` `Yggdrasil_Leaf` `White_Potion` `Royal_Jelly` |
| เดินทาง | `Fly_Wing` `Butterfly_Wing` |

---

## 6. หมวกประจำภูมิภาค

24 ใบ ทุกใบ **ไม่ดรอป ไม่มีในร้าน ไม่มีในกล่อง ไม่มีใน NPC ใดๆ**
(ตรวจโดยเทียบ `ItemsEquipment` + `ItemsWeapons` 1,058 ชิ้น กับ `DropData` + `ItemBoxSummonList`
+ สคริปต์ NPC ทุกไฟล์ + โค้ด C# ทุกไฟล์ — เหลือของที่ไม่มีทางได้ 242 ชิ้น เป็นหมวก 58 ใบ)

เรียงตามความยาก (เลเวลเฉลี่ยของมอนในภูมิภาค)

| # | ภูมิภาค | มอน | Lv เฉลี่ย | ต้องฆ่ารวม | หมวก | Id | Def |
|---|---|---|---|---|---|---|---|
| 1 | Prontera Culverts | 8 | 18 | 3,000 | Detective's Cap | 5108 | 3 |
| 2 | Prontera Fields | 17 | 20 | 8,400 | Flower Hairpin | 5061 | 1 |
| 3 | Morroc Fields | 24 | 25 | 11,000 | Cowboy Hat | 5075 | 4 |
| 4 | Payon Fields | 14 | 28 | 7,600 | Ayam | 5174 | 3 |
| 5 | Ant Hell | 9 | 29 | 1,800 | Novice Eggshell | 5055 | 3 |
| 6 | Izlude Bailan Cave | 16 | 31 | 4,600 | Bucket Hat | 5114 | 3 |
| 7 | Orc Dungeon | 3 | 32 | 600 | Orc Helm | 5157 | 5 |
| 8 | Mt. Mjolnir | 13 | 33 | 5,200 | Wonder Nutshell | 5050 | 5 |
| 9 | Geffen Fields | 16 | 34 | 5,200 | Bulb Band | 5034 | 0 |
| 10 | Mjolnir Dead Pit | 4 | 38 | 1,000 | Candle | 5028 | 0 |
| 11 | Forest Labyrinth | 3 | 38 | 600 | Banana Hat | 5116 | 1 |
| 12 | Lutie | 9 | 39 | 1,800 | Holiday Hat | 5097 | 0 |
| 13 | Yuno Fields | 18 | 42 | 12,200 | Ph.D Hat | 5347 | 3 |
| 14 | Payon Dungeon | 13 | 43 | 3,200 | Magistrate Hat | 5173 | 3 |
| 15 | Comodo | 22 | 45 | 5,200 | Pirate Dagger | 5305 | 0 |
| 16 | Geffen Dungeon | 9 | 48 | 1,800 | Dark Bacilium | 5808 | 5 |
| 17 | Sphinx | 8 | 50 | 2,000 | Mythical Lion Mask | 5177 | 5 |
| 18 | Sunken Ship | 2 | 52 | 400 | Red Bonnet | 5109 | 2 |
| 19 | Pyramid | 9 | 53 | 2,800 | Cross Hat | 5036 | 1 |
| 20 | Clock Tower | 12 | 54 | 4,200 | Golden Gear | 5159 | 5 |
| 21 | Amatsu | 9 | 55 | 1,800 | Bride Mask | 5169 | 4 |
| 22 | Glast Heim | 30 | 60 | 8,200 | Opera Phantom Mask | 5043 | 1 |
| 23 | Magma Dungeon | 8 | 66 | 1,600 | Hot-Blooded Headband | 5070 | 1 |
| 24 | Turtle Island | 8 | 68 | 1,600 | Spiky Band | 5161 | 6 |

### ⚠️ หมวกพวกนี้ยังไม่มีเอฟเฟกต์

จาก 24 ใบ **มีแค่ `Hot-Blooded_Headband` ใบเดียว**ที่มีสคริปต์ใน `EquipmentEffects.txt`
ที่เหลือคือหมวกเปล่า Def 0-6 ซึ่ง**ไม่คุ้มกับการฆ่ามอนหลักพัน**

ดังนั้นต้องเขียนเอฟเฟกต์ให้ด้วย ระดับพลังอ้างอิงของที่มีอยู่:

```
Item("Apple_of_Archer")     { OnEquip: AddStat(AddDex, 3); }
Item("Hat_of_the_Sun_God")  { OnEquip: AddStat(AddStr, 3); AddStat(AddInt, 2); }
Item("Bunny_Band")          { OnEquip: AddStat(AddLuk, 2); }
Item("Wizard_Hat")          { OnEquip: AddStat(AddMaxSp, 100); }
```

เกณฑ์: ภูมิภาคต้น ≈ +2 สเตตัส · ภูมิภาคกลาง ≈ +3 หรือ resist · ภูมิภาคปลาย ≈ +3/+2 สองสเตตัส
เขียนตอนขั้นที่ 3 พร้อมกับตัวหมวก

---

## 7. Adventure Rank

สะสมดาว → Rank 1-10 → บัฟถาวรติดตัว

| Rank | ดาวที่ต้องมี | ได้ถาวร |
|---|---|---|
| 1-3 | 30 / 90 / 180 | +1 ทุกสเตตัส ต่อ rank |
| 4 | 300 | +Drop 3% |
| **5** | 450 | +Drop 3% · **วาร์ปจากสมุดฟรีทุกแมพ** (ดูข้อ 8) |
| 6 | 620 | +Drop 3% |
| 7-9 | 800 / 1000 / 1200 | +EXP 3% · +อัตราตีบวก 2% ต่อ rank |
| **10** | ครบทุกภูมิภาค | **Valkyrie Set** + ฉายา |

ดาวรวมทั้งสมุด = **751 ดาว** (256 มอน แต่ 17 ตัวไม่ดรอปการ์ด จึงได้ 2 ดาวแทน 3)

### สเตตัสที่ต้องใช้ — มีอยู่แล้ว 3 ใน 4

| บัฟ | สถานะ |
|---|---|
| เพิ่มสเตตัส | ✅ `CharacterStat.AddStr` ฯลฯ |
| เพิ่มอัตราดรอป | ✅ `CharacterStat.AddDropPercent` ต่อสายแล้วที่ `Monster.cs:604` |
| เพิ่ม EXP | ✅ `CharacterStat.AddExpPercent` ที่ `Monster.cs:852` |
| เพิ่มอัตราตีบวก | ❌ ยังไม่มี — แก้บรรทัดเดียวที่ `EquipmentRefineSystem.cs:56` |

ตัวอย่างที่ลอกได้: `Simulation/StatusEffects/Misc/DungeonMiasmaStatus.cs` ใส่
`AddDropPercent +100` / `AddExpPercent +60` อยู่แล้ว

---

## 8. วาร์ปจากสมุด

สมุดรู้อยู่แล้วว่ามอนแต่ละตัวยืนอยู่แมพไหนบ้าง แมพละกี่ตัว
(`AdventureBookEntry.Sightings` เรียงจากแมพที่หนาแน่นที่สุดลงมา)
ฝั่ง client ก็มีข้อมูลชุดเดียวกันอยู่แล้วที่ `mon.Spawns` — ไม่ต้อง export อะไรเพิ่ม

เลยเปิดหน้าสมุดมอนตัวไหน ก็เลือกได้เลยว่าจะไปแมพไหน

### สิทธิ์ไม่เท่ากัน — และนั่นคือเจตนา

| ใคร | ทำอะไรได้ |
|---|---|
| ทุกคน ตลอดเวลา | **เห็น**รายชื่อแมพ + จำนวนมอนแต่ละแมพ |
| ได้ ★1 ของมอนตัวนั้นแล้ว | วาร์ปไปแมพนั้นได้ **เสีย Zeny เท่าอัตราคาฟรา** |
| Adventure Rank 5 ขึ้นไป | วาร์ป**ฟรี** ทุกแมพในสมุด |

ได้สามอย่างพร้อมกัน: สมุดให้รางวัลตัวเอง · ตัวละครใหม่ไม่ได้วาร์ปฟรีตั้งแต่วันแรก ·
คาฟรา `Fly_Wing` `Butterfly_Wing` ยังมีเหตุผลจะมีอยู่

### ⛔ ห้ามใช้ `AdminRequestMove`

ปุ่ม Teleport ในหน้าต่างฐานข้อมูลส่ง `PacketType.AdminRequestMove` ซึ่งเป็นคำสั่ง GM

```csharp
// NetworkManager.cs:1721
msg.Write((byte)PacketType.AdminRequestMove);

// PacketAdminRequestMove.cs:27
if (!connection.IsAdmin && !ServerConfig.DebugConfig.EnableWarpCommandForEveryone)
    return;
```

สมุดต้องมี **packet ของตัวเอง + handler ของตัวเอง** ที่ตรวจสามเงื่อนไขข้างบนฝั่งเซิร์ฟเวอร์
ไม่ใช่ยืม packet admin มาใช้ เพราะ client เชื่อไม่ได้

### ⛔ ต้องปิดก่อนขึ้น VPS

```json
// appsettings.json:44
"EnableWarpCommandForEveryone": true    ← ตอนนี้เปิดอยู่
```

เปิดไว้ = ทุกคนวาร์ปฟรีไม่จำกัดทั่วโลกผ่านหน้าต่างฐานข้อมูล
ซึ่งทำให้ทั้งข้อ 8 นี้ คาฟรา และไอเทมวาร์ป ไม่มีความหมายพร้อมกันทั้งหมด

**เป็นรายการแรกของ checklist ก่อน close beta**

---

## 9. ฝั่งเทคนิค

### จุดเสียบ

```csharp
// Custom/BountySystem/BountySystemManager.cs เป็นโครงเปล่าที่ register ไว้แล้ว
MonsterRewardManager.RegisterKillMonsterEvent(OnKillMonster);
```

### ที่เก็บ progress

`Player.NpcFlags` — `Dictionary<string, int>` เซฟลง DB พร้อมตัวละครอยู่แล้ว
**ไม่ต้องแก้ schema ไม่ต้อง migration**

```csharp
public int  GetNpcFlag(string flag)            // Player.cs:144
public void SetNpcFlag(string flag, int val)   // Player.cs:149
```

รูปแบบ key: `ab#<monsterId>` (นับ kill) และ `ab*<monsterId>` (bitmask ดาวที่เก็บแล้ว)
ใช้ id ไม่ใช่ชื่อ เพื่อให้ key สั้น — 256 มอน × ~12 ไบต์ ≈ 3.1 KB ต่อตัวละคร ก่อนบีบอัด LZ4

### แจกของ / ประกาศ

```csharp
player.CreateItemInInventory(new ItemReference(item, 1));   // ServerMilestoneEvent.cs:536
ServerAnnouncements.Announce(...)                            // Custom/ServerAnnouncements.cs
```

### ⛔ แก้แล้ว: กับระเบิดตอนเซฟตัวละคร

`PlayerDataDbHelper.StorePlayerDataForDatabaseUse` เคยจองพื้นที่ `NpcFlags.Count * 8`
แต่ `WriteDictionary` ใช้ `ความยาว + UTF8 ของ key + 4` ต่อ entry — key ยาวเกิน 3 ตัวอักษร
ก็เกินโควตาตัวเองแล้ว บัฟเฟอร์เป็น `MemoryStream` คร่อม array ที่ขยายไม่ได้
เขียนเกิน = โยน exception ออกจากการเซฟตัวละคร

แทนที่ด้วย `NpcFlagStorageSize()` ที่วัดจริง — **ต้องมีก่อนสมุดจะเพิ่ม key เป็นร้อย**

---

## 10. รู้ว่ายังไม่ทำใน v1

| เรื่อง | ทำไม |
|---|---|
| มอน 147 ตัวนอก `Instances.csv` | เป็น ep8-11 ยกไปชุดถัดไป |
| ถ่ายรูปมอน / ทำอาหาร (แบบ ROM) | ไม่มีระบบกล้อง ไม่เอา crafting |
| MVP / มินิบอส 26 ตัว | มี `ServerMilestoneEvent` ดูแลอยู่แล้ว |
| ของที่อาจซ้ำกับตลาดมืดของ MilestoneEvent | ตั้งใจปล่อยไว้ก่อน ค่อยเลือกว่าจะเอาอะไรออกทีหลัง |
| โบนัสสเตตัสจากการสะสมการ์ด (แบบ ROM) | รอดูฟีดแบ็ก close beta |

---

## 11. ลำดับงาน

| ขั้น | ทำอะไร | เล่นได้ยัง |
|---|---|---|
| 0 | ✅ แก้ `NpcFlagStorageSize` ใน `PlayerDataDbHelper` | — |
| 1 | ✅ `AdventureBookManager` สร้างสมุดตอนบูต + ตาราง override ภูมิภาค | — |
| 2 | นับ kill + เก็บลง NpcFlags + ★1/★2 + ประกาศตอนสำเร็จ | ✅ ทดสอบได้ |
| 3 | ★3 การ์ด + NPC รับรางวัล + หมวก 24 ใบ + เอฟเฟกต์หมวก | ✅ ครบวง |
| 4 | Adventure Rank + บัฟถาวร + แก้อัตราตีบวก | ✅ |
| 5 | หน้าต่าง UI (`WindowBase` + `UiManager`) + packet วาร์ปของสมุด | ✅ |
| 6 | ปิด `EnableWarpCommandForEveryone` แล้วไล่เทสว่าไม่มีอะไรพึ่งมันอยู่ | ก่อน beta |

ขั้น 2 จบแล้วทดสอบได้เลยโดยยังไม่มี UI — ตามหลัก "รันได้ก่อน ครบทีหลัง"
