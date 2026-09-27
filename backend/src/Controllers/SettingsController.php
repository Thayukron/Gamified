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
