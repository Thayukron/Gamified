<?php
namespace App\Guide;

/**
 * Builds a rule-based teaching guide for one course from its class dashboard data
 * (profile distributions) and the course context (type, department, topics).
 */
class TeachingGuide
{
    private const VARK_TH = ['V' => 'การเห็นภาพ (Visual)', 'A' => 'การฟัง-พูดคุย (Aural)', 'R' => 'การอ่าน-เขียน (Read/Write)', 'K' => 'การลงมือทำ (Kinesthetic)'];
    private const RIASEC_TH = ['R' => 'นักปฏิบัติ (Realistic)', 'I' => 'นักคิดวิเคราะห์ (Investigative)', 'A' => 'นักสร้างสรรค์ (Artistic)', 'S' => 'นักช่วยเหลือ (Social)', 'E' => 'นักริเริ่ม (Enterprising)', 'C' => 'นักจัดระบบ (Conventional)'];
    private const TYPE_TH = ['theory' => 'ทฤษฎี', 'practice' => 'ปฏิบัติ', 'mixed' => 'ทฤษฎี+ปฏิบัติ'];

    public static function build(array $course, array $dash): array
    {
        $profiled = $dash['summary']['profiled'];
        $domain = Knowledge::DOMAIN_BY_DEPARTMENT[$course['department_code'] ?? ''] ?? 'general';
        $type = $course['course_type'] ?? 'mixed';
        $topics = json_decode($course['topics'] ?? '[]', true) ?: [];

        $meta = [
            'domain' => $domain,
            'course_type' => $type,
            'course_type_th' => self::TYPE_TH[$type],
            'topics' => $topics,
            'profiled' => $profiled,
            'enrolled' => $dash['summary']['enrolled'],
        ];
        if ($profiled === 0) {
            return ['meta' => $meta, 'ready' => false];
        }

        // Class shares (average of each student's own proportions).
        $vark = $dash['average']['vark'];
        arsort($vark);
        $varkRank = array_keys($vark);
        $riasec = $dash['average']['riasec'];
        arsort($riasec);
        $riasecRank = array_keys($riasec);
        $mind = $dash['distribution']['mindset'];
        $fixedPct = round($mind['fixed'] / $profiled * 100);
        $diverse = reset($vark) < 35; // no modality clearly dominates

        $primary = $varkRank[0];
        $secondary = $varkRank[1];

        // 1) Summary
        $summary = [];
        $summary[] = $diverse
            ? 'ผู้เรียนห้องนี้มีสไตล์การเรียนรู้หลากหลาย ไม่มีแบบใดโดดเด่นชัด → ควรสลับสื่อหลายรูปแบบในทุกคาบ'
            : sprintf('ผู้เรียนห้องนี้เรียนรู้ได้ดีผ่าน%s (%s%%) รองลงมาคือ%s (%s%%)', self::VARK_TH[$primary], round($vark[$primary]), self::VARK_TH[$secondary], round($vark[$secondary]));
        $summary[] = sprintf('ความสนใจเด่นของห้องคือ%s และ%s → เหมาะกับ%s', self::RIASEC_TH[$riasecRank[0]], self::RIASEC_TH[$riasecRank[1]], Knowledge::RIASEC_METHODS[$riasecRank[0]]['method']);
        $summary[] = $fixedPct >= 30
            ? "มีผู้เรียน Fixed Mindset ถึง {$fixedPct}% → ต้องให้ความสำคัญกับการเสริมแรงเชิงบวกและงานที่สำเร็จได้เร็ว"
            : "ผู้เรียนส่วนใหญ่มี Growth Mindset (Fixed {$fixedPct}%) → ท้าทายด้วยโจทย์ที่ยากขึ้นได้";
        if ($rule = Knowledge::CONTEXT_RULES[$type][$primary] ?? null) {
            $summary[] = $rule;
        }

        // 2) Media & tools, ordered by class share
        $modalities = [];
        foreach ($varkRank as $i => $k) {
            $modalities[] = [
                'key' => $k,
                'label' => self::VARK_TH[$k],
                'share' => $vark[$k],
                'priority' => $i === 0 ? 'หลัก' : ($i === 1 ? 'รอง' : 'เสริม'),
            ] + Knowledge::MODALITY[$domain][$k];
        }

        // 3) Methods from the top two interests
        $methods = array_map(fn ($k) => ['key' => $k, 'label' => self::RIASEC_TH[$k], 'share' => $riasec[$k]] + Knowledge::RIASEC_METHODS[$k], array_slice($riasecRank, 0, 2));

        // 4) Unit-by-unit plan: activities for the two strongest modalities + a retrieval check
        $units = [];
        foreach ($topics as $n => $topic) {
            $acts = [];
            foreach ([$primary, $secondary] as $k) {
                $acts[] = ['key' => $k, 'label' => self::VARK_TH[$k], 'text' => self::topicActivity($topic, $k)];
            }
            $units[] = [
                'no' => $n + 1,
                'topic' => $topic,
                'activities' => $acts,
                'check' => "ควิซสั้นต้นคาบถัดไปทบทวนเรื่อง “{$topic}” (Retrieval Practice)",
            ];
        }

        // 5) Differentiation groups with student names
        $groups = self::groups($dash['students']);

        return [
            'meta' => $meta,
            'ready' => true,
            'summary' => $summary,
            'principles' => Knowledge::PRINCIPLES,
            'modalities' => $modalities,
            'methods' => $methods,
            'group_roles' => array_map(fn ($k) => ['key' => $k, 'label' => self::RIASEC_TH[$k], 'role' => Knowledge::RIASEC_METHODS[$k]['role']], array_keys(Knowledge::RIASEC_METHODS)),
            'units' => $units,
            'mindset' => ['fixed_pct' => $fixedPct, 'class' => Knowledge::MINDSET['class'], 'fixed' => Knowledge::MINDSET['fixed']],
            'groups' => $groups,
            'evaluation' => Knowledge::EVALUATION,
            'caveat' => 'สไตล์การเรียนรู้ (VARK) ใช้เป็นข้อมูลประกอบการเลือกสื่อเพื่อเพิ่มความสนใจและการมีส่วนร่วม งานวิจัยปัจจุบันไม่ยืนยันว่าการสอนตรงสไตล์เพียงแบบเดียวทำให้ผลสัมฤทธิ์สูงขึ้น จึงแนะนำให้สอนหลายรูปแบบ โดยเน้นแบบที่ห้องถนัด ร่วมกับหลักการสอนที่มีหลักฐานรองรับ',
        ];
    }

