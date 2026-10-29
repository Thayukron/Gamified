# Roadmap: ย้ายอัปเดตจาก main (PHP) ไป dev (Nuxt / Nitro)

จัดทำวันที่ 2026-10-29 — แผนเดิมจัดทำบน main และย้ายมาดำเนินการบน dev แล้ว ดูผลล่าสุดด้านล่าง; ไม่ได้เปลี่ยนข้อมูลในฐานข้อมูลจริง

## ฐานที่ใช้เปรียบเทียบ

| รายการ | ค่า |
|---|---|
| Remote ต้นทางปัจจุบัน (`origin`) | https://github.com/Thayukron/Gamified.git |
| main ก่อน pull | `667b5c7` |
| main หลัง pull | `c165a6a` |
| ปลายทาง migration | branch `dev` ที่ `413be7d` |
| Remote ของชุด Node/VPS ก่อนเปลี่ยน origin | https://github.com/rungrot-muangchalerm/gamefile.git |

สลับมา main และ pull แบบ fast-forward สำเร็จ มีเพิ่ม 2 commits รวม 5 ไฟล์ (+135 / -6 บรรทัด) ระหว่าง dev กับ main หลัง pull มี commits เฉพาะฝั่ง dev 32 และฝั่ง main 2 ไม่ควร merge ทั้ง branch main เข้า dev โดยไม่แยกการเปลี่ยนแปลง เพราะ main ยังมีโครงสร้าง PHP + frontend/ ส่วน dev ย้าย Nuxt/Nitro มา root แล้ว

## สิ่งที่อัปเดตจาก remote เก่า

### `65cce69` — ปรับบริบทและบันทึกเรื่องค้าง

- แก้ CLAUDE.md ให้ตรงกับระบบ: ภาคเรียนปัจจุบันอ่าน settings `term_semester` / `term_academic_year`; config/.env เป็นค่าสำรอง และโปรไฟล์ใช้ผลล่าสุดข้ามภาค
- บันทึกการส่งออกข้อมูล/กุญแจในอดีต ไม่ใช่ไฟล์ข้อมูลที่ต้องนำมาทับฐานปัจจุบัน
- มีบันทึกว่านักศึกษากลุ่มหนึ่งถูกตั้งสถานะสำเร็จการศึกษา ต้องตรวจข้อเท็จจริงในฐานที่เกี่ยวข้องและให้ผู้ใช้ตัดสินใจก่อนแก้ ไม่สรุปว่าฐานบน VPS มีปัญหาเดียวกัน
- ค่า 2/2569 ในบันทึกเป็นสถานะของต้นทางขณะบันทึก ไม่ควร hardcode หรือนำไปเขียนทับ settings ปัจจุบัน

### `c165a6a` — จัดการแผนกวิชา

| ไฟล์ต้นทาง main | การเปลี่ยนแปลง | ปลายทาง dev |
|---|---|---|
| `backend/routes.php` | เพิ่ม POST /admin/departments, PUT และ DELETE /admin/departments/{id} จำกัด admin | เพิ่ม Nitro handlers 3 ไฟล์ใน `server/api/admin/departments/` |
| `backend/src/Controllers/AdminController.php` | validate, create/update/delete แผนก และนับรายวิชาต่อแผนกใน overview | `server/services/admin.ts` |
| `frontend/pages/admin/data.vue` | เพิ่ม/แก้ไข/ลบแผนกผ่าน dialog, จำนวนรายวิชา, ข้อความยืนยันผลกระทบ | `pages/admin/data.vue` |
| `CLAUDE.md`, `log.md` | บริบทและประวัติของ upstream | รวมเฉพาะข้อมูลที่เกี่ยวข้องเข้า CLAUDE.md / CHANGELOG.md ของ dev |

API ใหม่ 3 routes ยังไม่มีบน dev และ overview ของ dev ยังไม่มี `departments[].courses` จาก inventory ปัจจุบันมี 86 routes เป้าหมายรอบนี้จึงเป็น 89 routesเมื่อเพิ่มครบและตรวจนับใหม่

ตรวจไฟล์ `frontend/pages/teacher/index.vue` บน main เทียบ `pages/teacher/index.vue` บน dev แล้วเหมือนกัน จึงไม่ต้องย้ายการแก้ตัวกรองภาคเรียนซ้ำ

## ลำดับ migration และเกณฑ์จบงาน

### เฟส 1 — เตรียม branch และยืนยันสัญญา API

- [ ] สร้าง branch งานจาก `dev@413be7d` (หรือ dev ล่าสุดหลังตรวจความเปลี่ยนแปลงใหม่)
- [ ] ย้ายเอกสารแผนนี้ไป branch งาน โดยไม่ merge โครงสร้าง PHP จาก main
- [ ] เก็บ upstream `c165a6a` เป็น reference และตรวจ remote ก่อน push ทุกครั้ง เพราะ origin ตอนนี้ชี้ repository เก่า
- [ ] ยืนยัน body `{code, name}`, รูปแบบ response และสิทธิ์ admin จาก PHP implementation
- [ ] ตรวจ schema ของฐานปลายทางแบบอ่านอย่างเดียว: unique code และ FK ของ users/courses ต้อง ON DELETE SET NULL

