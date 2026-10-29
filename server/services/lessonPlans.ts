import type { AuthUser } from '../../shared/types/auth'
import type { StaffRecord } from '../../shared/types/staff'
import type { SqlClient } from '../utils/db'
import { ApiError, inputString } from '../utils/errors'
import { course } from '../utils/ownership'
import { bool, marks, optionalText, text, write } from '../utils/staff'
import { phpInt } from './scenarioEngine'
import { classData } from './teacherDashboard'
import { institution } from './admin'
import { COURSE_CONTENT } from './teacherCourses'
import { PLAN_EMPTY, SHEET_TYPES, assertSheetType, bookDefaults, isHigher, learners, normalizeBook, normalizePlan, normalizeSheet, planCompleteness, prefillPlan, sheetCompleteness, sheetFromPlan } from './documentModels'
import { draftBook, draftPlan, draftSheet, findStandard } from './aiGeneration'

export function planHeader(body: StaffRecord) {
  const hours = (value: unknown) => Math.max(0, Math.min(99, Math.round((parseFloat(inputString(value)) || 0) * 10) / 10))
  const header = { unit_no: phpInt(body.unit_no), session_no: Math.max(1, phpInt(body.session_no ?? 1)), unit_name: text(body.unit_name, 200), title: text(body.title, 255), hours_theory: hours(body.hours_theory), hours_practice: hours(body.hours_practice) }
  if (header.unit_no < 1 || header.unit_no > 99) throw new ApiError(422, 'หน่วยที่ต้องเป็นตัวเลข 1–99')
  if (!header.unit_name) throw new ApiError(422, 'กรุณากรอกชื่อหน่วยการเรียนรู้')
  return header
}
async function getPlan(db: SqlClient, user: AuthUser, id: number) {
  const plan = (await db.rows<StaffRecord>('SELECT * FROM lesson_plans WHERE id=?', [id]))[0]
  if (!plan) throw new ApiError(404, 'ไม่พบแผนการจัดการเรียนรู้')
  return { plan, course: await course(db, user, plan.course_id) }
}
async function getSheet(db: SqlClient, user: AuthUser, id: number) {
  const sheet = (await db.rows<StaffRecord>('SELECT * FROM lesson_sheets WHERE id=?', [id]))[0]
  if (!sheet) throw new ApiError(404, 'ไม่พบเอกสาร')
  return { sheet, ...await getPlan(db, user, sheet.plan_id) }
}
async function assertFree(db: SqlClient, courseId: number, header: StaffRecord, except = 0) {
  if ((await db.rows<{ n: number }>('SELECT COUNT(*) AS n FROM lesson_plans WHERE course_id=? AND unit_no=? AND session_no=? AND id<>?', [courseId, header.unit_no, header.session_no, except]))[0]!.n) throw new ApiError(409, `มีแผนหน่วยที่ ${header.unit_no} สอนครั้งที่ ${header.session_no} อยู่แล้ว`)
}
function out(plan: StaffRecord): StaffRecord {
  const content = normalizePlan(JSON.parse(plan.content))
  return { id: Number(plan.id), course_id: Number(plan.course_id), unit_no: Number(plan.unit_no), session_no: Number(plan.session_no), unit_name: plan.unit_name, title: plan.title, hours_theory: Number(plan.hours_theory), hours_practice: Number(plan.hours_practice), content, completeness: planCompleteness(content), ai_model: plan.ai_model, updated_at: plan.updated_at }
}
function outSheet(sheet: StaffRecord) {
  const content = normalizeSheet(sheet.type, JSON.parse(sheet.content))
  return { id: Number(sheet.id), plan_id: Number(sheet.plan_id), type: sheet.type, type_th: SHEET_TYPES[sheet.type], number: sheet.number, title: sheet.title, content, completeness: sheetCompleteness(sheet.type, content), ai_model: sheet.ai_model, updated_at: sheet.updated_at }
}
async function sheetsOf(db: SqlClient, ids: number[]) {
  const byId: Record<number, StaffRecord[]> = {}
  if (ids.length) for (const row of await db.rows<StaffRecord>(`SELECT * FROM lesson_sheets WHERE plan_id IN (${marks(ids)}) ORDER BY plan_id, FIELD(type,'knowledge','activity','job','assignment','assessment'),number,id`, ids)) (byId[row.plan_id] ??= []).push(outSheet(row))
  return byId
}
async function withSheets(db: SqlClient, plans: StaffRecord[]): Promise<StaffRecord[]> {
  const byId = await sheetsOf(db, plans.map(plan => plan.id))
  return plans.map(plan => ({ ...plan, sheets: byId[plan.id] ?? [] }))
}
export async function index(db: SqlClient, user: AuthUser, id: number) {
  const data = await course(db, user, id), rows = await db.rows<StaffRecord>('SELECT * FROM lesson_plans WHERE course_id=? ORDER BY unit_no,session_no', [id])
  const plans = (await withSheets(db, rows.map(out))).map(({ content: _, sheets, ...plan }) => ({ ...plan, sheets: sheets.map(({ content: _, ...sheet }: StaffRecord) => sheet) }))
  return { course: data, plans, topics: JSON.parse(data.topics ?? '[]') || [], level_higher: isHigher(data) }
}
export async function create(db: SqlClient, user: AuthUser, id: number, body: StaffRecord) {
  const data = await course(db, user, id), header = planHeader(body)
  await assertFree(db, id, header)
  const content = body.prefill === 'guide' ? prefillPlan(data, await classData(db, data), header) : PLAN_EMPTY
  const result = await write(db, 'INSERT INTO lesson_plans (course_id,unit_no,session_no,unit_name,title,hours_theory,hours_practice,content,created_by) VALUES (?,?,?,?,?,?,?,?,?)', [id, header.unit_no, header.session_no, header.unit_name, header.title, header.hours_theory, header.hours_practice, JSON.stringify(content), user.id])
  return { id: result.id }
}
export async function show(db: SqlClient, user: AuthUser, id: number) {
  const data = await getPlan(db, user, id)
  return { plan: (await withSheets(db, [out(data.plan)]))[0], course: data.course, learners: learners(data.course, await classData(db, data.course)), level_higher: isHigher(data.course) }
}
export async function update(db: SqlClient, user: AuthUser, id: number, body: StaffRecord) {
  const data = await getPlan(db, user, id), header = planHeader(body), model = bool(body.ai_model) ? inputString(body.ai_model).slice(0, 80) : null
  await assertFree(db, data.course.id, header, id)
  await db.execute('UPDATE lesson_plans SET unit_no=?,session_no=?,unit_name=?,title=?,hours_theory=?,hours_practice=?,content=?,ai_model=COALESCE(?,ai_model),ai_at=IF(? IS NULL,ai_at,NOW()) WHERE id=?', [header.unit_no, header.session_no, header.unit_name, header.title, header.hours_theory, header.hours_practice, JSON.stringify(normalizePlan(body.content)), model, model, id])
  return { plan: out((await db.rows<StaffRecord>('SELECT * FROM lesson_plans WHERE id=?', [id]))[0]!) }
}
export async function remove(db: SqlClient, user: AuthUser, id: number) { await getPlan(db, user, id); await db.execute('DELETE FROM lesson_plans WHERE id=?', [id]); return { ok: true } }
export async function draft(db: SqlClient, user: AuthUser, id: number, body: StaffRecord, signal?: AbortSignal) {
  const data = await getPlan(db, user, id), header = planHeader(body), dash = await classData(db, data.course)
  return body.source === 'ai' ? draftPlan(db, user.id, data.course, dash, header, signal) : { content: prefillPlan(data.course, dash, header), model: null }
}
export async function standard(db: SqlClient, user: AuthUser, id: number, body: StaffRecord, signal?: AbortSignal) {
  const data = await getPlan(db, user, id), header = planHeader(body)
  return findStandard(db, user.id, data.course, { ...header, content: JSON.stringify({ competency: body.competency ?? [] }) }, signal)
}
export async function sheets(db: SqlClient, user: AuthUser, id: number) { await getPlan(db, user, id); return { sheets: (await sheetsOf(db, [id]))[id] ?? [] } }
export async function createSheet(db: SqlClient, user: AuthUser, id: number, body: StaffRecord) {
  const data = await getPlan(db, user, id), type = inputString(body.type); assertSheetType(type)
  const count = (await db.rows<{ n: number }>('SELECT COUNT(*) AS n FROM lesson_sheets s JOIN lesson_plans p ON p.id=s.plan_id WHERE p.course_id=? AND p.unit_no=? AND s.type=?', [data.plan.course_id, data.plan.unit_no, type]))[0]!.n
  const result = await write(db, 'INSERT INTO lesson_sheets (plan_id,type,number,title,content) VALUES (?,?,?,?,?)', [id, type, `${data.plan.unit_no}.${Number(count) + 1}`, data.plan.title !== '' ? data.plan.title : data.plan.unit_name, JSON.stringify(sheetFromPlan(type, data.plan))])
  return { id: result.id }
}
export async function showSheet(db: SqlClient, user: AuthUser, id: number) { const data = await getSheet(db, user, id); return { sheet: outSheet(data.sheet), plan: out(data.plan), course: data.course } }
export async function updateSheet(db: SqlClient, user: AuthUser, id: number, body: StaffRecord) {
  const data = await getSheet(db, user, id), model = bool(body.ai_model) ? inputString(body.ai_model).slice(0, 80) : null
  await db.execute('UPDATE lesson_sheets SET number=?,title=?,content=?,ai_model=COALESCE(?,ai_model) WHERE id=?', [text(body.number, 20), text(body.title, 255), JSON.stringify(normalizeSheet(data.sheet.type, body.content)), model, id])
  return { sheet: outSheet((await db.rows<StaffRecord>('SELECT * FROM lesson_sheets WHERE id=?', [id]))[0]!) }
}
export async function deleteSheet(db: SqlClient, user: AuthUser, id: number) { await getSheet(db, user, id); await db.execute('DELETE FROM lesson_sheets WHERE id=?', [id]); return { ok: true } }
export async function sheetDraft(db: SqlClient, user: AuthUser, id: number, body: StaffRecord, signal?: AbortSignal) {
  const data = await getSheet(db, user, id)
  return body.source === 'ai' ? draftSheet(db, user.id, data.course, data.plan, data.sheet.type, { number: text(body.number, 20), title: text(body.title, 255) }, signal) : { content: sheetFromPlan(data.sheet.type, data.plan), model: null }
}
export async function book(db: SqlClient, user: AuthUser, id: number) {
  const data = await course(db, user, id), stored = (await db.rows<StaffRecord>('SELECT * FROM course_plans WHERE course_id=?', [id]))[0], plans = await db.rows<StaffRecord>('SELECT * FROM lesson_plans WHERE course_id=? ORDER BY unit_no,session_no', [id])
  const content = stored ? normalizeBook(JSON.parse(stored.content)) : bookDefaults(data, plans, data.teacher_name ?? '')
  for (const key of Object.keys(COURSE_CONTENT)) content.curriculum[key] = inputString(data[key])
  return { course: data, book: content, saved: Boolean(stored), updated_at: stored?.updated_at ?? null, institution: await institution(db), plans: await withSheets(db, plans.map(out)), learners: learners(data, await classData(db, data)), level_higher: isHigher(data) }
}
export async function saveBook(db: SqlClient, user: AuthUser, id: number, body: StaffRecord) {
  await course(db, user, id)
  const content = normalizeBook(body.content), model = bool(body.ai_model) ? inputString(body.ai_model).slice(0, 80) : null
  await db.execute('INSERT INTO course_plans (course_id,content,ai_model,updated_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE content=VALUES(content),ai_model=COALESCE(VALUES(ai_model),ai_model),updated_by=VALUES(updated_by)', [id, JSON.stringify(content), model, user.id])
  const columns = Object.keys(COURSE_CONTENT)
  await db.execute('UPDATE courses SET ' + columns.map(key => key + '=?').join(',') + ' WHERE id=?', [...columns.map(key => content.curriculum[key] !== '' ? content.curriculum[key] : null), id])
  return { book: content, saved: true }
}
export async function bookDraft(db: SqlClient, user: AuthUser, id: number, body: StaffRecord, signal?: AbortSignal) {
  const data = await course(db, user, id)
  return draftBook(db, user.id, data, await classData(db, data), normalizeBook(body.content), signal)
}
export async function full(db: SqlClient, user: AuthUser, id: number) {
  const data = await course(db, user, id), plans = await db.rows<StaffRecord>('SELECT * FROM lesson_plans WHERE course_id=? ORDER BY unit_no,session_no', [id])
  return { course: data, plans: await withSheets(db, plans.map(out)), learners: learners(data, await classData(db, data)), level_higher: isHigher(data) }
}
