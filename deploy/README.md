# deploy/

ชุดไฟล์สำหรับเอาเซิร์ฟเวอร์ขึ้น VPS อ่านขั้นตอนทั้งหมดที่ `docs/PHASE3-VPS.md`

| ไฟล์ | ใช้ที่ไหน | ทำอะไร |
|---|---|---|
| `publish.ps1` | เครื่อง Windows ที่ build | สร้าง `rorebuild-server.tar` (เซิร์ฟเวอร์ + ServerData + walkdata + WebClient + ไฟล์บัญชี GM) |
| `install-bundle.sh` | VPS ทุกครั้งที่อัปเดต | ล้างโฟลเดอร์ที่มาจาก bundle แล้วแตกไฟล์ ตั้ง owner + สิทธิ์ `.so` แล้วรีสตาร์ต service |
| `vps-setup.sh` | VPS ครั้งแรก | ลง .NET 9, nginx, certbot สร้าง user/โฟลเดอร์ ติดตั้ง service และ nginx site |
| `domain-setup.sh` | VPS ตอนจดโดเมนแล้ว | ชี้โดเมนมาที่เครื่องนี้ ติดตั้งหน้าแรก แล้วขอใบรับรอง SSL ให้ทั้ง 3 ชื่อ |
| `web/index.html` | VPS (หน้าแรก) | หน้ารวมเซิร์ฟเวอร์ เช็คสถานะสดจาก `/status` แล้วลิงก์ไปหน้าเล่น |
| `nginx/rorebuild.conf` | VPS | 2 vhost — โดเมนหลัก = หน้าแรก, `play.` = ตัวเกม + WebSocket `/ws` |
| `systemd/rorebuild.service` | VPS | รันเซิร์ฟเวอร์เป็น service รีสตาร์ตเองเมื่อล้ม |
| `harden.sh` | VPS (รันซ้ำได้) | เปิด firewall, ลง fail2ban, ตั้ง cron backup, เตือน reboot ที่ค้าง |
| `backup.sh` | VPS (cron ทุก 6 ชม.) | สำรอง SQLite แบบปลอดภัยขณะรัน เก็บ 14 วัน |
