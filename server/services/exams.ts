import type { AuthUser } from '../../shared/types/auth'
import type { Course, StaffRecord } from '../../shared/types/staff'
import type { SqlClient } from '../utils/db'
import { ApiError, inputString } from '../utils/errors'
import { course } from '../utils/ownership'
import { array, record, text } from '../utils/staff'
import { phpInt } from './scenarioEngine'
import { institution } from './admin'
import { enabledKey, aiClient } from './aiSettings'
import { isHigher, normalizePlan, normalizeSheet } from './documentModels'
import { curriculumText } from './documentPrompts'
import { EXAM_NAME } from './teachingSchedule'

/**
 * Exam questions for the midterm/final week, drafted by AI from the units the teacher actually taught (ticked, never
 * preselected): the plan's objectives and content, the knowledge sheets and their end-of-unit exercises. New questions
 * in the same style — not copies of the exercises. Course content only, no student data.
 */
const LETTERS = ['ก', 'ข', 'ค', 'ง']
export const DEFAULT_OPTIONS = { mcq: 20, essay: 2, mcq_points: 1, essay_points: 5 }
const kindOf = (value: unknown) => {
  const kind = inputString(value)
  if (!['midterm', 'final'].includes(kind)) throw new ApiError(404, 'ไม่พบหน้านี้')
  return kind
}
// markdown code marks (`x`, ```) mean nothing on a printed paper
const clean = (value: unknown, max: number) => text(inputString(Array.isArray(value) ? value.join('\n') : value ?? '').replace(/\r|```|`/g, ''), max)

/** The course's units with what each has to draw questions from. */
async function units(db: SqlClient, data: Course) {
  const topics: string[] = JSON.parse(data.topics ?? '[]') || []
  const plans = await db.rows<StaffRecord>("SELECT id,unit_no,content FROM lesson_plans WHERE course_id=? AND kind='unit'", [data.id])
  const sheets = await db.rows<StaffRecord>("SELECT s.plan_id,s.content FROM lesson_sheets s JOIN lesson_plans p ON p.id=s.plan_id WHERE p.course_id=? AND s.type='knowledge'", [data.id])
  return topics.map((name, index) => {
    const no = index + 1, mine = plans.filter(plan => Number(plan.unit_no) === no)
    const plan = mine.length ? normalizePlan(JSON.parse(mine[0]!.content)) : null
    const knowledge = sheets.filter(sheet => mine.some(p => Number(p.id) === Number(sheet.plan_id))).map(sheet => normalizeSheet('knowledge', JSON.parse(sheet.content)))
    return {
      no, name, plan, knowledge,
      has_plan: !!plan && plan.content !== '',
      has_knowledge: knowledge.some(k => text(k.content) !== ''),
      has_exercises: knowledge.some(k => text(k.exercises) !== ''),
    }
  })
}
export function options(input: unknown) {
  const o = record(input), clamp = (v: unknown, def: number, min: number, max: number, int = true) => { const n = int ? phpInt(v ?? def) : Number(v ?? def); return Math.max(min, Math.min(max, Number.isFinite(n) ? n : def)) }
  return { mcq: clamp(o.mcq, DEFAULT_OPTIONS.mcq, 0, 60), essay: clamp(o.essay, DEFAULT_OPTIONS.essay, 0, 10), mcq_points: clamp(o.mcq_points, DEFAULT_OPTIONS.mcq_points, .5, 10, false), essay_points: clamp(o.essay_points, DEFAULT_OPTIONS.essay_points, 1, 50, false) }
}
/** Questions in a fixed shape: multiple choice has four choices and the letter of the answer. */
export function normalizeQuestions(input: unknown, unitNos: number[] = []) {
  const result = array(input).slice(0, 80).map(record).filter(q => clean(q.question, 2000) !== '').map(q => {
    const type = q.type === 'essay' ? 'essay' : 'mcq', unit = phpInt(q.unit_no)
    const item: StaffRecord = { type, unit_no: unitNos.length && !unitNos.includes(unit) ? unitNos[0] : unit, level: /^K[1-6]$/.test(inputString(q.level)) ? q.level : 'K2', question: clean(q.question, 2000), choices: [], answer: '', guide: clean(q.guide, 2000) }
    if (type === 'mcq') {
      const choices = array(q.choices).slice(0, 4).map(c => clean(c, 400).replace(/^[กขคง][.)]\s*/u, ''))
      item.choices = [...choices, '', '', '', ''].slice(0, 4)
      const answer = Array.from(clean(q.answer, 10))[0] ?? ''
      item.answer = LETTERS.includes(answer) ? answer : 'ก'
    } else item.answer = clean(q.answer, 2000)
    return item
  })
  // multiple choice first, then essays, each by unit — the order of the paper
  return result.sort((a, b) => Number(a.type === 'essay') - Number(b.type === 'essay') || a.unit_no - b.unit_no)
}
/**
 * Models tend to put the right answer in the same few places: move the choices so the answers are spread evenly over
 * ก ข ค ง in an unpredictable order (the choices themselves stay as written).
 */
