import type { AuthUser } from '../../shared/types/auth'
import type { SqlClient } from './db'
import { ApiError } from './errors'
import type { Course } from '../../shared/types/staff'

export async function course(db: SqlClient, user: AuthUser, id: number): Promise<Course> {
  const row = (await db.rows<Course>('SELECT c.*, d.name AS department_name, d.code AS department_code, u.full_name AS teacher_name FROM courses c LEFT JOIN departments d ON d.id = c.department_id LEFT JOIN users u ON u.id = c.teacher_id WHERE c.id = ?', [id]))[0]
  if (!row) throw new ApiError(404, 'ไม่พบรายวิชา')
  if (user.role !== 'admin' && Number(row.teacher_id) !== user.id) throw new ApiError(403, 'คุณไม่ได้เป็นผู้สอนรายวิชานี้')
  return row
}

export async function ownedCourse<T extends { teacher_id: number }>(db: SqlClient, user: AuthUser, id: number): Promise<T> {
  const course = (await db.rows<T>('SELECT * FROM courses WHERE id = ?', [id]))[0]
  if (!course) throw new ApiError(404, 'ไม่พบรายวิชา')
  if (user.role !== 'admin' && Number(course.teacher_id) !== user.id) throw new ApiError(403, 'คุณไม่ได้เป็นผู้สอนรายวิชานี้')
  return course
}
