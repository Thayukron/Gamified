# ย้ายระบบ Backend จาก PHP มาใช้ Nuxt 3 + Nitro ทั้งหมด

## รายละเอียด

ปัจจุบัน ARCANA PROFILE ใช้ Nuxt 3 สำหรับ frontend และ PHP สำหรับ backend โดยมี API 86 endpoints ต้องการรวมเป็นแอป Nuxt 3 เดียว ใช้ Nitro จัดการ API และเขียนฝั่ง server ด้วย TypeScript เพื่อลดการดูแลระบบสองภาษาและทำให้พัฒนาและ deploy ได้ง่ายขึ้น

## เป้าหมาย

- ย้าย PHP API ทั้งหมดไปเป็น Nuxt server routes ใต้ `/api`
- ย้าย business logic เป็น TypeScript แยกจาก route handlers
- ใช้ MariaDB และข้อมูลเดิมต่อได้
- รักษาพฤติกรรม สิทธิ์เข้าถึง และผลลัพธ์ของระบบเดิม
- เมื่อย้ายเสร็จ ระบบต้องทำงานได้โดยไม่ต้องใช้ PHP

## ขอบเขตงาน

- [x] จัดโครงสร้าง `server/api`, `server/services`, `server/utils` และ shared types
- [x] ตั้งค่า database connection pool, transactions และ server runtime config
- [x] ย้าย authentication, token และการตรวจ role พร้อม helper เจ้าของข้อมูล (การผูกกับ routes รายวิชาทำในเฟส 4)
- [x] ย้าย API บัญชีผู้ใช้ โปรไฟล์ และคำขอรีเซ็ตรหัสผ่าน (admin/teacher reset ในเฟส 4)
- [x] ย้ายเกม การบันทึกความคืบหน้า การคิดคะแนน VARK/RIASEC/Mindset และรางวัล
- [x] ย้ายรายวิชา รายชื่อผู้เรียน และการนำเข้าข้อมูล
- [x] ย้าย dashboard ไกด์การสอน การจัดกลุ่ม และข้อมูลรายงาน
- [ ] ย้ายแผนการสอน เล่มรายวิชา และเอกสารประกอบ
- [ ] ย้าย Gemini BYOK, model selection, cache และการตั้งค่า AI
- [ ] ย้าย background jobs และ API ติดตามสถานะงาน
- [x] ย้าย API แอดมิน ภาคเรียน สถานศึกษา และสถานะนักศึกษา
- [ ] ย้าย database installer/upgrades และคำสั่งดูแลระบบที่ยังใช้ PHP
- [ ] ปรับ frontend ให้เรียก `/api` ของ Nuxt โดยตรงทั้งหมด (56/86 endpoints ใช้แล้วถึงเฟส 4; AI/plans/jobs ยังใช้ PHP)
- [ ] ปรับสคริปต์เริ่มระบบและ environment variables ให้รัน Node.js โดยตรง ลดการแก้ Docker และเตรียมถอด Docker ออก
- [ ] วางแผนย้าย MariaDB จาก Docker เป็น service โดยรักษาข้อมูลและฐานข้อมูลชุดเดียว
- [ ] อัปเดต `DEPLOY.md`, `Manual.md` และเอกสารที่เกี่ยวข้อง
- [ ] ถอด PHP runtime และโค้ดเดิมหลังตรวจรับครบ

## ข้อกำหนดในการย้าย

- จัดทำรายการเทียบ API เดิมทั้ง 86 endpoints จาก `backend/routes.php` กับ route ใหม่ โดยรักษา HTTP methods, paths, response และ error status ที่ frontend ใช้
- รองรับ password hash และ token เดิม หรือมีแผนเปลี่ยนผ่านที่ชัดเจนก่อนเปิดใช้
- รองรับการถอดรหัส Gemini API key เดิมด้วย `app.key` และรูปแบบการเข้ารหัสเดิม
- เก็บ API keys และ secrets ไว้ฝั่ง server เท่านั้น
- ผลการคิดคะแนน โปรไฟล์ XP เหรียญ และเลเวลต้องตรงกับระบบเดิม
- การบันทึกผลเกมและรางวัลต้องป้องกันการได้รับซ้ำเมื่อส่ง request ซ้ำหรือพร้อมกัน
- งาน AI ต้องทำต่อได้หลังตอบ `202` และรองรับ polling โดยไม่ผูกกับอายุของ request
- รักษาข้อจำกัดการใช้ AI เดิม: เรียกเมื่อครูสั่ง ใช้ cache และไม่ส่งชื่อนักศึกษา
- ใช้ฐานข้อมูลชุดเดิมตามข้อกำหนดโปรเจกต์ สำรองฐานข้อมูลและ `app.key` ก่อนเปลี่ยนแปลงข้อมูลจริง ห้ามใช้ migration ที่ล้างข้อมูล
- การย้าย backend ไม่จำเป็นต้องเปลี่ยน frontend จาก SPA เป็น SSR

