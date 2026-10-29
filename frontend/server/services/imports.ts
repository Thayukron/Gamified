import type { StaffRecord } from '../../shared/types/staff'
import type { SqlClient, SqlValue } from '../utils/db'
import { ApiError, charLength, inputString } from '../utils/errors'
import { currentTerm } from '../utils/settings'
import { array, bool, clean, record, text } from '../utils/staff'
import { phpInt } from './scenarioEngine'
import { hashPassword } from './password'

const TYPES = ['departments', 'teachers', 'students', 'courses', 'enrollments'] as const
const COURSE_TYPES: Record<string, string> = { theory: 'theory', practice: 'practice', mixed: 'mixed', 'ทฤษฎี': 'theory', 'ปฏิบัติ': 'practice', 'ผสม': 'mixed', 'ทฤษฎี+ปฏิบัติ': 'mixed', 'ทฤษฎีและปฏิบัติ': 'mixed' }
interface Checked { row: string; status: string; messages: string[]; data: StaffRecord; password?: string }
const courseKey = (code: string, section: string, sem: number, year: number) => `${code}|${section}|${sem}|${year}`.toLowerCase()
const termValue = (value: unknown, fallback: number) => phpInt(bool(clean(value)) ? clean(value) : fallback)
const roleTh = (role: string) => ({ student: 'นักศึกษา', teacher: 'ครู', admin: 'ผู้ดูแลระบบ' }[role] ?? role)

