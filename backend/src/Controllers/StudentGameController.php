<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\HttpException;
use App\Core\Request;
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
        $profile = ScenarioEngine::profile($eval['scores'], $eval['tag_history']);

        $db = Database::get();
        $stmt = $db->prepare('SELECT id FROM archetype_master WHERE riasec_key = ? LIMIT 1');
        $stmt->execute([$profile['archetype_key']]);
        $archetypeId = $stmt->fetchColumn() ?: null;

        [$sem, $year] = self::term();
        $cols = ScenarioEngine::tagKeys();
        $sql = 'INSERT INTO assessment_results (user_id, scenario_id, semester, academic_year, '
            . implode(', ', $cols)
            . ', dominant_vark, dominant_riasec, mindset_type, archetype_id, choices_log) VALUES ('
            . implode(', ', array_fill(0, count($cols) + 9, '?')) . ')';

        $db->beginTransaction();
        $db->prepare($sql)->execute([
            $uid, $id, $sem, $year,
            ...array_map(fn ($k) => $eval['scores'][$k], $cols),
            $profile['dominant_vark'], $profile['dominant_riasec'], $profile['mindset_type'],
            $archetypeId, json_encode($log),
        ]);
        $resultId = (int) $db->lastInsertId();
        $db->prepare("UPDATE game_sessions SET status = 'completed', choices_log = ? WHERE user_id = ? AND scenario_id = ?")
            ->execute([json_encode($log), $uid, $id]);
        $db->commit();

        return ['result_id' => $resultId, 'already' => false];
    }

    private static function resultQuery(): string
    {
        return 'SELECT r.*, s.title AS scenario_title,
                       a.code AS archetype_code, a.name AS archetype_name, a.title AS archetype_title,
                       a.description AS archetype_description, a.strengths, a.tips, a.color, a.icon
                  FROM assessment_results r
             LEFT JOIN scenarios s ON s.id = r.scenario_id
             LEFT JOIN archetype_master a ON a.id = r.archetype_id';
    }

    private static function formatResult(array $r): array
    {
        unset($r['choices_log']);
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
        return ['results' => array_map([self::class, 'formatResult'], $stmt->fetchAll())];
    }

    /** GET /student/results/{id} */
    public static function result(Request $req): array
    {
        $stmt = Database::get()->prepare(self::resultQuery() . ' WHERE r.id = ? AND r.user_id = ?');
        $stmt->execute([(int) $req->params['id'], $req->user['id']]);
        $r = $stmt->fetch() ?: throw new HttpException(404, 'ไม่พบผลลัพธ์');
        return ['result' => self::formatResult($r)];
    }
}
