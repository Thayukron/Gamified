<?php
namespace App\Services;

use App\Core\Database;
use App\Core\HttpException;

/**
 * A teacher imports the students of ONE of their courses from a file (รหัสนักศึกษา, ชื่อ-สกุล, กลุ่มเรียน).
 *   - student code not in the system -> new student account (department = the course's, password = code,
 *     must change at first login) and enrolled
 *   - existing student -> only enrolled; the teacher never changes someone else's account data
 *   - code that belongs to a teacher/admin account -> error
 * Teachers are imported by the admin (/admin/import).
 */
class RosterImportService
{
    public const MAX_ROWS = 1000;

    /** @return array{rows: array, summary: array} */
    public static function preview(array $course, array $rows): array
    {
        $rows = array_slice(array_values($rows), 0, self::MAX_ROWS);
        $codes = array_values(array_unique(array_filter(array_map(fn ($r) => trim((string) (((array) $r)['student_code'] ?? '')), $rows))));
        $users = [];      // lower-cased code => user row
        $enrolled = [];   // user id => true
        if ($codes) {
            $db = Database::get();
            $in = implode(',', array_fill(0, count($codes), '?'));
            $stmt = $db->prepare("SELECT id, username, student_code, full_name, role FROM users WHERE username IN ($in) OR student_code IN ($in)");
            $stmt->execute([...$codes, ...$codes]);
            foreach ($stmt->fetchAll() as $u) {
                $users[mb_strtolower($u['username'])] = $u;
                if ($u['student_code'] !== null) {
                    $users[mb_strtolower($u['student_code'])] ??= $u;
                }
            }
            $stmt = $db->prepare('SELECT student_id FROM enrollments WHERE course_id = ?');
            $stmt->execute([$course['id']]);
            $enrolled = array_fill_keys(array_map('intval', $stmt->fetchAll(\PDO::FETCH_COLUMN)), true);
        }

        $seen = [];
        $out = [];
        foreach ($rows as $i => $raw) {
            $raw = (array) $raw;
            $d = [
                'student_code' => trim((string) ($raw['student_code'] ?? '')),
                'full_name' => trim(preg_replace('/\s+/u', ' ', (string) ($raw['full_name'] ?? ''))),
                'class_group' => mb_substr(trim((string) ($raw['class_group'] ?? '')), 0, 30),
            ];
            $row = mb_substr((string) ($raw['_row'] ?? $i + 2), 0, 60);
            $err = [];
            $msg = [];
            $key = mb_strtolower($d['student_code']);
            $u = $users[$key] ?? null;
            if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $d['student_code'])) {
                $err[] = 'รหัสนักศึกษาต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 3–50 ตัว';
            } elseif (isset($seen[$key])) {
                $err[] = "รหัสซ้ำในไฟล์ (แถว {$seen[$key]})";
            } elseif ($u && $u['role'] !== 'student') {
                $err[] = 'รหัสนี้เป็นบัญชีครู/ผู้ดูแลระบบ ไม่ใช่นักศึกษา';
            } elseif (!$u && $d['full_name'] === '') {
                $err[] = 'นักศึกษาใหม่ต้องมีชื่อ-สกุล';
            }
            $seen[$key] ??= $row;

            if ($err) {
                $status = 'error';
            } elseif (!$u) {
                $status = 'new';
                $msg[] = 'สร้างบัญชีใหม่ · รหัสผ่านเริ่มต้น = รหัสนักศึกษา (ต้องตั้งใหม่เมื่อเข้าครั้งแรก)';
            } elseif (isset($enrolled[(int) $u['id']])) {
                $status = 'enrolled';
                $msg[] = 'อยู่ในรายวิชานี้แล้ว';
            } else {
                $status = 'enroll';
                $msg[] = 'มีบัญชีในระบบแล้ว — เพิ่มเข้ารายวิชาเท่านั้น';
                if ($d['full_name'] !== '' && $d['full_name'] !== $u['full_name']) {
                    $msg[] = "ชื่อในระบบ: {$u['full_name']} (ไม่แก้ไข)";
                }
            }
            $out[] = ['row' => $row, 'status' => $status, 'messages' => $err ?: $msg, 'data' => $d, 'user_id' => $u ? (int) $u['id'] : null];
        }
        $count = array_count_values(array_column($out, 'status'));
        return [
            'rows' => $out,
            'summary' => ['total' => count($out)] + array_map(fn ($s) => $count[$s] ?? 0, ['new' => 'new', 'enroll' => 'enroll', 'enrolled' => 'enrolled', 'error' => 'error']),
        ];
    }

    /** Re-validates, then creates new students and enrolls everyone valid — in one transaction. */
    public static function commit(array $course, array $rows): array
    {
        $checked = self::preview($course, $rows);
        $db = Database::get();
        $created = $added = 0;
        $db->beginTransaction();
        try {
            $insert = $db->prepare('INSERT INTO users (username, password_hash, full_name, role, department_id, student_code, class_group, must_change_password) VALUES (?, ?, ?, \'student\', ?, ?, ?, 1)');
            $enroll = $db->prepare('INSERT IGNORE INTO enrollments (course_id, student_id) VALUES (?, ?)');
            foreach ($checked['rows'] as $r) {
                if ($r['status'] === 'new') {
                    $d = $r['data'];
                    $insert->execute([$d['student_code'], password_hash($d['student_code'], PASSWORD_DEFAULT), $d['full_name'],
                        $course['department_id'] ?: null, $d['student_code'], $d['class_group'] !== '' ? $d['class_group'] : null]);
                    $r['user_id'] = (int) $db->lastInsertId();
                    $created++;
                }
                if (in_array($r['status'], ['new', 'enroll'], true)) {
                    $enroll->execute([$course['id'], $r['user_id']]);
                    $added += $enroll->rowCount();
                }
            }
            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e instanceof HttpException ? $e : new HttpException(500, 'นำเข้าไม่สำเร็จ — ไม่มีข้อมูลใดถูกบันทึก');
        }
        return ['created' => $created, 'enrolled' => $added] + $checked['summary'];
    }
}
