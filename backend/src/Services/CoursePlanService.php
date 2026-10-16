<?php
namespace App\Services;

use App\Core\HttpException;

/**
 * Course-level part of the OVEC 2567 lesson-plan book. The curriculum text must be copied from the
 * official curriculum (form rule), so the AI only drafts the teacher's own analysis: unit analysis
 * (Duty/Task), expected behaviour levels per unit (K/S/A/Ap), hours/weights and the preface.
 */
class CoursePlanService
{
    public const EMPTY = [
        'curriculum' => [
            'program' => '', 'field_type' => '', 'occupation_group' => '', 'major' => '',
            'theory_hours' => '', 'practice_hours' => '', 'credits' => '',
            'standards_ref' => '', 'outcome' => '', 'objectives' => '', 'competencies' => '', 'description' => '',
        ],
        'occupational' => ['agency' => '', 'standard' => '', 'occupation' => '', 'level' => '', 'rows' => []],
        'job_analysis' => ['job' => '', 'rows' => []],
        'units' => [],
        'final_eval' => ['hours_theory' => '', 'hours_practice' => '', 'percent' => ''],
        'preface' => '',
        'bibliography' => '',
        'author' => '',
    ];
    private const OCC_ROW = ['unit_code' => '', 'unit_desc' => '', 'sub_code' => '', 'sub_desc' => '', 'criteria' => '', 'method' => ''];
    private const JOB_ROW = ['duty' => '', 'task' => '', 'sub_competency' => '', 'knowledge' => '', 'skill' => ''];
    private const UNIT_ROW = ['no' => '', 'name' => '', 'k' => '', 's' => '', 'a' => '', 'ap' => '', 'hours_theory' => '', 'hours_practice' => '', 'percent' => ''];

    private static function text(mixed $v, int $max = 6000): string
    {
        if (is_array($v)) {
            $v = implode("\n", array_filter($v, 'is_scalar'));
        }
        return is_scalar($v) ? mb_substr(trim(str_replace("\r", '', (string) $v)), 0, $max) : '';
    }

    private static function rows(mixed $rows, array $shape, int $max = 80): array
    {
        $out = [];
        foreach (array_slice(is_array($rows) ? array_values($rows) : [], 0, $max) as $r) {
            $r = is_array($r) ? $r : [];
            $row = [];
            foreach ($shape as $k => $_) {
                $row[$k] = self::text($r[$k] ?? '', 1500);
            }
            if (implode('', $row) !== '') {
                $out[] = $row;
            }
        }
        return $out;
    }

    /** Keep only known keys; every leaf is a string; tables are lists of fixed-shape rows. */
    public static function normalize(mixed $content): array
    {
        $in = is_array($content) ? $content : [];
        $c = self::EMPTY;
        foreach (self::EMPTY['curriculum'] as $k => $_) {
            $c['curriculum'][$k] = self::text($in['curriculum'][$k] ?? '');
        }
        foreach (['agency', 'standard', 'occupation', 'level'] as $k) {
            $c['occupational'][$k] = self::text($in['occupational'][$k] ?? '', 300);
        }
        $c['occupational']['rows'] = self::rows($in['occupational']['rows'] ?? [], self::OCC_ROW);
        $c['job_analysis']['job'] = self::text($in['job_analysis']['job'] ?? '', 1000);
        $c['job_analysis']['rows'] = self::rows($in['job_analysis']['rows'] ?? [], self::JOB_ROW);
        $c['units'] = self::rows($in['units'] ?? [], self::UNIT_ROW, 40);
        foreach (self::EMPTY['final_eval'] as $k => $_) {
            $c['final_eval'][$k] = self::text($in['final_eval'][$k] ?? '', 20);
        }
        foreach (['preface', 'bibliography', 'author'] as $k) {
            $c[$k] = self::text($in[$k] ?? '');
        }
        return $c;
    }

