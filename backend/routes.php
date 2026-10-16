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
// Teachers create their own courses and pick their students (shared student accounts/results)
$router->get('/teacher/meta', [App\Controllers\TeacherCourseController::class, 'meta'], ['teacher', 'admin']);
$router->post('/teacher/courses', [App\Controllers\TeacherCourseController::class, 'create'], ['teacher', 'admin']);
$router->put('/teacher/courses/{id}', [App\Controllers\TeacherCourseController::class, 'update'], ['teacher', 'admin']);
$router->delete('/teacher/courses/{id}', [App\Controllers\TeacherCourseController::class, 'delete'], ['teacher', 'admin']);
$router->get('/teacher/courses/{id}/students', [App\Controllers\TeacherCourseController::class, 'roster'], ['teacher', 'admin']);
$router->post('/teacher/courses/{id}/students', [App\Controllers\TeacherCourseController::class, 'add'], ['teacher', 'admin']);
$router->delete('/teacher/courses/{id}/students/{sid}', [App\Controllers\TeacherCourseController::class, 'remove'], ['teacher', 'admin']);
$router->get('/teacher/students', [App\Controllers\TeacherCourseController::class, 'search'], ['teacher', 'admin']);
$router->post('/teacher/courses/{id}/students/{sid}/reset-password', [App\Controllers\TeacherCourseController::class, 'resetPassword'], ['teacher', 'admin']);

// Own account (any role) + public "forgot password" request
$router->get('/me/profile', [App\Controllers\AccountController::class, 'profile'], ['*']);
$router->put('/me/profile', [App\Controllers\AccountController::class, 'updateProfile'], ['*']);
$router->put('/me/password', [App\Controllers\AccountController::class, 'changePassword'], ['*']);
$router->post('/auth/forgot', [App\Controllers\AccountController::class, 'forgot']);
// Unit lesson plans in the OVEC 2567 form (Word export happens in the browser)
$router->get('/teacher/courses/{id}/plans', [App\Controllers\LessonPlanController::class, 'index'], ['teacher', 'admin']);
$router->get('/teacher/courses/{id}/plans/full', [App\Controllers\LessonPlanController::class, 'full'], ['teacher', 'admin']);
$router->post('/teacher/courses/{id}/plans', [App\Controllers\LessonPlanController::class, 'create'], ['teacher', 'admin']);
$router->get('/teacher/courses/{id}/book', [App\Controllers\LessonPlanController::class, 'book'], ['teacher', 'admin']);
$router->put('/teacher/courses/{id}/book', [App\Controllers\LessonPlanController::class, 'saveBook'], ['teacher', 'admin']);
$router->post('/teacher/courses/{id}/book/draft', [App\Controllers\LessonPlanController::class, 'bookDraft'], ['teacher', 'admin']);
$router->get('/teacher/plans/{pid}/sheets', [App\Controllers\LessonPlanController::class, 'sheets'], ['teacher', 'admin']);
$router->post('/teacher/plans/{pid}/sheets', [App\Controllers\LessonPlanController::class, 'createSheet'], ['teacher', 'admin']);
$router->get('/teacher/sheets/{sid}', [App\Controllers\LessonPlanController::class, 'showSheet'], ['teacher', 'admin']);
$router->put('/teacher/sheets/{sid}', [App\Controllers\LessonPlanController::class, 'updateSheet'], ['teacher', 'admin']);
$router->delete('/teacher/sheets/{sid}', [App\Controllers\LessonPlanController::class, 'deleteSheet'], ['teacher', 'admin']);
$router->post('/teacher/sheets/{sid}/draft', [App\Controllers\LessonPlanController::class, 'draftSheet'], ['teacher', 'admin']);
$router->get('/teacher/plans/{pid}', [App\Controllers\LessonPlanController::class, 'show'], ['teacher', 'admin']);
$router->put('/teacher/plans/{pid}', [App\Controllers\LessonPlanController::class, 'update'], ['teacher', 'admin']);
$router->delete('/teacher/plans/{pid}', [App\Controllers\LessonPlanController::class, 'delete'], ['teacher', 'admin']);
$router->post('/teacher/plans/{pid}/draft', [App\Controllers\LessonPlanController::class, 'draft'], ['teacher', 'admin']);
$router->get('/teacher/courses/{id}/dashboard', [App\Controllers\TeacherController::class, 'dashboard'], ['teacher', 'admin']);
$router->get('/teacher/courses/{id}/guide', [App\Controllers\TeacherController::class, 'guide'], ['teacher', 'admin']);
$router->put('/teacher/courses/{id}/context', [App\Controllers\TeacherController::class, 'saveContext'], ['teacher', 'admin']);
$router->get('/teacher/courses/{id}/ai', [App\Controllers\TeacherController::class, 'aiCached'], ['teacher', 'admin']);
$router->get('/teacher/courses/{id}/ai/all', [App\Controllers\TeacherController::class, 'aiAll'], ['teacher', 'admin']);
$router->post('/teacher/courses/{id}/ai', [App\Controllers\TeacherController::class, 'aiGenerate'], ['teacher', 'admin']);

