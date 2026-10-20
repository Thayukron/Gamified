<?php
namespace App\Services;

use App\Core\Database;
use PDO;

/**
 * Bulk import of departments, teachers, students, courses and enrollments.
 * Rows arrive already mapped to canonical keys (the browser parses xlsx/csv).
 * validate() is side-effect free; commit() re-validates and applies valid rows in one transaction.
 * Existing records are updated (upsert), so re-importing the same file is safe.
 */
class ImportService
{
    public const TYPES = ['departments', 'teachers', 'students', 'courses', 'enrollments'];
    private const MAX_ROWS = 5000;
    private const COURSE_TYPES = ['theory' => 'theory', 'practice' => 'practice', 'mixed' => 'mixed', 'ทฤษฎี' => 'theory', 'ปฏิบัติ' => 'practice', 'ผสม' => 'mixed', 'ทฤษฎี+ปฏิบัติ' => 'mixed', 'ทฤษฎีและปฏิบัติ' => 'mixed'];

    private array $depts = [];     // code => id|null (null = created in this batch)
    private array $users = [];     // lower-cased username => ['id', 'role']
    private array $courses = [];   // "code|section|sem|year" => id|null
    private string $rowNo = '';
    private int $sem;
    private int $year;

    public function __construct()
    {
        $this->sem = (int) app_config('semester');
        $this->year = (int) app_config('academic_year');
        $db = Database::get();
        $this->depts = $db->query('SELECT code, id FROM departments')->fetchAll(PDO::FETCH_KEY_PAIR);
        foreach ($db->query('SELECT id, username, role FROM users') as $u) {
            $this->users[self::uk($u['username'])] = ['id' => (int) $u['id'], 'role' => $u['role']];
        }
        foreach ($db->query('SELECT id, code, section, semester, academic_year FROM courses') as $c) {
            $this->courses[self::courseKey($c['code'], $c['section'], (int) $c['semester'], (int) $c['academic_year'])] = (int) $c['id'];
        }
    }

    private static function courseKey(string $code, string $section, int $sem, int $year): string
    {
        return mb_strtolower("$code|$section|$sem|$year");
    }

    // usernames are unique case-insensitively in the DB (utf8mb4_unicode_ci), so look them up the same way
    private static function uk(string $username): string
    {
        return mb_strtolower($username);
    }

    private static function s(mixed $v): string
    {
        return trim(preg_replace('/\s+/u', ' ', (string) ($v ?? '')));
    }

    /**
     * @param array $payload type => rows[]
     * @return array type => ['rows' => [...], 'summary' => [...]]
     */
    public function validate(array $payload): array
    {
        $out = [];
        foreach (self::TYPES as $type) {
            $rows = array_slice(array_values((array) ($payload[$type] ?? [])), 0, self::MAX_ROWS);
            if (!$rows) {
                continue;
            }
            $seen = [];
            $checked = [];
            foreach ($rows as $i => $raw) {
                // spreadsheet row as sent by the client (_row), else position after the header
                $this->rowNo = mb_substr((string) (((array) $raw)['_row'] ?? $i + 2), 0, 60);
                $r = $this->{'check' . ucfirst($type)}((array) $raw, $seen);
                $r['row'] = $this->rowNo;
                $checked[] = $r;
            }
            $count = array_count_values(array_column($checked, 'status'));
            $out[$type] = [
                'rows' => $checked,
                'summary' => ['total' => count($checked), 'new' => $count['new'] ?? 0, 'update' => $count['update'] ?? 0, 'error' => $count['error'] ?? 0],
            ];
        }
        return $out;
    }

    // ------------------------------------------------------------------ per-type checks
    // Each returns ['status' => new|update|error, 'messages' => [...], 'data' => normalized row].
    // Rows that pass are registered in the lookup maps so later types can reference them.

    private function checkDepartments(array $r, array &$seen): array
    {
        $d = ['code' => mb_strtoupper(self::s($r['code'] ?? '')), 'name' => self::s($r['name'] ?? '')];
        $err = [];
        if (!preg_match('/^[A-Z0-9._-]{1,20}$/', $d['code'])) {
            $err[] = 'รหัสแผนกต้องเป็นตัวอักษรอังกฤษ/ตัวเลข ไม่เกิน 20 ตัว';
        }
        if ($d['name'] === '') {
            $err[] = 'ไม่มีชื่อแผนก';
        }
        if (isset($seen[$d['code']])) {
            $err[] = "รหัสแผนกซ้ำในไฟล์ (แถว {$seen[$d['code']]})";
        }
        return $this->finish($d, $err, array_key_exists($d['code'], $this->depts), $seen, $d['code'], fn () => $this->depts[$d['code']] ??= null);
    }

