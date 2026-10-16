<?php
// Mock of the Gemini REST API for offline testing. Valid key: anything starting with "AIzaMOCK".
header('Content-Type: application/json');
$key = $_SERVER['HTTP_X_GOOG_API_KEY'] ?? '';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
file_put_contents(__DIR__ . '/calls.log', date('H:i:s') . " {$_SERVER['REQUEST_METHOD']} $path key=" . substr($key, 0, 8) . "\n", FILE_APPEND);
if (!str_starts_with($key, 'AIzaMOCK')) {
    http_response_code(400);
    echo json_encode(['error' => ['code' => 400, 'message' => 'API key not valid. Please pass a valid API key.', 'status' => 'INVALID_ARGUMENT']]);
    exit;
}
if (str_starts_with($key, 'AIzaMOCKQUOTA') && str_contains($path, 'generateContent')) {
    http_response_code(429);
    echo json_encode(['error' => ['code' => 429, 'message' => 'Resource has been exhausted', 'status' => 'RESOURCE_EXHAUSTED']]);
    exit;
}
if (str_starts_with($key, 'AIzaMOCKBUSY') && str_contains($path, 'gemini-3.8-flash:')) {
    http_response_code(503);
    echo json_encode(['error' => ['code' => 503, 'message' => 'This model is currently experiencing high demand.', 'status' => 'UNAVAILABLE']]);
    exit;
}
if (preg_match('#/models$#', $path)) {
    $m = fn ($n, $methods = ['generateContent']) => ['name' => "models/$n", 'supportedGenerationMethods' => $methods];
    echo json_encode(['models' => [$m('gemini-3.1-flash-lite'), $m('gemini-3.8-flash'), $m('gemini-3.7-flash'), $m('gemini-3.8-flash-lite-tts'), $m('gemini-3.8-pro'), $m('text-embedding-005', ['embedContent'])]]);
    exit;
}
if (preg_match('#/models/([^/:]+):generateContent$#', $path, $mm)) {
    $body = json_decode(file_get_contents('php://input'), true);
    $prompt = $body['contents'][0]['parts'][0]['text'] ?? '';
    file_put_contents(__DIR__ . '/last_prompt.txt', $prompt);
    if (str_contains($prompt, 'แบ่งเนื้อหาตามคำอธิบายรายวิชาเป็นหน่วยการเรียนรู้')) {
        $out = ['units' => [
            ['name' => 'หน่วยที่ 1 ความรู้เบื้องต้นเกี่ยวกับการบัญชี', 'covers' => "[MOCK {$mm[1]}] ความหมาย ความสำคัญของการบัญชี", 'hours_theory' => 2, 'hours_practice' => 4],
            ['name' => 'สมการบัญชี', 'covers' => 'สมการบัญชีและองค์ประกอบ', 'hours_theory' => 2, 'hours_practice' => 6],
            ['name' => 'การวิเคราะห์รายการค้า', 'covers' => 'ผลกระทบของรายการค้าต่อสมการบัญชี', 'hours_theory' => 2, 'hours_practice' => 6],
            ['name' => 'สมุดรายวันทั่วไป', 'covers' => 'การบันทึกรายการค้าในสมุดรายวันทั่วไป', 'hours_theory' => 3, 'hours_practice' => 9],
        ]];
    } elseif (preg_match('/จงเขียน “([^”]+)” เรื่อง “([^”]+)”/u', $prompt, $sh)) {
        // supporting sheet: a superset of every type's keys (the server keeps only the type's own fields)
        $out = ['outcome' => "[MOCK {$mm[1]}] {$sh[1]}: ผู้เรียนนำ{$sh[2]}ไปใช้ได้", 'standard' => '', 'competency' => "ประมวลความรู้เกี่ยวกับ{$sh[2]}", 'objectives' => "อธิบาย{$sh[2]}ได้\nปฏิบัติ{$sh[2]}ได้ถูกต้อง",
            'content' => "1. ความหมายของ{$sh[2]}\nสแตกเป็นโครงสร้างข้อมูลแบบเข้าหลังออกก่อน (LIFO)\n2. การดำเนินการ push และ pop", 'exercises' => "1. สแตกทำงานแบบใด\n2. จงเขียนฟังก์ชัน push", 'references' => 'หนังสือโครงสร้างข้อมูลและอัลกอริทึม', 'appendix' => "เฉลย 1. LIFO",
            'tools' => "คอมพิวเตอร์\nโปรแกรม Python", 'advice' => 'บันทึกงานบ่อย ๆ', 'steps' => "1. เปิดโปรแกรม\n2. เขียนคลาส Stack\n3. ทดสอบ push/pop", 'conclusion' => 'สรุปผลการทดลอง', 'evaluation' => 'ตรวจโปรแกรมตาม Rubric',
            'details' => 'เขียนโปรแกรมตรวจวงเล็บ', 'deadline' => '7 วัน', 'guidelines' => 'ใช้สแตกเก็บวงเล็บเปิด', 'sources' => 'w3schools.com',
            'instructions' => 'ทำเครื่องหมาย ✓ ตามระดับคะแนน', 'pass' => 'ร้อยละ 60',
            'rubric' => [['item' => 'เขียนคลาส Stack ได้', 'l4' => 'ถูกต้องครบ', 'l3' => 'ถูกเป็นส่วนใหญ่', 'l2' => 'ต้องแนะนำ', 'l1' => 'ทำไม่ได้'], ['item' => 'ทดสอบโปรแกรม', 'l4' => 'ครบทุกกรณี', 'l3' => 'เกือบครบ', 'l2' => 'บางกรณี', 'l1' => 'ไม่ทดสอบ']]];
    } elseif (str_contains($prompt, '"job_rows"')) {
        preg_match_all('/^(\d+)\. (.+)$/mu', $prompt, $u, PREG_SET_ORDER);
        $units = array_map(fn ($m) => ['no' => $m[1], 'name' => trim($m[2]), 'k' => 'K1,K2,K3', 's' => 'S3', 'a' => 'A2', 'ap' => 'Ap2', 'hours_theory' => '2', 'hours_practice' => '6', 'percent' => '10'], array_slice($u, 0, 8));
        $out = ['job' => "[MOCK {$mm[1]}] ออกแบบและเขียนโปรแกรมจัดการข้อมูลด้วยโครงสร้างข้อมูลที่เหมาะสม",
            'job_rows' => [
                ['duty' => 'งานหลัก 1 จัดเก็บข้อมูลด้วยโครงสร้างเชิงเส้น', 'task' => '1.1 สร้างอาร์เรย์', 'sub_competency' => '', 'knowledge' => 'หลักการอาร์เรย์', 'skill' => 'เขียนโปรแกรมอาร์เรย์'],
                ['duty' => 'งานหลัก 1 จัดเก็บข้อมูลด้วยโครงสร้างเชิงเส้น', 'task' => '1.2 สร้างสแตกและคิว', 'sub_competency' => '', 'knowledge' => 'หลักการ LIFO/FIFO', 'skill' => 'เขียนโปรแกรมสแตก/คิว'],
                ['duty' => 'งานหลัก 2 ค้นหาและเรียงลำดับข้อมูล', 'task' => '2.1 ค้นหาข้อมูล', 'sub_competency' => '', 'knowledge' => 'อัลกอริทึมการค้นหา', 'skill' => 'เขียนโปรแกรมค้นหา'],
            ],
            'units' => $units, 'final_eval' => ['hours_theory' => '2', 'hours_practice' => '4', 'percent' => '20'],
            'preface' => "[MOCK] แผนการจัดการเรียนรู้รายวิชานี้จัดทำตามหลักสูตร 2567\nหวังว่าจะเป็นประโยชน์ต่อผู้เรียน"];
    } elseif (str_contains($prompt, 'จงเขียนแผนการจัดการเรียนรู้')) {
        preg_match('/เรื่อง\/งาน “([^”]+)”/u', $prompt, $t);
        $verb = str_contains($prompt, 'ประมวลความรู้เกี่ยวกับ') ? 'ประมวลความรู้เกี่ยวกับ' : 'แสดงความรู้เกี่ยวกับ';
        $out = ['outcome' => "[MOCK {$mm[1]}] ผู้เรียนนำ{$t[1]}ไปใช้แก้ปัญหาการจัดการข้อมูลในงานพัฒนาโปรแกรมจริงได้",
            'standard' => ['occupation' => '', 'sub_competency' => '', 'criteria' => '', 'method' => '', 'performance_evidence' => 'โปรแกรมที่ใช้งานได้ตามโจทย์', 'knowledge_evidence' => 'ผลการทดสอบความรู้', 'career_integration' => 'นักพัฒนาซอฟต์แวร์'],
            'competency' => ['knowledge' => "{$verb}{$t[1]}", 'practice' => "เขียนโปรแกรม{$t[1]}ด้วยภาษา Python ตามข้อกำหนดของโจทย์", 'apply' => "ประยุกต์ใช้{$t[1]}แก้ปัญหาในงานอาชีพ"],
            'objectives' => ['cognitive' => "อธิบายหลักการทำงานของ{$t[1]}ได้ถูกต้อง\nเปรียบเทียบ push และ pop ได้", 'psychomotor' => "เขียนโปรแกรม{$t[1]}ได้ถูกต้องตามขั้นตอน", 'affective' => 'ส่งงานตรงเวลาและทำงานร่วมกับผู้อื่นได้', 'application' => "ประยุกต์ใช้{$t[1]}ตรวจวงเล็บในนิพจน์ได้"],
            'content' => "ความหมายของ{$t[1]}\nการดำเนินการ push/pop/peek\nการประยุกต์ใช้",
            'activities' => ['motivation' => 'ครูสาธิตกองจาน แล้วถามว่าจานใบไหนถูกหยิบก่อน (10 นาที)', 'information' => 'ครูอธิบายด้วยภาพจำลองบน VisuAlgo (30 นาที)', 'application' => 'ผู้เรียนทำแล็บเขียนสแตกด้วย list (90 นาที)', 'progress' => 'นำเสนอผลงานและทำควิซท้ายคาบ (20 นาที)'],
            'differentiation' => "ผู้เรียนสายลงมือทำ: ใช้แก้วซ้อนจริง\nผู้เรียน Fixed Mindset: เริ่มจากโจทย์ง่ายที่สำเร็จเร็ว",
            'media' => "VisuAlgo\nPython Tutor\nใบงานที่ 3", 'evidence' => ['knowledge' => 'แบบทดสอบ', 'performance' => 'ไฟล์โปรแกรม'],
            'assessment' => ['criteria' => 'ผ่านร้อยละ 60', 'methods' => "ทดสอบ\nตรวจผลงาน", 'tools' => "แบบทดสอบ\nRubric"]];
    } elseif (str_contains($prompt, 'ทั้งรายวิชา')) {
        $out = ['overview' => "[MOCK {$mm[1]}] ห้องนี้ผู้เรียนส่วนใหญ่ถนัดลงมือทำ ควรสอนแบบสาธิตสั้นแล้วให้ลองเขียนโค้ดทันที",
            'strategies' => [['title' => 'Code-along ทีละขั้น', 'detail' => 'สาธิตการสร้าง stack ด้วย list ใน Python แล้วให้พิมพ์ตาม', 'for' => 'ผู้เรียนสายลงมือทำ'], ['title' => 'Visual trace', 'detail' => 'ใช้ Python Tutor ไล่ linked list', 'for' => 'ทั้งห้อง']],
            'tools' => [['name' => 'VisuAlgo', 'use' => 'ดูการเรียงลำดับ'], ['name' => 'Python Tutor', 'use' => 'ไล่พอยน์เตอร์']],
            'misconceptions' => [['topic' => 'สแตก', 'issue' => 'สับสน push/pop กับคิว', 'fix' => 'เทียบด้วยกองจานและแถวต่อคิว']],
            'assessment' => ['โจทย์เขียนฟังก์ชันสั้นพร้อม test case'], 'fixed_mindset' => 'ให้โจทย์ง่ายก่อนและชมความพยายาม'];
    } else {
        preg_match('/หน่วย “([^”]+)”/u', $prompt, $t);
        $out = ['objective' => "[MOCK] อธิบายและเขียนโปรแกรมเรื่อง {$t[1]} ได้", 'duration_minutes' => 150,
            'steps' => [['phase' => 'ขั้นนำ', 'minutes' => 15, 'activity' => "ควิซทบทวนและเกริ่นเรื่อง {$t[1]}", 'styles' => ['A']], ['phase' => 'ขั้นสอน', 'minutes' => 30, 'activity' => 'สาธิตด้วยภาพจำลอง', 'styles' => ['V', 'k', 'X']], ['phase' => 'ขั้นฝึก', 'minutes' => 90, 'activity' => 'แล็บเขียนโปรแกรม', 'styles' => ['K']], ['phase' => 'ขั้นสรุป', 'minutes' => 15, 'activity' => 'สรุปร่วมกัน', 'styles' => ['R']]],
            'materials' => ['Python 3', 'VisuAlgo'], 'differentiation' => ['V' => 'ภาพ', 'A' => 'อธิบายคู่', 'R' => 'ใบงาน', 'K' => 'แล็บ'],
            'fixed_mindset_support' => 'แบ่งโจทย์เป็นขั้นเล็ก', 'check_questions' => ['ข้อ 1', 'ข้อ 2', 'ข้อ 3']];
    }
    echo json_encode(['candidates' => [['content' => ['parts' => [['text' => "```json\n" . json_encode($out, JSON_UNESCAPED_UNICODE) . "\n```"]]], 'finishReason' => 'STOP']], 'usageMetadata' => ['promptTokenCount' => 900, 'candidatesTokenCount' => 700]]);
    exit;
}
http_response_code(404);
echo json_encode(['error' => ['code' => 404, 'message' => 'not found']]);
