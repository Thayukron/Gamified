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

return $config;
