<?php
namespace App\Services;

use App\Core\Database;
use App\Core\HttpException;

/**
 * Exam questions for the midterm/final week, drafted by AI from the units the teacher actually taught (ticked,
 * never preselected): the plan's objectives and content, the knowledge sheets and their end-of-unit exercises.
 * New questions in the same style — not copies of the exercises. Course content only, no student data.
 */
class ExamService
{
    public const LETTERS = ['ก', 'ข', 'ค', 'ง'];
    public const DEFAULT_OPTIONS = ['mcq' => 20, 'essay' => 2, 'mcq_points' => 1, 'essay_points' => 5];

    /** The course's units with what each has to draw questions from. */
    public static function units(array $course): array
    {
        $topics = json_decode($course['topics'] ?? '[]', true) ?: [];
        $db = Database::get();
        $plans = $db->prepare("SELECT id, unit_no, content FROM lesson_plans WHERE course_id = ? AND kind = 'unit'");
        $plans->execute([$course['id']]);
        $byUnit = [];
        foreach ($plans->fetchAll() as $p) {
            $byUnit[(int) $p['unit_no']][] = $p;
        }
        $sheets = $db->prepare("SELECT s.plan_id, s.content FROM lesson_sheets s JOIN lesson_plans p ON p.id = s.plan_id WHERE p.course_id = ? AND s.type = 'knowledge'");
        $sheets->execute([$course['id']]);
        $knowledge = [];
        foreach ($sheets->fetchAll() as $s) {
            $knowledge[(int) $s['plan_id']][] = LessonSheetService::normalize('knowledge', json_decode($s['content'], true));
        }
        $out = [];
        foreach ($topics as $i => $name) {
            $no = $i + 1;
            $plan = null;
            $sheetsOf = [];
            foreach ($byUnit[$no] ?? [] as $p) {
                $plan ??= LessonPlanService::normalize(json_decode($p['content'], true));
                $sheetsOf = [...$sheetsOf, ...($knowledge[(int) $p['id']] ?? [])];
            }
            $out[] = [
                'no' => $no, 'name' => (string) $name,
                'has_plan' => $plan !== null && trim($plan['content']) !== '',
                'has_knowledge' => (bool) array_filter($sheetsOf, fn ($k) => trim((string) $k['content']) !== ''),
                'has_exercises' => (bool) array_filter($sheetsOf, fn ($k) => trim((string) $k['exercises']) !== ''),
                'plan' => $plan, 'knowledge' => $sheetsOf,
            ];
        }
        return $out;
    }

    public static function options(mixed $in): array
    {
        $in = is_array($in) ? $in : [];
        return [
            'mcq' => max(0, min(60, (int) ($in['mcq'] ?? self::DEFAULT_OPTIONS['mcq']))),
            'essay' => max(0, min(10, (int) ($in['essay'] ?? self::DEFAULT_OPTIONS['essay']))),
            'mcq_points' => max(0.5, min(10, (float) ($in['mcq_points'] ?? self::DEFAULT_OPTIONS['mcq_points']))),
            'essay_points' => max(1, min(50, (float) ($in['essay_points'] ?? self::DEFAULT_OPTIONS['essay_points']))),
        ];
    }

    private static function text(mixed $v, int $max): string
    {
        if (is_array($v)) {
            $v = implode("\n", array_filter($v, 'is_scalar'));
        }
        // markdown code marks (`x`, ```) mean nothing on a printed paper
        return is_scalar($v) ? mb_substr(trim(str_replace(["\r", '```', '`'], '', (string) $v)), 0, $max) : '';
    }

