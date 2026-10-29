# API Reference

[หน้ารวมเอกสาร](../../README.md) · [หน้าแรกโปรเจกต์](../../../README.md)

API อยู่ใต้ `/api` บน origin เดียวกับหน้าเว็บ ตารางนี้สรุป endpoint หลักจาก README เดิม ไม่ใช่รายการครบทุก route

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
| POST | /api/admin/departments | admin — เพิ่มแผนก ({ code, name }) |
| PUT/DELETE | /api/admin/departments/{id} | admin — แก้ไข/ลบแผนก (ผู้ใช้และรายวิชายังคงอยู่ เปลี่ยนเป็นไม่ระบุแผนก) |
| GET | /api/admin/overview · /api/admin/users?q=&role= | admin |
| POST | /api/admin/users/{id}/reset-password | admin (รีเซ็ตเป็นชื่อผู้ใช้/รหัสนักศึกษา) |
| DELETE | /api/admin/courses/{id} | admin |
| GET/PUT | /api/me/profile · PUT /api/me/password | ทุก role (บัญชีของตนเอง) |
| POST | /api/auth/forgot | สาธารณะ (ส่งคำขอรีเซ็ต) |
| PUT | /api/admin/users/{id} · GET /api/admin/reset-requests · POST …/{id}/dismiss | admin |
| POST | /api/teacher/courses/{id}/students/{sid}/reset-password | teacher (ผู้เรียนในวิชาที่สอน), admin |

รายการ route และประวัติการย้ายระบบดูที่ [API mapping](../migration/api-map.md) ส่วน implementation ปัจจุบันอยู่ใน `server/api/`

## จัดการแผนกวิชา (admin)

ต้องเข้าสู่ระบบด้วยบัญชี admin และตั้งรหัสผ่านใหม่เรียบร้อยแล้ว ใช้ `Authorization: Bearer <token>` เช่นเดียวกับ API ที่ต้องเข้าสู่ระบบอื่น

POST `/api/admin/departments` และ PUT `/api/admin/departments/{id}` รับ JSON:

```json
{ "code": "IT", "name": "เทคโนโลยีสารสนเทศ" }
```

- รหัสแปลงเป็นตัวพิมพ์ใหญ่ ยาว 1–20 ตัว ใช้ A–Z, 0–9, จุด, ขีดล่าง และขีดกลางได้ ต้องไม่ซ้ำ
- ชื่อยุบช่องว่าง ต้องไม่ว่างและไม่เกิน 150 ตัวอักษร Unicode
- เพิ่มสำเร็จคืน `{ id, message }`; แก้ไขคืน `{ ok: true, message }`; DELETE คืน `{ ok: true }`
- ข้อมูลผิดตอบ 422, รหัสซ้ำ 409, ไม่พบแผนก 404, ไม่เข้าสู่ระบบ 401, ไม่มีสิทธิ์ 403
- ลบแผนกแล้วผู้ใช้และรายวิชาเดิมยังอยู่ โดย `department_id` เป็น NULL ผ่าน foreign keys
- GET `/api/admin/overview` มี `departments[].courses` เพิ่มจากจำนวนนักศึกษาและครูเดิม

Route inventory ปัจจุบันมี 89 รายการ (รวม API แผนก 3 รายการ) ส่วนเอกสารประวัติ migration เดิมอาจยังบันทึก 86 รายการตามช่วงเวลาที่จัดทำ
