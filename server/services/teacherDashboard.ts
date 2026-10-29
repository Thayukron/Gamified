import { createHash, randomInt } from 'node:crypto'
import type { AuthUser } from '../../shared/types/auth'
import type { Course, DashboardStudent, StaffRecord } from '../../shared/types/staff'
import type { SqlClient } from '../utils/db'
import { ApiError } from '../utils/errors'
import { course } from '../utils/ownership'
import { bool } from '../utils/staff'
import { phpInt } from './scenarioEngine'
import { coreProfiles, totalUniversal } from './profiles'
import { buildGroups, fromIds } from './grouping'
import { teachingGuide } from './teachingGuide'
import { institution } from './admin'
import { bangkokNow } from './studentGame'

export async function classData(db: SqlClient, data: Course): Promise<StaffRecord> {
  const roster = await db.rows<StaffRecord>("SELECT u.id,u.student_code,u.full_name,(SELECT COUNT(*) FROM game_sessions gs WHERE gs.user_id=u.id AND gs.status='in_progress') AS in_progress FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.course_id=? AND u.is_active=1 ORDER BY u.student_code,u.full_name", [data.id])
  const profiles: StaffRecord = await coreProfiles(db, roster.map(row => row.id))
  const students: DashboardStudent[] = [], distribution: StaffRecord = { vark: { V: 0, A: 0, R: 0, K: 0, multi: 0 }, riasec: { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }, mindset: { growth: 0, mixed: 0, fixed: 0 }, archetype: [] }
  const archetypes = new Map<string, StaffRecord>(), riasec: Record<string, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }, vark: Record<string, number> = { V: 0, A: 0, R: 0, K: 0 }, counts: Record<string, number> = {}
  for (const row of roster) {
    const p = profiles[row.id] ?? null, status = p ? p.quests_completed >= p.quests_total ? 'complete' : 'partial' : Number(row.in_progress) > 0 ? 'playing' : 'not_started'
    students.push({ id: row.id, student_code: row.student_code, full_name: row.full_name, status, profile: p }); counts[status] = (counts[status] ?? 0) + 1
    if (!p) continue
    distribution.vark[p.dominant_vark?.length === 1 ? p.dominant_vark : 'multi']++
    distribution.riasec[p.dominant_riasec[0]]++; distribution.mindset[p.mindset_type]++
    if (!archetypes.has(p.archetype_code)) archetypes.set(p.archetype_code, { code: p.archetype_code, name: p.archetype_name, title: p.archetype_title, color: p.color, icon: p.icon, count: 0 })
    archetypes.get(p.archetype_code)!.count++
    const rTotal = Object.keys(riasec).reduce((sum, key) => sum + p['riasec_' + key.toLowerCase()], 0) || 1, vTotal = Object.keys(vark).reduce((sum, key) => sum + p['vark_' + key.toLowerCase()], 0) || 1
    for (const key of Object.keys(riasec)) riasec[key] = riasec[key]! + p['riasec_' + key.toLowerCase()] / rTotal
    for (const key of Object.keys(vark)) vark[key] = vark[key]! + p['vark_' + key.toLowerCase()] / vTotal
  }
  const profiled = Object.keys(profiles).length
  distribution.archetype = [...archetypes.values()].sort((a, b) => b.count - a.count)
  const average = (values: Record<string, number>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, profiled ? Math.round(value / profiled * 1000) / 10 : 0]))
  return { course: data, term: { semester: data.semester, academic_year: data.academic_year }, summary: { enrolled: students.length, profiled, complete: counts.complete ?? 0, partial: counts.partial ?? 0, playing: counts.playing ?? 0, not_started: counts.not_started ?? 0, quests_total: await totalUniversal(db) }, distribution, average: { riasec: average(riasec), vark: average(vark) }, students }
}
export async function dashboard(db: SqlClient, user: AuthUser, id: number) { return classData(db, await course(db, user, id)) }
export async function guide(db: SqlClient, user: AuthUser, id: number) {
  const data = await course(db, user, id), dash = await classData(db, data)
  return { course: data, term: dash.term, guide: teachingGuide(data, dash) }
}

