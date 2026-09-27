<?php
namespace App\Core;

class Auth
{
    public static function issueToken(int $userId): string
    {
        $token = bin2hex(random_bytes(32));
        $ttl = (int) app_config('token_ttl_hours');
        Database::get()->prepare(
            'INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))'
        )->execute([$userId, hash('sha256', $token), $ttl]);
        return $token;
    }

    public static function revoke(string $token): void
    {
        Database::get()->prepare('DELETE FROM auth_tokens WHERE token_hash = ?')
            ->execute([hash('sha256', $token)]);
    }

    public static function bearerToken(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        return preg_match('/^Bearer\s+(\S+)$/i', $header, $m) ? $m[1] : null;
    }

    public static function user(): ?array
    {
        $token = self::bearerToken();
        if (!$token) {
            return null;
        }
        $stmt = Database::get()->prepare(
            'SELECT u.id, u.username, u.full_name, u.role, u.department_id, u.student_code, u.must_change_password
               FROM auth_tokens t JOIN users u ON u.id = t.user_id
              WHERE t.token_hash = ? AND t.expires_at > NOW() AND u.is_active = 1'
        );
        $stmt->execute([hash('sha256', $token)]);
        return $stmt->fetch() ?: null;
    }

    /** @param string[] $roles roles allowed; ['*'] = any logged-in user */
    public static function require(array $roles): array
    {
        $user = self::user();
        if (!$user) {
            throw new HttpException(401, 'กรุณาเข้าสู่ระบบ');
        }
        if (!in_array('*', $roles, true) && !in_array($user['role'], $roles, true)) {
            throw new HttpException(403, 'ไม่มีสิทธิ์เข้าถึง');
        }
        return $user;
    }
}