function spreadAnswers(questions: StaffRecord[]) {
  let targets: number[] = []
  for (const q of questions) {
    if (q.type !== 'mcq') continue
    if (!targets.length) targets = [0, 1, 2, 3].sort(() => Math.random() - .5)
    const want = targets.pop()!, has = LETTERS.indexOf(q.answer)
    ;[q.choices[has], q.choices[want]] = [q.choices[want], q.choices[has]]
    q.answer = LETTERS[want]
  }
  return questions
}
async function saved(db: SqlClient, courseId: number, kind: string) {
  const row = (await db.rows<StaffRecord>('SELECT units,options,content,ai_model,updated_at FROM exam_sets WHERE course_id=? AND kind=?', [courseId, kind]))[0]
  return row ? { units: JSON.parse(row.units) || [], options: options(JSON.parse(row.options)), questions: normalizeQuestions(JSON.parse(row.content).questions ?? []), ai_model: row.ai_model, updated_at: row.updated_at } : null
}
async function store(db: SqlClient, courseId: number, kind: string, unitNos: number[], opts: StaffRecord, questions: StaffRecord[], model: string | null, userId: number) {
  await db.execute('INSERT INTO exam_sets (course_id,kind,units,options,content,ai_model,updated_by) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE units=VALUES(units),options=VALUES(options),content=VALUES(content),ai_model=COALESCE(VALUES(ai_model),ai_model),updated_by=VALUES(updated_by)',
    [courseId, kind, JSON.stringify(unitNos), JSON.stringify(opts), JSON.stringify({ questions }), model, userId])
}

