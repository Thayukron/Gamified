<?php
namespace App\Guide;

/**
 * Smart grouping from Core Profiles.
 *  - mixed:   heterogeneous teams for project work — spread RIASEC interests, VARK styles and
 *             Fixed-Mindset students across groups (greedy placement + swap improvement).
 *  - similar: homogeneous groups by dominant VARK style — for targeted remedial sessions.
 * Deterministic for a given seed so "สุ่มใหม่" (re-shuffle) is reproducible.
 */
class GroupingService
{
    public const ROLE_TITLE = [
        'R' => 'ผู้ลงมือสร้าง/ทดสอบ', 'I' => 'ผู้วิเคราะห์ปัญหา', 'A' => 'ผู้ออกแบบ/นำเสนอสร้างสรรค์',
        'S' => 'ผู้ประสานงาน/พี่เลี้ยงกลุ่ม', 'E' => 'หัวหน้าทีม/ผู้นำเสนอ', 'C' => 'ผู้วางแผน/ตรวจสอบคุณภาพ',
    ];
    private const VARK_TH = ['V' => 'สายภาพ', 'A' => 'สายฟัง', 'R' => 'สายอ่าน-เขียน', 'K' => 'สายลงมือทำ', 'M' => 'หลายช่องทาง'];

    /** Compact member record from a dashboard student row. */
    public static function member(array $s): array
    {
        $p = $s['profile'];
        $vark = $p['dominant_vark'] ?? null;
        return [
            'id' => $s['id'],
            'code' => $s['student_code'],
            'name' => $s['full_name'],
            'profiled' => (bool) $p,
            'riasec' => $p ? str_split($p['dominant_riasec']) : [],
            'vark' => $vark ? (strlen($vark) === 1 ? $vark : 'M') : null,
            'mindset' => $p['mindset_type'] ?? null,
            'archetype' => $p ? ['name' => $p['archetype_name'], 'icon' => $p['icon'], 'color' => $p['color']] : null,
        ];
    }

    /**
     * @param array $students dashboard "students" rows
     * @return array{groups: array, unassigned: array, settings: array}
     */
    public static function build(array $students, int $size, string $mode, int $seed, bool $includeUnprofiled): array
    {
        $size = max(2, min(8, $size));
        mt_srand($seed);
        $members = array_map([self::class, 'member'], $students);
        $profiled = array_values(array_filter($members, fn ($m) => $m['profiled']));
        $unprofiled = array_values(array_filter($members, fn ($m) => !$m['profiled']));
        self::shuffle($profiled);
        self::shuffle($unprofiled);

        $unassigned = $includeUnprofiled ? [] : $unprofiled;
        if ($mode === 'similar') {
            $groups = self::similar($profiled, $size);
            if ($includeUnprofiled && $unprofiled) {
                // no style data yet → their own group(s), not mixed into style-based groups
                foreach (array_chunk($unprofiled, $size) as $chunk) {
                    $groups[] = $chunk;
                }
            }
        } else {
            // the team count comes from the whole class, so students without a profile are
            // spread across teams instead of forming teams of their own
            $total = count($profiled) + ($includeUnprofiled ? count($unprofiled) : 0);
            $k = max(1, (int) ceil($total / $size));
            $groups = self::mixed($profiled, min($k, max(1, count($profiled))));
            if ($includeUnprofiled) {
                while (count($groups) < $k) {
                    $groups[] = [];
                }
                foreach ($unprofiled as $m) {
                    usort($groups, fn ($a, $b) => count($a) <=> count($b));
                    $groups[0][] = $m;
                }
                $groups = array_values(array_filter($groups));
            }
        }

        return [
            'groups' => self::describe($groups, $mode),
            'unassigned' => $unassigned,
            'settings' => ['size' => $size, 'mode' => $mode, 'seed' => $seed, 'include_unprofiled' => $includeUnprofiled],
        ];
    }

