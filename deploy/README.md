# deploy/

ชุดไฟล์สำหรับเอาเซิร์ฟเวอร์ขึ้น VPS อ่านขั้นตอนทั้งหมดที่ `docs/PHASE3-VPS.md`

| ไฟล์ | ใช้ที่ไหน | ทำอะไร |
|---|---|---|
| `publish.ps1` | เครื่อง Windows ที่ build | สร้าง `rorebuild-server.zip` (เซิร์ฟเวอร์ + ServerData + walkdata + WebClient + ไฟล์บัญชี GM) |
| `vps-setup.sh` | VPS ครั้งแรก | ลง .NET 9, nginx, certbot สร้าง user/โฟลเดอร์ ติดตั้ง service และ nginx site |
| `nginx/rorebuild.conf` | VPS | reverse proxy ทั้งหน้าเว็บและ WebSocket `/ws` |
| `systemd/rorebuild.service` | VPS | รันเซิร์ฟเวอร์เป็น service รีสตาร์ตเองเมื่อล้ม |
| `backup.sh` | VPS (cron ทุก 6 ชม.) | สำรอง SQLite แบบปลอดภัยขณะรัน เก็บ 14 วัน |
