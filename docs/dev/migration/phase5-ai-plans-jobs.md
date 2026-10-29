# เฟส 5: แผนการสอน Gemini และงานเบื้องหลัง

วันที่ 2026-10-29 — ย้าย API เพิ่ม 30 endpoints รวม **86/86** ตาม inventory แล้ว ค่าเริ่มต้น frontend เป็น `/api` และทุก route ในรายการส่งเข้า Nitro โดยตรง

## สิ่งที่ย้าย

- แผนการสอน ใบงาน/ใบความรู้/ใบกิจกรรม/ใบมอบหมาย/ใบประเมิน เล่มรายวิชา และข้อมูลรวมสำหรับส่งออก
- Gemini BYOK รายครู การเลือกรุ่นจาก models.list การอนุญาตใช้ key ส่วนกลางอย่างชัดเจน cache ไกด์รายวิชา/หน่วย และการเสนอหน่วย/ค้นมาตรฐานอาชีพ
- รักษา prompt และ normalization เดิมใน TypeScript/JSON โดย runtime ไม่เรียก PHP; การร่างไม่บันทึกเอกสารเอง และ AI ไม่เขียนทับหลักสูตร/ผู้จัดทำเล่ม
- ตรวจ role และเจ้าของข้อมูลทุก route; prompt ใช้สถิติรวม ไม่แนบชื่อผู้เรียน
- AES-256-GCM ใช้รูปแบบเดิมของ PHP และ app.key เดิมได้; หากมี key ที่เข้ารหัสอยู่แต่ app.key หาย ระบบปฏิเสธการสร้างกุญแจทดแทน

## รันด้วย Node และ MariaDB ในเครื่อง

สำรองฐานข้อมูลและ `backend/storage/app.key` คู่กันก่อนอัปเกรด แล้วรันจาก `frontend/`:

```powershell
npm run db:upgrade
npm run build
$env:PORT = '3100'
$env:HOST = '127.0.0.1'
node --env-file=../.env .output/server/index.mjs
```

`db:upgrade` อ่าน ledger schema_migrations และ SQL upgrades เดิม มี advisory lock กันรันพร้อมกัน ไม่ใช่คำสั่งติดตั้งหรือล้างฐานข้อมูล; ฐานใหม่ใช้ `npm run db:init` ซึ่งปฏิเสธฐานที่มีข้อมูลแล้ว

runtime config ส่วนตัว `appKeyPath` เริ่มต้นที่ `../backend/storage/app.key` เมื่อรันจาก frontend รองรับ `NUXT_APP_KEY_PATH` แบบ absolute; ต้องเก็บไฟล์นี้ถาวรและไม่ commit ลง Git ส่วน assets/schema/scripts ที่ยังอยู่ใต้ backend จะจัดการแพ็กเกจในเฟส 6

## งาน AI เบื้องหลัง

หก route รองรับ `X-Async-Job: 1` ตอบ 202 และทำงานต่อผ่าน event.waitUntil จากนั้น polling `/api/jobs/{id}` ได้เฉพาะเจ้าของงาน งานเก็บผลใน MariaDB ไม่ถือ transaction หรือ connection ค้างระหว่างรอ provider

เพิ่ม lease_until ด้วย upgrade `2026-10-29_job_lease.sql`: ต่อ lease ทุก 10 วินาที อายุ lease 30 วินาที และมีเพดานงาน 10 นาที เมื่อ process หยุดหรือ lease หมด polling เปลี่ยนเป็น error 503 พร้อมข้อความให้สร้างใหม่ ไม่ส่งคำขอ AI ซ้ำอัตโนมัติ งานเก่าไม่มี lease ใช้เกณฑ์ 10 นาที การปิดอย่างปกติรอ pending jobs ก่อนปิด pool

Gemini มี timeout/retry และ fallback เฉพาะรุ่นที่ค้นพบจาก provider รวม cooldown รุ่นช้า ไม่ hardcode รุ่น ส่ง API key ผ่าน header และหยุด retries เมื่อ job ถูกยกเลิก

## การตรวจสอบและข้อจำกัด

- Unit tests 25 กรณีผ่าน รวม AES เทียบ PHP/OpenSSL, model pagination, JSON ผิดรูป, timeout, quota, provider error และ model fallback
- normalization/prompt เทียบ PHP เดิม 95 fixtures และ prompt suggest/TPQI อีก 16 fixtures ตรงกัน
- Live tests ใช้ MariaDB ในเครื่องและ mock Gemini เท่านั้น: **311 HTTP requests / 43 PHP comparisons ครบ 30 routes** รวมสิทธิ์ CRUD/cache/background/concurrency/lease/process crash และ key หาย เทียบ PHP ในส่วนที่ไม่เรียก provider
- Regression staff 262 requests/56 PHP comparisons และเกม 78 requests/21 comparisons ผ่าน; production smoke 15 checks, build และ server typecheck ผ่าน; preview หน้าเว็บ/API/OPTIONS ผ่าน และตรวจแล้วไม่มีผู้ใช้ทดสอบหรือ mock key ค้างในฐาน
- ทดสอบ regression เกมและ staff แยกจากข้อมูล demo; ลบข้อมูลชั่วคราวและคืนการตั้งค่า AI หลังจบ tests ทั้งหมดอยู่ใน frontend/tests ที่ ignore ตามคำสั่งผู้ใช้
- **ยังไม่ได้ทดสอบ Gemini ด้วย API key จริง** จึงยังไม่ยืนยันคุณภาพข้อความ โควตา และพฤติกรรม provider จริง ต้องให้ครูทดสอบ key และตรวจเอกสารที่สร้างก่อนตรวจรับใช้งานจริง

ทดลองหน้าเว็บที่ http://localhost:3100/login ด้วย teacher-demo/teacher1234; หน้า AI settings ให้ครูกรอก key ของตนเอง ไม่ใช้เงินส่วนกลางโดยอัตโนมัติ

ก่อนเปลี่ยนข้อมูลสำรองฐานที่ backups/gamified-before-phase5-ai-20261029.sql แล้ว ฐานใหม่เดิมยังไม่มี encrypted keys; เมื่อสร้าง app.key ครั้งแรกแล้วสำรองไว้ที่ backups/app-phase5-20261029.key ทั้งสองไฟล์ ignore และไม่แสดง secrets ใน log

เฟส 6 ยังเหลือการตรวจรับจริง ปรับ startup/deployment/backup/rollback ให้สมบูรณ์ ย้าย assets ที่ยังอ้าง backend และถอด PHP/Docker หลังตรวจรับ ไม่ได้ประกาศว่าการเปลี่ยน production เสร็จแล้ว
