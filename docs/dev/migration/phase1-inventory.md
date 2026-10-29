# เฟส 1 — สำรวจระบบและแผนย้าย Nuxt 3

สถานะ: สำรวจและวางแผนแล้ว ยังไม่ได้ย้าย runtime หรือเปลี่ยนฐานข้อมูล

## หลักฐานและรายการ API

- [API mapping](api-map.md): 86 endpoints เทียบ method/path/role/handler กับไฟล์ Nuxt เป้าหมายครบทุกตัว
- [Machine-readable inventory](api-inventory.json): route metadata, fields ที่ handler อ่านโดยตรง และ SHA-256 ของ schema/upgrades
- สร้างใหม่: `node tools/migration-inventory.mjs`
- ตรวจว่าตรงกับ source: `node tools/migration-inventory.mjs --check`
- เครื่องมือนี้อ่าน source เท่านั้น ไม่ bootstrap PHP ไม่อ่าน secrets และไม่ต่อฐานข้อมูล

รายการ field ที่สกัดได้ยังไม่ใช่ contract ทั้งหมด: บาง route ใช้ helper เช่น `fields()`, `header()` และ `payload()` หรือส่ง response จาก service ต้องตรวจและบันทึก request/response ทุก branch ก่อนลงมือย้ายในเฟสที่เกี่ยวข้อง ไม่ถือว่าผ่านเกณฑ์ compatibility เพียงเพราะมี mapping

## API contract ร่วม

Source: `backend/public/index.php`, `src/Core/{Router,Request,Response,Auth,BackgroundJob}.php`

- Prefix ฝั่งเว็บ `/api`; body เป็น JSON, query มาจาก URL และ path params เป็น string ก่อน controller แปลงค่า
- Response สำเร็จปกติ HTTP 200 เป็น JSON ของ handler โดยตรง ไม่หุ้ม `{data: ...}` เพิ่ม
- Error เป็น `{ "error": "ข้อความ" }`; เก็บข้อความและ status เดิม รวม 401/403/404/405/422 และ 500 แบบไม่เผย exception
- Router เดิมตอบ 405 ถ้า path มีอยู่แต่ method ไม่ตรง ต้องตรวจพฤติกรรมนี้ตอนย้าย
- OPTIONS ตอบ 204; dev เดิมอนุญาต origins 3100 และ header `Authorization`, `Content-Type`, `X-Async-Job`
- Bearer token เป็น random 32 bytes รูป hex 64 ตัว เก็บ SHA-256 ใน `auth_tokens` อายุเริ่มต้น 168 ชั่วโมง ต้องตรวจวันหมดอายุและ `users.is_active`
- `roles=[]` เป็น public, `['*']` ต้อง login, role อื่นตรวจแบบเจาะจง (admin ไม่ได้ผ่าน student routes อัตโนมัติ)
- เมื่อ `must_change_password` เป็นจริง อนุญาตเฉพาะ `/auth/me`, `/auth/logout`, `/me/profile`, `/me/password`; route อื่นที่ต้อง login ตอบ 403

### ตัวอย่างที่ต้องรักษา

| Request | Response / พฤติกรรม |
|---|---|
| `POST /auth/login` `{username,password}` | `{token,user}`; ไม่มี password hash ใน user; กรอกไม่ครบ 422, ข้อมูลไม่ถูกต้อง 401 |
| `GET /auth/me` | `{user}` โดย `must_change_password` เป็น boolean |
| `PUT /me/password` `{current_password,new_password}` | เปลี่ยนรหัสและลบ token อุปกรณ์อื่น เก็บ token ปัจจุบันไว้ |
| `POST /auth/forgot` `{username,note?}` | ข้อความสำเร็จเหมือนกันทั้งบัญชีที่มีและไม่มี ป้องกันการไล่ค้นบัญชี |
| `PUT /student/quests/{id}/progress` `{current_scene,choices_log}` | `{saved:true,saved_at}` หลังตรวจเส้นทาง |
| `POST /student/quests/{id}/complete` `{choices_log}` | ครั้งแรก `{result_id,already:false,rewards}`; มีผลภาคเดิมแล้ว `{result_id,already:true}` |
| AI POST ที่รองรับ + `X-Async-Job: 1` | HTTP 202 `{job_id,status:"running"}` |
| `GET /jobs/{id}` | `{status,http_status,result}`; เฉพาะเจ้าของ job, ไม่พบหรือเป็นของคนอื่น 404 |

## กฎที่ต้องย้ายพร้อม API

### Auth และการเข้ารหัส

