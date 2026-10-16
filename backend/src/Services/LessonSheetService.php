<?php
namespace App\Services;

use App\Core\HttpException;

/**
 * Supporting documents of a unit plan, in the OVEC 2567 form:
 * ใบความรู้ (knowledge) · ใบงาน (job) · ใบกิจกรรม (activity) · ใบมอบหมายงาน (assignment) · แบบประเมิน (assessment).
 * Sections 1–4 (outcome, standard, competency, objectives) start as a copy of the plan; the rest is drafted
 * from the plan (no AI) or by Gemini with the teacher's own key.
 */
class LessonSheetService
{
    /** Text fields of each type, in form order (labels live in the frontend). */
    public const FIELDS = [
        'knowledge' => ['outcome', 'standard', 'competency', 'objectives', 'content', 'exercises', 'references', 'appendix'],
        'job' => ['outcome', 'standard', 'competency', 'objectives', 'tools', 'advice', 'steps', 'conclusion', 'evaluation', 'references'],
        'activity' => ['outcome', 'standard', 'competency', 'objectives', 'tools', 'steps', 'conclusion', 'evaluation', 'references'],
        'assignment' => ['outcome', 'standard', 'competency', 'objectives', 'details', 'deadline', 'guidelines', 'sources', 'evaluation'],
        'assessment' => ['instructions', 'pass'],
    ];
    public const TYPE_TH = ['knowledge' => 'ใบความรู้', 'job' => 'ใบงาน', 'activity' => 'ใบกิจกรรม', 'assignment' => 'ใบมอบหมายงาน', 'assessment' => 'แบบประเมิน'];
    private const RUBRIC_ROW = ['item' => '', 'l4' => '', 'l3' => '', 'l2' => '', 'l1' => ''];

    private static function text(mixed $v, int $max = 12000): string
    {
        if (is_array($v)) {
            $v = implode("\n", array_filter($v, 'is_scalar'));
        }
        return is_scalar($v) ? mb_substr(trim(str_replace("\r", '', (string) $v)), 0, $max) : '';
    }

    public static function assertType(string $type): void
    {
        if (!isset(self::FIELDS[$type])) {
            throw new HttpException(422, 'ชนิดเอกสารไม่ถูกต้อง');
        }
    }

    /** Keep the type's fields only; assessment also has rubric rows. */
    public static function normalize(string $type, mixed $content): array
    {
        $in = is_array($content) ? $content : [];
        $c = [];
        foreach (self::FIELDS[$type] as $k) {
            $c[$k] = self::text($in[$k] ?? '');
        }
        if ($type === 'assessment') {
            $c['rubric'] = [];
            foreach (array_slice(is_array($in['rubric'] ?? null) ? array_values($in['rubric']) : [], 0, 30) as $r) {
                $row = [];
                foreach (self::RUBRIC_ROW as $k => $_) {
                    $row[$k] = self::text(is_array($r) ? ($r[$k] ?? '') : '', 800);
                }
                if (implode('', $row) !== '') {
                    $c['rubric'][] = $row;
                }
            }
        }
        return $c;
    }

    public static function completeness(string $type, array $c): int
    {
        $keys = self::FIELDS[$type];
        $filled = count(array_filter($keys, fn ($k) => ($c[$k] ?? '') !== ''));
        if ($type === 'assessment') {
            return (int) round((($filled / count($keys)) * 0.3 + (count($c['rubric'] ?? []) ? 0.7 : 0)) * 100);
        }
        return (int) round($filled / count($keys) * 100);
    }

    // ------------------------------------------------------------------ draft from the plan (no AI)

    private static function lines(string $s): array
    {
        return array_values(array_filter(array_map('trim', explode("\n", $s))));
    }

    /** Sections shared with the plan: 1 outcome · 2 standard · 3 competency · 4 objectives. */
    private static function shared(array $pc): array
    {
        $std = array_filter([
            $pc['standard']['occupation'] ? 'มาตรฐานอาชีพ ' . $pc['standard']['occupation'] . ($pc['standard']['sub_competency'] ? ' สมรรถนะย่อย ' . $pc['standard']['sub_competency'] : '') : '',
            $pc['standard']['career_integration'] ? 'บูรณาการกลุ่มอาชีพ ' . $pc['standard']['career_integration'] : '',
        ]);
        $comp = array_filter([$pc['competency']['knowledge'], $pc['competency']['practice'], $pc['competency']['apply']]);
        $obj = array_merge(...array_map(fn ($k) => self::lines($pc['objectives'][$k]), ['cognitive', 'psychomotor', 'affective', 'application']));
        return [
            'outcome' => $pc['outcome'],
            'standard' => implode("\n", $std),
            'competency' => implode("\n", $comp),
            'objectives' => implode("\n", $obj),
        ];
    }

