<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Services\Progression;
use App\Services\ScenarioEngine;

class StudentGameController
{
    private static function term(): array
    {
        return [(int) app_config('semester'), (int) app_config('academic_year')];
    }

    private static function playableScenario(int $id): array
    {
        $stmt = Database::get()->prepare(
            "SELECT id, title, description, cover_image, content FROM scenarios
              WHERE id = ? AND is_active = 1 AND status = 'published'"
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: throw new HttpException(404, 'ไม่พบเควสต์นี้ หรือยังไม่เปิดให้เล่น');
    }

    private static function termResultId(int $userId, int $scenarioId): ?int
    {
        [$sem, $year] = self::term();
        $stmt = Database::get()->prepare(
            'SELECT id FROM assessment_results WHERE user_id = ? AND scenario_id = ? AND semester = ? AND academic_year = ?'
        );
        $stmt->execute([$userId, $scenarioId, $sem, $year]);
        $id = $stmt->fetchColumn();
        return $id === false ? null : (int) $id;
    }

    /** GET /student/quests — active quests with this student's status for the current term. */
    public static function quests(Request $req): array
    {
        [$sem, $year] = self::term();
        $stmt = Database::get()->prepare(
            "SELECT s.id, s.title, s.description, s.cover_image, s.is_universal,
                    JSON_UNQUOTE(JSON_EXTRACT(s.content, '$.meta.icon')) AS icon,
                    JSON_UNQUOTE(JSON_EXTRACT(s.content, '$.meta.color')) AS color,
                    JSON_UNQUOTE(JSON_EXTRACT(s.content, '$.meta.subtitle')) AS subtitle,
                    r.id AS result_id, gs.current_scene, gs.updated_at AS saved_at
               FROM scenarios s
          LEFT JOIN assessment_results r
                 ON r.scenario_id = s.id AND r.user_id = ? AND r.semester = ? AND r.academic_year = ?
          LEFT JOIN game_sessions gs
                 ON gs.scenario_id = s.id AND gs.user_id = ? AND gs.status = 'in_progress'
              WHERE s.is_active = 1 AND s.status = 'published'
           ORDER BY s.is_universal DESC, s.id"
        );
        $uid = $req->user['id'];
        $stmt->execute([$uid, $sem, $year, $uid]);

        $quests = array_map(function ($q) {
            $q['status'] = $q['result_id'] ? 'completed' : ($q['current_scene'] ? 'in_progress' : 'new');
            return $q;
        }, $stmt->fetchAll());

        return ['quests' => $quests, 'term' => ['semester' => $sem, 'academic_year' => $year]];
    }

    /** GET /student/quests/{id} — scenario for the player (tags stripped) + saved state. */
    public static function show(Request $req): array
    {
        $id = (int) $req->params['id'];
        $scenario = self::playableScenario($id);
        $uid = $req->user['id'];

        if ($resultId = self::termResultId($uid, $id)) {
            return ['completed' => true, 'result_id' => $resultId];
        }

        $stmt = Database::get()->prepare(
            "SELECT current_scene, choices_log, updated_at FROM game_sessions
              WHERE user_id = ? AND scenario_id = ? AND status = 'in_progress'"
        );
        $stmt->execute([$uid, $id]);
        $session = $stmt->fetch() ?: null;
        if ($session) {
            $session['choices_log'] = json_decode($session['choices_log'], true) ?: [];
        }

        $scenario['content'] = ScenarioEngine::forPlayer(json_decode($scenario['content'], true));
        return ['completed' => false, 'scenario' => $scenario, 'session' => $session];
    }

    /** PUT /student/quests/{id}/progress — save state after each step. */
    public static function progress(Request $req): array
    {
        $id = (int) $req->params['id'];
        $scenario = self::playableScenario($id);
        $content = json_decode($scenario['content'], true);
        $sceneId = (string) $req->input('current_scene', '');
        $log = $req->input('choices_log', []);
        if (!isset($content['scenes'][$sceneId]) || !is_array($log)) {
            throw new HttpException(422, 'ข้อมูลบันทึกไม่ถูกต้อง');
        }
        if (self::termResultId($req->user['id'], $id)) {
            throw new HttpException(409, 'คุณเล่นเควสต์นี้จบแล้วในภาคเรียนนี้');
        }

        Database::get()->prepare(
            "INSERT INTO game_sessions (user_id, scenario_id, current_scene, choices_log, status)
             VALUES (?, ?, ?, ?, 'in_progress')
             ON DUPLICATE KEY UPDATE current_scene = VALUES(current_scene),
                                     choices_log = VALUES(choices_log), status = 'in_progress'"
        )->execute([$req->user['id'], $id, $sceneId, json_encode($log)]);

        return ['saved' => true, 'saved_at' => date('c')];
    }

    /** POST /student/quests/{id}/complete — rule-based scoring and archetype assignment. */
    public static function complete(Request $req): array
    {
        $id = (int) $req->params['id'];
        $uid = $req->user['id'];
        $scenario = self::playableScenario($id);
        if ($resultId = self::termResultId($uid, $id)) {
            return ['result_id' => $resultId, 'already' => true];
        }

        $log = $req->input('choices_log', []);
        if (!is_array($log)) {
            throw new HttpException(422, 'ข้อมูลการเล่นไม่ถูกต้อง');
        }
        $eval = ScenarioEngine::evaluate(json_decode($scenario['content'], true), $log);
        $profile = ScenarioEngine::profile($eval['scores'], ScenarioEngine::recency($eval['tag_history']));

        $db = Database::get();
        $stmt = $db->prepare('SELECT id FROM archetype_master WHERE riasec_key = ? LIMIT 1');
        $stmt->execute([$profile['archetype_key']]);
        $archetypeId = $stmt->fetchColumn() ?: null;

        $rewards = Progression::rewards($eval['stats'], count($eval['items']));
        $rarity = Progression::questRarity($eval['stats']);
        $before = self::playerProgress($uid);

        [$sem, $year] = self::term();
        $cols = ScenarioEngine::tagKeys();
        $sql = 'INSERT INTO assessment_results (user_id, scenario_id, semester, academic_year, '
            . implode(', ', $cols)
            . ', dominant_vark, dominant_riasec, mindset_type, archetype_id, rarity, xp_gained, coins_gained, choices_log) VALUES ('
            . implode(', ', array_fill(0, count($cols) + 12, '?')) . ')';

        $db->beginTransaction();
        $db->prepare($sql)->execute([
            $uid, $id, $sem, $year,
            ...array_map(fn ($k) => $eval['scores'][$k], $cols),
            $profile['dominant_vark'], $profile['dominant_riasec'], $profile['mindset_type'],
            $archetypeId, $rarity, $rewards['xp'], $rewards['coins'], json_encode($log),
        ]);
        $resultId = (int) $db->lastInsertId();
        $db->prepare("UPDATE game_sessions SET status = 'completed', choices_log = ? WHERE user_id = ? AND scenario_id = ?")
            ->execute([json_encode($log), $uid, $id]);
        $db->prepare(
            'INSERT INTO player_progress (user_id, xp, coins) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE xp = xp + VALUES(xp), coins = coins + VALUES(coins)'
        )->execute([$uid, $rewards['xp'], $rewards['coins']]);
        $db->commit();

        return [
            'result_id' => $resultId,
            'already' => false,
            'rewards' => $rewards + [
                'rarity' => $rarity,
                'level_before' => Progression::level($before['xp'])['level'],
                'level_after' => Progression::level($before['xp'] + $rewards['xp'])['level'],
            ],
        ];
    }

    /** Current XP/coins/avatar row for a student (defaults when never played). */
    private static function playerProgress(int $uid): array
    {
        $stmt = Database::get()->prepare('SELECT xp, coins, avatar FROM player_progress WHERE user_id = ?');
        $stmt->execute([$uid]);
        $row = $stmt->fetch() ?: ['xp' => 0, 'coins' => 0, 'avatar' => null];
        return ['xp' => (int) $row['xp'], 'coins' => (int) $row['coins'], 'avatar' => $row['avatar'] ? json_decode($row['avatar'], true) : null];
    }

    /** GET /student/player — XP, level, coins and avatar. */
    public static function player(Request $req): array
    {
        $p = self::playerProgress($req->user['id']);
        return ['player' => $p + Progression::level($p['xp'])];
    }

    /** PUT /student/player/avatar — save the student's character look. */
    public static function saveAvatar(Request $req): array
    {
        $in = $req->body();
        $color = fn ($v) => is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v) ? $v : null;
        $avatar = [
            'gender' => in_array($in['gender'] ?? '', ['m', 'f'], true) ? $in['gender'] : 'f',
            'hairStyle' => in_array($in['hairStyle'] ?? '', ['long', 'bob', 'short'], true) ? $in['hairStyle'] : 'short',
            'hair' => $color($in['hair'] ?? null) ?? '#1f2937',
            'skin' => $color($in['skin'] ?? null) ?? '#f1c7a5',
            'eyes' => $color($in['eyes'] ?? null) ?? '#7c3aed',
            'robe' => $color($in['robe'] ?? null) ?? '#4c1d95',
        ];
        Database::get()->prepare(
            'INSERT INTO player_progress (user_id, avatar) VALUES (?, ?) ON DUPLICATE KEY UPDATE avatar = VALUES(avatar)'
        )->execute([$req->user['id'], json_encode($avatar)]);
        return ['avatar' => $avatar];
    }

