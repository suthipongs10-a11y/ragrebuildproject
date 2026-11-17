# เอาเกมขึ้น VPS ของตัวเอง — Muay Manager

เขียน 17 พ.ย. 2026 ที่ต้นแบบ 2.51 ใช้ได้กับ VPS Linux ทั่วไป (ตัวอย่างเป็น Ubuntu 22.04 / 24.04 บน DigitalOcean)
และรันร่วมเครื่องกับเว็บอื่นได้ เกมใช้พอร์ตภายในหนึ่งพอร์ต แล้วให้ nginx ที่มีอยู่ส่งโดเมนย่อยมาให้

## 1. ภาพรวม

```
มือถือผู้เล่น ──HTTPS──▶ nginx (โดเมนย่อย เช่น muay.example.com)
                              │ proxy
                              ▼
                 node server/server.mjs  (พอร์ต 8787 ฟังเฉพาะในเครื่อง)
                   ├─ ไฟล์เกมจาก dist/site/
                   └─ /api  →  ฐานข้อมูล SQLite ไฟล์เดียว /srv/muay/data/muay.db
```

- โปรแกรมเดียว ไม่มีฐานข้อมูลแยก ไม่มี Docker ใช้แรมราว 60–100 MB คน 10–15 คนแทบไม่กิน CPU
- `/api` เป็นโค้ดไฟล์เดียวกับบน Cloudflare (`functions/api/[[route]].js`) รันบน SQLite แทน D1 พฤติกรรมจึงเหมือนกันทุกอย่าง
- **ฐานข้อมูลของ VPS กับของ `muay-manager.pages.dev` แยกกัน** ผู้เล่นที่สร้างไว้บนเว็บ Cloudflare จะไม่ตามมาเอง (ดูข้อ 8)
- ไฟล์ทั้งชุดอยู่ที่ `muay-manager/prototypes/fight3d/server/`

| ไฟล์ | หน้าที่ |
|---|---|
| `server.mjs` | เซิร์ฟเวอร์: เสิร์ฟไฟล์เกม + `/api` + สำรองฐานข้อมูลวันละชุด |
| `d1-sqlite.mjs` | ตัวแปลงให้โค้ด `/api` ใช้ SQLite ของ Node ได้ |
| `muay-manager.service` | ให้ systemd เปิดเกมเองตอนบูตและเปิดใหม่ถ้าล้ม |
| `nginx-site.conf` | ตัวอย่างไซต์ของ nginx |
| `update.sh` + `muay-update.service` + `muay-update.timer` | ดึงเวอร์ชันใหม่จาก GitHub เองทุก 5 นาที (ไม่บังคับ) |

## 2. สิ่งที่ต้องมี

- VPS ที่เข้าได้ด้วย SSH และมี nginx อยู่แล้ว (เครื่องเดียวกับเว็บอื่นได้)
- **Node.js 22.13 ขึ้นไป** (เกมใช้ SQLite ที่มากับ Node ไม่ต้องลงฐานข้อมูล)
- โดเมนย่อยหนึ่งชื่อชี้มาที่ IP ของ VPS (ระเบียน A) เช่น `muay.example.com`
- สิทธิ์อ่าน repo บน GitHub จากตัว VPS (ข้อ 3.3)

> ขั้นตอนทั้งหมดเจ้าของเกมต้องรันเองบน VPS ผู้ช่วยในเซสชันคลาวด์ SSH เข้าเครื่องไม่ได้
> ถ้าติดตรงไหน คัดลอกข้อความ error มาถามได้ **แต่อย่าวางรหัสผ่าน กุญแจ SSH หรือ token ลงในแชต**

## 3. ติดตั้งครั้งแรก

### 3.1 Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

```bash
sudo apt-get install -y nodejs git
```

```bash
node -v
```

