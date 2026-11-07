<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Services\LessonPlanService;
use App\Services\LessonSheetService;
use App\Services\TeachingSchedule;

/** Unit lesson plans (OVEC 2567 form). Teachers only reach plans of courses they teach. */
class LessonPlanController
{
    /** Plan row + its course, enforcing course ownership. */
    private static function plan(Request $req): array
    {
        $stmt = Database::get()->prepare('SELECT * FROM lesson_plans WHERE id = ?');
        $stmt->execute([(int) $req->params['pid']]);
        $plan = $stmt->fetch() ?: throw new HttpException(404, 'ไม่พบแผนการจัดการเรียนรู้');
        $course = TeacherController::course($req, (int) $plan['course_id']);
        return [$plan, $course];
    }

    private static function out(array $plan): array
    {
        $content = LessonPlanService::normalize(json_decode($plan['content'], true));
        return [
            'id' => (int) $plan['id'],
            'course_id' => (int) $plan['course_id'],
            'kind' => $plan['kind'],
            'unit_no' => (int) $plan['unit_no'],
            'session_no' => (int) $plan['session_no'],
            'sessions' => $plan['sessions'],
            'unit_name' => $plan['unit_name'],
            'title' => $plan['title'],
            'hours_theory' => (float) $plan['hours_theory'],
            'hours_practice' => (float) $plan['hours_practice'],
            'content' => $content,
            'completeness' => LessonPlanService::completeness($content, $plan['kind']),
            'ai_model' => $plan['ai_model'],
            'updated_at' => $plan['updated_at'],
        ];
    }

    /**
     * Validated header fields (unit, session, names, hours). A plan made from the weekly schedule keeps its unit,
     * sessions and hours from there; only its names can be edited (an exam plan's are fixed too).
     */
    private static function header(Request $req, ?array $plan = null): array
    {
        if ($plan && $plan['sessions'] !== null) {
            $exam = $plan['kind'] !== 'unit';
            $name = mb_substr(trim((string) $req->input('unit_name', '')), 0, 200);
            return [
                'kind' => $plan['kind'], 'sessions' => $plan['sessions'], 'unit_no' => (int) $plan['unit_no'], 'session_no' => (int) $plan['session_no'],
                'unit_name' => $exam || $name === '' ? $plan['unit_name'] : $name,
                'title' => $exam ? $plan['title'] : mb_substr(trim((string) $req->input('title', '')), 0, 255),
                'hours_theory' => (float) $plan['hours_theory'], 'hours_practice' => (float) $plan['hours_practice'],
            ];
        }
        $h = [
            'unit_no' => (int) $req->input('unit_no', 0),
            'session_no' => max(1, (int) $req->input('session_no', 1)),
            'unit_name' => mb_substr(trim((string) $req->input('unit_name', '')), 0, 200),
            'title' => mb_substr(trim((string) $req->input('title', '')), 0, 255),
            'hours_theory' => max(0, min(99, round((float) $req->input('hours_theory', 0), 1))),
            'hours_practice' => max(0, min(99, round((float) $req->input('hours_practice', 0), 1))),
        ];
        if ($h['unit_no'] < 1 || $h['unit_no'] > 99) {
            throw new HttpException(422, 'หน่วยที่ต้องเป็นตัวเลข 1–99');
        }
        if ($h['unit_name'] === '') {
            throw new HttpException(422, 'กรุณากรอกชื่อหน่วยการเรียนรู้');
        }
        return $h;
    }

    private static function assertFree(int $courseId, array $h, int $exceptId = 0): void
    {
        $stmt = Database::get()->prepare('SELECT COUNT(*) FROM lesson_plans WHERE course_id = ? AND unit_no = ? AND session_no = ? AND id <> ?');
        $stmt->execute([$courseId, $h['unit_no'], $h['session_no'], $exceptId]);
        if ($stmt->fetchColumn()) {
            throw new HttpException(409, "มีแผนหน่วยที่ {$h['unit_no']} สอนครั้งที่ {$h['session_no']} อยู่แล้ว");
        }
    }

