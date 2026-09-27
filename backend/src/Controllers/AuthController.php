<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;

class AuthController
{
    public static function login(Request $req): array
    {
        $username = trim((string) $req->input('username', ''));
        $password = (string) $req->input('password', '');
        if ($username === '' || $password === '') {
            throw new HttpException(422, 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
        }

        $stmt = Database::get()->prepare(
            'SELECT id, username, password_hash, full_name, role, department_id, student_code, must_change_password
               FROM users WHERE username = ? AND is_active = 1'
        );
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            throw new HttpException(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
        unset($user['password_hash']);
        $user['must_change_password'] = (bool) $user['must_change_password'];

        return ['token' => Auth::issueToken((int) $user['id']), 'user' => $user];
    }

    public static function logout(Request $req): array
    {
        Auth::revoke(Auth::bearerToken());
        return ['ok' => true];
    }

    public static function me(Request $req): array
    {
        return ['user' => ['must_change_password' => (bool) $req->user['must_change_password']] + $req->user];
    }
}