class Importer {
  depts = new Map<string, number | null>()
  users = new Map<string, { id: number | null; role: string }>()
  courses = new Map<string, number | null>()
  constructor(public db: SqlClient, public semester: number, public year: number) {}
  async reload() {
    this.depts = new Map((await this.db.rows<{ code: string; id: number }>('SELECT code,id FROM departments')).map(row => [row.code, row.id]))
    for (const row of await this.db.rows<{ id: number; username: string; role: string }>('SELECT id,username,role FROM users')) this.users.set(row.username.toLowerCase(), { id: row.id, role: row.role })
    for (const row of await this.db.rows<StaffRecord>('SELECT id,code,section,semester,academic_year FROM courses')) this.courses.set(courseKey(row.code, row.section, row.semester, row.academic_year), row.id)
  }
  async validate(payload: StaffRecord) {
    const output: Record<string, { rows: Checked[]; summary: StaffRecord }> = {}
    for (const type of TYPES) {
      const rows = array(payload[type]).slice(0, 5000)
      if (!rows.length) continue
      const seen = new Map<string, string>(), checked: Checked[] = []
      for (const [index, raw] of rows.entries()) {
        const row = record(raw), rowNo = Array.from(inputString(row._row ?? index + 2)).slice(0, 60).join('')
        const errors: string[] = [], messages: string[] = []
        let data: StaffRecord = {}, key = '', exists = false, password: string | undefined
        let register = () => {}
        if (type === 'departments') {
          data = { code: clean(row.code).toUpperCase(), name: clean(row.name) }; key = data.code; exists = this.depts.has(key)
          if (!/^[A-Z0-9._-]{1,20}$/.test(key)) errors.push('รหัสแผนกต้องเป็นตัวอักษรอังกฤษ/ตัวเลข ไม่เกิน 20 ตัว')
          if (!data.name) errors.push('ไม่มีชื่อแผนก')
          if (seen.has(key)) errors.push(`รหัสแผนกซ้ำในไฟล์ (แถว ${seen.get(key)})`)
          register = () => { if (!this.depts.has(key)) this.depts.set(key, null) }
        } else if (type === 'teachers' || type === 'students') {
          const role = type === 'students' ? 'student' : 'teacher', field = role === 'student' ? 'student_code' : 'username', username = clean(row[field]), label = role === 'student' ? 'รหัสนักศึกษา' : 'ชื่อผู้ใช้'
          password = inputString(row.password)
          data = { [field]: username, full_name: clean(row.full_name), department_code: clean(row.department_code).toUpperCase() }
          if (role === 'student') data.class_group = clean(row.class_group, 30)
          key = username.toLowerCase()
          const existing = this.users.get(key); exists = Boolean(existing)
          if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) errors.push(`${label} ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 3–50 ตัว`)
          if (!data.full_name) errors.push('ไม่มีชื่อ-สกุล')
          if (data.department_code && !this.depts.has(data.department_code)) errors.push(`ไม่พบแผนก ${data.department_code} (เพิ่มในชีตแผนกวิชาก่อน)`)
          if (password !== '' && charLength(password) < 6) errors.push('รหัสผ่านต้องยาวอย่างน้อย 6 ตัว')
          if (existing && existing.role !== role) errors.push(`${label} นี้เป็นบัญชี${roleTh(existing.role)}อยู่แล้ว`)
          if (seen.has(key)) errors.push(`${label} ซ้ำในไฟล์ (แถว ${seen.get(key)})`)
          register = () => { if (!this.users.has(key)) this.users.set(key, { id: null, role }) }
          if (!errors.length && !exists && password === '') messages.push(`รหัสผ่านเริ่มต้น = ${role === 'student' ? 'รหัสนักศึกษา' : 'ชื่อผู้ใช้'} (ต้องตั้งใหม่เมื่อเข้าสู่ระบบครั้งแรก)`)
        } else if (type === 'courses') {
          const rawType = clean(row.course_type), courseType = COURSE_TYPES[rawType.toLowerCase()] ?? (rawType === '' ? 'mixed' : null)
          data = { code: clean(row.code), name: clean(row.name), section: bool(clean(row.section)) ? clean(row.section) : '1', semester: termValue(row.semester, this.semester), academic_year: termValue(row.academic_year, this.year), department_code: clean(row.department_code).toUpperCase(), teacher_username: clean(row.teacher_username), course_type: courseType ?? 'mixed', level: clean(row.level), topics: inputString(row.topics).split(/[,\n;]/u).map(value => text(value)).filter(bool) }
          key = courseKey(data.code, data.section, data.semester, data.academic_year); exists = this.courses.has(key)
          if (!data.code || charLength(data.code) > 30) errors.push('ไม่มีรหัสวิชา (หรือยาวเกิน 30 ตัว)')
          if (!data.name) errors.push('ไม่มีชื่อวิชา')
          if (data.semester < 1 || data.semester > 3) errors.push('ภาคเรียนต้องเป็น 1, 2 หรือ 3')
          if (data.academic_year < 2500 || data.academic_year > 2700) errors.push('ปีการศึกษาต้องเป็นปี พ.ศ. เช่น 2569')
          if (courseType === null) errors.push('ประเภทวิชาต้องเป็น ทฤษฎี / ปฏิบัติ / ผสม')
          if (data.department_code && !this.depts.has(data.department_code)) errors.push(`ไม่พบแผนก ${data.department_code}`)
          if (data.teacher_username) {
            const teacher = this.users.get(data.teacher_username.toLowerCase())
            if (!teacher) errors.push(`ไม่พบครู ${data.teacher_username} (เพิ่มในชีตครูก่อน)`)
            else if (teacher.role !== 'teacher') errors.push(`${data.teacher_username} ไม่ใช่บัญชีครู`)
          }
          if (seen.has(key)) errors.push(`รายวิชา+กลุ่มเรียนซ้ำในไฟล์ (แถว ${seen.get(key)})`)
          register = () => { if (!this.courses.has(key)) this.courses.set(key, null) }
        } else {
          data = { course_code: clean(row.course_code), section: bool(clean(row.section)) ? clean(row.section) : '1', semester: termValue(row.semester, this.semester), academic_year: termValue(row.academic_year, this.year), student_code: clean(row.student_code) }
          const courseId = courseKey(data.course_code, data.section, data.semester, data.academic_year), student = this.users.get(data.student_code.toLowerCase())
          key = courseId + '#' + data.student_code.toLowerCase()
          if (!this.courses.has(courseId)) errors.push(`ไม่พบรายวิชา ${data.course_code} กลุ่ม ${data.section} ภาคเรียน ${data.semester}/${data.academic_year}`)
          if (!student) errors.push(`ไม่พบนักศึกษา ${data.student_code}`)
          else if (student.role !== 'student') errors.push(`${data.student_code} ไม่ใช่บัญชีนักศึกษา`)
          if (seen.has(key)) errors.push(`ลงทะเบียนซ้ำในไฟล์ (แถว ${seen.get(key)})`)
          if (!errors.length && this.courses.get(courseId) && student?.id) exists = Boolean((await this.db.rows<StaffRecord>('SELECT 1 FROM enrollments WHERE course_id=? AND student_id=?', [this.courses.get(courseId)!, student.id]))[0])
        }
        if (!seen.has(key)) seen.set(key, rowNo)
        if (!errors.length) register()
        checked.push({ row: rowNo, status: errors.length ? 'error' : exists ? 'update' : 'new', messages: errors.length ? errors : messages, data, ...(password !== undefined ? { password } : {}) })
      }
      const count = (status: string) => checked.filter(row => row.status === status).length
      output[type] = { rows: checked, summary: { total: checked.length, new: count('new'), update: count('update'), error: count('error') } }
    }
    return output
  }
  async apply(type: string, row: Checked) {
    const d = row.data
    if (type === 'departments') return this.db.execute('INSERT INTO departments (code,name) VALUES (?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)', [d.code, d.name])
    if (type === 'teachers' || type === 'students') {
      const role = type === 'students' ? 'student' : 'teacher', username = d[role === 'student' ? 'student_code' : 'username'], deptId = d.department_code ? this.depts.get(d.department_code)! : null, group = d.class_group || null
      if (row.status === 'new') return this.db.execute('INSERT INTO users (username,password_hash,full_name,role,department_id,student_code,class_group,must_change_password) VALUES (?,?,?,?,?,?,?,?)', [username, await hashPassword(row.password || username), d.full_name, role, deptId, role === 'student' ? username : null, group, row.password === '' ? 1 : 0])
      const values: SqlValue[] = [d.full_name, deptId, group]
      let sql = 'UPDATE users SET full_name=?,department_id=COALESCE(?,department_id),class_group=COALESCE(?,class_group),is_active=1,student_status=IF(role="student","studying",student_status)'
      if (row.password !== '') { sql += ',password_hash=?'; values.push(await hashPassword(row.password!)) }
      return this.db.execute(sql + ' WHERE username=?', [...values, username])
    }
    if (type === 'courses') return this.db.execute("INSERT INTO courses (code,name,section,semester,academic_year,department_id,teacher_id,course_type,level,topics) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),department_id=COALESCE(VALUES(department_id),department_id),teacher_id=COALESCE(VALUES(teacher_id),teacher_id),course_type=VALUES(course_type),level=COALESCE(VALUES(level),level),topics=IF(VALUES(topics)='[]',topics,VALUES(topics))", [d.code, d.name, d.section, d.semester, d.academic_year, d.department_code ? this.depts.get(d.department_code)! : null, d.teacher_username ? this.users.get(d.teacher_username.toLowerCase())!.id : null, d.course_type, d.level || null, JSON.stringify(d.topics)])
    return this.db.execute('INSERT IGNORE INTO enrollments (course_id,student_id) VALUES (?,?)', [this.courses.get(courseKey(d.course_code, d.section, d.semester, d.academic_year))!, this.users.get(d.student_code.toLowerCase())!.id])
  }
}

export async function importData(db: SqlClient, body: StaffRecord, commit: boolean) {
  const payload = Object.fromEntries(TYPES.filter(type => bool(body[type])).map(type => [type, body[type]]))
  if (!Object.keys(payload).length) throw new ApiError(422, 'ไม่พบข้อมูลที่จะนำเข้า')
  const term = await currentTerm(db), importer = new Importer(db, term.semester, term.academic_year)
  await importer.reload()
  const checked = await importer.validate(payload)
  if (!commit) return { result: Object.fromEntries(Object.entries(checked).map(([type, value]) => [type, { ...value, rows: value.rows.map(({ password: _, ...row }) => row) }])) }
  const applied: StaffRecord = {}
  for (const type of TYPES) {
    const value = checked[type]
    if (!value) continue
    let count = 0
    for (const row of value.rows) if (row.status !== 'error') { await importer.apply(type, row); count++ }
    applied[type] = { ...value.summary, applied: count }; await importer.reload()
  }
  return { applied }
}
