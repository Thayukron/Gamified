<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Bangkok');

$GLOBALS['__config'] = require __DIR__ . '/config.php';

function app_config(string $key): mixed
{
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
