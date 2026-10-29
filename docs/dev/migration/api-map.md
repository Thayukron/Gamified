# API mapping: PHP → Nuxt 3

> สร้างด้วย `node tools/migration-inventory.mjs` จาก source ปัจจุบัน ไม่เชื่อมฐานข้อมูล

จำนวน 86 endpoints, 19 domain tables และ schema_migrations อีก 1 ตาราง

Path ทุกตัวอยู่ใต้ `/api`; public = ไม่ต้อง login, * = ทุก role ที่ login แล้ว

รายการ field ใน JSON เป็นการอ้างอิงโดยตรงใน handler เท่านั้น ต้องตรวจ helper/service และ response ทุก branch ก่อนย้ายแต่ละ endpoint ไม่ถือเป็น OpenAPI หรือผลทดสอบ compatibility

| Method | Path | Roles | PHP handler | Nuxt target | Async |
|---|---|---|---|---|---|
| GET | `/health` | public | [inline](../../backend/routes.php#L7) | `server/api/health.get.ts` | — |
| POST | `/auth/login` | public | [AuthController::login](../../backend/src/Controllers/AuthController.php#L11) | `server/api/auth/login.post.ts` | — |
| POST | `/auth/logout` | * | [AuthController::logout](../../backend/src/Controllers/AuthController.php#L34) | `server/api/auth/logout.post.ts` | — |
| GET | `/auth/me` | * | [AuthController::me](../../backend/src/Controllers/AuthController.php#L40) | `server/api/auth/me.get.ts` | — |
| GET | `/student/quests` | student | [StudentGameController::quests](../../backend/src/Controllers/StudentGameController.php#L40) | `server/api/student/quests.get.ts` | — |
| GET | `/student/quests/{id}` | student | [StudentGameController::show](../../backend/src/Controllers/StudentGameController.php#L69) | `server/api/student/quests/[id].get.ts` | — |
| PUT | `/student/quests/{id}/progress` | student | [StudentGameController::progress](../../backend/src/Controllers/StudentGameController.php#L94) | `server/api/student/quests/[id]/progress.put.ts` | — |
| POST | `/student/quests/{id}/complete` | student | [StudentGameController::complete](../../backend/src/Controllers/StudentGameController.php#L119) | `server/api/student/quests/[id]/complete.post.ts` | — |
| GET | `/student/results` | student | [StudentGameController::results](../../backend/src/Controllers/StudentGameController.php#L247) | `server/api/student/results.get.ts` | — |
| GET | `/student/results/{id}` | student | [StudentGameController::result](../../backend/src/Controllers/StudentGameController.php#L255) | `server/api/student/results/[id].get.ts` | — |
| GET | `/student/profile` | student | [StudentGameController::profile](../../backend/src/Controllers/StudentGameController.php#L267) | `server/api/student/profile.get.ts` | — |
| GET | `/student/player` | student | [StudentGameController::player](../../backend/src/Controllers/StudentGameController.php#L188) | `server/api/student/player.get.ts` | — |
| PUT | `/student/player/avatar` | student | [StudentGameController::saveAvatar](../../backend/src/Controllers/StudentGameController.php#L195) | `server/api/student/player/avatar.put.ts` | — |
| GET | `/teacher/courses` | teacher, admin | [TeacherController::courses](../../backend/src/Controllers/TeacherController.php#L41) | `server/api/teacher/courses.get.ts` | — |
| POST | `/teacher/units/suggest` | teacher, admin | [TeacherCourseController::suggestUnits](../../backend/src/Controllers/TeacherCourseController.php#L22) | `server/api/teacher/units/suggest.post.ts` | 202 + poll |
| GET | `/teacher/meta` | teacher, admin | [TeacherCourseController::meta](../../backend/src/Controllers/TeacherCourseController.php#L32) | `server/api/teacher/meta.get.ts` | — |
| POST | `/teacher/courses` | teacher, admin | [TeacherCourseController::create](../../backend/src/Controllers/TeacherCourseController.php#L97) | `server/api/teacher/courses.post.ts` | — |
| PUT | `/teacher/courses/{id}` | teacher, admin | [TeacherCourseController::update](../../backend/src/Controllers/TeacherCourseController.php#L115) | `server/api/teacher/courses/[id].put.ts` | — |
| DELETE | `/teacher/courses/{id}` | teacher, admin | [TeacherCourseController::delete](../../backend/src/Controllers/TeacherCourseController.php#L130) | `server/api/teacher/courses/[id].delete.ts` | — |
| GET | `/teacher/courses/{id}/students` | teacher, admin | [TeacherCourseController::roster](../../backend/src/Controllers/TeacherCourseController.php#L138) | `server/api/teacher/courses/[id]/students.get.ts` | — |
| POST | `/teacher/courses/{id}/students` | teacher, admin | [TeacherCourseController::add](../../backend/src/Controllers/TeacherCourseController.php#L195) | `server/api/teacher/courses/[id]/students.post.ts` | — |
| POST | `/teacher/courses/{id}/students/remove` | teacher, admin | [TeacherCourseController::removeMany](../../backend/src/Controllers/TeacherCourseController.php#L242) | `server/api/teacher/courses/[id]/students/remove.post.ts` | — |
| POST | `/teacher/courses/{id}/import/preview` | teacher, admin | [TeacherCourseController::importPreview](../../backend/src/Controllers/TeacherCourseController.php#L225) | `server/api/teacher/courses/[id]/import/preview.post.ts` | — |
| POST | `/teacher/courses/{id}/import/commit` | teacher, admin | [TeacherCourseController::importCommit](../../backend/src/Controllers/TeacherCourseController.php#L232) | `server/api/teacher/courses/[id]/import/commit.post.ts` | — |
| DELETE | `/teacher/courses/{id}/students/{sid}` | teacher, admin | [TeacherCourseController::remove](../../backend/src/Controllers/TeacherCourseController.php#L264) | `server/api/teacher/courses/[id]/students/[sid].delete.ts` | — |
| GET | `/teacher/students` | teacher, admin | [TeacherCourseController::search](../../backend/src/Controllers/TeacherCourseController.php#L166) | `server/api/teacher/students.get.ts` | — |
| POST | `/teacher/courses/{id}/students/{sid}/reset-password` | teacher, admin | [TeacherCourseController::resetPassword](../../backend/src/Controllers/TeacherCourseController.php#L153) | `server/api/teacher/courses/[id]/students/[sid]/reset-password.post.ts` | — |
| GET | `/me/profile` | * | [AccountController::profile](../../backend/src/Controllers/AccountController.php#L14) | `server/api/me/profile.get.ts` | — |
| PUT | `/me/profile` | * | [AccountController::updateProfile](../../backend/src/Controllers/AccountController.php#L28) | `server/api/me/profile.put.ts` | — |
| PUT | `/me/password` | * | [AccountController::changePassword](../../backend/src/Controllers/AccountController.php#L80) | `server/api/me/password.put.ts` | — |
| PUT | `/me/username` | teacher, admin | [AccountController::changeUsername](../../backend/src/Controllers/AccountController.php#L46) | `server/api/me/username.put.ts` | — |
| POST | `/auth/forgot` | public | [AccountController::forgot](../../backend/src/Controllers/AccountController.php#L105) | `server/api/auth/forgot.post.ts` | — |
| GET | `/teacher/courses/{id}/plans` | teacher, admin | [LessonPlanController::index](../../backend/src/Controllers/LessonPlanController.php#L72) | `server/api/teacher/courses/[id]/plans.get.ts` | — |
| GET | `/teacher/courses/{id}/plans/full` | teacher, admin | [LessonPlanController::full](../../backend/src/Controllers/LessonPlanController.php#L351) | `server/api/teacher/courses/[id]/plans/full.get.ts` | — |
| POST | `/teacher/courses/{id}/plans` | teacher, admin | [LessonPlanController::create](../../backend/src/Controllers/LessonPlanController.php#L92) | `server/api/teacher/courses/[id]/plans.post.ts` | — |
| GET | `/teacher/courses/{id}/book` | teacher, admin | [LessonPlanController::book](../../backend/src/Controllers/LessonPlanController.php#L298) | `server/api/teacher/courses/[id]/book.get.ts` | — |
| PUT | `/teacher/courses/{id}/book` | teacher, admin | [LessonPlanController::saveBook](../../backend/src/Controllers/LessonPlanController.php#L326) | `server/api/teacher/courses/[id]/book.put.ts` | — |
| POST | `/teacher/courses/{id}/book/draft` | teacher, admin | [LessonPlanController::bookDraft](../../backend/src/Controllers/LessonPlanController.php#L343) | `server/api/teacher/courses/[id]/book/draft.post.ts` | 202 + poll |
| GET | `/teacher/plans/{pid}/sheets` | teacher, admin | [LessonPlanController::sheets](../../backend/src/Controllers/LessonPlanController.php#L227) | `server/api/teacher/plans/[pid]/sheets.get.ts` | — |
| POST | `/teacher/plans/{pid}/sheets` | teacher, admin | [LessonPlanController::createSheet](../../backend/src/Controllers/LessonPlanController.php#L234) | `server/api/teacher/plans/[pid]/sheets.post.ts` | — |
| GET | `/teacher/sheets/{sid}` | teacher, admin | [LessonPlanController::showSheet](../../backend/src/Controllers/LessonPlanController.php#L251) | `server/api/teacher/sheets/[sid].get.ts` | — |
| PUT | `/teacher/sheets/{sid}` | teacher, admin | [LessonPlanController::updateSheet](../../backend/src/Controllers/LessonPlanController.php#L258) | `server/api/teacher/sheets/[sid].put.ts` | — |
| DELETE | `/teacher/sheets/{sid}` | teacher, admin | [LessonPlanController::deleteSheet](../../backend/src/Controllers/LessonPlanController.php#L272) | `server/api/teacher/sheets/[sid].delete.ts` | — |
| POST | `/teacher/sheets/{sid}/draft` | teacher, admin | [LessonPlanController::draftSheet](../../backend/src/Controllers/LessonPlanController.php#L280) | `server/api/teacher/sheets/[sid]/draft.post.ts` | 202 + poll |
| GET | `/teacher/plans/{pid}` | teacher, admin | [LessonPlanController::show](../../backend/src/Controllers/LessonPlanController.php#L109) | `server/api/teacher/plans/[pid].get.ts` | — |
| PUT | `/teacher/plans/{pid}` | teacher, admin | [LessonPlanController::update](../../backend/src/Controllers/LessonPlanController.php#L121) | `server/api/teacher/plans/[pid].put.ts` | — |
| DELETE | `/teacher/plans/{pid}` | teacher, admin | [LessonPlanController::delete](../../backend/src/Controllers/LessonPlanController.php#L139) | `server/api/teacher/plans/[pid].delete.ts` | — |
| POST | `/teacher/plans/{pid}/draft` | teacher, admin | [LessonPlanController::draft](../../backend/src/Controllers/LessonPlanController.php#L147) | `server/api/teacher/plans/[pid]/draft.post.ts` | 202 + poll |
| POST | `/teacher/plans/{pid}/standard` | teacher, admin | [LessonPlanController::standard](../../backend/src/Controllers/LessonPlanController.php#L162) | `server/api/teacher/plans/[pid]/standard.post.ts` | 202 + poll |
| GET | `/teacher/courses/{id}/dashboard` | teacher, admin | [TeacherController::dashboard](../../backend/src/Controllers/TeacherController.php#L67) | `server/api/teacher/courses/[id]/dashboard.get.ts` | — |
| GET | `/teacher/courses/{id}/guide` | teacher, admin | [TeacherController::guide](../../backend/src/Controllers/TeacherController.php#L73) | `server/api/teacher/courses/[id]/guide.get.ts` | — |
| PUT | `/teacher/courses/{id}/context` | teacher, admin | [TeacherController::saveContext](../../backend/src/Controllers/TeacherController.php#L203) | `server/api/teacher/courses/[id]/context.put.ts` | — |
| GET | `/teacher/courses/{id}/ai` | teacher, admin | [TeacherController::aiCached](../../backend/src/Controllers/TeacherController.php#L81) | `server/api/teacher/courses/[id]/ai.get.ts` | — |
| GET | `/teacher/courses/{id}/ai/all` | teacher, admin | [TeacherController::aiAll](../../backend/src/Controllers/TeacherController.php#L91) | `server/api/teacher/courses/[id]/ai/all.get.ts` | — |
| POST | `/teacher/courses/{id}/ai` | teacher, admin | [TeacherController::aiGenerate](../../backend/src/Controllers/TeacherController.php#L106) | `server/api/teacher/courses/[id]/ai.post.ts` | 202 + poll |
| GET | `/me/ai` | teacher, admin | [AiController::status](../../backend/src/Controllers/AiController.php#L15) | `server/api/me/ai.get.ts` | — |
| PUT | `/me/ai` | teacher, admin | [AiController::saveKey](../../backend/src/Controllers/AiController.php#L21) | `server/api/me/ai.put.ts` | — |
| POST | `/me/ai/test` | teacher, admin | [AiController::test](../../backend/src/Controllers/AiController.php#L28) | `server/api/me/ai/test.post.ts` | — |
| PUT | `/me/ai/model` | teacher, admin | [AiController::setModel](../../backend/src/Controllers/AiController.php#L34) | `server/api/me/ai/model.put.ts` | — |
| DELETE | `/me/ai` | teacher, admin | [AiController::removeKey](../../backend/src/Controllers/AiController.php#L41) | `server/api/me/ai.delete.ts` | — |
| GET | `/admin/ai` | admin | [AiController::adminStatus](../../backend/src/Controllers/AiController.php#L55) | `server/api/admin/ai.get.ts` | — |
| PUT | `/admin/ai` | admin | [AiController::adminSave](../../backend/src/Controllers/AiController.php#L76) | `server/api/admin/ai.put.ts` | — |
| PUT | `/admin/ai/teachers/{id}` | admin | [AiController::adminAllow](../../backend/src/Controllers/AiController.php#L104) | `server/api/admin/ai/teachers/[id].put.ts` | — |
| POST | `/teacher/courses/{id}/groups/preview` | teacher, admin | [TeacherController::groupsPreview](../../backend/src/Controllers/TeacherController.php#L148) | `server/api/teacher/courses/[id]/groups/preview.post.ts` | — |
| GET | `/teacher/courses/{id}/groups` | teacher, admin | [TeacherController::groupsSaved](../../backend/src/Controllers/TeacherController.php#L163) | `server/api/teacher/courses/[id]/groups.get.ts` | — |
| PUT | `/teacher/courses/{id}/groups` | teacher, admin | [TeacherController::groupsSave](../../backend/src/Controllers/TeacherController.php#L180) | `server/api/teacher/courses/[id]/groups.put.ts` | — |
| GET | `/teacher/courses/{id}/report` | teacher, admin | [TeacherController::report](../../backend/src/Controllers/TeacherController.php#L118) | `server/api/teacher/courses/[id]/report.get.ts` | — |
| GET | `/admin/term` | admin | [SettingsController::term](../../backend/src/Controllers/SettingsController.php#L21) | `server/api/admin/term.get.ts` | — |
| PUT | `/admin/term` | admin | [SettingsController::saveTerm](../../backend/src/Controllers/SettingsController.php#L27) | `server/api/admin/term.put.ts` | — |
| GET | `/admin/class-groups` | admin | [StudentAdminController::groups](../../backend/src/Controllers/StudentAdminController.php#L19) | `server/api/admin/class-groups.get.ts` | — |
| GET | `/admin/class-groups/members` | admin | [StudentAdminController::members](../../backend/src/Controllers/StudentAdminController.php#L42) | `server/api/admin/class-groups/members.get.ts` | — |
| POST | `/admin/class-groups/rename` | admin | [StudentAdminController::rename](../../backend/src/Controllers/StudentAdminController.php#L53) | `server/api/admin/class-groups/rename.post.ts` | — |
| POST | `/admin/students/status` | admin | [StudentAdminController::setStatus](../../backend/src/Controllers/StudentAdminController.php#L71) | `server/api/admin/students/status.post.ts` | — |
| GET | `/admin/institution` | admin | [SettingsController::institution](../../backend/src/Controllers/SettingsController.php#L14) | `server/api/admin/institution.get.ts` | — |
| PUT | `/admin/institution` | admin | [SettingsController::saveInstitution](../../backend/src/Controllers/SettingsController.php#L45) | `server/api/admin/institution.put.ts` | — |
| POST | `/admin/import/preview` | admin | [AdminController::importPreview](../../backend/src/Controllers/AdminController.php#L24) | `server/api/admin/import/preview.post.ts` | — |
| POST | `/admin/import/commit` | admin | [AdminController::importCommit](../../backend/src/Controllers/AdminController.php#L30) | `server/api/admin/import/commit.post.ts` | — |
| GET | `/admin/overview` | admin | [AdminController::overview](../../backend/src/Controllers/AdminController.php#L36) | `server/api/admin/overview.get.ts` | — |
| GET | `/admin/users` | admin | [AdminController::users](../../backend/src/Controllers/AdminController.php#L66) | `server/api/admin/users.get.ts` | — |
| POST | `/admin/users` | admin | [AdminController::createUser](../../backend/src/Controllers/AdminController.php#L156) | `server/api/admin/users.post.ts` | — |
| POST | `/admin/users/{id}/reset-password` | admin | [AdminController::resetPassword](../../backend/src/Controllers/AdminController.php#L93) | `server/api/admin/users/[id]/reset-password.post.ts` | — |
| PUT | `/admin/users/{id}` | admin | [AdminController::updateUser](../../backend/src/Controllers/AdminController.php#L114) | `server/api/admin/users/[id].put.ts` | — |
| GET | `/admin/reset-requests` | admin | [AdminController::resetRequests](../../backend/src/Controllers/AdminController.php#L193) | `server/api/admin/reset-requests.get.ts` | — |
| POST | `/admin/reset-requests/{id}/dismiss` | admin | [AdminController::dismissRequest](../../backend/src/Controllers/AdminController.php#L203) | `server/api/admin/reset-requests/[id]/dismiss.post.ts` | — |
| DELETE | `/admin/courses/{id}` | admin | [AdminController::deleteCourse](../../backend/src/Controllers/AdminController.php#L211) | `server/api/admin/courses/[id].delete.ts` | — |
| GET | `/jobs/{id}` | teacher, admin | [BackgroundJob::show](../../backend/src/Core/BackgroundJob.php#L35) | `server/api/jobs/[id].get.ts` | — |

## Tables

- `departments`
- `users`
- `courses`
- `enrollments`
- `scenarios`
- `archetype_master`
- `assessment_results`
- `game_sessions`
- `ai_insights_cache`
- `settings`
- `auth_tokens`
- `player_progress`
- `user_ai_settings`
- `course_groupings`
- `password_reset_requests`
- `lesson_plans`
- `course_plans`
- `lesson_sheets`
- `background_jobs`