เกณฑ์ผ่าน: ระบุ branch ต้นทาง/ปลายทางและ API contract ได้ครบ ไม่มีการเปลี่ยน DB หรือ runtime

### เฟส 2 — ย้าย backend เป็น Nitro

- [ ] เพิ่ม createDepartment / updateDepartment / deleteDepartment ใน `server/services/admin.ts`
- [ ] เพิ่ม `server/api/admin/departments/index.post.ts`, `[id].put.ts`, `[id].delete.ts` โดยใช้ `staffHandler(['admin'], ...)` เพื่อใช้ auth และ transaction แบบเดียวกับงานเดิม
- [ ] รหัส: trim + uppercase, regex `^[A-Z0-9._-]{1,20}$`; ชื่อ: trim + ยุบช่องว่าง, ต้องไม่ว่างและยาวไม่เกิน 150 Unicode code points
- [ ] ห้ามใช้ helper ที่ตัดความยาวก่อน validate จนยอมรับข้อมูลเกินข้อกำหนด; ตรวจความต่าง PHP mb_strlen กับ JavaScript string.length
- [ ] รหัสซ้ำตอบ 409 (แก้ไขต้องยกเว้น id ตัวเอง), input ผิดตอบ 422, ไม่พบ id ตอบ 404
- [ ] จัดการ unique constraint เมื่อมีคำขอพร้อมกัน ให้ตอบ 409 แทน 500
- [ ] เพิ่มจำนวนรายวิชา `departments[].courses` ใน overview
- [ ] response เทียบ PHP: create คืน id/message, update คืน ok/message, delete คืน ok
- [ ] เพิ่ม 3 entries ใน `shared/data/migrated-api.json` และตรวจ method guard / route inventory / API docs ที่เกี่ยวข้องให้ตรงกัน

เกณฑ์ผ่าน: admin เรียกได้, teacher/student ถูกปฏิเสธ, ไม่ login ถูกปฏิเสธ, endpoint/response ตรงสัญญาและไม่มี regression ของ overview

### เฟส 3 — ย้าย UI จัดการแผนก

- [ ] ย้ายเฉพาะส่วน diff ของ `frontend/pages/admin/data.vue` มา `pages/admin/data.vue`
- [ ] เพิ่ม dialog เดียวสำหรับสร้าง/แก้ไข, ปุ่มลบเฉพาะรายการเดิม, empty state และจำนวนรายวิชา
- [ ] ยืนยันก่อนลบพร้อมจำนวนผู้ใช้/รายวิชาที่ได้รับผล และแจ้งว่าจะเป็นไม่ระบุแผนก
- [ ] หลังเพิ่ม/แก้ไข refresh overview และตัวเลือกแผนกของฟอร์มเพิ่มผู้ใช้; หลังลบ refresh ผลค้นหาผู้ใช้ด้วย
- [ ] ตรวจข้อความ error, กันกดบันทึกซ้ำระหว่าง request และตรวจสี/contrast ให้ตรงธีม staff ของ dev

เกณฑ์ผ่าน: เพิ่ม → ซ้ำ → แก้ → ลบ ทำได้ครบ UI สะท้อนข้อมูลล่าสุดโดยไม่ reload ทั้งหน้า

### เฟส 4 — ตรวจความเข้ากันได้และข้อมูล

- [ ] ทดสอบ validator: ค่าว่าง, รหัสไทย, เครื่องหมายที่อนุญาต, รหัสเกิน 20, ชื่อเกิน 150, ภาษาไทย/Unicode, ช่องว่างและตัวพิมพ์เล็ก
- [ ] ทดสอบ create/update/delete, รหัสซ้ำ, id ไม่พบ, บทบาท และ method ผิด
- [ ] ทดสอบแก้รหัส/ชื่อแล้วความสัมพันธ์ users/courses ยังคง id เดิม
- [ ] ทดสอบลบแผนกที่มีผู้ใช้/รายวิชาสังเคราะห์: department_id เป็น NULL โดยบัญชี วิชา enrollment และข้อมูลอื่นไม่หาย
- [ ] หากต้องทดสอบกับฐานจริง ต้องสำรองฐาน + storage/app.key ใหม่ และใช้ข้อมูลทดสอบที่แยกชัดเจน ห้ามเปลี่ยนสถานะนักศึกษาจริงเพื่อทดสอบ
- [ ] ไม่ต้องสร้าง DB upgrade เพียงเพราะเพิ่ม CRUD; 2 commits นี้ไม่มี schema change หากฐานปลายทางต่างจริงจึงเสนอ upgrade เฉพาะจุด
- [ ] รัน `npm run typecheck:server`, build และ smoke auth / overview / departments; บันทึกผลจริง ไม่ใช้ผลเทส upstream เป็นผลเทส Nitro

เกณฑ์ผ่าน: ชุดทดสอบผ่าน ไม่มีข้อมูลผู้ใช้จริงถูกแก้ และตรวจ routes ได้ 89 รายการหรืออธิบายส่วนต่างที่ตรวจพบ

