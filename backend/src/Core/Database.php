<?php
namespace App\Core;

use PDO;

class Database
{
    private static ?PDO $pdo = null;

    public static function connect(array $db, bool $withDbName = true, bool $persistent = false): PDO
    {
        $dsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $db['host'], $db['port']);
        if ($withDbName) {
            $dsn .= ';dbname=' . $db['name'];
        }
        return new PDO($dsn, $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_PERSISTENT         => $persistent,
        ]);
    }

    /**
     * Connection for web requests. Persistent (one per Apache worker, reused across requests):
     * opening a new TCP connection per request exhausted the container's ports under load
     * ("Cannot assign requested address" at ~50 concurrent users) — see docs/load-test.md.
     */
    public static function get(): PDO
    {
        if (self::$pdo === null) {
            self::$pdo = self::connect(app_config('db'), true, PHP_SAPI !== 'cli');
            if (self::$pdo->inTransaction()) {
                self::$pdo->rollBack(); // a reused connection must never carry a previous request's transaction
            }
        }
        return self::$pdo;
    }
}