ต้องได้ `v22.13` ขึ้นไป ถ้าเครื่องมี Node รุ่นเก่ากว่าที่เว็บอื่นใช้อยู่ อย่าอัปทับ ให้ลงแยกด้วย `nvm` หรือ `fnm`
ให้ผู้ใช้ `muay` แล้วแก้บรรทัด `ExecStart` ใน `muay-manager.service` ให้ชี้ไปที่ node ตัวนั้น

### 3.2 ผู้ใช้และโฟลเดอร์ของเกม

```bash
sudo adduser --system --group --home /srv/muay muay
```

```bash
sudo mkdir -p /srv/muay/data && sudo chown -R muay:muay /srv/muay
```

ข้อมูลผู้เล่นอยู่ที่ `/srv/muay/data/` แยกจากโค้ด การอัปเดตโค้ดจึงไม่มีทางแตะข้อมูล

### 3.3 ให้ VPS อ่าน repo ได้ (repo ส่วนตัว)

สร้างกุญแจสำหรับอ่านอย่างเดียวบน VPS แล้วเอา "กุญแจสาธารณะ" ไปใส่ที่ GitHub ด้วยตัวเอง

```bash
sudo -u muay ssh-keygen -t ed25519 -f /srv/muay/.ssh/id_ed25519 -N ""
```

```bash
sudo -u muay sh -c 'ssh-keyscan github.com >> /srv/muay/.ssh/known_hosts'
```

```bash
sudo cat /srv/muay/.ssh/id_ed25519.pub
```

คัดลอกบรรทัดที่ได้ไปที่ GitHub → repo `ragrebuildproject` → Settings → Deploy keys → Add deploy key
(ไม่ต้องติ๊ก Allow write access)

### 3.4 ดึงโค้ด (เฉพาะโฟลเดอร์ของเกมนี้) และ build

แทน `<branch>` ด้วยชื่อ branch ที่ใช้อยู่ ตอนนี้คือ `claude/ecstatic-cray-ijhpj1` (เมื่อรวมเข้า `main` แล้วค่อยเปลี่ยนเป็น `main`)

```bash
sudo -u muay git clone --depth 1 --filter=blob:none --sparse --single-branch --branch <branch> git@github.com:suthipongs10-a11y/ragrebuildproject.git /srv/muay/repo
```

```bash
sudo -u muay git -C /srv/muay/repo sparse-checkout set muay-manager
```

```bash
cd /srv/muay/repo/muay-manager/prototypes/fight3d && sudo -u muay npm ci && sudo -u muay node build.mjs
```

build ใช้เวลาไม่ถึงนาที ได้ `dist/site/` (ไฟล์เกมรวมราว 27 MB)

### 3.5 เปิดเซิร์ฟเวอร์เกมด้วย systemd

```bash
sudo cp /srv/muay/repo/muay-manager/prototypes/fight3d/server/muay-manager.service /etc/systemd/system/
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now muay-manager
```

```bash
curl http://127.0.0.1:8787/api/health
```

ต้องได้ `{"ok":true,"now":...}` ถ้าพอร์ต 8787 ชนกับโปรแกรมอื่น แก้ `PORT=` ในไฟล์ service และเลขเดียวกันใน nginx (ข้อ 3.6)

### 3.6 nginx และ HTTPS

```bash
sudo cp /srv/muay/repo/muay-manager/prototypes/fight3d/server/nginx-site.conf /etc/nginx/sites-available/muay-manager
```

แก้ `server_name muay.example.com;` ในไฟล์นั้นเป็นโดเมนย่อยจริง แล้ว

```bash
sudo ln -s /etc/nginx/sites-available/muay-manager /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
```

```bash
sudo certbot --nginx -d muay.example.com
```

เกมต้องเปิดผ่าน **HTTPS** มือถือจึงจะติดตั้งลงหน้าจอหลักได้ เปิด `https://โดเมนย่อย/` บนมือถือ ควรเห็นหน้าสร้างนักมวย

### 3.7 อัปเดตเองจาก GitHub (ไม่บังคับ แนะนำช่วงทดสอบ)

