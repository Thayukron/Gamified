# Change Log

บันทึกการแก้ไขทุกครั้ง (ใหม่สุดอยู่บน)

---

## 2026-09-26 — เฟส 1: Foundation

### เพิ่ม
- `backend/database/schema.sql` — ตารางตาม requirement: `users`, `courses`, `enrollments`, `scenarios`, `archetype_master`, `assessment_results`, `ai_insights_cache` + ตารางเสริม `departments`, `game_sessions` (save state), `settings` (BYOK), `auth_tokens`
- `backend/database/migrate.php` — สร้าง DB ใหม่ + seed: 3 แผนก, admin, ครู 1, นักเรียน 10, รายวิชา 1 (ลงทะเบียนครบ), Archetype 6 แบบ (ตาม RIASEC: Builder/Explorer/Creator/Guardian/Leader/Strategist), settings AI
- PHP REST API (ไม่ใช้ framework): `bootstrap.php`, `config.php`, `routes.php`, `public/index.php`, `src/Core/*`, `src/Controllers/AuthController.php`
  - `GET /api/health`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
  - Token แบบสุ่ม เก็บ sha256 ใน DB อายุ 7 วัน, ตรวจ role ต่อ route, CORS
- Nuxt 3 frontend (`frontend/`): Pinia auth store, `useApi` composable, global middleware แยกพื้นที่ตาม role, หน้า login + หน้าหลักนักเรียน (mobile-first) / ครู / แอดมิน (แสดงเมนูที่จะพัฒนาในเฟสถัดไป)
- `start-dev.ps1`, `.gitignore`, `README.md`, `CLAUDE.md`, `log.md`

### ตัดสินใจ / แก้ปัญหา
- MySQL ของ XAMPP สตาร์ทไม่ได้ (ไฟล์ replication `multi-master.info` เสีย) → สร้าง MariaDB data dir แยกที่ `%USERPROFILE%\.gamified-mysql\data` port **3310** แทน (ไม่แตะ XAMPP เดิม; port 3307 ถูก Docker ใช้)
- port 3000 มีแอปอื่นใช้ → Nuxt ใช้ port **3100**, CORS อนุญาต 3100
- apiBase ใช้ `127.0.0.1:8000` แทน `localhost` เลี่ยงปัญหา IPv6
- ใช้ `@pinia/nuxt@0.11` + `pinia@3` (รุ่นที่รองรับ Nuxt 3)

### ทดสอบ
- curl: health / login ผิด-ถูก / me / logout / CORS preflight ผ่าน
- E2E (Playwright + Edge): login ผิดแสดงข้อความ, login 3 role เข้าหน้าถูก, กันเข้าพื้นที่ role อื่น, reload คง session, logout ผ่านทั้งหมด
