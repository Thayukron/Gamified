import type { Course } from '../../shared/types/staff'
import type { SqlClient } from '../utils/db'
import { bookDefaults, normalizeBook, withTopics } from './documentModels'

/**
 * After a course's units are edited (course form, guide page): bring its saved lesson-plan book in line. A book is
 * made only to keep the hours the AI suggested for the units (used to share out the weeks of the schedule).
 */
export async function syncTopics(db: SqlClient, data: Course, topics: string[], hours: unknown[] = []) {
  const stored = (await db.rows<{ content: string }>('SELECT content FROM course_plans WHERE course_id=?', [data.id]))[0]
  if (!stored && !hours.some(Boolean)) return
  const content = stored ? normalizeBook(JSON.parse(stored.content)) : bookDefaults({ ...data, topics: JSON.stringify(topics) }, [], data.teacher_name ?? '')
  const next = withTopics(content, topics, hours)
  if (stored && JSON.stringify(next) === JSON.stringify(content)) return
  await db.execute('INSERT INTO course_plans (course_id,content) VALUES (?,?) ON DUPLICATE KEY UPDATE content=VALUES(content)', [data.id, JSON.stringify(next)])
}
