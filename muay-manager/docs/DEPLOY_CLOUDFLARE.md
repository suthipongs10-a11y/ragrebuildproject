# เอาเกมขึ้นเว็บ (Cloudflare) — Muay Manager

สถานะ: 14 พ.ย. 2026 **ขึ้นจริงแล้วที่ https://muay-manager.pages.dev** ฐานข้อมูล D1 `muay-manager` (APAC) • KV `muay-manager-site` (binding `SITE`) • โปรเจกต์ Pages `muay-manager`
ขึ้นใหม่หลังแก้: `npm run deploy` (ต้องตั้ง `CLOUDFLARE_ACCOUNT_ID` และ token ดูหัวข้อ Claude ทำ)

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
│ index.html (เกมทั้งเกม) │ ────────▶ │ functions/[[path]].js → KV `SITE` (ไฟล์เกม)   │
│ src/netdb.js         │ ◀──────── │ functions/api/[[route]].js → D1            │
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
   - Permissions: `Cloudflare Pages · Edit` • `D1 · Edit` • `Workers KV Storage · Edit` • `Account Settings · Read`
   - หน้าจอปัจจุบันไม่มีช่อง Account Resources แยก ใช้ `Include · All accounts` ได้ • ช่อง Client IP address filtering เว้นว่าง
3. กด Create แล้ว **ใส่ token ในหน้าต่างที่ Claude เปิดให้ (ช่องเก็บความลับของ environment) ห้ามวางในแชต**
4. บอก Claude ว่าใส่แล้ว

## ทำไมไฟล์เกมอยู่ใน KV ไม่ใช่ไฟล์ของ Pages

การอัปโหลดไฟล์ของ Pages (`/pages/assets/*`) ใช้กุญแจชั่วคราวคนละตัวกับ token แต่ระบบเครือข่ายของเซสชัน Claude ใส่ token แทนกุญแจนั้นทุกครั้ง จึงขึ้น `Authorization failed` (ลองแล้ว 14 พ.ย. 2026)
ทางออก: `tools/deploy-site.mjs` เขียนไฟล์ใน `dist/site` ลง KV namespace `SITE` (ใช้ token ปกติได้ ค่าละไม่เกิน 25 MB) แล้ว deploy เฉพาะ Functions (`--skip-caching` ไม่มีไฟล์ให้อัป) `functions/[[path]].js` ส่งไฟล์จาก KV พร้อม ETag เปิดซ้ำโดยหน้าไม่เปลี่ยนได้ 304 ไม่ต้องโหลด 15 MB ใหม่
ในเครื่อง (`npm run site`) ไม่มี KV ก็ส่งไฟล์จาก `dist/site` ตามปกติ

## Claude ทำ

ครั้งแรก
```bash
cd muay-manager/prototypes/fight3d
export CLOUDFLARE_API_TOKEN=proxy-injected-dummy CLOUDFLARE_ACCOUNT_ID=<จาก /client/v4/accounts>   # proxy ใส่ token จริงให้
npx --yes wrangler@4 d1 create muay-manager --location apac                 # ทำแล้ว id อยู่ใน wrangler.toml
npx --yes wrangler@4 pages project create muay-manager --production-branch main   # ทำแล้ว
npx --yes wrangler@4 kv namespace create muay-manager-site                  # ทำแล้ว id อยู่ใน wrangler.toml เป็น binding SITE
npm run deploy                                      # build + ไฟล์ลง KV + deploy Functions ได้ https://muay-manager.pages.dev
```

ทุกครั้งที่แก้บั๊ก: แก้โค้ด → ทดสอบ → `npm run deploy` → commit + push เพื่อนกดรีเฟรชก็ได้ของใหม่ (หน้าเกมตั้ง `no-cache` + ETag และ KV เก็บแคชที่ขอบเครือข่าย 60 วินาที)

ทดสอบในเครื่องก่อนขึ้นจริง: `npm run site` เปิด http://localhost:8788 ใช้ฐานข้อมูลจำลองใน `.wrangler/` (ไม่ commit)

ไล่บั๊กจากข้อมูลจริง (อ่านอย่างเดียว):
```bash
npx --yes wrangler@4 d1 execute muay-manager --remote --command "SELECT coll, id, updated FROM docs ORDER BY updated DESC LIMIT 20"
```

## ขีดจำกัดแผนฟรี (ตรวจเมื่อจะเปิดให้คนเยอะ)

- Functions 100,000 ครั้งต่อวัน (นับการเปิดหน้าเกมด้วย): เกมถามคำท้าใหม่ทุก 8 วินาทีตอนเปิดหน้า (30 วินาทีตอนสลับไปแอปอื่น) ผู้เล่นหนึ่งคนเปิดหนึ่งชั่วโมงราว 900 ครั้ง เพื่อน 10 คนเล่นวันละ 2 ชั่วโมงราว 18,000 ครั้ง สบาย
- D1 อ่าน 5 ล้านแถวต่อวัน ที่เก็บ 5 GB
- KV อ่าน 100,000 ครั้งต่อวัน เขียน 1,000 ครั้งต่อวัน ค่าละไม่เกิน 25 MB (หน้าเกมตอนนี้ 15 MB deploy หนึ่งครั้งเขียน 4 ค่า)

## ยังไม่มี (ทำเมื่อต้องการ)

- ล็อกอินหรือรหัสย้ายเครื่อง (ตอนนี้ตัวละครผูกกับเบราว์เซอร์)
- กันคนสมัครรัว ๆ และกันแก้ค่าพลังในเครื่อง (เล่นกับเพื่อนพอได้ ก่อนเปิดสาธารณะต้องย้ายไฟต์จัดอันดับไปจำลองที่เซิร์ฟเวอร์)
- deploy อัตโนมัติจาก GitHub (ต่อ repo ใน Cloudflare dashboard: root `muay-manager/prototypes/fight3d`, build `npm ci && node build.mjs`, output `dist/site`)
