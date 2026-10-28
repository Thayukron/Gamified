# เฟส 3 — เกม ผลประเมิน และรางวัลบน Nitro

## API ที่ย้ายแล้ว

ย้ายเพิ่ม 9 endpoints รวมกับเฟส 2 เป็น 18 จาก 86 endpoints:

| Method | Path | หน้าที่ |
|---|---|---|
| GET | `/api/student/quests` | เควสต์ที่เปิดเล่น สถานะ และภาคปัจจุบัน |
| GET | `/api/student/quests/{id}` | เนื้อเรื่องที่ตัด scoring tags และ save state |
| PUT | `/api/student/quests/{id}/progress` | บันทึกฉากและ log ระหว่างเล่น |
| POST | `/api/student/quests/{id}/complete` | Replay log, คะแนน, archetype และรางวัล |
| GET | `/api/student/results` | ประวัติผลประเมินของตนเอง |
| GET | `/api/student/results/{id}` | ผลรายครั้ง พร้อม replay ไอเทม |
| GET | `/api/student/profile` | Core Profile จากผลล่าสุดของแต่ละเควสต์ข้ามภาค |
| GET | `/api/student/player` | XP เหรียญ เลเวล และ avatar |
| PUT | `/api/student/player/avatar` | บันทึก avatar ตามกฎเดิม |

ทุก route จำกัด role student; ผลคนอื่นตอบ 404 ไม่เปิดเผยข้อมูล

## Business logic

- `server/services/scenarioEngine.ts`: forPlayer, evaluate, profile, recency และ validate ตาม PHP เดิม รวมเพดาน 500 ฉาก, mini-game success/fail, tags ที่อนุญาต และลำดับตัดสินคะแนนเสมอ
- `server/services/progression.ts`: สูตร XP/เหรียญ/เลเวล และ rarity เดิม
- `server/services/profiles.ts`: รวมคะแนน/recency, LATEST query และ helper Core Profiles สำหรับ dashboard ในเฟสถัดไป
- `server/services/studentGame.ts`: SQL และ response ของนักศึกษา; formatter ตัด choices_log/scenario_content จากผลที่ส่งออก
- `shared/types/game.ts`: ชนิดข้อมูลเนื้อเรื่องฝั่ง server รางวัล และ avatar

### Transaction และการเล่นซ้ำ

progress และ complete ล็อกแถว users ของผู้เล่นด้วย `FOR UPDATE` ใน transaction เดียวกับการตรวจผลและเขียนข้อมูล แถว users มีอยู่ตั้งแต่ก่อนผู้เล่นรับรางวัลครั้งแรก จึงไม่ต้องพึ่งการล็อก player_progress ที่อาจยังไม่มีแถว

- ส่ง complete พร้อมกันใน Nitro ได้ผล result_id เดียวและรางวัลครั้งเดียว; คำขอที่ตามมาคืน `{result_id,already:true}`
- ผลประเมิน, session completed และยอด XP/เหรียญ commit พร้อมกัน หากผิดพลาด rollback ทั้งหมด
- progress ที่มาหลัง complete ตอบ 409 ไม่เปิด session กลับเป็น in_progress
- ตรวจผลซ้ำและอ่าน XP ก่อนรับรางวัลภายใน lock จึงคำนวณ level_before/after ของการเล่นหลายเควสต์พร้อมกันได้ตามลำดับ
- รักษา unique result ต่อ user+scenario+semester+academic_year และใช้ผลล่าสุดของแต่ละเควสต์ใน Core Profile
- progress คงพฤติกรรมเดิม: ตรวจฉากมีอยู่และ log เป็น array; replay ตรวจเส้นทางและคะแนนจริงตอน complete

## Frontend และวิธีทดลอง

`useApi()` ใช้ `shared/utils/apiRouting.ts` ส่ง auth/account ที่ย้ายแล้วและ `/student/*` ไป `/api` ของ Nuxt โดยตรง ส่วน staff/AI/jobs ที่ยังไม่ย้ายใช้ `config.public.apiBase` เดิม จึงยังไม่ใช่การสลับ backend ทุกส่วนในครั้งเดียว

รัน Node โดยตรงตาม [คู่มือเฟส 2](phase2-foundation.md) เปิด `http://localhost:3100/login`

บัญชีสำหรับตรวจรับเกมในฐานใหม่:

- Username: `student-demo`
- Password: `student1234`
- เป็นบัญชีตัวอย่างที่เพิ่มในเฟสนี้เพื่อทดลองเล่น ไม่ใช่บัญชีผู้เรียนจริง และไม่มีการเติมผลประเมินหรือรางวัลให้ล่วงหน้า

ฐาน MariaDB local port 3306 และ schema เดิม ไม่แก้ Docker และไม่มี schema migration เพิ่มในเฟสนี้ สร้าง backup ก่อน live tests ที่ `backups/gamified-before-phase3-game-20261029.sql`

## หลักฐานตรวจสอบ

- Production build และ server TypeScript ผ่าน
- Local test suites รวม auth เดิมกับเกม/routing ผ่าน 19 tests
- Engine parity ใช้ PHP 8.2.35 รันไฟล์ engine/progression เดิมโดยไม่แก้ source: 158 fixtures (150 log จากทั้ง 3 เควสต์, 7 log ผิด และ 1 edge case เรื่อง casts/empty values) ให้ evaluation, profile, rewards, rarity, level, player content และ validation ตรงกัน
- Live MariaDB + HTTP ผ่าน 78 requests และ 21 จุดเทียบ response แบบ exact กับ PHP API เดิมที่รันด้วย PHP 8.2
- ตรวจ complete พร้อมกัน 8 requests, ผลลัพธ์คนอื่น, mini-game fail path, avatar defaults, save/resume, progress หลัง complete, save/complete race และ Core Profile ข้ามภาค/เล่นซ้ำ
- HTTP smoke เดิม 15 checks ผ่าน
- ใช้บัญชีทดสอบชั่วคราวและ cleanup ตาม id/prefix หลังเสร็จ; บัญชี admin และ student-demo สำหรับ preview ไม่ถูกใช้รับรางวัลใน automated tests
- Test files และ PHP runtime สำหรับ oracle อยู่ใต้ `frontend/tests/` ซึ่งถูก ignore ตามผู้ใช้ ไม่รวมใน commit และไม่ใช่ dependency ของแอป Nuxt

ยังไม่ตรวจรับฟีเจอร์ครู/แอดมิน/AI บน Nitro หรือโหลด 500–1000 คน เป็นงานเฟสต่อไป
