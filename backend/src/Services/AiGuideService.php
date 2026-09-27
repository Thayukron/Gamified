<?php
namespace App\Services;

use App\Core\Crypto;
use App\Core\Database;
use App\Core\HttpException;

/**
 * AI-enriched teaching guidance (Gemini, BYOK).
 * - Called only when a teacher presses the button; results are cached per course/type/topic.
 * - Sends class statistics and course context only — never student names or codes (PDPA).
 * - Uses the teacher's own key; the central key only if an admin allowed that teacher.
 */
class AiGuideService
{
    public const TYPES = ['course', 'unit'];

    private static function setting(string $key): ?string
    {
        $stmt = Database::get()->prepare('SELECT setting_value FROM settings WHERE setting_key = ?');
        $stmt->execute([$key]);
        $v = $stmt->fetchColumn();
        return $v === false ? null : $v;
    }

    public static function enabled(): bool
    {
        return self::setting('ai_enabled') === '1';
    }

    public static function userSettings(int $userId): array
    {
        $stmt = Database::get()->prepare('SELECT * FROM user_ai_settings WHERE user_id = ?');
        $stmt->execute([$userId]);
        return $stmt->fetch() ?: ['user_id' => $userId, 'api_key_enc' => null, 'key_hint' => null, 'model' => null, 'central_allowed' => 0, 'verified_at' => null];
    }

    /** Which key/model this user would use right now: ['source' => own|central|null, ...]. */
    public static function resolve(int $userId): array
    {
        $s = self::userSettings($userId);
        if ($s['api_key_enc'] && ($key = Crypto::decrypt($s['api_key_enc']))) {
            return ['source' => 'own', 'key' => $key, 'model' => $s['model']];
        }
        $central = Crypto::decrypt(self::setting('ai_central_key_enc'));
        if ((int) $s['central_allowed'] === 1 && $central) {
            return ['source' => 'central', 'key' => $central, 'model' => self::setting('ai_central_model')];
        }
        return ['source' => null, 'key' => null, 'model' => null];
    }

    /** Public status for the UI (never includes the key itself). */
    public static function status(int $userId): array
    {
        $s = self::userSettings($userId);
        return [
            'enabled' => self::enabled(),
            'provider' => 'gemini',
            'has_own_key' => (bool) $s['api_key_enc'],
            'key_hint' => $s['key_hint'],
            'model' => $s['model'],
            'verified_at' => $s['verified_at'],
            'central_allowed' => (int) $s['central_allowed'] === 1 && (bool) self::setting('ai_central_key_enc'),
            'active_source' => self::resolve($userId)['source'],
        ];
    }