## แผนดำเนินงาน

1. **สำรวจและวางโครงสร้าง:** บันทึก API contracts, schema, business rules และวิธี deploy/rollback
2. **ระบบพื้นฐาน:** เชื่อม MariaDB ย้าย auth บัญชีผู้ใช้ และการตรวจสิทธิ์
3. **เกมและผลประเมิน:** ย้าย engine การบันทึกผลและรางวัล พร้อมตรวจเทียบผลกับ PHP
4. **ครูและแอดมิน:** ย้ายรายวิชา นำเข้า dashboard รายงาน และการจัดการระบบ
5. **แผนการสอนและ AI:** ย้ายเอกสาร Gemini การเข้ารหัส cache และ background jobs
6. **เปลี่ยนระบบจริง:** ตรวจรับ สำรองข้อมูล เปลี่ยน deployment และถอด PHP

แต่ละเฟสต้องรันให้ตรวจรับก่อนเริ่มเฟสถัดไป

### ความคืบหน้า

- [x] เฟส 1 สำรวจและวางแผน: [รายละเอียด](docs/migration/phase1-inventory.md), [API mapping 86 endpoints](docs/migration/api-map.md), [inventory JSON](docs/migration/api-inventory.json)
- [x] ตรวจรับเฟส 1 ก่อนเริ่มเฟส 2
- [x] เฟส 2 ระบบพื้นฐาน: [รายละเอียดและวิธีรัน](docs/migration/phase2-foundation.md) — 9 endpoints, build/typecheck ผ่าน, service 14 กรณี, HTTP smoke 15 กรณี, live MariaDB/HTTP 28 requests ผ่าน
- [x] ตรวจรับเฟส 2 ก่อนเริ่มเฟส 3
- [x] เฟส 3 เกมและผลประเมิน — [รายละเอียด](docs/migration/phase3-game.md), เพิ่ม 9 endpoints รวม 18/86, engine parity 158 fixtures, live 78 requests/21 exact PHP comparisons ผ่าน
- [x] ตรวจรับเฟส 3 ก่อนเริ่มเฟส 4
- [x] เฟส 4 ครูและแอดมิน — [รายละเอียด](docs/migration/phase4-staff.md), เพิ่ม 38 routes รวม 56/86; staff parity 251 fixtures, live 262 requests/56 PHP comparisons ผ่าน
- [ ] ตรวจรับเฟส 4 ก่อนเริ่มเฟส 5
- [ ] เฟส 5 แผนการสอนและ AI
- [ ] เฟส 6 เปลี่ยนระบบจริง

ข้อกำหนดเพิ่มเติมจากผู้ใช้: พยายามไม่แก้ Docker มาก เพราะจะถอด Docker ออกด้วย เป้าหมาย deployment จึงเป็น Nuxt/Node.js และ MariaDB service โดยตรง ระหว่างเปลี่ยนผ่านยังรักษาฐานข้อมูลชุดเดิมก่อนย้ายอย่างมีแผน

อัปเดต 2026-10-29: ผู้ใช้ให้ใช้ MariaDB ในเครื่อง และอนุญาตสร้างฐานข้อมูลใหม่ (ไม่มี gamified เดิมในเครื่อง) จึงใช้ MariaDB 10.6.26 port 3306 โดยไม่พึ่ง Docker; ฐานนี้เป็นการติดตั้งใหม่ ไม่ใช่การกู้ข้อมูลเดิม

อัปเดตการทำงาน: ผู้ใช้สั่งไม่ต้อง push เพราะไม่มีสิทธิ์ repository ให้ commit ในเครื่องเท่านั้น และ ignore test files ต่อไป

## เกณฑ์รับงาน

- [ ] API ทั้ง 86 endpoints มีรายการตรวจเทียบและผ่านการทดสอบตาม contract
- [ ] ผู้ใช้ทั้งสาม role ใช้งานได้ และเข้าถึงข้อมูลได้ตามสิทธิ์เดิม
- [ ] การเล่นเกมและผลประเมินตรงกับ PHP จากชุดข้อมูลทดสอบเดียวกัน
- [ ] ข้อมูลเดิม รหัสผ่าน และ Gemini keys ใช้งานต่อได้ตามแผนเปลี่ยนผ่าน
- [ ] การนำเข้า การสร้างแผน และการส่งออกเอกสารยังทำงานครบ
- [ ] งาน AI ทำงานผ่าน background jobs ได้ รวมกรณี timeout และข้อผิดพลาด
- [ ] Build และ deploy ได้โดยไม่ต้องใช้ PHP
- [ ] มีขั้นตอน rollback ที่คำนึงถึงข้อมูลที่เขียนหลังเปลี่ยนระบบ