    /** GET /teacher/courses/{id}/plans — plans of the course + units suggested from its topics. */
    public static function index(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $stmt = Database::get()->prepare('SELECT * FROM lesson_plans WHERE course_id = ? ORDER BY unit_no, session_no');
        $stmt->execute([$course['id']]);
        $schedule = TeachingSchedule::compute(self::savedBook($course), LessonPlanService::isHigher($course));
        // list view: no content, sheets as small summaries
        $plans = array_map(function ($p) {
            unset($p['content']);
            $p['sheets'] = array_map(fn ($s) => array_diff_key($s, ['content' => 1]), $p['sheets']);
            return $p;
        }, self::withSheets(array_map([self::class, 'out'], $stmt->fetchAll())));
        return [
            'course' => $course,
            'plans' => $plans,
            'topics' => json_decode($course['topics'] ?? '[]', true) ?: [],
            'schedule' => $schedule,
            'level_higher' => LessonPlanService::isHigher($course),
        ];
    }

    /** The saved course-level book (empty when there is none), with the hours from the course record. */
    private static function savedBook(array $course): array
    {
        $stmt = Database::get()->prepare('SELECT content FROM course_plans WHERE course_id = ?');
        $stmt->execute([$course['id']]);
        $book = \App\Services\CoursePlanService::normalize(json_decode((string) $stmt->fetchColumn(), true));
        $book = \App\Services\CoursePlanService::withTopics($book, json_decode($course['topics'] ?? '[]', true) ?: []);
        $book['curriculum']['theory_hours'] = (string) ($course['theory_hours'] ?? '');
        $book['curriculum']['practice_hours'] = (string) ($course['practice_hours'] ?? '');
        return $book;
    }

