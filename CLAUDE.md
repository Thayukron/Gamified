# CLAUDE.md — บริบทโปรเจกต์สำหรับต่อแชท

> ไฟล์นี้เก็บบริบทการสนทนา/การตัดสินใจ เพื่อให้เปิดแชทใหม่แล้วทำงานต่อได้ทันที
> ประวัติการแก้ไขละเอียดอยู่ใน [log.md](log.md) · ข้อกำหนดระบบอยู่ใน [requiments.md](requiments.md)

## ข้อตกลงการทำงานกับผู้ใช้ (ต้องทำทุกครั้ง)
1. สื่อสารเป็นภาษาไทย
2. ทำทีละเฟส → **รันให้ผู้ใช้ดูก่อน** → รอผู้ใช้ตอบรับ แล้วค่อยทำเฟสต่อไป
3. ทุกครั้งที่แก้ไข: บันทึกใน `log.md` + อัปเดตสถานะใน `CLAUDE.md` นี้
4. ทุกครั้งที่แก้ไข: `git commit` และ `git push` ไปที่ `origin main` (https://github.com/Thayukron/Gamified)

## การตัดสินใจสำคัญของผู้ใช้
- ชื่อระบบ **ARCANA PROFILE** (ไม่ใช้ Questify) · ธีม **ผสม**: dark fantasy เป็นหลัก + เพิ่มเควสต์ฉากวิทยาลัย/สายอาชีพ · **ยังไม่เพิ่ม Computational Thinking**
- ระดับการ์ดต้องไม่ทำให้ผู้เรียนรู้สึกแย่: ไม่มีระดับต่ำ, ให้รางวัลจากการมีส่วนร่วม ไม่ใช่บุคลิก
- ดีไซน์อ้างอิงจาก Gemini: [docs/design-gemini.md](docs/design-gemini.md)

## ภาพรวมระบบ
Gamified Universal Student Profiling System — ผู้เรียนเล่นเกม Visual Novel เพื่อวัด VARK / RIASEC / Mindset (Rule-based 100%, ไม่เสียค่า API ระหว่างเล่น)
ครูดูแดชบอร์ด + ใช้ AI (BYOK) แปลผลตามบริบทรายวิชา · แอดมินจัดการข้อมูลส่วนกลาง

## สภาพแวดล้อม Dev (เครื่องผู้ใช้ Windows 11)
| ส่วน | รายละเอียด |
|---|---|
| DB | MariaDB 10.4 จาก XAMPP แต่ใช้ **data dir แยก** `C:\Users\USER\.gamified-mysql\data` **port 3310** (MySQL ของ XAMPP เดิมเสีย: ไฟล์ multi-master.info ใน `C:\xampp\mysql\data` corrupt — ไม่ได้แก้ไฟล์ของ XAMPP) · port 3307 ถูก Docker ใช้อยู่ |
| API | PHP 8.2 built-in server `php -S 127.0.0.1:8000 -t public public/index.php` (ใน `backend/`) |
| Frontend | Nuxt 3.21 dev **port 3100** (port 3000 มีแอปอื่นของผู้ใช้ใช้อยู่) |
| สคริปต์ | `start-dev.ps1` เปิดทั้ง 3 ตัว · `php backend/database/migrate.php` = ล้างและสร้าง DB ใหม่ + seed |
| ทดสอบ E2E | ใช้ playwright-core + Edge (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`) ติดตั้งใน scratchpad ไม่ใส่ในโปรเจกต์ |

บัญชีทดสอบ: `admin/admin1234`, `teacher1/teacher1234`, `student001..010/student1234`

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
- [ ] **เฟส 6 Management & Reports** — CRUD รายวิชา/แผนก, นำเข้า CSV/Excel, ส่งออก PDF/Excel (ว.PA)
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
- 2026-09-27: ใส่ภาพฮีโร่ 6 แบบแล้ว (สีหน้าเดียว ภาพเต็มตัว `public/characters/hero-*.webp`, `fullBody`) → **รอผู้ใช้ตรวจ** · ถัดไป: เควสต์วิทยาลัย/อาชีพ หรือเฟส 3
