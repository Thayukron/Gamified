<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Services\LessonPlanService;
use App\Services\LessonSheetService;

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
            'unit_no' => (int) $plan['unit_no'],
            'session_no' => (int) $plan['session_no'],
            'unit_name' => $plan['unit_name'],
            'title' => $plan['title'],
            'hours_theory' => (float) $plan['hours_theory'],
            'hours_practice' => (float) $plan['hours_practice'],
            'content' => $content,
            'completeness' => LessonPlanService::completeness($content),
            'ai_model' => $plan['ai_model'],
            'updated_at' => $plan['updated_at'],
        ];
    }

    /** Validated header fields (unit, session, names, hours). */
    private static function header(Request $req): array
    {
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
        $plans = array_map(function ($p) {
            $o = self::out($p);
            unset($o['content']);
            return $o;
        }, $stmt->fetchAll());
        return [
            'course' => $course,
            'plans' => $plans,
            'topics' => json_decode($course['topics'] ?? '[]', true) ?: [],
            'level_higher' => LessonPlanService::isHigher($course),
        ];
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
        $h = self::header($req);
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
        $h = self::header($req) + ['unit_no' => $plan['unit_no']];
        $dash = TeacherController::classData($course);
        if ($req->input('source') === 'ai') {
            return LessonPlanService::aiDraft((int) $req->user['id'], $course, $dash, $h);
        }
        return ['content' => LessonPlanService::prefill($course, $dash, $h), 'model' => null];
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
        return [
            'course' => $course,
            'book' => $row ? \App\Services\CoursePlanService::normalize(json_decode($row['content'], true)) : \App\Services\CoursePlanService::defaults($course, $plans, (string) ($course['teacher_name'] ?? '')),
            'saved' => (bool) $row,
            'updated_at' => $row['updated_at'] ?? null,
            'institution' => self::institution(),
            'plans' => self::withSheets(array_map([self::class, 'out'], $plans)),
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
        return ['book' => $content, 'saved' => true];
    }

    /** POST /teacher/courses/{id}/book/draft — { content } → AI draft of the analysis parts (not saved). */
    public static function bookDraft(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $content = \App\Services\CoursePlanService::normalize($req->input('content', []));
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
            'plans' => self::withSheets(array_map([self::class, 'out'], $stmt->fetchAll())),
            'learners' => LessonPlanService::learners($course, TeacherController::classData($course)),
            'level_higher' => LessonPlanService::isHigher($course),
        ];
    }
}
