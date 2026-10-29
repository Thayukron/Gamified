import type { AuthUser } from '../../shared/types/auth'
import type { Course, StaffRecord } from '../../shared/types/staff'
import type { SqlClient, SqlValue } from '../utils/db'
import { ApiError, inputString } from '../utils/errors'
import { course } from '../utils/ownership'
import { currentTerm } from '../utils/settings'
import { array, bool, ids, marks, optionalText, text, write } from '../utils/staff'
import { phpInt } from './scenarioEngine'
import { resetToDefault } from './password'
import { validateTerm } from './admin'
import { rosterCommit, rosterPreview } from './rosterImport'

export const COURSE_CONTENT: Record<string, number> = { theory_hours: 10, practice_hours: 10, credits: 10, standards_ref: 2000, outcome: 2000, objectives: 4000, competencies: 4000, description: 6000 }
async function fields(db: SqlClient, body: StaffRecord) {
  const term = await currentTerm(db)
  const data: StaffRecord = {
    code: text(body.code, 30), name: text(body.name, 200), section: bool(text(body.section, 20)) ? text(body.section, 20) : '1',
    department_id: bool(body.department_id) ? phpInt(body.department_id) : null,
    course_type: inputString(body.course_type ?? 'mixed'), level: optionalText(body.level, 30),
    topics: array(body.topics).map(value => text(value, 100)).filter(bool).slice(0, 30),
    semester: phpInt(bool(body.semester) ? body.semester : term.semester), academic_year: phpInt(bool(body.academic_year) ? body.academic_year : term.academic_year),
  }
  validateTerm(data.semester, data.academic_year)
  for (const [key, max] of Object.entries(COURSE_CONTENT)) data[key] = optionalText(inputString(body[key]).replace(/\r/g, ''), max)
  if (!data.code || !data.name) throw new ApiError(422, 'กรุณากรอกรหัสวิชาและชื่อวิชา')
  if (!['theory', 'practice', 'mixed'].includes(data.course_type)) throw new ApiError(422, 'ประเภทวิชาไม่ถูกต้อง')
  return data
}
async function assertUnique(db: SqlClient, data: StaffRecord, exceptId = 0) {
  const other = (await db.rows<StaffRecord>('SELECT c.id,u.full_name FROM courses c LEFT JOIN users u ON u.id=c.teacher_id WHERE c.code=? AND c.section=? AND c.semester=? AND c.academic_year=? AND c.id<>?', [data.code, data.section, data.semester, data.academic_year, exceptId]))[0]
  if (other) throw new ApiError(409, `รายวิชา ${data.code} กลุ่ม ${data.section} มีอยู่แล้วในภาคเรียนนี้ (ครูผู้สอน: ${other.full_name ?? '-'}) — ใช้ชื่อกลุ่มอื่น หรือติดต่อผู้ดูแลระบบ`)
}
async function enrollGroups(db: SqlClient, courseId: number, groups: unknown) {
  const values = array(groups).map(value => text(value)).filter(bool)
  return values.length ? (await write(db, `INSERT IGNORE INTO enrollments (course_id,student_id) SELECT ?,id FROM users WHERE role='student' AND is_active=1 AND class_group IN (${marks(values)})`, [courseId, ...values])).affected : 0
}
export async function courses(db: SqlClient, user: AuthUser) {
  const term = await currentTerm(db)
  const rows = await db.rows<StaffRecord>(`SELECT c.id,c.code,c.name,c.section,c.semester,c.academic_year,d.name AS department_name,
    COUNT(DISTINCT e.student_id) AS enrolled,COUNT(DISTINCT r.user_id) AS profiled,
    (SELECT COUNT(DISTINCT pr.user_id) FROM password_reset_requests pr JOIN enrollments e2 ON e2.student_id=pr.user_id WHERE e2.course_id=c.id AND pr.status='pending') AS reset_requests
    FROM courses c LEFT JOIN departments d ON d.id=c.department_id LEFT JOIN (enrollments e JOIN users su ON su.id=e.student_id AND su.is_active=1) ON e.course_id=c.id
    LEFT JOIN assessment_results r ON r.user_id=e.student_id WHERE ${user.role === 'admin' ? '1=1' : 'c.teacher_id=?'}
    GROUP BY c.id ORDER BY c.academic_year DESC,c.semester DESC,c.code,c.section`, user.role === 'admin' ? [] : [user.id])
  return { courses: rows, term }
}
export async function meta(db: SqlClient, user: AuthUser) {
  const own = (await db.rows<{ department_id: number | null }>('SELECT department_id FROM users WHERE id=?', [user.id]))[0]
  return {
    term: await currentTerm(db), my_department_id: own?.department_id || null,
    departments: await db.rows<StaffRecord>('SELECT id,code,name FROM departments ORDER BY code'),
    class_groups: await db.rows<StaffRecord>("SELECT u.class_group AS name,COUNT(*) AS students,MIN(d.name) AS department_name FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.role='student' AND u.is_active=1 AND u.class_group IS NOT NULL AND u.class_group<>'' GROUP BY u.class_group ORDER BY u.class_group"),
  }
}
export async function create(db: SqlClient, user: AuthUser, body: StaffRecord) {
  const data = await fields(db, body); await assertUnique(db, data)
  const columns = ['code', 'name', 'section', 'semester', 'academic_year', 'department_id', 'teacher_id', 'course_type', 'level', 'topics', ...Object.keys(COURSE_CONTENT)]
  data.teacher_id = user.id; data.topics = JSON.stringify(data.topics)
  const result = await write(db, `INSERT INTO courses (${columns.join(',')}) VALUES (${marks(columns)})`, columns.map(key => data[key]))
  return { id: result.id, added: await enrollGroups(db, result.id, body.class_groups) }
}
export async function update(db: SqlClient, user: AuthUser, id: number, body: StaffRecord) {
  await course(db, user, id)
  const data = await fields(db, body); await assertUnique(db, data, id)
  data.topics = JSON.stringify(data.topics)
  const columns = ['code', 'name', 'section', 'semester', 'academic_year', 'department_id', 'course_type', 'level', 'topics', ...Object.keys(COURSE_CONTENT)]
  await db.execute(`UPDATE courses SET ${columns.map(key => key + '=?').join(',')} WHERE id=?`, [...columns.map(key => data[key]), id]); return { ok: true }
}
export async function removeCourse(db: SqlClient, user: AuthUser, id: number) {
  await course(db, user, id); await db.execute('DELETE FROM courses WHERE id=?', [id]); return { ok: true }
}
export async function roster(db: SqlClient, user: AuthUser, id: number) {
  const data = await course(db, user, id)
  const rows = await db.rows<StaffRecord>("SELECT u.id,u.student_code,u.full_name,u.class_group,d.name AS department_name,u.must_change_password,EXISTS(SELECT 1 FROM password_reset_requests r WHERE r.user_id=u.id AND r.status='pending') AS reset_requested FROM enrollments e JOIN users u ON u.id=e.student_id LEFT JOIN departments d ON d.id=u.department_id WHERE e.course_id=? AND u.is_active=1 ORDER BY reset_requested DESC,u.class_group,u.student_code", [id])
  return { course: data, students: rows.map(row => ({ ...row, reset_requested: bool(row.reset_requested), must_change_password: bool(row.must_change_password) })) }
}
export async function search(db: SqlClient, query: StaffRecord) {
  const q = text(query.q), group = text(query.group)
  if (!q && !group) return { students: [] }
  let sql = "SELECT u.id,u.student_code,u.full_name,u.class_group,d.name AS department_name,EXISTS(SELECT 1 FROM enrollments e WHERE e.student_id=u.id AND e.course_id=?) AS enrolled FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.role='student' AND u.is_active=1"
  const values: SqlValue[] = [phpInt(query.course)]
  if (q) { sql += ' AND (u.student_code LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)'; values.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (group) { sql += ' AND u.class_group=?'; values.push(group) }
  return { students: (await db.rows<StaffRecord>(sql + ' ORDER BY u.class_group,u.student_code LIMIT 200', values)).map(row => ({ ...row, enrolled: bool(row.enrolled) })) }
}
export async function add(db: SqlClient, user: AuthUser, id: number, body: StaffRecord) {
  await course(db, user, id)
  let added = await enrollGroups(db, id, body.class_groups)
  const selected = ids(body.student_ids), codes = [...new Set(inputString(body.codes).split(/[\s,;]+/u).filter(bool))], found = new Set<string>()
  if (codes.length) for (const row of await db.rows<StaffRecord>(`SELECT id,username,student_code FROM users WHERE role='student' AND (student_code IN (${marks(codes)}) OR username IN (${marks(codes)}))`, [...codes, ...codes])) {
    selected.push(row.id); found.add(row.username); found.add(row.student_code ?? '')
  }
  if (selected.length) added += (await write(db, `INSERT IGNORE INTO enrollments (course_id,student_id) SELECT ?,id FROM users WHERE role='student' AND id IN (${marks(selected)})`, [id, ...selected])).affected
  return { added, not_found: codes.filter(code => !found.has(code)) }
}
export async function removeMany(db: SqlClient, user: AuthUser, id: number, body: StaffRecord) {
  await course(db, user, id)
  const group = text(body.class_group), selected = ids(body.student_ids)
  let removed = 0
  if (group) removed += (await write(db, 'DELETE e FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.course_id=? AND u.class_group=?', [id, group])).affected
  if (selected.length) removed += (await write(db, `DELETE FROM enrollments WHERE course_id=? AND student_id IN (${marks(selected)})`, [id, ...selected])).affected
  return { removed }
}
export async function remove(db: SqlClient, user: AuthUser, id: number, sid: number) {
  await course(db, user, id); await db.execute('DELETE FROM enrollments WHERE course_id=? AND student_id=?', [id, sid]); return { ok: true }
}
export async function resetStudent(db: SqlClient, user: AuthUser, id: number, sid: number) {
  await course(db, user, id)
  if (!(await db.rows<{ id: number }>("SELECT u.id FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.course_id=? AND u.id=? AND u.role='student'", [id, sid]))[0]) throw new ApiError(404, 'ไม่พบผู้เรียนนี้ในรายวิชา')
  const code = await resetToDefault(db, sid, user.id)
  return { ok: true, message: `รีเซ็ตแล้ว — รหัสผ่านชั่วคราว = ${code} (ผู้เรียนต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบ)` }
}
export async function importRoster(db: SqlClient, user: AuthUser, id: number, body: StaffRecord, commit: boolean) {
  const data = await course(db, user, id)
  return commit ? rosterCommit(db, data, body.rows) : rosterPreview(db, data, body.rows)
}
export async function saveContext(db: SqlClient, user: AuthUser, id: number, body: StaffRecord) {
  await course(db, user, id)
  if (!['theory', 'practice', 'mixed'].includes(body.course_type)) throw new ApiError(422, 'ประเภทวิชาไม่ถูกต้อง')
  await db.execute('UPDATE courses SET course_type=?,level=?,topics=?,context_note=? WHERE id=?', [body.course_type, optionalText(body.level, 30), JSON.stringify(array(body.topics).map(value => text(value, 100)).filter(bool).slice(0, 30)), optionalText(body.context_note, 1000), id])
  return { ok: true }
}
