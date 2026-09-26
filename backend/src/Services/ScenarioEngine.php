<?php
namespace App\Services;

use App\Core\HttpException;

/**
 * Rule-based scenario evaluation.
 *
 * Scenario content format:
 * {
 *   "start": "intro",
 *   "characters": { "lumin": { "name": "ลูมิน", "kind": "owl", ... } },
 *   "scenes": {
 *     "intro": {
 *       "background": "night", "bgm": "mystery", "effect": "fade|shake|flash",
 *       "cast": [{"id": "lumin", "pos": "center", "expr": "happy"}],
 *       "dialogue": ["narration", {"speaker": "lumin", "text": "...", "expr": "happy", "anim": "bounce"}],
 *
 *       // decision (layout: list | cards | hotspots, optional timer + timeout_choice)
 *       "layout": "cards", "prompt": "...", "timer": 10, "timeout_choice": 3,
 *       "choices": [{"text": "...", "icon": "map", "x": 20, "y": 40,
 *                    "tags": {"vark_v": 1}, "reply": [lines], "reward": {"name": "...", "icon": "..."},
 *                    "next": "scene2"}],
 *
 *       // or a mini-game: success -> next, failure -> fail_next
 *       "minigame": {"type": "sequence|orbs", ...}, "fail_next": "scene3",
 *
 *       "next": "scene2",          // when there are no choices
 *       "end": true                // final scene
 *     }
 *   }
 * }
 * choices_log: [{"scene": "intro", "choice": 0}, {"scene": "puzzle", "outcome": "fail"}, ...]
 */
class ScenarioEngine
{
    public const VARK = ['vark_v', 'vark_a', 'vark_r', 'vark_k'];
    public const RIASEC = ['riasec_r', 'riasec_i', 'riasec_a', 'riasec_s', 'riasec_e', 'riasec_c'];
    public const MINDSET = ['mindset_growth', 'mindset_fixed'];

    private const MAX_STEPS = 500;

    public static function tagKeys(): array
    {
        return [...self::VARK, ...self::RIASEC, ...self::MINDSET];
    }

    /** Remove scoring tags so players cannot see how choices are weighted. */
    public static function forPlayer(array $content): array
    {
        foreach ($content['scenes'] as &$scene) {
            foreach ($scene['choices'] ?? [] as $i => $choice) {
                unset($scene['choices'][$i]['tags']);
            }
        }
        return $content;
    }

    /**
     * Replay the log from the start scene, validating every step, and total the tags.
     * @return array{scores: array<string,int>, path: string[], tag_history: array<int, string[]>, items: array, stats: array{choices:int, wins:int, fails:int}}
     */
    public static function evaluate(array $content, array $log): array
    {
        $scenes = $content['scenes'] ?? [];
        $sceneId = $content['start'] ?? null;
        $scores = array_fill_keys(self::tagKeys(), 0);
        $path = [];
        $tagHistory = [];
        $items = [];
        $stats = ['choices' => 0, 'wins' => 0, 'fails' => 0];
        $logIndex = 0;

        for ($step = 0; $step < self::MAX_STEPS; $step++) {
            $scene = $scenes[$sceneId] ?? throw new HttpException(422, "ไม่พบฉาก $sceneId");
            $path[] = $sceneId;

            if (!empty($scene['end'])) {
                if ($logIndex !== count($log)) {
                    throw new HttpException(422, 'ข้อมูลการเล่นไม่ถูกต้อง (มีขั้นตอนเกิน)');
                }
                return ['scores' => $scores, 'path' => $path, 'tag_history' => $tagHistory, 'items' => $items, 'stats' => $stats];
            }

            if (!empty($scene['choices'])) {
                $entry = $log[$logIndex] ?? throw new HttpException(422, 'ยังเล่นไม่จบเรื่อง');
                $choice = $scene['choices'][(int) ($entry['choice'] ?? -1)] ?? null;
                if (($entry['scene'] ?? null) !== $sceneId || $choice === null) {
                    throw new HttpException(422, 'ข้อมูลการเล่นไม่ถูกต้อง');
                }
                $applied = [];
                foreach ($choice['tags'] ?? [] as $key => $value) {
                    if (array_key_exists($key, $scores)) {
                        $scores[$key] += (int) $value;
                        $applied[] = $key;
                    }
                }
                $tagHistory[] = $applied;
                $stats['choices']++;
                if (!empty($choice['reward']['name'])) {
                    $items[] = $choice['reward'];
                }
                $logIndex++;
                $sceneId = $choice['next'] ?? $scene['next'] ?? null;
            } elseif (!empty($scene['minigame'])) {
                $entry = $log[$logIndex] ?? throw new HttpException(422, 'ยังเล่นไม่จบเรื่อง');
                $outcome = $entry['outcome'] ?? null;
                if (($entry['scene'] ?? null) !== $sceneId || !in_array($outcome, ['success', 'fail'], true)) {
                    throw new HttpException(422, 'ข้อมูลการเล่นไม่ถูกต้อง');
                }
                $stats[$outcome === 'fail' ? 'fails' : 'wins']++;
                $logIndex++;
                $sceneId = $outcome === 'fail' ? ($scene['fail_next'] ?? $scene['next'] ?? null) : ($scene['next'] ?? null);
            } else {
                $sceneId = $scene['next'] ?? null;
            }
        }
        throw new HttpException(422, 'เนื้อเรื่องวนซ้ำไม่สิ้นสุด');
    }

