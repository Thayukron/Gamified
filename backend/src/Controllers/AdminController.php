<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Services\ImportService;
use App\Services\PasswordService;

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
        $sql = "SELECT u.id, u.username, u.full_name, u.role, u.student_code, u.class_group, u.is_active, u.department_id, u.must_change_password,
                       d.name AS department_name,
                       EXISTS(SELECT 1 FROM password_reset_requests r WHERE r.user_id = u.id AND r.status = 'pending') AS reset_requested
                  FROM users u LEFT JOIN departments d ON d.id = u.department_id
                 WHERE (u.username LIKE ? OR u.full_name LIKE ?)";
        $args = [$q, $q];
        if (in_array($role, ['student', 'teacher', 'admin'], true)) {
            $sql .= ' AND u.role = ?';
            $args[] = $role;
        }
        $stmt = Database::get()->prepare($sql . ' ORDER BY reset_requested DESC, u.role, u.username LIMIT 100');
        $stmt->execute($args);
        return ['users' => array_map(fn ($u) => [
            'is_active' => (bool) $u['is_active'],
            'must_change_password' => (bool) $u['must_change_password'],
            'reset_requested' => (bool) $u['reset_requested'],
        ] + $u, $stmt->fetchAll())];
    }

    /**
     * POST /admin/users/{id}/reset-password — temporary password = username (student code),
     * forced change at next login, signed out everywhere, reset requests closed.
     */
    public static function resetPassword(Request $req): array
    {
        $u = self::user((int) $req->params['id']);
        if ($u['role'] === 'admin') {
            throw new HttpException(403, 'รีเซ็ตรหัสผ่านผู้ดูแลระบบจากหน้านี้ไม่ได้ (ผู้ดูแลเปลี่ยนเองที่หน้าบัญชีของฉัน)');
        }
        $username = PasswordService::resetToDefault((int) $u['id'], (int) $req->user['id']);
        return ['ok' => true, 'message' => "รีเซ็ตแล้ว — รหัสผ่านชั่วคราว = {$username} (ผู้ใช้ต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบ)"];
    }

    private static function user(int $id): array
    {
        $stmt = Database::get()->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: throw new HttpException(404, 'ไม่พบผู้ใช้');
    }

    /**
     * PUT /admin/users/{id} — { username, full_name, department_id, class_group, is_active }.
     * For students the username is the student code, so both change together.
     */
    public static function updateUser(Request $req): array
    {
        $u = self::user((int) $req->params['id']);
        $db = Database::get();
        $username = trim((string) $req->input('username', $u['username']));
        $name = trim(preg_replace('/\s+/u', ' ', (string) $req->input('full_name', '')));
        $active = (bool) $req->input('is_active', true);
        if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username)) {
            throw new HttpException(422, 'ชื่อผู้ใช้/รหัสนักศึกษา ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 3–50 ตัว');
        }
        if ($name === '' || mb_strlen($name) > 150) {
            throw new HttpException(422, 'กรุณากรอกชื่อ-สกุล');
        }
        if ((int) $u['id'] === (int) $req->user['id'] && !$active) {
            throw new HttpException(422, 'ปิดการใช้งานบัญชีของตัวเองไม่ได้');
        }
        $dup = $db->prepare('SELECT COUNT(*) FROM users WHERE username = ? AND id <> ?');
        $dup->execute([$username, $u['id']]);
        if ($dup->fetchColumn()) {
            throw new HttpException(409, "ชื่อผู้ใช้ {$username} ถูกใช้แล้ว");
        }
        $deptId = $req->input('department_id') ? (int) $req->input('department_id') : null;
        $group = mb_substr(trim((string) $req->input('class_group', '')), 0, 30) ?: null;
        $db->prepare('UPDATE users SET username = ?, full_name = ?, department_id = ?, class_group = ?, student_code = ?, is_active = ? WHERE id = ?')
            ->execute([$username, $name, $deptId, $u['role'] === 'student' ? $group : null,
                $u['role'] === 'student' ? $username : $u['student_code'], $active ? 1 : 0, $u['id']]);
        if (!$active) {
            $db->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$u['id']]);
        }
        if ($u['role'] === 'student') {
            // keep the student status in step: re-enabled = studying, disabled here = account closed
            // (unless already marked graduated/dropped)
            $db->prepare("UPDATE users SET student_status = IF(? = 1, 'studying', IF(COALESCE(student_status, 'studying') = 'studying', 'inactive', student_status)) WHERE id = ?")
                ->execute([$active ? 1 : 0, $u['id']]);
        }
        return ['ok' => true];
    }

    /**
     * POST /admin/users — add one account: { role, username, full_name, department_id?, class_group?, password? }
     * No password = the username (student: the student code), changed at first login.
     */
    public static function createUser(Request $req): array
    {
        $role = (string) $req->input('role', '');
        if (!in_array($role, ['student', 'teacher', 'admin'], true)) {
            throw new HttpException(422, 'กรุณาเลือกบทบาท');
        }
        $username = trim((string) $req->input('username', ''));
        $name = trim(preg_replace('/\s+/u', ' ', (string) $req->input('full_name', '')));
        $password = (string) $req->input('password', '');
        $label = $role === 'student' ? 'รหัสนักศึกษา' : 'ชื่อผู้ใช้';
        if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username)) {
            throw new HttpException(422, "$label ต้องเป็นตัวอักษรอังกฤษ ตัวเลข หรือ . _ - ยาว 3–50 ตัว (ไม่มีช่องว่าง)");
        }
        if ($name === '' || mb_strlen($name) > 150) {
            throw new HttpException(422, 'กรุณากรอกชื่อ-สกุล');
        }
        if ($password !== '') {
            PasswordService::assertStrong($password, $username);
        }
        $db = Database::get();
        // case-insensitive (column collation) and never clashing with someone's student code
        $dup = $db->prepare('SELECT COUNT(*) FROM users WHERE username = ? OR student_code = ?');
        $dup->execute([$username, $username]);
        if ($dup->fetchColumn()) {
            throw new HttpException(409, "$label {$username} มีในระบบแล้ว");
        }
        $deptId = $req->input('department_id') ? (int) $req->input('department_id') : null;
        $group = $role === 'student' ? (mb_substr(trim((string) $req->input('class_group', '')), 0, 30) ?: null) : null;
        $db->prepare(
            'INSERT INTO users (username, password_hash, full_name, role, department_id, student_code, class_group, student_status, must_change_password)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$username, password_hash($password !== '' ? $password : $username, PASSWORD_DEFAULT), $name, $role, $deptId,
            $role === 'student' ? $username : null, $group, $role === 'student' ? 'studying' : null, $password === '' ? 1 : 0]);
        return ['id' => (int) $db->lastInsertId(), 'message' => "เพิ่มผู้ใช้ {$name} ({$username}) แล้ว" . ($password === '' ? " · รหัสผ่านเริ่มต้น = {$username} (ต้องตั้งใหม่เมื่อเข้าสู่ระบบครั้งแรก)" : '')];
    }

    /** GET /admin/reset-requests — pending "forgot password" requests. */
    public static function resetRequests(Request $req): array
    {
        return ['requests' => Database::get()->query(
            "SELECT r.id, r.note, r.created_at, u.id AS user_id, u.username, u.full_name, u.role, u.class_group
               FROM password_reset_requests r JOIN users u ON u.id = r.user_id
              WHERE r.status = 'pending' ORDER BY r.created_at"
        )->fetchAll()];
    }

    /** POST /admin/reset-requests/{id}/dismiss — close a request without resetting (e.g. spam). */
    public static function dismissRequest(Request $req): array
    {
        Database::get()->prepare("UPDATE password_reset_requests SET status = 'dismissed', handled_by = ?, handled_at = NOW() WHERE id = ? AND status = 'pending'")
            ->execute([$req->user['id'], (int) $req->params['id']]);
        return ['ok' => true];
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
