<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Services\PasswordService;

/**
 * Teachers create their own courses (current term) and pick the students who study with them.
 * Student accounts and game results are shared across the college; a teacher only links them to a course.
 * PDPA: student search returns code/name/group only — profiles stay visible only inside the teacher's own courses.
 */
class TeacherCourseController
{
    private const TYPES = ['theory', 'practice', 'mixed'];

    /** GET /teacher/meta — departments, class groups with counts, current term, own department. */
    public static function meta(Request $req): array
    {
        $db = Database::get();
        $stmt = $db->prepare('SELECT department_id FROM users WHERE id = ?');
        $stmt->execute([$req->user['id']]);
        return [
            'term' => ['semester' => (int) app_config('semester'), 'academic_year' => (int) app_config('academic_year')],
            'my_department_id' => ($id = $stmt->fetchColumn()) ? (int) $id : null,
            'departments' => $db->query('SELECT id, code, name FROM departments ORDER BY code')->fetchAll(),
            'class_groups' => $db->query(
                "SELECT u.class_group AS name, COUNT(*) AS students, MIN(d.name) AS department_name
                   FROM users u LEFT JOIN departments d ON d.id = u.department_id
                  WHERE u.role = 'student' AND u.is_active = 1 AND u.class_group IS NOT NULL AND u.class_group <> ''
               GROUP BY u.class_group ORDER BY u.class_group"
            )->fetchAll(),
        ];
    }

    /** Validated course fields from the request body. */
    private static function fields(Request $req): array
    {
        $f = [
            'code' => mb_substr(trim((string) $req->input('code', '')), 0, 30),
            'name' => mb_substr(trim((string) $req->input('name', '')), 0, 200),
            'section' => mb_substr(trim((string) $req->input('section', '')), 0, 20) ?: '1',
            'department_id' => $req->input('department_id') ? (int) $req->input('department_id') : null,
            'course_type' => (string) $req->input('course_type', 'mixed'),
            'level' => mb_substr(trim((string) $req->input('level', '')), 0, 30) ?: null,
            'topics' => array_slice(array_values(array_filter(array_map(fn ($t) => mb_substr(trim((string) $t), 0, 100), (array) $req->input('topics', [])))), 0, 30),
        ];
        if ($f['code'] === '' || $f['name'] === '') {
            throw new HttpException(422, 'กรุณากรอกรหัสวิชาและชื่อวิชา');
        }
        if (!in_array($f['course_type'], self::TYPES, true)) {
            throw new HttpException(422, 'ประเภทวิชาไม่ถูกต้อง');
        }
        return $f;
    }

    /** 409 when another course already uses code+section in the term. */
    private static function assertUnique(array $f, int $sem, int $year, ?int $exceptId = null): void
    {
        $stmt = Database::get()->prepare(
            'SELECT c.id, u.full_name FROM courses c LEFT JOIN users u ON u.id = c.teacher_id
              WHERE c.code = ? AND c.section = ? AND c.semester = ? AND c.academic_year = ? AND c.id <> ?'
        );
        $stmt->execute([$f['code'], $f['section'], $sem, $year, $exceptId ?? 0]);
        if ($other = $stmt->fetch()) {
            throw new HttpException(409, "รายวิชา {$f['code']} กลุ่ม {$f['section']} มีอยู่แล้วในภาคเรียนนี้ (ครูผู้สอน: " . ($other['full_name'] ?? '-') . ') — ใช้ชื่อกลุ่มอื่น หรือติดต่อผู้ดูแลระบบ');
        }
    }