// Read-only cache compatibility for reports; Gemini generation/key settings remain phase 5.
export function aiContext(data: Course, dash: StaffRecord) {
  const round = (values: StaffRecord) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Math.round(value)]))
  return { course: { name: data.name, code: data.code, department: data.department_name, level: data.level, type: ({ theory: 'ทฤษฎี', practice: 'ปฏิบัติ', mixed: 'ทฤษฎี+ปฏิบัติ' } as StaffRecord)[data.course_type] ?? 'ทฤษฎี+ปฏิบัติ', topics: JSON.parse(data.topics ?? '[]') || [], note: data.context_note }, class: { students_profiled: dash.summary.profiled, vark_percent: round(dash.average.vark), riasec_percent: round(dash.average.riasec), mindset_percent: Object.fromEntries(Object.entries(dash.distribution.mindset).map(([key, value]) => [key, Math.round(Number(value) / Math.max(1, dash.summary.profiled) * 100)])) } }
}
export const phpJson = (value: unknown) => JSON.stringify(value).replace(/\//g, '\\/').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
export async function cachedInsight(db: SqlClient, data: Course, dash: StaffRecord, type: string, topic: string | null) {
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')
  const row = (await db.rows<StaffRecord>('SELECT * FROM ai_insights_cache WHERE cache_key=?', [hash(`${data.id}|${type}|${topic ?? ''}`)]))[0]
  return row ? { type: row.insight_type, topic: row.topic, data: JSON.parse(row.response), model: row.model, key_source: row.key_source, tokens: { prompt: row.prompt_tokens, output: row.output_tokens }, created_at: row.created_at, stale: row.fingerprint !== hash(phpJson([aiContext(data, dash), topic])) } : null
}
export async function groupsPreview(db: SqlClient, user: AuthUser, id: number, body: StaffRecord) {
  const dash = await dashboard(db, user, id), mode = body.mode === 'similar' ? 'similar' : 'mixed'
  return { ...buildGroups(dash.students, phpInt(body.size ?? 4), mode, bool(body.seed) ? phpInt(body.seed) : randomInt(1, 1000000), bool(body.include_unprofiled ?? true)), saved_at: null }
}
export async function groupsSaved(db: SqlClient, user: AuthUser, id: number) {
  const data = await course(db, user, id), row = (await db.rows<StaffRecord>('SELECT * FROM course_groupings WHERE course_id=?', [id]))[0]
  if (!row) return { saved: null }
  const dash = await classData(db, data)
  return { saved: { ...fromIds(dash.students, JSON.parse(row.member_ids) || [], row.mode), settings: { size: Number(row.group_size), mode: row.mode }, saved_at: row.saved_at } }
}
export async function groupsSave(db: SqlClient, user: AuthUser, id: number, body: StaffRecord) {
  const dash = await dashboard(db, user, id), mode = body.mode === 'similar' ? 'similar' : 'mixed', result = fromIds(dash.students, body.groups ?? [], mode), size = phpInt(body.size ?? 4)
  if (bool(body.dry_run)) return { saved: { ...result, settings: { size, mode }, saved_at: null } }
  if (!result.groups.length) throw new ApiError(422, 'ยังไม่มีกลุ่มให้บันทึก')
  await db.execute('INSERT INTO course_groupings (course_id,mode,group_size,member_ids,saved_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE mode=VALUES(mode),group_size=VALUES(group_size),member_ids=VALUES(member_ids),saved_by=VALUES(saved_by),saved_at=NOW()', [id, mode, Math.max(2, Math.min(8, size)), JSON.stringify(result.groups.map(group => group.members.map(m => m.id))), user.id])
  return groupsSaved(db, user, id)
}
export async function report(db: SqlClient, user: AuthUser, id: number) {
  const data = await course(db, user, id), dash = await classData(db, data), aiUnits: StaffRecord = {}
  for (const topic of JSON.parse(data.topics ?? '[]') || []) { const insight = await cachedInsight(db, data, dash, 'unit', topic); if (insight) aiUnits[topic] = insight }
  const row = (await db.rows<StaffRecord>('SELECT * FROM course_groupings WHERE course_id=?', [id]))[0]
  return { institution: await institution(db), generated_at: bangkokNow(), guide: teachingGuide(data, dash), ai_course: await cachedInsight(db, data, dash, 'course', null), ai_units: aiUnits, grouping: row ? { ...fromIds(dash.students, JSON.parse(row.member_ids) || [], row.mode), mode: row.mode, saved_at: row.saved_at } : null, ...dash }
}
