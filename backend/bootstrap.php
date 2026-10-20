<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Bangkok');

$GLOBALS['__config'] = require __DIR__ . '/config.php';

function app_config(string $key): mixed
{
    // the current term is set by the admin in the web app (settings table); config/.env is only the fallback
    if ($key === 'semester' || $key === 'academic_year') {
        if (!array_key_exists('__term', $GLOBALS)) {
            $GLOBALS['__term'] = [];
            try {
                $rows = App\Core\Database::get()->query(
                    "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('term_semester', 'term_academic_year')"
                )->fetchAll(PDO::FETCH_KEY_PAIR);
                foreach (['semester' => 'term_semester', 'academic_year' => 'term_academic_year'] as $k => $s) {
                    if ((int) ($rows[$s] ?? 0) > 0) {
                        $GLOBALS['__term'][$k] = (int) $rows[$s];
                    }
                }
            } catch (Throwable) {
                // database not ready yet (installer) — use the config value
            }
        }
        if (isset($GLOBALS['__term'][$key])) {
            return $GLOBALS['__term'][$key];
        }
    }
    return $GLOBALS['__config'][$key] ?? null;
}

// PSR-4 style autoloader: App\Foo\Bar -> src/Foo/Bar.php
spl_autoload_register(function (string $class): void {
    if (str_starts_with($class, 'App\\')) {
        $file = __DIR__ . '/src/' . str_replace('\\', '/', substr($class, 4)) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});
