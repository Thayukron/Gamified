# 🚀 การติดตังและ Deploy (Node + MariaDB)

> เฟส 6 (2026-10-29): ถอด PHP/Docker ออกทังหมด — ระบบรันดวย Node 22 (Nuxt/Nitro) ตัวเดียว
> ทังเว็บและ API (86 endpoints) + MariaDB service ในเครื่อง · ดูประวัติการย้าย API ใน [docs/dev/migration/](migration/)

ระบบมี 2 ส่วนทำงานร่วมกกัน:

| ส่วน | หน้าที่ | ภายใน |
|---|---|---|
| แอป (Node) | หน้าเว็บ (Nuxt build) + REST API ทุก endpoint | Node 22 (Nitro) |
| ฐานข้อมูล | MariaDB service ในเครื่อง | `127.0.0.1:3306` (ค่าใน `.env`) |

ผู้ใช้เปิดแค่ `http://<เครื่อง>:<PORT>` — API อยู่ใต้ `/api` ของเว็บเดียวกัน (ไม่ต้องตั้ง CORS)
- **Production:** รัน `.output/server/index.mjs` ดวย `$env:PORT = '8090'` → `http://localhost:8090`
- **Development:** `npm run dev` → `http://localhost:3100`

---

## 1. ติดตังครังแรก

ตองมี **Git**, **Node.js 22+** และ **MariaDB** (service ในเครื่อง หรือนำไปตังบนเซิรฟ์เวอร)

```powershell
git clone https://github.com/rungrot-muangchalerm/gamefile.git
cd gamefile
Copy-Item .env.example .env
notepad .env            # ตัง DB_PASSWORD ใหเดายาก · ตรวจ ACADEMIC_YEAR / SEMESTER
npm install
npm run db:init -- --create-empty   # เฉพาะฐานวาง: สรางตาราง + บัญชี admin + archetypes + scenarios
```

รันแอป production:

```powershell
npm run build
$env:PORT = '8090'
node --env-file=.env .output/server/index.mjs
```

เปิด `http://<เครื่อง>:8090` → เขาสู่ระบบ `admin` / `admin1234` → ระบบบังคัับใหตังรหัสผานใหมทันที
(หรือนิยาม `ADMIN_PASSWORD` ใน `.env` กอนติดตั้ง)

จากนั้้น: หน้าแอดมิน → **นำเข้าข้อมูล** (แผนก ครู นักเรเรียน พรอมกลุ่่มเรียน) → ครูเข้่าไปสร้างรายวิชาของตนเอง

> ระบบ Node ไมมี `SEED_DEMO` — ตองการขอมูลตัวอยางใหสรางบัญชีทดสอบแลวนำเข้าในหนาแอดมิน

---

## 2. อัปเดตเวอรชันใหม (deploy ผาน git)

```powershell
cd gamefile
git pull
npm install
npm run db:upgrade    # รัน upgrades ตาม ledger (ไมลบขอมูล)
npm run build
# รีสตารทกระบวนการ node (เชน pm2 restart / systemd restart)
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
| รัน production | `$env:PORT = '8090'; node --env-file=.env .output/server/index.mjs` |
| รัน development | `npm run dev` (http://localhost:3100) |
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
