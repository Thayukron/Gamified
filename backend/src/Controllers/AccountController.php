<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Services\PasswordService;

/** The signed-in user's own account (any role) + the public "forgot password" request. */
class AccountController
{
    /** GET /me/profile */
    public static function profile(Request $req): array
    {
        $stmt = Database::get()->prepare(
            'SELECT u.id, u.username, u.full_name, u.role, u.student_code, u.class_group, u.must_change_password, u.created_at, d.name AS department_name
               FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ?'
        );
        $stmt->execute([$req->user['id']]);
        $p = $stmt->fetch();
        $p['must_change_password'] = (bool) $p['must_change_password'];
        $p['can_edit_name'] = $p['role'] !== 'student';
        return ['profile' => $p];
    }

    /** PUT /me/profile — { full_name } (teachers/admins; a student's official name is changed by the admin). */
    public static function updateProfile(Request $req): array
    {
        if ($req->user['role'] === 'student') {
            throw new HttpException(403, 'ชื่อ-สกุลของนักศึกษาแก้ไขได้โดยผู้ดูแลระบบ (ตามข้อมูลทะเบียน)');
        }
        $name = trim(preg_replace('/\s+/u', ' ', (string) $req->input('full_name', '')));
        if ($name === '' || mb_strlen($name) > 150) {
            throw new HttpException(422, 'กรุณากรอกชื่อ-สกุล (ไม่เกิน 150 ตัวอักษร)');
        }
        Database::get()->prepare('UPDATE users SET full_name = ? WHERE id = ?')->execute([$name, $req->user['id']]);
        return self::profile($req);
    }

    /**
     * PUT /me/username — { username, current_password } (teachers/admins).
     * Lets an account imported as a placeholder (teacher1, teacher2, ...) pick its own login name.
     * A student's username is the student code from the registry, so only the admin changes it.
     */
    public static function changeUsername(Request $req): array
    {
        if ($req->user['role'] === 'student') {
            throw new HttpException(403, 'ชื่อผู้ใช้ของนักศึกษาคือรหัสนักศึกษา แก้ไขได้โดยผู้ดูแลระบบ');
        }
        $db = Database::get();
        $stmt = $db->prepare('SELECT username, password_hash FROM users WHERE id = ?');
        $stmt->execute([$req->user['id']]);
        $u = $stmt->fetch();
        $password = (string) $req->input('current_password', '');
        if (!password_verify($password, $u['password_hash'])) {
            throw new HttpException(422, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
        }
        $username = trim((string) $req->input('username', ''));
        if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $username)) {
            throw new HttpException(422, 'ชื่อผู้ใช้ต้องเป็นตัวอักษรอังกฤษ ตัวเลข หรือ . _ - ยาว 3–50 ตัว (ไม่มีช่องว่าง)');
        }
        if ($username === $u['username']) {
            throw new HttpException(422, 'ชื่อผู้ใช้ใหม่เหมือนชื่อเดิม');
        }
        if (mb_strtolower($username) === mb_strtolower($password)) {
            throw new HttpException(422, 'ชื่อผู้ใช้ต้องไม่เหมือนรหัสผ่าน');
        }
        // the column collation is case-insensitive, so "Somchai" and "somchai" are the same login
        $dup = $db->prepare('SELECT COUNT(*) FROM users WHERE (username = ? OR student_code = ?) AND id <> ?');
        $dup->execute([$username, $username, $req->user['id']]);
        if ($dup->fetchColumn()) {
            throw new HttpException(409, "ชื่อผู้ใช้ {$username} มีผู้ใช้แล้ว — ลองชื่ออื่น");
        }
        $db->prepare('UPDATE users SET username = ? WHERE id = ?')->execute([$username, $req->user['id']]);
        return self::profile($req) + ['message' => "เปลี่ยนชื่อผู้ใช้เป็น {$username} แล้ว — ครั้งต่อไปเข้าสู่ระบบด้วยชื่อนี้"];
    }

    /** PUT /me/password — { current_password, new_password }; signs out every other device. */
    public static function changePassword(Request $req): array
    {
        $db = Database::get();
        $stmt = $db->prepare('SELECT username, password_hash FROM users WHERE id = ?');
        $stmt->execute([$req->user['id']]);
        $u = $stmt->fetch();
        if (!password_verify((string) $req->input('current_password', ''), $u['password_hash'])) {
            throw new HttpException(422, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
        }
        $new = (string) $req->input('new_password', '');
        PasswordService::assertStrong($new, $u['username']);
        if (password_verify($new, $u['password_hash'])) {
            throw new HttpException(422, 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
        }
        $db->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
            ->execute([password_hash($new, PASSWORD_DEFAULT), $req->user['id']]);
        $db->prepare('DELETE FROM auth_tokens WHERE user_id = ? AND token_hash <> ?')
            ->execute([$req->user['id'], hash('sha256', (string) Auth::bearerToken())]);
        return ['ok' => true, 'message' => 'เปลี่ยนรหัสผ่านเรียบร้อย · อุปกรณ์อื่นที่เคยเข้าสู่ระบบถูกออกจากระบบแล้ว'];
    }

    /**
     * POST /auth/forgot — { username, note? } (public).
     * Always answers the same way so it cannot be used to discover which accounts exist.
     */
    public static function forgot(Request $req): array
    {
        $username = trim((string) $req->input('username', ''));
        if ($username === '') {
            throw new HttpException(422, 'กรุณากรอกชื่อผู้ใช้หรือรหัสนักศึกษา');
        }
        $db = Database::get();
        $stmt = $db->prepare('SELECT id FROM users WHERE (username = ? OR student_code = ?) AND is_active = 1 LIMIT 1');
        $stmt->execute([$username, $username]);
        if ($id = $stmt->fetchColumn()) {
            $pending = $db->prepare("SELECT COUNT(*) FROM password_reset_requests WHERE user_id = ? AND status = 'pending'");
            $pending->execute([$id]);
            if (!$pending->fetchColumn()) {
                $note = mb_substr(trim((string) $req->input('note', '')), 0, 200) ?: null;
                $db->prepare('INSERT INTO password_reset_requests (user_id, note) VALUES (?, ?)')->execute([$id, $note]);
            }
        }
        return ['ok' => true, 'message' => 'ส่งคำขอแล้ว — ผู้ดูแลระบบหรือครูประจำวิชาจะรีเซ็ตให้ จากนั้นเข้าสู่ระบบด้วยรหัสผ่านชั่วคราว = ชื่อผู้ใช้/รหัสนักศึกษา แล้วตั้งรหัสผ่านใหม่ (แจ้งครูในชั้นเรียนเพื่อให้เร็วขึ้น)'];
    }
}
