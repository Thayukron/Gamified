<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Guide\GroupingService;
use App\Guide\TeachingGuide;
use App\Services\AiGuideService;
use App\Services\ProfileService;

/**
 * Teacher dashboard. PDPA: a teacher only sees courses they teach (admins see all).
 */
class TeacherController
{
    private static function term(): array
    {
        return [(int) app_config('semester'), (int) app_config('academic_year')];
    }

    /** Course row the current user may access, or 404/403. */
    private static function course(Request $req, int $id): array
    {
        $stmt = Database::get()->prepare(
            'SELECT c.*, d.name AS department_name, d.code AS department_code, u.full_name AS teacher_name
               FROM courses c
          LEFT JOIN departments d ON d.id = c.department_id
          LEFT JOIN users u ON u.id = c.teacher_id
              WHERE c.id = ?'
        );
        $stmt->execute([$id]);
        $course = $stmt->fetch() ?: throw new HttpException(404, 'ไม่พบรายวิชา');
        if ($req->user['role'] !== 'admin' && (int) $course['teacher_id'] !== (int) $req->user['id']) {
            throw new HttpException(403, 'คุณไม่ได้เป็นผู้สอนรายวิชานี้');
        }
        return $course;
    }

    /** GET /teacher/courses — the teacher's courses with participation counts. */
    public static function courses(Request $req): array
    {
        [$sem, $year] = self::term();
        $where = $req->user['role'] === 'admin' ? '1=1' : 'c.teacher_id = ?';
        $stmt = Database::get()->prepare(
            "SELECT c.id, c.code, c.name, c.section, c.semester, c.academic_year, d.name AS department_name,
                    COUNT(DISTINCT e.student_id) AS enrolled,
                    COUNT(DISTINCT r.user_id) AS profiled
               FROM courses c
          LEFT JOIN departments d ON d.id = c.department_id
          LEFT JOIN enrollments e ON e.course_id = c.id
          LEFT JOIN assessment_results r ON r.user_id = e.student_id AND r.semester = ? AND r.academic_year = ?
              WHERE $where
           GROUP BY c.id
           ORDER BY c.academic_year DESC, c.semester DESC, c.code, c.section"
        );
        $stmt->execute($req->user['role'] === 'admin' ? [$sem, $year] : [$sem, $year, $req->user['id']]);
        return ['courses' => $stmt->fetchAll(), 'term' => ['semester' => $sem, 'academic_year' => $year]];
    }

    /**
     * GET /teacher/courses/{id}/dashboard — roster with each student's Core Profile,
     * play status, and class-level distributions.
     */
    public static function dashboard(Request $req): array
    {
        return self::classData(self::course($req, (int) $req->params['id']));
    }

    /** GET /teacher/courses/{id}/guide — rule-based teaching guide for the class. */
    public static function guide(Request $req): array
    {
        $course = self::course($req, (int) $req->params['id']);
        $dash = self::classData($course);
        return ['course' => $course, 'term' => $dash['term'], 'guide' => TeachingGuide::build($course, $dash)];
    }

    /** GET /teacher/courses/{id}/ai?type=course|unit&topic= — cached AI result (never calls the AI). */
    public static function aiCached(Request $req): array
    {
        $course = self::course($req, (int) $req->params['id']);
        $dash = self::classData($course);
        $type = (string) $req->query('type', 'course');
        $topic = $type === 'unit' ? (string) $req->query('topic', '') : null;
        return ['result' => AiGuideService::cached($course, $dash, $type, $topic), 'ai' => AiGuideService::status((int) $req->user['id'])];
    }

    /** GET /teacher/courses/{id}/ai/all — every cached AI result for the course (no AI call). */
    public static function aiAll(Request $req): array
    {
        $course = self::course($req, (int) $req->params['id']);
        $dash = self::classData($course);
        $topics = json_decode($course['topics'] ?? '[]', true) ?: [];
        $units = [];
        foreach ($topics as $t) {
            if ($r = AiGuideService::cached($course, $dash, 'unit', $t)) {
                $units[$t] = $r;
            }
        }
        return ['course' => AiGuideService::cached($course, $dash, 'course', null), 'units' => (object) $units, 'ai' => AiGuideService::status((int) $req->user['id'])];
    }

    /** POST /teacher/courses/{id}/ai — { type, topic? } generate with Gemini (explicit request only). */
    public static function aiGenerate(Request $req): array
    {
        $course = self::course($req, (int) $req->params['id']);
        $type = (string) $req->input('type', 'course');
        $topic = $type === 'unit' ? (string) $req->input('topic', '') : null;
        return ['result' => AiGuideService::generate((int) $req->user['id'], $course, self::classData($course), $type, $topic)];
    }

