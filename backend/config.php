<?php
// Default configuration. Override locally with config.local.php (git-ignored).
$config = [
    'db' => [
        'host'     => '127.0.0.1',
        'port'     => 3310,
        'name'     => 'gamified',
        'user'     => 'root',
        'password' => '',
    ],
    'cors_origins' => ['http://localhost:3100', 'http://127.0.0.1:3100'],
    'token_ttl_hours' => 24 * 7,
    'academic_year' => 2569,
    'semester' => 1,
    'gemini' => [
        'base_url' => 'https://generativelanguage.googleapis.com/v1beta',
        'timeout' => 90,
    ],
];

if (file_exists(__DIR__ . '/config.local.php')) {
    $config = array_replace_recursive($config, require __DIR__ . '/config.local.php');
}

// One database for everything: outside Docker (php -S on this machine) connect to the Docker
// database through its published port, using the same .env that docker compose reads.
if ((getenv('DB_HOST') ?: '') === '' && is_file($dotenv = dirname(__DIR__) . '/.env')) {
    $vars = [];
    foreach (file($dotenv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (preg_match('/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/', $line, $m)) {
            $vars[$m[1]] = trim($m[2], "\"'");
        }
    }
    $config['db'] = array_replace($config['db'], array_filter([
        'host' => '127.0.0.1',
        'port' => (int) ($vars['DB_PUBLISH_PORT'] ?? 3320),
        'name' => $vars['DB_NAME'] ?? null,
        'user' => $vars['DB_USER'] ?? null,
        'password' => $vars['DB_PASSWORD'] ?? null,
    ], fn ($v) => $v !== null));
    foreach (['ACADEMIC_YEAR' => 'academic_year', 'SEMESTER' => 'semester'] as $var => $key) {
        if (($vars[$var] ?? '') !== '') {
            $config[$key] = (int) $vars[$var];
        }
    }
}

// Environment variables win (Docker / production): DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD,
// CORS_ORIGINS (comma separated), ACADEMIC_YEAR, SEMESTER
$env = fn (string $k) => ($v = getenv($k)) === false || $v === '' ? null : $v;
foreach (['host' => 'DB_HOST', 'port' => 'DB_PORT', 'name' => 'DB_NAME', 'user' => 'DB_USER', 'password' => 'DB_PASSWORD'] as $key => $var) {
    if (($v = $env($var)) !== null) {
        $config['db'][$key] = $key === 'port' ? (int) $v : $v;
    }
}
if (($v = $env('CORS_ORIGINS')) !== null) {
    $config['cors_origins'] = array_map('trim', explode(',', $v));
}
if (($v = $env('ACADEMIC_YEAR')) !== null) {
    $config['academic_year'] = (int) $v;
}
if (($v = $env('SEMESTER')) !== null) {
    $config['semester'] = (int) $v;
}

return $config;
