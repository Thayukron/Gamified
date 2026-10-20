# CLAUDE.md — บริบทโปรเจกต์สำหรับต่อแชท

> ไฟล์นี้เก็บบริบทการสนทนา/การตัดสินใจ เพื่อให้เปิดแชทใหม่แล้วทำงานต่อได้ทันที
> ประวัติการแก้ไขละเอียดอยู่ใน [log.md](log.md) · ข้อกำหนดระบบอยู่ใน [requiments.md](requiments.md)

## ข้อตกลงการทำงานกับผู้ใช้ (ต้องทำทุกครั้ง)
1. สื่อสารเป็นภาษาไทย
2. ทำทีละเฟส → **รันให้ผู้ใช้ดูก่อน** → รอผู้ใช้ตอบรับ แล้วค่อยทำเฟสต่อไป
3. ทุกครั้งที่แก้ไข: บันทึกใน `log.md` + อัปเดตสถานะใน `CLAUDE.md` นี้
4. ทุกครั้งที่แก้ไข: `git commit` และ `git push` ไปที่ `origin main` (https://github.com/Thayukron/Gamified)

## การตัดสินใจสำคัญของผู้ใช้
- **AI = Gemini, BYOK รายครู** (ผู้ใช้กำหนด): ห้ามให้ระบบกลางจ่ายโทเคนโดยอัตโนมัติ · เรียก AI เฉพาะเมื่อครูกดปุ่ม + cache · ส่งเฉพาะสถิติรวม ไม่ส่งชื่อนักเรียน · ไม่ hardcode ชื่อรุ่น Gemini (เลือกจาก models.list)
- **เป้าหมายหลักของระบบ = ไกด์การจัดการเรียนการสอนให้ครู** (สื่อ/วิธีสอน/ซ่อมเสริม/จัดกลุ่ม) ตามผู้เรียนที่แตกต่าง แยกตามรายวิชาและแผนก · เกมเป็นแค่เครื่องมือคัดกรอง
- ชื่อระบบ **ARCANA PROFILE** (ไม่ใช้ Questify) · ธีม **ผสม**: dark fantasy เป็นหลัก + เพิ่มเควสต์ฉากวิทยาลัย/สายอาชีพ · **ยังไม่เพิ่ม Computational Thinking**
- ระดับการ์ดต้องไม่ทำให้ผู้เรียนรู้สึกแย่: ไม่มีระดับต่ำ, ให้รางวัลจากการมีส่วนร่วม ไม่ใช่บุคลิก
- ดีไซน์อ้างอิงจาก Gemini: [docs/design-gemini.md](docs/design-gemini.md)

## ภาพรวมระบบ
Gamified Universal Student Profiling System — ผู้เรียนเล่นเกม Visual Novel เพื่อวัด VARK / RIASEC / Mindset (Rule-based 100%, ไม่เสียค่า API ระหว่างเล่น)
ครูดูแดชบอร์ด + ใช้ AI (BYOK) แปลผลตามบริบทรายวิชา · แอดมินจัดการข้อมูลส่วนกลาง

## สภาพแวดล้อม Dev (เครื่องผู้ใช้ Windows 11)
| ส่วน | รายละเอียด |
|---|---|
| DB | **ชุดเดียว = MariaDB 11.4 ใน Docker `127.0.0.1:3320`** (ผู้ใช้กำหนด: ห้ามแยกฐานข้อมูล dev/จริง) · `config.php` อ่าน `.env` เมื่อรันนอก Docker · `backend/storage/app.key` = ตัวเดียวกับ container · ฐานเก่า 3310 (`C:\Users\USER\.gamified-mysql`) เลิกใช้แล้ว |
| API | PHP 8.2 built-in server `php -S 127.0.0.1:8100 -t public public/index.php` (ใน `backend/`) |
| Frontend | Nuxt 3.21 dev **port 3100** (port 3000 มีแอปอื่นของผู้ใช้ใช้อยู่) · **API dev ใช้ 8100 เพราะ 8000 ถูก Docker ของ btech-sice ใช้** |
| สคริปต์ | `start-dev.ps1` เปิด db (Docker) + API 8100 + Nuxt 3100 · **ห้ามรัน `migrate.php`** (ล้างข้อมูลจริง; สคริปต์ปฏิเสธเมื่อมีผู้ใช้ เว้นแต่ `--wipe-real-data`) |
| ทดสอบ E2E | ใช้ playwright-core + Edge (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`) ติดตั้งใน scratchpad ไม่ใส่ในโปรเจกต์ |

บัญชีทดสอบ: `admin/admin1234`, `teacher1/teacher1234` (วิชา DSA แผนก IT), `teacher2/teacher1234` (บัญชี), `student001..010/student1234` (ยังไม่เล่น) · student011–046 = ข้อมูลตัวอย่างที่เล่นแล้ว (DemoPlayer)

## โครงสร้างโค้ด
```
backend/
  config.php            ค่า default (override ด้วย config.local.php — gitignored)
  bootstrap.php         autoload App\* -> src/*, app_config()
  routes.php            ประกาศ route ทั้งหมด ($router->get/post/put/delete(path, handler, roles))
  public/index.php      front controller + CORS + error handling
  src/Core/             Database(PDO), Router, Request, Response, HttpException, Auth(bearer token)
  src/Controllers/      AuthController, StudentGameController
  src/Services/ScenarioEngine.php  ตัดแท็กก่อนส่งผู้เล่น / replay log ตรวจเส้นทาง + รวมคะแนน / profile() / validate()
  database/schema.sql   ตารางทั้งหมด · migrate.php = run schema + seed
  database/scenarios/   JSON เนื้อเรื่อง (arcana-gate.json = ชุดสากล)
frontend/  (Nuxt 3, ssr:false SPA, Pinia, Tailwind, ฟอนต์ Prompt)
  composables/useApi.ts   $fetch + Bearer token, 401 -> logout
  stores/auth.ts          token ใน localStorage key gsp_token
  middleware/auth.global.ts  บังคับ login + จำกัดพื้นที่ /student /teacher /admin ตาม role
  layouts/default.vue, blank.vue · pages/{login,student,teacher,admin}
  assets/css/main.css     class ร่วม: btn-primary, btn-ghost, input, label, card, card-hover, title-glow, divider-rune
  components/             MysticBackground, MagicCircle, AppIcon (ไอคอน SVG), ComingSoonGrid (การ์ด "ผนึก"), ArchetypeCard, RadarChart, game/VnBackground
  composables/useGameAudio.ts  เสียงสังเคราะห์ Web Audio (bgm preset: mystery/wonder/tension หรือ URL)
  utils/profile.ts        ป้ายชื่อเชิงบวก VARK/RIASEC/Mindset + type AssessmentResult
  pages/student/          index (แผนที่โลก), play/[id] (VN player), result/[id], profile (Core Profile รวม), history
  components/game/        CharacterSprite, StageCast, ChoicePanel, MiniGameSequence, MiniGameOrbs, VnBackground
  components/ProfileReport.vue  การ์ด+กราฟ+แชร์ ใช้ร่วม result/profile · RewardSummary, AvatarCreator
  components/game/CharacterPortrait.vue  ครอปหน้าสำหรับกล่องข้อความ/HUD
  utils/progression.ts + backend Services/Progression.php  XP/เลเวล/เหรียญ/ระดับการ์ด (ตัวเลขต้องตรงกัน)
  composables/usePlayer.ts  ข้อมูลผู้เล่น (xp, coins, avatar)
```

### ธีม UI "ARCANA" (ผู้ใช้ต้องการแนวลึกลับ น่าตื่นเต้น — ใช้ต่อทุกหน้าใหม่)
- Dark fantasy: สี `abyss-*` (พื้น), `rune-*` (ทอง/เน้น), `arcane-*` (ม่วง), shadow `glow` / `glow-gold`
- ฟอนต์ `font-display` (Cinzel+Chonburi) สำหรับหัวข้อ, `font-sans` = Kanit
- **เครื่องผู้ใช้เปิด “ลดการเคลื่อนไหว”**: ทุกแอนิเมชันที่เริ่มจาก opacity 0 ต้องมี fallback `prefers-reduced-motion` และทดสอบด้วย Playwright `reducedMotion: 'reduce'`
- **ต้องอธิบายวิธีเล่นทุกจุด** (ผู้ใช้ย้ำ): ทุกการโต้ตอบใหม่ต้องมีป้ายบอกว่าทำอะไร, มินิเกมต้องมีกติกา+ปุ่มเริ่ม
- **เกมต้องมีส่วนร่วมสูง** (ผู้ใช้ย้ำ): มีตัวละครบนจอ + สีหน้า + ตอบสนองทุกตัวเลือก, ข้อความสั้น, สลับรูปแบบ (cards/hotspots/timer/มินิเกม), มีรางวัล — อย่าทำเกมที่ต้องอ่านอย่างเดียว
- **ภาพจริงจาก Gemini** (ผู้ใช้สร้าง): ตัวละคร `frontend/public/characters/{id}-{expr}.webp`, ฉาก `frontend/public/backgrounds/{key}.webp` · ต้นฉบับ `art-source/` (gitignore) · แปลงด้วย `tools/process-art.js` · ภาพใหม่ให้ผู้ใช้สร้างตาม `docs/art-prompts.md` (พื้นเขียว 9:16)
- SVG ใน `CharacterSprite.vue` เป็น fallback + ใช้กับ avatar ผู้เล่น
- เพิ่มโฟลเดอร์ใหม่ใน `frontend/public/` แล้วต้อง restart nuxt dev
- ใช้ `AppIcon` แทน emoji · ถ้อยคำเชิงผจญภัย (นักผจญภัย, เควสต์, ผนึก, คัมภีร์) · แอนิเมชัน `animate-fade-up` ไล่ delay
- แก้ `tailwind.config.js` แล้วต้อง restart nuxt dev · ถ้า port 3100 ถูกยึดโดย nuxt ตัวเก่า ให้ kill node ที่ commandline มี `nuxt` + `Gamified`

### รูปแบบโค้ด
- Controller เป็น static method รับ `Request $req` คืน array (Router แปลงเป็น JSON) · error ใช้ `throw new HttpException(code, 'ข้อความไทย')`
- Route ที่ต้อง login ส่ง roles เป็น argument ที่ 3 (`['*']` = ทุก role) → `$req->user`
- คะแนนเก็บเป็นคอลัมน์แยกใน `assessment_results` (vark_v/a/r/k, riasec_r..c, mindset_growth/fixed) เพื่อ query สถิติง่าย
- Save state อยู่ในตาราง `game_sessions` (1 แถวต่อ user+scenario)
- เนื้อเรื่องเก็บเป็น JSON ใน `scenarios.content` (ดูรูปแบบเต็มใน docblock ของ `ScenarioEngine.php` และ type ใน `frontend/utils/game.ts`; มี `meta`, `characters`, scene `cast`, `layout`, `timer`, `minigame`, choice `reply`/`reward`/`icon`/`x,y`) เดิม: `{start, scenes:{id:{background,bgm,effect,dialogue:[str|{speaker,text,effect}],choices:[{text,tags:{vark_v:1,...},next}],next,end}}}`
- แท็กคะแนนที่ใช้ได้: vark_v/a/r/k, riasec_r/i/a/s/e/c, mindset_growth/fixed · `choices_log` = `[{scene, choice}]`
- ภาคเรียนปัจจุบันมาจาก `config.php` (academic_year, semester) · ผลลัพธ์ unique ต่อ user+scenario+ภาคเรียน

## แผนการพัฒนา (Phases)
- [x] **เฟส 1 Foundation** — schema, PHP API + auth token, Nuxt login + role routing
- [x] **เฟส 2 Game Engine** — Quest list (เช็คเล่นแล้วหรือยัง), VN player (typewriter/shake/fade/เสียง), save state real-time, rule-based scoring, Archetype card, ประวัติ, แชร์ผล + seed เนื้อเรื่องสากล 1 ชุด
- [ ] **เฟส 3 Scenario Builder + Story Library** — CRUD scene/choice ผูกคะแนน, export JSON, คัดลอกจากคลังกลาง, แอดมินเปิด/ปิดชุดสากล
- [ ] **เฟส 4 Dashboard** — Pie/Bar ระดับห้อง, Radar รายบุคคล (Chart.js), จัดกลุ่มทำงานอัจฉริยะ
- [ ] **เฟส 5 AI** — ตั้งค่า BYOK, Contextual AI Prompting + ai_insights_cache, AI Story Generator
- [x] **เฟส 6 Management & Reports** — นำเข้า Excel/CSV (`/admin/import`), ข้อมูลในระบบ (`/admin/data`), ส่งออก PDF/Excel (ว.PA)
- [ ] **เฟส 7 PWA & Performance** — manifest/service worker, ทดสอบโหลด 500–1000 users

## สถานะล่าสุด
- 2026-09-26: เสร็จเฟส 1 และทดสอบ E2E ผ่าน (login ทั้ง 3 role, กันเข้าพื้นที่ role อื่น, reload คง session, logout)
- 2026-09-26: ผู้ใช้ขอปรับ UI ให้ลึกลับ/ตื่นเต้น → ทำธีม ARCANA เสร็จ, E2E ผ่าน (ผู้ใช้ชอบ)
- 2026-09-26: เสร็จเฟส 2 Game Engine
- 2026-09-26: ผู้ใช้บอกเกมน่าเบื่อ → ปรับใหม่: ตัวละคร SVG มีสีหน้า, ตัวเลือกแบบการ์ด/แตะฉาก/จับเวลา, มินิเกม 2 แบบ, ไอเทม+พลังงาน, AUTO, 3 เควสต์, แผนที่โลก, Core Profile รวม · E2E ผ่าน · DB รีเซ็ตแล้ว
- 2026-09-27: ผู้ใช้ขอตัวละครสมจริงขึ้น → วาดใหม่เป็นอนิเมะครึ่งตัว (hairStyle, beard, child) + รองรับไฟล์ภาพ `image`/`images` ใน `frontend/public/characters/` · E2E ผ่าน
- 2026-09-27: ศึกษาแชท Gemini ของผู้ใช้ → `docs/design-gemini.md` (+ภาพ `docs/design/`) · ผู้ใช้เลือก: ชื่อ ARCANA PROFILE, ธีมผสม (แฟนตาซีหลัก + เควสต์วิทยาลัย/อาชีพ), ยังไม่ทำ CT · ทำ XP/เลเวล/เหรียญ, Avatar, portrait ในกล่องข้อความ, ระดับการ์ด เสร็จ E2E ผ่าน · งานถัดไปที่ตกลงไว้: เควสต์ฉากวิทยาลัย/อาชีพ (จากคลัง 12 ฉากของ Gemini) แล้วจึงเฟส 3
- 2026-09-27: แก้ตามผู้ใช้: เอาภาพหน้าใหญ่ในกล่องข้อความออก, เพิ่มวิธีเล่น/คำอธิบายทุกจุด, ด่านจับเวลาเร่งเร้า, กติกามินิเกม+ปุ่มเริ่ม · ภาพสวยแบบ Gemini = ข้อจำกัด (SVG) → ให้ผู้ใช้สร้างภาพจาก `docs/art-prompts.md`
- 2026-09-27: ผู้ใช้ส่งภาพจาก Gemini ครบ (35 ตัวละคร + 11 ฉาก) → ตัดพื้นเขียว/บีบอัดด้วย `tools/process-art.js` → ใช้ในเกมแล้ว · ถัดไป: เควสต์ฉากวิทยาลัย/อาชีพ (ต้องขอภาพฉาก/ตัวละครใหม่จากผู้ใช้ตาม art-prompts) แล้วเฟส 3
- 2026-09-27: แก้ลูกแสงไม่ขึ้น (เครื่องผู้ใช้เปิด reduced-motion) · หน้าเลือกตัวละครเป็นแกลเลอรีภาพจริง 6 ฮีโร่ `hero-{m,f}{1-3}`
- 2026-09-27: ใส่ภาพฮีโร่ 6 แบบแล้ว (สีหน้าเดียว ภาพเต็มตัว `public/characters/hero-*.webp`, `fullBody`)
- 2026-09-27: **เปลี่ยนทิศทาง (ผู้ใช้เห็นด้วยอย่างยิ่ง)**: เป้าหมายคือไกด์ให้ครูสอนผู้เรียนที่แตกต่างตามรายวิชา/แผนก → ทำฝั่งครูก่อน A แดชบอร์ด → B ไกด์การสอน rule-based → C จัดกลุ่ม → D รายงาน ว.PA → E AI · พักเควสต์วิทยาลัย/Scenario Builder · วิชาตัวอย่าง: โครงสร้างข้อมูลและอัลกอริทึม แผนก IT · ขั้น A เสร็จ
- 2026-09-27: **ขั้น B ไกด์การสอน เสร็จ** (`src/Guide/Knowledge.php` + `TeachingGuide.php`, หน้า `/teacher/course/[id]/guide`, แก้บริบทวิชาได้) · ใช้หัวข้อ DSA มาตรฐาน 8 หัวข้อ
- **สรุปงานให้ผู้ใช้ต้องเป็นภาษาไทยเสมอ** และต้องบอกผลเทส + ได้/ไม่ได้ตามเป้าหมายชัดเจน (ผู้ใช้ตำหนิเมื่อสรุปเป็นอังกฤษ)
- 2026-09-27: **ขั้น E AI เสร็จ** (ผู้ใช้เลือก Gemini, ทำ E ก่อน C/D) · **ครูแต่ละคนใช้ API Key ของตนเอง (BYOK)** ระบบกลางไม่เสียโทเคน · Key กลางใช้ได้เฉพาะครูที่แอดมินอนุญาต · ถัดไป: C จัดกลุ่ม → D รายงาน ว.PA
- 2026-09-27: ผู้ใช้กรอก Key จริง (รูปแบบใหม่ `AQ.`) → เจอ 503 จาก Google → เพิ่ม retry + รุ่นสำรอง → **ทดสอบ Gemini จริงสำเร็จ** · ⚠ อย่ารัน migrate.php โดยไม่จำเป็น เพราะ Key ของครูจะหาย · ถัดไป: C จัดกลุ่ม → D รายงาน ว.PA
- 2026-09-27: แก้การพิมพ์ PDF ไกด์ (เดิมอ่านไม่ได้เพราะธีมมืด) → print stylesheet ทั้งระบบใน main.css (ใช้ class `print-doc` / `no-print` / `print-only` กับหน้าใหม่ที่ต้องพิมพ์) · **PDF ใช้ฟอนต์ TH SarabunPSK คอลัมน์เดียว เยื้องย่อหน้าแบบเอกสารราชการ · ขนาด: หัวข้อหลัก 18pt หนา / หัวข้อรอง 16pt หนา / เนื้อหา 16pt ธรรมดา** (ผู้ใช้กำหนด ใช้กับรายงานขั้น D ด้วย) · ถัดไป: C จัดกลุ่ม → D รายงาน ว.PA
- 2026-09-27: **ขั้น C จัดกลุ่มอัจฉริยะ เสร็จ** (`GroupingService`, หน้า `/teacher/course/[id]/groups`, ตาราง `course_groupings`) · ถัดไป: **ขั้น D รายงาน ว.PA** (ใช้ข้อมูลแดชบอร์ด+ไกด์+การจัดกลุ่มที่บันทึก, ฟอนต์ TH SarabunPSK 18/16/16) + Excel
- 2026-09-27: **ขั้น D รายงาน ว.PA เสร็จ** (หน้า `/teacher/course/[id]/report` PDF 13 หน้า + Excel 3 ชีต, สถานศึกษา วิทยาลัยการอาชีพศรีสะเกษ) → **ครบ A–E ฝั่งครูแล้ว รอผู้ใช้ตรวจ** · ⚠ ติดตั้ง npm package แล้วต้อง restart nuxt + ลบ .nuxt/node_modules/.vite · งานที่เหลือตาม requirement: นำเข้า CSV/Excel + จัดการรายวิชา (แอดมิน), Scenario Builder, PWA, ทดสอบโหลด 500–1000 คน
- 2026-09-27: **ระบบนำเข้าข้อมูล (แอดมิน) เสร็จ** — `/admin/import` แม่แบบ Excel 5 ชีต (แผนก → ครู → นักศึกษา → รายวิชา → การลงทะเบียน) หรือ CSV, อ่านไฟล์ในเบราว์เซอร์ (`utils/importData.ts`, หัวคอลัมน์ไทย/อังกฤษ, ข้ามแถวคำอธิบาย/ตัวอย่าง, ส่ง `_row` = เลขแถวจริง) → ตรวจสอบ (`ImportService::validate`) → บันทึกใน transaction เดียว · นำเข้าซ้ำ = อัปเดต ไม่ซ้ำ · รหัสผ่านว่าง = ชื่อผู้ใช้/รหัสนักศึกษา · `/admin/data` ภาพรวม/รายวิชา(ลบ)/ค้นหาผู้ใช้(รีเซ็ตรหัสผ่าน) · ทดสอบโดย backup/restore DB (Key ครูยังอยู่) · ถัดไป: ปรับรายงานตามแบบฟอร์มจริง (รอผู้ใช้), Scenario Builder, เควสต์วิทยาลัย, PWA, ทดสอบโหลด
- 2026-09-27: เขียน `docs/knowled.md` อธิบายชื่อ ARCANA PROFILE + ทฤษฎี VARK/RIASEC/Mindset + เหตุผลที่ใช้เกม + อ้างอิง (ใช้ตอบคำถามเชิงแนวคิด/นำเสนอ)
- 2026-09-27: **ครูสร้างรายวิชา + เลือกกลุ่มผู้เรียนเองได้** (ผู้ใช้กำหนด: ผลเกมใช้ร่วมกันทุกวิชา ครูแค่ผูกวิชากับกลุ่มของตน) · `users.class_group` (ALTER ไม่รีเซ็ต) · `TeacherCourseController` · หน้า `/teacher/course/new`, `/teacher/course/[id]/students` · ⚠ DB มีข้อมูลที่ผู้ใช้นำเข้าเองแล้ว (ครู wichai, kanisron ฯลฯ) — ห้าม migrate/restore backup เก่า ให้ backup ใหม่ก่อนทดสอบทุกครั้ง
- 2026-09-27: **บัญชีของฉัน/เปลี่ยนรหัสผ่าน/ลืมรหัสผ่าน/แอดมินแก้ไขผู้ใช้** — `/account` ทุกบทบาท · ลืมรหัสผ่าน = คำขอถึงแอดมิน/ครูประจำวิชา (ไม่มีอีเมล) → รีเซ็ตเป็นรหัสชั่วคราว = ชื่อผู้ใช้ + **บังคับตั้งใหม่ (`must_change_password`, กันทั้ง frontend middleware และ Router)** · บัญชีนำเข้าที่ไม่กำหนดรหัสก็ถูกบังคับเปลี่ยน · `backend/bin/reset-password.php` สำหรับกรณีฉุกเฉิน · E2E ทดสอบใช้ `p.goto('/account')` เพราะนักศึกษาใหม่มีหน้าต่างเลือกตัวละครบังหน้า
- 2026-09-28: ทำเอกสารสรุปนำเสนอระบบ 1 หน้า `docs/สรุปนำเสนอระบบ-ARCANA-PROFILE.pdf` (ต้นฉบับ `docs/src/สรุปนำเสนอระบบ.html`)
- 2026-09-28: **Docker + deploy ผ่าน git** — `docker compose up -d --build` → http://localhost:8090 (web=Nginx+SPA, api=PHP/Apache, db=MariaDB 11.4 พอร์ต 127.0.0.1:3320) · ค่าใน `.env` (ดู `.env.example`) · คู่มือ `DEPLOY.md` · `install.php` ปลอดภัย (ไม่ลบข้อมูล) · **เปลี่ยนโครงสร้าง DB ต่อจากนี้: แก้ schema.sql + เพิ่มไฟล์ `backend/database/upgrades/<วันที่>_<ชื่อ>.sql`** · docker.exe อยู่ที่ `C:/Users/USER/AppData/Local/Programs/DockerDesktop/resources/bin` (ไม่อยู่ใน PATH ของ Git Bash) · ข้อมูลผู้ใช้ถูกย้ายเข้า Docker แล้ว (ชุด dev พอร์ต 3310 ยังอยู่และยังใช้พัฒนาได้ แต่เป็นคนละชุดข้อมูล)
- 2026-10-16: **แผนการจัดการเรียนรู้ตามแบบฟอร์มสถานศึกษา เฟส 1 เสร็จ** (ฟอร์ม สอศ. 2567 ฐานสมรรถนะ MIAP, ไฟล์ต้นแบบที่ผู้ใช้ให้อยู่ root ไม่ได้ commit) · แผนรายหน่วยข้อ 1–10 + 6.5 ปรับตามผู้เรียน + ภาคผนวกผลวิเคราะห์ผู้เรียน · ส่งออก Word (docx+jszip, ต้องใส่ `<w:cs/>`+`lang th-TH` ให้ไทยตัดคำถูก) · AI ร่างทุกข้อ (BYOK) / ร่างจากไกด์ · ตาราง `lesson_plans` · ตรวจไฟล์ Word: `scratchpad/docx2pdf.ps1` (Word COM) + `pdf2png.ps1` (Windows.Data.Pdf) · **พอร์ต 3100 ถูกโปรเจกต์ btech-sice ของผู้ใช้ใช้อยู่ → nuxt dev ของเราใช้ `--port 3110` + เพิ่ม cors ใน config.local.php ชั่วคราว** · เฟสถัดไปที่เสนอ: ระดับรายวิชา (หลักสูตรรายวิชา ตารางวิเคราะห์หน่วย/พฤติกรรม K-S-A-Ap ตารางหน่วยและชั่วโมง ปก คำนำ สารบัญ) → ใบความรู้/ใบงาน/ใบกิจกรรม/ใบมอบหมายงาน/แบบประเมิน
- 2026-10-16: **แผนการจัดการเรียนรู้ เฟส 2 (เล่มระดับรายวิชา) เสร็จ** — `/teacher/course/[id]/plans/book` · ตาราง `course_plans` · Word ฉบับเต็มเรียงตามแบบฟอร์ม (ปก/คำนำ/สารบัญ TOC/หลักสูตรรายวิชา/มาตรฐานอาชีพ/วิเคราะห์หน่วย/วิเคราะห์พฤติกรรมแบบ 2/ชั่วโมง/แผนรายหน่วย/บรรณานุกรม/ภาคผนวก) · AI ไม่แตะข้อมูลหลักสูตรรายวิชา · ตรวจสารบัญด้วย `scratchpad/docx2pdf-toc.ps1` · เฟสถัดไปที่เสนอ: ใบความรู้/ใบงาน/ใบกิจกรรม/ใบมอบหมายงาน/แบบประเมิน
- 2026-10-16: **แผนการจัดการเรียนรู้ เฟส 3 (เอกสารประกอบ) เสร็จ** — ใบความรู้/ใบงาน/ใบกิจกรรม/ใบมอบหมายงาน/แบบประเมิน (Rubric) · ตาราง `lesson_sheets` · หน้า `plans/[pid]/sheets/[sid]` · ชนิด/หัวข้อกำหนดที่ `utils/lessonPlan.ts` (SHEET_TYPES) + `LessonSheetService::FIELDS` (ต้องแก้คู่กัน) · ครบชุดแบบฟอร์มแผนของสถานศึกษาแล้ว (ปก→แผน→เอกสารประกอบ→ภาคผนวก)
- 2026-10-17: **ปรับ UX แผนการสอนตามผู้ใช้ (ผู้ใช้บอกว่ายุบยับ/ใช้ยาก)** — หน้ารวมเป็นรายการหน่วย + “เริ่มทำแผน” คลิกเดียว · พื้นที่ทำงานหน่วยเดียวมีแท็บต่อฟอร์ม หัวข้อพับ (SectionAccordion) · **ส่งออก Word หน่วยเดียวรวมทุกฟอร์ม + ให้เลือกฟอร์มก่อนส่งออก** (ExportDialog; ทั้งรายวิชาเลือกส่วน/หน่วย/ชนิดฟอร์มได้) · **เนื้อหารายวิชา (จุดประสงค์/สมรรถนะ/คำอธิบาย/ชั่วโมง) อยู่ในฟอร์มรายวิชา** และใช้ร่วมกับเล่ม + AI · หลักการ UX ที่ผู้ใช้ต้องการ: แสดงน้อย ซ่อนรายละเอียดจนกดเปิด ทำงานทีละขั้น · ⚠ อย่าเขียนไฟล์ TS ผ่าน `php -r` ใน bash (เครื่องหมาย ' หาย) — ตรวจด้วย `npx esbuild <file>`
- 2026-10-17: **AI แบ่งหน่วยการเรียนจากคำอธิบายรายวิชา** (ผู้ใช้เสนอ) — ฟอร์มรายวิชา 3 ขั้น (ข้อมูลวิชา → เนื้อหารายวิชา → หน่วยการเรียน) · `TeacherUnitList` + `POST /teacher/units/suggest` · ครูตรวจ/ติ๊กเลือก/แก้ชื่อก่อนใช้เสมอ (AI ไม่บันทึกเอง)
- 2026-10-17: **ปรับ AI ให้เขียนละเอียด (ผู้ใช้บอกว่าข้อมูลน้อย/ไม่ได้ใจความ)** — prompt กำหนดโครงสร้าง+ความยาวขั้นต่ำต่อข้อ · maxOutputTokens 24k · JSON เสียลองใหม่ 1 ครั้ง · Word จัดย่อหน้าตาม 1./1.1/คำอธิบาย + กล่องโค้ด · ทดสอบกับ Gemini จริง (Key teacher1) ผ่านแล้ว · หลักการ: ทดสอบคุณภาพเนื้อหากับ Gemini จริงด้วย ไม่ใช่แค่ mock
- 2026-10-19: **ฐานข้อมูลชุดเดียว (ผู้ใช้กำหนด: ไม่ให้มี DB dev/จริงแยกกัน)** — เลิกใช้ DB 3310 · ชุดพัฒนา (API 8100) ต่อ Docker DB 3320 ผ่าน `.env` · `migrate.php` ปฏิเสธเมื่อมีผู้ใช้ · ⚠ การทดสอบใด ๆ จากนี้กระทบข้อมูลจริง: สำรองก่อน (`mariadb-dump` ใน container), ใช้บัญชีทดสอบ, ห้ามสร้าง/ลบข้อมูลของผู้ใช้จริงโดยไม่ถาม
- 2026-10-19: **ครู/แอดมินเปลี่ยนชื่อผู้ใช้เองได้** (`PUT /me/username`, หน้า `/account`) — แนวทางผู้ใช้: นำเข้าครูด้วยชื่อชั่วคราว teacher1, 2, … แล้วครูตั้งชื่อเอง · นักศึกษาเปลี่ยนไม่ได้ (= รหัสนักศึกษา) · ⚠ นำเข้าไฟล์เดิมซ้ำหลังครูเปลี่ยนชื่อ = ได้บัญชีชื่อชั่วคราวใหม่ · ไฟล์สำรอง DB เก็บใน `backups/` (gitignore)
- 2026-10-19: **ธีมทางการครู/แอดมิน เฟส 1** (ผู้ใช้เลือก “สว่าง ทางการ”) — สีเป็น CSS variable, `html.theme-staff` ตั้งใน layouts/default.vue · **หน้าใหม่ฝั่งครู/แอดมินใช้ class เดิมได้เลย แต่ห้าม hardcode สีเข้ม (#140d2b ฯลฯ) และห้ามใช้ `text-white` กับตัวอักษรบนชิปสีทึบ (ในธีมครู white = สีกรมท่า) ให้ใช้ `text-[#fff]`** · ฟอนต์ครู IBM Plex Sans Thai · ผู้เรียน/login คง ARCANA · ถัดไป เฟส 2 ถ้อยคำทางการ (รอผู้ใช้ตรวจ)
- 2026-10-19: **ธีมครู/แอดมินใหม่ = แดชบอร์ดทันสมัย** (ผู้ใช้บอกว่าธีมทางการรอบแรกจืด/เชย) — `StaffShell` เมนูซ้าย, ไล่สีคราม→ม่วง, `StaffIcon` กรอบไอคอนไล่สีตามหมวด, `.staff-hero` แถบต้อนรับ, `.staff-section` หัวข้อ, สี `snow` = ขาวจริง · หน้าใหม่ฝั่งครูใช้ชุดนี้ · ถัดไป: ปรับหน้าด้านใน (ป้ายภาษาอังกฤษ TEACHING GUIDE ฯลฯ, ไอคอนเดิม) ให้เข้าชุด
- 2026-10-19: **Word เยื้องแบบหนังสือราชการตามแบบฟอร์ม** — เยื้องเฉพาะบรรทัดแรก (`p(..., { first })`), บรรทัดถัดไปชิดซ้าย · ระดับ 1 ซม. / 1.5 ซม. / 2 ซม. (IND1 567, IND2 851, STEP 284) · ฟอร์มใหม่ใน lessonPlanDocx ให้ใช้ `first` ไม่ใช้ left indent (ยกเว้นกล่องโค้ด/บรรณานุกรม hanging)
- 2026-10-20: **AI ค้นมาตรฐานอาชีพ TPQI ข้อ 2** (`POST /teacher/plans/{pid}/standard`, ปุ่มในข้อ 2 ของแผน) — ใช้ Google Search grounding ถ้า Key มีโควตา, ไม่มี (Key ฟรีของ teacher1 = 429) → ตอบจากความรู้ AI + เตือนให้ตรวจ tpqi-net · ไม่พบ = เว้นว่าง · Word ไม่พิมพ์ 1)–4) เมื่อไม่มีมาตรฐาน
- 2026-10-20: **เติมจากไกด์ตรงเนื้อหาหน่วย** — `Knowledge::TOPIC_DETAIL` (สาระ+สื่อเฉพาะ 8 หัวข้อ DSA), `topicKey()`, แม่แบบสื่อ/สาระที่ใส่ชื่อเรื่องสำหรับหัวข้ออื่น · เพิ่มหัวข้อใหม่ในคลังได้ที่ TOPICS + TOPIC_DETAIL (คีย์เดียวกัน)
- 2026-10-20: **คู่มือ `Manual.md`** (ผู้ใช้ขอ) — เปิด/ปิด/อัปเดตระบบ, Cloudflare Tunnel (cloudflared ติดตั้งในเครื่องแล้ว: `cloudflared tunnel --url http://localhost:8090`), สำรอง/กู้คืน, แก้ปัญหา · แก้ขั้นตอนการรันเมื่อไรให้อัปเดตคู่มือนี้ด้วย
- 2026-10-20: **นำเข้าข้อมูลแบบใหม่** — แอดมินนำเข้าไฟล์ละประเภท (ครู/นักศึกษา/แผนก; ไม่มีรายวิชาแล้ว) · ครูนำเข้ารายชื่อนักศึกษาในวิชาตนเอง (`RosterImportService`, แท็บในหน้ารายชื่อ) สร้างบัญชีที่ยังไม่มี + เพิ่มเข้าวิชา ไม่แก้บัญชีเดิม
- 2026-10-20: **ภาคเรียน/เลื่อนชั้น/สถานะนักศึกษา** — ภาคปัจจุบันตั้งในหน้าแอดมิน (settings `term_*`, app_config อ่าน DB) · โปรไฟล์ใช้ผลล่าสุดข้ามภาค (`ProfileService::LATEST`) · ฟอร์มรายวิชาเลือกภาค/ปี, หน้าครูกรองภาค · `users.student_status` + `/admin/students` (เลื่อนชั้นทั้งกลุ่ม, จบ/ออกกลางคันทั้งกลุ่มหรือรายคน; ข้อมูลไม่ลบ) · ครูนำออกจากวิชาหลายคน/ทั้งกลุ่ม
- 2026-10-20: **Gemini รุ่นล่าสุดค้าง (3.8/3.7) → สลับรุ่นอัตโนมัติ** — `alive()` ทดสอบรุ่นก่อนใช้, จำรุ่นค้าง 15 นาที (`settings.gemini_slow_models`), timeout 85 วิ (ต่ำกว่า Cloudflare 100 วิ)
