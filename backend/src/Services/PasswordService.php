<?php
namespace App\Services;

use App\Core\Database;
use App\Core\HttpException;

/**
 * Password rules and resets shared by the account page, admin and teachers.
 * There is no e-mail for students, so "forgot password" = a request that an admin
 * (or a teacher of one of the student's courses) resolves by resetting to the default
 * password (= username / student code); the user must then choose a new one at next login.
 */
class PasswordService
{
    public const MIN_LENGTH = 6;

    /** Throws 422 when the new password is not acceptable. */
    public static function assertStrong(string $password, string $username): void
    {
        if (mb_strlen($password) < self::MIN_LENGTH) {
            throw new HttpException(422, 'รหัสผ่านใหม่ต้องยาวอย่างน้อย ' . self::MIN_LENGTH . ' ตัวอักษร');
        }
        if (mb_strtolower($password) === mb_strtolower($username)) {
            throw new HttpException(422, 'รหัสผ่านใหม่ต้องไม่เหมือนชื่อผู้ใช้/รหัสนักศึกษา');
        }
        if (mb_strlen($password) > 72) {
            throw new HttpException(422, 'รหัสผ่านยาวเกินไป (ไม่เกิน 72 ตัวอักษร)');
        }
    }

    /**
     * Reset to the default password (= username), force a change at next login,
     * sign the user out everywhere and close their pending reset requests.
     */
    public static function resetToDefault(int $userId, int $byUserId): string
    {
        $db = Database::get();
        $stmt = $db->prepare('SELECT username FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $username = $stmt->fetchColumn();
        if ($username === false) {
            throw new HttpException(404, 'ไม่พบผู้ใช้');
        }
        $db->prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
            ->execute([password_hash($username, PASSWORD_DEFAULT), $userId]);
        $db->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$userId]);
        $db->prepare("UPDATE password_reset_requests SET status = 'done', handled_by = ?, handled_at = NOW() WHERE user_id = ? AND status = 'pending'")
            ->execute([$byUserId, $userId]);
        return $username;
    }
}