// AI settings: each teacher brings their own Gemini key (BYOK); admin controls the global switch and optional central key
$router->get('/me/ai', [App\Controllers\AiController::class, 'status'], ['teacher', 'admin']);
$router->put('/me/ai', [App\Controllers\AiController::class, 'saveKey'], ['teacher', 'admin']);
$router->post('/me/ai/test', [App\Controllers\AiController::class, 'test'], ['teacher', 'admin']);
$router->put('/me/ai/model', [App\Controllers\AiController::class, 'setModel'], ['teacher', 'admin']);
$router->delete('/me/ai', [App\Controllers\AiController::class, 'removeKey'], ['teacher', 'admin']);
$router->get('/admin/ai', [App\Controllers\AiController::class, 'adminStatus'], ['admin']);
$router->put('/admin/ai', [App\Controllers\AiController::class, 'adminSave'], ['admin']);
$router->put('/admin/ai/teachers/{id}', [App\Controllers\AiController::class, 'adminAllow'], ['admin']);
$router->post('/teacher/courses/{id}/groups/preview', [App\Controllers\TeacherController::class, 'groupsPreview'], ['teacher', 'admin']);
$router->get('/teacher/courses/{id}/groups', [App\Controllers\TeacherController::class, 'groupsSaved'], ['teacher', 'admin']);
$router->put('/teacher/courses/{id}/groups', [App\Controllers\TeacherController::class, 'groupsSave'], ['teacher', 'admin']);
$router->get('/teacher/courses/{id}/report', [App\Controllers\TeacherController::class, 'report'], ['teacher', 'admin']);
$router->get('/admin/institution', [App\Controllers\SettingsController::class, 'institution'], ['admin']);
$router->put('/admin/institution', [App\Controllers\SettingsController::class, 'saveInstitution'], ['admin']);

// Admin: bulk import + master data
$router->post('/admin/import/preview', [App\Controllers\AdminController::class, 'importPreview'], ['admin']);
$router->post('/admin/import/commit', [App\Controllers\AdminController::class, 'importCommit'], ['admin']);
$router->get('/admin/overview', [App\Controllers\AdminController::class, 'overview'], ['admin']);
$router->get('/admin/users', [App\Controllers\AdminController::class, 'users'], ['admin']);
$router->post('/admin/users/{id}/reset-password', [App\Controllers\AdminController::class, 'resetPassword'], ['admin']);
$router->put('/admin/users/{id}', [App\Controllers\AdminController::class, 'updateUser'], ['admin']);
$router->get('/admin/reset-requests', [App\Controllers\AdminController::class, 'resetRequests'], ['admin']);
$router->post('/admin/reset-requests/{id}/dismiss', [App\Controllers\AdminController::class, 'dismissRequest'], ['admin']);
$router->delete('/admin/courses/{id}', [App\Controllers\AdminController::class, 'deleteCourse'], ['admin']);