    /** POST /teacher/courses — create a course taught by the current user, optionally enrolling whole class groups. */
    public static function create(Request $req): array
    {
        $f = self::fields($req);
        [$sem, $year] = [(int) app_config('semester'), (int) app_config('academic_year')];
        self::assertUnique($f, $sem, $year);
        $db = Database::get();
        $db->prepare(
            'INSERT INTO courses (code, name, section, semester, academic_year, department_id, teacher_id, course_type, level, topics)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$f['code'], $f['name'], $f['section'], $sem, $year, $f['department_id'], $req->user['id'], $f['course_type'], $f['level'],
            json_encode($f['topics'], JSON_UNESCAPED_UNICODE)]);
        $id = (int) $db->lastInsertId();
        $added = self::enrollGroups($id, (array) $req->input('class_groups', []));
        return ['id' => $id, 'added' => $added];
    }

    /** PUT /teacher/courses/{id} — edit basic course info (code/name/section/department/type/level/topics). */
    public static function update(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $f = self::fields($req);
        self::assertUnique($f, (int) $course['semester'], (int) $course['academic_year'], (int) $course['id']);
        Database::get()->prepare(
            'UPDATE courses SET code = ?, name = ?, section = ?, department_id = ?, course_type = ?, level = ?, topics = ? WHERE id = ?'
        )->execute([$f['code'], $f['name'], $f['section'], $f['department_id'], $f['course_type'], $f['level'],
            json_encode($f['topics'], JSON_UNESCAPED_UNICODE), $course['id']]);
        return ['ok' => true];
    }

    /** DELETE /teacher/courses/{id} — remove own course (students' game results are kept). */
    public static function delete(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        Database::get()->prepare('DELETE FROM courses WHERE id = ?')->execute([$course['id']]);
        return ['ok' => true];
    }

    /** GET /teacher/courses/{id}/students — current roster (basic info only). */
    public static function roster(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $stmt = Database::get()->prepare(
            "SELECT u.id, u.student_code, u.full_name, u.class_group, d.name AS department_name, u.must_change_password,
                    EXISTS(SELECT 1 FROM password_reset_requests r WHERE r.user_id = u.id AND r.status = 'pending') AS reset_requested
               FROM enrollments e JOIN users u ON u.id = e.student_id LEFT JOIN departments d ON d.id = u.department_id
              WHERE e.course_id = ? ORDER BY reset_requested DESC, u.class_group, u.student_code"
        );
        $stmt->execute([$course['id']]);
        $students = array_map(fn ($s) => ['reset_requested' => (bool) $s['reset_requested'], 'must_change_password' => (bool) $s['must_change_password']] + $s, $stmt->fetchAll());
        return ['course' => $course, 'students' => $students];
    }

    /** POST /teacher/courses/{id}/students/{sid}/reset-password — for a student enrolled in the teacher's course. */
    public static function resetPassword(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $stmt = Database::get()->prepare(
            "SELECT u.id FROM enrollments e JOIN users u ON u.id = e.student_id WHERE e.course_id = ? AND u.id = ? AND u.role = 'student'"
        );
        $stmt->execute([$course['id'], (int) $req->params['sid']]);
        $sid = $stmt->fetchColumn() ?: throw new HttpException(404, 'ไม่พบผู้เรียนนี้ในรายวิชา');
        $code = PasswordService::resetToDefault((int) $sid, (int) $req->user['id']);
        return ['ok' => true, 'message' => "รีเซ็ตแล้ว — รหัสผ่านชั่วคราว = {$code} (ผู้เรียนต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบ)"];
    }

    /** GET /teacher/students?q=&group=&course= — find students to add (max 200); marks those already in the course. */
    public static function search(Request $req): array
    {
        $q = trim((string) $req->query('q', ''));
        $group = trim((string) $req->query('group', ''));
        if ($q === '' && $group === '') {
            return ['students' => []];
        }
        $sql = "SELECT u.id, u.student_code, u.full_name, u.class_group, d.name AS department_name,
                       EXISTS(SELECT 1 FROM enrollments e WHERE e.student_id = u.id AND e.course_id = ?) AS enrolled
                  FROM users u LEFT JOIN departments d ON d.id = u.department_id
                 WHERE u.role = 'student' AND u.is_active = 1";
        $args = [(int) $req->query('course', 0)];
        if ($q !== '') {
            $sql .= ' AND (u.student_code LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)';
            array_push($args, "%$q%", "%$q%", "%$q%");
        }
        if ($group !== '') {
            $sql .= ' AND u.class_group = ?';
            $args[] = $group;
        }
        $stmt = Database::get()->prepare($sql . ' ORDER BY u.class_group, u.student_code LIMIT 200');
        $stmt->execute($args);
        return ['students' => array_map(fn ($s) => ['enrolled' => (bool) $s['enrolled']] + $s, $stmt->fetchAll())];
    }

    /**
     * POST /teacher/courses/{id}/students — { class_groups?: [], student_ids?: [], codes?: "6901001 6901002 ..." }
     * Adds students (duplicates ignored). Returns how many were added and which pasted codes were not found.
     */
    public static function add(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $db = Database::get();
        $added = self::enrollGroups((int) $course['id'], (array) $req->input('class_groups', []));

        $ids = array_values(array_unique(array_filter(array_map('intval', (array) $req->input('student_ids', [])))));
        $notFound = [];
        $codes = array_values(array_unique(array_filter(preg_split('/[\s,;]+/u', (string) $req->input('codes', '')))));
        if ($codes) {
            $in = implode(',', array_fill(0, count($codes), '?'));
            $stmt = $db->prepare("SELECT id, username, student_code FROM users WHERE role = 'student' AND (student_code IN ($in) OR username IN ($in))");
            $stmt->execute([...$codes, ...$codes]);
            $found = [];
            foreach ($stmt->fetchAll() as $u) {
                $ids[] = (int) $u['id'];
                $found[$u['username']] = $found[(string) $u['student_code']] = true;
            }
            $notFound = array_values(array_filter($codes, fn ($c) => !isset($found[$c])));
        }
        if ($ids) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $db->prepare("INSERT IGNORE INTO enrollments (course_id, student_id) SELECT ?, id FROM users WHERE role = 'student' AND id IN ($in)");
            $stmt->execute([$course['id'], ...$ids]);
            $added += $stmt->rowCount();
        }
        return ['added' => $added, 'not_found' => $notFound];
    }

    /** DELETE /teacher/courses/{id}/students/{sid} — remove one student from the course (their results are kept). */
    public static function remove(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        Database::get()->prepare('DELETE FROM enrollments WHERE course_id = ? AND student_id = ?')->execute([$course['id'], (int) $req->params['sid']]);
        return ['ok' => true];
    }

    private static function enrollGroups(int $courseId, array $groups): int
    {
        $groups = array_values(array_filter(array_map(fn ($g) => trim((string) $g), $groups)));
        if (!$groups) {
            return 0;
        }
        $in = implode(',', array_fill(0, count($groups), '?'));
        $stmt = Database::get()->prepare(
            "INSERT IGNORE INTO enrollments (course_id, student_id)
             SELECT ?, id FROM users WHERE role = 'student' AND is_active = 1 AND class_group IN ($in)"
        );
        $stmt->execute([$courseId, ...$groups]);
        return $stmt->rowCount();
    }
}