    /** Verify a key by listing models, then store it encrypted with a default model. */
    public static function saveKey(int $userId, string $key, ?string $model): array
    {
        $key = trim($key);
        if (strlen($key) < 20 || preg_match('/\s/', $key)) { // Google keys: legacy "AIza…" or newer "AQ.…"
            throw new HttpException(422, 'รูปแบบ API Key ไม่ถูกต้อง');
        }
        $models = (new GeminiClient($key))->listModels();
        if (!$models) {
            throw new HttpException(422, 'API Key นี้ไม่มีโมเดลที่ใช้สร้างข้อความได้');
        }
        $chosen = $model && in_array($model, $models, true) ? $model : GeminiClient::pickDefault($models);
        Database::get()->prepare(
            'INSERT INTO user_ai_settings (user_id, provider, api_key_enc, key_hint, model, verified_at)
             VALUES (?, \'gemini\', ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE api_key_enc = VALUES(api_key_enc), key_hint = VALUES(key_hint),
                                     model = VALUES(model), verified_at = NOW()'
        )->execute([$userId, Crypto::encrypt($key), Crypto::hint($key), $chosen]);
        return ['models' => $models, 'model' => $chosen];
    }

    /** Re-test the stored key and return the model list (for the model picker). */
    public static function testKey(int $userId): array
    {
        $r = self::resolve($userId);
        if (!$r['key']) {
            throw new HttpException(409, 'ยังไม่ได้กรอก API Key');
        }
        $models = (new GeminiClient($r['key']))->listModels();
        if ($r['source'] === 'own') {
            Database::get()->prepare('UPDATE user_ai_settings SET verified_at = NOW() WHERE user_id = ?')->execute([$userId]);
        }
        return ['ok' => true, 'models' => $models, 'model' => $r['model'], 'source' => $r['source']];
    }

    public static function setModel(int $userId, string $model): void
    {
        $r = self::resolve($userId);
        if ($r['source'] !== 'own') {
            throw new HttpException(409, 'เลือกรุ่นได้เมื่อใช้ API Key ของตนเอง');
        }
        if (!in_array($model, (new GeminiClient($r['key']))->listModels(), true)) {
            throw new HttpException(422, 'API Key นี้ใช้รุ่นดังกล่าวไม่ได้');
        }
        Database::get()->prepare('UPDATE user_ai_settings SET model = ? WHERE user_id = ?')->execute([$model, $userId]);
    }

    public static function removeKey(int $userId): void
    {
        Database::get()->prepare('UPDATE user_ai_settings SET api_key_enc = NULL, key_hint = NULL, model = NULL, verified_at = NULL WHERE user_id = ?')
            ->execute([$userId]);
    }

    // ------------------------------------------------------------------ generation

    private static function cacheKey(int $courseId, string $type, ?string $topic): string
    {
        return hash('sha256', "$courseId|$type|" . ($topic ?? ''));
    }

    /** Anonymous class statistics + course context that the AI sees (and that the cache fingerprints). */
    public static function context(array $course, array $dash): array
    {
        $round = fn ($arr) => array_map(fn ($v) => round($v), $arr);
        $n = max(1, $dash['summary']['profiled']);
        return [
            'course' => [
                'name' => $course['name'],
                'code' => $course['code'],
                'department' => $course['department_name'],
                'level' => $course['level'],
                'type' => ['theory' => 'ทฤษฎี', 'practice' => 'ปฏิบัติ', 'mixed' => 'ทฤษฎี+ปฏิบัติ'][$course['course_type']] ?? 'ทฤษฎี+ปฏิบัติ',
                'topics' => json_decode($course['topics'] ?? '[]', true) ?: [],
                'note' => $course['context_note'],
            ],
            'class' => [
                'students_profiled' => $dash['summary']['profiled'],
                'vark_percent' => $round($dash['average']['vark']),
                'riasec_percent' => $round($dash['average']['riasec']),
                'mindset_percent' => array_map(fn ($c) => round($c / $n * 100), $dash['distribution']['mindset']),
            ],
        ];
    }

    public static function fingerprint(array $ctx, ?string $topic): string
    {
        return hash('sha256', json_encode([$ctx, $topic], JSON_UNESCAPED_UNICODE));
    }

    /** Cached result for this slot (or null), flagged stale if class data/context changed since. */
    public static function cached(array $course, array $dash, string $type, ?string $topic): ?array
    {
        $stmt = Database::get()->prepare('SELECT * FROM ai_insights_cache WHERE cache_key = ?');
        $stmt->execute([self::cacheKey((int) $course['id'], $type, $topic)]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        return [
            'type' => $row['insight_type'],
            'topic' => $row['topic'],
            'data' => json_decode($row['response'], true),
            'model' => $row['model'],
            'key_source' => $row['key_source'],
            'tokens' => ['prompt' => $row['prompt_tokens'], 'output' => $row['output_tokens']],
            'created_at' => $row['created_at'],
            'stale' => $row['fingerprint'] !== self::fingerprint(self::context($course, $dash), $topic),
        ];
    }

    /** Call Gemini (only on an explicit request) and store the result. */
    public static function generate(int $userId, array $course, array $dash, string $type, ?string $topic): array
    {
        if (!self::enabled()) {
            throw new HttpException(403, 'ผู้ดูแลระบบปิดการใช้งานฟังก์ชัน AI อยู่');
        }
        if (!in_array($type, self::TYPES, true)) {
            throw new HttpException(422, 'ประเภทคำขอไม่ถูกต้อง');
        }
        if ($dash['summary']['profiled'] === 0) {
            throw new HttpException(409, 'ยังไม่มีผู้เรียนเล่นเกม จึงยังวิเคราะห์ไม่ได้');
        }
        $ctx = self::context($course, $dash);
        if ($type === 'unit' && !in_array($topic, $ctx['course']['topics'], true)) {
            throw new HttpException(422, 'ไม่พบหัวข้อนี้ในรายวิชา');
        }
        $r = self::resolve($userId);
        if (!$r['key']) {
            throw new HttpException(409, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อนใช้ฟังก์ชันนี้');
        }
        $model = $r['model'] ?: 'gemini-flash-latest';
        set_time_limit(300); // retries + fallbacks can exceed the default 30s

        [$system, $prompt] = $type === 'course' ? self::coursePrompt($ctx) : self::unitPrompt($ctx, $topic);
        $res = (new GeminiClient($r['key']))->generateJsonResilient($model, $system, $prompt);
        $model = $res['model']; // may be a fallback if the preferred model was overloaded
        $data = $type === 'course' ? self::normalizeCourse($res['data']) : self::normalizeUnit($res['data']);

        Database::get()->prepare(
            'INSERT INTO ai_insights_cache (course_id, cache_key, fingerprint, insight_type, topic, prompt, response, provider, model, key_source, prompt_tokens, output_tokens, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, \'gemini\', ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE fingerprint = VALUES(fingerprint), prompt = VALUES(prompt), response = VALUES(response),
                model = VALUES(model), key_source = VALUES(key_source), prompt_tokens = VALUES(prompt_tokens),
                output_tokens = VALUES(output_tokens), created_by = VALUES(created_by), created_at = NOW()'
        )->execute([
            $course['id'], self::cacheKey((int) $course['id'], $type, $topic), self::fingerprint($ctx, $topic), $type, $topic,
            $prompt, json_encode($data, JSON_UNESCAPED_UNICODE), $model, $r['source'], $res['prompt_tokens'], $res['output_tokens'], $userId,
        ]);
        return self::cached($course, $dash, $type, $topic);
    }

    // ------------------------------------------------------------------ prompts

    private const SYSTEM = 'คุณเป็นผู้เชี่ยวชาญด้านการออกแบบการเรียนการสอนระดับอาชีวศึกษาของไทย ให้คำแนะนำที่นำไปใช้ได้จริงในห้องเรียน เจาะจงกับเนื้อหาวิชา ใช้ภาษาไทยที่กระชับ สุภาพ '
        . 'ยึดหลักการสอนที่มีหลักฐานวิจัยรองรับ (Worked Examples, Retrieval Practice, Dual Coding, Active Learning) '
        . 'ใช้ข้อมูล VARK เป็นข้อมูลประกอบการเลือกสื่อเพื่อเพิ่มการมีส่วนร่วม ไม่ใช่การจำกัดให้สอนแบบเดียว '
        . 'แนะนำเครื่องมือ/เว็บไซต์ที่มีอยู่จริงและใช้ได้ฟรีหรือหาได้ในวิทยาลัยเท่านั้น ห้ามแต่งชื่อเครื่องมือขึ้นเอง '
        . 'ตอบเป็น JSON ตามโครงสร้างที่กำหนดเท่านั้น';

    private static function contextText(array $ctx): string
    {
        return "ข้อมูลรายวิชาและผู้เรียน (สถิติรวมทั้งห้อง ไม่มีข้อมูลรายบุคคล):\n" . json_encode($ctx, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
            . "\n\nความหมาย: vark_percent V=การเห็นภาพ A=การฟัง R=การอ่านเขียน K=การลงมือทำ · riasec_percent R=ปฏิบัติ I=วิเคราะห์ A=สร้างสรรค์ S=ช่วยเหลือ E=ริเริ่ม C=จัดระบบ · mindset_percent growth/mixed/fixed";
    }

    private static function coursePrompt(array $ctx): array
    {
        $prompt = self::contextText($ctx) . <<<'TXT'


จงวิเคราะห์และให้ไกด์การจัดการเรียนการสอน “ทั้งรายวิชา” สำหรับห้องนี้ ตอบเป็น JSON:
{
  "overview": "สรุปลักษณะผู้เรียนห้องนี้และทิศทางการสอนวิชานี้ 3-4 ประโยค",
  "strategies": [ { "title": "ชื่อกลยุทธ์", "detail": "ทำอย่างไรในวิชานี้ ยกตัวอย่างเนื้อหาจริง", "for": "ทั้งห้อง หรือ กลุ่มที่เหมาะ เช่น ผู้เรียนสายลงมือทำ" } ],
  "tools": [ { "name": "ชื่อสื่อ/เครื่องมือ/เว็บไซต์ที่มีอยู่จริง", "use": "ใช้กับหัวข้อไหน อย่างไร" } ],
  "misconceptions": [ { "topic": "หัวข้อ", "issue": "ความเข้าใจผิดที่พบบ่อย", "fix": "วิธีแก้ในห้องเรียน" } ],
  "assessment": [ "วิธีวัดผลที่เหมาะกับผู้เรียนห้องนี้" ],
  "fixed_mindset": "แนวทางดูแลผู้เรียน Fixed Mindset ในวิชานี้โดยเฉพาะ"
}
strategies 4-6 ข้อ, tools 4-6 ข้อ, misconceptions 3-5 ข้อ, assessment 3-4 ข้อ
TXT;
        return [self::SYSTEM, $prompt];
    }

    private static function unitPrompt(array $ctx, string $topic): array
    {
        $prompt = self::contextText($ctx) . "\n\nจงออกแบบแผนการสอนหน่วย “{$topic}” 1 คาบ (ประมาณ 2-3 ชั่วโมง) ให้เหมาะกับผู้เรียนห้องนี้ ตอบเป็น JSON:\n" . <<<'TXT'
{
  "objective": "จุดประสงค์การเรียนรู้ 1-2 ประโยค วัดผลได้",
  "duration_minutes": 150,
  "steps": [ { "phase": "ขั้นนำ/ขั้นสอน/ขั้นฝึก/ขั้นสรุป ฯลฯ", "minutes": 15, "activity": "ครูและผู้เรียนทำอะไร เจาะจงเนื้อหา", "styles": ["V","K"] } ],
  "materials": [ "สื่อ/อุปกรณ์/เว็บไซต์ที่มีอยู่จริง" ],
  "differentiation": { "V": "ปรับสำหรับผู้เรียนสายภาพ", "A": "…สายฟัง", "R": "…สายอ่านเขียน", "K": "…สายลงมือทำ" },
  "fixed_mindset_support": "วิธีช่วยผู้เรียน Fixed Mindset ในหน่วยนี้",
  "check_questions": [ "คำถามทบทวน/ควิซสั้นท้ายคาบ" ]
}
steps 4-7 ขั้น (รวมเวลาเท่ากับ duration_minutes), check_questions 3-5 ข้อ, styles ใช้ได้เฉพาะ V A R K
TXT;
        return [self::SYSTEM, $prompt];
    }

    // ------------------------------------------------------------------ output hygiene

    private static function str(mixed $v, int $max = 600): string
    {
        return is_scalar($v) ? mb_substr(trim((string) $v), 0, $max) : '';
    }

    private static function list(mixed $v, int $maxItems = 8): array
    {
        return is_array($v) ? array_slice(array_values($v), 0, $maxItems) : [];
    }

    private static function normalizeCourse(array $d): array
    {
        return [
            'overview' => self::str($d['overview'] ?? '', 1200),
            'strategies' => array_map(fn ($s) => ['title' => self::str($s['title'] ?? '', 120), 'detail' => self::str($s['detail'] ?? ''), 'for' => self::str($s['for'] ?? '', 120)], self::list($d['strategies'] ?? [])),
            'tools' => array_map(fn ($s) => ['name' => self::str($s['name'] ?? '', 120), 'use' => self::str($s['use'] ?? '')], self::list($d['tools'] ?? [])),
            'misconceptions' => array_map(fn ($s) => ['topic' => self::str($s['topic'] ?? '', 100), 'issue' => self::str($s['issue'] ?? ''), 'fix' => self::str($s['fix'] ?? '')], self::list($d['misconceptions'] ?? [])),
            'assessment' => array_map(fn ($s) => self::str($s), self::list($d['assessment'] ?? [])),
            'fixed_mindset' => self::str($d['fixed_mindset'] ?? '', 800),
        ];
    }

    private static function normalizeUnit(array $d): array
    {
        $diff = is_array($d['differentiation'] ?? null) ? $d['differentiation'] : [];
        return [
            'objective' => self::str($d['objective'] ?? '', 500),
            'duration_minutes' => (int) ($d['duration_minutes'] ?? 0),
            'steps' => array_map(fn ($s) => [
                'phase' => self::str($s['phase'] ?? '', 60),
                'minutes' => (int) ($s['minutes'] ?? 0),
                'activity' => self::str($s['activity'] ?? '', 800),
                'styles' => array_values(array_intersect(['V', 'A', 'R', 'K'], array_map('strtoupper', (array) ($s['styles'] ?? [])))),
            ], self::list($d['steps'] ?? [], 10)),
            'materials' => array_map(fn ($s) => self::str($s, 200), self::list($d['materials'] ?? [])),
            'differentiation' => ['V' => self::str($diff['V'] ?? ''), 'A' => self::str($diff['A'] ?? ''), 'R' => self::str($diff['R'] ?? ''), 'K' => self::str($diff['K'] ?? '')],
            'fixed_mindset_support' => self::str($d['fixed_mindset_support'] ?? ''),
            'check_questions' => array_map(fn ($s) => self::str($s, 300), self::list($d['check_questions'] ?? [])),
        ];
    }
}