- `PasswordService`: รหัสใหม่ 6–72 ตัวอักษรตาม `mb_strlen`, ไม่เหมือน username แบบไม่สนตัวพิมพ์; เปลี่ยนรหัสเองต้องไม่ซ้ำรหัสเก่า
- PHP ใช้ `password_hash(..., PASSWORD_DEFAULT)` ต้องมี fixture ตรวจ hash จริงของ PHP กับ implementation Node ก่อนเลือกใช้ library รวม Unicode และข้อจำกัดจำนวน byte ของ bcrypt
- Reset ใช้ username เป็นรหัสชั่วคราว บังคับเปลี่ยน ลบทุก token และปิด pending reset requests
- `TeacherController::course()` ตรวจเจ้าของวิชา ยกเว้น admin; ต้องใช้ร่วมทุก route ที่แตะวิชา/แผน/เอกสาร
- `Crypto`: AES-256-GCM, `app.key` เป็น base64 ของ key 32 bytes; blob = base64(IV 12 bytes + tag 16 bytes + ciphertext)
- ย้าย key เดิมโดยไม่แสดงค่าหรือ commit ไฟล์; ห้ามสร้าง key ใหม่ทับเมื่อหา key เดิมไม่พบ ต้องทดสอบเข้ารหัส/ถอดรหัสข้าม PHP/Node ด้วย key จำลอง

### เกมและโปรไฟล์

- ย้าย `ScenarioEngine` ทั้งการซ่อน tags ก่อนส่งผู้เล่น, validate/replay choices, scoring, recency และ tie-breaking
- รักษา VARK 4 ค่า, RIASEC 6 ค่า และ mindset 2 ค่า; ผลแต่ละภาค unique `(user_id,scenario_id,semester,academic_year)`
- Complete เดิมตรวจผลซ้ำก่อน transaction; การส่งพร้อมกันยังเสี่ยง unique-key error ต้องจัดการ duplicate เป็นผลเดิมและให้รางวัลครั้งเดียวใน implementation ใหม่
- บันทึกผล, session completed, XP และเหรียญใน transaction เดียว ใช้ connection เดียวตลอด transaction และ rollback/release เมื่อผิดพลาด
- `Progression`: XP = choices×10 + wins×30 + fails×15 + 100; coins = items×20 + 50; เลเวลถัดไปใช้ 100 + 50×(level−1)
- quest rarity = epic เมื่อ wins>0 และ fails=0 มิฉะนั้น rare; core rarity = legendary เมื่อครบทุกเควสต์สากลที่นับ, epic เมื่อสำเร็จอย่างน้อย 2 มิฉะนั้น rare
- `ProfileService::LATEST` เลือกภาคล่าสุดของแต่ละ user+scenario ข้ามภาค ไม่ใช่เลือกเฉพาะภาคปัจจุบัน
- ภาคปัจจุบันใช้ `settings.term_*` ก่อน config/env; timezone เดิม Asia/Bangkok ต้องรักษาวันหมดอายุ/วันที่และชนิด JSON ของ driver ให้ตรง

### ครู แอดมิน แผน และ AI

- Admin import กับ roster import ใช้กฎต่างกัน: roster สร้างบัญชีที่ขาดและลงทะเบียน แต่ไม่แก้บัญชีเดิม; รักษา preview/commit และ transaction
- ย้าย `Guide/{Knowledge,TeachingGuide,GroupingService}` และ services แผน/ใบงานครบ ไม่ย้ายแค่ controller
- ส่งออก Word อยู่ฝั่ง browser ยังคงใช้ข้อมูล API เดิม
- BYOK รายครู, key กลางใช้เฉพาะเมื่อ admin อนุญาต; AI เรียกเมื่อครูสั่ง ไม่ส่งชื่อนักศึกษา
- AI cache key = SHA-256 ของ `courseId|type|topic`; fingerprint อิง anonymous context + topic ต้องตรวจ JSON serialization ให้ตรง PHP ก่อนใช้ cache เดิม
- รักษา model discovery, fallback, timeout, stale cache และผล error ของ Gemini
- Background jobs ต้องมี worker/lifecycle ที่ติดตามได้บน Node process: บันทึก running ก่อนตอบ 202, รองรับ graceful shutdown และจัดการ running jobs ค้างหลัง restart ห้ามอาศัย promise ที่ถูกปล่อยไว้โดยไม่ดูแล
- Polling เดิมทุก 2.5 วินาที ไม่เกิน 8 นาที; job เก่าเกิน 2 วันถูก cleanup ตอนเริ่มงาน

## ฐานข้อมูลและคำสั่งดูแลระบบ

- `schema.sql` มี 19 domain tables; installer เพิ่ม `schema_migrations` อีก 1 ตาราง รวม 20 ตารางตาม source (ยังไม่ได้ query DB จริง)
- รายชื่อและ schema hashes อยู่ใน inventory; ต้องเทียบ schema จริงแบบ read-only หลังสำรองก่อนเฟสที่เชื่อม DB
- รักษา MariaDB 11.4, utf8mb4, collation, indexes, foreign keys และ JSON ที่เก็บเป็น text
- `database/install.php` ใช้ migration ledger ตามชื่อไฟล์; ต้องย้ายพฤติกรรมนี้ และ seed/first-admin โดยไม่เรียก `migrate.php` บนข้อมูลเดิม
- ย้าย `backend/bin/reset-password.php` เป็นคำสั่ง Node สำหรับกู้บัญชีผู้ดูแล
- ไม่ใช้ schema.sql รันตรงบนฐานข้อมูลเดิม: มีคำสั่งล้างตาราง ต้องใช้ upgrades ที่ตรวจแล้วเท่านั้น

