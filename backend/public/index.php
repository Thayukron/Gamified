<?php
require __DIR__ . '/../bootstrap.php';

use App\Core\HttpException;
use App\Core\Response;
use App\Core\Router;

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, app_config('cors_origins'), true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Async-Job');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = '/' . trim(preg_replace('#^.*?/api#', '', $path), '/');

$router = new Router();
require __DIR__ . '/../routes.php';

try {
    $router->dispatch($_SERVER['REQUEST_METHOD'], $path);
} catch (HttpException $e) {
    Response::error($e->getMessage(), $e->status);
} catch (Throwable $e) {
    error_log((string) $e);
    Response::error('เกิดข้อผิดพลาดภายในระบบ', 500);
}
