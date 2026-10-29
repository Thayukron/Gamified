import forms from '../data/plan-forms.json'
import type { Course, StaffRecord } from '../../shared/types/staff'
import { inputString, ApiError } from '../utils/errors'
import { array, bool, record, text } from '../utils/staff'
import { phpInt } from './scenarioEngine'
import { KNOWLEDGE as K, teachingGuide, topicKey, VARK_TH, RIASEC_TH } from './teachingGuide'

export const PLAN_EMPTY: StaffRecord = forms.plan.EMPTY
export const BOOK_EMPTY: StaffRecord = forms.book.EMPTY
export const SHEET_FIELDS: Record<string, string[]> = forms.sheet.FIELDS
export const SHEET_TYPES: Record<string, string> = forms.sheet.TYPE_TH
export const SYSTEMS = { plan: forms.plan.SYSTEM, sheet: forms.sheet.SYSTEM, book: forms.book.SYSTEM, guide: forms.ai.SYSTEM }
const scalar = (value: unknown) => ['string', 'number', 'boolean'].includes(typeof value)
export function documentText(value: unknown, max: number, keepArraySlots = false): string {
  if (value != null && typeof value === 'object') value = Object.values(value).map(item => scalar(item) ? inputString(item) : keepArraySlots ? '' : undefined).filter(item => item !== undefined).join('\n')
  return scalar(value) ? text(inputString(value).replace(/\r/g, ''), max) : ''
}
export function normalizePlan(input: unknown) {
  const source = record(input), result: StaffRecord = {}
  for (const [key, shape] of Object.entries(PLAN_EMPTY)) {
    result[key] = typeof shape === 'object' ? Object.fromEntries(Object.keys(shape).map(field => [field, documentText(record(source[key])[field] ?? '', 10000, true)])) : documentText(source[key] ?? '', 10000, true)
  }
  return result
}
export function planCompleteness(content: StaffRecord) {
  const values = Object.entries(PLAN_EMPTY).filter(([key]) => !['after', 'standard'].includes(key)).flatMap(([key, shape]) => typeof shape === 'object' ? Object.keys(shape).map(field => content[key][field]) : [content[key]])
  return Math.round(values.filter(value => value !== '').length / Math.max(1, values.length) * 100)
}
export const isHigher = (course: StaffRecord) => inputString(course.level).includes('ปวส') || inputString(course.section).includes('ปวส')
export function learners(course: Course, dash: StaffRecord) {
  const guide = teachingGuide(course, dash), ranked = (data: StaffRecord, labels: Record<string, string>) => Object.keys(data).sort((a, b) => data[b] - data[a]).map(key => ({ key, label: labels[key], pct: Math.round(data[key]) }))
  return { enrolled: dash.summary.enrolled, profiled: dash.summary.profiled, ready: dash.summary.profiled > 0, vark: ranked(dash.average.vark, VARK_TH), vark_count: dash.distribution.vark, riasec: ranked(dash.average.riasec, RIASEC_TH), mindset: dash.distribution.mindset, summary: 'summary' in guide ? guide.summary : [], term: dash.term }
}
export function prefillPlan(course: Course, dash: StaffRecord, plan: StaffRecord) {
  const content = structuredClone(PLAN_EMPTY), topic = plan.title !== '' ? plan.title : plan.unit_name, verb = isHigher(course) ? 'ประมวลความรู้เกี่ยวกับ' : 'แสดงความรู้เกี่ยวกับ'
  content.outcome = `ผู้เรียนนำความรู้และทักษะเรื่อง${topic} ไปประยุกต์ใช้ในการปฏิบัติงานและชีวิตประจำวันได้อย่างถูกต้อง`
  content.competency = { knowledge: verb + topic, practice: `ปฏิบัติงาน${topic} ตามขั้นตอนและข้อกำหนดที่ถูกต้อง`, apply: `ประยุกต์ใช้ความรู้เรื่อง${topic} แก้ปัญหาในงานอาชีพได้` }
  content.objectives = { cognitive: `อธิบายหลักการของ${topic}ได้ถูกต้อง`, psychomotor: `ปฏิบัติงาน${topic}ตามขั้นตอนได้ถูกต้อง`, affective: 'มีความรับผิดชอบ ตรงต่อเวลา และทำงานร่วมกับผู้อื่นได้', application: `ประยุกต์ใช้${topic}ในสถานการณ์ใหม่ได้อย่างเหมาะสม` }
  const domain = K.DOMAIN_BY_DEPARTMENT[course.department_code ?? ''] ?? 'general', key = domain === 'it' ? topicKey(plan.title, plan.unit_name) : null
  content.content = (key ? K.TOPIC_DETAIL[key].content : K.CONTENT_TEMPLATE.map((line: string) => line.split('{topic}').join(topic))).join('\n')
  content.evidence = { knowledge: 'ผลการทดสอบ / แบบฝึกหัด / การตอบคำถาม', performance: 'ผลงานจากใบงาน / การสังเกตการปฏิบัติงาน' }
  content.assessment = { criteria: 'ผ่านเกณฑ์ร้อยละ 60 ขึ้นไป', methods: 'ทดสอบความรู้\nตรวจผลงานจากใบงาน\nสังเกตพฤติกรรมการปฏิบัติงานและกิจนิสัย', tools: 'แบบทดสอบ\nแบบประเมินผลงาน (Rubric)\nแบบสังเกตพฤติกรรม' }
  const guide: StaffRecord = teachingGuide(course, dash), order: string[] = guide.modalities?.map((m: StaffRecord) => m.key) || ['V', 'R', 'K']
  const media: string[] = key ? [...K.TOPIC_DETAIL[key].media] : order.slice(0, 3).map(modality => { const template = K.MEDIA_TEMPLATE[modality]; return (typeof template === 'object' ? template[domain] : template).split('{topic}').join(topic) })
  media.push(`ใบความรู้ เรื่อง ${topic}`, `ใบงาน/ใบกิจกรรม เรื่อง ${topic}`); content.media = [...new Set(media)].join('\n')
  if (!guide.ready) {
    content.activities = { motivation: `ครูนำเข้าสู่บทเรียนด้วยสถานการณ์/ปัญหาจริงที่เกี่ยวกับ${topic} และตั้งคำถามกระตุ้นความสนใจ`, information: `ครูอธิบายเนื้อหา${topic} พร้อมตัวอย่าง ผู้เรียนศึกษาใบความรู้`, application: 'ผู้เรียนฝึกปฏิบัติตามใบงาน ครูให้คำแนะนำรายบุคคล', progress: 'ผู้เรียนนำเสนอผลงาน ครูและผู้เรียนร่วมกันสรุป ทำแบบทดสอบท้ายหน่วย' }
    return content
  }
  const unit = guide.units.find((unit: StaffRecord) => unit.no === phpInt(plan.unit_no) || unit.topic === plan.unit_name), acts = unit?.activities ?? guide.modalities.slice(0, 2).map((m: StaffRecord) => ({ label: m.label, text: m.activities?.[0] ?? '' })), primary = guide.modalities[0], method = guide.methods[0]
  content.activities = { motivation: `ครูนำเข้าสู่บทเรียนด้วยสถานการณ์/ปัญหาจริงที่เกี่ยวกับ${topic}` + (key ? ' โดยใช้ ' + K.TOPIC_DETAIL[key].media[0] : '') + ' และตั้งคำถามกระตุ้นความสนใจ', information: `ครูอธิบายเนื้อหา${topic} โดยสลับสื่อหลายรูปแบบ เน้น${primary.label} ซึ่งเป็นช่องทางที่ผู้เรียนห้องนี้ถนัด`, application: acts.map((a: StaffRecord) => a.text).join('\n') + (method ? `\nจัดกิจกรรมแบบ${method.method} ตามความสนใจเด่นของห้อง` : ''), progress: unit?.check ?? 'ผู้เรียนสรุปความรู้และทำแบบทดสอบท้ายหน่วย' }
  const differentiation = acts.map((a: StaffRecord) => `ผู้เรียนสาย${a.label}: ${a.text}`)
  if (guide.mindset.fixed_pct > 0) differentiation.push(`ผู้เรียน Fixed Mindset (${guide.mindset.fixed_pct}%): ${guide.mindset.fixed[0]}`)
  content.differentiation = differentiation.join('\n')
  return content
}
export function assertSheetType(type: string) { if (!Object.hasOwn(SHEET_FIELDS, type)) throw new ApiError(422, 'ชนิดเอกสารไม่ถูกต้อง') }
function shapedRows(value: unknown, shape: StaffRecord, max: number, fieldMax: number) {
  return (value && typeof value === 'object' ? Object.values(value) : []).slice(0, max).map(raw => Object.fromEntries(Object.keys(shape).map(key => [key, documentText(record(raw)[key] ?? '', fieldMax)]))).filter(row => Object.values(row).join('') !== '')
}
export function normalizeSheet(type: string, input: unknown) {
  assertSheetType(type)
  const source = record(input), result: StaffRecord = Object.fromEntries(SHEET_FIELDS[type]!.map(key => [key, documentText(source[key] ?? '', 12000)]))
  if (type === 'assessment') result.rubric = shapedRows(source.rubric, forms.sheet.RUBRIC_ROW, 30, 800)
  return result
}
export function sheetCompleteness(type: string, content: StaffRecord) {
  const keys = SHEET_FIELDS[type]!, share = keys.filter(key => (content[key] ?? '') !== '').length / keys.length
  return Math.round((type === 'assessment' ? share * .3 + (content.rubric?.length ? .7 : 0) : share) * 100)
}
const lines = (value: string) => value.split('\n').map(value => text(value)).filter(bool)
export function sheetShared(plan: StaffRecord) {
  const standard = [bool(plan.standard.occupation) ? 'มาตรฐานอาชีพ ' + plan.standard.occupation + (bool(plan.standard.sub_competency) ? ' สมรรถนะย่อย ' + plan.standard.sub_competency : '') : '', bool(plan.standard.career_integration) ? 'บูรณาการกลุ่มอาชีพ ' + plan.standard.career_integration : ''].filter(bool)
  return { outcome: plan.outcome, standard: standard.join('\n'), competency: [plan.competency.knowledge, plan.competency.practice, plan.competency.apply].filter(bool).join('\n'), objectives: ['cognitive', 'psychomotor', 'affective', 'application'].flatMap(key => lines(plan.objectives[key])).join('\n') }
}
export function sheetFromPlan(type: string, plan: StaffRecord) {
  assertSheetType(type)
  const pc = normalizePlan(JSON.parse(plan.content)), topic = plan.title !== '' ? plan.title : plan.unit_name, result: StaffRecord = Object.fromEntries(SHEET_FIELDS[type]!.map(key => [key, '']))
  if (type !== 'assessment') Object.assign(result, sheetShared(pc))
  const evaluation = text(pc.assessment.methods + (bool(pc.assessment.criteria) ? '\nเกณฑ์: ' + pc.assessment.criteria : ''))
  if (type === 'knowledge') { result.content = bool(pc.content) ? pc.content : topic; result.exercises = `ตอบคำถามต่อไปนี้\n1. จงอธิบายความหมายของ${topic}\n2. จงยกตัวอย่างการนำ${topic}ไปใช้ในงานอาชีพ` }
  else if (type === 'job' || type === 'activity') { result.tools = pc.media; result.steps = pc.activities.application; result.evaluation = evaluation; if (type === 'job') result.advice = 'ปฏิบัติงานตามขั้นตอนอย่างเคร่งครัด และใช้เครื่องมืออย่างถูกวิธีและปลอดภัย'; result.conclusion = 'ผู้เรียนสรุปผลการปฏิบัติ ปัญหาที่พบ และแนวทางแก้ไข' }
  else if (type === 'assignment') { result.outcome = `ผลงานเรื่อง${topic}ที่ถูกต้องครบถ้วนตามที่กำหนด`; result.details = `ให้ผู้เรียนจัดทำผลงานเรื่อง${topic} ตามรายละเอียดที่ครูกำหนด`; result.deadline = 'ภายในสัปดาห์ถัดไป'; result.guidelines = pc.activities.application; result.sources = pc.media; result.evaluation = evaluation }
  else {
    result.instructions = 'ให้ครูผู้สอนประเมินความสามารถของผู้เรียนตามรายการประเมิน โดยทำเครื่องหมาย ✓ ในช่องระดับคะแนนที่ตรงกับพฤติกรรมที่สังเกตได้'
    result.pass = 'ผู้เรียนต้องได้คะแนนรวมไม่น้อยกว่าร้อยละ 60 จึงถือว่าผ่านเกณฑ์'
    const objectives = lines(sheetShared(pc).objectives)
    result.rubric = (objectives.length ? objectives : [`ปฏิบัติงานเรื่อง${topic}`]).slice(0, 8).map(item => ({ item, l4: 'ทำได้ถูกต้องครบถ้วน ด้วยตนเอง', l3: 'ทำได้ถูกต้องเป็นส่วนใหญ่', l2: 'ทำได้บางส่วน ต้องได้รับคำแนะนำ', l1: 'ทำไม่ได้ หรือทำได้น้อยมาก' }))
  }
  return normalizeSheet(type, result)
}
export function normalizeBook(input: unknown) {
  const source = record(input), result = structuredClone(BOOK_EMPTY)
  for (const key of Object.keys(BOOK_EMPTY.curriculum)) result.curriculum[key] = documentText(record(source.curriculum)[key] ?? '', 6000)
  for (const key of ['agency', 'standard', 'occupation', 'level']) result.occupational[key] = documentText(record(source.occupational)[key] ?? '', 300)
  result.occupational.rows = shapedRows(record(source.occupational).rows, forms.book.OCC_ROW, 80, 1500)
  result.job_analysis.job = documentText(record(source.job_analysis).job ?? '', 1000)
  result.job_analysis.rows = shapedRows(record(source.job_analysis).rows, forms.book.JOB_ROW, 80, 1500)
  result.units = shapedRows(source.units, forms.book.UNIT_ROW, 40, 1500)
  for (const key of Object.keys(BOOK_EMPTY.final_eval)) result.final_eval[key] = documentText(record(source.final_eval)[key] ?? '', 20)
  for (const key of ['preface', 'bibliography', 'author']) result[key] = documentText(source[key] ?? '', 6000)
  return result
}
export function bookDefaults(course: Course, plans: StaffRecord[], teacherName: string) {
  const result = structuredClone(BOOK_EMPTY)
  result.curriculum.program = isHigher(course) ? 'ประกาศนียบัตรวิชาชีพชั้นสูง พุทธศักราช 2567' : 'ประกาศนียบัตรวิชาชีพ พุทธศักราช 2567'
  result.curriculum.major = course.department_name ?? ''; result.author = teacherName
  const hours: Record<number, { t: number; p: number }> = {}
  for (const plan of plans) { const no = phpInt(plan.unit_no); hours[no] ??= { t: 0, p: 0 }; hours[no].t += Number(plan.hours_theory); hours[no].p += Number(plan.hours_practice) }
  result.units = (JSON.parse(course.topics ?? '[]') || []).map((topic: string, index: number) => ({ no: String(index + 1), name: topic, k: '', s: '', a: '', ap: '', hours_theory: hours[index + 1] ? String(hours[index + 1]!.t) : '', hours_practice: hours[index + 1] ? String(hours[index + 1]!.p) : '', percent: '' }))
  result.preface = `แผนการจัดการเรียนรู้รายวิชา ${course.code} ${course.name} จัดทำขึ้นตามหลักสูตร${result.curriculum.program} โดยมุ่งเน้นการจัดการเรียนรู้ฐานสมรรถนะ และออกแบบกิจกรรมการเรียนรู้ให้สอดคล้องกับความแตกต่างของผู้เรียน จากผลการวิเคราะห์ผู้เรียนรายบุคคลด้านสไตล์การเรียนรู้ ความสนใจอาชีพ และกรอบความคิด\nผู้จัดทำหวังเป็นอย่างยิ่งว่าแผนการจัดการเรียนรู้ฉบับนี้จะเป็นประโยชน์ต่อการจัดการเรียนการสอน และการพัฒนาผู้เรียนให้บรรลุผลลัพธ์การเรียนรู้ตามที่หลักสูตรกำหนด`
  return result
}