## โครงสร้างเป้าหมาย

```text
frontend/
  server/
    api/                  # files ตาม api-map.md, ตรวจ input/auth แล้วเรียก service
    services/             # business logic: game, profile, guide, import, plans, AI
    utils/
      db.ts               # pool + helper สำหรับ transaction
      auth.ts             # bearer tokens, roles, ownership, password-change gate
      crypto.ts           # รูปแบบเดิมกับ PHP
      settings.ts         # DB settings + env fallback (ไม่ cache ภาคตลอด process)
      errors.ts           # response {error} และ status เดิม
    plugins/              # lifecycle ของ pool/jobs
  shared/types/           # request/response types ที่ frontend และ server ใช้ร่วมกัน
```

เฟส 1 เป็นแผน ไม่สร้าง routes เปล่าที่ตอบสำเร็จหรืออ้างว่ามี API ใหม่แล้ว เฟส 2 จึงเพิ่ม dependency, runtime config, DB pool, auth และ account routes พร้อมทดสอบจริง

## รันระบบและเปลี่ยนผ่าน (เน้นถอด Docker)

ผู้ใช้กำหนดเพิ่มเติม: ลดการแก้ Docker และเตรียมตัด Docker ออก เป้าหมายเป็น Node.js ที่รัน Nuxt โดยตรง + MariaDB ที่รันเป็น service โดยตรง

1. ระหว่างย้ายใช้ฐานข้อมูลชุดเดิมใน Docker ต่อไปชั่วคราว ไม่สร้าง DB dev อีกชุด และไม่แก้ Dockerfiles/Compose ในเฟสนี้
2. พัฒนาใน Nuxt เดิม port 3100; API PHP port 8100 ยังใช้จน endpoints ใหม่พร้อม เปลี่ยน routing เฉพาะชุดที่ตรวจรับแล้ว ไม่สลับทั้ง `/api` ก่อนครบ
3. Final build ใช้ Nuxt server build และเริ่มด้วย `node .output/server/index.mjs` แทน static generate; SPA `ssr:false` คงเดิม ตั้ง API base `/api`
4. ก่อนย้าย MariaDB ออกจาก Docker: หยุดการเขียนทั้ง PHP/Nuxt, สำรอง DB + app.key และทดสอบความสมบูรณ์ของ backup; ไม่พิมพ์ secrets ใน logs
5. Restore เข้าสู่ MariaDB service เป้าหมาย ตั้ง host/port/credentials แบบ server-only ตรวจ schema, row counts, indexes, ภาษาไทย และความเข้ากันได้ของวันเวลา จากนั้นสลับให้ทุก process ใช้ DB เป้าหมายเดียว
6. เปิด Node service ด้วย process supervisor ของเครื่อง, ตรวจ login/เกม/ครู/แอดมิน/AI แล้วจึงถอดการพึ่ง Docker; เก็บ volume เดิมเป็นจุดสำรอง ไม่ลบทันที
7. อัปเดต start/stop/backup/restore และคู่มือระบบสำหรับการรันโดยตรงก่อนส่งมอบ

### Rollback ที่รักษาข้อมูลหลังสลับ

- เก็บ PHP source และ config จนตรวจรับทั้งหมด; ชี้ PHP กลับไปยังฐานข้อมูล authoritative ล่าสุด ไม่กลับไปใช้สำเนาเก่าที่ขาดข้อมูลใหม่
- ถ้า schema ใหม่อ่านด้วย PHP ไม่ได้ ต้องมีแผน reverse/forward-compatible migration และ rehearsal ก่อน cutover
- ถ้าต้องย้ายกลับ DB ใน Docker ให้หยุดเขียนและย้ายข้อมูลล่าสุดกลับก่อนเปิด traffic; ห้ามเปิดสองฐานข้อมูลให้เขียนแยกกัน
- งาน AI ที่ running ต้อง drain/บันทึกสถานะก่อนปิด process และป้องกันการเรียกซ้ำจนเสียโควตา
- ห้าม `docker compose down -v` หรือทำลาย DB volume/app.key ในการย้ายหรือ rollback

## หลักฐานตรวจรับเฟสนี้

- รัน inventory generator และ `--check`: ต้องได้ 86 routes, 6 background routes, 19 domain tables + schema_migrations
- ทุก handler ที่อ้างถึงต้องมี method จริง, method+path ไม่ซ้ำ และมี target file mapping ครบ
- `git diff --check` ผ่าน
- ยังไม่ทดสอบ runtime compatibility/โหลด/DB/AI: เป็นงานเฟสที่เกี่ยวข้อง ยังไม่ติ๊ก acceptance เหล่านั้น
- PHP ใน PATH เครื่องนี้เป็น 7.4.9 ขณะที่ระบบเดิมต้องการ 8.2 จึงห้ามใช้ binary นี้เป็น oracle ทดสอบ PHP ก่อนหา runtime ที่ถูกต้อง
