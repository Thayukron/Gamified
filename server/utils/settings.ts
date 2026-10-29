import type { SqlClient } from './db'

// Do not retain per-request PHP config caching across a long-lived Node process.
export async function currentTerm(db: SqlClient, fallback = { semester: 1, academic_year: 2569 }) {
  const rows = await db.rows<{ setting_key: string; setting_value: string }>("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('term_semester', 'term_academic_year')")
  const settings = Object.fromEntries(rows.map(row => [row.setting_key, Number(row.setting_value)]))
  return {
    semester: (settings.term_semester ?? 0) > 0 ? settings.term_semester! : Number(process.env.SEMESTER || fallback.semester),
    academic_year: (settings.term_academic_year ?? 0) > 0 ? settings.term_academic_year! : Number(process.env.ACADEMIC_YEAR || fallback.academic_year),
  }
}
