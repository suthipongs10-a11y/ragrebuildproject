# หน้าเกมบน itch.io — Muay Manager

เขียน 23 พ.ย. 2026 (ต้นแบบ 2.71) เจ้าของเกมจะเอาขึ้น itch.io เพื่อให้คนลองเล่น

## 1. ไฟล์ที่ใช้

| ไฟล์ | ใช้ทำอะไร | สร้างด้วย |
|---|---|---|
| `prototypes/fight3d/dist/MuayManager-itch.zip` | ไฟล์เกมที่อัปโหลด (หน้าเล็ก ๆ ที่เปิดเกมจาก muay.eggpact.com ไว้ในกรอบ) | `npm run itch` |
| `dist/itch-page/cover-630x500.png` | ภาพปก (Cover image) | `npm run itch` |
| `dist/itch-page/shot-*.jpg` | ภาพตัวอย่าง (Screenshots) 5 ภาพ | 3 ภาพแรกจาก `npm run itch` (เฟรมคลิปชกเต็มยก) • ภาพซ้อมและค่ายเป็นภาพหน้าจอเกมที่ 540×960 |

ทำไมเปิดเกมจากเว็บแทนการใส่ไฟล์เกมทั้งหมด: itch.io เล่นรุ่นล่าสุดเสมอ ไม่ต้องอัปโหลดใหม่ทุกครั้งที่อัปเดต • ใช้เซิร์ฟเวอร์เดียวกับเว็บ (ตารางอันดับ ท้าชก แชท ศึกชิงถ้วย) ผู้เล่นทุกที่อยู่รุ่นเดียวกัน ไม่มีปัญหารุ่นตัวจำลองไม่ตรงตอนท้าชก • เซฟอยู่ในเครื่องผู้เล่น แยกจากเซฟตอนเปิดเว็บตรง (ย้ายได้ด้วยรหัสย้ายเครื่อง)

ทดสอบแล้ว (`npm run e2e:itch`): หน้าแบบ itch.io สามชั้น (itch.io → หน้าของเรา → เว็บเกม) เกมขึ้น สมัครกับเซิร์ฟเวอร์ได้ สร้างนักมวยแล้วขึ้นตารางอันดับ เต็มจอได้ กรอบกว้าง 540 ไม่ล้นข้าง ไม่มี error

## 2. ขั้นตอนบน itch.io (เจ้าของเกมทำ)

itch.io ไม่มีภาษาไทย ชื่อปุ่มอยู่ในวงเล็บ

1. สมัครบัญชี แล้วไปหน้าจัดการ (Dashboard) → สร้างเกมใหม่ (Create new project)
2. ชื่อ (Title): `Muay Manager` • ลิงก์ (Project URL): เช่น `muay-manager`
3. คำอธิบายสั้น (Short description or tagline): ข้อ 3
4. ชนิด (Kind of project): **HTML**
5. ไฟล์ (Uploads): อัปโหลด `MuayManager-itch.zip` แล้วติ๊ก "เล่นบนเบราว์เซอร์" (This file will be played in the browser)
6. ตั้งค่าการแสดง (Embed options):
   - ขนาด (Viewport dimensions): กว้าง **540** สูง **960**
   - ติ๊ก "ปุ่มเต็มจอ" (Fullscreen button)
   - ติ๊ก "เล่นบนมือถือได้" (Mobile friendly) แนวจอ (Orientation) **Portrait**
   - การเปิดบนมือถือ: "กดแล้วเปิดเต็มจอ" (Click to launch in fullscreen)
7. ประเภท (Genre): **Sports** หรือ **Simulation** • แท็ก (Tags): `muay-thai` `boxing` `management` `sports` `3d` `thai` `browser` `multiplayer`
8. ราคา (Pricing): **ไม่เก็บเงิน** (No payments)
9. คำอธิบาย (Description): ข้อ 4
10. ภาพปก (Cover image) และภาพตัวอย่าง (Screenshots): ข้อ 1
11. การมองเห็น (Visibility & access):
    - **ช่วงทดสอบ: เฉพาะคนที่มีลิงก์ (Restricted)** หรือ "ร่าง" (Draft) แล้วส่งลิงก์ให้คนลอง
    - พร้อมเปิดจริง: ทุกคน (Public) • ก่อนเปิด Public ดูข้อ 5
