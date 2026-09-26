# CLAUDE.md — บริบทโปรเจกต์สำหรับต่อแชท

> ไฟล์นี้เก็บบริบทการสนทนา/การตัดสินใจ เพื่อให้เปิดแชทใหม่แล้วทำงานต่อได้ทันที
> ประวัติการแก้ไขละเอียดอยู่ใน [log.md](log.md) · ข้อกำหนดระบบอยู่ใน [requiments.md](requiments.md)

## ข้อตกลงการทำงานกับผู้ใช้ (ต้องทำทุกครั้ง)
1. สื่อสารเป็นภาษาไทย
2. ทำทีละเฟส → **รันให้ผู้ใช้ดูก่อน** → รอผู้ใช้ตอบรับ แล้วค่อยทำเฟสต่อไป
3. ทุกครั้งที่แก้ไข: บันทึกใน `log.md` + อัปเดตสถานะใน `CLAUDE.md` นี้
4. ทุกครั้งที่แก้ไข: `git commit` และ `git push` ไปที่ `origin main` (https://github.com/Thayukron/Gamified)

## ภาพรวมระบบ
Gamified Universal Student Profiling System — ผู้เรียนเล่นเกม Visual Novel เพื่อวัด VARK / RIASEC / Mindset (Rule-based 100%, ไม่เสียค่า API ระหว่างเล่น)
ครูดูแดชบอร์ด + ใช้ AI (BYOK) แปลผลตามบริบทรายวิชา · แอดมินจัดการข้อมูลส่วนกลาง

## สภาพแวดล้อม Dev (เครื่องผู้ใช้ Windows 11)
| ส่วน | รายละเอียด |
|---|---|
| DB | MariaDB 10.4 จาก XAMPP แต่ใช้ **data dir แยก** `C:\Users\USER\.gamified-mysql\data` **port 3310** (MySQL ของ XAMPP เดิมเสีย: ไฟล์ multi-master.info ใน `C:\xampp\mysql\data` corrupt — ไม่ได้แก้ไฟล์ของ XAMPP) · port 3307 ถูก Docker ใช้อยู่ |
| API | PHP 8.2 built-in server `php -S 127.0.0.1:8000 -t public public/index.php` (ใน `backend/`) |
| Frontend | Nuxt 3.21 dev **port 3100** (port 3000 มีแอปอื่นของผู้ใช้ใช้อยู่) |
| สคริปต์ | `start-dev.ps1` เปิดทั้ง 3 ตัว · `php backend/database/migrate.php` = ล้างและสร้าง DB ใหม่ + seed |
| ทดสอบ E2E | ใช้ playwright-core + Edge (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`) ติดตั้งใน scratchpad ไม่ใส่ในโปรเจกต์ |

บัญชีทดสอบ: `admin/admin1234`, `teacher1/teacher1234`, `student001..010/student1234`

## โครงสร้างโค้ด
```
backend/
  config.php            ค่า default (override ด้วย config.local.php — gitignored)
  bootstrap.php         autoload App\* -> src/*, app_config()
  routes.php            ประกาศ route ทั้งหมด ($router->get/post/put/delete(path, handler, roles))
  public/index.php      front controller + CORS + error handling
  src/Core/             Database(PDO), Router, Request, Response, HttpException, Auth(bearer token)
  src/Controllers/      AuthController ...
  database/schema.sql   ตารางทั้งหมด · migrate.php = run schema + seed
frontend/  (Nuxt 3, ssr:false SPA, Pinia, Tailwind, ฟอนต์ Prompt)
  composables/useApi.ts   $fetch + Bearer token, 401 -> logout
  stores/auth.ts          token ใน localStorage key gsp_token
  middleware/auth.global.ts  บังคับ login + จำกัดพื้นที่ /student /teacher /admin ตาม role
  layouts/default.vue, blank.vue · pages/{login,student,teacher,admin}
  assets/css/main.css     class ร่วม: btn-primary, btn-ghost, input, card
```

### รูปแบบโค้ด
- Controller เป็น static method รับ `Request $req` คืน array (Router แปลงเป็น JSON) · error ใช้ `throw new HttpException(code, 'ข้อความไทย')`
- Route ที่ต้อง login ส่ง roles เป็น argument ที่ 3 (`['*']` = ทุก role) → `$req->user`
- คะแนนเก็บเป็นคอลัมน์แยกใน `assessment_results` (vark_v/a/r/k, riasec_r..c, mindset_growth/fixed) เพื่อ query สถิติง่าย
- Save state อยู่ในตาราง `game_sessions` (1 แถวต่อ user+scenario)
- เนื้อเรื่องเก็บเป็น JSON ใน `scenarios.content`

## แผนการพัฒนา (Phases)
- [x] **เฟส 1 Foundation** — schema, PHP API + auth token, Nuxt login + role routing
- [ ] **เฟส 2 Game Engine** — Quest list (เช็คเล่นแล้วหรือยัง), VN player (typewriter/shake/fade/เสียง), save state real-time, rule-based scoring, Archetype card, ประวัติ, แชร์ผล + seed เนื้อเรื่องสากล 1 ชุด
- [ ] **เฟส 3 Scenario Builder + Story Library** — CRUD scene/choice ผูกคะแนน, export JSON, คัดลอกจากคลังกลาง, แอดมินเปิด/ปิดชุดสากล
- [ ] **เฟส 4 Dashboard** — Pie/Bar ระดับห้อง, Radar รายบุคคล (Chart.js), จัดกลุ่มทำงานอัจฉริยะ
- [ ] **เฟส 5 AI** — ตั้งค่า BYOK, Contextual AI Prompting + ai_insights_cache, AI Story Generator
- [ ] **เฟส 6 Management & Reports** — CRUD รายวิชา/แผนก, นำเข้า CSV/Excel, ส่งออก PDF/Excel (ว.PA)
- [ ] **เฟส 7 PWA & Performance** — manifest/service worker, ทดสอบโหลด 500–1000 users

## สถานะล่าสุด
- 2026-09-26: เสร็จเฟส 1 และทดสอบ E2E ผ่าน (login ทั้ง 3 role, กันเข้าพื้นที่ role อื่น, reload คง session, logout) → **รอผู้ใช้ตรวจก่อนเริ่มเฟส 2**
