# เฟส 4 — ครู แอดมิน และรายงานบน Nitro

ย้ายเพิ่ม 38 endpoints รวมเป็น **56/86 endpoints** รายการที่ย้ายจริงอยู่ใน `frontend/shared/data/migrated-api.json` ใช้ร่วมกันระหว่าง frontend routing และ middleware ตรวจ HTTP methods ส่วน AI, lesson plans/sheets/book และ jobs ยังอยู่ในเฟส 5

## ขอบเขตที่ย้าย

| หมวด | API |
|---|---|
| รายวิชา | GET/POST `/teacher/courses`, PUT/DELETE `/teacher/courses/{id}`, GET `/teacher/meta` |
| รายชื่อ | GET/POST `/teacher/courses/{id}/students`, POST `.../students/remove`, DELETE `.../students/{sid}`, GET `/teacher/students` |
| นำเข้ารายชื่อ | POST `/teacher/courses/{id}/import/preview`, `.../import/commit` |
| รีเซ็ตรหัสผู้เรียน | POST `/teacher/courses/{id}/students/{sid}/reset-password` |
| Dashboard/ไกด์/รายงาน | GET `/teacher/courses/{id}/dashboard`, `.../guide`, `.../report`, PUT `.../context` |
| จัดกลุ่ม | POST `/teacher/courses/{id}/groups/preview`, GET/PUT `.../groups` |
| ผู้ใช้/คำขอรีเซ็ต | GET/POST `/admin/users`, PUT `/admin/users/{id}`, POST `.../reset-password`, GET `/admin/reset-requests`, POST `.../{id}/dismiss` |
| ข้อมูลส่วนกลาง | GET `/admin/overview`, POST `/admin/import/preview`, `.../commit`, DELETE `/admin/courses/{id}` |
| ภาค/สถานศึกษา | GET/PUT `/admin/term`, `/admin/institution` |
| กลุ่มเรียน/สถานะ | GET `/admin/class-groups`, `.../members`, POST `.../rename`, `/admin/students/status` |

## โครงสร้างและกฎเดิมที่รักษา

- `teacherCourses.ts`: CRUD รายวิชา, metadata, ค้นหาและจัดรายชื่อ ตรวจเจ้าของวิชาผ่าน `utils/ownership.ts`; admin เข้าถึงได้ทุกวิชา
- `teacherDashboard.ts`: dashboard จาก Core Profiles, ค่าเฉลี่ยสัดส่วนรายคน, ภาคของรายวิชาเอง, กลุ่มที่บันทึก และข้อมูลส่งออกรายงาน
- `teachingGuide.ts` + `server/data/knowledge.json`: ย้ายกฎและข้อความจาก Knowledge/TeachingGuide เดิม ไม่เรียก AI
- `grouping.ts`: MT19937 และ bounded sampling ตามพฤติกรรม PHP 8.2 ทำให้ seed เดิมจัดกลุ่มเดิม; เก็บ random state และ fixed-cap ภายในแต่ละ call ไม่แชร์ state ข้าม requests
- `rosterImport.ts`: ตรวจ 1,000 แถวสูงสุด สร้างบัญชีที่ขาดและลงทะเบียนเท่านั้น ไม่เปลี่ยนชื่อ/กลุ่ม/รหัสผ่านของบัญชีเดิม
- `imports.ts`: รักษา API นำเข้าเดิมทั้ง 5 ประเภท (departments, teachers, students, courses, enrollments) แม้ UI ปัจจุบันใช้เพียงบางประเภท; สูงสุด 5,000 แถวต่อประเภท, preview ไม่เขียนข้อมูล, commit ตรวจใหม่และใช้เฉพาะแถวที่ผ่านใน transaction เดียว
- `admin.ts`: จัดการผู้ใช้ ภาค สถานศึกษา กลุ่มเรียน สถานะ และคำขอรีเซ็ต
- `password.ts`: reset เป็น username ชั่วคราว บังคับเปลี่ยนครั้งแรก ยกเลิก token ทุกอุปกรณ์และปิดคำขอ; ครูรีเซ็ตเฉพาะผู้เรียนในวิชาของตน และหน้า admin ห้ามรีเซ็ตบัญชี admin
- `staffHandler.ts`: auth/role/forced-password gate ก่อนเรียก service; งาน POST/PUT/DELETE อยู่ใน transaction และ rollback เมื่อผิดพลาด
- ใช้ metadata ของ mysql2 สำหรับ insert id/affected rows โดยปิด FOUND_ROWS ให้ตรง PDO เดิม
- ลบรายวิชาหรือ enrollment แล้วบัญชีและ assessment results ของผู้เรียนยังอยู่; เปลี่ยนสถานะออกจากการศึกษา/ปิดบัญชีแล้ว token ถูกยกเลิกทันที
- รายงานอ่าน AI cache เดิมได้พร้อม stale flag โดยไม่มีการเรียก Gemini หรืออ่าน API key; generation และการตั้งค่า AI จะย้ายในเฟส 5

