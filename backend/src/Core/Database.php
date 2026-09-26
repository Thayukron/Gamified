<?php
namespace App\Core;

use PDO;

class Database
{
    private static ?PDO $pdo = null;

    public static function connect(array $db, bool $withDbName = true): PDO
    {
        $dsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $db['host'], $db['port']);
        if ($withDbName) {
            $dsn .= ';dbname=' . $db['name'];
        }
        return new PDO($dsn, $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }

    public static function get(): PDO
    {
        if (self::$pdo === null) {
            self::$pdo = self::connect(app_config('db'));
        }
        return self::$pdo;
    }
}
