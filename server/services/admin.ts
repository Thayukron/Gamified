import type { AuthUser } from '../../shared/types/auth'
import type { StaffRecord } from '../../shared/types/staff'
import type { SqlClient, SqlValue } from '../utils/db'
import { ApiError, charLength, inputString } from '../utils/errors'
import { currentTerm } from '../utils/settings'
import { bool, clean, ids, marks, optionalText, text, write } from '../utils/staff'
import { phpInt } from './scenarioEngine'
import { assertStrong, hashPassword, resetToDefault } from './password'

export const STATUS_TH: Record<string, string> = { studying: 'กำลังศึกษา', graduated: 'สำเร็จการศึกษา', dropped: 'ออกกลางคัน', inactive: 'ปิดบัญชี' }

export async function institution(db: SqlClient) {
  const rows = await db.rows<{ setting_key: string; setting_value: string }>("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'institution_%'")
  const values = Object.fromEntries(rows.map(row => [row.setting_key, row.setting_value]))
  return { name: values.institution_name ?? '', affiliation: values.institution_affiliation ?? '' }
}
export async function saveInstitution(db: SqlClient, body: StaffRecord) {
  if (!text(body.name)) throw new ApiError(422, 'กรุณากรอกชื่อสถานศึกษา')
  await set(db, 'institution_name', text(body.name, 150)); await set(db, 'institution_affiliation', text(body.affiliation, 200))
  return institution(db)
}
async function set(db: SqlClient, key: string, value: string) {
  await db.execute('INSERT INTO settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [key, value])
}
export function validateTerm(semester: number, year: number) {
  if (semester < 1 || semester > 3) throw new ApiError(422, 'ภาคเรียนต้องเป็น 1, 2 หรือ 3 (ภาคฤดูร้อน)')
  if (year < 2500 || year > 2700) throw new ApiError(422, 'ปีการศึกษาต้องเป็นปี พ.ศ. เช่น 2569')
}
export async function saveTerm(db: SqlClient, body: StaffRecord) {
  const semester = phpInt(body.semester), year = phpInt(body.academic_year)
  validateTerm(semester, year)
  await set(db, 'term_semester', String(semester)); await set(db, 'term_academic_year', String(year))
  return currentTerm(db)
}
export async function overview(db: SqlClient) {
  const counts = Object.fromEntries((await db.rows<{ role: string; n: number }>('SELECT role, COUNT(*) n FROM users WHERE is_active = 1 GROUP BY role')).map(row => [row.role, Number(row.n)]))
  const departments = await db.rows<StaffRecord>("SELECT d.id,d.code,d.name,(SELECT COUNT(*) FROM users u WHERE u.department_id=d.id AND u.role='student') AS students,(SELECT COUNT(*) FROM users u WHERE u.department_id=d.id AND u.role='teacher') AS teachers,(SELECT COUNT(*) FROM courses c WHERE c.department_id=d.id) AS courses FROM departments d ORDER BY d.code")
  const courses = await db.rows<StaffRecord>('SELECT c.id,c.code,c.name,c.section,c.semester,c.academic_year,d.name AS department_name,u.full_name AS teacher_name,u.username AS teacher_username,(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) AS enrolled FROM courses c LEFT JOIN departments d ON d.id=c.department_id LEFT JOIN users u ON u.id=c.teacher_id ORDER BY c.academic_year DESC,c.semester DESC,c.code,c.section')
  return { counts: { students: counts.student ?? 0, teachers: counts.teacher ?? 0, departments: departments.length, courses: courses.length }, departments, courses }
}
export async function users(db: SqlClient, query: StaffRecord) {
  const q = `%${text(query.q)}%`, values: SqlValue[] = [q, q]
  let sql = "SELECT u.id,u.username,u.full_name,u.role,u.student_code,u.class_group,u.is_active,u.department_id,u.must_change_password,d.name AS department_name,EXISTS(SELECT 1 FROM password_reset_requests r WHERE r.user_id=u.id AND r.status='pending') AS reset_requested FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE (u.username LIKE ? OR u.full_name LIKE ?)"
  if (['student', 'teacher', 'admin'].includes(inputString(query.role))) { sql += ' AND u.role=?'; values.push(inputString(query.role)) }
  return { users: (await db.rows<StaffRecord>(sql + ' ORDER BY reset_requested DESC,u.role,u.username LIMIT 100', values)).map(row => ({ ...row, is_active: bool(row.is_active), must_change_password: bool(row.must_change_password), reset_requested: bool(row.reset_requested) })) }
}
async function user(db: SqlClient, id: number) {
  const row = (await db.rows<StaffRecord>('SELECT * FROM users WHERE id=?', [id]))[0]
  if (!row) throw new ApiError(404, 'ไม่พบผู้ใช้')
  return row
}
export async function createUser(db: SqlClient, body: StaffRecord) {
  const role = inputString(body.role), username = text(body.username), name = clean(body.full_name), password = inputString(body.password)
  if (!['student', 'teacher', 'admin'].includes(role)) throw new ApiError(422, 'กรุณาเลือกบทบาท')
  const label = role === 'student' ? 'รหัสนักศึกษา' : 'ชื่อผู้ใช้'
  if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) throw new ApiError(422, `${label} ต้องเป็นตัวอักษรอังกฤษ ตัวเลข หรือ . _ - ยาว 3–50 ตัว (ไม่มีช่องว่าง)`)
  if (!name || charLength(name) > 150) throw new ApiError(422, 'กรุณากรอกชื่อ-สกุล')
  if (password !== '') assertStrong(password, username)
  if ((await db.rows<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE username=? OR student_code=?', [username, username]))[0]!.n) throw new ApiError(409, `${label} ${username} มีในระบบแล้ว`)
  const result = await write(db, 'INSERT INTO users (username,password_hash,full_name,role,department_id,student_code,class_group,student_status,must_change_password) VALUES (?,?,?,?,?,?,?,?,?)', [username, await hashPassword(password || username), name, role, bool(body.department_id) ? phpInt(body.department_id) : null, role === 'student' ? username : null, role === 'student' ? optionalText(body.class_group, 30) : null, role === 'student' ? 'studying' : null, password === '' ? 1 : 0])
  return { id: result.id, message: `เพิ่มผู้ใช้ ${name} (${username}) แล้ว` + (password === '' ? ` · รหัสผ่านเริ่มต้น = ${username} (ต้องตั้งใหม่เมื่อเข้าสู่ระบบครั้งแรก)` : '') }
}
export async function updateUser(db: SqlClient, actor: AuthUser, id: number, body: StaffRecord) {
  const row = await user(db, id), username = text(body.username ?? row.username), name = clean(body.full_name), active = bool(body.is_active ?? true)
  if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) throw new ApiError(422, 'ชื่อผู้ใช้/รหัสนักศึกษา ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 3–50 ตัว')
  if (!name || charLength(name) > 150) throw new ApiError(422, 'กรุณากรอกชื่อ-สกุล')
  if (id === actor.id && !active) throw new ApiError(422, 'ปิดการใช้งานบัญชีของตัวเองไม่ได้')
  if ((await db.rows<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE username=? AND id<>?', [username, id]))[0]!.n) throw new ApiError(409, `ชื่อผู้ใช้ ${username} ถูกใช้แล้ว`)
  await db.execute('UPDATE users SET username=?,full_name=?,department_id=?,class_group=?,student_code=?,is_active=? WHERE id=?', [username, name, bool(body.department_id) ? phpInt(body.department_id) : null, row.role === 'student' ? optionalText(body.class_group, 30) : null, row.role === 'student' ? username : row.student_code, Number(active), id])
  if (!active) await db.execute('DELETE FROM auth_tokens WHERE user_id=?', [id])
  if (row.role === 'student') await db.execute("UPDATE users SET student_status=IF(?=1,'studying',IF(COALESCE(student_status,'studying')='studying','inactive',student_status)) WHERE id=?", [Number(active), id])
  return { ok: true }
}
export async function resetPassword(db: SqlClient, actor: AuthUser, id: number) {
  const row = await user(db, id)
  if (row.role === 'admin') throw new ApiError(403, 'รีเซ็ตรหัสผ่านผู้ดูแลระบบจากหน้านี้ไม่ได้ (ผู้ดูแลเปลี่ยนเองที่หน้าบัญชีของฉัน)')
  const username = await resetToDefault(db, id, actor.id)
  return { ok: true, message: `รีเซ็ตแล้ว — รหัสผ่านชั่วคราว = ${username} (ผู้ใช้ต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบ)` }
}
export async function resetRequests(db: SqlClient) {
  return { requests: await db.rows<StaffRecord>("SELECT r.id,r.note,r.created_at,u.id AS user_id,u.username,u.full_name,u.role,u.class_group FROM password_reset_requests r JOIN users u ON u.id=r.user_id WHERE r.status='pending' ORDER BY r.created_at") }
}
export async function dismissRequest(db: SqlClient, actor: AuthUser, id: number) {
  await db.execute("UPDATE password_reset_requests SET status='dismissed',handled_by=?,handled_at=NOW() WHERE id=? AND status='pending'", [actor.id, id]); return { ok: true }
}
export async function deleteCourse(db: SqlClient, id: number) {
  if (!(await write(db, 'DELETE FROM courses WHERE id=?', [id])).affected) throw new ApiError(404, 'ไม่พบรายวิชา')
  return { ok: true }
}
export async function classGroups(db: SqlClient) {
  const groups = await db.rows<StaffRecord>("SELECT u.class_group AS name,MIN(d.name) AS department_name,SUM(COALESCE(u.student_status,'studying')='studying') AS studying,SUM(u.student_status='graduated') AS graduated,SUM(u.student_status='dropped') AS dropped,SUM(u.student_status='inactive') AS inactive,COUNT(*) AS total FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.role='student' AND u.class_group IS NOT NULL AND u.class_group<>'' GROUP BY u.class_group ORDER BY (SUM(COALESCE(u.student_status,'studying')='studying')=0),u.class_group")
  for (const group of groups) for (const key of ['studying', 'graduated', 'dropped', 'inactive', 'total']) group[key] = Number(group[key])
  return { groups, status_th: STATUS_TH }
}
export async function members(db: SqlClient, query: StaffRecord) {
  return { students: await db.rows<StaffRecord>("SELECT id,student_code,full_name,COALESCE(student_status,'studying') AS status FROM users WHERE role='student' AND class_group=? ORDER BY student_code", [text(query.group)]) }
}
export async function renameGroup(db: SqlClient, body: StaffRecord) {
  const from = text(body.from), to = clean(body.to, 30)
  if (!from || !to) throw new ApiError(422, 'กรุณาระบุชื่อกลุ่มเรียนใหม่')
  if (from === to) throw new ApiError(422, 'ชื่อกลุ่มเรียนใหม่เหมือนชื่อเดิม')
  const moved = (await write(db, "UPDATE users SET class_group=? WHERE role='student' AND class_group=? AND COALESCE(student_status,'studying')='studying'", [to, from])).affected
  return { moved, message: `ย้ายนักศึกษา ${moved} คน จาก ${from} ไป ${to} แล้ว` }
}
export async function setStatus(db: SqlClient, body: StaffRecord) {
  const status = inputString(body.status), group = text(body.class_group), selected = ids(body.student_ids)
  if (!Object.hasOwn(STATUS_TH, status)) throw new ApiError(422, 'สถานะไม่ถูกต้อง')
  if (!group && !selected.length) throw new ApiError(422, 'กรุณาเลือกกลุ่มเรียนหรือนักศึกษา')
  const targets = await db.rows<{ id: number }>(`SELECT id FROM users WHERE role='student' AND ${group ? 'class_group=?' : `id IN (${marks(selected)})`}`, group ? [group] : selected)
  if (!targets.length) return { changed: 0, message: 'ไม่พบนักศึกษา' }
  const targetIds = targets.map(row => row.id), active = status === 'studying' ? 1 : 0
  await db.execute(`UPDATE users SET student_status=?,is_active=? WHERE id IN (${marks(targetIds)})`, [status, active, ...targetIds])
  if (!active) await db.execute(`DELETE FROM auth_tokens WHERE user_id IN (${marks(targetIds)})`, targetIds)
  return { changed: targets.length, message: `เปลี่ยนสถานะเป็น “${STATUS_TH[status]}” ${targets.length} คนแล้ว` }
}

// Keep validation untruncated so oversized input cannot silently become valid.
async function departmentInput(db: SqlClient, body: StaffRecord, id = 0) {
  const code = text(body.code).toUpperCase(), name = clean(body.name)
  if (!/^[A-Z0-9._-]{1,20}$/.test(code)) throw new ApiError(422, 'รหัสแผนกต้องเป็นตัวอักษรอังกฤษ/ตัวเลข ไม่เกิน 20 ตัว (เช่น IT, ACC)')
  if (!name || charLength(name) > 150) throw new ApiError(422, 'กรุณากรอกชื่อแผนกวิชา (ไม่เกิน 150 ตัวอักษร)')
  const other = (await db.rows<{ name: string }>('SELECT name FROM departments WHERE code=? AND id<>?', [code, id]))[0]
  if (other) throw new ApiError(409, `รหัสแผนก ${code} ถูกใช้แล้ว (${other.name})`)
  return { code, name }
}
async function departmentWrite(db: SqlClient, sql: string, values: SqlValue[], code: string) {
  try { return await write(db, sql, values) }
  catch (error) {
    // The unique index also covers simultaneous requests that pass the precheck.
    if ((error as { code?: string; errno?: number })?.code === 'ER_DUP_ENTRY' || (error as { errno?: number })?.errno === 1062) {
      throw new ApiError(409, `รหัสแผนก ${code} ถูกใช้แล้ว`)
    }
    throw error
  }
}
export async function createDepartment(db: SqlClient, body: StaffRecord) {
  const { code, name } = await departmentInput(db, body)
  const result = await departmentWrite(db, 'INSERT INTO departments (code,name) VALUES (?,?)', [code, name], code)
  return { id: result.id, message: `เพิ่มแผนก ${code} ${name} แล้ว` }
}
export async function updateDepartment(db: SqlClient, id: number, body: StaffRecord) {
  if (!(await db.rows('SELECT id FROM departments WHERE id=? FOR UPDATE', [id])).length) throw new ApiError(404, 'ไม่พบแผนกวิชา')
  const { code, name } = await departmentInput(db, body, id)
  await departmentWrite(db, 'UPDATE departments SET code=?,name=? WHERE id=?', [code, name, id], code)
  return { ok: true, message: `บันทึกแผนก ${code} ${name} แล้ว` }
}
export async function deleteDepartment(db: SqlClient, id: number) {
  // Existing foreign keys set users/courses.department_id to NULL; never delete their rows.
  if (!(await write(db, 'DELETE FROM departments WHERE id=?', [id])).affected) throw new ApiError(404, 'ไม่พบแผนกวิชา')
  return { ok: true }
}