    /** Questions in a fixed shape: multiple choice has four choices and the letter of the answer. */
    public static function normalize(mixed $questions, array $unitNos = []): array
    {
        $out = [];
        foreach (array_slice(is_array($questions) ? array_values($questions) : [], 0, 80) as $q) {
            if (!is_array($q) || self::text($q['question'] ?? '', 2000) === '') {
                continue;
            }
            $type = ($q['type'] ?? '') === 'essay' ? 'essay' : 'mcq';
            $unit = (int) ($q['unit_no'] ?? 0);
            $item = [
                'type' => $type,
                'unit_no' => $unitNos && !in_array($unit, $unitNos, true) ? ($unitNos[0] ?? 0) : $unit,
                'level' => preg_match('/^K[1-6]$/', (string) ($q['level'] ?? '')) ? (string) $q['level'] : 'K2',
                'question' => self::text($q['question'], 2000),
                'choices' => [],
                'answer' => '',
                'guide' => self::text($q['guide'] ?? '', 2000),
            ];
            if ($type === 'mcq') {
                $choices = array_map(fn ($c) => preg_replace('/^[กขคง][.)]\s*/u', '', self::text($c, 400)), array_slice(array_values((array) ($q['choices'] ?? [])), 0, 4));
                $item['choices'] = array_pad($choices, 4, '');
                $answer = self::text($q['answer'] ?? '', 10);
                $item['answer'] = in_array(mb_substr($answer, 0, 1), self::LETTERS, true) ? mb_substr($answer, 0, 1) : 'ก';
            } else {
                $item['answer'] = self::text($q['answer'] ?? '', 2000);
            }
            $out[] = $item;
        }
        // multiple choice first, then essays, each by unit — the order of the paper
        usort($out, fn ($a, $b) => [$a['type'] === 'essay', $a['unit_no']] <=> [$b['type'] === 'essay', $b['unit_no']]);
        return $out;
    }

    /**
     * Models tend to put the right answer in the same few places: move the choices so the answers are spread evenly
     * over ก ข ค ง in an unpredictable order (the choices themselves stay as written).
     */
    private static function spreadAnswers(array $questions): array
    {
        $targets = [];
        foreach ($questions as &$q) {
            if ($q['type'] !== 'mcq') {
                continue;
            }
            if (!$targets) {
                $targets = [0, 1, 2, 3];
                shuffle($targets);
            }
            $want = array_pop($targets);
            $has = array_search($q['answer'], self::LETTERS, true);
            [$q['choices'][$has], $q['choices'][$want]] = [$q['choices'][$want], $q['choices'][$has]];
            $q['answer'] = self::LETTERS[$want];
        }
        unset($q);
        return $questions;
    }

    public static function saved(int $courseId, string $kind): ?array
    {
        $stmt = Database::get()->prepare('SELECT units, options, content, ai_model, updated_at FROM exam_sets WHERE course_id = ? AND kind = ?');
        $stmt->execute([$courseId, $kind]);
        $row = $stmt->fetch();
        return $row ? [
            'units' => json_decode($row['units'], true) ?: [],
            'options' => self::options(json_decode($row['options'], true)),
            'questions' => self::normalize(json_decode($row['content'], true)['questions'] ?? []),
            'ai_model' => $row['ai_model'],
            'updated_at' => $row['updated_at'],
        ] : null;
    }

    public static function save(int $courseId, string $kind, array $units, array $options, array $questions, ?string $model, int $userId): void
    {
        Database::get()->prepare(
            'INSERT INTO exam_sets (course_id, kind, units, options, content, ai_model, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE units = VALUES(units), options = VALUES(options), content = VALUES(content),
                ai_model = COALESCE(VALUES(ai_model), ai_model), updated_by = VALUES(updated_by)'
        )->execute([$courseId, $kind, json_encode(array_values($units)), json_encode($options), json_encode(['questions' => $questions], JSON_UNESCAPED_UNICODE), $model, $userId]);
    }