/** GET /teacher/courses/{id}/exam/{kind} — the units (with what each has to draw from) and the saved set. */
export async function showExam(db: SqlClient, user: AuthUser, id: number, kindParam: unknown) {
  const data = await course(db, user, id), kind = kindOf(kindParam)
  return { course: data, level_higher: isHigher(data), institution: (await institution(db)).name ?? '', units: (await units(db, data)).map(({ plan: _, knowledge: __, ...u }) => u), set: await saved(db, id, kind), defaults: DEFAULT_OPTIONS }
}
/** PUT /teacher/courses/{id}/exam/{kind} — { questions } after the teacher's edits. */
export async function saveExam(db: SqlClient, user: AuthUser, id: number, kindParam: unknown, body: StaffRecord) {
  await course(db, user, id)
  const kind = kindOf(kindParam), set = await saved(db, id, kind)
  if (!set) throw new ApiError(404, 'ยังไม่มีแนวข้อสอบ')
  await store(db, id, kind, set.units, set.options, normalizeQuestions(body.questions), null, user.id)
  return { set: await saved(db, id, kind) }
}
/** POST /teacher/courses/{id}/exam/{kind}/generate — one AI request, saved at once so it is never lost. */
export async function generateExam(db: SqlClient, user: AuthUser, id: number, kindParam: unknown, body: StaffRecord, signal?: AbortSignal) {
  const data = await course(db, user, id), kind = kindOf(kindParam), opts = options(body.options)
  const unitNos = [...new Set(array(body.units).map(phpInt))]
  const picked = (await units(db, data)).filter(u => unitNos.includes(u.no))
  if (!picked.length) throw new ApiError(422, 'กรุณาเลือกหน่วยที่สอนไปแล้วอย่างน้อย 1 หน่วย')
  if (opts.mcq + opts.essay < 1) throw new ApiError(422, 'กรุณากำหนดจำนวนข้อสอบอย่างน้อย 1 ข้อ')
  const resolved = await enabledKey(db, user.id, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อน')
  const level = isHigher(data) ? 'ปวส.' : 'ปวช.', exam = EXAM_NAME[kind]!
  let unitText = ''
  for (const u of picked) {
    unitText += `\n### หน่วยที่ ${u.no} ${u.name}\n`
    if (u.plan) unitText += 'จุดประสงค์: ' + Object.values(u.plan.objectives).filter(Boolean).join(' / ').slice(0, 600) + '\nสาระการเรียนรู้: ' + String(u.plan.content).slice(0, 1500) + '\n'
    for (const k of u.knowledge.slice(0, 2)) unitText += 'ใบความรู้: ' + String(k.content).slice(0, 1500) + '\n' + (text(k.exercises) ? 'แบบทดสอบท้ายหน่วยเดิม (ใช้ดูแนวและระดับความยากเท่านั้น ห้ามนำข้อเดิมมาใช้): ' + String(k.exercises).slice(0, 800) + '\n' : '')
    if (!u.plan && !u.knowledge.length) unitText += '(ยังไม่มีแผนหรือใบความรู้ ให้ออกจากชื่อหน่วยและคำอธิบายรายวิชา)\n'
  }
  const prompt = curriculumText(data)
    + `รายวิชา ${data.code} ${data.name} ระดับ ${level}\n`
    + `งาน: ออกแนวข้อสอบ${exam}ให้ครู จากเฉพาะหน่วยที่ครูสอนไปแล้วต่อไปนี้:\n${unitText}\n`
    + `จำนวน: ปรนัย 4 ตัวเลือก ${opts.mcq} ข้อ และอัตนัย ${opts.essay} ข้อ พอดี กระจายตามปริมาณเนื้อหาของแต่ละหน่วย\n`
    + 'กติกา:\n'
    + '- ออกข้อใหม่ทั้งหมด ห้ามคัดลอกข้อจากแบบทดสอบท้ายหน่วยเดิม ถามเฉพาะเนื้อหาในหน่วยที่ให้มา\n'
    + `- วัดตามจุดประสงค์ของหน่วย กระจายระดับ K1 จำ K2 เข้าใจ K3 นำไปใช้ K4 วิเคราะห์ ให้เหมาะกับระดับ ${level} (มีคำถามเชิงสถานการณ์ในงานอาชีพบ้าง)\n`
    + '- ปรนัย: คำถามชัดเจน ตัวเลือกยาวใกล้เคียงกัน ตัวลวงสมเหตุสมผล มีคำตอบถูกข้อเดียว คำตอบกระจายทั้ง ก ข ค ง ห้ามใช้ “ถูกทุกข้อ/ผิดทุกข้อ”\n'
    + `- อัตนัย: คำถามให้อธิบาย/วิเคราะห์/แก้ปัญหา answer = แนวคำตอบ guide = เกณฑ์ให้คะแนนเต็ม ${opts.essay_points} คะแนน\n`
    + '- ปรนัยแต่ละข้อ guide = เหตุผลสั้น ๆ ว่าทำไมคำตอบนี้ถูก\n'
    + '- ภาษาไทยทางการ ศัพท์เทคนิคใส่ภาษาอังกฤษในวงเล็บได้\n'
    + 'ตอบเป็น JSON: {"questions":[{"type":"mcq","unit_no":1,"level":"K2","question":"","choices":["","","",""],"answer":"ก","guide":""},'
    + '{"type":"essay","unit_no":1,"level":"K3","question":"","answer":"","guide":""}]}'
  const system = 'คุณเป็นครูผู้เชี่ยวชาญการวัดและประเมินผลอาชีวศึกษา ออกข้อสอบตรงจุดประสงค์ ถูกต้องตามหลักวิชา ภาษาชัดเจน ตอบเป็น JSON ตามโครงสร้างที่กำหนดเท่านั้น'
  const response = await aiClient(resolved.key, db, signal).generateResilient(resolved.model, system, prompt, 2, 16000)
  const questions = spreadAnswers(normalizeQuestions(response.data.questions, unitNos))
  if (!questions.length) throw new ApiError(502, 'AI ไม่ได้ส่งข้อสอบกลับมา ลองใหม่อีกครั้ง')
  await store(db, id, kind, unitNos, opts, questions, response.model, user.id)
  return { ...await saved(db, id, kind), model: response.model }
}
