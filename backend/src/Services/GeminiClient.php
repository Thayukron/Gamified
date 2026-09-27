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

    private function request(string $method, string $path, ?array $body = null): array
    {
        $cfg = app_config('gemini');
        $ch = curl_init(rtrim($cfg['base_url'], '/') . $path);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $cfg['timeout'],
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $this->apiKey],
            CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE),
        ]);
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
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
        return in_array($status, [400, 401, 403], true) ? 422 : ($status === 429 ? 429 : 502);
    }

    private static function explain(int $status, string $msg): string
    {
        return match (true) {
            $status === 400 && str_contains($msg, 'API key') => 'API Key ไม่ถูกต้อง — ตรวจสอบว่าคัดลอกมาครบ',
            in_array($status, [401, 403], true) => 'API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้ Gemini API',
            $status === 429 => 'ใช้งาน Gemini เกินโควตาของ API Key นี้ — รอสักครู่แล้วลองใหม่ (ระบบยังใช้ไกด์แบบกฎได้ตามปกติ)',
            $status === 404 => 'ไม่พบรุ่นโมเดลนี้ — กดทดสอบการเชื่อมต่อใหม่เพื่อเลือกรุ่นที่ใช้ได้',
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
     * Pick a sensible default: the newest stable general-purpose "flash" model
     * (fast and inexpensive — ideal for text guidance).
     */
    public static function pickDefault(array $models): ?string
    {
        $skip = '/(tts|image|audio|live|embedding|vision|preview|exp|thinking|lite|aqa|learnlm|robotics|computer)/i';
        $flash = array_values(array_filter($models, fn ($m) => str_contains($m, 'flash') && !preg_match($skip, $m)));
        $version = function (string $m): float {
            return preg_match('/gemini-(\d+(?:\.\d+)?)/', $m, $v) ? (float) $v[1] : 0;
        };
        usort($flash, fn ($a, $b) => [$version($b), -strlen($b)] <=> [$version($a), -strlen($a)]);
        return $flash[0] ?? ($models[0] ?? null);
    }

    /**
     * Generate a JSON response.
     * @return array{data: array, prompt_tokens: ?int, output_tokens: ?int}
     */
    public function generateJson(string $model, string $system, string $prompt): array
    {
        $res = $this->request('POST', '/models/' . rawurlencode($model) . ':generateContent', [
            'systemInstruction' => ['parts' => [['text' => $system]]],
            'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                'temperature' => 0.7,
                'maxOutputTokens' => 8192,
            ],
        ]);

        $candidate = $res['candidates'][0] ?? null;
        $text = implode('', array_map(fn ($p) => $p['text'] ?? '', $candidate['content']['parts'] ?? []));
        if ($text === '') {
            $why = $candidate['finishReason'] ?? ($res['promptFeedback']['blockReason'] ?? 'ไม่ทราบสาเหตุ');
            throw new HttpException(502, "Gemini ไม่ได้ส่งคำตอบกลับมา ($why)");
        }
        // Tolerate a fenced block even though JSON mode is requested.
        $text = preg_replace('/^\s*```(?:json)?\s*|\s*```\s*$/', '', $text);
        $data = json_decode($text, true);
        if (!is_array($data)) {
            $reason = ($candidate['finishReason'] ?? '') === 'MAX_TOKENS' ? 'คำตอบยาวเกินกำหนด' : 'รูปแบบคำตอบไม่ถูกต้อง';
            throw new HttpException(502, "Gemini ตอบกลับมาแต่อ่านไม่ได้ ($reason) — ลองกดสร้างใหม่อีกครั้ง");
        }
        return [
            'data' => $data,
            'prompt_tokens' => $res['usageMetadata']['promptTokenCount'] ?? null,
            'output_tokens' => $res['usageMetadata']['candidatesTokenCount'] ?? null,
        ];
    }
}
