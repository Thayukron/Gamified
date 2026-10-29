# Gamified Universal Student Profiling System

ระบบประเมินโปรไฟล์ผู้เรียนผ่านเกมจำลองสถานการณ์ (VARK, RIASEC, Mindset) พร้อมแดชบอร์ดครูและ AI ช่วยวิเคราะห์การสอน
ดูข้อกำหนดทั้งหมดใน [requiments.md](requiments.md)

## Tech Stack
- **Frontend:** Nuxt 3 (SPA), Pinia, Tailwind CSS — ``
- **Backend:** Nitro (Nuxt 3 server) TypeScript — `server/`
- **Database:** MySQL / MariaDB — `database/schema.sql`

## 🐳 รันด้วย Docker (แนะนำ · ใช้ deploy จริง)
```bash
cp .env.example .env     # ตั้งรหัสผ่านฐานข้อมูล
docker compose up -d --build
```
เปิด http://localhost:8090 → `admin` / `admin1234` (ระบบบังคับเปลี่ยนรหัสครั้งแรก) · อัปเดต: `git pull && docker compose up -d --build`
รายละเอียดการติดตั้ง สำรอง/กู้คืน และ deploy: [DEPLOY.md](DEPLOY.md) · คู่มือเปิด-ปิดระบบและ Cloudflare Tunnel: [Manual.md](Manual.md)

## เริ่มต้นใช้งาน (Development)
**ฐานข้อมูลชุดเดียวกั้บ Docker เสมอ** (MariaDB พอรต์ 127.0.0.1:3306 ค่าเชื่่อมต้ออ่านจาก `.env`) — ข้อมูลท่ีเห็่นตอนพัฒนา = ข้อมูลท่ีผ้้ใช้จริงเห็่นท่ี http://localhost:8090
**ฐานข้อมูลชุดเดียวกั้บ Docker เสมอ** (MariaDB พอรต์ 127.0.0.1:3306 ค่าเชื่่อมต้ออ่านจาก `.env`) — ข้อมูลท่ีเห็่นตอนพัฒนา = ข้อมูลท่ีผ้้ใช้จริงเห็่นท่ี http://localhost:8090
# 1) ครั้่งแรก: ตั้่งค่า .env แล้้วเปิิด Docker (สร้้างฐานข้อมูลให้อัตโนมัตติ)
```powershell
# 1) ครั้งแรก: ตั้งค่า .env แล้วเปิด Docker (สร้างฐานข้อมูลให้อัตโนมัติ)
cp .env.example .env; docker compose up -d --build
# 3) เปิิดชุดพัฒนา (Nuxt dev 3100 — เสิ้่ง API เองท่ี /api ต้อฐานข้อมูลเดีียว)
cd frontend; npm install; cd ..
# 3) เปิิดชุดพัฒนา (Nuxt dev 3100 — เสิ้่ง API เองท่ี /api ต้อฐานข้อมูลเดีียว)
./start-dev.ps1
⚠ ฐานข้อมูลเดีียว = ข้อมูลจริง — ห้า้แก้/ลบข้อมูลโดยไม่ถาม · อัปเกรดโครงสร้้าง: `node scripts/upgrade-db.mjs` (รันให้อัตโนมัตติเมื่่อ deploy)

⚠ ฐานข้อมูลเดีียว = ข้อมูลจริง — ห้า้แก้/ลบข้อมูลโดยไม่ถาม · อัปเกรดโครงสร้้าง: `node scripts/upgrade-db.mjs` (รันให้อัตโนมัตติเมื่่อ deploy)

เปิด http://localhost:3100

| บทบาท | ชื่อผู้ใช้ | รหัสผ่าน |
|---|---|---|
| ผู้ดูแลระบบ | admin | admin1234 |
| ครู | teacher1 | teacher1234 |
| นักเรียน | student001 – student010 | student1234 |

ค่าเชื่อมต้อฐานข้อมูลมาจาก `.env` (ชุดเดียวกับ Docker)

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
| GET/POST | /api/teacher/courses/{id}/plans · GET …/plans/full | teacher (เฉพาะวิชาที่สอน), admin — แผนการจัดการเรียนรู้รายหน่วย |
| GET/PUT/DELETE | /api/teacher/plans/{pid} · POST …/{pid}/draft (source: guide \| ai) | teacher (เฉพาะวิชาที่สอน), admin |
| GET/PUT | /api/teacher/courses/{id}/book · POST …/book/draft | teacher (เฉพาะวิชาที่สอน), admin — เล่มแผนระดับรายวิชา |
| GET/POST | /api/teacher/plans/{pid}/sheets · GET/PUT/DELETE /api/teacher/sheets/{sid} · POST …/{sid}/draft | teacher (เฉพาะวิชาที่สอน), admin — ใบความรู้/ใบงาน/ใบกิจกรรม/ใบมอบหมายงาน/แบบประเมิน |
| GET | /api/teacher/meta · /api/teacher/students?q=&group=&course= | teacher, admin |
| POST | /api/teacher/courses | teacher, admin (สร้างวิชาของตนเอง + class_groups) |
| PUT/DELETE | /api/teacher/courses/{id} | teacher (เฉพาะวิชาที่สอน), admin |
| GET/POST | /api/teacher/courses/{id}/students · DELETE …/students/{sid} | teacher (เฉพาะวิชาที่สอน), admin |
| GET | /api/teacher/courses/{id}/dashboard | teacher (เฉพาะวิชาที่สอน), admin |
| GET | /api/teacher/courses/{id}/guide | teacher (เฉพาะวิชาที่สอน), admin |
| PUT | /api/teacher/courses/{id}/context | teacher (เฉพาะวิชาที่สอน), admin |
| GET/PUT/DELETE | /api/me/ai | teacher, admin (API Key ของตนเอง) |
| POST | /api/me/ai/test · PUT /api/me/ai/model | teacher, admin |
| GET/POST | /api/teacher/courses/{id}/ai · GET …/ai/all | teacher (เฉพาะวิชาที่สอน), admin |
| GET/PUT | /api/admin/ai · PUT /api/admin/ai/teachers/{id} | admin |
| POST | /api/teacher/courses/{id}/groups/preview | teacher (เฉพาะวิชาที่สอน), admin |
| GET/PUT | /api/teacher/courses/{id}/groups | teacher (เฉพาะวิชาที่สอน), admin |
| GET | /api/teacher/courses/{id}/report | teacher (เฉพาะวิชาที่สอน), admin |
| GET/PUT | /api/admin/institution | admin |
| POST | /api/admin/import/preview · /api/admin/import/commit | admin (นำเข้าแผนก/ครู/นักศึกษา/รายวิชา/การลงทะเบียน) |
| GET | /api/admin/overview · /api/admin/users?q=&role= | admin |
| POST | /api/admin/users/{id}/reset-password | admin (รีเซ็ตเป็นชื่อผู้ใช้/รหัสนักศึกษา) |
| DELETE | /api/admin/courses/{id} | admin |
| GET/PUT | /api/me/profile · PUT /api/me/password | ทุก role (บัญชีของตนเอง) |
| POST | /api/auth/forgot | สาธารณะ (ส่งคำขอรีเซ็ต) |
| PUT | /api/admin/users/{id} · GET /api/admin/reset-requests · POST …/{id}/dismiss | admin |
| POST | /api/teacher/courses/{id}/students/{sid}/reset-password | teacher (ผู้เรียนในวิชาที่สอน), admin |