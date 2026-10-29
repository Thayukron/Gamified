# 🚀 การติดตังและ Deploy (Node + MariaDB)

> เฟส 6 (2026-10-29): ถอด PHP/Docker ออกทังหมด — ระบบรันดวย Node 22 (Nuxt/Nitro) ตัวเดียว
> ทังเว็บและ API (86 endpoints) + MariaDB service ในเครื่อง · ดูประวัติการย้าย API ใน [docs/dev/migration/](migration/)

ระบบมี 2 ส่วนทำงานร่วมกกัน:

| ส่วน | หน้าที่ | ภายใน |
|---|---|---|
| แอป (Node) | หน้าเว็บ (Nuxt build) + REST API ทุก endpoint | Node 22 (Nitro) |
| ฐานข้อมูล | MariaDB service ในเครื่อง | `127.0.0.1:3306` (ค่าใน `.env`) |

ผู้ใช้เปิดแค่ `http://<เครื่อง>:<PORT>` — API อยู่ใต้ `/api` ของเว็บเดียวกัน (ไม่ต้องตั้ง CORS)
- **Production:** รัน `npm start` โดยอ่าน `PORT` จาก `.env` → `http://localhost:8090`
- **Development:** `npm run dev` → `http://localhost:8090`

---

## 1. ติดตังครังแรก

ตองมี **Git**, **Node.js 22+** และ **MariaDB** (service ในเครื่อง หรือนำไปตังบนเซิรฟ์เวอร)

```sh
git clone https://github.com/rungrot-muangchalerm/gamefile.git
cd gamefile
node -e "require('node:fs').copyFileSync('.env.example', '.env')"
# เปิด .env ด้วย editor แล้วตั้ง DB_PASSWORD และ PORT
npm install
npm run db:init -- --create-empty   # เฉพาะฐานวาง: สรางตาราง + บัญชี admin + archetypes + scenarios
```

รันแอป production:

```sh
npm run build
npm start
```

เปิด `http://<เครื่อง>:8090` → เขาสู่ระบบ `admin` / `admin1234` → ระบบบังคัับใหตังรหัสผานใหมทันที
(หรือนิยาม `ADMIN_PASSWORD` ใน `.env` กอนติดตั้ง)

จากนั้้น: หน้าแอดมิน → **นำเข้าข้อมูล** (แผนก ครู นักเรเรียน พรอมกลุ่่มเรียน) → ครูเข้่าไปสร้างรายวิชาของตนเอง

> ระบบ Node ไมมี `SEED_DEMO` — ตองการขอมูลตัวอยางใหสรางบัญชีทดสอบแลวนำเข้าในหนาแอดมิน

---

### ตั้งพอร์ต (Windows / Linux)

คำสั่งเริ่มระบบใช้เหมือนกันทั้งสองระบบปฏิบัติการ โดยรันจากโฟลเดอร์โปรเจกต์ และตั้งค่าใน `.env`:

```dotenv
PORT=8090
```

- `npm start` อ่าน `PORT` จาก `.env` ตอนเริ่มโปรเซส
- `npm run dev` อ่าน `PORT` ตัวเดียวกับ production (ค่าเริ่มต้นของ dev คือ 8090)
- ตัวเลข URL ในคู่มือเป็นตัวอย่างตามค่าข้างต้น ถ้าเปลี่ยนพอร์ตให้ปรับ URL และ Tunnel ตามด้วย
- Environment ของเครื่องมีลำดับความสำคัญเหนือ `.env` หากตั้ง `PORT` ไว้ภายนอก ต้องแก้ค่านั้นด้วย
- เปลี่ยนพอร์ตแล้วรีสตาร์ตได้เลย ไม่ต้อง build ใหม่; เปลี่ยนโค้ดต้อง build ใหม่

## 2. อัปเดตเวอรชันใหม (deploy ผาน git)

```sh
cd gamefile
git pull
npm install
npm run db:upgrade    # รัน upgrades ตาม ledger (ไมลบขอมูล)
npm run build
# รีสตาร์ตแอปด้วยวิธีที่ตั้งไว้บนเซิร์ฟเวอร์
```

