<?php
/**
 * Rebuild the database from schema.sql and insert demo seed data.
 * Usage: php backend/database/migrate.php [--no-seed]
 */
require __DIR__ . '/../bootstrap.php';

use App\Core\Database;
use App\Services\Progression;
use App\Services\ScenarioEngine;

$pdo = Database::connect(app_config('db'), false);
$pdo->exec(file_get_contents(__DIR__ . '/schema.sql'));
echo "Schema created.\n";

if (in_array('--no-seed', $argv, true)) {
    exit(0);
}

$pdo->exec('USE ' . app_config('db')['name']);
$year = app_config('academic_year');
$sem = app_config('semester');

$pdo->exec("INSERT INTO departments (code, name) VALUES
    ('IT', 'เทคโนโลยีสารสนเทศ'),
    ('ACC', 'การบัญชี'),
    ('MKT', 'การตลาด')");

$users = $pdo->prepare('INSERT INTO users (username, password_hash, full_name, role, department_id, student_code) VALUES (?, ?, ?, ?, ?, ?)');
$users->execute(['admin', password_hash('admin1234', PASSWORD_DEFAULT), 'ผู้ดูแลระบบ', 'admin', null, null]);
$users->execute(['teacher1', password_hash('teacher1234', PASSWORD_DEFAULT), 'ครูสมศรี ใจดี', 'teacher', 1, null]);
$users->execute(['teacher2', password_hash('teacher1234', PASSWORD_DEFAULT), 'ครูวิชัย บัญชีดี', 'teacher', 2, null]);

$studentNames = ['กิตติ', 'ขวัญใจ', 'คมสัน', 'จันทร์เพ็ญ', 'ชัยวัฒน์', 'ณัฐธิดา', 'ธนพล', 'นภัสสร', 'ปิยะพงษ์', 'พิมพ์ชนก'];
$studentPw = password_hash('student1234', PASSWORD_DEFAULT);
foreach ($studentNames as $i => $name) {
    $n = str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT);
    $users->execute(["student$n", $studentPw, "$name นักเรียน", 'student', 1, "6901$n"]);
}

// Demo class: 36 extra students (student011..student046) who already played, for the teacher dashboard.
$demoFirst = ['อนุชา', 'อรอุมา', 'กฤษดา', 'กัญญารัตน์', 'จิรายุ', 'ชลธิชา', 'ณัฐพล', 'ดวงใจ', 'ธีรเดช', 'นันทิชา', 'ปฐมพงศ์', 'ปาริฉัตร',
    'พงศกร', 'พรทิพย์', 'ภานุวัฒน์', 'มณีรัตน์', 'รัฐภูมิ', 'รุ่งนภา', 'วรเมธ', 'วิมลรัตน์', 'ศุภชัย', 'ศิริพร', 'สิทธิชัย', 'สุนิสา',
    'อภิสิทธิ์', 'อัญชลี', 'เอกชัย', 'ไอลดา', 'ธนวัฒน์', 'เบญจวรรณ', 'ชยพล', 'กนกวรรณ', 'วีรภัทร', 'ปิยะนุช', 'สรวิชญ์', 'ธิดารัตน์'];
$demoLast = ['ศรีสุข', 'ใจงาม', 'มั่นคง', 'ทองดี', 'แก้วมณี', 'บุญมา', 'สายทอง', 'พรหมมา', 'จันทร์หอม', 'ศรีสะเกษ', 'คำภา', 'ภูมิใจ'];
foreach ($demoFirst as $i => $first) {
    $n = str_pad((string) ($i + 11), 3, '0', STR_PAD_LEFT);
    $users->execute(["student$n", $studentPw, "$first {$demoLast[$i % count($demoLast)]}", 'student', 1, "6801$n"]);
}

$courseInsert = $pdo->prepare('INSERT INTO courses (code, name, section, semester, academic_year, department_id, teacher_id, course_type, level, topics, context_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$courseInsert->execute(['30204-2003', 'โครงสร้างข้อมูลและอัลกอริทึม', 'ปวส.1/1', $sem, $year, 1, 2, 'mixed', 'ปวส.1',
    json_encode(['อาร์เรย์', 'ลิงก์ลิสต์', 'สแตก', 'คิว', 'ทรี', 'กราฟ', 'การค้นหา', 'การเรียงลำดับ'], JSON_UNESCAPED_UNICODE),
    'ฝึกเขียนโปรแกรมด้วย Python และวิเคราะห์ความซับซ้อนของอัลกอริทึม']);
$courseInsert->execute(['20201-2001', 'การบัญชีเบื้องต้น', 'ปวช.1/2', $sem, $year, 2, 3, 'theory', 'ปวช.1',
    json_encode(['สมการบัญชี', 'การวิเคราะห์รายการค้า', 'สมุดรายวันทั่วไป', 'บัญชีแยกประเภท', 'งบทดลอง'], JSON_UNESCAPED_UNICODE),
    'วิชาทฤษฎี แผนกการบัญชี']);