    /**
     * Derive the profile summary from totals.
     * - VARK: every style tied for the top score (multimodal, e.g. "VK")
     * - RIASEC: Holland code of the top 3; ties broken by $recency (higher = chosen more recently)
     * - Mindset: growth / fixed / mixed by comparing the two totals
     */
    public static function profile(array $scores, array $recency): array
    {
        $vark = array_intersect_key($scores, array_flip(self::VARK));
        $max = max($vark);
        $dominantVark = $max > 0
            ? implode('', array_map(fn ($k) => strtoupper(substr($k, -1)), array_keys(array_filter($vark, fn ($v) => $v === $max))))
            : null;

        $riasec = array_intersect_key($scores, array_flip(self::RIASEC));
        $keys = array_keys($riasec);
        usort($keys, fn ($a, $b) => [$riasec[$b], $recency[$b] ?? -1] <=> [$riasec[$a], $recency[$a] ?? -1]);
        $holland = implode('', array_map(fn ($k) => strtoupper(substr($k, -1)), array_slice($keys, 0, 3)));

        $g = $scores['mindset_growth'];
        $f = $scores['mindset_fixed'];
        $mindset = $g > $f ? 'growth' : ($f > $g ? 'fixed' : 'mixed');

        return [
            'dominant_vark' => $dominantVark,
            'dominant_riasec' => $holland,
            'mindset_type' => $mindset,
            'archetype_key' => $holland[0],
        ];
    }

    /** Recency map from a tag history: tag => index of the last decision that applied it. */
    public static function recency(array $tagHistory): array
    {
        $last = [];
        foreach ($tagHistory as $i => $keys) {
            foreach ($keys as $key) {
                $last[$key] = $i;
            }
        }
        return $last;
    }

    /** Basic structural validation used by the scenario builder and import. */
    public static function validate(array $content): array
    {
        $errors = [];
        $scenes = $content['scenes'] ?? null;
        if (!is_array($scenes) || !$scenes) {
            return ['ต้องมีอย่างน้อย 1 ฉาก'];
        }
        if (!isset($scenes[$content['start'] ?? ''])) {
            $errors[] = 'ฉากเริ่มต้น (start) ไม่ถูกต้อง';
        }
        $hasEnd = false;
        foreach ($scenes as $id => $scene) {
            $hasEnd = $hasEnd || !empty($scene['end']);
            if (empty($scene['end']) && empty($scene['choices']) && !isset($scenes[$scene['next'] ?? ''])) {
                $errors[] = "ฉาก $id ไม่มีทางไปต่อ";
            }
            if (!empty($scene['minigame']) && isset($scene['fail_next']) && !isset($scenes[$scene['fail_next']])) {
                $errors[] = "ฉาก $id: fail_next ชี้ไปฉากที่ไม่มีอยู่";
            }
            foreach ($scene['choices'] ?? [] as $i => $c) {
                if (!isset($scenes[$c['next'] ?? ''])) {
                    $errors[] = "ฉาก $id ตัวเลือกที่ " . ($i + 1) . ' ชี้ไปฉากที่ไม่มีอยู่';
                }
                foreach (array_keys($c['tags'] ?? []) as $tag) {
                    if (!in_array($tag, self::tagKeys(), true)) {
                        $errors[] = "ฉาก $id มีแท็กคะแนนไม่รู้จัก: $tag";
                    }
                }
            }
        }
        if (!$hasEnd) {
            $errors[] = 'ต้องมีฉากจบ (end) อย่างน้อย 1 ฉาก';
        }
        return $errors;
    }
}