```bash
sudo cp /srv/muay/repo/muay-manager/prototypes/fight3d/server/muay-update.service /srv/muay/repo/muay-manager/prototypes/fight3d/server/muay-update.timer /etc/systemd/system/
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now muay-update.timer
```

ทุก 5 นาที เครื่องจะถาม GitHub ถ้า branch มีของใหม่จะดึง build แล้วเปิดเซิร์ฟเวอร์ใหม่ (หยุดไม่ถึง 2 วินาที)
เกมที่ผู้เล่นเปิดค้างไว้จะเห็นเลขรุ่นใหม่ใน 2 นาทีและโหลดตัวเองใหม่เมื่อไม่ได้อยู่ระหว่างชก

อัปเดตทันทีด้วยมือ:

```bash
sudo /srv/muay/repo/muay-manager/prototypes/fight3d/server/update.sh
```

ถ้าขึ้นข้อความว่า branch บน GitHub ไม่ต่อจากของในเครื่อง (เกิดเมื่อ branch ถูกเริ่มใหม่หลังรวมเข้า main) ให้รันครั้งเดียว:

```bash
sudo /srv/muay/repo/muay-manager/prototypes/fight3d/server/update.sh --reset
```

**อย่าแก้ไฟล์ในโฟลเดอร์ `/srv/muay/repo` บนเซิร์ฟเวอร์ด้วยมือ** ให้แก้ผ่าน GitHub เสมอ (`--reset` จะทิ้งสิ่งที่แก้ไว้ในโฟลเดอร์นั้น)

## 4. ตรวจหลังติดตั้ง

| ตรวจ | ผลที่ควรได้ |
|---|---|
| เปิด `https://โดเมนย่อย/` บนมือถือ | หน้าสร้างนักมวย เลขรุ่นมุมบนตรงกับที่ประกาศ |
| สร้างนักมวยสองเครื่อง แล้วดูแท็บอันดับ | เห็นกันและกัน มีจุดสถานะออนไลน์ |
| ท้าชกเดี๋ยวนี้ระหว่างสองเครื่อง | ขึ้นเวทีพร้อมกัน ผลตรงกัน |
| ตั้งค่า → ขอรหัสย้ายเครื่อง แล้วใส่ที่เครื่องอื่น | นักมวยตามไปเครื่องใหม่ เครื่องเก่าบอกว่าย้ายแล้ว |
| `https://โดเมนย่อย/privacy.html` | หน้านโยบายความเป็นส่วนตัว |

ชุดทดสอบอัตโนมัติจากเครื่องพัฒนา ชี้มาที่ VPS ได้ (สร้างผู้เล่นทดสอบแล้วลบเองเมื่อจบ):

```bash
SITE=https://muay.example.com/ node tools/e2e/account.mjs
```

## 5. ดูแลประจำ

| งาน | คำสั่ง |
|---|---|
| ดู log สด | `journalctl -u muay-manager -f` |
| เปิดใหม่ | `sudo systemctl restart muay-manager` |
| ดู log การอัปเดต | `journalctl -u muay-update -n 30` |
| รายชื่อนักมวย | `sudo -u muay sqlite3 /srv/muay/data/muay.db "SELECT json_extract(data,'$.name'), json_extract(data,'$.rp') FROM docs WHERE coll='board' ORDER BY 2 DESC"` |
| error จากเครื่องผู้เล่น 20 รายการล่าสุด | `sudo -u muay sqlite3 /srv/muay/data/muay.db "SELECT datetime(t/1000,'unixepoch','+7 hours'), ver, substr(msg,1,200) FROM logs ORDER BY id DESC LIMIT 20"` |

(`sqlite3` ลงด้วย `sudo apt-get install -y sqlite3` ใช้ดูข้อมูลเท่านั้น เกมไม่ต้องใช้)

## 6. ข้อมูลและการสำรอง