// DSA class: the 10 fresh students (not played yet) + the 36 demo students.
$pdo->exec("INSERT INTO enrollments (course_id, student_id) SELECT 1, id FROM users WHERE role = 'student'");
$pdo->exec("INSERT INTO enrollments (course_id, student_id) SELECT 2, id FROM users WHERE role = 'student' AND username BETWEEN 'student031' AND 'student046'");

$archetypes = [
    ['BUILDER',   'The Builder',   'นักสร้างสรรค์ลงมือทำ', 'คุณเรียนรู้ได้ดีที่สุดเมื่อได้ลงมือทำจริง ชอบแก้ปัญหาที่จับต้องได้ และภูมิใจกับผลงานที่สร้างขึ้นด้วยมือตัวเอง', ['ลงมือปฏิบัติได้คล่อง', 'แก้ปัญหาเฉพาะหน้าเก่ง', 'อดทนและมุ่งมั่น'], ['เรียนผ่านโปรเจกต์และการทดลอง', 'แบ่งงานใหญ่เป็นชิ้นเล็กที่ทำเสร็จได้'], 'R', '#f97316', 'hammer'],
    ['EXPLORER',  'The Explorer',  'นักสำรวจผู้ใฝ่รู้',     'คุณชอบตั้งคำถามว่า "ทำไม" และสนุกกับการค้นหาคำตอบ วิเคราะห์ข้อมูลอย่างเป็นเหตุเป็นผล', ['คิดวิเคราะห์เป็นระบบ', 'ช่างสังเกต', 'รักการเรียนรู้ด้วยตนเอง'], ['ใช้แผนผังความคิดเชื่อมโยงเนื้อหา', 'ตั้งคำถามก่อนเริ่มเรียน'], 'I', '#0ea5e9', 'telescope'],
    ['CREATOR',   'The Creator',   'ศิลปินผู้จุดประกาย',    'คุณมีจินตนาการโดดเด่น มองเห็นความเป็นไปได้ใหม่ ๆ และถ่ายทอดความคิดออกมาได้อย่างมีเอกลักษณ์', ['ความคิดสร้างสรรค์สูง', 'สื่อสารผ่านภาพและเรื่องราว', 'ยืดหยุ่นทางความคิด'], ['สรุปบทเรียนเป็นภาพหรือ Infographic', 'เลือกงานที่เปิดให้ออกแบบได้อิสระ'], 'A', '#a855f7', 'palette'],
    ['GUARDIAN',  'The Guardian',  'ผู้พิทักษ์ใจอาสา',       'คุณใส่ใจผู้อื่น เป็นที่พึ่งของเพื่อน และเรียนรู้ได้ดีเมื่อได้แลกเปลี่ยนและช่วยเหลือกัน', ['เข้าใจความรู้สึกผู้อื่น', 'ทำงานเป็นทีมได้ดี', 'สื่อสารอบอุ่น'], ['เรียนเป็นกลุ่มหรือสอนเพื่อน', 'เชื่อมโยงบทเรียนกับการช่วยเหลือสังคม'], 'S', '#10b981', 'shield'],
    ['LEADER',    'The Leader',    'ผู้นำแห่งการเปลี่ยนแปลง', 'คุณกล้าตัดสินใจ ชอบความท้าทาย และสามารถจูงใจผู้อื่นให้มุ่งไปสู่เป้าหมายเดียวกัน', ['กล้าตัดสินใจ', 'โน้มน้าวเก่ง', 'มองเป้าหมายชัดเจน'], ['รับบทบาทหัวหน้ากลุ่มหรือผู้นำเสนอ', 'ตั้งเป้าหมายและติดตามความก้าวหน้า'], 'E', '#ef4444', 'crown'],
    ['STRATEGIST','The Strategist','นักวางแผนผู้แม่นยำ',     'คุณเป็นคนละเอียด มีระเบียบ และชอบทำงานตามแผนที่ชัดเจน ผลงานของคุณจึงน่าเชื่อถือเสมอ', ['ละเอียดรอบคอบ', 'จัดการเวลาเก่ง', 'รับผิดชอบสูง'], ['ใช้ Checklist และตารางเวลา', 'ขอเกณฑ์การประเมินที่ชัดเจนก่อนเริ่มงาน'], 'C', '#6366f1', 'compass'],
];
$arch = $pdo->prepare('INSERT INTO archetype_master (code, name, title, description, strengths, tips, riasec_key, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
foreach ($archetypes as $a) {
    $a[4] = json_encode($a[4], JSON_UNESCAPED_UNICODE);
    $a[5] = json_encode($a[5], JSON_UNESCAPED_UNICODE);
    $arch->execute($a);
}

$universal = [
    ['arcana-gate', 'ประตูแห่งอาร์คานา', 'จดหมายลึกลับนำคุณสู่หอสมุดเวทมนตร์ยามเที่ยงคืน ไขผนึกรูน ช่วยมิร่า และปลุกผลึกแห่งตัวตน'],
    ['night-market', 'ตลาดราตรีแห่งเงา', 'ตลาดโคมลอยกับแมวพ่อค้าจอมป่วน ไล่ล่าหัวขโมยปริศนา และจัดเทศกาลปล่อยโคม'],
    ['star-observatory', 'หอดูดาวที่หลับใหล', 'ดวงดาวกำลังดับ! ปลุกโกเลมโบราณ ฝ่าพายุดาวตก และจุดประกายท้องฟ้าอีกครั้ง'],
];
$insert = $pdo->prepare("INSERT INTO scenarios (title, description, owner_id, is_universal, is_active, status, content) VALUES (?, ?, 1, 1, 1, 'published', ?)");
foreach ($universal as [$file, $title, $desc]) {
    $json = json_decode(file_get_contents(__DIR__ . "/scenarios/$file.json"), true);
    if ($errors = ScenarioEngine::validate($json)) {
        exit("Scenario $file invalid:\n - " . implode("\n - ", $errors) . "\n");
    }
    $insert->execute([$title, $desc, json_encode($json, JSON_UNESCAPED_UNICODE)]);
}
$pdo->exec("INSERT INTO settings (setting_key, setting_value) VALUES
    ('ai_enabled', '1'), ('ai_central_key_enc', ''), ('ai_central_key_hint', ''), ('ai_central_model', '')");

// ---- demo play-throughs (simulated personas through the real engine) ----
require __DIR__ . '/DemoPlayer.php';
mt_srand(2569);
$scenarios = $pdo->query('SELECT id, content FROM scenarios WHERE is_universal = 1 ORDER BY id')->fetchAll();
$archByKey = $pdo->query('SELECT riasec_key, id FROM archetype_master')->fetchAll(PDO::FETCH_KEY_PAIR);
$cols = ScenarioEngine::tagKeys();
$resultInsert = $pdo->prepare(
    'INSERT INTO assessment_results (user_id, scenario_id, semester, academic_year, ' . implode(', ', $cols)
    . ', dominant_vark, dominant_riasec, mindset_type, archetype_id, rarity, xp_gained, coins_gained, choices_log, completed_at) VALUES ('
    . implode(', ', array_fill(0, count($cols) + 13, '?')) . ')'
);
$progress = $pdo->prepare('INSERT INTO player_progress (user_id, xp, coins, avatar) VALUES (?, ?, ?, ?)');
$heroes = ['hero-m1', 'hero-m2', 'hero-m3', 'hero-f1', 'hero-f2', 'hero-f3'];
$demoIds = $pdo->query("SELECT id FROM users WHERE role = 'student' AND username >= 'student011' ORDER BY id")->fetchAll(PDO::FETCH_COLUMN);
foreach ($demoIds as $n => $uid) {
    $persona = DemoPlayer::persona();
    $roll = mt_rand(1, 100);
    $played = $roll <= 72 ? 3 : ($roll <= 90 ? 2 : 1);
    $xp = $coins = 0;
    foreach (array_slice($scenarios, 0, $played) as $q => $sc) {
        $content = json_decode($sc['content'], true);
        $log = DemoPlayer::play($content, $persona);
        $eval = ScenarioEngine::evaluate($content, $log);
        $p = ScenarioEngine::profile($eval['scores'], ScenarioEngine::recency($eval['tag_history']));
        $rw = Progression::rewards($eval['stats'], count($eval['items']));
        $xp += $rw['xp'];
        $coins += $rw['coins'];
        $resultInsert->execute([
            $uid, $sc['id'], $sem, $year, ...array_map(fn ($k) => $eval['scores'][$k], $cols),
            $p['dominant_vark'], $p['dominant_riasec'], $p['mindset_type'], $archByKey[$p['archetype_key']] ?? null,
            Progression::questRarity($eval['stats']), $rw['xp'], $rw['coins'], json_encode($log),
            date('Y-m-d H:i:s', strtotime("-" . (10 - $q * 3) . " days +$n minutes")),
        ]);
    }
    $progress->execute([$uid, $xp, $coins, json_encode(['preset' => $heroes[$n % 6], 'gender' => $n % 6 < 3 ? 'm' : 'f', 'hairStyle' => 'short', 'hair' => '#1f2937', 'skin' => '#f1c7a5', 'eyes' => '#7c3aed', 'robe' => '#4c1d95'])]);
}

echo "Seed data inserted (" . count($demoIds) . " demo students with results).\n";
echo "Logins: admin/admin1234, teacher1/teacher1234 (IT), teacher2/teacher1234 (ACC), student001..student010/student1234 (fresh)\n";
