import templates from '../data/plan-prompts.json'
import type { Course, StaffRecord } from '../../shared/types/staff'
import { inputString } from '../utils/errors'
import { bool, text } from '../utils/staff'
import { isHigher, normalizePlan } from './documentModels'
import { EXAM_NAME, expandSessions } from './teachingSchedule'

const T: Record<string, string> = templates
export const prettyJson = (value: unknown) => JSON.stringify(value, null, 4).replace(/\//g, '\\/').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
const render = (template: string, values: StaffRecord) => template.replace(/@@([A-Z_]+)@@/g, (_all, key) => inputString(values[key]))
const parameters = (course: Course, plan: StaffRecord = {}) => ({ CODE: course.code, NAME: course.name, UNIT_NO: plan.unit_no, SESSION_NO: plan.sessions || plan.session_no, UNIT_NAME: plan.unit_name, TITLE: plan.title !== '' ? plan.title : plan.unit_name, HOURS_THEORY: plan.hours_theory, HOURS_PRACTICE: plan.hours_practice })
export function curriculumText(course: StaffRecord) {
  const labels: Record<string, string> = { description: 'คำอธิบายรายวิชา', objectives: 'จุดประสงค์รายวิชา', competencies: 'สมรรถนะรายวิชา', outcome: 'ผลลัพธ์การเรียนรู้ระดับรายวิชา' }
  const parts = Object.entries(labels).filter(([key]) => text(course[key]) !== '').map(([key, label]) => label + ':\n' + text(course[key], 2500))
  return parts.length ? 'หลักสูตรรายวิชา (ใช้เป็นขอบเขตเนื้อหา ห้ามออกนอกหลักสูตร):\n' + parts.join('\n') + '\n\n' : ''
}
export const guidePrompt = (kind: string, ctx: StaffRecord, topic: string | null) => render(T['guide_' + kind]!, { CTX: prettyJson(ctx), TOPIC: topic })
export function planPrompt(course: Course, ctx: StaffRecord, plan: StaffRecord, section: string | null = null, current: StaffRecord = {}) {
  let prompt = curriculumText(course) + render(T['plan_' + (isHigher(course) ? 'higher' : 'lower')]!, { ...parameters(course, plan), CTX: prettyJson(ctx) })
  const times = expandSessions(inputString(plan.sessions ?? '')).length
  if (times > 1) {
    // one plan covers the whole unit: say which session does what
    const rule = `- แผนนี้รวมการสอน ${times} ครั้ง (สอนครั้งที่ ${plan.sessions}) ครั้งละเท่า ๆ กัน: activities ทุกขั้นให้ระบุว่าทำในครั้งใด โดยขึ้นต้นบรรทัดด้วย “ครั้งที่ n:” ตามเลขในช่วงนี้ ให้ครบทุกครั้ง และเนื้อหาในแต่ละครั้งต้องต่อเนื่องกัน\n`
    const at = prompt.lastIndexOf('ตอบเป็น JSON')
    prompt = at < 0 ? prompt + '\n' + rule : prompt.slice(0, at) + rule + prompt.slice(at)
  }
  if (section) {
    // one section only: the rest of the plan (as on screen) is the context
    const others = Object.fromEntries(Object.entries(current).filter(([key]) => key !== section && key !== 'after'))
    prompt += `\n\nสำคัญ: ครั้งนี้ให้ร่างใหม่เฉพาะ "${section}" ข้อเดียว ให้สอดคล้องกับส่วนอื่นของแผนที่ครูมีอยู่แล้วด้านล่าง และตอบ JSON ที่มีเพียง key "${section}" ตามโครงสร้างเดิม:\n` + JSON.stringify(others)
  }
  return prompt
}
/** Exam-week plan: broad, no unit or week numbers (written before teaching); no new content, only running the test. */
export function examPlanPrompt(course: Course, plan: StaffRecord) {
  const exam = EXAM_NAME[plan.kind]!, level = isHigher(course) ? 'ปวส.' : 'ปวช.'
  return curriculumText(course)
    + `จงเขียนแผนการจัดการเรียนรู้ระดับ ${level} สำหรับสัปดาห์${exam} รายวิชา ${course.code} ${course.name} สอนครั้งที่ ${plan.sessions} ทฤษฎี ${plan.hours_theory} ชม. ปฏิบัติ ${plan.hours_practice} ชม.\n`
    + 'กติกา:\n'
    + '- แผนนี้เขียนก่อนสอนจริง จึงเขียนแบบกว้าง ครอบคลุมเรื่องการทดสอบ ห้ามระบุเลขหน่วย ชื่อหน่วยการเรียนรู้ หรือเลขสัปดาห์ของเนื้อหาที่ทดสอบ เพราะครูอาจสอนไม่ตรงตามลำดับ\n'
    + '- ไม่มีเนื้อหาใหม่ในสัปดาห์นี้ กิจกรรมคือการดำเนินการทดสอบเท่านั้น ห้ามแต่งข้อสอบ\n'
    + '- เขียนกระชับ ข้อละ 1-4 บรรทัด ภาษาไทยทางการ\n'
    + '- activities แบบ MIAP: motivation=ชี้แจงกติกา · information=รับแบบทดสอบและคำชี้แจง · application=ทำแบบทดสอบ · progress=เก็บ ตรวจ แจ้งผล\n'
    + '- media/evidence/assessment เกี่ยวกับแบบทดสอบ กระดาษคำตอบ คะแนน เกณฑ์ผ่าน\n'
    + 'ตอบเป็น JSON (ค่าทุกช่องเป็นข้อความ ใช้ \\n ขึ้นบรรทัดใหม่):\n'
    + '{"outcome":"","competency":{"knowledge":"","practice":"","apply":""},"objectives":{"cognitive":"","psychomotor":"","affective":"","application":""},"content":"","activities":{"motivation":"","information":"","application":"","progress":""},"media":"","evidence":{"knowledge":"","performance":""},"assessment":{"criteria":"","methods":"","tools":""}}'
}
export function sheetPrompt(course: Course, plan: StaffRecord, type: string, sheet: StaffRecord) {
  const pc = normalizePlan(JSON.parse(plan.content)), summary = Object.fromEntries(['outcome', 'competency', 'objectives', 'content', 'activities', 'media', 'assessment'].map(key => [key, pc[key]]))
  return curriculumText(course) + render(T[`sheet_${type}_${isHigher(course) ? 'higher' : 'lower'}`]!, { ...parameters(course, plan), TITLE: plan.title, SHEET_TITLE: sheet.title !== '' ? sheet.title : bool(plan.title) ? plan.title : plan.unit_name, PLAN_SUMMARY: prettyJson(summary) })
}
export function bookPrompt(course: Course, ctx: StaffRecord, content: StaffRecord) {
  return render(T['book_' + (isHigher(course) ? 'higher' : 'lower')]!, { ...parameters(course), ...Object.fromEntries(Object.entries(content.curriculum).map(([key, value]) => ['CUR_' + key.toUpperCase(), value])), UNITS: content.units.map((unit: StaffRecord) => `${unit.no}. ${unit.name}`).join('\n'), CLASS_STATS: JSON.stringify(ctx.class).replace(/\//g, '\\/') })
}
export function suggestPrompt(course: StaffRecord) {
  const higher = inputString(course.level).includes('ปวส'), weeks = higher ? 15 : 18, t = parseFloat(course.theory_hours) || 0, p = parseFloat(course.practice_hours) || 0
  const type = ({ theory: 'ทฤษฎี', practice: 'ปฏิบัติ', mixed: 'ทฤษฎี+ปฏิบัติ' } as StaffRecord)[course.course_type ?? 'mixed'] ?? 'ทฤษฎี+ปฏิบัติ'
  const info = `รายวิชา ${course.code} ${course.name} ระดับ ${higher ? 'ปวส.' : 'ปวช.'} ประเภท ${type}` + (t + p > 0 ? `\nเวลาเรียน ทฤษฎี ${t} ชม./สัปดาห์ ปฏิบัติ ${p} ชม./สัปดาห์ จัดเรียน ${weeks} สัปดาห์ สัปดาห์ละ 1 ครั้ง (รวม ${(t + p) * weeks} ชม.) ในนี้มีสัปดาห์ทดสอบกลางภาคและปลายภาคอย่างละ 1 สัปดาห์ จึงเหลือสัปดาห์สำหรับเนื้อหา ${weeks - 2} สัปดาห์ (${(t + p) * (weeks - 2)} ชม.)` : '') + '\nคำอธิบายรายวิชา:\n' + text(course.description, 3000) + '\nจุดประสงค์รายวิชา:\n' + text(course.objectives, 2000) + '\nสมรรถนะรายวิชา:\n' + text(course.competencies, 2000)
  // each unit in whole weeks, adding up to the content weeks exactly
  const rule = `ชั่วโมงทฤษฎี/ปฏิบัติของแต่ละหน่วยต้องเป็นจำนวนสัปดาห์เต็ม (สัปดาห์ละ ${t + p} ชม. คือ ท. ${t} ป. ${p}) ตามความยากและปริมาณเนื้อหา และรวมทุกหน่วยได้ ${weeks - 2} สัปดาห์พอดี ไม่ต้องรวมสัปดาห์ทดสอบ `
  return { system: T.suggest_system!, prompt: info + render(T['suggest_suffix_' + (t + p > 0 ? 1 : 0)]!, { UNIT_HOURS_RULE: rule }) }
}
export function standardPrompt(course: Course, plan: StaffRecord) {
  const competency = JSON.parse(plan.content || '{}')?.competency ?? {}
  let info = `รายวิชา: ${course.code} ${course.name} (${isHigher(course) ? 'ปวส.' : 'ปวช.'}` + (bool(course.department_name) ? ` แผนก${course.department_name}` : '') + ')\n'
  info += `หน่วยที่ ${plan.unit_no}: ${plan.unit_name}` + (plan.title !== '' && plan.title !== plan.unit_name ? ` · เรื่อง ${plan.title}` : '') + '\n'
  if (text(course.standards_ref)) info += 'อ้างอิงมาตรฐานในหลักสูตรรายวิชา: ' + text(course.standards_ref, 800) + '\n'
  if (text(course.description)) info += 'คำอธิบายรายวิชา: ' + text(course.description, 1200) + '\n'
  if (Object.values(competency).some(bool)) info += 'สมรรถนะประจำหน่วย: ' + [competency.knowledge, competency.practice, competency.apply].filter(bool).join(' / ') + '\n'
  return { system: T.standard_system!, prompt: info.slice(0, -1) + T.standard_suffix! }
}
