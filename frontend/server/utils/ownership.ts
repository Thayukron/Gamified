import type { AuthUser } from '../../shared/types/auth'
import type { SqlClient } from './db'
import { ApiError } from './errors'

export async function ownedCourse<T extends { teacher_id: number }>(db: SqlClient, user: AuthUser, id: number): Promise<T> {
  const course = (await db.rows<T>('SELECT * FROM courses WHERE id = ?', [id]))[0]
  if (!course) throw new ApiError(404, 'ไม่พบรายวิชา')
  if (user.role !== 'admin' && Number(course.teacher_id) !== user.id) throw new ApiError(403, 'คุณไม่ได้เป็นผู้สอนรายวิชานี้')
  return course
}
