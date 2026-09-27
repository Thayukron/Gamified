<?php
/**
 * Demo-data helper: plays a scenario as a simulated student with a persona
 * (preference weights per tag + mini-game skill), producing a valid choices_log.
 */
class DemoPlayer
{
    /** Random persona: a couple of strong VARK/RIASEC preferences and a mindset lean. */
    public static function persona(): array
    {
        $w = [];
        foreach (['vark_v', 'vark_a', 'vark_r', 'vark_k'] as $k) {
            $w[$k] = mt_rand(0, 100) / 100;
        }
        foreach (['riasec_r', 'riasec_i', 'riasec_a', 'riasec_s', 'riasec_e', 'riasec_c'] as $k) {
            $w[$k] = mt_rand(0, 100) / 100;
        }
        // Vocational IT class: realistic/investigative and hands-on slightly more common.
        $w['vark_k'] += 0.2;
        $w['riasec_i'] += 0.2;
        $w['riasec_r'] += 0.15;
        $growth = mt_rand(0, 100) / 100;
        $w['mindset_growth'] = $growth;
        $w['mindset_fixed'] = 1 - $growth;
        return ['weights' => $w, 'skill' => 0.35 + mt_rand(0, 60) / 100];
    }

    public static function play(array $content, array $persona): array
    {
        $scenes = $content['scenes'];
        $id = $content['start'];
        $log = [];
        for ($guard = 0; $guard < 500 && empty($scenes[$id]['end']); $guard++) {
            $s = $scenes[$id];
            if (!empty($s['choices'])) {
                $best = 0;
                $bestScore = -INF;
                foreach ($s['choices'] as $i => $c) {
                    $score = mt_rand(0, 110) / 100; // noise: people are not perfectly consistent
                    foreach ($c['tags'] ?? [] as $k => $v) {
                        $score += ($persona['weights'][$k] ?? 0) * $v;
                    }
                    if ($score > $bestScore) {
                        $bestScore = $score;
                        $best = $i;
                    }
                }
                $log[] = ['scene' => $id, 'choice' => $best];
                $id = $s['choices'][$best]['next'];
            } elseif (!empty($s['minigame'])) {
                $ok = mt_rand(0, 100) / 100 < $persona['skill'];
                $log[] = ['scene' => $id, 'outcome' => $ok ? 'success' : 'fail'];
                $id = $ok ? $s['next'] : ($s['fail_next'] ?? $s['next']);
            } else {
                $id = $s['next'];
            }
        }
        return $log;
    }
}
