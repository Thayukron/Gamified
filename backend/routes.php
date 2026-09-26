<?php
/** @var App\Core\Router $router */

use App\Controllers\AuthController;

$router->get('/health', fn () => ['status' => 'ok', 'time' => date('c')]);

$router->post('/auth/login', [AuthController::class, 'login']);
$router->post('/auth/logout', [AuthController::class, 'logout'], ['*']);
$router->get('/auth/me', [AuthController::class, 'me'], ['*']);