    public static function fromPlan(string $type, array $plan): array
    {
        $pc = LessonPlanService::normalize(json_decode($plan['content'], true));
        $topic = $plan['title'] !== '' ? $plan['title'] : $plan['unit_name'];
        $c = array_fill_keys(self::FIELDS[$type], '');
        if ($type !== 'assessment') {
            $c = array_merge($c, array_intersect_key(self::shared($pc), $c));
        }
        $eval = trim($pc['assessment']['methods'] . ($pc['assessment']['criteria'] ? "\nเกณฑ์: " . $pc['assessment']['criteria'] : ''));
        switch ($type) {
            case 'knowledge':
                $c['content'] = $pc['content'] ?: $topic;
                $c['exercises'] = "ตอบคำถามต่อไปนี้\n1. จงอธิบายความหมายของ{$topic}\n2. จงยกตัวอย่างการนำ{$topic}ไปใช้ในงานอาชีพ";
                break;
            case 'job':
            case 'activity':
                $c['tools'] = $pc['media'];
                $c['steps'] = $pc['activities']['application'];
                $c['evaluation'] = $eval;
                if ($type === 'job') {
                    $c['advice'] = 'ปฏิบัติงานตามขั้นตอนอย่างเคร่งครัด และใช้เครื่องมืออย่างถูกวิธีและปลอดภัย';
                }
                $c['conclusion'] = 'ผู้เรียนสรุปผลการปฏิบัติ ปัญหาที่พบ และแนวทางแก้ไข';
                break;
            case 'assignment':
                $c['outcome'] = "ผลงานเรื่อง{$topic}ที่ถูกต้องครบถ้วนตามที่กำหนด";
                $c['details'] = "ให้ผู้เรียนจัดทำผลงานเรื่อง{$topic} ตามรายละเอียดที่ครูกำหนด";
                $c['deadline'] = 'ภายในสัปดาห์ถัดไป';
                $c['guidelines'] = $pc['activities']['application'];
                $c['sources'] = $pc['media'];
                $c['evaluation'] = $eval;
                break;
            case 'assessment':
                $c['instructions'] = 'ให้ครูผู้สอนประเมินความสามารถของผู้เรียนตามรายการประเมิน โดยทำเครื่องหมาย ✓ ในช่องระดับคะแนนที่ตรงกับพฤติกรรมที่สังเกตได้';
                $c['pass'] = 'ผู้เรียนต้องได้คะแนนรวมไม่น้อยกว่าร้อยละ 60 จึงถือว่าผ่านเกณฑ์';
                $objs = self::lines(self::shared($pc)['objectives']);
                $c['rubric'] = array_map(fn ($o) => [
                    'item' => $o,
                    'l4' => 'ทำได้ถูกต้องครบถ้วน ด้วยตนเอง',
                    'l3' => 'ทำได้ถูกต้องเป็นส่วนใหญ่',
                    'l2' => 'ทำได้บางส่วน ต้องได้รับคำแนะนำ',
                    'l1' => 'ทำไม่ได้ หรือทำได้น้อยมาก',
                ], array_slice($objs ?: ["ปฏิบัติงานเรื่อง{$topic}"], 0, 8));
                break;
        }
        return self::normalize($type, $c);
    }

    // ------------------------------------------------------------------ AI draft