    /** Rebuild descriptions for a teacher-edited grouping (list of member-id lists). */
    public static function fromIds(array $students, array $idGroups, string $mode): array
    {
        $byId = [];
        foreach ($students as $s) {
            $byId[$s['id']] = self::member($s);
        }
        $seen = [];
        $groups = [];
        foreach ($idGroups as $ids) {
            $g = [];
            foreach ((array) $ids as $id) {
                $id = (int) $id;
                if (isset($byId[$id]) && !isset($seen[$id])) {
                    $g[] = $byId[$id];
                    $seen[$id] = true;
                }
            }
            if ($g) {
                $groups[] = $g;
            }
        }
        $unassigned = array_values(array_filter($byId, fn ($m) => !isset($seen[$m['id']])));
        return ['groups' => self::describe($groups, $mode), 'unassigned' => $unassigned];
    }

    // ------------------------------------------------------------------ algorithms

    private static function shuffle(array &$a): void
    {
        for ($i = count($a) - 1; $i > 0; $i--) {
            $j = mt_rand(0, $i);
            [$a[$i], $a[$j]] = [$a[$j], $a[$i]];
        }
    }

    /** Heterogeneous teams. */
    /** Per-team limit of Fixed-Mindset students for the current build (even spread). */
    private static int $fixedCap = 1;

    private static function mixed(array $people, int $k): array
    {
        $n = count($people);
        if ($n === 0) {
            return [];
        }
        $cap = (int) ceil($n / $k); // balanced sizes (differ by at most 1)
        $groups = array_fill(0, $k, []);

        // 1) spread Fixed-Mindset students first, round-robin
        $fixed = array_values(array_filter($people, fn ($m) => $m['mindset'] === 'fixed'));
        self::$fixedCap = max(1, (int) ceil(count($fixed) / $k)); // e.g. 18 across 9 teams → 2 each
        $rest = array_values(array_filter($people, fn ($m) => $m['mindset'] !== 'fixed'));
        foreach ($fixed as $i => $m) {
            $groups[$i % $k][] = $m;
        }

        // 2) place the rest, rarest primary interest first, where they add the most diversity
        $freq = array_count_values(array_map(fn ($m) => $m['riasec'][0], $rest));
        usort($rest, fn ($a, $b) => ($freq[$a['riasec'][0]] ?? 0) <=> ($freq[$b['riasec'][0]] ?? 0));
        foreach ($rest as $m) {
            $best = null;
            $bestGain = -INF;
            foreach ($groups as $gi => $g) {
                if (count($g) >= $cap) {
                    continue;
                }
                $gain = self::score([...$g, $m]) - self::score($g) - count($g) * 0.01;
                if ($gain > $bestGain) {
                    $bestGain = $gain;
                    $best = $gi;
                }
            }
            $groups[$best ?? 0][] = $m;
        }

        // 3) local improvement: swap members between groups while the total score rises
        for ($pass = 0; $pass < 4; $pass++) {
            $improved = false;
            for ($a = 0; $a < $k; $a++) {
                for ($b = $a + 1; $b < $k; $b++) {
                    foreach ($groups[$a] as $i => $x) {
                        foreach ($groups[$b] as $j => $y) {
                            $before = self::score($groups[$a]) + self::score($groups[$b]);
                            $ga = $groups[$a];
                            $gb = $groups[$b];
                            $ga[$i] = $y;
                            $gb[$j] = $x;
                            if (self::score($ga) + self::score($gb) > $before + 0.001) {
                                $groups[$a] = $ga;
                                $groups[$b] = $gb;
                                $improved = true;
                                continue 3;
                            }
                        }
                    }
                }
            }
            if (!$improved) {
                break;
            }
        }
        return array_values(array_filter($groups));
    }

    /** Diversity of a group: distinct interests + distinct styles, penalise stacked Fixed Mindset. */
    private static function score(array $g): float
    {
        if (!$g) {
            return 0;
        }
        $primary = count(array_unique(array_map(fn ($m) => $m['riasec'][0], $g)));
        $allLetters = count(array_unique(array_merge(...array_map(fn ($m) => $m['riasec'], $g))));
        $styles = count(array_unique(array_map(fn ($m) => $m['vark'], $g)));
        $fixed = count(array_filter($g, fn ($m) => $m['mindset'] === 'fixed'));
        return $primary * 2 + $allLetters * 0.5 + $styles * 1.2 - max(0, $fixed - self::$fixedCap) * 20 - ($fixed === count($g) ? 3 : 0);
    }

