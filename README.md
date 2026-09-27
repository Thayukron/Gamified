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
| GET | /api/student/quests | student |
| GET | /api/student/quests/{id} | student |
| PUT | /api/student/quests/{id}/progress | student |
| POST | /api/student/quests/{id}/complete | student |
| GET | /api/student/results | student |
| GET | /api/student/results/{id} | student |
| GET | /api/student/profile | student |
| GET | /api/student/player | student |
| PUT | /api/student/player/avatar | student |
| GET | /api/teacher/courses | teacher, admin |
| GET | /api/teacher/courses/{id}/dashboard | teacher (เฉพาะวิชาที่สอน), admin |
| GET | /api/teacher/courses/{id}/guide | teacher (เฉพาะวิชาที่สอน), admin |
| PUT | /api/teacher/courses/{id}/context | teacher (เฉพาะวิชาที่สอน), admin |
| GET/PUT/DELETE | /api/me/ai | teacher, admin (API Key ของตนเอง) |
| POST | /api/me/ai/test · PUT /api/me/ai/model | teacher, admin |
| GET/POST | /api/teacher/courses/{id}/ai · GET …/ai/all | teacher (เฉพาะวิชาที่สอน), admin |
| GET/PUT | /api/admin/ai · PUT /api/admin/ai/teachers/{id} | admin |
