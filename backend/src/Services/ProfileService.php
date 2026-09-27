<?php
namespace App\Services;

use App\Core\Database;

/**
 * Core Profile = sum of every universal-quest result a student completed in a term.
 * Shared by the student profile page and the teacher dashboard.
 */
class ProfileService
{
    public static function totalUniversal(): int
    {
        return (int) Database::get()->query(
            "SELECT COUNT(*) FROM scenarios WHERE is_universal = 1 AND is_active = 1 AND status = 'published'"
        )->fetchColumn();
    }

    /**
     * Core Profiles for many students at once.
     * @param int[] $userIds
     * @return array<int, array> keyed by user id; students with no result are omitted
     */
    public static function coreProfiles(array $userIds, int $semester, int $year): array
    {
        if (!$userIds) {
            return [];
        }
        $in = implode(',', array_fill(0, count($userIds), '?'));
        $stmt = Database::get()->prepare(
            "SELECT r.* FROM assessment_results r JOIN scenarios s ON s.id = r.scenario_id
              WHERE r.user_id IN ($in) AND r.semester = ? AND r.academic_year = ? AND s.is_universal = 1
           ORDER BY r.user_id, r.completed_at, r.id"
        );
        $stmt->execute([...$userIds, $semester, $year]);

        $byUser = [];
        foreach ($stmt->fetchAll() as $row) {
            $byUser[(int) $row['user_id']][] = $row;
        }

        $archetypes = [];
        foreach (Database::get()->query(
            'SELECT riasec_key, code AS archetype_code, name AS archetype_name, title AS archetype_title,
                    description AS archetype_description, strengths, tips, color, icon FROM archetype_master'
        ) as $a) {
            $a['strengths'] = json_decode($a['strengths'], true);
            $a['tips'] = json_decode($a['tips'] ?? '[]', true);
            $archetypes[$a['riasec_key']] = $a;
        }

        $total = self::totalUniversal();
        $out = [];
        foreach ($byUser as $uid => $rows) {
            $out[$uid] = self::combine($rows, $archetypes, $total);
        }
        return $out;
    }

    /** Combine one student's result rows into a Core Profile. */
    private static function combine(array $rows, array $archetypes, int $total): array
    {
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
        $arch = $archetypes[$p['archetype_key']] ?? [];
        unset($arch['riasec_key']);

        return $scores + $arch + [
            'dominant_vark' => $p['dominant_vark'],
            'dominant_riasec' => $p['dominant_riasec'],
            'mindset_type' => $p['mindset_type'],
            'quests_completed' => count($rows),
            'quests_total' => $total,
            'rarity' => Progression::coreRarity(count($rows), $total),
            'completed_at' => end($rows)['completed_at'],
        ];
    }
}
