# 🚀 การติดตังและ Deploy (Node + MariaDB)

> เฟส 6 (2026-10-29): ถอด PHP/Docker-API ออกแล้ว — ระบบรันดวย Node 22 (Nuxt/Nitro) ตัวเดียว
> ทั้งเว็บและ API (86 endpoints) + MariaDB 11.4 · ดูประวัติการย้าย API ใน [docs/migration/](docs/migration/)

ระบบมี 2 container ทำงานร่วมกัน สั่งรันด้วยคำสั่งเดียว

| container | หน้าที่ | ภายใน |
|---|---|---|
| `web` | หน้าเว็บ (Nuxt build) + REST API ทุก endpoint | Node 22 (Nitro) |
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

เมื่อ container `web` เริ่มทำงานจะรัน `scripts/init-db.mjs` อัตโนมัติ:
- ฐานว่าง → สร้างตารางทั้งหมด + บัญชี `admin` + archetypes + scenarios สากล
- ฐานมีข้อมูลแล้ว → รันเฉพาะไฟล์ upgrade ใน `frontend/database/upgrades/` (**ไม่ลบข้อมูล**)

เปิด `http://<เซิร์ฟเวอร์>:8090` → เข้าสู่ระบบ `admin` / `admin1234` → ระบบบังคับให้ตั้งรหัสผ่านใหม่ทันที
(หรือกำหนด `ADMIN_PASSWORD` ใน `.env` ก่อนติดตั้ง)

จากนั้น: หน้าแอดมิน → **นำเข้าข้อมูล** (แผนก ครู นักเรียน พร้อมกลุ่มเรียน) → ครูเข้าไปสร้างรายวิชาของตนเอง

> ระบบ Node ไม่มี `SEED_DEMO` — ต้องการข้อมูลตัวอย่างให้สร้างบัญชีทดสอบแล้วนำเข้าในหน้าแอดมิน

---

## 2. อัปเดตเวอร์ชันใหม่ (deploy ผ่าน git)

```bash
cd Gamified
git pull
docker compose up -d --build
```

- ข้อมูลอยู่ใน volume (`db_data`, `app_storage`) — **ไม่หายเมื่อ build ใหม่**
- ไฟล์ `app.key` (กุญแจเข้ารหัส API Key ของครู) อยู่ใน volume `app_storage` เช่นกัน
- ⚠️ ห้ามรัน `init-db.mjs` โดยไม่มี `--create-empty` บนฐานที่มีข้อมูล (สคริปต์ปฏิเสธเอง)

---

## 3. สำรองและกู้คืนข้อมูล 💾

ต้องสำรอง **2 อย่างคู่กัน**: ฐานข้อมูล + `app.key` (ถ้าหาย ครูต้องกรอก Key ใหม่ทุกคน)

### บนเครื่องพัฒนา (Windows) — ใช้สคริปต์พร้อม

```powershell
.\tools\backup.ps1 -Tag phase6        # → backups\gamified-<stamp>.sql + app.key-<stamp>.key
.\tools\restore.ps1 -BackupFile backups\gamified-<stamp>.sql   # กู้คืนฐาน + app.key (ถามยืนยัน)
```

### บนเซิร์ฟเวอร์ (Linux)

```bash
# สำรอง
docker compose exec -T db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction "$MARIADB_DATABASE"' > backup-$(date +%F).sql
docker compose cp web:/app/storage/app.key ./app.key.backup

# กู้คืน
docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' < backup-2026-09-28.sql
docker compose cp ./app.key.backup web:/app/storage/app.key
docker compose restart web
```

แนะนำตั้ง cron สำรองทุกคืน และเก็บไฟล์ไว้นอกเครื่องเซิร์ฟเวอร์

### Rollback เวอร์ชันโค้ด

1. สำรองข้อมูลก่อน (ข้อ 3)
2. `git checkout <commit-เก่า>` แล้ว `docker compose up -d --build`
3. ถ้าเวอร์ชันเก่ายังเป็น PHP (ก่อน 2026-10-29) ใช้ `docker-compose.yml` ของ commit นั้น — ฐานข้อมูลใช้ร่วมกันได้
4. กู้คืนข้อมูลจาก backup ถ้าจำเป็น

---

## 4. คำสั่งที่ใช้บ่อย 🛠️

| ต้องการ | คำสั่ง |
|---|---|
| ดูสถานะ | `docker compose ps` |
| ดู log | `docker compose logs -f web` |
| หยุดระบบ (ข้อมูลยังอยู่) | `docker compose down` |
| เริ่มระบบ | `docker compose up -d` |
| อัปเกรด schema โดยตรง | `docker compose exec web node scripts/upgrade-db.mjs` |
| เปลี่ยนภาคเรียน | แก้ `ACADEMIC_YEAR` / `SEMESTER` ใน `.env` → `docker compose up -d` |
| ดูฐานข้อมูลด้วย HeidiSQL/DBeaver (บนเซิร์ฟเวอร์) | `127.0.0.1:3320` ผู้ใช้/รหัสตาม `.env` |

⚠️ `docker compose down -v` **ลบข้อมูลทั้งหมด** (ลบ volume) — ห้ามใช้บนเซิร์ฟเวอร์จริง

---

## 5. ใช้งานจริงผ่านอินเทอร์เน็ต 🔒

- ควรเปิดผ่าน **HTTPS** — วาง reverse proxy (เช่น Nginx/Caddy ของเซิร์ฟเวอร์ หรือ Cloudflare Tunnel) หน้าง `web:8090`
- เปิด firewall เฉพาะพอร์ตเว็บ ไม่ต้องเปิดพอร์ตฐานข้อมูล (3320 ผูกกับ 127.0.0.1 อยู่แล้ว)
- เปลี่ยนรหัสผ่านใน `.env` จากค่าตัวอย่างทุกตัว

---

## 6. ฐานข้อมูลชุดเดียว (เครื่องพัฒนา = ฐานเดียวกับ production)

ตั้งแต่วันที่ 2026-10-19 ใช้ฐานข้อมูลชุดเดียว: ชุดพัฒนาต่อ MariaDB เดียวกันผ่าน `127.0.0.1:DB_PUBLISH_PORT`
ด้วยค่าใน `.env` และ `frontend/storage/app.key` ต้องเป็นไฟล์เดียวกับใน container

- **ห้ามรัน `migrate.php`** (ล้างข้อมูลจริง; สคริปต์ปฏิเสธเมื่อมีผู้ใช้ เว้นแต่ `--wipe-real-data`)
- การทดสอบใด ๆ บนเครื่องพัฒนากระทบข้อมูลจริง: สำรองก่อนด้วย `tools/backup.ps1`
