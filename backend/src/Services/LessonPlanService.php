<?php
namespace App\Services;

use App\Core\HttpException;
use App\Guide\TeachingGuide;

/**
 * Unit lesson plan in the OVEC 2567 competency-based form (แผนการจัดการเรียนรู้ ข้อ 1–10).
 * Content is a fixed JSON shape (EMPTY); every value is plain text, multi-line allowed.
 * Drafts come from the rule-based guide (no AI) or from Gemini with the teacher's own key.
 */
class LessonPlanService
{
    /** The plan's sections. Keys are stable — the editor and the Word export read them. */
    public const EMPTY = [
        'outcome' => '',                                   // 1 ผลลัพธ์การเรียนรู้ระดับหน่วยการเรียน
        'standard' => [                                    // 2 อ้างอิงมาตรฐาน/เชื่อมโยงกลุ่มอาชีพ
            'occupation' => '', 'sub_competency' => '', 'criteria' => '', 'method' => '',
            'performance_evidence' => '', 'knowledge_evidence' => '', 'career_integration' => '',
        ],
        'competency' => ['knowledge' => '', 'practice' => '', 'apply' => ''],                       // 3 สมรรถนะประจำหน่วย
        'objectives' => ['cognitive' => '', 'psychomotor' => '', 'affective' => '', 'application' => ''], // 4 จุดประสงค์เชิงพฤติกรรม
        'content' => '',                                   // 5 สาระการเรียนรู้
        'activities' => ['motivation' => '', 'information' => '', 'application' => '', 'progress' => ''], // 6 MIAP
        'differentiation' => '',                           // 6 (ต่อ) การปรับกิจกรรมตามผลวิเคราะห์ผู้เรียน
        'media' => '',                                     // 7 สื่อและแหล่งการเรียนรู้
        'evidence' => ['knowledge' => '', 'performance' => ''],                                   // 8 หลักฐานการเรียนรู้
        'assessment' => ['criteria' => '', 'methods' => '', 'tools' => ''],                         // 9 การวัดและประเมินผล
        'after' => ['results' => '', 'problems' => '', 'solution_result' => '', 'next_time' => ''], // 10 บันทึกหลังการจัดการเรียนรู้
    ];

    /** Merge stored/submitted content onto EMPTY: unknown keys dropped, every leaf a trimmed string. */
    public static function normalize(mixed $content): array
    {
        $in = is_array($content) ? $content : [];
        $out = [];
        foreach (self::EMPTY as $key => $default) {
            if (is_array($default)) {
                $sub = is_array($in[$key] ?? null) ? $in[$key] : [];
                foreach ($default as $k => $_) {
                    $out[$key][$k] = self::text($sub[$k] ?? '');
                }
            } else {
                $out[$key] = self::text($in[$key] ?? '');
            }
        }
        return $out;
    }

    private static function text(mixed $v): string
    {
        if (is_array($v)) {
            $v = implode("\n", array_map(fn ($x) => is_scalar($x) ? (string) $x : '', $v));
        }
        return is_scalar($v) ? mb_substr(trim(str_replace("\r", '', (string) $v)), 0, 6000) : '';
    }

    /** Share of filled sections (for progress badges). */
    public static function completeness(array $c): int
    {
        $leaves = 0;
        $filled = 0;
        foreach (self::EMPTY as $key => $default) {
            if ($key === 'after' || $key === 'standard') {
                continue; // written after teaching / only when the course references a standard
            }
            foreach (is_array($default) ? array_keys($default) : [null] as $k) {
                $leaves++;
                $filled += ($k === null ? $c[$key] : $c[$key][$k]) !== '' ? 1 : 0;
            }
        }
        return (int) round($filled / max(1, $leaves) * 100);
    }

    /** ปวช. → “แสดงความรู้เกี่ยวกับ…”, ปวส. → “ประมวลความรู้เกี่ยวกับ…” (form rule). */
    public static function isHigher(array $course): bool
    {
        return str_contains((string) ($course['level'] ?? ''), 'ปวส') || str_contains((string) ($course['section'] ?? ''), 'ปวส');
    }

    // ------------------------------------------------------------------ learner analysis (appendix)

