<?php
namespace App\Services;

use App\Core\HttpException;

/**
 * Minimal Gemini REST client (models.list + generateContent).
 * The API key goes in the x-goog-api-key header, never in the URL.
 */
class GeminiClient
{
    public function __construct(private string $apiKey) {}

    private function request(string $method, string $path, ?array $body = null, ?int $timeout = null): array
    {
        $cfg = app_config('gemini');
        $ch = curl_init(rtrim($cfg['base_url'], '/') . $path);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout ?? $cfg['timeout'],
            CURLOPT_CONNECTTIMEOUT => 15, // a blocked network should fail fast, not after the full timeout
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $this->apiKey],
            CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE),
        ]);
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        $errno = curl_errno($ch);
        $connected = curl_getinfo($ch, CURLINFO_CONNECT_TIME) > 0;
        curl_close($ch);

        if ($raw === false) {
            // never reached Google at all: usually an organization firewall blocking *.googleapis.com
            if (!$connected && in_array($errno, [CURLE_OPERATION_TIMEDOUT, CURLE_COULDNT_CONNECT, CURLE_COULDNT_RESOLVE_HOST], true)) {
                throw new HttpException(502, 'เซิร์ฟเวอร์ของระบบเชื่อมต่อ Google Gemini ไม่ได้ — เครือข่ายที่เครื่องเซิร์ฟเวอร์ใช้อยู่อาจบล็อก generativelanguage.googleapis.com (พบบ่อยในเครือข่ายสถานศึกษา) ไม่ใช่ปัญหาที่ API Key · ลองให้เครื่องเซิร์ฟเวอร์ใช้เครือข่ายอื่น หรือขอผู้ดูแลเครือข่ายเปิดโดเมนนี้');
            }
            // reached Google but the model never answered (happens to the newest models under load)
            if ($connected && $errno === CURLE_OPERATION_TIMEDOUT) {
                throw new HttpException(504, 'Gemini รุ่นนี้ไม่ตอบสนองภายในเวลาที่กำหนด (เซิร์ฟเวอร์ของ Google ไม่ว่าง) — ระบบจะใช้รุ่นสำรองให้อัตโนมัติ กรุณากดใหม่อีกครั้ง');
            }
            throw new HttpException(502, "เชื่อมต่อ Gemini ไม่ได้: $err");
        }
        $json = json_decode($raw, true) ?? [];
        if ($status >= 400) {
            throw new HttpException(self::statusFor($status), self::explain($status, $json['error']['message'] ?? ''));
        }
        return $json;
    }

    private static function statusFor(int $status): int
    {
        // 401/403 from Google means the key is wrong — a user-fixable 422, not our auth failure.
        return in_array($status, [400, 401, 403], true) ? 422 : (in_array($status, [429, 404], true) ? $status : 503);
    }

    private static function explain(int $status, string $msg): string
    {
        return match (true) {
            $status === 400 && str_contains($msg, 'API key') => 'API Key ไม่ถูกต้อง — ตรวจสอบว่าคัดลอกมาครบ',
            in_array($status, [401, 403], true) => 'API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้ Gemini API',
            $status === 429 => 'ใช้งาน Gemini เกินโควตาของ API Key นี้ — รอสักครู่แล้วลองใหม่ (ระบบยังใช้ไกด์แบบกฎได้ตามปกติ)',
            $status === 404 => 'ไม่พบรุ่นโมเดลนี้ — กดทดสอบการเชื่อมต่อใหม่เพื่อเลือกรุ่นที่ใช้ได้',
            in_array($status, [500, 503], true) => 'ขณะนี้ Google Gemini มีผู้ใช้งานหนาแน่น (เซิร์ฟเวอร์ของ Google ไม่ว่าง) ระบบลองใหม่และลองรุ่นสำรองแล้วแต่ยังไม่สำเร็จ — กรุณารอ 1–2 นาทีแล้วกดใหม่ (ไกด์แบบกฎยังใช้ได้ตามปกติ)',
            default => "Gemini ตอบกลับผิดพลาด ($status): " . mb_substr($msg, 0, 200),
        };
    }

    /** Models this key can call with generateContent, e.g. ["gemini-3.8-flash", ...]. */
    public function listModels(): array
    {
        $models = [];
        $token = null;
        do {
            $res = $this->request('GET', '/models?pageSize=200' . ($token ? '&pageToken=' . urlencode($token) : ''));
            foreach ($res['models'] ?? [] as $m) {
                if (in_array('generateContent', $m['supportedGenerationMethods'] ?? [], true)) {
                    $models[] = substr($m['name'], strlen('models/'));
                }
            }
            $token = $res['nextPageToken'] ?? null;
        } while ($token);
        return $models;
    }

    /**
     * Text-generation candidates in preference order: stable "flash" models newest first,
     * then "flash-lite" models. Excludes speech/image/embedding/preview variants.
     */
    public static function rank(array $models): array
    {
        $skip = '/(tts|image|audio|live|embedding|vision|preview|exp|thinking|aqa|learnlm|robotics|computer)/i';
        $version = fn (string $m): float => preg_match('/gemini-(\d+(?:\.\d+)?)/', $m, $v) ? (float) $v[1] : 0;
        $sort = function (array $list) use ($version): array {
            usort($list, fn ($a, $b) => [$version($b), -strlen($b)] <=> [$version($a), -strlen($a)]);
            return $list;
        };
        $usable = array_filter($models, fn ($m) => str_contains($m, 'flash') && !preg_match($skip, $m));
        $flash = $sort(array_filter($usable, fn ($m) => !str_contains($m, 'lite')));
        $lite = $sort(array_filter($usable, fn ($m) => str_contains($m, 'lite')));
        return array_values([...$flash, ...$lite]);
    }

    /** Default model: the newest stable flash (fast and inexpensive — ideal for text guidance). */
    public static function pickDefault(array $models): ?string
    {
        return self::rank($models)[0] ?? ($models[0] ?? null);
    }

    /**
     * generateJson with resilience against Google-side overload:
     * retry the chosen model briefly on 500/503, then fall back to other models this key can use.
     * $search = ground the answer in Google Search results (sources are returned in 'sources').
     * @return array{data: array, prompt_tokens: ?int, output_tokens: ?int, model: string, sources: array}
     */
    public function generateJsonResilient(string $preferred, string $system, string $prompt, int $maxFallbacks = 2, int $maxTokens = 8192, bool $search = false): array
    {
        $candidates = [$preferred];
        $lastError = null;
        $fallbacksLoaded = false;
        $slow = self::slowModels();
        if (isset($slow[$preferred])) {
            // the chosen model hung recently: start with models that answer, keep the slow ones last
            $fallbacksLoaded = true;
            $all = [$preferred, ...array_values(array_diff(self::rank($this->listModels()), [$preferred]))];
            $candidates = [...array_values(array_filter($all, fn ($m) => !isset($slow[$m]))), ...array_values(array_filter($all, fn ($m) => isset($slow[$m])))];
        }
        for ($i = 0; $i < count($candidates) && $i <= $maxFallbacks + 2; $i++) {
            $model = $candidates[$i];
            // a long answer gives no sign of life until it is complete, so check first that the model answers
            // at all (~1–2 s, a few tokens) instead of waiting the full timeout on a hung model
            if (!$this->alive($model)) {
                self::markSlow($model);
                $lastError = new HttpException(504, 'Gemini รุ่นล่าสุดไม่ตอบสนองในขณะนี้ (เซิร์ฟเวอร์ของ Google ไม่ว่าง) — กรุณารอ 1–2 นาทีแล้วกดใหม่ (ไกด์แบบกฎยังใช้ได้ตามปกติ)');
                if (!$fallbacksLoaded) {
                    $fallbacksLoaded = true;
                    $slow = self::slowModels();
                    $candidates = [$preferred, ...array_values(array_filter(array_diff(self::rank($this->listModels()), [$preferred]), fn ($m) => !isset($slow[$m])))];
                }
                continue;
            }
            foreach ([0, 2, 5] as $attempt => $wait) {
                if ($wait) {
                    sleep($wait);
                }
                try {
                    return $this->generateJson($model, $system, $prompt, $maxTokens, $search) + ['model' => $model];
                } catch (HttpException $e) {
                    $lastError = $e;
                    // long answers occasionally come back as broken JSON — one more try usually succeeds
                    $broken = $e->status === 502 && str_contains($e->getMessage(), 'อ่านไม่ได้');
                    if ($broken && $attempt === 0) {
                        continue;
                    }
                    if ($e->status === 504) {
                        self::markSlow($model); // hung: don't wait on it again for a while
                        break;
                    }
                    if ($broken) {
                        break; // broken twice on this model: let another model try
                    }
                    $overloaded = $e->status === 503 || $e->status === 429 || str_contains($e->getMessage(), 'ไม่พบรุ่น');
                    if (!$overloaded) {
                        throw $e; // bad key, bad output, etc. — retrying won't help
                    }
                    if ($e->status === 429 || str_contains($e->getMessage(), 'ไม่พบรุ่น')) {
                        break; // quota/404 are per-model: go straight to the next model
                    }
                }
            }
            if (!$fallbacksLoaded) {
                $fallbacksLoaded = true;
                $candidates = [$preferred, ...array_values(array_diff(self::rank($this->listModels()), [$preferred]))];
            }
        }
        throw $lastError;
    }

    /** Tiny request with a short timeout: false when the model is hung (errors other than a timeout count as alive). */
    private function alive(string $model): bool
    {
        try {
            $this->request('POST', '/models/' . rawurlencode($model) . ':generateContent', [
                'contents' => [['role' => 'user', 'parts' => [['text' => 'ok']]]],
                'generationConfig' => ['maxOutputTokens' => 1],
            ], 12);
            return true;
        } catch (HttpException $e) {
            return $e->status !== 504;
        }
    }

    /** Models that timed out recently (shared by every teacher): model => unix time until which to avoid it. */
    private const SLOW_KEY = 'gemini_slow_models'; // not 'ai_*': those are the admin's AI settings
    private const SLOW_MINUTES = 15;

    private static function slowModels(): array
    {
        try {
            $stmt = \App\Core\Database::get()->prepare('SELECT setting_value FROM settings WHERE setting_key = ?');
            $stmt->execute([self::SLOW_KEY]);
            $all = json_decode((string) $stmt->fetchColumn(), true) ?: [];
        } catch (\Throwable) {
            return [];
        }
        return array_filter($all, fn ($until) => $until > time());
    }

    private static function markSlow(string $model): void
    {
        try {
            $all = self::slowModels() + [$model => time() + self::SLOW_MINUTES * 60];
            \App\Core\Database::get()->prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)')
                ->execute([self::SLOW_KEY, json_encode($all)]);
        } catch (\Throwable) {
            // best effort only
        }
    }

    /**
     * Generate a JSON response.
     * @return array{data: array, prompt_tokens: ?int, output_tokens: ?int}
     */
    public function generateJson(string $model, string $system, string $prompt, int $maxTokens = 8192, bool $search = false): array
    {
        $body = [
            'systemInstruction' => ['parts' => [['text' => $system]]],
            'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                'temperature' => 0.7,
                'maxOutputTokens' => $maxTokens, // long Thai documents need more than the default
            ],
        ];
        if ($search) {
            // Google Search grounding: JSON mode can't be combined with tools, so the prompt asks for JSON text
            $body['tools'] = [['google_search' => new \stdClass()]];
            unset($body['generationConfig']['responseMimeType']);
            $body['generationConfig']['temperature'] = 0.2;
        }
        $res = $this->request('POST', '/models/' . rawurlencode($model) . ':generateContent', $body);

        $candidate = $res['candidates'][0] ?? null;
        $text = implode('', array_map(fn ($p) => $p['text'] ?? '', $candidate['content']['parts'] ?? []));
        if ($text === '') {
            $why = $candidate['finishReason'] ?? ($res['promptFeedback']['blockReason'] ?? 'ไม่ทราบสาเหตุ');
            throw new HttpException(502, "Gemini ไม่ได้ส่งคำตอบกลับมา ($why)");
        }
        // Tolerate a fenced block even though JSON mode is requested.
        $text = preg_replace('/^\s*```(?:json)?\s*|\s*```\s*$/', '', $text);
        if ($search && ($a = strpos($text, '{')) !== false && ($b = strrpos($text, '}')) !== false) {
            $text = substr($text, $a, $b - $a + 1); // grounded answers may wrap the JSON in prose
        }
        $data = json_decode($text, true);
        if (!is_array($data)) {
            error_log('Gemini JSON parse failed: finish=' . ($candidate['finishReason'] ?? '?') . ' error=' . json_last_error_msg()
                . ' len=' . strlen($text) . ' tail=' . substr($text, -300));
            $reason = ($candidate['finishReason'] ?? '') === 'MAX_TOKENS' ? 'คำตอบยาวเกินกำหนด' : 'รูปแบบคำตอบไม่ถูกต้อง';
            throw new HttpException(502, "Gemini ตอบกลับมาแต่อ่านไม่ได้ ($reason) — ลองกดสร้างใหม่อีกครั้ง");
        }
        return [
            'data' => $data,
            'prompt_tokens' => $res['usageMetadata']['promptTokenCount'] ?? null,
            'output_tokens' => $res['usageMetadata']['candidatesTokenCount'] ?? null,
            // web pages the grounded answer was built from
            'sources' => array_values(array_filter(array_map(
                fn ($c) => isset($c['web']['uri']) ? ['title' => (string) ($c['web']['title'] ?? ''), 'url' => (string) $c['web']['uri']] : null,
                $candidate['groundingMetadata']['groundingChunks'] ?? []
            ))),
        ];
    }
}
