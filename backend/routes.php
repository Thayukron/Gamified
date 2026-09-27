<?php
/** @var App\Core\Router $router */

use App\Controllers\AuthController;
use App\Controllers\StudentGameController;

$router->get('/health', fn () => ['status' => 'ok', 'time' => date('c')]);

$router->post('/auth/login', [AuthController::class, 'login']);
$router->post('/auth/logout', [AuthController::class, 'logout'], ['*']);
$router->get('/auth/me', [AuthController::class, 'me'], ['*']);

// Student: quests, gameplay (save state + rule-based scoring), results
$router->get('/student/quests', [StudentGameController::class, 'quests'], ['student']);
$router->get('/student/quests/{id}', [StudentGameController::class, 'show'], ['student']);
$router->put('/student/quests/{id}/progress', [StudentGameController::class, 'progress'], ['student']);
$router->post('/student/quests/{id}/complete', [StudentGameController::class, 'complete'], ['student']);
$router->get('/student/results', [StudentGameController::class, 'results'], ['student']);
$router->get('/student/results/{id}', [StudentGameController::class, 'result'], ['student']);
$router->get('/student/profile', [StudentGameController::class, 'profile'], ['student']);
$router->get('/student/player', [StudentGameController::class, 'player'], ['student']);
$router->put('/student/player/avatar', [StudentGameController::class, 'saveAvatar'], ['student']);

// Teacher dashboard (teachers see only their own courses; admins see all)
$router->get('/teacher/courses', [App\Controllers\TeacherController::class, 'courses'], ['teacher', 'admin']);
$router->get('/teacher/courses/{id}/dashboard', [App\Controllers\TeacherController::class, 'dashboard'], ['teacher', 'admin']);
$router->get('/teacher/courses/{id}/guide', [App\Controllers\TeacherController::class, 'guide'], ['teacher', 'admin']);
$router->put('/teacher/courses/{id}/context', [App\Controllers\TeacherController::class, 'saveContext'], ['teacher', 'admin']);