12. กดบันทึก (Save) แล้วเปิดหน้าดูบนมือถือและคอมสักครั้ง

## 3. คำอธิบายสั้น (ไม่เกิน 1 บรรทัด)

```
Manage your own Muay Thai fighter: train, plan, and watch every fight in 3D. Free in your browser.
```

## 4. คำอธิบาย (วางในช่อง Description)

```
Muay Manager — คุมค่ายมวยไทยของคุณเอง

สร้างนักมวย ซ้อมตามจังหวะครู เลือกคู่ชก วางแผนการชก แล้วนั่งข้างเวทีดูไฟต์ 3D ที่ชกเองตามค่าพลังและแผนของคุณ พักยกแก้แผนได้ ชนะแล้วได้เงินรางวัล ไต่อันดับจากเวทีงานวัดไปถึงศึกชิงแชมป์ประเทศ

• ซ้อม: กระสอบทราย เตะต้นกล้วย ถีบหุ่น กระโดดเชือก วิ่ง ซ้อมคู่
• ค่าย: จ้างครู นวด เลี้ยงข้าว ทำบุญ ขยายค่าย 5 ระดับ
• ชก: ท่ามวยไทยจริง หมัด เตะ ถีบ เข่า ศอก วงใน ท่าไม้ตาย เสียงพากย์ไทย
• ออนไลน์: ตารางอันดับ ท้าชกผู้เล่นอื่น แชท ศึกชิงถ้วยผู้เล่นทุกสัปดาห์
• เล่นฟรีบนเบราว์เซอร์ ทั้งมือถือและคอม ไม่ต้องติดตั้ง

Manage your own Muay Thai fighter. Train on the beat, pick your opponent, set the game plan, then watch the fight play out in 3D from your corner — change the plan between rounds. Win purses, climb from temple fairs to the national stadium, challenge other players, and enter the weekly players' cup. Free in your browser, on phone or computer.

ยังอยู่ในช่วงทดสอบ เจอบั๊กหรืออยากบอกอะไร คอมเมนต์ใต้หน้านี้ หรือในเกมกด ตั้งค่า → แจ้งปัญหา · เสนอแนะ
This is an early test version — bugs and ideas welcome in the comments.

เล่นบนเว็บโดยตรง · Also at: muay.eggpact.com
ผลงานของ RR Studio Gaming

Credits
Crowd sounds: Gregor Quendel (CC BY 4.0) · other credits in the game (เครดิต / Credits, at the bottom of the page)
```

## 5. ก่อนเปิดให้ทุกคนเห็น (Public)

- **กันโกงแบบเร็วทำแล้ว (รอบที่ 102):** เซิร์ฟเวอร์ปฏิเสธตารางอันดับที่เป็นไปไม่ได้ (ค่าพลังเกิน 97 RP ขึ้นเกิน 32 ต่อการชนะ สถิติลดลงหรือเพิ่มเร็วเกินไป) คำท้าและการสมัครศึกชิงถ้วยที่ค่าพลังเกินตารางอันดับ • เจ้าของเกมบอก Claude ให้ดูหรือเอาคนโกงออก (`tools/rank-admin.mjs`)
- **ยังโกงได้:** แก้เงินและของในเครื่องตัวเอง (ไม่กระทบคนอื่น) • เลือกเลขไฟต์ตอนท้าชก • ข่าวผลชกปลอม ต้องทำงานเซิร์ฟเวอร์เป็นผู้ตัดสิน (`docs/SERVER_WORK_PLAN.md` P1–P2) ก่อนมีของขายหรือลงสโตร์
- เพลงประกอบ 2 เพลงที่ยังไม่รู้ที่มา (`STATUS.md` รอบที่ 34) อยู่ในเกมบนเว็บ จึงเล่นบน itch.io ด้วย
