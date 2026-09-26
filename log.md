# Change Log

บันทึกการแก้ไขทุกครั้ง (ใหม่สุดอยู่บน)

---

## 2026-09-26 — ปรับเกมใหม่: ตัวละคร · อินเตอร์แอคทีฟ · 3 เควสต์

ผู้ใช้ลองเล่นแล้ว: “น่าเบื่อ ต้องคอยอ่าน ไม่มีตัวละคร/อินเตอร์แอคทีฟ ฉากจืด” → ปรับใหม่ทั้งระบบเกม

### ตัวละครและฉาก
- `components/game/CharacterSprite.vue` — ตัวละคร SVG สไตล์ chibi 3 แบบ (mage / owl / golem) × 5 สีหน้า (neutral, happy, surprised, sad, determined) + accessory (hood, hat, glasses, cat)
- ตัวละคร 7 ตัว: ลูมิน (นกฮูก), มิร่า, เคล, นิกซ์ (แมวพ่อค้า), พิม, อาจารย์โอริน, โกเลมดวงดาว
- `components/game/StageCast.vue` — ยืนบนเวทีซ้าย/กลาง/ขวา, คนพูดเด่นขึ้น คนอื่นมืดลง, ท่าทาง bounce/shake, หายใจ idle, ปรับตำแหน่งตามโหมด (normal/raised/low)
- ฉากใหม่: market (โคมแกว่ง), alley, sky (ดาวตก), observatory + ละอองแสงลอยทุกฉาก

### อินเตอร์แอคทีฟ
- `components/game/ChoicePanel.vue` — 3 รูปแบบ: `list`, `cards` (การ์ดไอคอน), `hotspots` (แตะวัตถุในฉาก) + `timer` นับถอยหลัง (หมดเวลาเลือก `timeout_choice`)
- ตัวละครตอบสนองต่อทุกตัวเลือก (`reply`) · ได้รับไอเทม (`reward`) พร้อม popup + กระเป๋าไอเทม · พลังงาน ✦ (+10 ต่อการตัดสินใจ, +30/+15 มินิเกม)
- มินิเกม: `MiniGameSequence.vue` (จำลำดับรูน/ดาว) และ `MiniGameOrbs.vue` (แตะเก็บแสงให้ครบเป้าในเวลา) · ผลสำเร็จ/ล้มเหลวแยกเส้นทาง → ใช้วัด Mindset จากพฤติกรรมหลังล้มเหลวจริง
- โหมด AUTO, ข้อความสั้นลง, พิมพ์เร็วขึ้น, เสียงใหม่ (note, pop, coin, success, fail)

### เนื้อเรื่อง 3 เควสต์ (seed ทั้งหมดเป็น Core Profile)
1. `arcana-gate.json` ประตูแห่งอาร์คานา — หอสมุดเวทมนตร์
2. `night-market.json` ตลาดราตรีแห่งเงา — ไล่ล่าหัวขโมย เทศกาลโคม
3. `star-observatory.json` หอดูดาวที่หลับใหล — ปลุกโกเลม พายุดาวตก
- แต่ละเควสต์วัดครบ VARK 3 ครั้ง, RIASEC ทุกด้าน ≥ 2 ครั้ง, Mindset 2–3 ครั้ง · `migrate.php` ตรวจ `validate()` ก่อน seed

### Backend
- `ScenarioEngine`: รองรับ log มินิเกม `{scene, outcome: success|fail}` + `fail_next`, เก็บ `items` จาก reward, แยก `recency()` ออกมา
- `GET /student/profile` — **Core Profile** รวมคะแนนทุกเควสต์สากลในภาคเรียน (เสมอกันใช้ผลเควสต์ล่าสุดตัดสิน)
- `GET /student/quests` ส่ง `icon/color/subtitle` จาก `content.meta` · `GET /student/results/{id}` ส่ง `items`

### Frontend อื่น ๆ
- หน้าแรกนักเรียนเป็น **แผนที่โลก** (โหนดเควสต์ + เส้นทาง + รายละเอียดเควสต์) + แถบความคืบหน้าการค้นพบตัวตน + การ์ด Core Profile
- `components/ProfileReport.vue` ใช้ร่วมกันระหว่าง `result/[id]` และหน้าใหม่ `/student/profile`
- `utils/game.ts` — type ของเนื้อเรื่อง + `replayProgress()` คืนไอเทม/พลังงานตอนเล่นต่อ

