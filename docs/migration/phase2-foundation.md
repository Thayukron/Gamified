# เฟส 2 — Nitro, MariaDB, Auth และบัญชีผู้ใช้

## สิ่งที่ย้ายแล้ว

9 endpoints จากรายการเดิม 86 endpoints:

| Method | Path | พฤติกรรม |
|---|---|---|
| GET | `/api/health` | สถานะและเวลา Asia/Bangkok |
| POST | `/api/auth/login` | ตรวจ PHP bcrypt, ออก token แบบเดิม |
| POST | `/api/auth/logout` | ยกเลิก token ปัจจุบัน |
| GET | `/api/auth/me` | ข้อมูลผู้ใช้และ forced-password flag |
| POST | `/api/auth/forgot` | คำขอรีเซ็ต ไม่เปิดเผยว่ามีบัญชีหรือไม่ |
| GET | `/api/me/profile` | โปรไฟล์ ชื่อแผนก และสิทธิ์แก้ชื่อ |
| PUT | `/api/me/profile` | ครู/แอดมินแก้ชื่อ ผู้เรียนถูกปฏิเสธ |
| PUT | `/api/me/password` | เปลี่ยนรหัสและยกเลิก token อื่นใน transaction |
| PUT | `/api/me/username` | ยืนยันรหัสเดิม ตรวจชื่อซ้ำและสิทธิ์ |

Services แยกจาก routes; shared auth types; mysql2 connection pool พร้อม transaction/close lifecycle, date strings และ session timezone +07:00; helpers สำหรับ role, forced-password gate, ownership และภาคปัจจุบัน

## ฐานข้อมูลในเครื่อง

ตามคำสั่งผู้ใช้ ใช้ MariaDB service ในเครื่องที่ `127.0.0.1:3306` ตรวจได้เป็น MariaDB 10.6.26 ไม่มีฐานข้อมูล gamified เดิม ผู้ใช้อนุญาตสร้างใหม่แล้ว จึงสร้าง 20 ตาราง (รวม schema_migrations), admin 1 บัญชี, archetypes 6 แบบ และเควสต์สากล 3 ชุด ไม่มี demo users

ใช้ `.env` ใน root (gitignored) สำหรับ credentials; ตัวอย่างสำหรับการรันตรงอยู่ที่ `.env.nuxt.example` ไม่มีการแก้ Docker ในเฟสนี้ ไม่มีการกู้ข้อมูลจากระบบเก่า และไม่ได้อ้างว่าเป็นข้อมูลเดิมที่เคยมีใน Docker

ตัวเริ่มต้นใหม่ `frontend/scripts/init-db.mjs` ทำงานเฉพาะเมื่อระบุ `--create-empty` และฐานข้อมูลไม่มีตารางเท่านั้น ไม่เรียก PHP migrate และไม่รัน DROP TABLE หากมีตารางอยู่จะปฏิเสธ โดย schema DDL ไม่สามารถ rollback อัตโนมัติทั้งหมดได้ หากติดตั้งขัดข้องให้ตรวจตารางที่สร้างค้างก่อนดำเนินการต่อ ห้ามล้างฐานข้อมูลอัตโนมัติ

ข้อมูล base seed แปลงจาก static arrays ของ PHP เดิม ส่วน JSON เนื้อเรื่องและ schema ยังอ้าง `backend/database/` ระหว่างย้าย ต้องย้าย assets/schema ให้ครบก่อนถอด PHP directory ในเฟสสุดท้าย

## วิธีรันโดยไม่ใช้ Docker

ต้องมี Node.js 22+ และ MariaDB service ที่เริ่มทำงานแล้ว

1. ตั้งค่า `.env` ใน root ตาม `.env.nuxt.example` (หากมีอยู่แล้วให้แก้เฉพาะค่าที่จำเป็น)
2. เข้า `frontend` แล้ว `npm ci`
3. สำหรับการติดตั้งใหม่เท่านั้น: `npm run db:init -- --create-empty` — ไม่ต้องรันซ้ำบนฐานข้อมูลที่ตั้งแล้ว
4. เริ่ม dev: `npm run dev -- --dotenv ../.env` (port 3100)
5. ทดสอบ API ที่ `http://localhost:3100/api/health`

Production build และเริ่ม server:

```powershell
cd frontend
npm run build
$env:PORT = '3100'
$env:HOST = '127.0.0.1'
node --env-file=../.env .output/server/index.mjs
```

หลังติดตั้งใหม่ บัญชี `admin` รหัสเริ่มต้น `admin1234` ต้องเปลี่ยนรหัสก่อนเข้าถึงงานอื่น (ถ้าระบุ ADMIN_PASSWORD จะใช้ค่านั้น)

### ขอบเขตการทดลองตอนนี้

สถานะเฟส 2 เดิมทดลอง 9 API โดยตรงที่ port 3100; ตั้งแต่เฟส 3 frontend ส่ง auth/account และ `/student/*` ไป Nitro โดยตรงแล้ว ส่วนครู/แอดมิน/AI ยังใช้ PHP จนกว่าจะย้ายครบ ดู [ขอบเขตและบัญชีทดลองเฟส 3](phase3-game.md) อย่าใช้เป็นระบบครบทุกฟีเจอร์ในระยะนี้

Rollback เฟสนี้: กลับไปใช้ PHP API กับฐานข้อมูลเดียวกันได้เมื่อมี PHP 8.2+ รูปแบบ hash/token/schema ยังคงเข้ากันได้ ไม่เปลี่ยน schema ของแอปเดิม แต่ PHP CLI ใน PATH เครื่องนี้เป็น 7.4.9 จึงใช้เป็น app runtime ไม่ได้

## การตรวจสอบ

- Server TypeScript: `npm run typecheck:server`
- Production build: `npm run build`
- ทดสอบ auth/service 14 กรณี รวม PHP bcrypt ↔ Node ทั้งรหัส ASCII, Unicode และการตัดที่ 72 bytes (ใช้ standalone bcrypt ของ PHP CLI ไม่รันแอป PHP 7.4)
- HTTP smoke จาก production build 15 กรณี: health, validation, 401, 405, error JSON, malformed body และ CORS; บังคับใช้ปลายทาง DB ที่เชื่อมไม่ได้เพื่อไม่แตะ DB จริง
- Live MariaDB + HTTP ผ่าน 28 requests ด้วยบัญชีชั่วคราว: login, profile, เปลี่ยนชื่อ/รหัส, token revocation/expiry, inactive user, role, forced-password gate และ forgot request; ลบเฉพาะบัญชีทดสอบที่สร้างขึ้นหลังตรวจ ตรวจซ้ำเหลือ users 1 บัญชี, tokens 0, reset requests 0
- สำรองฐานข้อมูลหลังติดตั้ง ก่อนเริ่ม live tests ที่ `backups/gamified-before-phase2-auth-20261029.sql` (gitignored)
- ตามคำสั่งผู้ใช้ test files อยู่ใน `frontend/tests/` และถูก ignore ไม่รวมใน commit; คำสั่ง local คือ `npx tsx --test tests/*.test.ts`, `node tests/http-smoke.mjs`, `node --env-file=../.env tests/live-db.mjs`
- ยังไม่ทดสอบทั้งแอปกับ PHP 8.2, game/AI หรือโหลดพร้อมกัน เป็นงานเฟสต่อไป

อ้างอิง: [Nuxt 3 server routes](https://nuxt.com/docs/3.x/guide/directory-structure/server), [mysql2](https://sidorares.github.io/node-mysql2/docs/documentation), [bcryptjs](https://github.com/dcodeIO/bcrypt.js/)