    private static function resultQuery(): string
    {
        return 'SELECT r.*, s.title AS scenario_title, s.content AS scenario_content,
                       a.code AS archetype_code, a.name AS archetype_name, a.title AS archetype_title,
                       a.description AS archetype_description, a.strengths, a.tips, a.color, a.icon
                  FROM assessment_results r
             LEFT JOIN scenarios s ON s.id = r.scenario_id
             LEFT JOIN archetype_master a ON a.id = r.archetype_id';
    }

    private static function formatResult(array $r, bool $withItems = false): array
    {
        $r['items'] = [];
        if ($withItems && $r['choices_log'] && $r['scenario_content']) {
            try {
                $eval = ScenarioEngine::evaluate(json_decode($r['scenario_content'], true), json_decode($r['choices_log'], true));
                $r['items'] = $eval['items'];
            } catch (HttpException) {
                // scenario was edited after this play-through; items can no longer be replayed
            }
        }
        unset($r['choices_log'], $r['scenario_content']);
        $r['strengths'] = json_decode($r['strengths'] ?? '[]', true);
        $r['tips'] = json_decode($r['tips'] ?? '[]', true);
        foreach (ScenarioEngine::tagKeys() as $k) {
            $r[$k] = (int) $r[$k];
        }
        return $r;
    }

