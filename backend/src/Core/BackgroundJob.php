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

    /**
     * GET /jobs/latest?path=…&after=… — the caller's newest AI result for that path made after the item was last
     * saved: a draft that was never saved (the page was left, the browser closed) can be taken up again instead of
     * asking the AI once more. Fills made without AI (model null) are left out.
     */
    public static function latest(Request $req): array
    {
        $stmt = Database::get()->prepare(
            "SELECT id, created_at, result FROM background_jobs WHERE user_id = ? AND path = ? AND status = 'done'
              AND created_at > ? AND result NOT LIKE '%\"model\":null%' ORDER BY created_at DESC LIMIT 1"
        );
        $stmt->execute([$req->user['id'], (string) $req->query('path', ''), (string) ($req->query('after') ?: '1970-01-01')]);
        $job = $stmt->fetch();
        return ['job' => $job ? ['id' => $job['id'], 'created_at' => $job['created_at'], 'result' => json_decode($job['result'], true)] : null];
    }

    /**
     * AI requests of a user since the free tier's daily quota last came back (midnight Pacific time): what the
     * teacher has used in this quota day. Fills made without AI are not counted.
     */
    public static function usage(int $userId): array
    {
        $reset = new \DateTime('today', new \DateTimeZone('America/Los_Angeles'));
        $stmt = Database::get()->prepare(
            "SELECT COUNT(*) AS used, SUM(status = 'error') AS failed FROM background_jobs
              WHERE user_id = ? AND created_at >= NOW() - INTERVAL ? SECOND AND (result IS NULL OR result NOT LIKE '%\"model\":null%')"
        );
        $stmt->execute([$userId, time() - $reset->getTimestamp()]);
        $row = $stmt->fetch();
        return ['used' => (int) $row['used'], 'failed' => (int) $row['failed'],
            'since' => $reset->setTimezone(new \DateTimeZone('Asia/Bangkok'))->format('H:i')];
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