- ขอมูลอยในฐานขอมูล MariaDB — **ไมหายเมื่อ build ใหม**
- ไฟล `storage/app.key` (กุญแจเขารหัส API Key ของครู) อยนอกโฟลเดอร build — **ไมหายเมื่อ build ใหม**
- ⚠️ หามรัน `init-db.mjs` โดยไมมี `--create-empty` บนฐานที่มีขอมูล (สคริปตปฏิเสธเอง)

---

## 3. สำรองและกู้คืนขอมูล

ตองสำรอง **2 อยางคูกัน**: ฐานขอมูล + `storage/app.key` (ถาหาย ครูตองกรอก Key ใหมทุกคน)

### บนเครื่องพัฒนา (Windows) — ใชสคริปตพรอม

```powershell
.\tools\backup.ps1 -Tag phase6        # → backups\gamified-<stamp>.sql + app.key-<stamp>.key
.\tools\restore.ps1 -BackupFile backups\gamified-<stamp>.sql   # กูคืนฐาน + app.key (ถามยืนยัน)
```

### บนเซิรฟ์เวอร (Linux)

```bash
# สำรอง
mariadb-dump -h 127.0.0.1 -P 3306 -u <DB_USER> -p --single-transaction gamified > backup-$(date +%F).sql
cp storage/app.key app.key.backup

# กูคืน
mariadb -h 127.0.0.1 -P 3306 -u <DB_USER> -p gamified < backup-2026-09-28.sql
cp app.key.backup storage/app.key
# รีสตารทกระบวนการ node
```

แนะนำตัง cron สำรองทุกคืน และเก็บไฟลไว้นอกเครื่องเซิรฟ์เวอร

### Rollback เวอรชันโคด

1. สำรองขอมูลกอน (ขอ 3)
2. `git checkout <commit-เกา>` แลว `npm install && npm run build` แลวรีสตารท
3. ถาเวอรชันเก่ายังเปน PHP (กอน 2026-10-29) ใชโคดของ commit นั้น — ฐานขอมูลใชรวมกันได
4. กูคืนขอมูลจาก backup ถาจำเปน

---

## 4. คำสั่งที่ใชบอย

| ตองการ | คำสั่ง |
|---|---|
| รัน production | `npm start` |
| รัน development | `npm run dev` (http://localhost:8090) |
| อัปเกรด schema | `npm run db:upgrade` |
| รีเซ็ตรหัสฉุกระเหิน | `npm run db:reset-password -- <username>` |
| เปลี่ยนภาคเรียน | แก `ACADEMIC_YEAR` / `SEMESTER` ใน `.env` แลวรีสตารท |
| ดูฐานขอมูลดวย HeidiSQL/DBeaver | `127.0.0.1:3306` ใช/รหัสตาม `.env` |

⚠️ หามรันสคริปตลางฐาน (`init-db.mjs --create-empty`) บนฐานที่มีขอมูลจริง

---

## 5. ใชงานจริงผานอินเทอรเน็ต

- ควรเปิดผาน **HTTPS** — วาง reverse proxy (เชน Nginx/Caddy ของเซิรฟ์เวอร หรอ Cloudflare Tunnel) หนา `localhost:8090`
- เปิด firewall เฉพาะพอรตเว็บ ไมตองเปิดพอรตฐานขอมูล (3306 ควรผูกกับ 127.0.0.1 เทานัน)
- เปลี่ยนรหัสผานใน `.env` จากคาตัวอยางทุกตัว

---

## 6. ฐานขอมูลชุดเดียว (เครื่องพัฒนา = ฐานเดียวกับ production)

ตังแตวนที่ 2026-10-19 ใชฐานขอมูลชุดเดียว: ชุดพัฒนาตอ MariaDB เดียวกกันผาน `127.0.0.1:3306`
ดวยคาใน `.env` และ `storage/app.key` ตองเปนไฟลเดียวกับที่ production ใช

- **หามรันสคริปตลางฐาน** บนฐานที่มีผใช (สคริปตปฏิเสธเอง)
- การทดสอบใด ๆ บนเครื่องพัฒนากระทบขอมูลจริง: สำรองกอนดวย `tools/backup.ps1`
