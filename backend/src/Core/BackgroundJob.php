<?php
namespace App\Core;

/**
 * Long AI requests (often 60–160 s) outlive Cloudflare Tunnel's 100 s limit (HTTP 524), so the client may ask
 * for them to run as a background job (header "X-Async-Job: 1" on routes marked with Router::background()):
 * the job id is answered at once, the work continues in the same PHP process, and the browser polls
 * GET /jobs/{id} for the result. The handler code itself is unchanged.
 */
class BackgroundJob
{
    public static function start(int $userId, string $path, callable $work): never
    {
        $db = Database::get();
        $db->exec('DELETE FROM background_jobs WHERE created_at < NOW() - INTERVAL 2 DAY');
        $id = bin2hex(random_bytes(16));
        $db->prepare("INSERT INTO background_jobs (id, user_id, path, status) VALUES (?, ?, ?, 'running')")->execute([$id, $userId, mb_substr($path, 0, 255)]);

        self::respondNow(['job_id' => $id, 'status' => 'running']);

        try {
            [$status, $code, $result] = ['done', 200, $work()];
        } catch (HttpException $e) {
            [$status, $code, $result] = ['error', $e->status, ['error' => $e->getMessage()]];
        } catch (\Throwable $e) {
            error_log((string) $e);
            [$status, $code, $result] = ['error', 500, ['error' => 'เกิดข้อผิดพลาดภายในระบบ']];
        }
        Database::get()->prepare('UPDATE background_jobs SET status = ?, http_status = ?, result = ? WHERE id = ?')
            ->execute([$status, $code, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $id]);
        exit;
    }

    /** GET /jobs/{id} — the caller's own job: running, or done/error with the handler's response. */
    public static function show(Request $req): array
    {
        $stmt = Database::get()->prepare('SELECT status, http_status, result FROM background_jobs WHERE id = ? AND user_id = ?');
        $stmt->execute([(string) $req->params['id'], $req->user['id']]);
        $job = $stmt->fetch() ?: throw new HttpException(404, 'ไม่พบงานนี้ (อาจหมดอายุแล้ว) — กรุณากดใหม่อีกครั้ง');
        return ['status' => $job['status'], 'http_status' => (int) $job['http_status'], 'result' => $job['result'] !== null ? json_decode($job['result'], true) : null];
    }

    /** Send the response and close the connection, but keep the script running. */
    private static function respondNow(array $data): void
    {
        ignore_user_abort(true);
        set_time_limit(600);
        $body = json_encode($data, JSON_UNESCAPED_UNICODE);
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        http_response_code(202);
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Length: ' . strlen($body));
        header('Connection: close');
        echo $body;
        flush();
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
    }
}