### ทดสอบ
- API: log มินิเกมผิดรูปแบบถูกปฏิเสธ, items คืนถูกต้อง, Core Profile รวม 2–3 เควสต์ถูกต้อง
- E2E bot (มือถือ 390px) เล่นครบ 3 เควสต์ ผ่านทุกรูปแบบ (cards, hotspots, list+timer, sequence แพ้/ชนะ, orbs) → ผลลัพธ์ → แผนที่ 3/3 → Core Profile · ไม่มี error ในเบราว์เซอร์
- แก้ระหว่างทดสอบ: ตัวละครถูกการ์ดบัง → ยกขึ้น/ย่อ, ป้ายชื่อ hotspot/แผนที่ล้นขอบจอ → จำกัดตำแหน่ง + ตัดบรรทัด

## 2026-09-26 — เฟส 2: Game Engine & Profiling

### Backend
- `src/Services/ScenarioEngine.php` — แกนคำนวณ Rule-based 100%
  - `forPlayer()` ตัด `tags` (ค่าคะแนน) ออกก่อนส่งให้ผู้เล่น → ผู้เรียนเดาคะแนนไม่ได้
  - `evaluate()` เล่นซ้ำเส้นทางจาก `choices_log` ตั้งแต่ฉากแรก ตรวจทุกก้าว (กันข้อมูลปลอม/เล่นไม่จบ) แล้วรวมคะแนน
  - `profile()` — VARK: ทุกด้านที่คะแนนสูงสุดเท่ากัน (multimodal เช่น "VK"); RIASEC: Holland code 3 ตัว เสมอกันตัดสินด้วยตัวที่เลือกล่าสุด; Mindset: growth/fixed/mixed; Archetype = ตัวอักษรแรกของ Holland
  - `validate()` ตรวจโครงสร้างเนื้อเรื่อง (ใช้ต่อในเฟส 3)
- `src/Controllers/StudentGameController.php` + routes:
  - `GET /student/quests` (สถานะ new / in_progress / completed ต่อภาคเรียน)
  - `GET /student/quests/{id}` (ถ้าเล่นจบแล้วในภาคเรียนนี้ → คืน result_id แทน)
  - `PUT /student/quests/{id}/progress` (Save State ทุกการตัดสินใจ)
  - `POST /student/quests/{id}/complete` (คำนวณ + บันทึก `assessment_results`, เล่นได้ 1 ครั้ง/ภาคเรียน)
  - `GET /student/results`, `GET /student/results/{id}` (เห็นเฉพาะของตัวเอง)
- `database/scenarios/arcana-gate.json` — เนื้อเรื่องสากล “ประตูแห่งอาร์คานา” 18 ฉาก 11 จุดตัดสินใจ: VARK 4 ข้อ, RIASEC 4 ข้อ (แต่ละด้านปรากฏ 2 ครั้ง), Mindset 3 ข้อ · seed ใน `migrate.php`
- ไอคอน archetype เปลี่ยนจาก emoji เป็นชื่อไอคอน SVG (hammer, telescope, palette, shield, crown, compass)

### Frontend
- `pages/student/play/[id].vue` — Visual Novel player (full screen, mobile-first): หน้าเริ่ม/เล่นต่อ, typewriter (ตัดคำไทยด้วย `Intl.Segmenter`), แตะเพื่อข้าม/อ่านต่อ, ป้ายชื่อผู้พูด, ตัวเลือกไล่ปรากฏ, effect fade/shake/flash (ระดับฉากและบรรทัด), แถบความคืบหน้า, ไอคอนบันทึกแล้ว, ปุ่มพัก, ปุ่มปิดเสียง, คีย์บอร์ด (Space/Enter, เลข 1-9)
- `components/game/VnBackground.vue` — ฉากวาดด้วย SVG: night, gate, hall, corridor, library, courtyard, crystal (หรือใส่ URL รูปได้)
- `composables/useGameAudio.ts` — เสียงสังเคราะห์ Web Audio (ไม่ต้องมีไฟล์): BGM mystery/wonder/tension, เสียงพิมพ์, เลือก, whoosh, rumble, reveal · รองรับ URL เพลง · จำสถานะปิดเสียง
- `pages/student/result/[id].vue` — ฉากเปิดการ์ด (วงเวทหมุน → การ์ดพลิก), Radar RIASEC, แท่ง VARK, มาตรวัด Mindset, คำแนะนำ, **แชร์** (Web Share พร้อมรูป / คัดลอกข้อความ) และ **บันทึกการ์ดเป็น PNG** (`html-to-image`)
- `components/ArchetypeCard.vue` (การ์ดสไตล์ทาโรต์), `components/RadarChart.vue` (SVG), `utils/profile.ts` (ป้ายชื่อเชิงบวกของ VARK/RIASEC/Mindset)
- `pages/student/index.vue` — รายการเควสต์จริงพร้อมสถานะ + การ์ดตัวตนล่าสุด · `pages/student/history.vue` — ไทม์ไลน์ประวัติ

