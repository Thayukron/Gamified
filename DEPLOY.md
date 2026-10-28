# 🚀 การติดตั้งและ Deploy ด้วย Docker

> เฟส 3: auth/account/student ย้ายเป็น Nitro รวม 18/86 endpoints แล้ว ดู [สถานะและวิธีทดลอง](docs/migration/phase3-game.md) ใช้ MariaDB ในเครื่อง ไม่ต้อง Docker สำหรับส่วนที่ย้ายแล้ว

> งานย้าย Nuxt 3 (2026-10-29): เป้าหมายใหม่เป็น Node.js + MariaDB service โดยตรง เฟส 2 รัน API auth/account ได้แล้วด้วยฐานใหม่ในเครื่อง port 3306 ดู [วิธีรันแบบไม่ใช้ Docker](docs/migration/phase2-foundation.md) ระบบ Nuxt ยังย้ายไม่ครบทุก API จึงยังไม่ใช่ replacement สำหรับ production ทั้งระบบ ขั้นตอนด้านล่างสำหรับ PHP deployment เดิม

ระบบมี 3 container ทำงานร่วมกัน สั่งรันด้วยคำสั่งเดียว

| container | หน้าที่ | ภายใน |
|---|---|---|
| `web` | หน้าเว็บ (Nuxt build แล้ว) + ส่งต่อ `/api` ไปยัง API | Nginx |
| `api` | REST API | PHP 8.2 + Apache |
| `db` | ฐานข้อมูล | MariaDB 11.4 |

ผู้ใช้เปิดแค่ `http://<เซิร์ฟเวอร์>:8090` — API อยู่ใต้ `/api` ของเว็บเดียวกัน (ไม่ต้องตั้ง CORS)

---

## 1. ติดตั้งครั้งแรก

ต้องมี **Git** และ **Docker** (Docker Engine + Compose v2 บน Linux หรือ Docker Desktop บน Windows)

```bash
git clone https://github.com/Thayukron/Gamified.git
cd Gamified
cp .env.example .env
nano .env            # ตั้ง DB_PASSWORD, DB_ROOT_PASSWORD ให้เดายาก · ตรวจ ACADEMIC_YEAR / SEMESTER
docker compose up -d --build
```

เปิด `http://<เซิร์ฟเวอร์>:8090` → เข้าสู่ระบบ `admin` / `admin1234` → ระบบบังคับให้ตั้งรหัสผ่านใหม่ทันที
(หรือกำหนด `ADMIN_PASSWORD` ใน `.env` ก่อนติดตั้ง)

จากนั้น: หน้าแอดมิน → **นำเข้าข้อมูล** (แผนก ครู นักศึกษา พร้อมกลุ่มเรียน) → ครูเข้าไปสร้างรายวิชาของตนเอง

> ทดลองระบบแบบมีข้อมูลตัวอย่าง: ตั้ง `SEED_DEMO=1` **ก่อน**สั่ง `up` ครั้งแรก
> (ครู `teacher1`/`teacher1234`, นักศึกษา `student001`–`046`/`student1234`)

---

## 2. อัปเดตเวอร์ชันใหม่ (deploy ผ่าน git)

```bash
cd Gamified
git pull
docker compose up -d --build
```

- ข้อมูลอยู่ใน volume (`db_data`, `api_storage`) — **ไม่หายเมื่อ build ใหม่**
- ทุกครั้งที่ API เริ่มทำงาน `backend/database/install.php` จะตรวจฐานข้อมูล:
  ว่าง → สร้างตาราง · มีข้อมูลแล้ว → ใช้เฉพาะไฟล์ปรับโครงสร้างใหม่ใน `backend/database/upgrades/` (**ไม่ลบข้อมูล**)
- ⚠️ ห้ามรัน `migrate.php` บนเซิร์ฟเวอร์จริง (ล้างข้อมูลทั้งหมด)

---

## 3. สำรองและกู้คืนข้อมูล 💾

ต้องสำรอง **2 อย่างคู่กัน**: ฐานข้อมูล + `app.key` (กุญแจเข้ารหัส API Key ของครู — ถ้าหาย ครูต้องกรอก Key ใหม่)

```bash
# สำรอง
docker compose exec -T db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction "$MARIADB_DATABASE"' > backup-$(date +%F).sql
docker compose cp api:/var/www/html/storage/app.key ./app.key.backup

# กู้คืน
docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' < backup-2026-09-28.sql
docker compose cp ./app.key.backup api:/var/www/html/storage/app.key
docker compose exec api chown www-data:www-data storage/app.key
docker compose restart api
```

แนะนำตั้ง cron สำรองทุกคืน และเก็บไฟล์ไว้นอกเครื่องเซิร์ฟเวอร์

---

## 4. คำสั่งที่ใช้บ่อย 🛠️

| ต้องการ | คำสั่ง |
|---|---|
| ดูสถานะ | `docker compose ps` |
| ดู log API | `docker compose logs -f api` |
| หยุดระบบ (ข้อมูลยังอยู่) | `docker compose down` |
| เริ่มระบบ | `docker compose up -d` |
| แอดมินลืมรหัสผ่าน | `docker compose exec api php bin/reset-password.php admin` → รหัสชั่วคราว = `admin` |
| เปลี่ยนภาคเรียน | แก้ `ACADEMIC_YEAR` / `SEMESTER` ใน `.env` → `docker compose up -d` |
| ดูฐานข้อมูลด้วย HeidiSQL/DBeaver (บนเซิร์ฟเวอร์) | `127.0.0.1:3320` ผู้ใช้/รหัสตาม `.env` |

⚠️ `docker compose down -v` **ลบข้อมูลทั้งหมด** (ลบ volume) — ห้ามใช้บนเซิร์ฟเวอร์จริง

---

## 5. ใช้งานจริงผ่านอินเทอร์เน็ต 🔒

- ควรเปิดผ่าน **HTTPS** — วาง reverse proxy (เช่น Nginx/Caddy ของเซิร์ฟเวอร์ หรือ Cloudflare Tunnel) ไว้หน้า `web:8090`
- เปิด firewall เฉพาะพอร์ตเว็บ ไม่ต้องเปิดพอร์ตฐานข้อมูล (3320 ผูกกับ 127.0.0.1 อยู่แล้ว)
- เปลี่ยนรหัสผ่านใน `.env` จากค่าตัวอย่างทุกตัว

---

## 6. ฐานข้อมูลชุดเดียว (เครื่องพัฒนา = Docker)

ตั้งแต่ 2026-10-19 ใช้ฐานข้อมูลชุดเดียว: ชุดพัฒนา (`php -S` พอร์ต 8100 ผ่าน `start-dev.ps1`) ต่อ MariaDB ใน Docker ทาง `127.0.0.1:DB_PUBLISH_PORT`
ด้วยค่าใน `.env` (ดู `backend/config.php`) และ `backend/storage/app.key` ต้องเป็นไฟล์เดียวกับใน container (ให้ถอดรหัส API Key ของครูได้):

```bash
docker compose cp api:/var/www/html/storage/app.key backend/storage/app.key
```
