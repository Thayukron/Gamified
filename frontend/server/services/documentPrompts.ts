import templates from '../data/plan-prompts.json'
import type { Course, StaffRecord } from '../../shared/types/staff'
import { inputString } from '../utils/errors'
import { bool, text } from '../utils/staff'
import { isHigher, normalizePlan } from './documentModels'

const T: Record<string, string> = templates
export const prettyJson = (value: unknown) => JSON.stringify(value, null, 4).replace(/\//g, '\\/').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
const render = (template: string, values: StaffRecord) => template.replace(/@@([A-Z_]+)@@/g, (_all, key) => inputString(values[key]))
const parameters = (course: Course, plan: StaffRecord = {}) => ({ CODE: course.code, NAME: course.name, UNIT_NO: plan.unit_no, SESSION_NO: plan.session_no, UNIT_NAME: plan.unit_name, TITLE: plan.title !== '' ? plan.title : plan.unit_name, HOURS_THEORY: plan.hours_theory, HOURS_PRACTICE: plan.hours_practice })
export function curriculumText(course: StaffRecord) {
  const labels: Record<string, string> = { description: 'คำอธิบายรายวิชา', objectives: 'จุดประสงค์รายวิชา', competencies: 'สมรรถนะรายวิชา', outcome: 'ผลลัพธ์การเรียนรู้ระดับรายวิชา' }
  const parts = Object.entries(labels).filter(([key]) => text(course[key]) !== '').map(([key, label]) => label + ':\n' + text(course[key], 2500))
  return parts.length ? 'หลักสูตรรายวิชา (ใช้เป็นขอบเขตเนื้อหา ห้ามออกนอกหลักสูตร):\n' + parts.join('\n') + '\n\n' : ''
}
export const guidePrompt = (kind: string, ctx: StaffRecord, topic: string | null) => render(T['guide_' + kind]!, { CTX: prettyJson(ctx), TOPIC: topic })
export function planPrompt(course: Course, ctx: StaffRecord, plan: StaffRecord) {
  return curriculumText(course) + render(T['plan_' + (isHigher(course) ? 'higher' : 'lower')]!, { ...parameters(course, plan), CTX: prettyJson(ctx) })
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
  const info = `รายวิชา ${course.code} ${course.name} ระดับ ${higher ? 'ปวส.' : 'ปวช.'} ประเภท ${type}` + (t + p > 0 ? `\nเวลาเรียน ทฤษฎี ${t} ชม./สัปดาห์ ปฏิบัติ ${p} ชม./สัปดาห์ จัดเรียน ${weeks} สัปดาห์ (รวม ${(t + p) * weeks} ชม.)` : '') + '\nคำอธิบายรายวิชา:\n' + text(course.description, 3000) + '\nจุดประสงค์รายวิชา:\n' + text(course.objectives, 2000) + '\nสมรรถนะรายวิชา:\n' + text(course.competencies, 2000)
  return { system: T.suggest_system!, prompt: info + T['suggest_suffix_' + (t + p > 0 ? 1 : 0)]! }
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
