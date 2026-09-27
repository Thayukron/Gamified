<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
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
            'SELECT c.*, d.name AS department_name, u.full_name AS teacher_name
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
        $course = self::course($req, (int) $req->params['id']);
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
