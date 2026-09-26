# Gamified Universal Student Profiling System

ระบบประเมินโปรไฟล์ผู้เรียนผ่านเกมจำลองสถานการณ์ (VARK, RIASEC, Mindset) พร้อมแดชบอร์ดครูและ AI ช่วยวิเคราะห์การสอน
ดูข้อกำหนดทั้งหมดใน [requiments.md](requiments.md)

## Tech Stack
- **Frontend:** Nuxt 3 (SPA), Pinia, Tailwind CSS — `frontend/`
- **Backend:** PHP 8.2 RESTful API (ไม่ใช้ framework) — `backend/`
- **Database:** MySQL / MariaDB — `backend/database/schema.sql`

## เริ่มต้นใช้งาน (Development)

```powershell
# 1) ครั้งแรก: สร้างฐานข้อมูล MariaDB แยกเฉพาะโปรเจกต์ (port 3310)
& C:\xampp\mysql\bin\mysql_install_db.exe --datadir=$env:USERPROFILE\.gamified-mysql\data --port=3310
# 2) ติดตั้ง frontend
cd frontend; npm install; cd ..
# 3) เปิด server ทั้งหมด
./start-dev.ps1
# 4) ครั้งแรก: สร้างตาราง + ข้อมูลตัวอย่าง (หลัง DB เปิดแล้ว)
php backend/database/migrate.php
```

เปิด http://localhost:3100

| บทบาท | ชื่อผู้ใช้ | รหัสผ่าน |
|---|---|---|
| ผู้ดูแลระบบ | admin | admin1234 |
| ครู | teacher1 | teacher1234 |
| นักเรียน | student001 – student010 | student1234 |

ตั้งค่า DB อื่นได้ที่ `backend/config.local.php` (คืนค่า array ที่จะ merge ทับ `backend/config.php`)

## API
| Method | Path | สิทธิ์ |
|---|---|---|
| GET | /api/health | - |
| POST | /api/auth/login | - |
| POST | /api/auth/logout | ทุกบทบาท |
| GET | /api/auth/me | ทุกบทบาท |
