<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Services\ImportService;

/** Admin: bulk import and master-data overview/management. */
class AdminController
{
    private static function payload(Request $req): array
    {
        $body = $req->body();
        $payload = array_intersect_key($body, array_flip(ImportService::TYPES));
        if (!array_filter($payload)) {
            throw new HttpException(422, 'ไม่พบข้อมูลที่จะนำเข้า');
        }
        return $payload;
    }

    /** POST /admin/import/preview — validate only, nothing is written. */
    public static function importPreview(Request $req): array
    {
        return ['result' => ImportService::forClient((new ImportService())->validate(self::payload($req)))];
    }

    /** POST /admin/import/commit — apply every valid row (single transaction). */
    public static function importCommit(Request $req): array
    {
        return ['applied' => (new ImportService())->commit(self::payload($req))];
    }

    /** GET /admin/overview — counts + departments + courses for the current and past terms. */
    public static function overview(Request $req): array
    {
        $db = Database::get();
        $counts = $db->query("SELECT role, COUNT(*) n FROM users WHERE is_active = 1 GROUP BY role")->fetchAll(\PDO::FETCH_KEY_PAIR);
        return [
            'counts' => [
                'students' => (int) ($counts['student'] ?? 0),
                'teachers' => (int) ($counts['teacher'] ?? 0),
                'departments' => (int) $db->query('SELECT COUNT(*) FROM departments')->fetchColumn(),
                'courses' => (int) $db->query('SELECT COUNT(*) FROM courses')->fetchColumn(),
            ],
            'departments' => $db->query(
                "SELECT d.id, d.code, d.name,
                        (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role = 'student') AS students,
                        (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role = 'teacher') AS teachers
                   FROM departments d ORDER BY d.code"
            )->fetchAll(),
            'courses' => $db->query(
                "SELECT c.id, c.code, c.name, c.section, c.semester, c.academic_year, d.name AS department_name,
                        u.full_name AS teacher_name, u.username AS teacher_username,
                        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrolled
                   FROM courses c
              LEFT JOIN departments d ON d.id = c.department_id
              LEFT JOIN users u ON u.id = c.teacher_id
               ORDER BY c.academic_year DESC, c.semester DESC, c.code, c.section"
            )->fetchAll(),
        ];
    }

    /** GET /admin/users?q=&role= — search users (max 100). */
    public static function users(Request $req): array
    {
        $q = '%' . trim((string) $req->query('q', '')) . '%';
        $role = (string) $req->query('role', '');
        $sql = 'SELECT u.id, u.username, u.full_name, u.role, u.student_code, u.is_active, d.name AS department_name
                  FROM users u LEFT JOIN departments d ON d.id = u.department_id
                 WHERE (u.username LIKE ? OR u.full_name LIKE ?)';
        $args = [$q, $q];
        if (in_array($role, ['student', 'teacher', 'admin'], true)) {
            $sql .= ' AND u.role = ?';
            $args[] = $role;
        }
        $stmt = Database::get()->prepare($sql . ' ORDER BY u.role, u.username LIMIT 100');
        $stmt->execute($args);
        return ['users' => $stmt->fetchAll()];
    }

    /** POST /admin/users/{id}/reset-password — resets to username (student code) and signs the user out. */
    public static function resetPassword(Request $req): array
    {
        $id = (int) $req->params['id'];
        $stmt = Database::get()->prepare('SELECT username, role FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $u = $stmt->fetch() ?: throw new HttpException(404, 'ไม่พบผู้ใช้');
        if ($u['role'] === 'admin') {
            throw new HttpException(403, 'รีเซ็ตรหัสผ่านผู้ดูแลระบบจากหน้านี้ไม่ได้');
        }
        Database::get()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($u['username'], PASSWORD_DEFAULT), $id]);
        Database::get()->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$id]);
        return ['ok' => true, 'message' => "รีเซ็ตแล้ว รหัสผ่านใหม่ = {$u['username']}"];
    }

    /** DELETE /admin/courses/{id} — removes the course with its enrollments, groupings and AI cache (results stay with students). */
    public static function deleteCourse(Request $req): array
    {
        $stmt = Database::get()->prepare('DELETE FROM courses WHERE id = ?');
        $stmt->execute([(int) $req->params['id']]);
        if (!$stmt->rowCount()) {
            throw new HttpException(404, 'ไม่พบรายวิชา');
        }
        return ['ok' => true];
    }
}
