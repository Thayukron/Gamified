import { createHash } from 'node:crypto'
import type { Course, StaffRecord } from '../../shared/types/staff'
import type { SqlClient } from '../utils/db'
import { ApiError, inputString } from '../utils/errors'
import { array, bool, record, text } from '../utils/staff'
import { phpInt } from './scenarioEngine'
import { aiContext, cachedInsight, classData, phpJson } from './teacherDashboard'
import { aiClient, aiEnabled, aiStatus, enabledKey, resolveAI } from './aiSettings'
import { BOOK_EMPTY, PLAN_EMPTY, SYSTEMS, documentText, normalizeBook, normalizePlan, normalizeSheet, sheetShared } from './documentModels'
import { bookPrompt, guidePrompt, planPrompt, sheetPrompt, standardPrompt, suggestPrompt } from './documentPrompts'
import { normalizeGuideCourse, normalizeGuideUnit } from './aiModels'
export async function generateGuide(db: SqlClient, userId: number, course: Course, dash: StaffRecord, type: string, topic: string | null, signal?: AbortSignal) {
  if (!await aiEnabled(db)) throw new ApiError(403, 'ผู้ดูแลระบบปิดการใช้งานฟังก์ชัน AI อยู่')
  if (!['course', 'unit'].includes(type)) throw new ApiError(422, 'ประเภทคำขอไม่ถูกต้อง')
  if (dash.summary.profiled === 0) throw new ApiError(409, 'ยังไม่มีผู้เรียนเล่นเกม จึงยังวิเคราะห์ไม่ได้')
  const ctx = aiContext(course, dash)
  if (type === 'unit' && !ctx.course.topics.includes(topic)) throw new ApiError(422, 'ไม่พบหัวข้อนี้ในรายวิชา')
  const resolved = await resolveAI(db, userId)
  if (!resolved.key) throw new ApiError(409, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อนใช้ฟังก์ชันนี้')
  const response = await aiClient(resolved.key, db, signal).generateResilient(resolved.model, SYSTEMS.guide, guidePrompt(type, ctx, topic))
  if (signal?.aborted) throw new ApiError(504, 'งาน AI ถูกหยุด กรุณาลองใหม่')
  const data = type === 'course' ? normalizeGuideCourse(response.data) : normalizeGuideUnit(response.data), hash = (value: string) => createHash('sha256').update(value).digest('hex')
  await db.execute("INSERT INTO ai_insights_cache (course_id,cache_key,fingerprint,insight_type,topic,prompt,response,provider,model,key_source,prompt_tokens,output_tokens,created_by) VALUES (?,?,?,?,?,?,?,'gemini',?,?,?,?,?) ON DUPLICATE KEY UPDATE fingerprint=VALUES(fingerprint),prompt=VALUES(prompt),response=VALUES(response),model=VALUES(model),key_source=VALUES(key_source),prompt_tokens=VALUES(prompt_tokens),output_tokens=VALUES(output_tokens),created_by=VALUES(created_by),created_at=NOW()", [course.id, hash(`${course.id}|${type}|${topic ?? ''}`), hash(phpJson([ctx, topic])), type, topic, guidePrompt(type, ctx, topic), JSON.stringify(data), response.model, resolved.source, response.prompt_tokens, response.output_tokens, userId])
  return cachedInsight(db, course, dash, type, topic)
}
export async function allCached(db: SqlClient, userId: number, course: Course, dash: StaffRecord) {
  const units: StaffRecord = {}
  for (const topic of JSON.parse(course.topics ?? '[]') || []) { const result = await cachedInsight(db, course, dash, 'unit', topic); if (result) units[topic] = result }
  return { course: await cachedInsight(db, course, dash, 'course', null), units, ai: await aiStatus(db, userId) }
}
export async function draftPlan(db: SqlClient, userId: number, course: Course, dash: StaffRecord, plan: StaffRecord, signal?: AbortSignal) {
  const resolved = await enabledKey(db, userId, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อน หรือใช้ปุ่ม “เติมจากไกด์ (ไม่ใช้ AI)”')
  const response = await aiClient(resolved.key, db, signal).generateResilient(resolved.model, SYSTEMS.plan, planPrompt(course, aiContext(course, dash), plan), 2, 24000)
  const content = normalizePlan(response.data); content.after = structuredClone(PLAN_EMPTY.after)
  return { content, model: response.model }
}
export async function draftSheet(db: SqlClient, userId: number, course: Course, plan: StaffRecord, type: string, sheet: StaffRecord, signal?: AbortSignal) {
  const resolved = await enabledKey(db, userId, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อน หรือใช้ปุ่ม “เติมจากแผน (ไม่ใช้ AI)”')
  const response = await aiClient(resolved.key, db, signal).generateResilient(resolved.model, SYSTEMS.sheet, sheetPrompt(course, plan, type, sheet), 2, 24000)
  const content = normalizeSheet(type, response.data)
  for (const [key, value] of Object.entries(sheetShared(normalizePlan(JSON.parse(plan.content))))) if (Object.hasOwn(content, key) && content[key] === '') content[key] = value
  return { content, model: response.model }
}
export async function draftBook(db: SqlClient, userId: number, course: Course, dash: StaffRecord, content: StaffRecord, signal?: AbortSignal) {
  const resolved = await enabledKey(db, userId)
  if (content.curriculum.description === '' && !content.units.length) throw new ApiError(422, 'กรุณากรอกคำอธิบายรายวิชา (หรือหน่วยการเรียนรู้) ก่อน เพื่อให้ AI วิเคราะห์จากหลักสูตรจริง')
  const response = await aiClient(resolved.key, db, signal).generateResilient(resolved.model, SYSTEMS.book, bookPrompt(course, aiContext(course, dash), content), 2, 24000), d = response.data
  const draft = normalizeBook({ job_analysis: { job: d.job ?? '', rows: d.job_rows ?? [] }, units: d.units ?? [], final_eval: d.final_eval ?? [], preface: d.preface ?? '' })
  return { parts: { job_analysis: draft.job_analysis, units: draft.units, final_eval: draft.final_eval, preface: draft.preface }, model: response.model }
}
export async function suggestUnits(db: SqlClient, userId: number, body: StaffRecord, signal?: AbortSignal) {
  if (!await aiEnabled(db)) throw new ApiError(403, 'ผู้ดูแลระบบปิดการใช้งานฟังก์ชัน AI อยู่')
  const c = Object.fromEntries(['code', 'name', 'level', 'course_type', 'theory_hours', 'practice_hours', 'description', 'objectives', 'competencies'].map(key => [key, text(body[key], 6000)]))
  if (!text(c.description) && !text(c.objectives)) throw new ApiError(422, 'กรุณากรอกคำอธิบายรายวิชา (แท็บ “เนื้อหารายวิชา”) ก่อน ให้ AI แบ่งหน่วยจากหลักสูตรจริง')
  const resolved = await resolveAI(db, userId)
  if (!resolved.key) throw new ApiError(409, 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อน หรือใช้ปุ่ม “แยกจากคำอธิบาย (ไม่ใช้ AI)”')
  const prompt = suggestPrompt(c), response = await aiClient(resolved.key, db, signal).generateResilient(resolved.model, prompt.system, prompt.prompt, 2, 16000)
  const units = array(response.data.units).slice(0, 15).map(value => { const row = record(value); return { name: text(documentText(row.name, 100).replace(/^หน่วยที่\s*\d+\s*[:.]?\s*/u, '')), covers: documentText(row.covers, 400), hours_theory: Math.max(0, parseFloat(row.hours_theory) || 0), hours_practice: Math.max(0, parseFloat(row.hours_practice) || 0) } }).filter(unit => unit.name !== '')
  if (!units.length) throw new ApiError(502, 'AI ไม่ได้ส่งรายการหน่วยกลับมา ลองใหม่อีกครั้ง')
  return { units, model: response.model }
}
export async function findStandard(db: SqlClient, userId: number, course: Course, plan: StaffRecord, signal?: AbortSignal) {
  const resolved = await enabledKey(db, userId), client = aiClient(resolved.key, db, signal), prompt = standardPrompt(course, plan)
  let grounded = true, response
  try { response = await client.generateResilient(resolved.model, prompt.system, prompt.prompt, 2, 8192, true) }
  catch (error) {
    if (!(error instanceof ApiError) || ![429, 422, 403].includes(error.status)) throw error
    grounded = false
    const fallback = prompt.prompt.replace('- ใช้เฉพาะข้อมูลที่พบจากผลการค้นหา ห้ามแต่งชื่อ รหัส หรือเนื้อหามาตรฐานขึ้นเอง', '- (ค้นหาเว็บไม่ได้ในครั้งนี้) ตอบจากความรู้ที่มั่นใจว่าถูกต้องเท่านั้น ห้ามแต่งชื่อหรือเนื้อหามาตรฐาน · ถ้าไม่แน่ใจรหัสหน่วยสมรรถนะให้ใส่เฉพาะชื่อ ไม่ต้องใส่รหัส · ไม่แน่ใจว่ามีมาตรฐานนี้จริงให้ found = false')
    response = await client.generateResilient(resolved.model, prompt.system, fallback, 2, 8192)
  }
  const d = response.data, found = bool(d.found) && text(d.occupation) !== ''
  return { found, standard: Object.fromEntries(Object.keys(PLAN_EMPTY.standard).map(key => [key, found ? documentText(d[key], 10000, true) : ''])), note: text(d.note, 500), sources: response.sources.slice(0, 6), grounded, model: response.model }
}
