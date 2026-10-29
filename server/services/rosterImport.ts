import type { Course, StaffRecord } from '../../shared/types/staff'
import type { SqlClient } from '../utils/db'
import { array, clean, marks, record, text, write } from '../utils/staff'
import { hashPassword } from './password'

export async function rosterPreview(db: SqlClient, course: Course, input: unknown) {
  const rows = array(input).slice(0, 1000), codes = [...new Set(rows.map(row => text(record(row).student_code)).filter(Boolean))]
  const users = new Map<string, StaffRecord>(), enrolled = new Set<number>()
  if (codes.length) {
    for (const user of await db.rows<StaffRecord>(`SELECT id,username,student_code,full_name,role FROM users WHERE username IN (${marks(codes)}) OR student_code IN (${marks(codes)})`, [...codes, ...codes])) {
      users.set(user.username.toLowerCase(), user)
      if (user.student_code != null && !users.has(user.student_code.toLowerCase())) users.set(user.student_code.toLowerCase(), user)
    }
    for (const row of await db.rows<{ student_id: number }>('SELECT student_id FROM enrollments WHERE course_id=?', [course.id])) enrolled.add(row.student_id)
  }
  const seen = new Map<string, string>()
  const checked = rows.map((raw, index) => {
    const row = record(raw), data = { student_code: text(row.student_code), full_name: clean(row.full_name), class_group: text(row.class_group, 30) }
    const rowNo = text(row._row ?? index + 2, 60), key = data.student_code.toLowerCase(), user = users.get(key)
    const errors: string[] = [], messages: string[] = []
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(data.student_code)) errors.push('รหัสนักศึกษาต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 3–50 ตัว')
    else if (seen.has(key)) errors.push(`รหัสซ้ำในไฟล์ (แถว ${seen.get(key)})`)
    else if (user && user.role !== 'student') errors.push('รหัสนี้เป็นบัญชีครู/ผู้ดูแลระบบ ไม่ใช่นักศึกษา')
    else if (!user && !data.full_name) errors.push('นักศึกษาใหม่ต้องมีชื่อ-สกุล')
    if (!seen.has(key)) seen.set(key, rowNo)
    let status: string
    if (errors.length) status = 'error'
    else if (!user) { status = 'new'; messages.push('สร้างบัญชีใหม่ · รหัสผ่านเริ่มต้น = รหัสนักศึกษา (ต้องตั้งใหม่เมื่อเข้าครั้งแรก)') }
    else if (enrolled.has(user.id)) { status = 'enrolled'; messages.push('อยู่ในรายวิชานี้แล้ว') }
    else {
      status = 'enroll'; messages.push('มีบัญชีในระบบแล้ว — เพิ่มเข้ารายวิชาเท่านั้น')
      if (data.full_name && data.full_name !== user.full_name) messages.push(`ชื่อในระบบ: ${user.full_name} (ไม่แก้ไข)`)
    }
    return { row: rowNo, status, messages: errors.length ? errors : messages, data, user_id: user?.id ?? null }
  })
  const count = (status: string) => checked.filter(row => row.status === status).length
  return { rows: checked, summary: { total: checked.length, new: count('new'), enroll: count('enroll'), enrolled: count('enrolled'), error: count('error') } }
}
export async function rosterCommit(db: SqlClient, course: Course, input: unknown) {
  const checked = await rosterPreview(db, course, input)
  let created = 0, enrolled = 0
  for (const row of checked.rows) {
    let userId = row.user_id
    if (row.status === 'new') {
      const d = row.data
      userId = (await write(db, "INSERT INTO users (username,password_hash,full_name,role,department_id,student_code,class_group,must_change_password) VALUES (?,?,?,'student',?,?,?,1)", [d.student_code, await hashPassword(d.student_code), d.full_name, course.department_id || null, d.student_code, d.class_group || null])).id
      created++
    }
    if (['new', 'enroll'].includes(row.status)) enrolled += (await write(db, 'INSERT IGNORE INTO enrollments (course_id,student_id) VALUES (?,?)', [course.id, userId])).affected
  }
  return { ...checked.summary, created, enrolled }
}
