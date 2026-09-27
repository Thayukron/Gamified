<?php
namespace App\Controllers;

use App\Core\Crypto;
use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Services\AiGuideService;
use App\Services\GeminiClient;

/** Personal AI settings (BYOK) and admin AI controls. */
class AiController
{
    /** GET /me/ai */
    public static function status(Request $req): array
    {
        return ['ai' => AiGuideService::status((int) $req->user['id'])];
    }

    /** PUT /me/ai — { api_key, model? } verify then save encrypted. */
    public static function saveKey(Request $req): array
    {
        $res = AiGuideService::saveKey((int) $req->user['id'], (string) $req->input('api_key', ''), $req->input('model'));
        return ['ai' => AiGuideService::status((int) $req->user['id']), 'models' => $res['models']];
    }

    /** POST /me/ai/test */
    public static function test(Request $req): array
    {
        return AiGuideService::testKey((int) $req->user['id']);
    }

    /** PUT /me/ai/model — { model } */
    public static function setModel(Request $req): array
    {
        AiGuideService::setModel((int) $req->user['id'], (string) $req->input('model', ''));
        return ['ai' => AiGuideService::status((int) $req->user['id'])];
    }

    /** DELETE /me/ai */
    public static function removeKey(Request $req): array
    {
        AiGuideService::removeKey((int) $req->user['id']);
        return ['ai' => AiGuideService::status((int) $req->user['id'])];
    }

    // ---------------------------------------------------------------- admin

    private static function settings(): array
    {
        return Database::get()->query("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'ai_%'")->fetchAll(\PDO::FETCH_KEY_PAIR);
    }

    /** GET /admin/ai — global switch, central key status, teachers with key/permission status. */
    public static function adminStatus(Request $req): array
    {
        $s = self::settings();
        $teachers = Database::get()->query(
            "SELECT u.id, u.full_name, u.username, d.name AS department_name,
                    (a.api_key_enc IS NOT NULL) AS has_own_key, a.key_hint, COALESCE(a.central_allowed, 0) AS central_allowed,
                    (SELECT COUNT(*) FROM ai_insights_cache c WHERE c.created_by = u.id) AS ai_requests,
                    (SELECT COALESCE(SUM(c.prompt_tokens + c.output_tokens), 0) FROM ai_insights_cache c WHERE c.created_by = u.id AND c.key_source = 'central') AS central_tokens
               FROM users u
          LEFT JOIN departments d ON d.id = u.department_id
          LEFT JOIN user_ai_settings a ON a.user_id = u.id
              WHERE u.role = 'teacher' ORDER BY u.full_name"
        )->fetchAll();
        return [
            'enabled' => ($s['ai_enabled'] ?? '0') === '1',
            'central' => ['has_key' => !empty($s['ai_central_key_enc']), 'key_hint' => $s['ai_central_key_hint'] ?? null, 'model' => $s['ai_central_model'] ?? null],
            'teachers' => $teachers,
        ];
    }

    /** PUT /admin/ai — { enabled?, central_key? ('' removes) } */
    public static function adminSave(Request $req): array
    {
        $db = Database::get();
        $set = $db->prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)');
        $in = $req->body();
        if (array_key_exists('enabled', $in)) {
            $set->execute(['ai_enabled', $in['enabled'] ? '1' : '0']);
        }
        if (array_key_exists('central_key', $in)) {
            $key = trim((string) $in['central_key']);
            if ($key === '') {
                foreach (['ai_central_key_enc', 'ai_central_key_hint', 'ai_central_model'] as $k) {
                    $set->execute([$k, '']);
                }
            } else {
                $models = (new GeminiClient($key))->listModels();
                if (!$models) {
                    throw new HttpException(422, 'API Key นี้ไม่มีโมเดลที่ใช้สร้างข้อความได้');
                }
                $set->execute(['ai_central_key_enc', Crypto::encrypt($key)]);
                $set->execute(['ai_central_key_hint', Crypto::hint($key)]);
                $set->execute(['ai_central_model', GeminiClient::pickDefault($models)]);
            }
        }
        return self::adminStatus($req);
    }

    /** PUT /admin/ai/teachers/{id} — { central_allowed } */
    public static function adminAllow(Request $req): array
    {
        $uid = (int) $req->params['id'];
        $stmt = Database::get()->prepare("SELECT id FROM users WHERE id = ? AND role = 'teacher'");
        $stmt->execute([$uid]);
        if (!$stmt->fetch()) {
            throw new HttpException(404, 'ไม่พบครูผู้สอน');
        }
        Database::get()->prepare(
            'INSERT INTO user_ai_settings (user_id, central_allowed) VALUES (?, ?) ON DUPLICATE KEY UPDATE central_allowed = VALUES(central_allowed)'
        )->execute([$uid, $req->input('central_allowed') ? 1 : 0]);
        return self::adminStatus($req);
    }
}