    /** One AI request: questions for the ticked units, saved at once so they are never lost. */
    public static function generate(int $userId, array $course, string $kind, array $unitNos, array $options): array
    {
        if (!AiGuideService::enabled()) {
            throw new HttpException(403, 'ผู้ดูแลระบบปิดการใช้งานฟังก์ชัน AI อยู่');
        }
        $all = self::units($course);
        $picked = array_values(array_filter($all, fn ($u) => in_array($u['no'], $unitNos, true)));
        if (!$picked) {
            throw new HttpException(422, 'กรุณาเลือกหน่วยที่สอนไปแล้วอย่างน้อย 1 หน่วย');
        }
        if ($options['mcq'] + $options['essay'] < 1) {
            throw new HttpException(422, 'กรุณากำหนดจำนวนข้อสอบอย่างน้อย 1 ข้อ');
        }
        $r = AiGuideService::resolve($userId);
        if (!$r['key']) {
            throw new HttpException(409, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อน');
        }
        set_time_limit(300);
        $level = LessonPlanService::isHigher($course) ? 'ปวส.' : 'ปวช.';
        $exam = TeachingSchedule::EXAM_NAME[$kind];
        $units = '';
        foreach ($picked as $u) {
            $p = $u['plan'];
            $units .= "\n### หน่วยที่ {$u['no']} {$u['name']}\n";
            if ($p) {
                $units .= 'จุดประสงค์: ' . mb_substr(implode(' / ', array_filter($p['objectives'])), 0, 600) . "\n"
                    . 'สาระการเรียนรู้: ' . mb_substr($p['content'], 0, 1500) . "\n";
            }
            foreach (array_slice($u['knowledge'], 0, 2) as $k) {
                $units .= 'ใบความรู้: ' . mb_substr((string) $k['content'], 0, 1500) . "\n"
                    . (trim((string) $k['exercises']) !== '' ? 'แบบทดสอบท้ายหน่วยเดิม (ใช้ดูแนวและระดับความยากเท่านั้น ห้ามนำข้อเดิมมาใช้): ' . mb_substr((string) $k['exercises'], 0, 800) . "\n" : '');
            }
            if (!$p && !$u['knowledge']) {
                $units .= "(ยังไม่มีแผนหรือใบความรู้ ให้ออกจากชื่อหน่วยและคำอธิบายรายวิชา)\n";
            }
        }
        $prompt = LessonPlanService::curriculumText($course)
            . "รายวิชา {$course['code']} {$course['name']} ระดับ {$level}\n"
            . "งาน: ออกแนวข้อสอบ{$exam}ให้ครู จากเฉพาะหน่วยที่ครูสอนไปแล้วต่อไปนี้:\n{$units}\n"
            . "จำนวน: ปรนัย 4 ตัวเลือก {$options['mcq']} ข้อ และอัตนัย {$options['essay']} ข้อ พอดี กระจายตามปริมาณเนื้อหาของแต่ละหน่วย\n"
            . "กติกา:\n"
            . "- ออกข้อใหม่ทั้งหมด ห้ามคัดลอกข้อจากแบบทดสอบท้ายหน่วยเดิม ถามเฉพาะเนื้อหาในหน่วยที่ให้มา\n"
            . "- วัดตามจุดประสงค์ของหน่วย กระจายระดับ K1 จำ K2 เข้าใจ K3 นำไปใช้ K4 วิเคราะห์ ให้เหมาะกับระดับ {$level} (มีคำถามเชิงสถานการณ์ในงานอาชีพบ้าง)\n"
            . "- ปรนัย: คำถามชัดเจน ตัวเลือกยาวใกล้เคียงกัน ตัวลวงสมเหตุสมผล มีคำตอบถูกข้อเดียว คำตอบกระจายทั้ง ก ข ค ง ห้ามใช้ “ถูกทุกข้อ/ผิดทุกข้อ”\n"
            . "- อัตนัย: คำถามให้อธิบาย/วิเคราะห์/แก้ปัญหา answer = แนวคำตอบ guide = เกณฑ์ให้คะแนนเต็ม {$options['essay_points']} คะแนน\n"
            . "- ปรนัยแต่ละข้อ guide = เหตุผลสั้น ๆ ว่าทำไมคำตอบนี้ถูก\n"
            . "- ภาษาไทยทางการ ศัพท์เทคนิคใส่ภาษาอังกฤษในวงเล็บได้\n"
            . 'ตอบเป็น JSON: {"questions":[{"type":"mcq","unit_no":1,"level":"K2","question":"","choices":["","","",""],"answer":"ก","guide":""},'
            . '{"type":"essay","unit_no":1,"level":"K3","question":"","answer":"","guide":""}]}';
        $system = 'คุณเป็นครูผู้เชี่ยวชาญการวัดและประเมินผลอาชีวศึกษา ออกข้อสอบตรงจุดประสงค์ ถูกต้องตามหลักวิชา ภาษาชัดเจน ตอบเป็น JSON ตามโครงสร้างที่กำหนดเท่านั้น';
        $res = (new GeminiClient($r['key']))->generateJsonResilient($r['model'] ?: 'gemini-flash-latest', $system, $prompt, 2, 16000);
        $questions = self::spreadAnswers(self::normalize($res['data']['questions'] ?? [], $unitNos));
        if (!$questions) {
            throw new HttpException(502, 'AI ไม่ได้ส่งข้อสอบกลับมา ลองใหม่อีกครั้ง');
        }
        self::save((int) $course['id'], $kind, $unitNos, $options, $questions, $res['model'], $userId);
        return self::saved((int) $course['id'], $kind) + ['model' => $res['model']];
    }
}