### เฟส 5 — ส่งขึ้น VPS และเอกสาร

- [ ] อัปเดต `docs/dev/api/README.md`, หน้ารวมเอกสารถ้าจำเป็น, CHANGELOG.md และ CLAUDE.md บน branch Node
- [ ] ตรวจ remote/branch ที่จะส่งขึ้นจริงกับผู้ใช้ก่อนเผยแพร่ รอบนี้จัดทำแผนและ commit ในเครื่องเท่านั้น
- [ ] ยืนยัน swap พร้อมด้วย `free -h` ก่อน build บน VPS RAM 1 GB; ถ้าต้องการให้ swap คงอยู่หลังรีบูต ให้เพิ่มรายการ /swap-arcana ใน /etc/fstab หลังตรวจว่าไม่ซ้ำ
- [ ] ใช้ PORT ตัวเดียวจาก .env ทั้ง dev และ production ตามที่ปรับใน dev แล้ว ไม่เพิ่ม ecosystem กลับมา
- [ ] build ผ่านจึง restart โปรเซส PM2 ที่มีอยู่ แล้ว smoke /api/health, login และ UI แผนก
- [ ] เตรียมย้อนกลับไป Node release ก่อน deploy; ไม่ย้อนฐานหรือ restore backup โดยอัตโนมัติ เพราะ CRUD อาจมีผู้ใช้แก้ข้อมูลแล้ว

คำสั่ง build ที่เสนอสำหรับ VPS หลังยืนยันว่ามี swap 2 GB แล้ว:

```sh
systemd-run --scope \
  -p CPUQuota=50% \
  -p MemoryMax=700M \
  -p MemorySwapMax=1536M \
  env NODE_OPTIONS="--max-old-space-size=768" npm run build
```

swap /swap-arcana ที่เปิดระหว่าง session ยังไม่ถือว่าตั้งให้เปิดอัตโนมัติหลัง reboot จนกว่าจะตรวจ /etc/fstab จริง

## ขอบเขตที่ไม่รวมในรอบนี้

- ไม่คืนโครงสร้าง backend/PHP, frontend/ หรือ Docker กลับเข้า dev
- ไม่ย้าย dump ฐานข้อมูลหรือ app.key จากบันทึก upstream มาทับเครื่องปัจจุบัน
- ไม่แก้สถานะนักศึกษา/ภาคเรียนจริงจากข้อมูลใน CLAUDE.md
- ไม่เริ่ม Scenario Builder, PWA หรือสมัครใช้งานหลายวิทยาลัย เพราะไม่ใช่ส่วนเปลี่ยนแปลงของ 2 commits นี้

## สถานะการสำรวจ

- [x] สลับ main เชื่อม remote เก่า และ pull สำเร็จแบบ fast-forward
- [x] เปรียบเทียบ 2 commits และระบุจุดย้ายจาก PHP ไป Nitro
- [x] ตรวจว่า teacher home ไม่ต้องย้ายซ้ำ และ schema ของ dev มี FK SET NULL ใน source
- [x] จัดทำ ROADMA.md
- [x] ย้ายแผนและ implementation มาที่ dev ตามคำสั่งผู้ใช้

## ผลดำเนินการบน dev (2026-10-29)

- เพิ่ม Nitro API 3 routes, service สำหรับ CRUD, จำนวนรายวิชาต่อแผนกใน overview และ UI จาก upstream แล้ว
- ใช้ transaction/auth ผ่าน staffHandler เดิม; เพิ่มการแปลง duplicate-key race เป็น 409 และกันกดบันทึกซ้ำใน UI
- inventory เพิ่มจาก 86 เป็น 89; ใช้ schema/FK เดิม ไม่เพิ่ม SQL upgrade เพราะ upstream ไม่ได้เปลี่ยน schema
- ยืนยันภาคเรียนอ่าน settings ก่อน .env อยู่แล้ว จึงไม่แก้ส่วนนี้ซ้ำ; ไม่เปลี่ยนสถานะนักศึกษาหรือค่าภาคเรียนจากบันทึก upstream
- ทดสอบ service/validator/role gate/route map 13 กรณีผ่าน (ฐานจำลอง), และทดสอบ logic ฟอร์มเพิ่ม/แก้ไข/ลบ/ข้อผิดพลาด/กันกดซ้ำ/refresh ผ่าน
- `npm run typecheck:server` และ `npm run build` ผ่าน; production health และ HTTP 401/405 ของ API ใหม่ 5 กรณีผ่าน โดยไม่เชื่อมต่อฐานข้อมูลจริง
- ชุดทดสอบอยู่ tools/tests/departments.test.ts และ departments-ui.mjs ซึ่งถูก gitignore ตามข้อตกลงเดิม
- ยังไม่ได้ทดสอบ CRUD กับ MariaDB จริงหรือ E2E ในเบราว์เซอร์ และยังไม่ได้ deploy บน VPS
- สถานะ checklist รายละเอียดด้านบนเป็นเกณฑ์แผนเดิม ให้ใช้ผลทดสอบที่ระบุจริงในส่วนนี้ประกอบ ไม่ถือว่าผ่านทุกข้อโดยอัตโนมัติ
