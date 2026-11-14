# ภาพค่ายมวย 5 ระดับ ให้ ChatGPT วาด — Muay Manager

สถานะ: 14 พ.ย. 2026 รอเจ้าของเกมสร้างภาพ ระบบในเกมพร้อมแล้ว (ฉากหลังโค้ง ตัวนักมวย 3D ยืนหน้าภาพ เงาตกบนพื้นในภาพ)

## ใช้ยังไงในเกม

- ภาพหนึ่งใบต่อระดับค่าย (1–5) อัปเกรดค่ายแล้วภาพเปลี่ยน
- วาดเป็น **กลางวัน** ทุกใบ เกมย้อมสีเป็นเช้า เย็น กลางคืนเองตามเวลาจริง
- ภาพติดบนฉากหลังโค้งรอบตัวนักมวย กล้องหมุนซ้ายขวาเล็กน้อย จึงเห็นส่วนกลางภาพมากที่สุด ขอบซ้ายขวาเห็นบ้าง
- ใช้เฉพาะบนเว็บ (muay-manager.pages.dev) หน้าใน claude.ai ไม่มีที่เหลือในขนาดไฟล์ ยังเป็นค่าย 3D

## กติกาทุกใบ

- แนวนอน **3:2 (1536×1024)**
- มุมกล้องระดับอก (ราว 1.3 เมตร) มองตรง ก้มลงนิดเดียว เส้นขอบฟ้าราว 42% จากขอบบน **พื้นกินราว 40% ล่างของภาพ**
- **กลางภาพต้องโล่ง** กรอบสีแดงในภาพ `00_layout_guide.png` คือที่ตัวนักมวยของเรายืน ห้ามมีคน กระสอบ เสา ในกรอบนั้น พื้นตรงเท้าต้องเรียบ
- ไม่มีคน ไม่มีสัตว์ ไม่มีตัวหนังสือที่อ่านได้ ไม่มีโลโก้ ไม่มีชื่อค่ายหรือคนจริง
- ลายเส้นเดียวกับภาพ UI ชุดเดิม (`01_style_reference_camp.png`): ภาพวาดเกมกึ่งสมจริง สีอุ่น แสงกลางวันสว่าง
- ไม่มืด ไม่ขมุกขมัว

## คำสั่ง (ส่งทีละใบ แนบภาพ 00, 01 และ 03 ไปด้วย)

ข้อความนำ (ใส่ก่อนทุกใบ):

> Semi-realistic painted game background, same style as the attached reference. Landscape 3:2, 1536x1024. Camera at chest height (1.3 m), looking straight ahead and very slightly down, wide angle about 70 degrees. Bright natural daylight, warm colours, clear and not hazy. The floor fills the lower 40% of the picture. Follow the attached layout guide: keep the red box in the centre completely empty with a flat open floor, because a 3D fighter will be placed there. No people, no animals, no readable text, no logos. Thailand, Muay Thai training camp.

ใบที่ 1 — ค่ายบ้าน (ระดับ 1)

> A humble backyard Muay Thai camp in rural Thailand: packed dirt yard, a big mango tree on the left with one old leather heavy bag hanging from a branch, a stack of old tyres, a clay water jar, a worn wooden bench, a bamboo fence, banana trees, a wooden stilt house in the background, a washing line with colourful boxing shorts drying on the right.

ใบที่ 2 — ค่ายเล็ก (ระดับ 2)

> A small Thai Muay Thai camp under an open shed with a corrugated tin roof on wooden posts, rough concrete floor, two heavy bags hanging at the back, old tyres, a bench with kick pads and gloves, a small Thai spirit house on a white pillar in the yard behind with orange garlands, palm and banana trees beyond the shed.

ใบที่ 3 — ค่ายกลาง (ระดับ 3)

> A growing Thai Muay Thai camp: larger open shed with tin roof, blue canvas training floor, a wooden plank back wall with old colourful fight posters (no readable text), three heavy bags in a row, triangle bunting flags in red, white, blue and yellow, an old practice boxing ring visible behind on the left, spirit house, tropical trees.

ใบที่ 4 — ค่ายใหญ่ (ระดับ 4)

> A large open-sided Muay Thai gym hall in Thailand: a full boxing ring in the background with red and blue ropes, a long row of five heavy bags and one long banana bag, a weights corner with a barbell rack and dumbbells, standing fans, strings of warm light bulbs along the roof beams, clean blue mats, plank walls with fight posters (no readable text), plants outside.

ใบที่ 5 — ค่ายแชมป์ (ระดับ 5)

> A professional championship Muay Thai gym in Thailand: polished boxing ring with red and blue corner posts in the background, rows of new heavy bags, a wall shelf full of gold trophies and championship belts, big red and gold banners without text, spotless red training mats, good overhead lights, wooden Thai architectural details, a golden spirit house, everything clean and proud.

## ส่งกลับมา

ส่งภาพ 5 ใบกลับมาในแชต (ไฟล์ PNG หรือ JPG ขนาดเต็ม) บอกว่าใบไหนระดับไหน ไม่ต้องย่อ ไม่ต้องตัด
Claude นำเข้าด้วย `python3 tools/camp-art-import.py 1=<ใบ1> 2=<ใบ2> ...` แล้วปรับตำแหน่งฉากหลัง (`BACKDROP` ใน `src/arena.js`) ให้พื้นในภาพตรงกับเท้านักมวย