    private function checkUser(array $r, array &$seen, string $role): array
    {
        $key = $role === 'student' ? 'student_code' : 'username';
        $username = self::s($r[$key] ?? '');
        $d = [
            $key => $username,
            'full_name' => self::s($r['full_name'] ?? ''),
            'department_code' => mb_strtoupper(self::s($r['department_code'] ?? '')),
            'password' => (string) ($r['password'] ?? ''),
        ];
        if ($role === 'student') {
            $d['class_group'] = mb_substr(self::s($r['class_group'] ?? ''), 0, 30);
        }
        $err = [];
        $label = $role === 'student' ? 'รหัสนักศึกษา' : 'ชื่อผู้ใช้';
        if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username)) {
            $err[] = "$label ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 3–50 ตัว";
        }
        if ($d['full_name'] === '') {
            $err[] = 'ไม่มีชื่อ-สกุล';
        }
        if ($d['department_code'] !== '' && !array_key_exists($d['department_code'], $this->depts)) {
            $err[] = "ไม่พบแผนก {$d['department_code']} (เพิ่มในชีตแผนกวิชาก่อน)";
        }
        if ($d['password'] !== '' && mb_strlen($d['password']) < 6) {
            $err[] = 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว';
        }
        $existing = $this->users[self::uk($username)] ?? null;
        if ($existing && $existing['role'] !== $role) {
            $err[] = "$label นี้เป็นบัญชี{$this->roleTh($existing['role'])}อยู่แล้ว";
        }
        if (isset($seen[self::uk($username)])) {
            $err[] = "$label ซ้ำในไฟล์ (แถว {$seen[self::uk($username)]})";
        }
        $res = $this->finish($d, $err, (bool) $existing, $seen, self::uk($username), function () use ($username, $role) {
            $this->users[self::uk($username)] ??= ['id' => null, 'role' => $role];
        });
        if ($res['status'] === 'new' && $d['password'] === '') {
            $res['messages'][] = 'รหัสผ่านเริ่มต้น = ' . ($role === 'student' ? 'รหัสนักศึกษา' : 'ชื่อผู้ใช้') . ' (ต้องตั้งใหม่เมื่อเข้าสู่ระบบครั้งแรก)';
        }
        unset($res['data']['password']);
        $res['password'] = $d['password']; // kept server-side only for commit
        return $res;
    }

    private function roleTh(string $role): string
    {
        return ['student' => 'นักศึกษา', 'teacher' => 'ครู', 'admin' => 'ผู้ดูแลระบบ'][$role] ?? $role;
    }

    private function checkTeachers(array $r, array &$seen): array
    {
        return $this->checkUser($r, $seen, 'teacher');
    }

    private function checkStudents(array $r, array &$seen): array
    {
        return $this->checkUser($r, $seen, 'student');
    }

    private function checkCourses(array $r, array &$seen): array
    {
        $type = self::COURSE_TYPES[mb_strtolower(self::s($r['course_type'] ?? ''))] ?? (self::s($r['course_type'] ?? '') === '' ? 'mixed' : null);
        $d = [
            'code' => self::s($r['code'] ?? ''),
            'name' => self::s($r['name'] ?? ''),
            'section' => self::s($r['section'] ?? '') ?: '1',
            'semester' => (int) (self::s($r['semester'] ?? '') ?: $this->sem),
            'academic_year' => (int) (self::s($r['academic_year'] ?? '') ?: $this->year),
            'department_code' => mb_strtoupper(self::s($r['department_code'] ?? '')),
            'teacher_username' => self::s($r['teacher_username'] ?? ''),
            'course_type' => $type ?? 'mixed',
            'level' => self::s($r['level'] ?? ''),
            'topics' => array_values(array_filter(array_map('trim', preg_split('/[,\n;]/u', (string) ($r['topics'] ?? ''))))),
        ];
        $err = [];
        if ($d['code'] === '' || mb_strlen($d['code']) > 30) {
            $err[] = 'ไม่มีรหัสวิชา (หรือยาวเกิน 30 ตัว)';
        }
        if ($d['name'] === '') {
            $err[] = 'ไม่มีชื่อวิชา';
        }
        if ($d['semester'] < 1 || $d['semester'] > 3) {
            $err[] = 'ภาคเรียนต้องเป็น 1, 2 หรือ 3';
        }
        if ($d['academic_year'] < 2500 || $d['academic_year'] > 2700) {
            $err[] = 'ปีการศึกษาต้องเป็นปี พ.ศ. เช่น 2569';
        }
        if ($type === null) {
            $err[] = 'ประเภทวิชาต้องเป็น ทฤษฎี / ปฏิบัติ / ผสม';
        }
        if ($d['department_code'] !== '' && !array_key_exists($d['department_code'], $this->depts)) {
            $err[] = "ไม่พบแผนก {$d['department_code']}";
        }
        if ($d['teacher_username'] !== '') {
            $t = $this->users[self::uk($d['teacher_username'])] ?? null;
            if (!$t) {
                $err[] = "ไม่พบครู {$d['teacher_username']} (เพิ่มในชีตครูก่อน)";
            } elseif ($t['role'] !== 'teacher') {
                $err[] = "{$d['teacher_username']} ไม่ใช่บัญชีครู";
            }
        }
        $key = self::courseKey($d['code'], $d['section'], $d['semester'], $d['academic_year']);
        if (isset($seen[$key])) {
            $err[] = "รายวิชา+กลุ่มเรียนซ้ำในไฟล์ (แถว {$seen[$key]})";
        }
        return $this->finish($d, $err, array_key_exists($key, $this->courses), $seen, $key, fn () => $this->courses[$key] ??= null);
    }

    private function checkEnrollments(array $r, array &$seen): array
    {
        $d = [
            'course_code' => self::s($r['course_code'] ?? ''),
            'section' => self::s($r['section'] ?? '') ?: '1',
            'semester' => (int) (self::s($r['semester'] ?? '') ?: $this->sem),
            'academic_year' => (int) (self::s($r['academic_year'] ?? '') ?: $this->year),
            'student_code' => self::s($r['student_code'] ?? ''),
        ];
        $err = [];
        $key = self::courseKey($d['course_code'], $d['section'], $d['semester'], $d['academic_year']);
        if (!array_key_exists($key, $this->courses)) {
            $err[] = "ไม่พบรายวิชา {$d['course_code']} กลุ่ม {$d['section']} ภาคเรียน {$d['semester']}/{$d['academic_year']}";
        }
        $st = $this->users[self::uk($d['student_code'])] ?? null;
        if (!$st) {
            $err[] = "ไม่พบนักศึกษา {$d['student_code']}";
        } elseif ($st['role'] !== 'student') {
            $err[] = "{$d['student_code']} ไม่ใช่บัญชีนักศึกษา";
        }
        $pair = $key . '#' . self::uk($d['student_code']);
        if (isset($seen[$pair])) {
            $err[] = "ลงทะเบียนซ้ำในไฟล์ (แถว {$seen[$pair]})";
        }
        $exists = false;
        if (!$err && $this->courses[$key] && $st['id']) {
            $q = Database::get()->prepare('SELECT 1 FROM enrollments WHERE course_id = ? AND student_id = ?');
            $q->execute([$this->courses[$key], $st['id']]);
            $exists = (bool) $q->fetchColumn();
        }
        return $this->finish($d, $err, $exists, $seen, $pair, fn () => null);
    }

    private function finish(array $d, array $err, bool $exists, array &$seen, string $key, callable $register): array
    {
        $seen[$key] ??= $this->rowNo;
        if ($err) {
            return ['status' => 'error', 'messages' => $err, 'data' => $d];
        }
        $register();
        return ['status' => $exists ? 'update' : 'new', 'messages' => [], 'data' => $d];
    }

    // ------------------------------------------------------------------ commit

    public function commit(array $payload): array
    {
        $checked = $this->validate($payload);
        $db = Database::get();
        $result = [];
        $db->beginTransaction();
        try {
            // reload ids after each type so later types can reference freshly inserted rows
            foreach (self::TYPES as $type) {
                if (!isset($checked[$type])) {
                    continue;
                }
                $applied = 0;
                foreach ($checked[$type]['rows'] as $row) {
                    if ($row['status'] !== 'error') {
                        $this->{'apply' . ucfirst($type)}($row);
                        $applied++;
                    }
                }
                $result[$type] = $checked[$type]['summary'] + ['applied' => $applied];
                $this->reloadIds();
            }
            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }
        return $result;
    }

    private function reloadIds(): void
    {
        $db = Database::get();
        $this->depts = $db->query('SELECT code, id FROM departments')->fetchAll(PDO::FETCH_KEY_PAIR);
        foreach ($db->query('SELECT id, username, role FROM users') as $u) {
            $this->users[self::uk($u['username'])] = ['id' => (int) $u['id'], 'role' => $u['role']];
        }
        foreach ($db->query('SELECT id, code, section, semester, academic_year FROM courses') as $c) {
            $this->courses[self::courseKey($c['code'], $c['section'], (int) $c['semester'], (int) $c['academic_year'])] = (int) $c['id'];
        }
    }

    private function applyDepartments(array $row): void
    {
        Database::get()->prepare('INSERT INTO departments (code, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)')
            ->execute([$row['data']['code'], $row['data']['name']]);
    }

    private function applyUser(array $row, string $role): void
    {
        $d = $row['data'];
        $d['username'] = $d[$role === 'student' ? 'student_code' : 'username'];
        $deptId = $d['department_code'] !== '' ? $this->depts[$d['department_code']] : null;
        $group = ($d['class_group'] ?? '') !== '' ? $d['class_group'] : null;
        $db = Database::get();
        if ($row['status'] === 'new') {
            $pw = $row['password'] !== '' ? $row['password'] : $d['username'];
            // default password (= username) must be replaced at first login
            $db->prepare('INSERT INTO users (username, password_hash, full_name, role, department_id, student_code, class_group, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$d['username'], password_hash($pw, PASSWORD_DEFAULT), $d['full_name'], $role, $deptId, $role === 'student' ? $d['username'] : null, $group, $row['password'] === '' ? 1 : 0]);
        } else {
            $sql = 'UPDATE users SET full_name = ?, department_id = COALESCE(?, department_id), class_group = COALESCE(?, class_group), is_active = 1, student_status = IF(role = "student", "studying", student_status)';
            $args = [$d['full_name'], $deptId, $group];
            if ($row['password'] !== '') {
                $sql .= ', password_hash = ?';
                $args[] = password_hash($row['password'], PASSWORD_DEFAULT);
            }
            $db->prepare("$sql WHERE username = ?")->execute([...$args, $d['username']]);
        }
    }

    private function applyTeachers(array $row): void
    {
        $this->applyUser($row, 'teacher');
    }

    private function applyStudents(array $row): void
    {
        $this->applyUser($row, 'student');
    }

    private function applyCourses(array $row): void
    {
        $d = $row['data'];
        Database::get()->prepare(
            'INSERT INTO courses (code, name, section, semester, academic_year, department_id, teacher_id, course_type, level, topics)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name), department_id = COALESCE(VALUES(department_id), department_id),
                teacher_id = COALESCE(VALUES(teacher_id), teacher_id), course_type = VALUES(course_type),
                level = COALESCE(VALUES(level), level), topics = IF(VALUES(topics) = \'[]\', topics, VALUES(topics))'
        )->execute([
            $d['code'], $d['name'], $d['section'], $d['semester'], $d['academic_year'],
            $d['department_code'] !== '' ? $this->depts[$d['department_code']] : null,
            $d['teacher_username'] !== '' ? $this->users[self::uk($d['teacher_username'])]['id'] : null,
            $d['course_type'], $d['level'] ?: null, json_encode($d['topics'], JSON_UNESCAPED_UNICODE),
        ]);
    }

    private function applyEnrollments(array $row): void
    {
        $d = $row['data'];
        $courseId = $this->courses[self::courseKey($d['course_code'], $d['section'], $d['semester'], $d['academic_year'])];
        Database::get()->prepare('INSERT IGNORE INTO enrollments (course_id, student_id) VALUES (?, ?)')
            ->execute([$courseId, $this->users[self::uk($d['student_code'])]['id']]);
    }

    /** Strip server-only fields before returning a preview to the browser. */
    public static function forClient(array $checked): array
    {
        foreach ($checked as &$t) {
            foreach ($t['rows'] as &$r) {
                unset($r['password']);
            }
        }
        return $checked;
    }
}