    /** Homogeneous groups by dominant VARK style (split large styles into chunks of $size). */
    private static function similar(array $people, int $size): array
    {
        $byStyle = [];
        foreach ($people as $m) {
            $byStyle[$m['vark'] ?? 'M'][] = $m;
        }
        $groups = [];
        foreach (['K', 'V', 'A', 'R', 'M'] as $style) {
            $list = $byStyle[$style] ?? [];
            if (!$list) {
                continue;
            }
            $k = max(1, (int) ceil(count($list) / $size));
            $chunks = array_fill(0, $k, []);
            foreach ($list as $i => $m) {
                $chunks[$i % $k][] = $m;
            }
            array_push($groups, ...$chunks);
        }
        return $groups;
    }

    // ------------------------------------------------------------------ presentation

    private static function describe(array $groups, string $mode): array
    {
        $out = [];
        foreach ($groups as $gi => $g) {
            // roles: prefer each member's first interest, avoid duplicates within the group
            $taken = [];
            foreach ($g as &$m) {
                $m['role'] = null;
                foreach ($m['riasec'] as $letter) {
                    if (!isset($taken[$letter])) {
                        $taken[$letter] = true;
                        $m['role'] = self::ROLE_TITLE[$letter];
                        break;
                    }
                }
                $m['role'] ??= $m['riasec'] ? self::ROLE_TITLE[$m['riasec'][0]] : 'สมาชิก (ยังไม่มีข้อมูลโปรไฟล์)';
            }
            unset($m);

            $profiled = array_filter($g, fn ($m) => $m['profiled']);
            $letters = array_values(array_unique(array_map(fn ($m) => $m['riasec'][0], $profiled)));
            sort($letters);
            $styles = array_values(array_unique(array_filter(array_map(fn ($m) => $m['vark'], $profiled))));
            $fixed = count(array_filter($g, fn ($m) => $m['mindset'] === 'fixed'));

            $notes = [];
            if ($mode === 'similar' && $styles) {
                $notes[] = 'กลุ่ม' . self::VARK_TH[$styles[0]] . ' — ใช้วิธีซ่อมเสริมเดียวกันได้ทั้งกลุ่ม';
            } else {
                $missing = array_diff(['R', 'I', 'A'], $letters);
                if (count($letters) >= 3) {
                    $notes[] = 'ความสนใจหลากหลาย ' . count($letters) . ' ด้าน — แบ่งบทบาทได้ครบ';
                } elseif ($profiled) {
                    $notes[] = 'ความสนใจค่อนข้างคล้ายกัน — ครูควรช่วยแบ่งบทบาทให้ชัด';
                }
                if ($fixed >= 2) {
                    $notes[] = "มีผู้เรียน Fixed Mindset {$fixed} คน — ติดตามกลุ่มนี้ใกล้ชิด";
                } elseif ($fixed === 1) {
                    $notes[] = 'มีผู้เรียน Fixed Mindset 1 คน อยู่กับเพื่อนที่พร้อมช่วยเหลือ';
                }
                if (count($missing) === 3 && $profiled) {
                    $notes[] = 'ไม่มีสายลงมือ/วิเคราะห์/ออกแบบ — มอบงานที่เน้นการประสานงานหรือนำเสนอ';
                }
            }
            if (count($profiled) < count($g)) {
                $notes[] = (count($g) - count($profiled)) . ' คนยังไม่มีข้อมูลโปรไฟล์';
            }

            $out[] = [
                'no' => $gi + 1,
                'members' => $g,
                'interests' => $letters,
                'styles' => $styles,
                'fixed' => $fixed,
                'notes' => $notes,
            ];
        }
        return $out;
    }
}