## การทดลองในเครื่อง

ใช้ MariaDB local port 3306 และ Node โดยตรงตาม [คู่มือเฟส 2](phase2-foundation.md) ไม่แก้ Docker และไม่มี schema migration ใหม่ในเฟสนี้

- เปิด `http://localhost:3100/login`
- ครูตัวอย่าง: `teacher-demo` / `teacher1234`
- มีรายวิชา `DEMO-TEACHER` ที่ลงทะเบียน `student-demo` ไว้แล้ว เพื่อดู dashboard/รายชื่อ/จัดกลุ่ม/ไกด์/รายงาน
- นักศึกษาตัวอย่างเดิม: `student-demo` / `student1234`; ไม่เติมผลประเมินหรือรางวัลให้ล่วงหน้า
- Admin เดิม: `admin` / `admin1234` หากยังไม่เปลี่ยน; ระบบยังบังคับเปลี่ยนรหัสครั้งแรก ไม่ข้ามขั้นตอนให้
- หน้าตั้งค่า AI และแผนการสอนยังรอเฟส 5; frontend ไม่สลับ API เหล่านั้นมา Nitro ก่อน implementation พร้อม

## หลักฐานตรวจสอบ

- สำรองก่อน live writes: `backups/gamified-before-phase4-staff-20261029.sql` (gitignored)
- Production build, server TypeScript และ `git diff --check` ผ่าน
- Local suites รวม 21 tests ผ่าน; ในชุด staff มี 251 fixtures ที่เทียบการจัดกลุ่ม/ไกด์/context/fingerprint กับ PHP 8.2 เดิมแบบไม่แก้ source
- Live staff tests ผ่าน **262 HTTP requests**, เทียบ PHP **56 จุด**, ครบทุก 38 routes รวม no-token, ผิด role และผิด method
- ตรวจ preview/commit ทั้ง admin และ roster, ข้อมูลซ้ำ, ชื่อ Unicode, multi-type references, rollback เมื่อแถวกลางเกินขนาดคอลัมน์ และการไม่แก้บัญชีเดิมจาก roster import
- ตรวจ ownership, รายวิชาต่างภาค, รีเซ็ตรหัสและ token revocation, forced-password gate, rename/promote, student status, เก็บ assessment หลังลบรายวิชา และ affected rows ของการเพิ่มชื่อซ้ำ
- ตรวจ AI cache ในรายงานทั้ง stale=false และเปลี่ยนบริบทแล้ว stale=true โดยใช้ fingerprint จาก PHP oracle ไม่เรียก AI
- Response comparisons ตรงกันทั้งโครงสร้าง/ชนิดข้อมูล/ข้อความ โดยยกเว้นเวลา `generated_at` ที่เกิดจากคนละ request
- Regression ฝั่งนักศึกษา: 78 requests/21 PHP comparisons ผ่าน รวม complete พร้อมกัน 8 requests และ save/complete race; HTTP smoke เดิม 15 checks ผ่าน
- ใช้บัญชี prefix เฉพาะการทดสอบและ cleanup เมื่อเสร็จ พร้อมคืนค่า global settings เดิม; เก็บเฉพาะบัญชี/รายวิชา demo สำหรับผู้ใช้ตรวจรับ
- Test files และ PHP oracle runtime ยังคงอยู่ใต้ `frontend/tests/` ที่ ignore ตามผู้ใช้

อ้างอิงพฤติกรรม random: [PHP MT19937](https://github.com/php/php-src/blob/PHP-8.2/ext/random/engine_mt19937.c), [PHP bounded sampling](https://github.com/php/php-src/blob/PHP-8.2/ext/random/random.c)

ผู้ใช้กำหนดให้ commit ในเครื่องเท่านั้น ไม่ push repository