    /** Starting values for a course that has no book yet: from the course record and existing unit plans. */
    public static function defaults(array $course, array $plans, string $teacherName): array
    {
        $c = self::EMPTY;
        $higher = LessonPlanService::isHigher($course);
        $c['curriculum']['program'] = $higher ? 'ประกาศนียบัตรวิชาชีพชั้นสูง พุทธศักราช 2567' : 'ประกาศนียบัตรวิชาชีพ พุทธศักราช 2567';
        $c['curriculum']['major'] = (string) ($course['department_name'] ?? '');
        $c['author'] = $teacherName;

        // units: course topics, with hours taken from unit plans when they exist
        $topics = json_decode($course['topics'] ?? '[]', true) ?: [];
        $hours = [];
        foreach ($plans as $p) {
            $n = (int) $p['unit_no'];
            $hours[$n]['t'] = ($hours[$n]['t'] ?? 0) + (float) $p['hours_theory'];
            $hours[$n]['p'] = ($hours[$n]['p'] ?? 0) + (float) $p['hours_practice'];
        }
        foreach ($topics as $i => $t) {
            $n = $i + 1;
            $c['units'][] = ['no' => (string) $n, 'name' => $t, 'k' => '', 's' => '', 'a' => '', 'ap' => '',
                'hours_theory' => isset($hours[$n]) ? self::num($hours[$n]['t']) : '', 'hours_practice' => isset($hours[$n]) ? self::num($hours[$n]['p']) : '', 'percent' => ''];
        }
        $c['preface'] = "แผนการจัดการเรียนรู้รายวิชา {$course['code']} {$course['name']} จัดทำขึ้นตามหลักสูตร{$c['curriculum']['program']} "
            . 'โดยมุ่งเน้นการจัดการเรียนรู้ฐานสมรรถนะ และออกแบบกิจกรรมการเรียนรู้ให้สอดคล้องกับความแตกต่างของผู้เรียน '
            . 'จากผลการวิเคราะห์ผู้เรียนรายบุคคลด้านสไตล์การเรียนรู้ ความสนใจอาชีพ และกรอบความคิด'
            . "\nผู้จัดทำหวังเป็นอย่างยิ่งว่าแผนการจัดการเรียนรู้ฉบับนี้จะเป็นประโยชน์ต่อการจัดการเรียนการสอน และการพัฒนาผู้เรียนให้บรรลุผลลัพธ์การเรียนรู้ตามที่หลักสูตรกำหนด";
        return $c;
    }

    private static function num(float $n): string
    {
        return floor($n) == $n ? (string) (int) $n : (string) $n;
    }

    // ------------------------------------------------------------------ AI: split the course into units