    /** GET /student/results — play history, newest first. */
    public static function results(Request $req): array
    {
        $stmt = Database::get()->prepare(self::resultQuery() . ' WHERE r.user_id = ? ORDER BY r.completed_at DESC');
        $stmt->execute([$req->user['id']]);
        return ['results' => array_map(fn ($r) => self::formatResult($r), $stmt->fetchAll())];
    }

    /** GET /student/results/{id} */
    public static function result(Request $req): array
    {
        $stmt = Database::get()->prepare(self::resultQuery() . ' WHERE r.id = ? AND r.user_id = ?');
        $stmt->execute([(int) $req->params['id'], $req->user['id']]);
        $r = $stmt->fetch() ?: throw new HttpException(404, 'ไม่พบผลลัพธ์');
        return ['result' => self::formatResult($r, true)];
    }

    /**
     * GET /student/profile — Core Profile for the current term, combining every
     * universal quest the student has completed. More quests = more reliable profile.
     */
    public static function profile(Request $req): array
    {
        [$sem, $year] = self::term();
        $db = Database::get();
        $stmt = $db->prepare(
            'SELECT r.* FROM assessment_results r JOIN scenarios s ON s.id = r.scenario_id
              WHERE r.user_id = ? AND r.semester = ? AND r.academic_year = ? AND s.is_universal = 1
           ORDER BY r.completed_at, r.id'
        );
        $stmt->execute([$req->user['id'], $sem, $year]);
        $rows = $stmt->fetchAll();
        $total = (int) $db->query(
            "SELECT COUNT(*) FROM scenarios WHERE is_universal = 1 AND is_active = 1 AND status = 'published'"
        )->fetchColumn();

        $base = ['completed' => count($rows), 'total' => $total, 'semester' => $sem, 'academic_year' => $year];
        if (!$rows) {
            return ['profile' => null] + $base;
        }

        $scores = array_fill_keys(ScenarioEngine::tagKeys(), 0);
        $recency = [];
        foreach ($rows as $i => $row) {
            foreach (ScenarioEngine::tagKeys() as $k) {
                $scores[$k] += (int) $row[$k];
            }
            // later quests win ties; within a quest, earlier letters of its Holland code rank higher
            foreach (str_split((string) $row['dominant_riasec']) as $pos => $letter) {
                $recency['riasec_' . strtolower($letter)] = $i * 10 + (3 - $pos);
            }
        }
        $p = ScenarioEngine::profile($scores, $recency);

        $a = $db->prepare(
            'SELECT code AS archetype_code, name AS archetype_name, title AS archetype_title,
                    description AS archetype_description, strengths, tips, color, icon
               FROM archetype_master WHERE riasec_key = ? LIMIT 1'
        );
        $a->execute([$p['archetype_key']]);

        $profile = self::formatResult($scores + ($a->fetch() ?: []) + [
            'rarity' => Progression::coreRarity(count($rows), $total),
            'id' => 0,
            'choices_log' => null,
            'scenario_content' => null,
            'scenario_title' => 'Core Profile',
            'semester' => $sem,
            'academic_year' => $year,
            'completed_at' => end($rows)['completed_at'],
            'dominant_vark' => $p['dominant_vark'],
            'dominant_riasec' => $p['dominant_riasec'],
            'mindset_type' => $p['mindset_type'],
        ]);
        return ['profile' => $profile] + $base;
    }
}
