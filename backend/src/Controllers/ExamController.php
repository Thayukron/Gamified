<?php
namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Services\ExamService;
use App\Services\LessonPlanService;

/** AI exam questions for the midterm/final week of a course (teacher's own courses only). */
class ExamController
{
    private static function kind(Request $req): string
    {
        $kind = (string) $req->params['kind'];
        if (!in_array($kind, ['midterm', 'final'], true)) {
            throw new HttpException(404, 'ไม่พบหน้านี้');
        }
        return $kind;
    }

    /** GET /teacher/courses/{id}/exam/{kind} — the units (with what each has to draw from) and the saved set. */
    public static function show(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $kind = self::kind($req);
        $stmt = \App\Core\Database::get()->query("SELECT setting_value FROM settings WHERE setting_key = 'institution_name'");
        return [
            'course' => $course,
            'level_higher' => LessonPlanService::isHigher($course),
            'institution' => (string) ($stmt->fetchColumn() ?: ''),
            'units' => array_map(fn ($u) => array_diff_key($u, ['plan' => 1, 'knowledge' => 1]), ExamService::units($course)),
            'set' => ExamService::saved((int) $course['id'], $kind),
            'defaults' => ExamService::DEFAULT_OPTIONS,
        ];
    }

    /** POST /teacher/courses/{id}/exam/{kind}/generate — { units: [no], options } (background job). */
    public static function generate(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $units = array_values(array_unique(array_map('intval', (array) $req->input('units', []))));
        return ExamService::generate((int) $req->user['id'], $course, self::kind($req), $units, ExamService::options($req->input('options', [])));
    }

    /** PUT /teacher/courses/{id}/exam/{kind} — { questions } after the teacher's edits. */
    public static function save(Request $req): array
    {
        $course = TeacherController::course($req, (int) $req->params['id']);
        $kind = self::kind($req);
        $set = ExamService::saved((int) $course['id'], $kind) ?? throw new HttpException(404, 'ยังไม่มีแนวข้อสอบ');
        ExamService::save((int) $course['id'], $kind, $set['units'], $set['options'], ExamService::normalize($req->input('questions', [])), null, (int) $req->user['id']);
        return ['set' => ExamService::saved((int) $course['id'], $kind)];
    }
}