    /**
     * Suggest learning units from the curriculum text (works before the course exists).
     * $c: code, name, level, course_type, theory_hours, practice_hours, description, objectives, competencies.
     * Returns ['units' => [[name, covers, hours_theory, hours_practice]], 'model' => …] — nothing is saved.
     */
    public static function suggestUnits(int $userId, array $c): array
    {
        if (!AiGuideService::enabled()) {
            throw new HttpException(403, 'ผู้ดูแลระบบปิดการใช้งานฟังก์ชัน AI อยู่');
        }
        if (trim($c['description'] ?? '') === '' && trim($c['objectives'] ?? '') === '') {
            throw new HttpException(422, 'กรุณากรอกคำอธิบายรายวิชา (แท็บ “เนื้อหารายวิชา”) ก่อน ให้ AI แบ่งหน่วยจากหลักสูตรจริง');
        }
        $r = AiGuideService::resolve($userId);
        if (!$r['key']) {
            throw new HttpException(409, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อน หรือใช้ปุ่ม “แยกจากคำอธิบาย (ไม่ใช้ AI)”');
        }
        set_time_limit(300);
        $higher = str_contains((string) ($c['level'] ?? ''), 'ปวส');
        $weeks = $higher ? 15 : 18;
        $t = (float) ($c['theory_hours'] ?? 0);
        $p = (float) ($c['practice_hours'] ?? 0);
        $prompt = "รายวิชา {$c['code']} {$c['name']} ระดับ " . ($higher ? 'ปวส.' : 'ปวช.')
            . " ประเภท " . (['theory' => 'ทฤษฎี', 'practice' => 'ปฏิบัติ', 'mixed' => 'ทฤษฎี+ปฏิบัติ'][$c['course_type'] ?? 'mixed'] ?? 'ทฤษฎี+ปฏิบัติ')
            . ($t + $p > 0 ? "\nเวลาเรียน ทฤษฎี {$t} ชม./สัปดาห์ ปฏิบัติ {$p} ชม./สัปดาห์ จัดเรียน {$weeks} สัปดาห์ (รวม " . (($t + $p) * $weeks) . ' ชม.)' : '')
            . "\nคำอธิบายรายวิชา:\n" . mb_substr(trim($c['description'] ?? ''), 0, 3000)
            . "\nจุดประสงค์รายวิชา:\n" . mb_substr(trim($c['objectives'] ?? ''), 0, 2000)
            . "\nสมรรถนะรายวิชา:\n" . mb_substr(trim($c['competencies'] ?? ''), 0, 2000)
            . "\n\nจงวิเคราะห์และแบ่งเนื้อหาตามคำอธิบายรายวิชาเป็นหน่วยการเรียนรู้ 5-10 หน่วย เรียงจากพื้นฐานไปสู่การประยุกต์ "
            . 'ครอบคลุมทุกเนื้อหาในคำอธิบายรายวิชา ไม่เพิ่มเนื้อหานอกหลักสูตร ชื่อหน่วยกระชับ (ไม่เกิน 60 ตัวอักษร ไม่ต้องใส่คำว่า “หน่วยที่”) '
            . ($t + $p > 0 ? 'ประมาณชั่วโมงทฤษฎี/ปฏิบัติของแต่ละหน่วยให้รวมได้ใกล้เคียงเวลาเรียนทั้งหมด (เผื่อเวลาประเมินผลลัพธ์รายวิชา 1 สัปดาห์) ' : 'hours ให้ใส่ 0 ')
            . "\nตอบ JSON: " . '{"units":[{"name":"ชื่อหน่วย","covers":"เนื้อหาจากคำอธิบายรายวิชาที่หน่วยนี้ครอบคลุม (1 ประโยค)","hours_theory":0,"hours_practice":0}]}';
        $system = 'คุณเป็นผู้เชี่ยวชาญการวิเคราะห์หลักสูตรอาชีวศึกษา (ปวช./ปวส. 2567 ของ สอศ.) แบ่งหน่วยการเรียนรู้ให้เหมาะกับการจัดการเรียนรู้ฐานสมรรถนะ ใช้ภาษาไทยทางการ ตอบเป็น JSON เท่านั้น';
        $res = (new GeminiClient($r['key']))->generateJsonResilient($r['model'] ?: 'gemini-flash-latest', $system, $prompt, 2, 16000);
        $units = [];
        foreach (array_slice((array) ($res['data']['units'] ?? []), 0, 15) as $u) {
            $name = trim(preg_replace('/^หน่วยที่\s*\d+\s*[:.]?\s*/u', '', self::text($u['name'] ?? '', 100)));
            if ($name !== '') {
                $units[] = ['name' => $name, 'covers' => self::text($u['covers'] ?? '', 400),
                    'hours_theory' => max(0, (float) ($u['hours_theory'] ?? 0)), 'hours_practice' => max(0, (float) ($u['hours_practice'] ?? 0))];
            }
        }
        if (!$units) {
            throw new HttpException(502, 'AI ไม่ได้ส่งรายการหน่วยกลับมา ลองใหม่อีกครั้ง');
        }
        return ['units' => $units, 'model' => $res['model']];
    }

    // ------------------------------------------------------------------ AI draft

    /** Draft the analysis parts with Gemini; curriculum text stays exactly as the teacher entered it. */
    public static function aiDraft(int $userId, array $course, array $dash, array $content): array
    {
        if (!AiGuideService::enabled()) {
            throw new HttpException(403, 'ผู้ดูแลระบบปิดการใช้งานฟังก์ชัน AI อยู่');
        }
        $r = AiGuideService::resolve($userId);
        if (!$r['key']) {
            throw new HttpException(409, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อน');
        }
        $cur = $content['curriculum'];
        if ($cur['description'] === '' && !$content['units']) {
            throw new HttpException(422, 'กรุณากรอกคำอธิบายรายวิชา (หรือหน่วยการเรียนรู้) ก่อน เพื่อให้ AI วิเคราะห์จากหลักสูตรจริง');
        }
        set_time_limit(300);
        $ctx = AiGuideService::context($course, $dash);
        $res = (new GeminiClient($r['key']))->generateJsonResilient($r['model'] ?: 'gemini-flash-latest', self::SYSTEM, self::prompt($course, $ctx, $content), 2, 24000);
        $d = is_array($res['data']) ? $res['data'] : [];
        $draft = self::normalize([
            'job_analysis' => ['job' => $d['job'] ?? '', 'rows' => $d['job_rows'] ?? []],
            'units' => $d['units'] ?? [],
            'final_eval' => $d['final_eval'] ?? [],
            'preface' => $d['preface'] ?? '',
        ]);
        return ['parts' => ['job_analysis' => $draft['job_analysis'], 'units' => $draft['units'], 'final_eval' => $draft['final_eval'], 'preface' => $draft['preface']], 'model' => $res['model']];
    }

    private const SYSTEM = 'คุณเป็นศึกษานิเทศก์ผู้เชี่ยวชาญการวิเคราะห์หลักสูตรและการเขียนแผนการจัดการเรียนรู้ฐานสมรรถนะ หลักสูตร ปวช./ปวส. 2567 ของ สอศ. '
        . 'วิเคราะห์จากคำอธิบายรายวิชา จุดประสงค์ และสมรรถนะรายวิชาที่ให้มาเท่านั้น ห้ามเพิ่มเนื้อหานอกหลักสูตร '
        . 'ห้ามแต่งรหัสหรือชื่อมาตรฐานอาชีพ ถ้าไม่ทราบให้เว้นว่าง ใช้ภาษาไทยทางการ กระชับ ตอบเป็น JSON ตามโครงสร้างที่กำหนดเท่านั้น';

    private static function prompt(array $course, array $ctx, array $c): string
    {
        $cur = $c['curriculum'];
        $level = LessonPlanService::isHigher($course) ? 'ปวส.' : 'ปวช.';
        $weeks = $level === 'ปวส.' ? 'ไม่น้อยกว่า 15 สัปดาห์ (ไม่รวมวัดผล)' : 'ไม่น้อยกว่า 18 สัปดาห์ (รวมวัดผล)';
        $units = array_map(fn ($u) => "{$u['no']}. {$u['name']}", $c['units']);
        return "รายวิชา {$course['code']} {$course['name']} ระดับ {$level}\n"
            . "ชั่วโมง: ทฤษฎี {$cur['theory_hours']} ชม./สัปดาห์ ปฏิบัติ {$cur['practice_hours']} ชม./สัปดาห์ หน่วยกิต {$cur['credits']} · จัดเรียน {$weeks}\n"
            . "ผลลัพธ์การเรียนรู้ระดับรายวิชา: {$cur['outcome']}\nจุดประสงค์รายวิชา:\n{$cur['objectives']}\nสมรรถนะรายวิชา:\n{$cur['competencies']}\nคำอธิบายรายวิชา:\n{$cur['description']}\n"
            . 'หน่วยการเรียนรู้ที่ครูกำหนด (ใช้ชื่อเดิม ถ้าว่างให้แบ่งหน่วยจากคำอธิบายรายวิชา):' . "\n" . implode("\n", $units) . "\n"
            . "ผลวิเคราะห์ผู้เรียน (สถิติรวม ใช้ประกอบคำนำเท่านั้น): " . json_encode($ctx['class'], JSON_UNESCAPED_UNICODE) . "\n\n"
            . "งาน:\n"
            . "1) job = ผลลัพธ์การเรียนรู้ระดับรายวิชา (Job) 1 ประโยค · job_rows = วิเคราะห์งานหลัก (duty) และงานย่อย (task) ที่ทำให้ผู้เรียนมีสมรรถนะตามผลลัพธ์ พร้อมความรู้ (knowledge) และทักษะ (skill) ในการปฏิบัติงานของแต่ละงานย่อย · ใส่ชื่องานหลักซ้ำในทุกแถวของงานหลักนั้น · sub_competency เว้นว่างถ้าไม่อ้างอิงมาตรฐานอาชีพ\n"
            . "2) units = ทุกหน่วย พร้อมระดับความสามารถที่คาดหวังที่สอดคล้องจุดประสงค์รายวิชาหรือสูงกว่า: k (ใส่ได้หลายระดับ เช่น \"K1,K2,K3\"; K1 ความจำ K2 เข้าใจ K3 นำไปใช้ K4 วิเคราะห์ K5 ประเมินค่า K6 สร้างสรรค์) · s ระดับเดียว (S1 เลียนแบบ S2 ทำได้ตามแบบ S3 ทำได้ถูกต้อง S4 ทำได้ต่อเนื่อง S5 เป็นธรรมชาติ) · a ระดับเดียว (A1 รับรู้ … A5 สร้างลักษณะนิสัย) · ap ระดับเดียว (Ap1–Ap5) · hours_theory/hours_practice รวมทั้งภาคให้สอดคล้องชั่วโมงต่อสัปดาห์ × จำนวนสัปดาห์ · percent ร้อยละประเมินผลของหน่วย\n"
            . "3) final_eval = ชั่วโมงและร้อยละของการประเมินผลลัพธ์การเรียนรู้ระดับรายวิชา (percent ของทุกหน่วย + final_eval รวม 100)\n"
            . "4) preface = คำนำของแผนการจัดการเรียนรู้ 2 ย่อหน้า กล่าวถึงรายวิชา หลักสูตร 2567 การจัดการเรียนรู้ฐานสมรรถนะ และการออกแบบตามผลวิเคราะห์ผู้เรียน (ใช้ \\n คั่นย่อหน้า)\n"
            . 'ตอบ JSON: {"job":"","job_rows":[{"duty":"งานหลัก 1 …","task":"1.1 …","sub_competency":"","knowledge":"","skill":""}],'
            . '"units":[{"no":"1","name":"","k":"K1,K2","s":"S2","a":"A2","ap":"Ap1","hours_theory":"","hours_practice":"","percent":""}],'
            . '"final_eval":{"hours_theory":"","hours_practice":"","percent":""},"preface":""}';
    }
}
