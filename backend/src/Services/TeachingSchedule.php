<?php
namespace App\Services;

/**
 * Weekly teaching schedule (same rules as frontend/utils/teachingSchedule.ts — keep the two in step):
 * one session per week, numbered straight through the course; exam weeks count as sessions with the normal hours.
 */
class TeachingSchedule
{
    public const EXAM_NAME = ['midterm' => 'ทดสอบกลางภาค', 'final' => 'ทดสอบปลายภาค'];

    public static function calendar(bool $higher): array
    {
        return $higher ? ['weeks' => 15, 'midterm' => 7, 'final' => 15] : ['weeks' => 18, 'midterm' => 9, 'final' => 18];
    }

    /** [1,2,3,5,6,8] → "1-3, 5-6, 8" */
    public static function format(array $list): string
    {
        $parts = [];
        for ($i = 0, $n = count($list); $i < $n; $i = $j + 1) {
            $j = $i;
            while ($j + 1 < $n && $list[$j + 1] === $list[$j] + 1) {
                $j++;
            }
            $parts[] = $j > $i ? "{$list[$i]}-{$list[$j]}" : (string) $list[$i];
        }
        return implode(', ', $parts);
    }

    /** "1-3, 5" → [1,2,3,5] */
    public static function expand(string $sessions): array
    {
        $out = [];
        foreach (array_filter(array_map('trim', explode(',', $sessions)), 'strlen') as $part) {
            $ends = array_map('intval', explode('-', $part));
            $out = array_merge($out, range($ends[0], end($ends)));
        }
        return $out;
    }

    /**
     * Sessions and hours of every unit and exam from the saved weeks per unit; null when no schedule was saved.
     * @return array{units: array, midterm: array, final: array}|null
     */
    public static function compute(array $book, bool $higher): ?array
    {
        $rows = $book['schedule']['units'] ?? [];
        if (!$rows) {
            return null;
        }
        $num = fn ($v) => (float) preg_replace('/[^\d.]/', '', (string) $v);
        $t = $num($book['curriculum']['theory_hours'] ?? 0);
        $p = $num($book['curriculum']['practice_hours'] ?? 0);
        $cal = self::calendar($higher);
        $free = array_values(array_diff(range(1, $cal['weeks']), [$cal['midterm'], $cal['final']]));
        $units = [];
        $next = 0;
        foreach ($rows as $r) {
            $weeks = max(0, (int) $r['weeks']);
            $list = array_slice($free, $next, $weeks);
            $next += $weeks;
            $units[(string) $r['no']] = [
                'sessions' => self::format($list), 'first' => $list[0] ?? null, 'weeks' => $weeks,
                'hours_theory' => $weeks * $t, 'hours_practice' => $weeks * $p,
            ];
        }
        $exam = fn ($week) => ['sessions' => (string) $week, 'first' => $week, 'weeks' => 1, 'hours_theory' => $t, 'hours_practice' => $p];
        return ['units' => $units, 'midterm' => $exam($cal['midterm']), 'final' => $exam($cal['final'])];
    }
}
