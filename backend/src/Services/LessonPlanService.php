<?php
namespace App\Services;

use App\Core\HttpException;
use App\Guide\Knowledge;
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
        return is_scalar($v) ? mb_substr(trim(str_replace("\r", '', (string) $v)), 0, 10000) : '';
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
        // content outline and media follow the unit topic (knowledge base), not just the class's learning styles
        $domain = Knowledge::DOMAIN_BY_DEPARTMENT[$course['department_code'] ?? ''] ?? 'general';
        $key = $domain === 'it' ? Knowledge::topicKey($plan['title'], $plan['unit_name']) : null;
        $c['content'] = implode("\n", $key ? Knowledge::TOPIC_DETAIL[$key]['content'] : str_replace('{topic}', $topic, Knowledge::CONTENT_TEMPLATE));
        $c['evidence'] = ['knowledge' => 'ผลการทดสอบ / แบบฝึกหัด / การตอบคำถาม', 'performance' => 'ผลงานจากใบงาน / การสังเกตการปฏิบัติงาน'];
        $c['assessment'] = [
            'criteria' => 'ผ่านเกณฑ์ร้อยละ 60 ขึ้นไป',
            'methods' => "ทดสอบความรู้\nตรวจผลงานจากใบงาน\nสังเกตพฤติกรรมการปฏิบัติงานและกิจนิสัย",
            'tools' => "แบบทดสอบ\nแบบประเมินผลงาน (Rubric)\nแบบสังเกตพฤติกรรม",
        ];

        $guide = TeachingGuide::build($course, $dash);
        $order = array_column($guide['modalities'] ?? [], 'key') ?: ['V', 'R', 'K'];
        $c['media'] = implode("\n", self::topicMedia($topic, $key, $domain, $order));
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
            'motivation' => "ครูนำเข้าสู่บทเรียนด้วยสถานการณ์/ปัญหาจริงที่เกี่ยวกับ{$topic}" . ($key ? ' โดยใช้ ' . Knowledge::TOPIC_DETAIL[$key]['media'][0] : '') . ' และตั้งคำถามกระตุ้นความสนใจ',
            'information' => "ครูอธิบายเนื้อหา{$topic} โดยสลับสื่อหลายรูปแบบ เน้น{$primary['label']} ซึ่งเป็นช่องทางที่ผู้เรียนห้องนี้ถนัด",
            'application' => implode("\n", array_map(fn ($a) => $a['text'], $acts)) . ($method ? "\nจัดกิจกรรมแบบ{$method['method']} ตามความสนใจเด่นของห้อง" : ''),
            'progress' => $unit['check'] ?? 'ผู้เรียนสรุปความรู้และทำแบบทดสอบท้ายหน่วย',
        ];
        $diff = array_map(fn ($a) => "ผู้เรียนสาย{$a['label']}: {$a['text']}", $acts);
        if ($guide['mindset']['fixed_pct'] > 0) {
            $diff[] = "ผู้เรียน Fixed Mindset ({$guide['mindset']['fixed_pct']}%): " . $guide['mindset']['fixed'][0];
        }
        $c['differentiation'] = implode("\n", $diff);
        return $c;
    }

    /**
     * Media for one unit: the knowledge-base list for a known topic, otherwise templates named after the topic
     * in the class's modality order — always with the unit's knowledge sheet and worksheet.
     */
    private static function topicMedia(string $topic, ?string $key, string $domain, array $order): array
    {
        if ($key) {
            $media = Knowledge::TOPIC_DETAIL[$key]['media'];
        } else {
            $media = [];
            foreach (array_slice($order, 0, 3) as $k) {
                $t = Knowledge::MEDIA_TEMPLATE[$k];
                $media[] = str_replace('{topic}', $topic, is_array($t) ? $t[$domain] : $t);
            }
        }
        foreach (["ใบความรู้ เรื่อง {$topic}", "ใบงาน/ใบกิจกรรม เรื่อง {$topic}"] as $sheet) {
            $media[] = $sheet;
        }
        return array_values(array_unique($media));
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
        $res = (new GeminiClient($r['key']))->generateJsonResilient($r['model'] ?: 'gemini-flash-latest', self::SYSTEM, self::prompt($course, $ctx, $plan), 2, 24000);
        $content = self::normalize($res['data']);
        $content['after'] = self::EMPTY['after']; // written by the teacher after teaching
        return ['content' => $content, 'model' => $res['model']];
    }

    /**
     * Section 2 from the real occupational standards of the Thailand Professional Qualification Institute (TPQI),
     * found with Google Search grounding. Nothing relevant found -> found=false and every field empty
     * (the teacher leaves 2.1 blank, as the form allows). The teacher reviews the result before saving.
     * @return array{found: bool, standard: array, note: string, sources: array, grounded: bool, model: string}
     */
    public static function aiStandard(int $userId, array $course, array $plan): array
    {
        if (!AiGuideService::enabled()) {
            throw new HttpException(403, 'ผู้ดูแลระบบปิดการใช้งานฟังก์ชัน AI อยู่');
        }
        $r = AiGuideService::resolve($userId);
        if (!$r['key']) {
            throw new HttpException(409, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อน');
        }
        set_time_limit(180);
        $c = json_decode((string) ($plan['content'] ?? ''), true)['competency'] ?? [];
        $level = self::isHigher($course) ? 'ปวส.' : 'ปวช.';
        $info = "รายวิชา: {$course['code']} {$course['name']} ({$level}" . (!empty($course['department_name']) ? " แผนก{$course['department_name']}" : '') . ")\n"
            . 'หน่วยที่ ' . $plan['unit_no'] . ': ' . $plan['unit_name'] . ($plan['title'] !== '' && $plan['title'] !== $plan['unit_name'] ? " · เรื่อง {$plan['title']}" : '') . "\n"
            . (trim((string) ($course['standards_ref'] ?? '')) !== '' ? "อ้างอิงมาตรฐานในหลักสูตรรายวิชา: " . mb_substr(trim($course['standards_ref']), 0, 800) . "\n" : '')
            . (trim((string) ($course['description'] ?? '')) !== '' ? "คำอธิบายรายวิชา: " . mb_substr(trim($course['description']), 0, 1200) . "\n" : '')
            . (array_filter($c) ? 'สมรรถนะประจำหน่วย: ' . implode(' / ', array_filter([$c['knowledge'] ?? '', $c['practice'] ?? '', $c['apply'] ?? ''])) . "\n" : '');
        $prompt = $info . "\n"
            . "งาน: ค้นหามาตรฐานอาชีพของสถาบันคุณวุฒิวิชาชีพ (องค์การมหาชน) หรือ TPQI (เว็บไซต์ tpqi.go.th และระบบ tpqi-net) ที่มีอยู่จริงและสอดคล้องกับเนื้อหาหน่วยนี้มากที่สุด "
            . "ระบุสาขาวิชาชีพ/อาชีพ/ชั้นคุณวุฒิ และหน่วยสมรรถนะ/สมรรถนะย่อยที่ตรงกับหน่วยนี้ แล้วสรุปเกณฑ์การปฏิบัติงาน วิธีประเมิน หลักฐานการปฏิบัติงาน และหลักฐานความรู้ ตามที่มาตรฐานนั้นกำหนด\n"
            . "กติกา:\n"
            . "- ใช้เฉพาะข้อมูลที่พบจากผลการค้นหา ห้ามแต่งชื่อ รหัส หรือเนื้อหามาตรฐานขึ้นเอง\n"
            . "- ถ้าไม่พบมาตรฐานอาชีพที่สอดคล้องกับหน่วยนี้จริง ให้ found = false และทุกช่องเป็น \"\"\n"
            . "- occupation: \"มาตรฐานอาชีพ สาขาวิชาชีพ… อาชีพ… ชั้น …\" · sub_competency: \"รหัส ชื่อหน่วยสมรรถนะ/สมรรถนะย่อย\"\n"
            . "- criteria/method/performance_evidence/knowledge_evidence: เขียนเป็นข้อ \"1. …\" ขึ้นบรรทัดใหม่ทีละข้อ ภาษาไทยทางการ\n"
            . "- career_integration: อาชีพ/ลักษณะงานในกลุ่มอาชีพที่นำสมรรถนะนี้ไปใช้ (เขียนเฉพาะเมื่อ found = true)\n"
            . "- note: เหตุผลสั้น ๆ 1–2 ประโยคว่ามาตรฐานนี้สอดคล้องกับหน่วยอย่างไร (หรือทำไมไม่พบ)\n"
            . "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น:\n"
            . '{"found":true,"occupation":"","sub_competency":"","criteria":"","method":"","performance_evidence":"","knowledge_evidence":"","career_integration":"","note":""}';
        $system = 'คุณเป็นผู้เชี่ยวชาญมาตรฐานอาชีพและคุณวุฒิวิชาชีพของประเทศไทย (สถาบันคุณวุฒิวิชาชีพ) ช่วยครูอาชีวศึกษาอ้างอิงมาตรฐานอาชีพในแผนการจัดการเรียนรู้ '
            . 'ค้นหาข้อมูลจริงก่อนตอบเสมอ ตอบตามข้อเท็จจริงจากแหล่งที่ค้นพบเท่านั้น ถ้าไม่แน่ใจให้ตอบว่าไม่พบ';
        $client = new GeminiClient($r['key']);
        $model = $r['model'] ?: 'gemini-flash-latest';
        $grounded = true;
        try {
            $res = $client->generateJsonResilient($model, $system, $prompt, 2, 8192, true);
        } catch (HttpException $e) {
            // Free-tier keys often have no Google Search quota (429/403): answer from the model's own knowledge,
            // stricter, and tell the teacher to verify on the TPQI site.
            if (!in_array($e->status, [429, 422, 403], true)) {
                throw $e;
            }
            $grounded = false;
            $prompt = str_replace('- ใช้เฉพาะข้อมูลที่พบจากผลการค้นหา ห้ามแต่งชื่อ รหัส หรือเนื้อหามาตรฐานขึ้นเอง',
                '- (ค้นหาเว็บไม่ได้ในครั้งนี้) ตอบจากความรู้ที่มั่นใจว่าถูกต้องเท่านั้น ห้ามแต่งชื่อหรือเนื้อหามาตรฐาน · ถ้าไม่แน่ใจรหัสหน่วยสมรรถนะให้ใส่เฉพาะชื่อ ไม่ต้องใส่รหัส · ไม่แน่ใจว่ามีมาตรฐานนี้จริงให้ found = false', $prompt);
            $res = $client->generateJsonResilient($model, $system, $prompt, 2, 8192);
        }
        $d = $res['data'];
        $found = !empty($d['found']) && trim((string) ($d['occupation'] ?? '')) !== '';
        $std = [];
        foreach (self::EMPTY['standard'] as $k => $_) {
            $std[$k] = $found ? self::text($d[$k] ?? '') : '';
        }
        return [
            'found' => $found,
            'standard' => $std,
            'note' => mb_substr(trim((string) ($d['note'] ?? '')), 0, 500),
            'sources' => array_slice($res['sources'] ?? [], 0, 6),
            'grounded' => $grounded, // false = not verified against the web: the teacher must check tpqi.go.th
            'model' => $res['model'],
        ];
    }

    private const SYSTEM = 'คุณเป็นศึกษานิเทศก์ผู้เชี่ยวชาญการเขียนแผนการจัดการเรียนรู้ฐานสมรรถนะ หลักสูตร ปวช./ปวส. 2567 ของสำนักงานคณะกรรมการการอาชีวศึกษา '
        . 'เขียนตามแบบฟอร์มทางการ ใช้ภาษาไทยทางการ เนื้อหาถูกต้องตามหลักวิชา ละเอียดครบถ้วนได้ใจความ นำไปใช้สอนได้จริง เจาะจงกับเนื้อหาหน่วย (ไม่เขียนกว้าง ๆ หรือมีแค่ชื่อหัวข้อ) '
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
            . "กติกาของแบบฟอร์มและความละเอียดที่ต้องการ (เขียนให้ครบ ได้ใจความ ครูนำไปสอนได้ทันทีโดยไม่ต้องเติม):\n"
            . "- outcome: ผลลัพธ์นอกห้องเรียน 2-3 ประโยค ระบุว่าผู้เรียนนำความรู้/ทักษะไปทำอะไรได้ในงานอาชีพหรือชีวิตจริง พร้อมตัวอย่างสถานการณ์\n"
            . "- competency: รูปแบบ “กริยา + กรรม + เงื่อนไข” · knowledge ขึ้นต้นด้วย “{$verb}” ระบุเนื้อหาหลัก · practice = กริยาการปฏิบัติงาน + งาน + เงื่อนไข (เครื่องมือ ข้อกำหนด มาตรฐาน) · apply = การประยุกต์ใช้ในสถานการณ์จริง\n"
            . "- objectives: รูปแบบ “พฤติกรรม + เงื่อนไข/เนื้อหา + เกณฑ์ที่วัดได้” (เช่น “ได้ถูกต้องอย่างน้อย 4 ใน 5 ข้อ”, “ภายในเวลา 30 นาที”) · cognitive 2-3 ข้อ · psychomotor 2-3 ข้อ · affective 1-2 ข้อ · application 1-2 ข้อ · 1 บรรทัด = 1 ข้อ ไม่ต้องใส่เลขข้อ\n"
            . "- content (สำคัญที่สุด ต้องละเอียด): สาระการเรียนรู้ 4-7 หัวข้อหลัก เรียงจากพื้นฐานไปประยุกต์ แต่ละหัวข้อเขียนบรรทัด “1. ชื่อหัวข้อ” "
            . "ตามด้วยบรรทัดคำอธิบายสาระสำคัญ 2-4 ประโยค (นิยาม หลักการ วิธีการ/ขั้นตอน สูตรหรือตัวอย่างประกอบที่ถูกต้องตามหลักวิชา) "
            . "และหัวข้อย่อย “1.1 …” “1.2 …” พร้อมคำอธิบายสั้นเมื่อมีประเด็นย่อย · ความยาวรวมประมาณ 1,500-3,000 ตัวอักษร\n"
            . "- activities: MIAP · motivation=ขั้นสนใจปัญหา · information=ขั้นศึกษาข้อมูล · application=ขั้นพยายาม/ฝึกปฏิบัติ · progress=ขั้นสำเร็จผล · "
            . "แต่ละขั้นเขียนเป็นลำดับขั้นตอน 3-6 บรรทัด บรรทัดละ 1 ขั้นตอน รูปแบบ “1. ครู… ผู้เรียน… (xx นาที)” ระบุคำถามกระตุ้น ตัวอย่าง/โจทย์ที่ใช้ สื่อที่ใช้ และงานที่ผู้เรียนต้องทำจริง · รวมเวลาทุกขั้นให้เท่ากับชั่วโมงของครั้งนี้\n"
            . "- differentiation: การปรับกิจกรรม/สื่อตามผลวิเคราะห์ผู้เรียนห้องนี้ 4-6 บรรทัด แยกตามกลุ่ม (สไตล์การเรียนรู้เด่น ความสนใจเด่น ผู้เรียน Fixed Mindset ผู้เรียนเรียนเร็ว/ต้องช่วยเหลือ) บอกวิธีทำที่ชัดเจน\n"
            . "- media: 4-8 รายการ บรรทัดละ 1 รายการ “ชื่อสื่อ/แหล่งเรียนรู้ – ใช้ในขั้นไหน เพื่ออะไร” ใช้สื่อที่มีอยู่จริง\n"
            . "- evidence: knowledge และ performance อย่างละ 2-4 รายการ บรรทัดละ 1 รายการ เป็นชิ้นงาน/ผลการทดสอบที่จับต้องได้\n"
            . "- assessment: criteria = เกณฑ์ผ่านเป็นตัวเลข/ระดับคุณภาพชัดเจน · methods = วิธีประเมินที่จับคู่กับจุดประสงค์แต่ละด้าน · tools = เครื่องมือประเมินที่ระบุชื่อ (เช่น แบบทดสอบ 10 ข้อ, แบบประเมินผลงาน Rubric 4 ระดับ) · บรรทัดละ 1 รายการ\n"
            . "- standard: occupation/sub_competency/criteria/method ให้เว้นว่างถ้าไม่ทราบมาตรฐานอาชีพที่มีจริง · performance_evidence/knowledge_evidence/career_integration เขียนได้ (career_integration ระบุอาชีพ/ลักษณะงานที่เชื่อมโยง)\n"
            . "ตอบเป็น JSON (ค่าทุกช่องเป็นข้อความ ใช้ \\n ขึ้นบรรทัดใหม่):\n"
            . '{"outcome":"","standard":{"occupation":"","sub_competency":"","criteria":"","method":"","performance_evidence":"","knowledge_evidence":"","career_integration":""},'
            . '"competency":{"knowledge":"","practice":"","apply":""},"objectives":{"cognitive":"","psychomotor":"","affective":"","application":""},'
            . '"content":"1. หัวข้อ\\nคำอธิบายสาระสำคัญ…\\n1.1 หัวข้อย่อย…\\n2. …","activities":{"motivation":"","information":"","application":"","progress":""},"differentiation":"",'
            . '"media":"","evidence":{"knowledge":"","performance":""},"assessment":{"criteria":"","methods":"","tools":""}}';
    }
}