- ข้อมูลทั้งหมดอยู่ในไฟล์ `/srv/muay/data/muay.db` (มีไฟล์คู่ `-wal` `-shm` ขณะรัน)
- เซิร์ฟเวอร์สำรองเองวันละชุดไว้ที่ `/srv/muay/data/backup/muay-ปปปป-ดด-วว.db` เก็บ 7 วันล่าสุด
- กู้คืน: `sudo systemctl stop muay-manager` → คัดลอกไฟล์สำรองทับ `muay.db` (ลบไฟล์ `-wal` `-shm` ถ้ามี) → `sudo systemctl start muay-manager`
- สำรองออกนอกเครื่อง: คัดลอกโฟลเดอร์ `backup/` ไปที่อื่นเป็นระยะ หรือใช้ระบบ backup ของ DigitalOcean

## 7. ความปลอดภัยที่ตั้งไว้ให้แล้ว

- เซิร์ฟเวอร์เกมฟังเฉพาะ `127.0.0.1` เข้าจากภายนอกได้ทาง nginx เท่านั้น
- รันด้วยผู้ใช้ `muay` ที่ไม่มีสิทธิ์อื่นในเครื่อง จำกัดแรม 400 MB และ CPU 80% ของหนึ่งคอร์ (ไม่แย่งเว็บอื่น)
- จำกัด 1,800 คำขอ API ต่อนาทีต่อหนึ่ง IP (ปรับด้วย `MUAY_RATE` ในไฟล์ service) และรับข้อมูลครั้งละไม่เกิน 300 KB
- ผู้เล่นแก้ได้เฉพาะข้อมูลของตัวเอง กุญแจของผู้เล่นเก็บในฐานข้อมูลเป็นค่าแฮช
- **ยังไม่ได้ทำ:** เซิร์ฟเวอร์เป็นผู้ตัดสินผลชก (แผนใน `SERVER_WORK_PLAN.md`) ตอนนี้ผู้เล่นที่แก้โค้ดในเครื่องตัวเองยังโกงค่าพลังได้
  เหมาะกับการทดสอบในกลุ่มคนรู้จัก ยังไม่เหมาะกับการเปิดสาธารณะที่มีรางวัล

## 8. ผู้เล่นที่อยู่บนเว็บ Cloudflare เดิม

สำหรับการทดสอบ 10–15 คน **ให้เริ่มฐานข้อมูลใหม่บน VPS** ง่ายและสะอาดที่สุด ผู้เล่นเดิมบน `muay-manager.pages.dev` ยังเล่นที่เดิมได้ตามปกติ

ทำไมย้ายทีละคนไม่ได้: กุญแจของผู้เล่นเก็บในเบราว์เซอร์ผูกกับที่อยู่เว็บ และรหัสย้ายเครื่องใช้ได้ภายในเซิร์ฟเวอร์เดียวกันเท่านั้น

ถ้าวันหนึ่งต้องการยกข้อมูลทั้งหมดมา (เช่น จะชี้โดเมนเดิมมาที่ VPS):

1. ส่งออกจาก Cloudflare: `npx wrangler d1 export muay-manager --remote --output muay.sql` (ผู้ช่วยทำให้ได้จากเซสชันคลาวด์)
2. บน VPS หยุดเซิร์ฟเวอร์ แล้วนำเข้า: `sudo -u muay sqlite3 /srv/muay/data/muay.db < muay.sql`
3. เปิดเซิร์ฟเวอร์ แล้วชี้โดเมนเดิมมาที่ VPS ผู้เล่นจะใช้กุญแจเดิมในเบราว์เซอร์ต่อได้

## 9. เมื่อทำแอป iOS / Android

ตั้ง `window.MUAY_API = 'https://โดเมนย่อย/api'` และ `window.MUAY_WEB = 'https://โดเมนย่อย'` ในตัวห่อแอป (ดู `APP_BUILD_GUIDE.md`)
เซิร์ฟเวอร์รับคำขอข้ามที่มาอยู่แล้ว ไม่ต้องตั้งค่าเพิ่ม
