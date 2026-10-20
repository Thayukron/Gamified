<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;

/** Institution details shown on reports (admin-editable). */
class SettingsController
{
    private const KEYS = ['institution_name', 'institution_affiliation'];

    /** GET /admin/institution */
    public static function institution(Request $req): array
    {
        $rows = Database::get()->query("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'institution_%'")->fetchAll(\PDO::FETCH_KEY_PAIR);
        return ['name' => $rows['institution_name'] ?? '', 'affiliation' => $rows['institution_affiliation'] ?? ''];
    }

    /** GET /admin/term — the current term (used for new courses, quests and the teacher's course list). */
    public static function term(Request $req): array
    {
        return ['semester' => (int) app_config('semester'), 'academic_year' => (int) app_config('academic_year')];
    }

    /** PUT /admin/term — { semester, academic_year } */
    public static function saveTerm(Request $req): array
    {
        $sem = (int) $req->input('semester', 0);
        $year = (int) $req->input('academic_year', 0);
        if ($sem < 1 || $sem > 3) {
            throw new HttpException(422, 'ภาคเรียนต้องเป็น 1, 2 หรือ 3 (ภาคฤดูร้อน)');
        }
        if ($year < 2500 || $year > 2700) {
            throw new HttpException(422, 'ปีการศึกษาต้องเป็นปี พ.ศ. เช่น 2569');
        }
        $set = Database::get()->prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)');
        $set->execute(['term_semester', (string) $sem]);
        $set->execute(['term_academic_year', (string) $year]);
        $GLOBALS['__term'] = ['semester' => $sem, 'academic_year' => $year];
        return self::term($req);
    }

    /** PUT /admin/institution — { name, affiliation } */
    public static function saveInstitution(Request $req): array
    {
        $name = trim((string) $req->input('name', ''));
        if ($name === '') {
            throw new HttpException(422, 'กรุณากรอกชื่อสถานศึกษา');
        }
        $set = Database::get()->prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)');
        $set->execute(['institution_name', mb_substr($name, 0, 150)]);
        $set->execute(['institution_affiliation', mb_substr(trim((string) $req->input('affiliation', '')), 0, 200)]);
        return self::institution($req);
    }
}