    private static function topicActivity(string $topic, string $k): string
    {
        foreach (Knowledge::TOPICS as $key => $acts) {
            if (mb_strpos($topic, $key) !== false || mb_strpos($key, $topic) !== false) {
                return $acts[$k];
            }
        }
        return str_replace('{topic}', $topic, Knowledge::TOPIC_TEMPLATE[$k]);
    }

    /** Named student groups the teacher can act on directly. */
    private static function groups(array $students): array
    {
        $byVark = ['V' => [], 'A' => [], 'R' => [], 'K' => [], 'multi' => []];
        $fixed = [];
        $notStarted = [];
        foreach ($students as $s) {
            $name = ['id' => $s['id'], 'code' => $s['student_code'], 'name' => $s['full_name']];
            $p = $s['profile'];
            if (!$p) {
                $notStarted[] = $name;
                continue;
            }
            $v = $p['dominant_vark'];
            $byVark[$v && strlen($v) === 1 ? $v : 'multi'][] = $name;
            if ($p['mindset_type'] === 'fixed') {
                $fixed[] = $name;
            }
        }

        $groups = [];
        if ($fixed) {
            $groups[] = ['key' => 'fixed', 'title' => 'กลุ่มควรดูแลเป็นพิเศษ: Fixed Mindset', 'advice' => Knowledge::MINDSET['fixed'], 'students' => $fixed, 'tone' => 'care'];
        }
        foreach (['K', 'V', 'A', 'R'] as $k) {
            if ($byVark[$k]) {
                $groups[] = ['key' => "vark_$k", 'title' => 'กลุ่ม' . self::VARK_TH[$k], 'advice' => [Knowledge::REMEDIAL[$k]], 'students' => $byVark[$k], 'tone' => 'vark'];
            }
        }
        if ($byVark['multi']) {
            $groups[] = ['key' => 'vark_multi', 'title' => 'กลุ่มเรียนรู้หลายช่องทาง (Multimodal)', 'advice' => ['ใช้สื่อผสมหลายรูปแบบ ปรับตัวได้ดีกับทุกกิจกรรม'], 'students' => $byVark['multi'], 'tone' => 'vark'];
        }
        if ($notStarted) {
            $groups[] = ['key' => 'not_started', 'title' => 'ยังไม่มีข้อมูล (ยังไม่เล่นเกม)', 'advice' => ['นัดให้เล่นเควสต์ในคาบถัดไป (ใช้เวลาประมาณ 10–15 นาทีต่อเควสต์) เพื่อให้ไกด์ครอบคลุมทุกคน'], 'students' => $notStarted, 'tone' => 'muted'];
        }
        return $groups;
    }
}