### ทดสอบ
- API (curl): ตัดแท็กคะแนนออกแล้ว, save state, log ปลอม/เล่นไม่จบถูกปฏิเสธ, คำนวณถูก (tie-break ตามล่าสุด), ส่งซ้ำได้ผลเดิม, เล่นซ้ำ/บันทึกซ้ำในภาคเรียนเดียวกันถูกบล็อก, นักเรียนอื่นดูผลไม่ได้, ครูเรียก API นักเรียนไม่ได้
- E2E (Playwright + Edge, มือถือ 390px): เล่น 4 ตัวเลือก → พัก → หน้าแรกแสดง “เดินทางค้างไว้” → เล่นต่อจนจบ (11 ตัวเลือก) → เปิดการ์ด → เข้าเล่นซ้ำถูก redirect ไปผลลัพธ์ → ประวัติ · บันทึกการ์ดเป็นรูปสำเร็จ · ไม่มี error ในเบราว์เซอร์

---

## 2026-09-26 — ปรับ UI ธีม "Arcana" (ลึกลับ · ตื่นเต้น)

ผู้ใช้ขอ: UI เดิมไม่ดึงดูด → ปรับเป็นแนวลึกลับ น่าตื่นเต้น

### เปลี่ยน
- ธีมมืดทั้งระบบ (dark fantasy): พื้นหลัง abyss น้ำเงินม่วงเข้ม + สีทอง rune + ม่วง arcane (กำหนดใน `tailwind.config.js`)
- ฟอนต์: `Cinzel` (หัวข้อภาษาอังกฤษ) + `Chonburi` (หัวข้อภาษาไทย) + `Kanit` (เนื้อหา)
- `assets/css/main.css`: ปุ่มทองมีแสงวิ่ง (shimmer), input/card แบบกระจกออบซิเดียน, `.title-glow`, `.divider-rune`, รองรับ `prefers-reduced-motion`
- ชื่อแบรนด์ในหน้าจอ: **ARCANA PROFILE** · บทบาทแสดงเป็น นักผจญภัย / ผู้พิทักษ์ความรู้ / ผู้คุมหอคอย

### เพิ่ม component
- `MysticBackground.vue` — ท้องฟ้ากลางคืน: เนบิวลา, ดาวกระพริบ, หมอกลอย, ประกายไฟลอยขึ้น, vignette
- `MagicCircle.vue` — วงเวทหมุน (อักษรรูนบนวงนอก + เรขาคณิตหมุนสวนทาง)
- `AppIcon.vue` — ชุดไอคอนเส้น (SVG) แทน emoji

### ปรับหน้า
- `login.vue` — วงเวท + ดวงตาลอย, ข้อความชวนค้นหา, ฟอร์มมีกรอบมุมสีทอง, สั่นเมื่อรหัสผิด
- `student/teacher/admin` — hero card มีวงเวท, การ์ดฟีเจอร์แบบ "ผนึกไว้ · ปลดผนึกในเฟส N" ค่อย ๆ ปรากฏ, hover เรืองแสง
- ปุ่มออกจากระบบบนมือถือเหลือแค่ไอคอน (มี title)

### หมายเหตุ
- แก้ `tailwind.config.js` ต้อง restart `nuxt dev` (HMR ไม่โหลด config ใหม่)
- ทดสอบ E2E ผ่านเหมือนเดิม (login ผิด/ถูก 3 role, role guard, reload, logout)

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