    /** Anonymous class profile used for the appendix and to adapt the plan. */
    public static function learners(array $course, array $dash): array
    {
        $guide = TeachingGuide::build($course, $dash);
        $profiled = $dash['summary']['profiled'];
        $vark = $dash['average']['vark'];
        arsort($vark);
        $riasec = $dash['average']['riasec'];
        arsort($riasec);
        return [
            'enrolled' => $dash['summary']['enrolled'],
            'profiled' => $profiled,
            'ready' => $profiled > 0,
            'vark' => array_map(fn ($k) => ['key' => $k, 'label' => TeachingGuide::VARK_TH[$k], 'pct' => round($vark[$k])], array_keys($vark)),
            'vark_count' => $dash['distribution']['vark'],
            'riasec' => array_map(fn ($k) => ['key' => $k, 'label' => TeachingGuide::RIASEC_TH[$k], 'pct' => round($riasec[$k])], array_keys($riasec)),
            'mindset' => $dash['distribution']['mindset'],
            'summary' => $guide['summary'] ?? [],
            'term' => $dash['term'],
        ];
    }

    // ------------------------------------------------------------------ rule-based draft (no AI)

    /** Fill the plan from the rule-based teaching guide — always available, no API key needed. */
    public static function prefill(array $course, array $dash, array $plan): array
    {
        $c = self::EMPTY;
        $topic = $plan['title'] !== '' ? $plan['title'] : $plan['unit_name'];
        $verb = self::isHigher($course) ? 'ประมวลความรู้เกี่ยวกับ' : 'แสดงความรู้เกี่ยวกับ';

        $c['outcome'] = "ผู้เรียนนำความรู้และทักษะเรื่อง{$topic} ไปประยุกต์ใช้ในการปฏิบัติงานและชีวิตประจำวันได้อย่างถูกต้อง";
        $c['competency'] = [
            'knowledge' => "{$verb}{$topic}",
            'practice' => "ปฏิบัติงาน{$topic} ตามขั้นตอนและข้อกำหนดที่ถูกต้อง",
            'apply' => "ประยุกต์ใช้ความรู้เรื่อง{$topic} แก้ปัญหาในงานอาชีพได้",
        ];
        $c['objectives'] = [
            'cognitive' => "อธิบายหลักการของ{$topic}ได้ถูกต้อง",
            'psychomotor' => "ปฏิบัติงาน{$topic}ตามขั้นตอนได้ถูกต้อง",
            'affective' => 'มีความรับผิดชอบ ตรงต่อเวลา และทำงานร่วมกับผู้อื่นได้',
            'application' => "ประยุกต์ใช้{$topic}ในสถานการณ์ใหม่ได้อย่างเหมาะสม",
        ];
        $c['content'] = $topic;
        $c['evidence'] = ['knowledge' => 'ผลการทดสอบ / แบบฝึกหัด / การตอบคำถาม', 'performance' => 'ผลงานจากใบงาน / การสังเกตการปฏิบัติงาน'];
        $c['assessment'] = [
            'criteria' => 'ผ่านเกณฑ์ร้อยละ 60 ขึ้นไป',
            'methods' => "ทดสอบความรู้\nตรวจผลงานจากใบงาน\nสังเกตพฤติกรรมการปฏิบัติงานและกิจนิสัย",
            'tools' => "แบบทดสอบ\nแบบประเมินผลงาน (Rubric)\nแบบสังเกตพฤติกรรม",
        ];

        $guide = TeachingGuide::build($course, $dash);
        if (!($guide['ready'] ?? false)) {
            $c['activities'] = [
                'motivation' => "ครูนำเข้าสู่บทเรียนด้วยสถานการณ์/ปัญหาจริงที่เกี่ยวกับ{$topic} และตั้งคำถามกระตุ้นความสนใจ",
                'information' => "ครูอธิบายเนื้อหา{$topic} พร้อมตัวอย่าง ผู้เรียนศึกษาใบความรู้",
                'application' => 'ผู้เรียนฝึกปฏิบัติตามใบงาน ครูให้คำแนะนำรายบุคคล',
                'progress' => 'ผู้เรียนนำเสนอผลงาน ครูและผู้เรียนร่วมกันสรุป ทำแบบทดสอบท้ายหน่วย',
            ];
            return $c;
        }

        $unit = null;
        foreach ($guide['units'] as $u) {
            if ($u['no'] === (int) $plan['unit_no'] || $u['topic'] === $plan['unit_name']) {
                $unit = $u;
                break;
            }
        }
        $acts = $unit['activities'] ?? array_map(fn ($m) => ['label' => $m['label'], 'text' => $m['activities'][0] ?? ''], array_slice($guide['modalities'], 0, 2));
        $primary = $guide['modalities'][0];
        $method = $guide['methods'][0] ?? null;

        $c['activities'] = [
            'motivation' => "ครูนำเข้าสู่บทเรียนด้วยสถานการณ์/ปัญหาจริงที่เกี่ยวกับ{$topic}" . ($primary['media'][0] ?? '' ? " โดยใช้{$primary['media'][0]}" : '') . ' และตั้งคำถามกระตุ้นความสนใจ',
            'information' => "ครูอธิบายเนื้อหา{$topic} โดยสลับสื่อหลายรูปแบบ เน้น{$primary['label']} ซึ่งเป็นช่องทางที่ผู้เรียนห้องนี้ถนัด",
            'application' => implode("\n", array_map(fn ($a) => $a['text'], $acts)) . ($method ? "\nจัดกิจกรรมแบบ{$method['method']} ตามความสนใจเด่นของห้อง" : ''),
            'progress' => $unit['check'] ?? 'ผู้เรียนสรุปความรู้และทำแบบทดสอบท้ายหน่วย',
        ];
        $c['media'] = implode("\n", array_unique(array_merge(...array_map(fn ($m) => array_slice($m['media'], 0, 1), array_slice($guide['modalities'], 0, 3)))));
        $diff = array_map(fn ($a) => "ผู้เรียนสาย{$a['label']}: {$a['text']}", $acts);
        if ($guide['mindset']['fixed_pct'] > 0) {
            $diff[] = "ผู้เรียน Fixed Mindset ({$guide['mindset']['fixed_pct']}%): " . $guide['mindset']['fixed'][0];
        }
        $c['differentiation'] = implode("\n", $diff);
        return $c;
    }