    /**
     * GET /teacher/courses/{id}/report — everything the ว.PA report needs in one call
     * (never calls the AI; uses cached AI results only).
     */
    public static function report(Request $req): array
    {
        $course = self::course($req, (int) $req->params['id']);
        $dash = self::classData($course);
        $settings = Database::get()->query("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'institution_%'")->fetchAll(\PDO::FETCH_KEY_PAIR);

        $topics = json_decode($course['topics'] ?? '[]', true) ?: [];
        $aiUnits = [];
        foreach ($topics as $t) {
            if ($r = AiGuideService::cached($course, $dash, 'unit', $t)) {
                $aiUnits[$t] = $r;
            }
        }
        $stmt = Database::get()->prepare('SELECT * FROM course_groupings WHERE course_id = ?');
        $stmt->execute([$course['id']]);
        $row = $stmt->fetch();
        $grouping = $row ? GroupingService::fromIds($dash['students'], json_decode($row['member_ids'], true) ?: [], $row['mode'])
            + ['mode' => $row['mode'], 'saved_at' => $row['saved_at']] : null;

        return [
            'institution' => ['name' => $settings['institution_name'] ?? '', 'affiliation' => $settings['institution_affiliation'] ?? ''],
            'generated_at' => date('c'),
            'guide' => TeachingGuide::build($course, $dash),
            'ai_course' => AiGuideService::cached($course, $dash, 'course', null),
            'ai_units' => (object) $aiUnits,
            'grouping' => $grouping,
        ] + $dash;
    }

    /** POST /teacher/courses/{id}/groups/preview — { size, mode, seed?, include_unprofiled? } (not saved) */
    public static function groupsPreview(Request $req): array
    {
        $course = self::course($req, (int) $req->params['id']);
        $dash = self::classData($course);
        $mode = $req->input('mode') === 'similar' ? 'similar' : 'mixed';
        return GroupingService::build(
            $dash['students'],
            (int) $req->input('size', 4),
            $mode,
            (int) ($req->input('seed') ?: random_int(1, 999999)),
            (bool) $req->input('include_unprofiled', true)
        ) + ['saved_at' => null];
    }

    /** GET /teacher/courses/{id}/groups — the saved grouping, re-described with current profiles. */
    public static function groupsSaved(Request $req): array
    {
        $course = self::course($req, (int) $req->params['id']);
        $stmt = Database::get()->prepare('SELECT * FROM course_groupings WHERE course_id = ?');
        $stmt->execute([$course['id']]);
        $row = $stmt->fetch();
        if (!$row) {
            return ['saved' => null];
        }
        $res = GroupingService::fromIds(self::classData($course)['students'], json_decode($row['member_ids'], true) ?: [], $row['mode']);
        return ['saved' => $res + [
            'settings' => ['size' => (int) $row['group_size'], 'mode' => $row['mode']],
            'saved_at' => $row['saved_at'],
        ]];
    }

    /** PUT /teacher/courses/{id}/groups — { mode, size, groups: [[student_id,...],...] } */
    public static function groupsSave(Request $req): array
    {
        $course = self::course($req, (int) $req->params['id']);
        $students = self::classData($course)['students'];
        $mode = $req->input('mode') === 'similar' ? 'similar' : 'mixed';
        $res = GroupingService::fromIds($students, (array) $req->input('groups', []), $mode);
        if ($req->input('dry_run')) {
            // after a manual move: recompute roles/notes without saving
            return ['saved' => $res + ['settings' => ['size' => (int) $req->input('size', 4), 'mode' => $mode], 'saved_at' => null]];
        }
        if (!$res['groups']) {
            throw new HttpException(422, 'ยังไม่มีกลุ่มให้บันทึก');
        }
        $ids = array_map(fn ($g) => array_map(fn ($m) => $m['id'], $g['members']), $res['groups']);
        Database::get()->prepare(
            'INSERT INTO course_groupings (course_id, mode, group_size, member_ids, saved_by) VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE mode = VALUES(mode), group_size = VALUES(group_size), member_ids = VALUES(member_ids),
                                     saved_by = VALUES(saved_by), saved_at = NOW()'
        )->execute([$course['id'], $mode, max(2, min(8, (int) $req->input('size', 4))), json_encode($ids), $req->user['id']]);
        return self::groupsSaved($req);
    }

