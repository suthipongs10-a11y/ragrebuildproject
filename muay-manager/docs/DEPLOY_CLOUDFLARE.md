# เอาเกมขึ้นเว็บ (Cloudflare) — Muay Manager

สถานะ: 14 พ.ย. 2026 โค้ดพร้อม ทดสอบในเครื่องแล้ว รอเจ้าของเกมสมัคร Cloudflare และให้ token

## ทำไมเลือก Cloudflare ก่อน VPS

| | Cloudflare Pages + D1 | VPS ของเจ้าของเกม |
|---|---|---|
| ค่าใช้จ่าย | ฟรี (ดูขีดจำกัดล่าง) | ค่าเช่าเครื่องที่จ่ายอยู่ |
| ตั้งค่า | สมัครบัญชี + สร้าง token ครั้งเดียว | ต้องลง nginx SSL Node.js ดูแลเครื่องเอง |
| Claude แก้บั๊กแล้วขึ้นเว็บเองได้ | ได้ ด้วย token ที่เก็บใน environment ของเซสชัน | ไม่ได้ ต้องให้กุญแจ SSH ซึ่งห้ามส่งในแชต |
| Claude ดูข้อมูลผู้เล่นตอนไล่บั๊ก | ได้ (อ่านฐานข้อมูล D1 ผ่าน API) | ไม่ได้ |
| SSL โดเมน | ได้ `muay-manager.pages.dev` ทันที ผูกโดเมนตัวเองทีหลังได้ | ต้องตั้งเอง |

VPS ยังใช้ต่อได้ในขั้นลงสโตร์ (`ONLINE_STORE_PLAN.md`) ตอนต้องจำลองไฟต์จัดอันดับที่เซิร์ฟเวอร์กันโกง

## ส่วนประกอบ

```
เบราว์เซอร์ / มือถือ                  Cloudflare
┌─────────────────────┐   HTTPS   ┌───────────────────────────────────────────┐
│ index.html (เกมทั้งเกม) │ ────────▶ │ Pages: ไฟล์ใน dist/site                      │
│ src/netdb.js         │ ◀──────── │ Functions: functions/api/[[route]].js       │
│ id + รหัสลับใน          │  /api/... │ D1 (SQLite): players, docs                 │
│ localStorage         │           └───────────────────────────────────────────┘
└─────────────────────┘
```

- `node build.mjs` สร้าง `dist/site/` = `index.html` (หน้าเกมเดียวกับใน claude.ai) + ไอคอน + manifest (กด "เพิ่มลงหน้าจอหลัก" ได้)
- เปิดครั้งแรกเบราว์เซอร์ได้ id ผู้เล่นและรหัสลับ เก็บใน localStorage **ล้างข้อมูลเบราว์เซอร์ = ได้ตัวใหม่** (ยังไม่มีล็อกอิน)
- กติกาฐานข้อมูล: ทุกคนอ่านตารางอันดับและคำท้าได้ เขียนได้เฉพาะเอกสารของตัวเอง เซฟส่วนตัวอ่านได้คนเดียว
- ข้อมูลในเว็บแยกจากข้อมูลในหน้า artifact ของ claude.ai เป็นคนละที่เก็บ

## เจ้าของเกมทำ (ครั้งเดียว ราว 5 นาที)

1. สมัคร https://dash.cloudflare.com/sign-up (ฟรี ไม่ต้องใส่บัตร)
2. ไปที่ My Profile → API Tokens → Create Token → Custom token
   - Permissions: `Account · Cloudflare Pages · Edit` • `Account · D1 · Edit` • `Account · Account Settings · Read`
   - Account Resources: บัญชีของตัวเอง
3. กด Create แล้ว **ใส่ token ในหน้าต่างที่ Claude เปิดให้ (ช่องเก็บความลับของ environment) ห้ามวางในแชต**
4. บอก Claude ว่าใส่แล้ว

## Claude ทำ

ครั้งแรก
```bash
cd muay-manager/prototypes/fight3d
npx --yes wrangler@4 d1 create muay-manager        # ได้ database_id ใส่ใน wrangler.toml แล้ว commit
npx --yes wrangler@4 pages project create muay-manager --production-branch main
npm run deploy                                      # build + อัปโหลด ได้ https://muay-manager.pages.dev
```

ทุกครั้งที่แก้บั๊ก: แก้โค้ด → ทดสอบ → `npm run deploy` → commit + push เพื่อนกดรีเฟรชก็ได้ของใหม่ (`_headers` สั่งไม่ให้แคชหน้าเกม)

ทดสอบในเครื่องก่อนขึ้นจริง: `npm run site` เปิด http://localhost:8788 ใช้ฐานข้อมูลจำลองใน `.wrangler/` (ไม่ commit)

ไล่บั๊กจากข้อมูลจริง (อ่านอย่างเดียว):
```bash
npx --yes wrangler@4 d1 execute muay-manager --remote --command "SELECT coll, id, updated FROM docs ORDER BY updated DESC LIMIT 20"
```

## ขีดจำกัดแผนฟรี (ตรวจเมื่อจะเปิดให้คนเยอะ)

- Functions 100,000 ครั้งต่อวัน: เกมถามคำท้าใหม่ทุก 8 วินาทีตอนเปิดหน้า (30 วินาทีตอนสลับไปแอปอื่น) ผู้เล่นหนึ่งคนเปิดหนึ่งชั่วโมงราว 900 ครั้ง เพื่อน 10 คนเล่นวันละ 2 ชั่วโมงราว 18,000 ครั้ง สบาย
- D1 อ่าน 5 ล้านแถวต่อวัน ที่เก็บ 5 GB
- ไฟล์ละไม่เกิน 25 MB (หน้าเกมตอนนี้ 15 MB)

## ยังไม่มี (ทำเมื่อต้องการ)

- ล็อกอินหรือรหัสย้ายเครื่อง (ตอนนี้ตัวละครผูกกับเบราว์เซอร์)
- กันคนสมัครรัว ๆ และกันแก้ค่าพลังในเครื่อง (เล่นกับเพื่อนพอได้ ก่อนเปิดสาธารณะต้องย้ายไฟต์จัดอันดับไปจำลองที่เซิร์ฟเวอร์)
- deploy อัตโนมัติจาก GitHub (ต่อ repo ใน Cloudflare dashboard: root `muay-manager/prototypes/fight3d`, build `npm ci && node build.mjs`, output `dist/site`)