    /**
     * POST /teacher/courses/{id}/plans/from-schedule — { kind: unit|midterm|final, unit_no? }: one plan for the unit or
     * exam with its sessions and hours from the weekly schedule. Asking again opens the plan that already exists;
     * a unit's single plan made per session is taken over as is (content and sheets stay).
     */
    public static function createFromSchedule(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $book = self::savedBook($course);
        $schedule = TeachingSchedule::compute($book, LessonPlanService::isHigher($course))
            ?? throw new HttpException(409, 'กรุณาบันทึกตารางกำหนดการสอนรายสัปดาห์ก่อน');
        $kind = (string) $req->input('kind', 'unit');
        if (!in_array($kind, ['unit', 'midterm', 'final'], true)) {
            throw new HttpException(422, 'ชนิดแผนไม่ถูกต้อง');
        }
        $no = $kind === 'unit' ? (int) $req->input('unit_no', 0) : 0;
        $slot = $kind === 'unit' ? ($schedule['units'][(string) $no] ?? null) : $schedule[$kind];
        if (!$slot || !$slot['weeks']) {
            throw new HttpException(422, 'หน่วยนี้ยังไม่ได้กำหนดจำนวนสัปดาห์ในตารางกำหนดการสอน');
        }
        $db = Database::get();
        $found = $db->prepare('SELECT id FROM lesson_plans WHERE course_id = ? AND kind = ? AND unit_no = ? AND sessions IS NOT NULL');
        $found->execute([$course['id'], $kind, $no]);
        if ($id = $found->fetchColumn()) {
            return ['id' => (int) $id];
        }
        if ($kind === 'unit') {
            $old = $db->prepare('SELECT id FROM lesson_plans WHERE course_id = ? AND unit_no = ? AND sessions IS NULL');
            $old->execute([$course['id'], $no]);
            $old = $old->fetchAll(\PDO::FETCH_COLUMN);
            if (count($old) > 1) {
                throw new HttpException(409, 'หน่วยนี้มีแผนแยกรายครั้งหลายฉบับ ระบบรวมให้ไม่ได้ กรุณาเก็บไว้ฉบับเดียวก่อน');
            }
            if ($old) {
                $db->prepare('UPDATE lesson_plans SET session_no = ?, sessions = ?, hours_theory = ?, hours_practice = ? WHERE id = ?')
                    ->execute([$slot['first'], $slot['sessions'], $slot['hours_theory'], $slot['hours_practice'], $old[0]]);
                return ['id' => (int) $old[0]];
            }
            $topics = json_decode($course['topics'] ?? '[]', true) ?: [];
            $row = array_values(array_filter($book['units'], fn ($u) => (string) $u['no'] === (string) $no))[0] ?? null;
            $name = mb_substr((string) ($topics[$no - 1] ?? $row['name'] ?? ''), 0, 200);
            if ($name === '') {
                throw new HttpException(422, 'ไม่พบชื่อหน่วยการเรียนรู้');
            }
        } else {
            $name = TeachingSchedule::EXAM_NAME[$kind];
        }
        $h = ['kind' => $kind, 'unit_no' => $no, 'session_no' => (int) $slot['first'], 'sessions' => $slot['sessions'], 'unit_name' => $name, 'title' => $name,
            'hours_theory' => $slot['hours_theory'], 'hours_practice' => $slot['hours_practice']];
        self::assertFree((int) $course['id'], $h);
        $content = $kind === 'unit' ? LessonPlanService::prefill($course, TeacherController::classData($course), $h) : LessonPlanService::examPrefill($course, $kind);
        $db->prepare(
            'INSERT INTO lesson_plans (course_id, kind, unit_no, session_no, sessions, unit_name, title, hours_theory, hours_practice, content, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$course['id'], $kind, $no, $h['session_no'], $h['sessions'], $name, $name, $h['hours_theory'], $h['hours_practice'],
            json_encode($content, JSON_UNESCAPED_UNICODE), $req->user['id']]);
        return ['id' => (int) $db->lastInsertId()];
    }

    /** Plans in the order of the book: exam plans go among the scheduled units by session; earlier per-session plans stay by unit. */
    private static function bookOrder(array $plans): array
    {
        $exams = array_filter($plans, fn ($p) => $p['kind'] !== 'unit');
        usort($exams, fn ($a, $b) => $a['session_no'] <=> $b['session_no']);
        $out = array_values(array_filter($plans, fn ($p) => $p['kind'] === 'unit'));
        foreach ($exams as $e) {
            $at = count($out);
            foreach ($out as $i => $p) {
                if ($p['sessions'] !== null && $p['kind'] === 'unit' && $p['session_no'] > $e['session_no']) {
                    $at = $i;
                    break;
                }
            }
            array_splice($out, $at, 0, [$e]);
        }
        return $out;
    }

    /** After the schedule changes, plans made from it follow: sessions and hours (a unit taken off the schedule shows none). */
    private static function syncSchedule(array $course, array $content): void
    {
        $schedule = TeachingSchedule::compute($content, LessonPlanService::isHigher($course));
        if (!$schedule) {
            return;
        }
        $db = Database::get();
        $stmt = $db->prepare('SELECT id, kind, unit_no FROM lesson_plans WHERE course_id = ? AND sessions IS NOT NULL');
        $stmt->execute([$course['id']]);
        $hours = $db->prepare('UPDATE lesson_plans SET sessions = ?, hours_theory = ?, hours_practice = ? WHERE id = ?');
        $first = $db->prepare('UPDATE IGNORE lesson_plans SET session_no = ? WHERE id = ?');
        foreach ($stmt->fetchAll() as $p) {
            $slot = $p['kind'] === 'unit' ? ($schedule['units'][(string) $p['unit_no']] ?? null) : $schedule[$p['kind']];
            $hours->execute([$slot['sessions'] ?? '', $slot['hours_theory'] ?? 0, $slot['hours_practice'] ?? 0, $p['id']]);
            if (!empty($slot['first'])) {
                $first->execute([$slot['first'], $p['id']]);
            }
        }
    }

    /** POST /teacher/courses/{id}/plans — header fields + prefill: "guide" | "none". */
    public static function create(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $h = self::header($req);
        self::assertFree((int) $course['id'], $h);
        $content = $req->input('prefill') === 'guide'
            ? LessonPlanService::prefill($course, TeacherController::classData($course), $h)
            : LessonPlanService::EMPTY;
        $db = Database::get();
        $db->prepare(
            'INSERT INTO lesson_plans (course_id, unit_no, session_no, unit_name, title, hours_theory, hours_practice, content, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$course['id'], $h['unit_no'], $h['session_no'], $h['unit_name'], $h['title'], $h['hours_theory'], $h['hours_practice'],
            json_encode($content, JSON_UNESCAPED_UNICODE), $req->user['id']]);
        return ['id' => (int) $db->lastInsertId()];
    }

    /** GET /teacher/plans/{pid} — plan + course + anonymous learner analysis (for section 6 and the appendix). */
    public static function show(Request $req): array
    {
        [$plan, $course] = self::plan($req);
        return [
            'plan' => self::withSheets([self::out($plan)])[0],
            'course' => $course,
            'learners' => LessonPlanService::learners($course, TeacherController::classData($course)),
            'level_higher' => LessonPlanService::isHigher($course),
        ];
    }

    /** PUT /teacher/plans/{pid} — header fields + content (+ ai_model when the content came from an AI draft). */
    public static function update(Request $req): array
    {
        [$plan, $course] = self::plan($req);
        $h = self::header($req, $plan);
        self::assertFree((int) $course['id'], $h, (int) $plan['id']);
        $content = LessonPlanService::normalize($req->input('content', []));
        $aiModel = $req->input('ai_model') ? mb_substr((string) $req->input('ai_model'), 0, 80) : null;
        Database::get()->prepare(
            'UPDATE lesson_plans SET unit_no = ?, session_no = ?, unit_name = ?, title = ?, hours_theory = ?, hours_practice = ?, content = ?,
                    ai_model = COALESCE(?, ai_model), ai_at = IF(? IS NULL, ai_at, NOW()) WHERE id = ?'
        )->execute([$h['unit_no'], $h['session_no'], $h['unit_name'], $h['title'], $h['hours_theory'], $h['hours_practice'],
            json_encode($content, JSON_UNESCAPED_UNICODE), $aiModel, $aiModel, $plan['id']]);
        $stmt = Database::get()->prepare('SELECT * FROM lesson_plans WHERE id = ?');
        $stmt->execute([$plan['id']]);
        return ['plan' => self::out($stmt->fetch())];
    }

    /** DELETE /teacher/plans/{pid} */
    public static function delete(Request $req): array
    {
        [$plan] = self::plan($req);
        Database::get()->prepare('DELETE FROM lesson_plans WHERE id = ?')->execute([$plan['id']]);
        return ['ok' => true];
    }

    /** POST /teacher/plans/{pid}/draft — { source: "guide" | "ai", header… } → draft content (not saved). */
    public static function draft(Request $req): array
    {
        [$plan, $course] = self::plan($req);
        $h = self::header($req, $plan) + ['unit_no' => $plan['unit_no'], 'kind' => $plan['kind'], 'sessions' => $plan['sessions']];
        $exam = $plan['kind'] !== 'unit';
        if ($req->input('source') === 'ai') {
            return $exam ? LessonPlanService::aiExamDraft((int) $req->user['id'], $course, $h) : LessonPlanService::aiDraft((int) $req->user['id'], $course, TeacherController::classData($course), $h);
        }
        return ['content' => $exam ? LessonPlanService::examPrefill($course, $plan['kind']) : LessonPlanService::prefill($course, TeacherController::classData($course), $h), 'model' => null];
    }

    /**
     * POST /teacher/plans/{pid}/standard — { unit_no, unit_name, title, ..., competency? }
     * AI + Google Search: the TPQI occupational standard for section 2 (not saved — the teacher reviews it first).
     */
    public static function standard(Request $req): array
    {
        [$plan, $course] = self::plan($req);
        if ($plan['kind'] !== 'unit') {
            throw new HttpException(422, 'แผนสัปดาห์ทดสอบไม่ต้องอ้างอิงมาตรฐานอาชีพ');
        }
        $h = self::header($req, $plan);
        $competency = (array) $req->input('competency', []);
        return LessonPlanService::aiStandard((int) $req->user['id'], $course, $h + ['content' => json_encode(['competency' => $competency], JSON_UNESCAPED_UNICODE)]);
    }

    // ------------------------------------------------------------------ supporting sheets of a plan

    private static function outSheet(array $s): array
    {
        $c = LessonSheetService::normalize($s['type'], json_decode($s['content'], true));
        return [
            'id' => (int) $s['id'], 'plan_id' => (int) $s['plan_id'], 'type' => $s['type'], 'type_th' => LessonSheetService::TYPE_TH[$s['type']],
            'number' => $s['number'], 'title' => $s['title'], 'content' => $c,
            'completeness' => LessonSheetService::completeness($s['type'], $c), 'ai_model' => $s['ai_model'], 'updated_at' => $s['updated_at'],
        ];
    }

    /** Sheets of the given plans, grouped by plan id, in form order (ความรู้ → กิจกรรม → งาน → มอบหมายงาน → ประเมิน). */
    private static function sheetsOf(array $planIds): array
    {
        if (!$planIds) {
            return [];
        }
        $in = implode(',', array_fill(0, count($planIds), '?'));
        $stmt = Database::get()->prepare("SELECT * FROM lesson_sheets WHERE plan_id IN ($in)
            ORDER BY plan_id, FIELD(type, 'knowledge', 'activity', 'job', 'assignment', 'assessment'), number, id");
        $stmt->execute(array_map('intval', $planIds));
        $out = [];
        foreach ($stmt->fetchAll() as $s) {
            $out[(int) $s['plan_id']][] = self::outSheet($s);
        }
        return $out;
    }

    /** Add each plan's sheets (for the Word export). */
    private static function withSheets(array $plans): array
    {
        $by = self::sheetsOf(array_column($plans, 'id'));
        return array_map(fn ($p) => $p + ['sheets' => $by[$p['id']] ?? []], $plans);
    }

    /** Sheet + its plan + course, enforcing course ownership. */
    private static function sheet(Request $req): array
    {
        $stmt = Database::get()->prepare('SELECT * FROM lesson_sheets WHERE id = ?');
        $stmt->execute([(int) $req->params['sid']]);
        $sheet = $stmt->fetch() ?: throw new HttpException(404, 'ไม่พบเอกสาร');
        $stmt = Database::get()->prepare('SELECT * FROM lesson_plans WHERE id = ?');
        $stmt->execute([$sheet['plan_id']]);
        $plan = $stmt->fetch();
        return [$sheet, $plan, TeacherController::course($req, (int) $plan['course_id'])];
    }

    private static function sheetHeader(Request $req): array
    {
        return [
            'number' => mb_substr(trim((string) $req->input('number', '')), 0, 20),
            'title' => mb_substr(trim((string) $req->input('title', '')), 0, 255),
        ];
    }

    /** GET /teacher/plans/{pid}/sheets */
    public static function sheets(Request $req): array
    {
        [$plan] = self::plan($req);
        return ['sheets' => self::sheetsOf([(int) $plan['id']])[(int) $plan['id']] ?? []];
    }

    /** POST /teacher/plans/{pid}/sheets — { type } → new sheet pre-filled from the plan, numbered "<unit>.<n>". */
    public static function createSheet(Request $req): array
    {
        [$plan] = self::plan($req);
        if ($plan['kind'] !== 'unit') {
            throw new HttpException(422, 'แผนสัปดาห์ทดสอบไม่มีเอกสารประกอบ');
        }
        $type = (string) $req->input('type', '');
        LessonSheetService::assertType($type);
        $db = Database::get();
        $stmt = $db->prepare('SELECT COUNT(*) FROM lesson_sheets s JOIN lesson_plans p ON p.id = s.plan_id WHERE p.course_id = ? AND p.unit_no = ? AND s.type = ?');
        $stmt->execute([$plan['course_id'], $plan['unit_no'], $type]);
        $number = $plan['unit_no'] . '.' . ((int) $stmt->fetchColumn() + 1);
        $db->prepare('INSERT INTO lesson_sheets (plan_id, type, number, title, content) VALUES (?, ?, ?, ?, ?)')->execute([
            $plan['id'], $type, $number, $plan['title'] !== '' ? $plan['title'] : $plan['unit_name'],
            json_encode(LessonSheetService::fromPlan($type, $plan), JSON_UNESCAPED_UNICODE),
        ]);
        return ['id' => (int) $db->lastInsertId()];
    }

    /** GET /teacher/sheets/{sid} — sheet + plan + course (+ learners for the appendix when exported alone). */
    public static function showSheet(Request $req): array
    {
        [$sheet, $plan, $course] = self::sheet($req);
        return ['sheet' => self::outSheet($sheet), 'plan' => self::out($plan), 'course' => $course];
    }

    /** PUT /teacher/sheets/{sid} — { number, title, content, ai_model? } */
    public static function updateSheet(Request $req): array
    {
        [$sheet] = self::sheet($req);
        $h = self::sheetHeader($req);
        $content = LessonSheetService::normalize($sheet['type'], $req->input('content', []));
        $aiModel = $req->input('ai_model') ? mb_substr((string) $req->input('ai_model'), 0, 80) : null;
        Database::get()->prepare('UPDATE lesson_sheets SET number = ?, title = ?, content = ?, ai_model = COALESCE(?, ai_model) WHERE id = ?')
            ->execute([$h['number'], $h['title'], json_encode($content, JSON_UNESCAPED_UNICODE), $aiModel, $sheet['id']]);
        $stmt = Database::get()->prepare('SELECT * FROM lesson_sheets WHERE id = ?');
        $stmt->execute([$sheet['id']]);
        return ['sheet' => self::outSheet($stmt->fetch())];
    }

    /** DELETE /teacher/sheets/{sid} */
    public static function deleteSheet(Request $req): array
    {
        [$sheet] = self::sheet($req);
        Database::get()->prepare('DELETE FROM lesson_sheets WHERE id = ?')->execute([$sheet['id']]);
        return ['ok' => true];
    }

    /** POST /teacher/sheets/{sid}/draft — { source: "plan" | "ai", title } → draft content (not saved). */
    public static function draftSheet(Request $req): array
    {
        [$sheet, $plan, $course] = self::sheet($req);
        if ($req->input('source') === 'ai') {
            return LessonSheetService::aiDraft((int) $req->user['id'], $course, $plan, $sheet['type'], self::sheetHeader($req));
        }
        return ['content' => LessonSheetService::fromPlan($sheet['type'], $plan), 'model' => null];
    }

    // ------------------------------------------------------------------ course-level book

    private static function institution(): array
    {
        $s = Database::get()->query("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'institution_%'")->fetchAll(\PDO::FETCH_KEY_PAIR);
        return ['name' => $s['institution_name'] ?? '', 'affiliation' => $s['institution_affiliation'] ?? ''];
    }

    /** GET /teacher/courses/{id}/book — course-level parts (saved or defaults) + everything the Word book needs. */
    public static function book(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $db = Database::get();
        $stmt = $db->prepare('SELECT * FROM course_plans WHERE course_id = ?');
        $stmt->execute([$course['id']]);
        $row = $stmt->fetch();
        $plansStmt = $db->prepare('SELECT * FROM lesson_plans WHERE course_id = ? ORDER BY unit_no, session_no');
        $plansStmt->execute([$course['id']]);
        $plans = $plansStmt->fetchAll();
        $book = $row ? \App\Services\CoursePlanService::normalize(json_decode($row['content'], true)) : \App\Services\CoursePlanService::defaults($course, $plans, (string) ($course['teacher_name'] ?? ''));
        // units always follow the course's units (edited on the course form or by the AI)
        $book = \App\Services\CoursePlanService::withTopics($book, json_decode($course['topics'] ?? '[]', true) ?: []);
        // the course record is the single source of the curriculum content (entered on the course form)
        foreach (TeacherCourseController::CONTENT as $k => $_) {
            $book['curriculum'][$k] = (string) ($course[$k] ?? '');
        }
        return [
            'course' => $course,
            'book' => $book,
            'saved' => (bool) $row,
            'updated_at' => $row['updated_at'] ?? null,
            'institution' => self::institution(),
            'plans' => self::bookOrder(self::withSheets(array_map([self::class, 'out'], $plans))),
            'learners' => LessonPlanService::learners($course, TeacherController::classData($course)),
            'level_higher' => LessonPlanService::isHigher($course),
        ];
    }

    /** PUT /teacher/courses/{id}/book — { content, ai_model? } */
    public static function saveBook(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $content = \App\Services\CoursePlanService::normalize($req->input('content', []));
        $aiModel = $req->input('ai_model') ? mb_substr((string) $req->input('ai_model'), 0, 80) : null;
        Database::get()->prepare(
            'INSERT INTO course_plans (course_id, content, ai_model, updated_by) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE content = VALUES(content), ai_model = COALESCE(VALUES(ai_model), ai_model), updated_by = VALUES(updated_by)'
        )->execute([$course['id'], json_encode($content, JSON_UNESCAPED_UNICODE), $aiModel, $req->user['id']]);
        // curriculum content edited in the book goes back to the course record (single source)
        $cols = array_keys(TeacherCourseController::CONTENT);
        Database::get()->prepare('UPDATE courses SET ' . implode(', ', array_map(fn ($k) => "$k = ?", $cols)) . ' WHERE id = ?')
            ->execute([...array_map(fn ($k) => $content['curriculum'][$k] !== '' ? $content['curriculum'][$k] : null, $cols), $course['id']]);
        self::syncSchedule($course, $content);
        return ['book' => $content, 'saved' => true];
    }

    /** POST /teacher/courses/{id}/book/draft — { content } → AI draft of the analysis parts (not saved). */
    public static function bookDraft(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $content = \App\Services\CoursePlanService::normalize($req->input('content', []));
        if ($req->input('source') === 'guide') {
            return \App\Services\CoursePlanService::guideDraft($course, $content); // no AI, no quota
        }
        return \App\Services\CoursePlanService::aiDraft((int) $req->user['id'], $course, TeacherController::classData($course), $content);
    }

    /** GET /teacher/courses/{id}/plans/full — every plan with content, for exporting the whole set to Word. */
    public static function full(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $stmt = Database::get()->prepare('SELECT * FROM lesson_plans WHERE course_id = ? ORDER BY unit_no, session_no');
        $stmt->execute([$course['id']]);
        return [
            'course' => $course,
            'plans' => self::bookOrder(self::withSheets(array_map([self::class, 'out'], $stmt->fetchAll()))),
            'learners' => LessonPlanService::learners($course, TeacherController::classData($course)),
            'level_higher' => LessonPlanService::isHigher($course),
        ];
    }
}