    /** PUT /teacher/courses/{id}/context — course type, level, topics, note. */
    public static function saveContext(Request $req): array
    {
        $course = self::course($req, (int) $req->params['id']);
        $type = $req->input('course_type');
        if (!in_array($type, ['theory', 'practice', 'mixed'], true)) {
            throw new HttpException(422, 'ประเภทวิชาไม่ถูกต้อง');
        }
        $topics = array_values(array_filter(array_map(fn ($t) => mb_substr(trim((string) $t), 0, 100), (array) $req->input('topics', []))));
        Database::get()->prepare('UPDATE courses SET course_type = ?, level = ?, topics = ?, context_note = ? WHERE id = ?')->execute([
            $type,
            mb_substr(trim((string) $req->input('level', '')), 0, 30) ?: null,
            json_encode(array_slice($topics, 0, 30), JSON_UNESCAPED_UNICODE),
            mb_substr(trim((string) $req->input('context_note', '')), 0, 1000) ?: null,
            $course['id'],
        ]);
        return ['ok' => true];
    }

    /** Roster, Core Profiles and distributions for one course. */
    private static function classData(array $course): array
    {
        [$sem, $year] = self::term();
        $db = Database::get();

        $stmt = $db->prepare(
            "SELECT u.id, u.student_code, u.full_name,
                    (SELECT COUNT(*) FROM game_sessions gs WHERE gs.user_id = u.id AND gs.status = 'in_progress') AS in_progress
               FROM enrollments e JOIN users u ON u.id = e.student_id
              WHERE e.course_id = ? AND u.is_active = 1
           ORDER BY u.student_code, u.full_name"
        );
        $stmt->execute([$course['id']]);
        $roster = $stmt->fetchAll();

        $profiles = ProfileService::coreProfiles(array_map(fn ($s) => (int) $s['id'], $roster), $sem, $year);

        $students = [];
        $dist = [
            'vark' => ['V' => 0, 'A' => 0, 'R' => 0, 'K' => 0, 'multi' => 0],
            'riasec' => array_fill_keys(['R', 'I', 'A', 'S', 'E', 'C'], 0),
            'mindset' => ['growth' => 0, 'mixed' => 0, 'fixed' => 0],
            'archetype' => [],
        ];
        $riasecSum = array_fill_keys(['R', 'I', 'A', 'S', 'E', 'C'], 0);
        $varkSum = array_fill_keys(['V', 'A', 'R', 'K'], 0);

        foreach ($roster as $s) {
            $p = $profiles[(int) $s['id']] ?? null;
            $status = $p ? ($p['quests_completed'] >= $p['quests_total'] ? 'complete' : 'partial') : ((int) $s['in_progress'] > 0 ? 'playing' : 'not_started');
            $students[] = [
                'id' => (int) $s['id'],
                'student_code' => $s['student_code'],
                'full_name' => $s['full_name'],
                'status' => $status,
                'profile' => $p,
            ];
            if (!$p) {
                continue;
            }
            $v = $p['dominant_vark'];
            $dist['vark'][$v && strlen($v) === 1 ? $v : 'multi']++;
            $dist['riasec'][$p['dominant_riasec'][0]]++;
            $dist['mindset'][$p['mindset_type']]++;
            $code = $p['archetype_code'];
            $dist['archetype'][$code] ??= ['code' => $code, 'name' => $p['archetype_name'], 'title' => $p['archetype_title'], 'color' => $p['color'], 'icon' => $p['icon'], 'count' => 0];
            $dist['archetype'][$code]['count']++;

            // Class averages use each student's share, so students who played more quests don't dominate.
            $rTotal = array_sum(array_map(fn ($k) => $p['riasec_' . strtolower($k)], array_keys($riasecSum))) ?: 1;
            foreach ($riasecSum as $k => $_) {
                $riasecSum[$k] += $p['riasec_' . strtolower($k)] / $rTotal;
            }
            $vTotal = array_sum(array_map(fn ($k) => $p['vark_' . strtolower($k)], array_keys($varkSum))) ?: 1;
            foreach ($varkSum as $k => $_) {
                $varkSum[$k] += $p['vark_' . strtolower($k)] / $vTotal;
            }
        }

        $profiled = count($profiles);
        $counts = array_count_values(array_column($students, 'status'));
        usort($dist['archetype'], fn ($a, $b) => $b['count'] <=> $a['count']);

        return [
            'course' => $course,
            'term' => ['semester' => $sem, 'academic_year' => $year],
            'summary' => [
                'enrolled' => count($students),
                'profiled' => $profiled,
                'complete' => $counts['complete'] ?? 0,
                'partial' => $counts['partial'] ?? 0,
                'playing' => $counts['playing'] ?? 0,
                'not_started' => $counts['not_started'] ?? 0,
                'quests_total' => ProfileService::totalUniversal(),
            ],
            'distribution' => $dist,
            'average' => [
                'riasec' => array_map(fn ($v) => $profiled ? round($v / $profiled * 100, 1) : 0, $riasecSum),
                'vark' => array_map(fn ($v) => $profiled ? round($v / $profiled * 100, 1) : 0, $varkSum),
            ],
            'students' => $students,
        ];
    }
}
