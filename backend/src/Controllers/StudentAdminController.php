<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;

/**
 * Admin: class groups and student status over the years.
 *   - promote a whole group (ปวส.1/1 -> ปวส.2/1) keeping the same accounts — no re-import
 *   - graduated / dropped out / closed: the account can't log in and is hidden from courses,
 *     but every record (results, reports) is kept
 */
class StudentAdminController
{
    public const STATUS_TH = ['studying' => 'กำลังศึกษา', 'graduated' => 'สำเร็จการศึกษา', 'dropped' => 'ออกกลางคัน', 'inactive' => 'ปิดบัญชี'];

    /** GET /admin/class-groups — every group with head counts per status. */
    public static function groups(Request $req): array
    {
        $rows = Database::get()->query(
            "SELECT u.class_group AS name, MIN(d.name) AS department_name,
                    SUM(COALESCE(u.student_status, 'studying') = 'studying') AS studying,
                    SUM(u.student_status = 'graduated') AS graduated,
                    SUM(u.student_status = 'dropped') AS dropped,
                    SUM(u.student_status = 'inactive') AS inactive,
                    COUNT(*) AS total
               FROM users u LEFT JOIN departments d ON d.id = u.department_id
              WHERE u.role = 'student' AND u.class_group IS NOT NULL AND u.class_group <> ''
           GROUP BY u.class_group
           ORDER BY (SUM(COALESCE(u.student_status, 'studying') = 'studying') = 0), u.class_group"
        )->fetchAll();
        foreach ($rows as &$r) {
            foreach (['studying', 'graduated', 'dropped', 'inactive', 'total'] as $k) {
                $r[$k] = (int) $r[$k];
            }
        }
        return ['groups' => $rows, 'status_th' => self::STATUS_TH];
    }

    /** GET /admin/class-groups/members?group= — students of one group (any status). */
    public static function members(Request $req): array
    {
        $stmt = Database::get()->prepare(
            "SELECT id, student_code, full_name, COALESCE(student_status, 'studying') AS status
               FROM users WHERE role = 'student' AND class_group = ? ORDER BY student_code"
        );
        $stmt->execute([trim((string) $req->query('group', ''))]);
        return ['students' => $stmt->fetchAll()];
    }

    /** POST /admin/class-groups/rename — { from, to }: promote/rename a group; only students still studying move. */
    public static function rename(Request $req): array
    {
        $from = trim((string) $req->input('from', ''));
        $to = mb_substr(trim(preg_replace('/\s+/u', ' ', (string) $req->input('to', ''))), 0, 30);
        if ($from === '' || $to === '') {
            throw new HttpException(422, 'กรุณาระบุชื่อกลุ่มเรียนใหม่');
        }
        if ($from === $to) {
            throw new HttpException(422, 'ชื่อกลุ่มเรียนใหม่เหมือนชื่อเดิม');
        }
        $stmt = Database::get()->prepare(
            "UPDATE users SET class_group = ? WHERE role = 'student' AND class_group = ? AND COALESCE(student_status, 'studying') = 'studying'"
        );
        $stmt->execute([$to, $from]);
        return ['moved' => $stmt->rowCount(), 'message' => "ย้ายนักศึกษา {$stmt->rowCount()} คน จาก {$from} ไป {$to} แล้ว"];
    }

    /** POST /admin/students/status — { status, class_group? | student_ids? } */
    public static function setStatus(Request $req): array
    {
        $status = (string) $req->input('status', '');
        if (!isset(self::STATUS_TH[$status])) {
            throw new HttpException(422, 'สถานะไม่ถูกต้อง');
        }
        $db = Database::get();
        $group = trim((string) $req->input('class_group', ''));
        $ids = array_values(array_unique(array_filter(array_map('intval', (array) $req->input('student_ids', [])))));
        if ($group === '' && !$ids) {
            throw new HttpException(422, 'กรุณาเลือกกลุ่มเรียนหรือนักศึกษา');
        }
        [$where, $args] = $group !== ''
            ? ['class_group = ?', [$group]]
            : ['id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')', $ids];
        $stmt = $db->prepare("SELECT id FROM users WHERE role = 'student' AND $where");
        $stmt->execute($args);
        $targets = array_map('intval', $stmt->fetchAll(\PDO::FETCH_COLUMN));
        if (!$targets) {
            return ['changed' => 0, 'message' => 'ไม่พบนักศึกษา'];
        }
        $in = implode(',', array_fill(0, count($targets), '?'));
        $active = $status === 'studying' ? 1 : 0;
        $db->prepare("UPDATE users SET student_status = ?, is_active = ? WHERE id IN ($in)")->execute([$status, $active, ...$targets]);
        if (!$active) {
            $db->prepare("DELETE FROM auth_tokens WHERE user_id IN ($in)")->execute($targets); // sign them out now
        }
        return ['changed' => count($targets), 'message' => 'เปลี่ยนสถานะเป็น “' . self::STATUS_TH[$status] . '” ' . count($targets) . ' คนแล้ว'];
    }
}