    public static function aiDraft(int $userId, array $course, array $plan, string $type, array $sheet): array
    {
        if (!AiGuideService::enabled()) {
            throw new HttpException(403, 'ผู้ดูแลระบบปิดการใช้งานฟังก์ชัน AI อยู่');
        }
        $r = AiGuideService::resolve($userId);
        if (!$r['key']) {
            throw new HttpException(409, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อน หรือใช้ปุ่ม “เติมจากแผน (ไม่ใช้ AI)”');
        }
        set_time_limit(300);
        $res = (new GeminiClient($r['key']))->generateJsonResilient($r['model'] ?: 'gemini-flash-latest', self::SYSTEM, self::prompt($course, $plan, $type, $sheet), 2, 24000);
        $draft = self::normalize($type, $res['data']);
        // sections 1–4 must stay consistent with the plan when the AI leaves them out
        foreach (self::shared(LessonPlanService::normalize(json_decode($plan['content'], true))) as $k => $v) {
            if (array_key_exists($k, $draft) && $draft[$k] === '') {
                $draft[$k] = $v;
            }
        }
        return ['content' => $draft, 'model' => $res['model']];
    }

    private const SYSTEM = 'คุณเป็นครูอาชีวศึกษาผู้เชี่ยวชาญการเขียนเอกสารประกอบแผนการจัดการเรียนรู้ฐานสมรรถนะ หลักสูตร ปวช./ปวส. 2567 ของ สอศ. '
        . 'เขียนเนื้อหาที่ถูกต้องตามหลักวิชา ละเอียดครบถ้วนได้ใจความ (ไม่ใช่แค่หัวข้อ) ใช้ได้จริงในห้องเรียน ภาษาไทยทางการ อ่านง่ายสำหรับผู้เรียน สอดคล้องกับแผนการจัดการเรียนรู้ที่ให้มา '
        . 'อ้างอิงเฉพาะหนังสือ/เว็บไซต์ที่มีอยู่จริง ถ้าไม่แน่ใจให้เขียนเป็นประเภทแหล่งข้อมูลแทน ห้ามแต่งมาตรฐานอาชีพ ตอบเป็น JSON ตามโครงสร้างที่กำหนดเท่านั้น';

    private static function prompt(array $course, array $plan, string $type, array $sheet): string
    {
        $pc = LessonPlanService::normalize(json_decode($plan['content'], true));
        $title = $sheet['title'] !== '' ? $sheet['title'] : ($plan['title'] ?: $plan['unit_name']);
        $ctx = LessonPlanService::curriculumText($course) . "รายวิชา {$course['code']} {$course['name']} ระดับ " . (LessonPlanService::isHigher($course) ? 'ปวส.' : 'ปวช.')
            . "\nหน่วยที่ {$plan['unit_no']} {$plan['unit_name']} · เรื่อง {$plan['title']} · สอนครั้งที่ {$plan['session_no']} (ทฤษฎี {$plan['hours_theory']} ชม. ปฏิบัติ {$plan['hours_practice']} ชม.)"
            . "\nแผนการจัดการเรียนรู้ (สรุป):\n" . json_encode([
                'outcome' => $pc['outcome'], 'competency' => $pc['competency'], 'objectives' => $pc['objectives'],
                'content' => $pc['content'], 'activities' => $pc['activities'], 'media' => $pc['media'], 'assessment' => $pc['assessment'],
            ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        $th = self::TYPE_TH[$type];
        $spec = match ($type) {
            'knowledge' => '"content":"เนื้อหาสาระฉบับเต็มให้ผู้เรียนอ่านเองได้ 5-8 หัวข้อ แต่ละหัวข้อขึ้นบรรทัด “1. ชื่อหัวข้อ” แล้วอธิบาย 1-2 ย่อหน้า (นิยาม หลักการ ขั้นตอน ตัวอย่างที่คำนวณ/เขียนให้ดูจริง ข้อควรจำ) มีหัวข้อย่อย “1.1” เมื่อจำเป็น ยาวรวม 3,000-6,000 ตัวอักษร","exercises":"แบบฝึกหัด/แบบทดสอบ 10 ข้อ: ปรนัย 4 ตัวเลือก (ก ข ค ง) 6-8 ข้อ และอัตนัย/ฝึกปฏิบัติ 2-4 ข้อ ครอบคลุมจุดประสงค์ทุกข้อ","references":"เอกสารอ้างอิงที่มีอยู่จริง 3-5 รายการ","appendix":"เฉลยแบบฝึกหัด/แบบทดสอบทุกข้อ พร้อมคำอธิบายสั้นของข้อปรนัยและแนวคำตอบของข้ออัตนัย"',
            'job' => '"outcome":"ผลลัพธ์การเรียนรู้จากการปฏิบัติงาน 2-3 ประโยค","tools":"เครื่องมือ วัสดุ และอุปกรณ์ 4-8 รายการ บรรทัดละ 1 รายการ (ระบุรุ่น/จำนวนเมื่อเหมาะสม)","advice":"คำแนะนำ/ข้อควรระวัง 4-6 ข้อ ด้านความปลอดภัย การใช้เครื่องมือ และคุณภาพงาน","steps":"ขั้นตอนการปฏิบัติงาน 8-15 ขั้น บรรทัดละ 1 ขั้น ละเอียดพอให้ผู้เรียนทำตามได้เอง ระบุสิ่งที่ต้องทำ ผลที่ควรได้ และจุดตรวจสอบ","conclusion":"คำถามนำ 3-5 ข้อให้ผู้เรียนสรุปและวิจารณ์ผลการปฏิบัติงาน","evaluation":"การประเมินผล: รายการประเมิน เกณฑ์คะแนน และเกณฑ์ผ่าน","references":"เอกสารอ้างอิง/ค้นคว้าเพิ่มเติม 2-4 รายการ"',
            'activity' => '"outcome":"ผลลัพธ์การเรียนรู้การปฏิบัติกิจกรรม 2-3 ประโยค","competency":"สมรรถนะประจำกิจกรรม 2-3 ข้อ","tools":"เครื่องมือ วัสดุ อุปกรณ์ 3-6 รายการ","steps":"ขั้นตอนการทำกิจกรรมกลุ่ม/คู่ 6-10 ขั้น บรรทัดละ 1 ขั้น ระบุบทบาทในกลุ่ม เวลา และสิ่งที่ต้องส่ง","conclusion":"ประเด็นสรุปและอภิปราย 3-5 ข้อ","evaluation":"การประเมินผล: รายการ เกณฑ์ และเกณฑ์ผ่าน","references":"เอกสารอ้างอิง 2-3 รายการ"',
            'assignment' => '"outcome":"ผลงานหรือผลการปฏิบัติงานที่ต้องส่ง (ระบุลักษณะชิ้นงานให้ชัด)","details":"รายละเอียดของงาน 4-8 บรรทัด: โจทย์ ขอบเขต ข้อกำหนด รูปแบบไฟล์/ชิ้นงาน","deadline":"กำหนดเวลาส่งงาน","guidelines":"แนวทางในการปฏิบัติงาน 5-8 ขั้น","sources":"แหล่งข้อมูลค้นคว้าเพิ่มเติม 3-5 รายการที่มีอยู่จริง","evaluation":"การประเมินผล: รายการ คะแนน และเกณฑ์ผ่าน"',
            'assessment' => '"instructions":"คำชี้แจงการประเมิน","pass":"เกณฑ์การผ่าน","rubric":[{"item":"รายการประเมิน (สอดคล้องจุดประสงค์เชิงพฤติกรรมแต่ละข้อ)","l4":"พฤติกรรมระดับ 4 ดีมาก","l3":"ระดับ 3 ดี","l2":"ระดับ 2 พอใช้","l1":"ระดับ 1 ปรับปรุง"}]',
        };
        // sections 1–4 not already described by the type-specific spec
        $sharedKeys = $type === 'assessment' ? [] : array_filter(['outcome', 'standard', 'competency', 'objectives'], fn ($k) => !str_contains($spec, "\"$k\""));
        $shared = implode('', array_map(fn ($k) => "\"$k\":\"\", ", $sharedKeys));
        return $ctx . "\n\nจงเขียน “{$th}” เรื่อง “{$title}” ให้สอดคล้องกับแผนข้างต้น "
            . ($type === 'assessment' ? 'เป็นแบบประเมินความสามารถในการปฏิบัติงาน/ผลลัพธ์การเรียนรู้/สมรรถนะ แบบ Rubric 4 ระดับ 4-8 รายการ' : 'ข้อ outcome/standard/competency/objectives ให้สอดคล้องกับแผน (ปรับถ้อยคำให้เหมาะกับเอกสาร)')
            . "\nตอบ JSON (ค่าทุกช่องเป็นข้อความ ใช้ \\n ขึ้นบรรทัดใหม่): {" . $shared . $spec . '}';
    }
}