    // ------------------------------------------------------------------ AI draft (teacher's own Gemini key)

    /** Ask Gemini for a full draft. Returns ['content' => …, 'model' => …]; nothing is saved here. */
    public static function aiDraft(int $userId, array $course, array $dash, array $plan): array
    {
        if (!AiGuideService::enabled()) {
            throw new HttpException(403, 'ผู้ดูแลระบบปิดการใช้งานฟังก์ชัน AI อยู่');
        }
        $r = AiGuideService::resolve($userId);
        if (!$r['key']) {
            throw new HttpException(409, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อน หรือใช้ปุ่ม “เติมจากไกด์ (ไม่ใช้ AI)”');
        }
        set_time_limit(300);
        $ctx = AiGuideService::context($course, $dash);
        $res = (new GeminiClient($r['key']))->generateJsonResilient($r['model'] ?: 'gemini-flash-latest', self::SYSTEM, self::prompt($course, $ctx, $plan));
        $content = self::normalize($res['data']);
        $content['after'] = self::EMPTY['after']; // written by the teacher after teaching
        return ['content' => $content, 'model' => $res['model']];
    }

    private const SYSTEM = 'คุณเป็นศึกษานิเทศก์ผู้เชี่ยวชาญการเขียนแผนการจัดการเรียนรู้ฐานสมรรถนะ หลักสูตร ปวช./ปวส. 2567 ของสำนักงานคณะกรรมการการอาชีวศึกษา '
        . 'เขียนตามแบบฟอร์มทางการ ใช้ภาษาไทยทางการ กระชับ นำไปใช้สอนได้จริง เจาะจงกับเนื้อหาหน่วย '
        . 'ปรับกิจกรรมและสื่อให้เหมาะกับผลวิเคราะห์ผู้เรียนของห้อง (สถิติรวม ไม่มีข้อมูลรายบุคคล) โดยยังใช้สื่อหลายรูปแบบ '
        . 'ห้ามแต่งรหัสหรือชื่อมาตรฐานอาชีพ/หน่วยสมรรถนะที่ไม่แน่ใจว่ามีจริง ถ้าไม่ทราบให้เว้นว่าง "" '
        . 'แนะนำเฉพาะสื่อ/เว็บไซต์ที่มีอยู่จริง ตอบเป็น JSON ตามโครงสร้างที่กำหนดเท่านั้น';

    /** Course content from the official curriculum (entered on the course form) — the AI must stay within it. */
    public static function curriculumText(array $course): string
    {
        $parts = [];
        foreach (['description' => 'คำอธิบายรายวิชา', 'objectives' => 'จุดประสงค์รายวิชา', 'competencies' => 'สมรรถนะรายวิชา', 'outcome' => 'ผลลัพธ์การเรียนรู้ระดับรายวิชา'] as $k => $label) {
            if (trim((string) ($course[$k] ?? '')) !== '') {
                $parts[] = "{$label}:\n" . mb_substr(trim($course[$k]), 0, 2500);
            }
        }
        return $parts ? "หลักสูตรรายวิชา (ใช้เป็นขอบเขตเนื้อหา ห้ามออกนอกหลักสูตร):\n" . implode("\n", $parts) . "\n\n" : '';
    }

    private static function prompt(array $course, array $ctx, array $plan): string
    {
        $verb = self::isHigher($course) ? 'ประมวลความรู้เกี่ยวกับ' : 'แสดงความรู้เกี่ยวกับ';
        $level = self::isHigher($course) ? 'ปวส.' : 'ปวช.';
        $hours = "ทฤษฎี {$plan['hours_theory']} ชม. ปฏิบัติ {$plan['hours_practice']} ชม.";
        $title = $plan['title'] !== '' ? $plan['title'] : $plan['unit_name'];
        return self::curriculumText($course) . "ข้อมูลรายวิชาและผู้เรียน:\n" . json_encode($ctx, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
            . "\n(vark_percent V=ภาพ A=ฟัง R=อ่านเขียน K=ลงมือทำ · riasec_percent R=ปฏิบัติ I=วิเคราะห์ A=สร้างสรรค์ S=ช่วยเหลือ E=ริเริ่ม C=จัดระบบ · mindset_percent)\n\n"
            . "จงเขียนแผนการจัดการเรียนรู้ระดับ {$level} หน่วยที่ {$plan['unit_no']} “{$plan['unit_name']}” เรื่อง/งาน “{$title}” สอนครั้งที่ {$plan['session_no']} ({$hours})\n"
            . "กติกาของแบบฟอร์ม:\n"
            . "- outcome: ผลลัพธ์นอกห้องเรียนที่เกิดจากการนำความรู้/ทักษะไปใช้ในชีวิตประจำวันหรืองานอาชีพ 1-2 ประโยค\n"
            . "- competency: รูปแบบ “กริยา + กรรม + เงื่อนไข” · knowledge ขึ้นต้นด้วย “{$verb}” · practice = กริยาการปฏิบัติงาน + งาน + เงื่อนไข (ข้อกำหนด/มาตรฐาน) · apply = การประยุกต์ใช้\n"
            . "- objectives: รูปแบบ “พฤติกรรม + เงื่อนไข/เนื้อหา + เกณฑ์” แต่ละด้าน 1-3 ข้อ ขึ้นบรรทัดใหม่คั่นข้อ · cognitive (บอก อธิบาย จำแนก…) · psychomotor (ทำตามขั้นตอน ทำได้ถูกต้อง…) · affective (กิจนิสัย ความรับผิดชอบ…) · application (ประยุกต์ใช้และรับผิดชอบ)\n"
            . "- activities: MIAP · motivation=ขั้นสนใจปัญหา · information=ขั้นศึกษาข้อมูล · application=ขั้นพยายาม/ฝึกปฏิบัติ · progress=ขั้นสำเร็จผล · ระบุสิ่งที่ครูและผู้เรียนทำ และเวลาโดยประมาณ (นาที) รวมให้พอดีกับชั่วโมงของหน่วย\n"
            . "- differentiation: การปรับกิจกรรม/สื่อตามผลวิเคราะห์ผู้เรียนห้องนี้ (สไตล์การเรียนรู้เด่น ความสนใจเด่น และการดูแลผู้เรียน Fixed Mindset) 3-5 บรรทัด\n"
            . "- standard: occupation/sub_competency/criteria/method ให้เว้นว่างถ้าไม่ทราบมาตรฐานอาชีพที่มีจริง · performance_evidence/knowledge_evidence/career_integration เขียนได้\n"
            . "ตอบเป็น JSON (ค่าทุกช่องเป็นข้อความ ใช้ \\n ขึ้นบรรทัดใหม่):\n"
            . '{"outcome":"","standard":{"occupation":"","sub_competency":"","criteria":"","method":"","performance_evidence":"","knowledge_evidence":"","career_integration":""},'
            . '"competency":{"knowledge":"","practice":"","apply":""},"objectives":{"cognitive":"","psychomotor":"","affective":"","application":""},'
            . '"content":"หัวข้อสาระการเรียนรู้ เป็นข้อ ๆ","activities":{"motivation":"","information":"","application":"","progress":""},"differentiation":"",'
            . '"media":"สื่อและแหล่งการเรียนรู้ เป็นข้อ ๆ","evidence":{"knowledge":"","performance":""},"assessment":{"criteria":"","methods":"","tools":""}}';
    }
}
